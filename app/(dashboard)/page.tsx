import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { DatabookWorkspace } from '@/components/databooks/DatabookWorkspace';
import type { Databook, Employee, AuditLog } from '@/types';

export const metadata: Metadata = { title: 'Databooks' };

interface SearchParams {
  search?: string;
  general_status?: string;
  priority?: string;
  fiscal_year?: string;
  responsible_name?: string;
  month?: string;
  year?: string;
  sort_by?: string;
  sort_direction?: string;
  page?: string;
  view?: string;
  edit?: string;
  new?: string;
  [key: string]: string | undefined;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    search, general_status, priority, fiscal_year,
    responsible_name, month, year,
    sort_by = 'entry_date', sort_direction = 'desc',
    page = '1',
    view,
    edit,
  } = params;

  const PAGE_SIZE = 30;

  // 1. Fetching Databooks List with filters and pagination
  let query = supabase.from('databooks').select('*', { count: 'exact' });

  if (search) {
    query = query.or(
      `number.ilike.%${search}%,client_name.ilike.%${search}%,company_name.ilike.%${search}%,responsible_name.ilike.%${search}%`
    );
  }
  if (general_status) query = query.eq('general_status', general_status);
  if (priority) query = query.eq('priority', priority);
  if (fiscal_year) query = query.eq('fiscal_year', fiscal_year);
  if (responsible_name) query = query.ilike('responsible_name', `%${responsible_name}%`);

  if (year && month) {
    const nextMonth = parseInt(month) === 12
      ? `${parseInt(year) + 1}-01-01`
      : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
    query = query.gte('entry_date', `${year}-${month}-01`).lt('entry_date', nextMonth);
  } else if (year) {
    query = query.gte('entry_date', `${year}-01-01`).lt('entry_date', `${parseInt(year) + 1}-01-01`);
  }

  const allowedFields = ['number', 'entry_date', 'client_name', 'responsible_name', 'general_status', 'priority', 'fiscal_year', 'delivery_date'];
  const safeSort = allowedFields.includes(sort_by) ? sort_by : 'entry_date';
  query = query.order(safeSort, { ascending: sort_direction === 'asc' });

  const pageNum = Math.max(1, parseInt(page));
  const from = (pageNum - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  // 2. Fetching KPIs and active employees in parallel
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const firstDayMonth = `${currentYear}-${currentMonthStr}-01`;
  const firstDayNextMonth = now.getMonth() === 11
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

  const [
    databooksResult,
    { count: total },
    { count: novo },
    { count: emAndamento },
    { count: encerrado },
    { count: totalMes },
    { data: employees },
  ] = await Promise.all([
    query,
    supabase.from('databooks').select('id', { count: 'exact', head: true }),
    supabase.from('databooks').select('id', { count: 'exact', head: true }).eq('general_status', 'Novo'),
    supabase.from('databooks').select('id', { count: 'exact', head: true }).eq('general_status', 'Em andamento'),
    supabase.from('databooks').select('id', { count: 'exact', head: true }).eq('general_status', 'Encerrado'),
    supabase.from('databooks').select('id', { count: 'exact', head: true })
      .gte('entry_date', firstDayMonth).lt('entry_date', firstDayNextMonth),
    supabase.from('employees').select('name').eq('active', true).order('name'),
  ]);

  // 3. Fetching Detail/Edit Databook and Audit Logs if ID is provided
  let selectedDatabook: Databook | null = null;
  let selectedAuditLogs: AuditLog[] = [];
  const targetId = view || edit;

  if (targetId) {
    const [{ data: db }, { data: logs }] = await Promise.all([
      supabase.from('databooks').select('*').eq('id', targetId).maybeSingle(),
      supabase.from('audit_logs').select('*').eq('databook_id', targetId).order('created_at', { ascending: false }),
    ]);
    if (db) {
      selectedDatabook = db as Databook;
      selectedAuditLogs = (logs ?? []) as AuditLog[];
    }
  }

  const { data: databooks = [], count: filteredTotal = 0 } = databooksResult;

  return (
    <DatabookWorkspace
      databooks={(databooks ?? []) as Databook[]}
      totalCount={filteredTotal ?? 0}
      page={pageNum}
      pageSize={PAGE_SIZE}
      kpis={{
        total: total ?? 0,
        novo: novo ?? 0,
        emAndamento: emAndamento ?? 0,
        encerrado: encerrado ?? 0,
        totalMes: totalMes ?? 0,
        monthLabel: now.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase()),
      }}
      employees={(employees ?? []) as Employee[]}
      selectedDatabook={selectedDatabook}
      selectedAuditLogs={selectedAuditLogs}
      searchParams={params}
    />
  );
}
