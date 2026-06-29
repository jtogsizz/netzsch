import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/email-logs — lista logs de email inbound com filtro e paginação
export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  // Filtro por queue_status (novo campo principal)
  const queueStatus = searchParams.get('queue_status') ?? '';
  // Filtro legado por status (mantido para compatibilidade)
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const page_size = Math.min(100, Math.max(10, parseInt(searchParams.get('page_size') ?? '25')));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('email_import_logs')
    .select('*', { count: 'exact' })
    .order('received_at', { ascending: false });

  // Filtro por queue_status tem prioridade sobre status legado
  if (queueStatus) {
    const allowed = ['pending', 'approved', 'duplicate', 'blocked', 'error'];
    if (allowed.includes(queueStatus)) {
      query = query.eq('queue_status', queueStatus);
    }
  } else if (status) {
    // Compatibilidade: filtro pelo status legado
    const allowed = ['success', 'duplicate', 'blocked', 'error'];
    if (allowed.includes(status)) {
      query = query.eq('status', status);
    }
  }

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page, page_size });
}
