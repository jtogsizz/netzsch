import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { DatabookUpdate, Databook } from '@/types';

// GET /api/databooks/[id] — busca databook por id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('databooks')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Databook não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/databooks/[id] — atualiza databook e registra audit log por campo alterado
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: DatabookUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // Busca o estado atual para diff do audit log
  const { data: current } = await supabase
    .from('databooks')
    .select('*')
    .eq('id', id)
    .single();

  if (!current) {
    return NextResponse.json({ error: 'Databook não encontrado' }, { status: 404 });
  }

  // Se o número está sendo alterado, verifica duplicidade
  if (body.number && body.number !== current.number) {
    const { data: existing } = await supabase
      .from('databooks')
      .select('id')
      .eq('number', body.number.trim())
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Já existe um databook com o número "${body.number}"` },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from('databooks')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Gera um audit log por campo que mudou
  const auditEntries: {
    databook_id: string;
    action: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
  }[] = [];

  const trackedFields: (keyof Databook)[] = [
    'number', 'entry_date', 'client_name', 'technical_status', 'company_name',
    'responsible_name', 'general_status', 'delivery_date', 'priority', 'type',
    'fiscal_year', 'notes',
  ];

  for (const field of trackedFields) {
    const oldVal = current[field] != null ? String(current[field]) : null;
    const newVal = data[field] != null ? String(data[field]) : null;
    if (oldVal !== newVal) {
      auditEntries.push({
        databook_id: id,
        action: 'updated',
        field_name: field,
        old_value: oldVal,
        new_value: newVal,
        changed_by: user.email ?? user.id,
      });
    }
  }

  if (auditEntries.length > 0) {
    await adminClient.from('audit_logs').insert(auditEntries);
  }

  return NextResponse.json({ data });
}

// DELETE /api/databooks/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: current } = await supabase
    .from('databooks')
    .select('number')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('databooks').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await adminClient.from('audit_logs').insert({
    databook_id: null,
    action: 'deleted',
    field_name: null,
    old_value: current?.number ?? id,
    new_value: null,
    changed_by: user.email ?? user.id,
  });

  return NextResponse.json({ success: true });
}
