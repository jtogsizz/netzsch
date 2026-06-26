import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import type { Databook } from '@/types';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2].slice(0, 2);
        return `${day}/${month}/${year}`;
      }
    }
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

// GET /api/export — gera planilha Excel com todos os databooks filtrados
export async function GET(request: Request) {
  const supabase = await createClient();

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
  const format = searchParams.get('format') ?? 'xlsx'; // xlsx | csv

  let query = supabase.from('databooks').select('*');

  // Aplicar filtros exatamente iguais à listagem da tela principal
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

  // Ordenar decrescente por data de entrada por padrão para a exportação
  query = query.order('entry_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    'Número',
    'Entrada',
    'Cliente',
    'UF/Técnico',
    'Empresa/Usina',
    'Responsável',
    'Status',
    'Prazo',
    'Prioridade',
    'Tipo',
    'FY',
    'Observações',
    'Criado em',
    'Atualizado em'
  ];

  const rows = (data as Databook[] || []).map((db) => ({
    'Número': db.number,
    'Entrada': formatDate(db.entry_date),
    'Cliente': db.client_name ?? '',
    'UF/Técnico': db.technical_status ?? '',
    'Empresa/Usina': db.company_name ?? '',
    'Responsável': db.responsible_name ?? '',
    'Status': db.general_status,
    'Prazo': formatDate(db.delivery_date),
    'Prioridade': db.priority,
    'Tipo': db.type ?? '',
    'FY': db.fiscal_year ?? '',
    'Observações': db.notes ?? '',
    'Criado em': formatDateTime(db.created_at),
    'Atualizado em': formatDateTime(db.updated_at),
  }));

  const now = new Date();
  const formattedDate = now.toISOString().split('T')[0]; // AAAA-MM-DD
  const year2Digits = String(now.getFullYear()).slice(-2);
  const baseFilename = `databooks-netzsch-FY${year2Digits}-${formattedDate}`;

  if (format === 'csv') {
    // Exportação CSV
    const csvHeaders = headers.join(';');
    const csvRows = rows.map((row: Record<string, string>) =>
      headers
        .map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = [csvHeaders, ...csvRows].join('\n');
    const bom = '\uFEFF'; // BOM para UTF-8 (para o Excel ler caracteres especiais em português)

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseFilename}.csv"`,
      },
    });
  }

  // Exportação Excel (.xlsx)
  const wb = XLSX.utils.book_new();
  
  // Se a lista estiver vazia, cria a planilha apenas com a linha de cabeçalhos
  const ws = rows.length === 0 
    ? XLSX.utils.aoa_to_sheet([headers]) 
    : XLSX.utils.json_to_sheet(rows, { header: headers });

  // Configuração das larguras das colunas no Excel
  ws['!cols'] = [
    { wch: 15 }, // Número
    { wch: 12 }, // Entrada
    { wch: 25 }, // Cliente
    { wch: 16 }, // UF/Técnico
    { wch: 25 }, // Empresa/Usina
    { wch: 20 }, // Responsável
    { wch: 14 }, // Status
    { wch: 12 }, // Prazo
    { wch: 12 }, // Prioridade
    { wch: 12 }, // Tipo
    { wch: 8 },  // FY
    { wch: 40 }, // Observações
    { wch: 18 }, // Criado em
    { wch: 18 }, // Atualizado em
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Databooks');

  // Escrever o workbook no buffer formatado para xlsx
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${baseFilename}.xlsx"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
