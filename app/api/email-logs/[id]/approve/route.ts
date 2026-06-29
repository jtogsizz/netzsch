/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Helpers para parse de campos estruturados
function parseDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      const d = new Date(`${year}-${month}-${day}`);
      if (!isNaN(d.getTime())) return `${year}-${month}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function parseStatus(value: string): 'Novo' | 'Em andamento' | 'Encerrado' {
  const upper = value.toUpperCase();
  if (upper.includes('ENCERRADO') || upper.includes('CLOSED') || upper.includes('DONE'))
    return 'Encerrado';
  if (upper.includes('ANDAMENTO') || upper.includes('PROCESSO') || upper.includes('PROGRESS'))
    return 'Em andamento';
  return 'Novo';
}

function parsePriority(value: string): 'Alta' | 'Normal' | 'Baixa' {
  const upper = value.toUpperCase();
  if (upper.includes('ALTA') || upper.includes('HIGH') || upper.includes('URGENTE')) return 'Alta';
  if (upper.includes('BAIXA') || upper.includes('LOW')) return 'Baixa';
  return 'Normal';
}

/**
 * POST /api/email-logs/[id]/approve
 *
 * Aprova um email da fila:
 *   1. Lê o log pelo id
 *   2. Verifica se não existe databook com o mesmo número (nova verificação de duplicata)
 *   3. Cria o databook com os dados extraídos
 *   4. Grava audit_log com changed_by identificando o usuário
 *   5. Atualiza o log: queue_status → 'approved', databook_id preenchido
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Cliente autenticado para verificar usuário e ler o log
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  // ── 1. Ler o log ───────────────────────────────────────────────────────────
  const { data: log, error: logError } = await (supabase as any)
    .from('email_import_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (logError || !log) {
    return NextResponse.json({ error: 'Log não encontrado' }, { status: 404 });
  }

  if (log.queue_status === 'approved') {
    return NextResponse.json({ error: 'Email já foi aprovado anteriormente' }, { status: 409 });
  }

  if (log.queue_status === 'blocked') {
    return NextResponse.json({ error: 'Emails bloqueados não podem ser aprovados' }, { status: 422 });
  }

  if (!log.databook_number) {
    return NextResponse.json({
      error: 'Não é possível criar databook: número não foi extraído do email'
    }, { status: 422 });
  }

  // ── 2. Verificar duplicata ─────────────────────────────────────────────────
  const { data: existing, error: dupError } = await (supabase as any)
    .from('databooks')
    .select('id, number')
    .eq('number', log.databook_number)
    .maybeSingle();

  if (dupError) {
    return NextResponse.json({ error: 'Erro ao verificar duplicata' }, { status: 500 });
  }

  if (existing) {
    // Atualiza o log como duplicate sem criar databook
    await (supabase as any)
      .from('email_import_logs')
      .update({ queue_status: 'duplicate', databook_id: existing.id })
      .eq('id', id);

    return NextResponse.json({
      error: `Databook ${log.databook_number} já existe no sistema`,
      duplicate: true,
      databook_id: existing.id,
    }, { status: 409 });
  }

  // ── 3. Montar dados do databook ────────────────────────────────────────────
  const fields: Record<string, string> = log.extracted_fields ?? {};
  const extraNumbers: string = fields._extra_numbers ?? '';
  const notesFromFields: string = fields._notes ?? '';

  let notesValue = notesFromFields ||
    'Criado automaticamente por email. Completar dados manualmente.';
  if (extraNumbers) {
    notesValue += ` | Outros números no email: ${extraNumbers}`;
  }

  const databookData = {
    number: log.databook_number,
    client_name: fields['client_name'] || null,
    technical_status: fields['technical_status'] || null,
    company_name: fields['company_name'] || null,
    responsible_name: fields['responsible_name'] || null,
    general_status: fields['general_status']
      ? parseStatus(fields['general_status'])
      : 'Novo',
    delivery_date: fields['delivery_date'] ? parseDate(fields['delivery_date']) : null,
    entry_date: fields['entry_date']
      ? parseDate(fields['entry_date'])
      : new Date().toISOString().split('T')[0],
    priority: fields['priority'] ? parsePriority(fields['priority']) : 'Normal',
    type: fields['type'] || 'Peças',
    fiscal_year: fields['fiscal_year'] || null,
    notes: notesValue,
    source: 'email',
  };

  // ── 4. Criar databook (via admin para bypassar RLS) ────────────────────────
  const adminSupabase = await createAdminClient();

  const { data: created, error: insertError } = await (adminSupabase as any)
    .from('databooks')
    .insert(databookData)
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({
      error: `Erro ao criar databook: ${insertError.message}`
    }, { status: 500 });
  }

  const databookId: string = created.id;

  // ── 5. Audit log ───────────────────────────────────────────────────────────
  await (adminSupabase as any).from('audit_logs').insert({
    databook_id: databookId,
    action: 'created',
    field_name: null,
    old_value: null,
    new_value: log.databook_number,
    changed_by: `queue:approve:${user.email ?? user.id}`,
  });

  // ── 6. Atualizar log para approved ─────────────────────────────────────────
  await (supabase as any)
    .from('email_import_logs')
    .update({ queue_status: 'approved', databook_id: databookId })
    .eq('id', id);

  console.log(
    `[email-logs/approve] Databook ${log.databook_number} criado por ${user.email ?? user.id}` +
    ` | Log ID: ${id}`
  );

  return NextResponse.json({
    approved: true,
    databook_id: databookId,
    databook_number: log.databook_number,
  });
}
