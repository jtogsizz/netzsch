/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/reports — dados agregados para gráficos do dashboard e página de relatórios
export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fiscal_year = searchParams.get('fiscal_year') ?? '';

  // Total por status
  const { data: byStatus } = await supabase
    .from('databooks')
    .select('general_status')
    .then(({ data }) => ({
      data: data
        ? Object.entries(
            data.reduce((acc: Record<string, number>, row: any) => {
              acc[row.general_status] = (acc[row.general_status] ?? 0) + 1;
              return acc;
            }, {})
          ).map(([status, count]) => ({ status, count }))
        : [],
    }));

  // Total por FY
  const { data: rawFY } = await supabase
    .from('databooks')
    .select('fiscal_year')
    .not('fiscal_year', 'is', null);

  const byFY = rawFY
    ? Object.entries(
        rawFY.reduce((acc: Record<string, number>, row: any) => {
          const fy = row.fiscal_year ?? 'Não informado';
          acc[fy] = (acc[fy] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([fiscal_year, count]) => ({ fiscal_year, count }))
    : [];

  // Total por responsável
  const { data: rawResp } = await supabase
    .from('databooks')
    .select('responsible_name')
    .not('responsible_name', 'is', null);

  const byResponsible = rawResp
    ? Object.entries(
        rawResp.reduce((acc: Record<string, number>, row: any) => {
          const name = row.responsible_name ?? 'Não informado';
          acc[name] = (acc[name] ?? 0) + 1;
          return acc;
        }, {})
      )
        .map(([responsible_name, count]) => ({ responsible_name, count }))
        .sort((a: any, b: any) => b.count - a.count)
    : [];

  // Total por mês (ano corrente, ou filtrado por FY)
  let byMonthQuery = supabase
    .from('databooks')
    .select('entry_date')
    .not('entry_date', 'is', null);

  if (fiscal_year) {
    byMonthQuery = byMonthQuery.eq('fiscal_year', fiscal_year);
  }

  const { data: rawMonth } = await byMonthQuery;

  const byMonth = rawMonth
    ? Object.entries(
        rawMonth.reduce((acc: Record<string, number>, row: any) => {
          if (!row.entry_date) return acc;
          const d = new Date(row.entry_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {})
      )
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
    : [];

  // Total por prioridade
  const { data: rawPriority } = await supabase.from('databooks').select('priority');
  const byPriority = rawPriority
    ? Object.entries(
        rawPriority.reduce((acc: Record<string, number>, row: any) => {
          acc[row.priority] = (acc[row.priority] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([priority, count]) => ({ priority, count }))
    : [];

  // Total por UF/status técnico
  const { data: rawTechnical } = await supabase
    .from('databooks')
    .select('technical_status')
    .not('technical_status', 'is', null);

  const byTechnicalStatus = rawTechnical
    ? Object.entries(
        rawTechnical.reduce((acc: Record<string, number>, row: any) => {
          const ts = row.technical_status ?? 'Não informado';
          acc[ts] = (acc[ts] ?? 0) + 1;
          return acc;
        }, {})
      )
        .map(([technical_status, count]) => ({ technical_status, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 15) // top 15 para o gráfico não ficar poluído
    : [];

  // Cards do dashboard
  const now = new Date();
  const firstDayMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const firstDayNextMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

  const [
    { count: total },
    { count: totalMes },
    { count: prioAlta },
  ] = await Promise.all([
    supabase.from('databooks').select('id', { count: 'exact', head: true }),
    supabase.from('databooks').select('id', { count: 'exact', head: true })
      .gte('entry_date', firstDayMonth).lt('entry_date', firstDayNextMonth),
    supabase.from('databooks').select('id', { count: 'exact', head: true })
      .eq('priority', 'Alta'),
  ]);

  return NextResponse.json({
    cards: {
      total: total ?? 0,
      total_mes: totalMes ?? 0,
      prioridade_alta: prioAlta ?? 0,
    },
    byStatus,
    byFY,
    byResponsible,
    byMonth,
    byPriority,
    byTechnicalStatus,
  });
}
