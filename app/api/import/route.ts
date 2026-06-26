/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import type { Databook } from '@/types';

// Desativar limites padrão de body parser no Next.js se necessário (Next.js 15+ lida nativamente)
export const maxDuration = 60; // 60 segundos de timeout para planilhas grandes

function parseExcelDate(value: any): string | null {
  if (value === undefined || value === null || value === '') return null;

  // Número de série de data do Excel (dias desde 30/12/1899)
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }

  const strVal = String(value).trim();
  if (!strVal) return null;

  // Formato DD/MM/AAAA ou DD/MM/AA
  if (strVal.includes('/')) {
    const parts = strVal.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }

  // Formato AAAA-MM-DD
  if (strVal.includes('-')) {
    const parts = strVal.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].slice(0, 2).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  try {
    const parsed = new Date(strVal);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}

  return null;
}

function getRowValue(row: any, keys: string[]): any {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const normalizedKeys = keys.map(normalize);

  for (const rowKey of Object.keys(row)) {
    if (normalizedKeys.includes(normalize(rowKey))) {
      return row[rowKey];
    }
  }
  return null;
}

// POST /api/import — lida com pre-visualização (?action=preview) e gravação (?action=confirm)
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'preview';

  // ---- AÇÃO: PREVIEW ----
  if (action === 'preview') {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      const sheetName = workbook.SheetNames.includes('Databooks')
        ? 'Databooks'
        : workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

      const parsedRows: any[] = [];
      let totalRows = 0;
      let toCreate = 0;
      let toUpdate = 0;
      let errorsCount = 0;

      // Coleta todos os números de solicitação da planilha para testar duplicados em lote
      const numbersInExcel = rawData
        .map((row: any) =>
          String(
            getRowValue(row, ['solicitacao', 'numero', 'codigo', 'id', 'databook', 'databook_number']) || ''
          ).trim()
        )
        .filter(Boolean);

      const existingNumbers = new Set<string>();
      if (numbersInExcel.length > 0) {
        // Obter do banco em lote de 500 em 500 para evitar limites do Supabase
        const batchSize = 500;
        for (let i = 0; i < numbersInExcel.length; i += batchSize) {
          const batch = numbersInExcel.slice(i, i + batchSize);
          const { data: existingDbs } = await supabase
            .from('databooks')
            .select('number')
            .in('number', batch);

          if (existingDbs) {
            existingDbs.forEach((item: any) => existingNumbers.add(item.number));
          }
        }
      }

      for (const row of rawData) {
        // Ignorar linhas vazias
        const isEmpty = Object.values(row).every(
          (v) => v === undefined || v === null || String(v).trim() === ''
        );
        if (isEmpty) continue;

        totalRows++;

        const rawNumber = getRowValue(row, ['solicitacao', 'numero', 'codigo', 'id', 'databook', 'databook_number']);
        const num = String(rawNumber || '').trim();

        if (!num) {
          errorsCount++;
          parsedRows.push({
            _status: 'error',
            _message: 'Número de solicitação/databook ausente',
            rowOriginal: row,
          });
          continue;
        }

        const entry_date = parseExcelDate(
          getRowValue(row, ['abertura', 'data abertura', 'data_abertura', 'entrada', 'data de entrada'])
        );
        const client_name = String(getRowValue(row, ['cliente', 'client', 'nome cliente']) || '').trim();
        const technical_status = String(getRowValue(row, ['filial', 'uf', 'status tecnico', 'uf tecnico']) || '').trim();
        const company_name = String(getRowValue(row, ['vendedor', 'vendedora', 'empresa', 'usina']) || '').trim();
        const responsible_name = String(getRowValue(row, ['responsavel', 'responsible', 'nome responsavel']) || '').trim();

        // Normalização do status
        const rawStatus = String(getRowValue(row, ['status', 'situacao', 'general_status']) || '')
          .trim()
          .toUpperCase();
        let general_status = 'Novo';
        if (rawStatus.includes('ENCERRADO')) {
          general_status = 'Encerrado';
        } else if (rawStatus.includes('ANDAMENTO') || rawStatus.includes('PROCESSO')) {
          general_status = 'Em andamento';
        }

        const delivery_date = parseExcelDate(
          getRowValue(row, [
            'prev. de conclusão',
            'prev de conclusao',
            'previsao',
            'entrega',
            'previsao entrega',
            'prev. conclusao',
            'prevdeconclusao',
          ])
        );

        // Normalização da prioridade
        const rawPriority = String(getRowValue(row, ['prioridade', 'priority']) || '')
          .trim()
          .toUpperCase();
        let priority = 'Normal';
        if (rawPriority.includes('ALTA')) {
          priority = 'Alta';
        } else if (rawPriority.includes('BAIXA')) {
          priority = 'Baixa';
        }

        const notes = String(getRowValue(row, ['obs', 'observacao', 'observacoes', 'nota', 'notes']) || '').trim();
        const type = String(getRowValue(row, ['databook', 'tipo', 'type']) || '').trim();

        // Mapeamento e fallback para FY
        const rawFy = String(getRowValue(row, ['fy', 'ano fiscal', 'fiscal year', 'ano_fiscal']) || '').trim();
        const fiscal_year = rawFy || 'FY26';

        const isUpdate = existingNumbers.has(num);
        if (isUpdate) {
          toUpdate++;
        } else {
          toCreate++;
        }

        parsedRows.push({
          _status: 'ok',
          isUpdate,
          number: num,
          entry_date,
          client_name: client_name || null,
          technical_status: technical_status || null,
          company_name: company_name || null,
          responsible_name: responsible_name || null,
          general_status,
          delivery_date,
          priority,
          type: type || null,
          fiscal_year,
          notes: notes || null,
        });
      }

      return NextResponse.json({
        totalRows,
        toCreate,
        toUpdate,
        errorsCount,
        previewData: parsedRows.slice(0, 10), // As primeiras 10 para exibir na tabela do frontend
        validRows: parsedRows.filter((r) => r._status === 'ok'),
      });
    } catch (err: any) {
      console.error('Erro ao analisar planilha:', err);
      return NextResponse.json({ error: err.message || 'Erro ao processar o arquivo Excel.' }, { status: 500 });
    }
  }

  // ---- AÇÃO: CONFIRM ----
  if (action === 'confirm') {
    try {
      const body = await request.json();
      const rowsToImport = body.rows as any[];

      if (!rowsToImport || !Array.isArray(rowsToImport)) {
        return NextResponse.json({ error: 'Lista de registros inválida' }, { status: 400 });
      }

      const adminClient = await createAdminClient();
      const numbersToSearch = rowsToImport.map((r) => r.number);

      const existingMap = new Map<string, Databook>();
      const batchSize = 500;
      for (let i = 0; i < numbersToSearch.length; i += batchSize) {
        const batch = numbersToSearch.slice(i, i + batchSize);
        const { data: existingDbs } = await supabase
          .from('databooks')
          .select('*')
          .in('number', batch);

        if (existingDbs) {
          existingDbs.forEach((db: any) => existingMap.set(db.number, db));
        }
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const row of rowsToImport) {
        const existing = existingMap.get(row.number);

        const dbData = {
          number: row.number,
          entry_date: row.entry_date,
          client_name: row.client_name,
          technical_status: row.technical_status,
          company_name: row.company_name,
          responsible_name: row.responsible_name,
          general_status: row.general_status,
          delivery_date: row.delivery_date,
          priority: row.priority,
          type: row.type,
          fiscal_year: row.fiscal_year,
          notes: row.notes,
        };

        if (existing) {
          // Atualização
          const { data: updated, error } = await supabase
            .from('databooks')
            .update(dbData)
            .eq('id', existing.id)
            .select()
            .single();

          if (error) {
            console.error(`Erro ao atualizar databook ${row.number}:`, error);
            continue;
          }

          updatedCount++;

          // Auditoria campo por campo
          const auditLogs: any[] = [];
          const fieldsToCheck = [
            'entry_date',
            'client_name',
            'technical_status',
            'company_name',
            'responsible_name',
            'general_status',
            'delivery_date',
            'priority',
            'type',
            'fiscal_year',
            'notes',
          ];

          for (const field of fieldsToCheck) {
            const oldValue = String(existing[field as keyof Databook] ?? '');
            const newValue = String(updated[field as keyof Databook] ?? '');
            if (oldValue !== newValue) {
              auditLogs.push({
                databook_id: existing.id,
                action: 'updated',
                field_name: field,
                old_value: oldValue || null,
                new_value: newValue || null,
                changed_by: user.email ?? user.id,
              });
            }
          }

          if (auditLogs.length > 0) {
            // Salvar logs de alteração
            await adminClient.from('audit_logs').insert(auditLogs);
          }
        } else {
          // Criação
          const { data: created, error } = await supabase
            .from('databooks')
            .insert(dbData)
            .select()
            .single();

          if (error) {
            console.error(`Erro ao criar databook ${row.number}:`, error);
            continue;
          }

          createdCount++;

          // Auditoria de criação
          await adminClient.from('audit_logs').insert({
            databook_id: created.id,
            action: 'created',
            field_name: null,
            old_value: null,
            new_value: created.number,
            changed_by: user.email ?? user.id,
          });
        }
      }

      return NextResponse.json({
        success: true,
        createdCount,
        updatedCount,
      });
    } catch (err: any) {
      console.error('Erro na confirmação da importação:', err);
      return NextResponse.json({ error: err.message || 'Erro ao gravar os registros no banco.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Ação não permitida' }, { status: 405 });
}
