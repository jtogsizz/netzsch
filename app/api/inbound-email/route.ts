/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Rota 100% server-side — sem cookies, sem sessão de usuário.
// Usa SUPABASE_SECRET_KEY (service_role) via createServiceClient().
// Segurança: INBOUND_EMAIL_SECRET + whitelist de remetentes autorizados.
export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Regex de extração ─────────────────────────────────────────────────────────

/**
 * Regex para números de databook válidos: 5 a 8 dígitos isolados.
 * (?<!\d) e (?!\d) garantem que não é parte de um número maior.
 */
const NUMBER_PATTERN = '(?<!\\d)(\\d{5,8})(?!\\d)';

/**
 * Palavras-chave que indicam que o número seguinte é o do databook.
 * Captura "Databook 500662", "HD 500662", "Solicitação 500662", "DB 500662".
 */
const KEYWORD_PATTERN =
  '(?:databook|solicitac[aã]o|solicita[cç][aã]o|hd|db|n[uú]mero|num|pedido|os|ordem)' +
  '\\s*[:\\-–]?\\s*(\\d{5,8})(?!\\d)';

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
 * Extrai o número primário e números extras do assunto + corpo.
 *
 * Estratégia:
 * 1. Procura número PRECEDIDO de palavra-chave (alta confiança).
 * 2. Fallback: primeiro número de 5–8 dígitos em qualquer parte do texto.
 * 3. Extras = demais números encontrados (vão para notes).
 */
function extractNumbers(
  subject: string,
  body: string
): { primary: string | null; extras: string[] } {
  const fullText = `${subject}\n${body}`;

  // Passo 1: palavra-chave
  const keywordMatches: string[] = [];
  const kwRegex = new RegExp(KEYWORD_PATTERN, 'gi');
  let m: RegExpExecArray | null;
  while ((m = kwRegex.exec(fullText)) !== null) {
    const num = m[1];
    if (!keywordMatches.includes(num)) keywordMatches.push(num);
  }

  // Passo 2: todos os números válidos
  const allNumbers: string[] = [];
  const numRegex = new RegExp(NUMBER_PATTERN, 'g');
  while ((m = numRegex.exec(fullText)) !== null) {
    const num = m[1];
    if (!allNumbers.includes(num)) allNumbers.push(num);
  }

  const primary = keywordMatches[0] ?? allNumbers[0] ?? null;
  const extras = allNumbers.filter((n) => n !== primary);

  return { primary, extras };
}

/** Normaliza uma linha para extrair chave/valor separados por : */
function parseLine(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const key = line.slice(0, idx).trim().toLowerCase();
  const value = line.slice(idx + 1).trim();
  if (!key || !value) return null;
  return { key, value };
}

/** Normaliza texto removendo acentos e deixando lowercase sem caracteres especiais */
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
    numero: 'number', num: 'number', solicitacao: 'number',
    databook: 'number', hd: 'number', db: 'number',
    cliente: 'client_name', client: 'client_name', nomecliente: 'client_name',
    empresa: 'company_name', usina: 'company_name',
    filial: 'technical_status', uf: 'technical_status', statustecnico: 'technical_status',
    responsavel: 'responsible_name', responsible: 'responsible_name',
    status: 'general_status', situacao: 'general_status', generalstatus: 'general_status',
    prioridade: 'priority', priority: 'priority',
    entrada: 'entry_date', abertura: 'entry_date', dataabertura: 'entry_date',
    entrega: 'delivery_date', prazo: 'delivery_date', previsao: 'delivery_date',
    tipo: 'type', type: 'type',
    fy: 'fiscal_year', anofiscal: 'fiscal_year', fiscalyear: 'fiscal_year',
    obs: 'notes', observacao: 'notes', observacoes: 'notes', notes: 'notes', nota: 'notes',
  };
  return map[n] ?? null;
}

/**
 * Parser estruturado — opcional, para emails que contenham linhas "Campo: Valor".
 * O campo 'number' é ignorado aqui (já extraído por extractNumbers).
 */
function parseStructuredFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseLine(trimmed);
    if (!parsed) continue;
    const canonical = resolveField(parsed.key);
    if (canonical && canonical !== 'number' && parsed.value) {
      fields[canonical] = parsed.value;
    }
  }
  return fields;
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type LogQueueStatus = 'pending' | 'approved' | 'duplicate' | 'blocked' | 'error';
type LogLegacyStatus = 'success' | 'duplicate' | 'blocked' | 'error';

interface ImportLogEntry {
  from_address: string;
  from_name: string | null;
  to_address: string | null;
  subject: string;
  raw_body: string;
  raw_html: string | null;
  extracted_fields: Record<string, string> | null;
  databook_number: string | null;
  /** status legado — mantido para compatibilidade */
  status: LogLegacyStatus;
  /** status da fila de aprovação — campo principal */
  queue_status: LogQueueStatus;
  error_message: string | null;
  databook_id: string | null;
}

// ── Log auxiliar ──────────────────────────────────────────────────────────────

async function logImport(entry: ImportLogEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    await (supabase as any).from('email_import_logs').insert({
      from_address: entry.from_address,
      from_name: entry.from_name,
      to_address: entry.to_address,
      subject: entry.subject,
      raw_body: entry.raw_body.slice(0, 4000),
      raw_html: entry.raw_html ? entry.raw_html.slice(0, 50000) : null,
      extracted_fields: entry.extracted_fields,
      status: entry.status,
      queue_status: entry.queue_status,
      error_message: entry.error_message,
      databook_number: entry.databook_number,
      databook_id: entry.databook_id,
    });
  } catch (err) {
    console.error('[inbound-email] Erro ao gravar email_import_logs:', err);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

/**
 * POST /api/inbound-email
 *
 * Webhook chamado pela Resend quando um email chega em databook@prenaarok.resend.app.
 * Payload (Resend Inbound Webhook v1): { from, to, subject, text, html, headers, ... }
 *
 * Fluxo de segurança:
 *   1. Valida INBOUND_EMAIL_SECRET no header Authorization
 *   2. Valida remetente na whitelist inbound_email_allowed_senders (active = true)
 *   3. Extrai número do assunto/corpo (5–8 dígitos)
 *   4. Verifica duplicata em databooks
 *   5. Grava log com queue_status = 'pending' — operador decide se cria o databook
 *
 * ATENÇÃO: O databook NÃO é criado automaticamente.
 * O operador deve clicar "Adicionar ao Sistema" na tela de Log de Emails.
 *
 * Retorna sempre 200 para blocked/duplicate/error controlado
 * para que a Resend não reencaminhe o webhook como falha.
 */
export async function POST(request: Request) {
  // ── 1. Autenticação via secret ─────────────────────────────────────────────
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
    // 401 aqui é OK — token errado indica requisição maliciosa, não Resend
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // ── 2. Parse do payload ────────────────────────────────────────────────────
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
  }

  // Normaliza o endereço do remetente (pode vir como "Nome <email>" ou só "email")
  const rawFrom: string = payload?.from ?? '';
  const fromAddress = rawFrom.match(/<([^>]+)>/)?.[1]?.toLowerCase().trim()
    ?? rawFrom.toLowerCase().trim();

  // Extrai o nome do remetente se presente (ex.: "João Gabriel <joao@gmail.com>" → "João Gabriel")
  const fromNameRaw = rawFrom.match(/^([^<]+)<[^>]+>/)?.[1]?.trim() ?? null;
  const fromName = fromNameRaw && fromNameRaw.length > 0 ? fromNameRaw : null;

  // Destinatário
  const rawTo: string = Array.isArray(payload?.to) ? payload.to[0] : (payload?.to ?? '');
  const toAddress = rawTo.trim() || null;

  const subject: string = payload?.subject ?? '';
  const emailText = extractText(payload);
  const emailHtml: string | null =
    typeof payload?.html === 'string' && payload.html.trim() ? payload.html : null;
  const searchText = emailText || subject;

  // ── 3. Validação da whitelist ──────────────────────────────────────────────
  const supabase = createServiceClient();

  const { data: senderRow, error: senderError } = await (supabase as any)
    .from('inbound_email_allowed_senders')
    .select('id, email, name, active')
    .eq('email', fromAddress)
    .maybeSingle();

  if (senderError) {
    console.error('[inbound-email] Erro ao consultar whitelist:', senderError);
    await logImport({
      from_address: fromAddress,
      from_name: fromName,
      to_address: toAddress,
      subject,
      raw_body: searchText,
      raw_html: emailHtml,
      extracted_fields: null,
      status: 'error',
      queue_status: 'error',
      error_message: `Erro ao consultar whitelist: ${senderError.message}`,
      databook_number: null,
      databook_id: null,
    });
    // Retorna 200 para não causar reenvio pela Resend
    return NextResponse.json({ received: true, action: 'error', reason: 'whitelist_query_failed' });
  }

  if (!senderRow || !senderRow.active) {
    const reason = !senderRow
      ? 'Remetente não encontrado na whitelist'
      : 'Remetente desativado na whitelist';
    console.warn(`[inbound-email] Bloqueado: ${fromAddress} — ${reason}`);
    await logImport({
      from_address: fromAddress,
      from_name: fromName,
      to_address: toAddress,
      subject,
      raw_body: searchText,
      raw_html: emailHtml,
      extracted_fields: null,
      status: 'blocked',
      queue_status: 'blocked',
      error_message: reason,
      databook_number: null,
      databook_id: null,
    });
    // 200 para não causar reenvio pela Resend
    return NextResponse.json({ received: true, action: 'blocked', reason });
  }

  // ── 4. Extração do número ──────────────────────────────────────────────────
  const { primary: databookNumber, extras: extraNumbers } = extractNumbers(
    subject,
    emailText
  );

  // ── 5. Parser estruturado (opcional) ──────────────────────────────────────
  const structuredFields = parseStructuredFields(emailText);
  const hasStructuredData = Object.keys(structuredFields).length > 0;

  // Monta nota automática para uso futuro quando o operador aprovar
  let notesValue = hasStructuredData && structuredFields['notes']
    ? structuredFields['notes']
    : 'Criado automaticamente por email. Completar dados manualmente.';

  if (extraNumbers.length > 0) {
    notesValue += ` | Outros números no email: ${extraNumbers.join(', ')}`;
  }

  // Salva campos estruturados no JSON para uso na aprovação posterior
  const extractedFieldsForLog = databookNumber
    ? {
        ...structuredFields,
        // Inclui o número e extras para referência
        _number: databookNumber,
        _extra_numbers: extraNumbers.join(','),
        _notes: notesValue,
      }
    : (hasStructuredData ? { ...structuredFields, _notes: notesValue } : null);

  if (!databookNumber) {
    const msg = 'Nenhum número de databook (5–8 dígitos) encontrado no email';
    console.warn(`[inbound-email] ${msg}. From: ${fromAddress} | Subject: ${subject}`);
    await logImport({
      from_address: fromAddress,
      from_name: fromName,
      to_address: toAddress,
      subject,
      raw_body: searchText,
      raw_html: emailHtml,
      extracted_fields: extractedFieldsForLog,
      status: 'error',
      queue_status: 'error',
      error_message: msg,
      databook_number: null,
      databook_id: null,
    });
    return NextResponse.json({ received: true, action: 'error', reason: msg });
  }

  // ── 6. Verificar duplicata ─────────────────────────────────────────────────
  const { data: existing, error: fetchError } = await (supabase as any)
    .from('databooks')
    .select('id, number')
    .eq('number', databookNumber)
    .maybeSingle();

  if (fetchError) {
    console.error('[inbound-email] Erro ao buscar databook existente:', fetchError);
    await logImport({
      from_address: fromAddress,
      from_name: fromName,
      to_address: toAddress,
      subject,
      raw_body: searchText,
      raw_html: emailHtml,
      extracted_fields: extractedFieldsForLog,
      status: 'error',
      queue_status: 'error',
      error_message: `Erro ao consultar banco: ${fetchError.message}`,
      databook_number: databookNumber,
      databook_id: null,
    });
    return NextResponse.json({ received: true, action: 'error', reason: 'db_query_failed' });
  }

  if (existing) {
    const msg = `Databook ${databookNumber} já existe no sistema`;
    console.info(`[inbound-email] Duplicata detectada: ${msg}`);
    await logImport({
      from_address: fromAddress,
      from_name: fromName,
      to_address: toAddress,
      subject,
      raw_body: searchText,
      raw_html: emailHtml,
      extracted_fields: extractedFieldsForLog,
      status: 'duplicate',
      queue_status: 'duplicate',
      error_message: msg,
      databook_number: databookNumber,
      databook_id: existing.id,
    });
    return NextResponse.json({
      received: true,
      action: 'duplicate',
      databook_number: databookNumber,
      databook_id: existing.id,
    });
  }

  // ── 7. Gravar na fila de aprovação (pending) ───────────────────────────────
  //
  // O databook NÃO é criado aqui. O operador deve revisar o email na tela
  // "Log de Emails" e clicar em "Adicionar ao Sistema" para criar o databook.
  await logImport({
    from_address: fromAddress,
    from_name: fromName,
    to_address: toAddress,
    subject,
    raw_body: searchText,
    raw_html: emailHtml,
    extracted_fields: extractedFieldsForLog,
    status: 'success',          // legado: 'success' indica email válido recebido
    queue_status: 'pending',    // novo: aguarda aprovação do operador
    error_message: null,
    databook_number: databookNumber,
    databook_id: null,           // será preenchido após aprovação
  });

  console.log(
    `[inbound-email] Email válido enfileirado (pending): DB ${databookNumber}` +
    ` | De: ${fromAddress}` +
    (fromName ? ` (${fromName})` : '') +
    (senderRow.name ? ` / Whitelist: ${senderRow.name}` : '') +
    (extraNumbers.length ? ` | outros números: ${extraNumbers.join(', ')}` : '')
  );

  return NextResponse.json({
    received: true,
    action: 'queued',
    queue_status: 'pending',
    databook_number: databookNumber,
    ...(extraNumbers.length > 0 && { other_numbers_found: extraNumbers }),
  });
}
