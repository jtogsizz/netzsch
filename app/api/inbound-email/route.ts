/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

// Rota 100% server-side — sem cookies, sem sessão de usuário.
// Usa SUPABASE_SECRET_KEY (service_role) via createServiceClient().
//
// DOIS modos de operação:
//  A) Webhook real da Resend  — autenticado via headers Svix (svix-id, svix-timestamp, svix-signature)
//                               Payload: { type: "email.received", data: { email_id, from, to, subject, ... } }
//                               Corpo do email buscado via resend.emails.receiving.get(email_id)
//  B) Teste manual (PowerShell) — autenticado via Authorization: Bearer INBOUND_EMAIL_SECRET
//                               Payload flat: { from, to, subject, text, html }
export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Regex de extração ─────────────────────────────────────────────────────────

const NUMBER_PATTERN = '(?<!\\d)(\\d{5,8})(?!\\d)';
const KEYWORD_PATTERN =
  '(?:databook|solicitac[aã]o|solicita[cç][aã]o|hd|db|n[uú]mero|num|pedido|os|ordem)' +
  '\\s*[:\\-–]?\\s*(\\d{5,8})(?!\\d)';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai texto do corpo do email. Preferência: plain text; fallback: HTML strip. */
function extractText(textBody: string | null, htmlBody: string | null): string {
  if (textBody && textBody.trim()) return textBody.trim();
  if (htmlBody && htmlBody.trim()) {
    return htmlBody
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

/** Extrai texto do payload flat (compatibilidade com teste manual). */
function extractTextFromPayload(payload: any): string {
  return extractText(
    typeof payload?.text === 'string' ? payload.text : null,
    typeof payload?.html === 'string' ? payload.html : null,
  );
}

function extractNumbers(
  subject: string,
  body: string
): { primary: string | null; extras: string[] } {
  const fullText = `${subject}\n${body}`;
  const keywordMatches: string[] = [];
  const kwRegex = new RegExp(KEYWORD_PATTERN, 'gi');
  let m: RegExpExecArray | null;
  while ((m = kwRegex.exec(fullText)) !== null) {
    const num = m[1];
    if (!keywordMatches.includes(num)) keywordMatches.push(num);
  }
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

function parseLine(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const key = line.slice(0, idx).trim().toLowerCase();
  const value = line.slice(idx + 1).trim();
  if (!key || !value) return null;
  return { key, value };
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

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

/** Normaliza campo "from": extrai endereço e nome. */
function parseFrom(rawFrom: string): { fromAddress: string; fromName: string | null } {
  const match = rawFrom.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      fromName: match[1].trim() || null,
      fromAddress: match[2].toLowerCase().trim(),
    };
  }
  return { fromName: null, fromAddress: rawFrom.toLowerCase().trim() };
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
  status: LogLegacyStatus;
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

// ── Processamento comum ───────────────────────────────────────────────────────

/**
 * Processa os dados do email após autenticação.
 * Compartilhado entre o modo webhook real (Resend) e o modo teste manual.
 */
async function processEmail(
  fromAddress: string,
  fromName: string | null,
  toAddress: string | null,
  subject: string,
  emailText: string,
  emailHtml: string | null,
): Promise<NextResponse> {
  const supabase = createServiceClient();
  const searchText = emailText || subject;

  // ── Validação da whitelist ─────────────────────────────────────────────────
  const { data: senderRow, error: senderError } = await (supabase as any)
    .from('inbound_email_allowed_senders')
    .select('id, email, name, active')
    .eq('email', fromAddress)
    .maybeSingle();

  if (senderError) {
    console.error('[inbound-email] Erro ao consultar whitelist:', senderError);
    await logImport({
      from_address: fromAddress, from_name: fromName, to_address: toAddress,
      subject, raw_body: searchText, raw_html: emailHtml,
      extracted_fields: null, status: 'error', queue_status: 'error',
      error_message: `Erro ao consultar whitelist: ${senderError.message}`,
      databook_number: null, databook_id: null,
    });
    return NextResponse.json({ received: true, action: 'error', reason: 'whitelist_query_failed' });
  }

  if (!senderRow || !senderRow.active) {
    const reason = !senderRow
      ? 'Remetente não encontrado na whitelist'
      : 'Remetente desativado na whitelist';
    console.warn(`[inbound-email] Bloqueado: ${fromAddress} — ${reason}`);
    await logImport({
      from_address: fromAddress, from_name: fromName, to_address: toAddress,
      subject, raw_body: searchText, raw_html: emailHtml,
      extracted_fields: null, status: 'blocked', queue_status: 'blocked',
      error_message: reason, databook_number: null, databook_id: null,
    });
    return NextResponse.json({ received: true, action: 'blocked', reason });
  }

  // ── Extração do número ─────────────────────────────────────────────────────
  const { primary: databookNumber, extras: extraNumbers } = extractNumbers(subject, emailText);

  // ── Parser estruturado ─────────────────────────────────────────────────────
  const structuredFields = parseStructuredFields(emailText);
  const hasStructuredData = Object.keys(structuredFields).length > 0;

  let notesValue = hasStructuredData && structuredFields['notes']
    ? structuredFields['notes']
    : 'Criado automaticamente por email. Completar dados manualmente.';
  if (extraNumbers.length > 0) {
    notesValue += ` | Outros números no email: ${extraNumbers.join(', ')}`;
  }

  const extractedFieldsForLog = databookNumber
    ? { ...structuredFields, _number: databookNumber, _extra_numbers: extraNumbers.join(','), _notes: notesValue }
    : (hasStructuredData ? { ...structuredFields, _notes: notesValue } : null);

  if (!databookNumber) {
    const msg = 'Nenhum número de databook (5–8 dígitos) encontrado no email';
    console.warn(`[inbound-email] ${msg}. From: ${fromAddress} | Subject: ${subject}`);
    await logImport({
      from_address: fromAddress, from_name: fromName, to_address: toAddress,
      subject, raw_body: searchText, raw_html: emailHtml,
      extracted_fields: extractedFieldsForLog, status: 'error', queue_status: 'error',
      error_message: msg, databook_number: null, databook_id: null,
    });
    return NextResponse.json({ received: true, action: 'error', reason: msg });
  }

  // ── Verificar duplicata ────────────────────────────────────────────────────
  const { data: existing, error: fetchError } = await (supabase as any)
    .from('databooks').select('id, number').eq('number', databookNumber).maybeSingle();

  if (fetchError) {
    console.error('[inbound-email] Erro ao buscar databook existente:', fetchError);
    await logImport({
      from_address: fromAddress, from_name: fromName, to_address: toAddress,
      subject, raw_body: searchText, raw_html: emailHtml,
      extracted_fields: extractedFieldsForLog, status: 'error', queue_status: 'error',
      error_message: `Erro ao consultar banco: ${fetchError.message}`,
      databook_number: databookNumber, databook_id: null,
    });
    return NextResponse.json({ received: true, action: 'error', reason: 'db_query_failed' });
  }

  if (existing) {
    const msg = `Databook ${databookNumber} já existe no sistema`;
    console.info(`[inbound-email] Duplicata detectada: ${msg}`);
    await logImport({
      from_address: fromAddress, from_name: fromName, to_address: toAddress,
      subject, raw_body: searchText, raw_html: emailHtml,
      extracted_fields: extractedFieldsForLog, status: 'duplicate', queue_status: 'duplicate',
      error_message: msg, databook_number: databookNumber, databook_id: existing.id,
    });
    return NextResponse.json({ received: true, action: 'duplicate', databook_number: databookNumber, databook_id: existing.id });
  }

  // ── Gravar na fila de aprovação (pending) ──────────────────────────────────
  //
  // O databook NÃO é criado aqui. O operador deve revisar em "Log de Emails"
  // e clicar em "Adicionar ao Sistema" para criar o databook.
  await logImport({
    from_address: fromAddress, from_name: fromName, to_address: toAddress,
    subject, raw_body: searchText, raw_html: emailHtml,
    extracted_fields: extractedFieldsForLog,
    status: 'success',       // legado: email válido recebido
    queue_status: 'pending', // novo: aguarda aprovação do operador
    error_message: null, databook_number: databookNumber, databook_id: null,
  });

  console.log(
    `[inbound-email] Email enfileirado (pending): DB ${databookNumber}` +
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

// ── Handler principal ─────────────────────────────────────────────────────────

/**
 * POST /api/inbound-email
 *
 * Detecta automaticamente o modo de operação pelo header recebido:
 *
 * MODO A — Webhook real da Resend (produção):
 *   Identifica pela presença de `svix-id` no header.
 *   Autentica via assinatura criptográfica Svix usando RESEND_WEBHOOK_SECRET.
 *   Payload: { type: "email.received", data: { email_id, from, to[], subject, attachments[] } }
 *   Corpo completo (text/html) buscado via resend.emails.receiving.get(email_id).
 *
 * MODO B — Teste manual (PowerShell/curl):
 *   Identifica pela presença de `Authorization: Bearer` no header.
 *   Autentica via INBOUND_EMAIL_SECRET.
 *   Payload flat: { from, to, subject, text, html }
 *
 * Em ambos os casos, o fluxo final é idêntico:
 *   → validação whitelist → extração de número → log com queue_status=pending
 *   O databook NÃO é criado automaticamente.
 */
export async function POST(request: Request) {
  const svixId = request.headers.get('svix-id');
  const authHeader = request.headers.get('authorization') ?? '';

  // ── MODO A: Webhook real da Resend ─────────────────────────────────────────
  if (svixId) {
    return handleResendWebhook(request);
  }

  // ── MODO B: Teste manual ───────────────────────────────────────────────────
  if (authHeader) {
    return handleManualTest(request, authHeader);
  }

  // Nenhum dos modos reconhecidos
  console.warn('[inbound-email] Requisição sem svix-id nem Authorization — rejeitada');
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

// ── MODO A: Webhook real da Resend ────────────────────────────────────────────

async function handleResendWebhook(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;

  if (!webhookSecret) {
    console.error('[inbound-email] RESEND_WEBHOOK_SECRET não configurado');
    // Retorna 200 para evitar reenvio pela Resend enquanto variável não está configurada
    return NextResponse.json({ received: true, action: 'error', reason: 'webhook_secret_missing' });
  }

  // ── Leitura do body raw (obrigatório para verificação da assinatura) ────────
  const rawBody = await request.text();

  // ── Verificação da assinatura Svix ─────────────────────────────────────────
  let payload: any;
  try {
    const resend = new Resend(apiKey ?? 'placeholder');
    payload = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id:        request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret,
    });
  } catch (err) {
    console.warn('[inbound-email] Assinatura Svix inválida:', err);
    // 400 é o correto aqui — assinatura inválida = requisição maliciosa
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 });
  }

  // ── Verificar tipo do evento ────────────────────────────────────────────────
  if (payload?.type !== 'email.received') {
    // Outros tipos de evento da Resend (email.sent, email.bounced, etc.) — ignorar
    console.info(`[inbound-email] Evento ignorado: ${payload?.type}`);
    return NextResponse.json({ received: true, action: 'ignored', type: payload?.type });
  }

  const data = payload?.data ?? {};
  const emailId: string = data?.email_id ?? '';

  if (!emailId) {
    console.error('[inbound-email] email_id ausente no payload Resend');
    return NextResponse.json({ received: true, action: 'error', reason: 'email_id_missing' });
  }

  // ── Parse de metadados do payload ──────────────────────────────────────────
  const rawFrom: string = data?.from ?? '';
  const { fromAddress, fromName } = parseFrom(rawFrom);

  const toRaw = data?.to;
  const toAddress: string | null = Array.isArray(toRaw)
    ? (toRaw[0] ?? null)
    : (typeof toRaw === 'string' ? toRaw : null);

  const subject: string = data?.subject ?? '';

  // ── Buscar corpo completo via API Resend ────────────────────────────────────
  let emailText = '';
  let emailHtml: string | null = null;

  if (!apiKey) {
    console.warn('[inbound-email] RESEND_API_KEY não configurado — corpo do email não recuperado');
  } else {
    try {
      const resend = new Resend(apiKey);
      const { data: emailData, error: emailError } = await resend.emails.receiving.get(emailId);
      if (emailError) {
        console.error('[inbound-email] Erro ao buscar corpo do email:', emailError);
      } else if (emailData) {
        emailText = extractText(
          (emailData as any).text ?? null,
          (emailData as any).html ?? null,
        );
        emailHtml = typeof (emailData as any).html === 'string' ? (emailData as any).html : null;
      }
    } catch (err) {
      console.error('[inbound-email] Exceção ao buscar corpo do email:', err);
    }
  }

  console.log(
    `[inbound-email] Webhook real recebido: from=${fromAddress} | subject=${subject} | email_id=${emailId}`
  );

  return processEmail(fromAddress, fromName, toAddress, subject, emailText, emailHtml);
}

// ── MODO B: Teste manual (PowerShell/curl) ────────────────────────────────────

async function handleManualTest(request: Request, authHeader: string): Promise<NextResponse> {
  const secret = process.env.INBOUND_EMAIL_SECRET;

  if (!secret) {
    console.error('[inbound-email] INBOUND_EMAIL_SECRET não configurado');
    return NextResponse.json({ error: 'Configuração ausente no servidor' }, { status: 500 });
  }

  const providedToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (providedToken !== secret) {
    console.warn('[inbound-email] Token manual inválido');
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
  }

  // Suporta tanto payload flat quanto envelope Resend (para testes mais realistas)
  const data = payload?.type === 'email.received' ? (payload?.data ?? {}) : payload;

  const rawFrom: string = data?.from ?? '';
  const { fromAddress, fromName } = parseFrom(rawFrom);

  const toRaw = data?.to;
  const toAddress: string | null = Array.isArray(toRaw)
    ? (toRaw[0] ?? null)
    : (typeof toRaw === 'string' ? toRaw : null);

  const subject: string = data?.subject ?? '';
  const emailText = extractTextFromPayload(data);
  const emailHtml: string | null =
    typeof data?.html === 'string' && data.html.trim() ? data.html : null;

  console.log(`[inbound-email] Teste manual: from=${fromAddress} | subject=${subject}`);

  return processEmail(fromAddress, fromName, toAddress, subject, emailText, emailHtml);
}
