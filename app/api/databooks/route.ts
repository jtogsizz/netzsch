import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { DatabookInsert } from '@/types';

// GET /api/databooks — lista com filtros e paginação
export async function GET(request: Request) {
  const supabase = await createClient();

  // Verifica autenticação no servidor
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const general_status = searchParams.get('general_status') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const fiscal_year = searchParams.get('fiscal_year') ?? '';
  const responsible_name = searchParams.get('responsible_name') ?? '';
  const client_name = searchParams.get('client_name') ?? '';
  const month = searchParams.get('month') ?? '';
  const year = searchParams.get('year') ?? '';
  const sort_by = searchParams.get('sort_by') ?? 'entry_date';
  const sort_dir = searchParams.get('sort_direction') ?? 'desc';
  const page = parseInt(searchParams.get('page') ?? '1');
  const page_size = parseInt(searchParams.get('page_size') ?? '25');

  let query = supabase
    .from('databooks')
    .select('*', { count: 'exact' });

  if (search) {
    query = query.or(
      `number.ilike.%${search}%,client_name.ilike.%${search}%,company_name.ilike.%${search}%,responsible_name.ilike.%${search}%`
    );
  }
  if (general_status) query = query.eq('general_status', general_status);
  if (priority) query = query.eq('priority', priority);
  if (fiscal_year) query = query.eq('fiscal_year', fiscal_year);
  if (responsible_name) query = query.ilike('responsible_name', `%${responsible_name}%`);
  if (client_name) query = query.ilike('client_name', `%${client_name}%`);

  // Filtro por mês/ano sobre entry_date
  if (year && month) {
    const dateFrom = `${year}-${month}-01`;
    const nextMonth = parseInt(month) === 12
      ? `${parseInt(year) + 1}-01-01`
      : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
    query = query.gte('entry_date', dateFrom).lt('entry_date', nextMonth);
  } else if (year) {
    query = query.gte('entry_date', `${year}-01-01`).lt('entry_date', `${parseInt(year) + 1}-01-01`);
  }

  // Ordenação e paginação
  const allowedSortFields = ['number', 'entry_date', 'client_name', 'responsible_name', 'general_status', 'priority', 'fiscal_year', 'delivery_date'];
  const safeSortField = allowedSortFields.includes(sort_by) ? sort_by : 'entry_date';
  const safeDirection = sort_dir === 'asc';

  query = query.order(safeSortField, { ascending: safeDirection });

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page, page_size });
}

// POST /api/databooks — cria novo databook com audit log
export async function POST(request: Request) {
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: DatabookInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // Valida campos obrigatórios
  if (!body.number?.trim()) {
    return NextResponse.json({ error: 'Número do databook é obrigatório' }, { status: 400 });
  }

  // Verifica duplicidade do número
  const { data: existing } = await supabase
    .from('databooks')
    .select('id')
    .eq('number', body.number.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `Já existe um databook com o número "${body.number}"` }, { status: 409 });
  }

  // DIAGNÓSTICO DE INSERÇÃO
  console.log('=== DIAGNÓSTICO DE CRIAÇÃO DE DATABOOK ===');
  console.log('Usuário autenticado:', !!user);
  console.log('E-mail do usuário:', user?.email);
  console.log('Erro de getUser():', authError);
  console.log('Classe do cliente Supabase:', supabase.constructor.name);
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configurada' : 'Ausente');
  console.log('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? 'Configurada' : 'Ausente');
  console.log('==========================================');

  const { data, error } = await supabase
    .from('databooks')
    .insert({ ...body, number: body.number.trim() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Registra audit log via admin client (bypassa RLS restritiva de audit_logs)
  await adminClient.from('audit_logs').insert({
    databook_id: data.id,
    action: 'created',
    field_name: null,
    old_value: null,
    new_value: data.number,
    changed_by: user.email ?? user.id,
  });

  return NextResponse.json({ data }, { status: 201 });
}
