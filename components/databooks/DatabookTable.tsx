'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Databook, GeneralStatus } from '@/types';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import { formatDate, truncate } from '@/lib/utils';
import { STATUS_OPTIONS } from '@/lib/constants';
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface DatabookTableProps {
  data: Databook[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}

const SORTABLE_COLUMNS = [
  { key: 'number', label: 'Numero' },
  { key: 'entry_date', label: 'Entrada' },
  { key: 'client_name', label: 'Cliente' },
  { key: 'technical_status', label: 'UF/Status' },
  { key: 'company_name', label: 'Empresa/Usina' },
  { key: 'responsible_name', label: 'Responsavel' },
  { key: 'general_status', label: 'Status' },
  { key: 'delivery_date', label: 'Entrega' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'type', label: 'Tipo' },
  { key: 'fiscal_year', label: 'FY' },
];

export function DatabookTable({ data, sortBy, sortDirection, onSort }: DatabookTableProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<Databook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    await fetch(`/api/databooks/${deleteTarget.id}`, { method: 'DELETE' });

    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
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

  const SortIcon = ({ field }: { field: string }) => {
    if (field !== sortBy) return null;
    return sortDirection === 'asc'
      ? <ChevronUp size={13} />
      : <ChevronDown size={13} />;
  };

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <p style={{ fontWeight: 500 }}>Nenhum databook encontrado</p>
        <p style={{ fontSize: '0.875rem' }}>Ajuste os filtros ou cadastre um novo databook.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {SORTABLE_COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  className="sortable"
                  onClick={() => onSort(key)}
                  aria-sort={sortBy === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {label}
                    <SortIcon field={key} />
                  </span>
                </th>
              ))}
              <th style={{ width: 80 }}>Obs.</th>
              <th style={{ width: 100 }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((db) => (
              <tr
                key={db.id}
                className={db.priority === 'Alta' ? 'priority-high' : ''}
              >
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{db.number}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(db.entry_date)}</td>
                <td title={db.client_name ?? ''}>{truncate(db.client_name, 25)}</td>
                <td>{db.technical_status ?? '-'}</td>
                <td title={db.company_name ?? ''}>{truncate(db.company_name, 20)}</td>
                <td>{db.responsible_name ?? '-'}</td>
                <td>
                  {/* Alteração rápida de status direto na tabela */}
                  <select
                    value={db.general_status}
                    disabled={statusChanging === db.id}
                    onChange={(e) => handleStatusChange(db, e.target.value as GeneralStatus)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      padding: 0,
                      fontFamily: 'inherit',
                    }}
                    aria-label={`Status do databook ${db.number}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.value}</option>
                    ))}
                  </select>
                  {/* Badge visual ao lado do select */}
                  <StatusBadge status={db.general_status} style={{ marginLeft: '0.5rem' }} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(db.delivery_date)}</td>
                <td><PriorityBadge priority={db.priority} /></td>
                <td>{db.type ?? '-'}</td>
                <td>{db.fiscal_year ?? '-'}</td>
                <td title={db.notes ?? ''} style={{ maxWidth: 180 }}>
                  {truncate(db.notes, 40)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/databooks/${db.id}/edit`)}
                      title="Editar"
                      aria-label={`Editar databook ${db.number}`}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(db)}
                      title="Excluir"
                      aria-label={`Excluir databook ${db.number}`}
                      style={{ color: '#dc3545' }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Databook"
        message={`Tem certeza que deseja excluir o databook "${deleteTarget?.number}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
