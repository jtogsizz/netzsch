/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Rota 100% server-side — sem cookies, sem sessão de usuário.
// Usa SUPABASE_SECRET_KEY (service_role) diretamente.
// Autenticação via INBOUND_EMAIL_SECRET no header Authorization.
export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Regex para encontrar números de databook/solicitação válidos.
 * Critério: sequência numérica de 5 a 8 dígitos NÃO precedida/seguida
 * por outro dígito (para não capturar CEPs, telefones, anos, etc.).
 */
const NUMBER_REGEX = /(?<!\d)(\d{5,8})(?!\d)/g;

/**
 * Palavras-chave que indicam que o número logo após é o número do databook.
 * Captura "Databook 500662", "HD 500662", "Solicitação 500662", "DB 500662".
 */
const KEYWORD_REGEX =
  /(?:databook|solicitac[aã]o|solicita[cç][aã]o|hd|db|n[uú]mero|num|pedido|os|ordem)\s*[:\-–]?\s*(\d{5,8})(?!\d)/gi;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai texto do corpo do email. Preferência: plain text; fallback: HTML strip. */
function extractText(payload: any): string {
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim();
  }
  if (typeof payload?.html === 'string' && payload.html.trim()) {
    return payload.html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .trim();
  }
  return '';
}

/**
 * Estratégia de extração de número:
 *
 * 1. Procura no assunto ou corpo por números PRECEDIDOS de palavra-chave
 *    (Databook, Solicitação, HD, DB, etc.)  → maior confiança.
 * 2. Se não achar pela palavra-chave, pega o primeiro número de 5–8 dígitos
 *    que apareça em qualquer parte do assunto ou corpo.
 * 3. Retorna { primary, extras } onde extras = demais números encontrados.
 */
function extractNumbers(subject: string, body: string): {
  primary: string | null;
  extras: string[];
} {
  const fullText = `${subject}\n${body}`;

  // ── Passo 1: palavra-chave ────────────────────────────────────────────────
  const keywordMatches: string[] = [];
  let m: RegExpExecArray | null;
  const kwRegex = new RegExp(KEYWORD_REGEX.source, 'gi'); // nova instância p/ evitar estado
  while ((m = kwRegex.exec(fullText)) !== null) {
    const num = m[1];
    if (!keywordMatches.includes(num)) keywordMatches.push(num);
  }

  // ── Passo 2: todos os números válidos no texto completo ──────────────────
  const allNumbers: string[] = [];
  const numRegex = new RegExp(NUMBER_REGEX.source, 'g');
  while ((m = numRegex.exec(fullText)) !== null) {
    const num = m[1];
    if (!allNumbers.includes(num)) allNumbers.push(num);
  }

  // ── Decide o primário ────────────────────────────────────────────────────
  const primary = keywordMatches[0] ?? allNumbers[0] ?? null;

  // Extras = todos os demais números (excluindo o primário)
  const extras = allNumbers.filter((n) => n !== primary);

  return { primary, extras };
}

/** Normaliza uma linha para extrair chave/valor separados por : */
function parseLine(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const key = line.slice(0, idx).trim().toLowerCase();
  const value = line.slice(idx + 1).trim();
  return { key, value };
}

/** Normaliza texto removendo acentos e deixando lowercase */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Mapeia alias de chave para nome canônico do campo */
function resolveField(rawKey: string): string | null {
  const n = normalize(rawKey);
  const map: Record<string, string> = {
    numero: 'number',
    num: 'number',
    solicitacao: 'number',
    databook: 'number',
    hd: 'number',
    db: 'number',
    cliente: 'client_name',
    client: 'client_name',
    nomecliente: 'client_name',
    empresa: 'company_name',
    usina: 'company_name',
    filial: 'technical_status',
    uf: 'technical_status',
    statustecnico: 'technical_status',
    responsavel: 'responsible_name',
    responsible: 'responsible_name',
    status: 'general_status',
    situacao: 'general_status',
    generalstatus: 'general_status',
    prioridade: 'priority',
    priority: 'priority',
    entrada: 'entry_date',
    abertura: 'entry_date',
    dataabertura: 'entry_date',
    entrega: 'delivery_date',
    prazo: 'delivery_date',
    previsao: 'delivery_date',
    tipo: 'type',
    type: 'type',
    fy: 'fiscal_year',
    anofiscal: 'fiscal_year',
    fiscalyear: 'fiscal_year',
    obs: 'notes',
    observacao: 'notes',
    observacoes: 'notes',
    notes: 'notes',
    nota: 'notes',
  };
  return map[n] ?? null;
}

/** Normaliza valor de data para YYYY-MM-DD ou null */
function parseDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  // DD/MM/AAAA ou DD/MM/AA
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

  // AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  // Fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

/** Normaliza general_status */
function parseStatus(value: string): 'Novo' | 'Em andamento' | 'Encerrado' {
  const upper = value.toUpperCase();
  if (upper.includes('ENCERRADO') || upper.includes('CLOSED') || upper.includes('DONE'))
    return 'Encerrado';
  if (upper.includes('ANDAMENTO') || upper.includes('PROCESSO') || upper.includes('PROGRESS'))
    return 'Em andamento';
  return 'Novo';
}

/** Normaliza priority */
function parsePriority(value: string): 'Alta' | 'Normal' | 'Baixa' {
  const upper = value.toUpperCase();
  if (upper.includes('ALTA') || upper.includes('HIGH') || upper.includes('URGENTE'))
    return 'Alta';
  if (upper.includes('BAIXA') || upper.includes('LOW')) return 'Baixa';
  return 'Normal';
}

/**
 * Parser estruturado (opcional, compatibilidade com o formato "Campo: Valor").
 * Funciona quando o email contém linhas como:
 *   Cliente: Empresa ABC
 *   Responsável: João
 *   Status: Novo
 * O campo "number" do parser estruturado é ignorado aqui —
 * o número já foi extraído pelo extractNumbers() antes.
 */
function parseStructuredFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseLine(trimmed);
    if (!parsed) continue;
    const canonical = resolveField(parsed.key);
    // Ignora o campo 'number' aqui — já tratado pelo extractNumbers
    if (canonical && canonical !== 'number' && parsed.value) {
      fields[canonical] = parsed.value;
    }
  }
  return fields;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/inbound-email
 *
 * Webhook chamado pelo Resend quando um email inbound chega.
 * Payload esperado (Resend Inbound Webhook v1):
 *   { from, to, subject, text, html, headers, ... }
 *
 * Autenticação: Bearer <INBOUND_EMAIL_SECRET> no header Authorization.
 *
 * O email NÃO precisa estar formatado. Basta conter o número (5–8 dígitos)
 * em qualquer parte do assunto ou corpo — por exemplo:
 *   Subject: "Novo databook 500662"
 *   Body:    "Segue solicitação 500662 recebida por email."
 *
 * Campos estruturados (opcional):
 *   Cliente: Empresa ABC
 *   Responsável: João
 *   Status: Em andamento
 */
export async function POST(request: Request) {
  // ── 1. Autenticação via secret ────────────────────────────────────────────
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INBOUND_EMAIL_SECRET;

  if (!secret) {
    console.error('[inbound-email] INBOUND_EMAIL_SECRET não configurado');
    return NextResponse.json({ error: 'Configuração ausente no servidor' }, { status: 500 });
  }

  const providedToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (providedToken !== secret) {
    console.warn('[inbound-email] Token inválido recebido');
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // ── 2. Parse do payload ──────────────────────────────────────────────────
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
  }

  const fromAddress: string = payload?.from ?? '';
  const subject: string = payload?.subject ?? '';
  const emailText = extractText(payload);

  // Fonte de busca: assunto + corpo (mesmo que corpo esteja vazio)
  const searchText = emailText || subject;

  // ── 3. Extração inteligente do número ────────────────────────────────────
  const { primary: databookNumber, extras: extraNumbers } = extractNumbers(
    subject,
    emailText
  );

  if (!databookNumber) {
    const msg = 'Nenhum número de databook encontrado no assunto ou corpo do email';
    console.warn(`[inbound-email] ${msg}. From: ${fromAddress} | Subject: ${subject}`);
    await logImport({
      from_address: fromAddress,
      subject,
      raw_body: searchText,
      status: 'error',
      error_message: msg,
      databook_number: null,
      databook_id: null,
    });
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // ── 4. Parser estruturado (opcional) ─────────────────────────────────────
  // Lê campos adicionais se o email contiver linhas "Campo: Valor"
  const structuredFields = parseStructuredFields(emailText);

  // ── 5. Monta a nota base ──────────────────────────────────────────────────
  // Se o email veio com campos estruturados, usa as notas deles;
  // caso contrário, gera nota informativa padrão.
  const hasStructuredData = Object.keys(structuredFields).length > 0;

  let notesValue: string;
  if (hasStructuredData && structuredFields['notes']) {
    notesValue = structuredFields['notes'];
  } else {
    notesValue = 'Criado automaticamente por email. Completar dados manualmente.';
  }

  // Acrescenta números extras encontrados no email (para rastreabilidade)
  if (extraNumbers.length > 0) {
    notesValue += ` | Outros números no email: ${extraNumbers.join(', ')}`;
  }

  // ── 6. Monta objeto de inserção ──────────────────────────────────────────
  const databookData = {
    number: databookNumber,
    client_name: structuredFields['client_name'] || null,
    technical_status: structuredFields['technical_status'] || null,
    company_name: structuredFields['company_name'] || null,
    responsible_name: structuredFields['responsible_name'] || null,
    general_status: structuredFields['general_status']
      ? parseStatus(structuredFields['general_status'])
      : 'Novo',
    delivery_date: structuredFields['delivery_date']
      ? parseDate(structuredFields['delivery_date'])
      : null,
    entry_date: structuredFields['entry_date']
      ? parseDate(structuredFields['entry_date'])
      : new Date().toISOString().split('T')[0],
    priority: structuredFields['priority']
      ? parsePriority(structuredFields['priority'])
      : 'Normal',
    type: structuredFields['type'] || 'Peças',
    fiscal_year: structuredFields['fiscal_year'] || null,
    notes: notesValue,
    source: 'email',
  };

  // ── 7. Verificar duplicidade e inserir/atualizar ──────────────────────────
  const supabase = createServiceClient();

  const { data: existing, error: fetchError } = await (supabase as any)
    .from('databooks')
    .select('id, number')
    .eq('number', databookNumber)
    .maybeSingle();

  if (fetchError) {
    console.error('[inbound-email] Erro ao buscar databook existente:', fetchError);
    await logImport({
      from_address: fromAddress,
      subject,
      raw_body: searchText,
      status: 'error',
      error_message: `Erro ao consultar banco: ${fetchError.message}`,
      databook_number: databookNumber,
      databook_id: null,
    });
    return NextResponse.json({ error: 'Erro interno ao consultar banco' }, { status: 500 });
  }

  let databookId: string | null = null;
  let action: 'created' | 'updated' = 'created';

  if (existing) {
    // ── Atualiza somente os campos que vieram estruturados
    // (não sobrescreve dados manuais com defaults do email simples)
    const updateData: Record<string, unknown> = { source: 'email' };
    if (hasStructuredData) {
      Object.assign(updateData, databookData);
    }

    const { data: updated, error: updateError } = await (supabase as any)
      .from('databooks')
      .update(updateData)
      .eq('id', existing.id)
      .select('id')
      .single();

    if (updateError) {
      console.error('[inbound-email] Erro ao atualizar databook:', updateError);
      await logImport({
        from_address: fromAddress,
        subject,
        raw_body: searchText,
        status: 'error',
        error_message: `Erro ao atualizar: ${updateError.message}`,
        databook_number: databookNumber,
        databook_id: existing.id,
      });
      return NextResponse.json({ error: 'Erro ao atualizar databook' }, { status: 500 });
    }

    databookId = updated?.id ?? existing.id;
    action = 'updated';
  } else {
    // ── Cria novo databook com os dados do email
    const { data: created, error: insertError } = await (supabase as any)
      .from('databooks')
      .insert(databookData)
      .select('id')
      .single();

    if (insertError) {
      console.error('[inbound-email] Erro ao criar databook:', insertError);
      await logImport({
        from_address: fromAddress,
        subject,
        raw_body: searchText,
        status: 'error',
        error_message: `Erro ao criar: ${insertError.message}`,
        databook_number: databookNumber,
        databook_id: null,
      });
      return NextResponse.json({ error: 'Erro ao criar databook' }, { status: 500 });
    }

    databookId = created?.id ?? null;
  }

  // ── 8. Audit log ──────────────────────────────────────────────────────────
  if (databookId) {
    await (supabase as any).from('audit_logs').insert({
      databook_id: databookId,
      action,
      field_name: null,
      old_value: null,
      new_value: databookNumber,
      changed_by: `email:${fromAddress}`,
    });
  }

  // ── 9. Log de importação ──────────────────────────────────────────────────
  await logImport({
    from_address: fromAddress,
    subject,
    raw_body: searchText,
    status: 'success',
    error_message: null,
    databook_number: databookNumber,
    databook_id: databookId,
  });

  console.log(
    `[inbound-email] ${action === 'created' ? 'Criado' : 'Atualizado'} databook ` +
    `${databookNumber} via email de ${fromAddress}` +
    (extraNumbers.length ? ` (outros números: ${extraNumbers.join(', ')})` : '')
  );

  return NextResponse.json({
    success: true,
    action,
    databook_number: databookNumber,
    databook_id: databookId,
    ...(extraNumbers.length > 0 && { other_numbers_found: extraNumbers }),
  });
}

// ── Log auxiliar ──────────────────────────────────────────────────────────────

interface ImportLogEntry {
  from_address: string;
  subject: string;
  raw_body: string;
  status: 'success' | 'error';
  error_message: string | null;
  databook_number: string | null;
  databook_id: string | null;
}

async function logImport(entry: ImportLogEntry) {
  try {
    const supabase = createServiceClient();
    await (supabase as any).from('email_import_logs').insert({
      from_address: entry.from_address,
      subject: entry.subject,
      raw_body: entry.raw_body.slice(0, 4000),
      status: entry.status,
      error_message: entry.error_message,
      databook_number: entry.databook_number,
      databook_id: entry.databook_id,
    });
  } catch (err) {
    console.error('[inbound-email] Erro ao gravar email_import_logs:', err);
  }
}
