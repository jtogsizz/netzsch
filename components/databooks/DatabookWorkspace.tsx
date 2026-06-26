/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Databook, Employee, AuditLog, GeneralStatus } from '@/types';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { DatabookForm } from '@/components/databooks/DatabookForm';
import { DatabookDetailClient } from '@/components/databooks/DatabookDetailClient';
import { formatDate, truncate } from '@/lib/utils';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  FISCAL_YEAR_OPTIONS,
  MONTH_OPTIONS,
} from '@/lib/constants';
import {
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Plus,
  Download,
  Filter,
  Upload,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface DatabookWorkspaceProps {
  databooks: Databook[];
  totalCount: number;
  page: number;
  pageSize: number;
  kpis: {
    total: number;
    novo: number;
    emAndamento: number;
    encerrado: number;
    totalMes: number;
    monthLabel: string;
  };
  employees: Employee[];
  selectedDatabook: Databook | null;
  selectedAuditLogs: AuditLog[];
  searchParams: Record<string, string | undefined>;
}

export function DatabookWorkspace({
  databooks,
  totalCount,
  page,
  pageSize,
  kpis,
  employees,
  selectedDatabook,
  selectedAuditLogs,
  searchParams,
}: DatabookWorkspaceProps) {
  const router = useRouter();
  
  // Safe export query string constructor (SSR compatible)
  const exportParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      exportParams.set(k, v);
    }
  });
  exportParams.set('format', 'xlsx');
  
  // Local state for filters
  const [searchVal, setSearchVal] = useState(searchParams.search ?? '');
  const [statusVal, setStatusVal] = useState(searchParams.general_status ?? '');
  const [priorityVal, setPriorityVal] = useState(searchParams.priority ?? '');
  const [fyVal, setFyVal] = useState(searchParams.fiscal_year ?? '');
  const [respVal, setRespVal] = useState(searchParams.responsible_name ?? '');
  const [monthVal, setMonthVal] = useState(searchParams.month ?? '');
  const [yearVal, setYearVal] = useState(searchParams.year ?? '');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Databook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

interface ImportRow {
  _status: 'ok' | 'error';
  _message?: string;
  isUpdate?: boolean;
  number?: string;
  entry_date?: string | null;
  client_name?: string | null;
  technical_status?: string | null;
  company_name?: string | null;
  responsible_name?: string | null;
  general_status?: 'Novo' | 'Em andamento' | 'Encerrado';
  delivery_date?: string | null;
  priority?: 'Alta' | 'Normal' | 'Baixa';
  type?: string | null;
  fiscal_year?: string;
  notes?: string | null;
  rowOriginal?: Record<string, string | number | boolean | null | undefined>;
}

interface ImportPreviewData {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  errorsCount: number;
  previewData: ImportRow[];
  validRows: ImportRow[];
}

  // Excel Import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importingStatus, setImportingStatus] = useState<'idle' | 'analyzing' | 'confirming' | 'success' | 'error'>('idle');
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ createdCount: number; updatedCount: number } | null>(null);

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportResult(null);
    setImportPreview(null);
    setImportingStatus('analyzing');
    setImportModalOpen(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import?action=preview', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao analisar planilha.');
      }

      const data = await res.json();
      setImportPreview(data);
      setImportingStatus('idle');
    } catch (err: unknown) {
      console.error('Erro na análise da planilha:', err);
      const message = err instanceof Error ? err.message : 'Erro inesperado ao ler a planilha.';
      setImportError(message);
      setImportingStatus('error');
    } finally {
      e.target.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview || importPreview.validRows.length === 0) return;

    setImportingStatus('confirming');
    setImportError(null);

    try {
      const res = await fetch('/api/import?action=confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importPreview.validRows }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao importar os dados.');
      }

      const data = await res.json();
      setImportResult(data);
      setImportingStatus('success');
    } catch (err: unknown) {
      console.error('Erro na confirmação da importação:', err);
      const message = err instanceof Error ? err.message : 'Erro ao salvar os registros.';
      setImportError(message);
      setImportingStatus('error');
    }
  };

  const handleImportClose = () => {
    setImportModalOpen(false);
    if (importingStatus === 'success') {
      router.refresh();
    }
    setTimeout(() => {
      setImportingStatus('idle');
      setImportPreview(null);
      setImportError(null);
      setImportResult(null);
    }, 200);
  };

  // Synchronize local search value when URL changes
  useEffect(() => {
    setSearchVal(searchParams.search ?? '');
    setStatusVal(searchParams.general_status ?? '');
    setPriorityVal(searchParams.priority ?? '');
    setFyVal(searchParams.fiscal_year ?? '');
    setRespVal(searchParams.responsible_name ?? '');
    setMonthVal(searchParams.month ?? '');
    setYearVal(searchParams.year ?? '');
  }, [searchParams]);

  // Drawer states are derived directly from the URL parameters
  const isViewOpen = !!searchParams.view && selectedDatabook;
  const isEditOpen = !!searchParams.edit && selectedDatabook;
  const isNewOpen = searchParams.new === 'true';

  const updateUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    // Reset page to 1 on filter change, unless we're just opening/closing drawers
    const justDrawers = Object.keys(updates).every(k => ['view', 'edit', 'new'].includes(k));
    if (!justDrawers) {
      params.set('page', '1');
    }
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({
      search: searchVal,
      general_status: statusVal,
      priority: priorityVal,
      fiscal_year: fyVal,
      responsible_name: respVal,
      month: monthVal,
      year: yearVal,
    });
  };

  const handleClearFilters = () => {
    setSearchVal('');
    setStatusVal('');
    setPriorityVal('');
    setFyVal('');
    setRespVal('');
    setMonthVal('');
    setYearVal('');
    router.push('/');
  };

  const handleStatusChange = async (databook: Databook, newStatus: GeneralStatus) => {
    if (newStatus === databook.general_status) return;
    setStatusChanging(databook.id);

    await fetch(`/api/databooks/${databook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ general_status: newStatus }),
    });

    setStatusChanging(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    await fetch(`/api/databooks/${deleteTarget.id}`, { method: 'DELETE' });

    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  };

  const handleSort = (field: string) => {
    const currentSort = searchParams.sort_by ?? 'entry_date';
    const currentDir = searchParams.sort_direction ?? 'desc';
    let newDir = 'asc';
    if (currentSort === field && currentDir === 'asc') {
      newDir = 'desc';
    }
    updateUrl({ sort_by: field, sort_direction: newDir });
  };

  const SortIcon = ({ field }: { field: string }) => {
    const sortBy = searchParams.sort_by ?? 'entry_date';
    const sortDir = searchParams.sort_direction ?? 'desc';
    if (field !== sortBy) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Years option (current - 5 to current + 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => String(currentYear - 5 + i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
      
      {/* ---- KPIs Line (Excel/Lists indicators style) ---- */}
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '0.75rem', 
          padding: '0.5rem 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Total:</span>
          <strong style={{ fontSize: '0.9375rem', color: '#111816' }}>{kpis.total}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--status-novo-text)' }}>Novos:</span>
          <strong style={{ fontSize: '0.9375rem', color: 'var(--status-novo-text)' }}>{kpis.novo}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--status-andamento-text)' }}>Em Andamento:</span>
          <strong style={{ fontSize: '0.9375rem', color: 'var(--status-andamento-text)' }}>{kpis.emAndamento}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--status-encerrado-text)' }}>Encerrados:</span>
          <strong style={{ fontSize: '0.9375rem', color: 'var(--status-encerrado-text)' }}>{kpis.encerrado}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', marginLeft: 'auto' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{kpis.monthLabel}:</span>
          <strong style={{ fontSize: '0.9375rem' }}>{kpis.totalMes} entradas</strong>
        </div>
      </div>

      {/* ---- Toolbar (Search & Quick Action buttons) ---- */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        {/* Form para busca */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.375rem', flex: 1, maxWidth: 360 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Pesquisar número, cliente, responsável..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.8125rem' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
          <Button type="submit" size="sm" style={{ height: '32px' }}>
            Buscar
          </Button>
        </form>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href={`/api/export?${exportParams.toString()}`}>
            <Button variant="secondary" size="sm" style={{ height: '32px' }}>
              <Download size={14} />
              Exportar Excel
            </Button>
          </a>
          <Button
            variant="secondary"
            size="sm"
            style={{ height: '32px' }}
            onClick={() => document.getElementById('import-excel-input')?.click()}
          >
            <Upload size={14} />
            Importar Excel
          </Button>
          <input
            type="file"
            id="import-excel-input"
            accept=".xlsx,.xls"
            onChange={handleImportFileSelect}
            style={{ display: 'none' }}
          />
          <Button size="sm" onClick={() => updateUrl({ new: 'true' })} style={{ height: '32px' }}>
            <Plus size={14} />
            Novo Databook
          </Button>
        </div>
      </div>

      {/* ---- Filter Bar Row ---- */}
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '0.5rem', 
          padding: '0.5rem', 
          background: '#f1f3f2', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--card-radius)',
          alignItems: 'center',
        }}
      >
        <Filter size={13} style={{ color: 'var(--text-muted)', marginRight: '0.25rem' }} />
        
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 100, height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
          value={statusVal}
          onChange={(e) => { setStatusVal(e.target.value); updateUrl({ general_status: e.target.value }); }}
          aria-label="Filtrar por Status"
        >
          <option value="">Status: Todos</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 110, height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
          value={priorityVal}
          onChange={(e) => { setPriorityVal(e.target.value); updateUrl({ priority: e.target.value }); }}
          aria-label="Filtrar por Prioridade"
        >
          <option value="">Prioridade: Todas</option>
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 90, height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
          value={fyVal}
          onChange={(e) => { setFyVal(e.target.value); updateUrl({ fiscal_year: e.target.value }); }}
          aria-label="Filtrar por FY"
        >
          <option value="">FY: Todos</option>
          {FISCAL_YEAR_OPTIONS.map((fy) => (
            <option key={fy} value={fy}>{fy}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 120, height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
          value={respVal}
          onChange={(e) => { setRespVal(e.target.value); updateUrl({ responsible_name: e.target.value }); }}
          aria-label="Filtrar por Responsável"
        >
          <option value="">Responsável: Todos</option>
          {employees.map((e) => (
            <option key={e.name} value={e.name}>{e.name}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 100, height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
          value={monthVal}
          onChange={(e) => { setMonthVal(e.target.value); updateUrl({ month: e.target.value }); }}
          aria-label="Filtrar por Mês"
        >
          <option value="">Mês: Todos</option>
          {MONTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 90, height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
          value={yearVal}
          onChange={(e) => { setYearVal(e.target.value); updateUrl({ year: e.target.value }); }}
          aria-label="Filtrar por Ano"
        >
          <option value="">Ano: Todos</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {(searchVal || statusVal || priorityVal || fyVal || respVal || monthVal || yearVal) && (
          <button
            onClick={handleClearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-700)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              marginLeft: '0.5rem',
              fontWeight: 600,
            }}
          >
            Limpar filtros
            <X size={12} />
          </button>
        )}
      </div>

      {/* ---- Spreadsheet Table Layout ---- */}
      <div 
        style={{ 
          background: '#fff', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--card-radius)', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}
      >
        <div style={{ overflowX: 'auto', flex: 1 }}>
          {databooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Nenhum databook encontrado com os filtros ativos.
            </div>
          ) : (
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                fontSize: '0.8125rem',
                textAlign: 'left'
              }}
            >
              <thead>
                <tr style={{ background: '#e9ecef', borderBottom: '2px solid var(--border)' }}>
                  {[
                    { key: 'number', label: 'Número', width: 120 },
                    { key: 'entry_date', label: 'Entrada', width: 90 },
                    { key: 'client_name', label: 'Cliente', width: 160 },
                    { key: 'technical_status', label: 'UF/Técnico', width: 100 },
                    { key: 'company_name', label: 'Empresa/Usina', width: 150 },
                    { key: 'responsible_name', label: 'Responsável', width: 130 },
                    { key: 'general_status', label: 'Status', width: 150 },
                    { key: 'delivery_date', label: 'Prazo', width: 90 },
                    { key: 'priority', label: 'Prio.', width: 80 },
                    { key: 'type', label: 'Tipo', width: 80 },
                    { key: 'fiscal_year', label: 'FY', width: 70 },
                  ].map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '0.25rem 0.375rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        borderRight: '1px solid var(--border)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        width: col.width,
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => handleSort(col.key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {col.label}
                        <SortIcon field={col.key} />
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '0.25rem 0.375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {databooks.map((db, idx) => (
                  <tr
                    key={db.id}
                    onClick={() => updateUrl({ view: db.id })}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: idx % 2 === 0 ? '#fff' : '#fafbfa',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfa'; }}
                  >
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--brand-800)' }}>
                      {db.number}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {formatDate(db.entry_date)}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }} title={db.client_name ?? ''}>
                      {truncate(db.client_name, 25)}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }}>
                      {db.technical_status ?? '-'}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }} title={db.company_name ?? ''}>
                      {truncate(db.company_name, 22)}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }}>
                      {db.responsible_name ?? '-'}
                    </td>
                    <td 
                      style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }}
                      onClick={(e) => e.stopPropagation()} // Impede abrir o drawer ao clicar no select de status
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <select
                           value={db.general_status}
                           disabled={statusChanging === db.id}
                           onChange={(e) => handleStatusChange(db, e.target.value as GeneralStatus)}
                           style={{
                             border: 'none',
                             background: 'transparent',
                             cursor: 'pointer',
                             fontSize: '0.8125rem',
                             fontWeight: 600,
                             padding: 0,
                             fontFamily: 'inherit',
                           }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.value}</option>
                          ))}
                        </select>
                        <StatusBadge status={db.general_status} style={{ padding: '1px 4px', fontSize: '0.6875rem' }} />
                      </div>
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {formatDate(db.delivery_date)}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }}>
                      <PriorityBadge priority={db.priority} style={{ padding: '1px 4px', fontSize: '0.6875rem' }} />
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }}>
                      {db.type ?? '-'}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem', borderRight: '1px solid var(--border)' }}>
                      {db.fiscal_year ?? '-'}
                    </td>
                    <td style={{ padding: '0.25rem 0.375rem' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateUrl({ edit: db.id })}
                          title="Editar"
                          style={{ padding: '4px' }}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(db)}
                          title="Excluir"
                          style={{ padding: '4px', color: '#dc3545' }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ---- Pagination Row ---- */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 1rem',
              borderTop: '1px solid var(--border)',
              background: '#f1f3f2',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Página {page} de {totalPages} ({totalCount} registros)
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateUrl({ page: String(page - 1) })}
                style={{ height: '26px', padding: '0 0.5rem', fontSize: '0.75rem' }}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateUrl({ page: String(page + 1) })}
                style={{ height: '26px', padding: '0 0.5rem', fontSize: '0.75rem' }}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---- SIDE DRAWERS (Sliding Lateral Panels) ---- */}
      
      {/* 1. VIEW DETAILS DRAWER */}
      {isViewOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(1px)',
          }}
          onClick={() => updateUrl({ view: null })}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 580,
              background: '#fff',
              height: '100%',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slide-in 0.18s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button Header */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 1rem 0', borderBottom: 'none' }}>
              <button
                onClick={() => updateUrl({ view: null })}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.25rem',
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Scrollable details wrapper */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
              <DatabookDetailClient
                databook={selectedDatabook!}
                auditLogs={selectedAuditLogs}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. EDIT DRAWER */}
      {isEditOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(1px)',
          }}
          onClick={() => updateUrl({ edit: null })}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              background: '#fff',
              height: '100%',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slide-in 0.18s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8e5' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-800)', margin: 0 }}>
                Editar Databook
              </h2>
              <button
                onClick={() => updateUrl({ edit: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <DatabookForm
                mode="edit"
                initialData={selectedDatabook!}
                onSuccess={() => { updateUrl({ edit: null }); router.refresh(); }}
                onCancel={() => updateUrl({ edit: null })}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. CREATE DRAWER */}
      {isNewOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(1px)',
          }}
          onClick={() => updateUrl({ new: null })}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              background: '#fff',
              height: '100%',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slide-in 0.18s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8e5' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-800)', margin: 0 }}>
                Cadastrar Databook
              </h2>
              <button
                onClick={() => updateUrl({ new: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <DatabookForm
                mode="create"
                onSuccess={() => { updateUrl({ new: null }); router.refresh(); }}
                onCancel={() => updateUrl({ new: null })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Databook"
        message={`Tem certeza que deseja excluir o databook "${deleteTarget?.number}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />

      {/* Modal de Importação de Planilha Excel */}
      <Modal
        open={importModalOpen}
        onClose={handleImportClose}
        title="Importar Databooks do Excel"
        maxWidth="960px"
      >
        <div style={{ fontSize: '0.8125rem' }}>
          {importingStatus === 'analyzing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 className="animate-spin" size={32} style={{ color: 'var(--brand-700)', marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Analisando planilha Excel...</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mapeando colunas e checando duplicados...</p>
            </div>
          )}

          {importingStatus === 'confirming' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 className="animate-spin" size={32} style={{ color: 'var(--brand-700)', marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gravando registros no banco de dados...</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Isso pode levar alguns instantes para grandes quantidades de dados.</p>
            </div>
          )}

          {importingStatus === 'success' && importResult && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: '#2f855a', marginBottom: '1rem' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                Importação concluída com sucesso!
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', maxWidth: '400px' }}>
                Os dados foram migrados e os logs de auditoria foram gerados corretamente.
              </p>
              
              <div style={{ display: 'flex', gap: '2rem', background: '#f5faf7', border: '1px solid #c6f6d5', padding: '1rem 2rem', borderRadius: 3, marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2f855a' }}>{importResult.createdCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CRIADOS</div>
                </div>
                <div style={{ borderLeft: '1px solid #c6f6d5' }}></div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3182ce' }}>{importResult.updatedCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ATUALIZADOS</div>
                </div>
              </div>

              <Button onClick={handleImportClose} style={{ borderRadius: 3 }}>
                Concluir
              </Button>
            </div>
          )}

          {importingStatus === 'error' && importError && (
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030', borderRadius: 3, marginBottom: '1.5rem' }}>
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontWeight: 700, margin: '0 0 0.25rem' }}>Erro na importação</h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem' }}>{importError}</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleImportClose} style={{ borderRadius: 3 }}>
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {/* Estado principal: Visualização dos dados antes de confirmar */}
          {importingStatus === 'idle' && importPreview && (
            <div>
              {/* Painel de Indicadores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ border: '1px solid var(--border)', padding: '0.75rem 1rem', borderRadius: 3, background: '#fafafa' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>{importPreview.totalRows}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total de linhas</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderLeft: '3px solid #2f855a', padding: '0.75rem 1rem', borderRadius: 3, background: '#fafafa' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2f855a' }}>{importPreview.toCreate}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Novos registros</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderLeft: '3px solid #3182ce', padding: '0.75rem 1rem', borderRadius: 3, background: '#fafafa' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#3182ce' }}>{importPreview.toUpdate}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>A atualizar (Substituir)</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${importPreview.errorsCount > 0 ? '#e53e3e' : 'var(--border)'}`, padding: '0.75rem 1rem', borderRadius: 3, background: '#fafafa' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: importPreview.errorsCount > 0 ? '#e53e3e' : 'var(--text-muted)' }}>{importPreview.errorsCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Erros ignorados</div>
                </div>
              </div>

              {/* Tabela de pré-visualização (Primeiras 10 linhas) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Amostra dos dados detectados (Primeiras 10 linhas)
                </h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700, width: '100px' }}>Número</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700, width: '80px' }}>Entrada</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700 }}>Cliente</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700 }}>Responsável</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700, width: '100px' }}>Status</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700, width: '80px' }}>Prioridade</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700, width: '80px' }}>FY</th>
                        <th style={{ padding: '0.375rem 0.5rem', fontWeight: 700, width: '90px', textAlign: 'center' }}>Mapeamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.previewData.map((row: ImportRow, idx: number) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: row._status === 'error' ? '#fff5f5' : '#fff'
                          }}
                        >
                          <td style={{ padding: '0.375rem 0.5rem', fontWeight: 600, color: row._status === 'error' ? '#c53030' : 'var(--text-primary)' }}>
                            {row.number || row.rowOriginal?.['SOLICITAÇÃO'] || 'AUSENTE'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {row.entry_date || '-'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {row.client_name || '-'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {row.responsible_name || '-'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem' }}>
                            {row._status === 'error' ? '-' : <StatusBadge status={row.general_status!} />}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem' }}>
                            {row._status === 'error' ? '-' : <PriorityBadge priority={row.priority!} />}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {row.fiscal_year || '-'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>
                            {row._status === 'error' ? (
                              <span style={{ color: '#e53e3e', fontWeight: 600, fontSize: '0.6875rem' }}>ERRO</span>
                            ) : row.isUpdate ? (
                              <span style={{ color: '#3182ce', fontWeight: 600, fontSize: '0.6875rem' }}>ATUALIZAR</span>
                            ) : (
                              <span style={{ color: '#2f855a', fontWeight: 600, fontSize: '0.6875rem' }}>NOVO</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <Button variant="secondary" onClick={handleImportClose} style={{ borderRadius: 3 }}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImportConfirm} 
                  disabled={importPreview.validRows.length === 0}
                  style={{ borderRadius: 3 }}
                >
                  Confirmar Importação ({importPreview.validRows.length} registros)
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
