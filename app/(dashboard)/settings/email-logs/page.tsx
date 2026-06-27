/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { EmailImportLog, EmailImportStatus } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { ChevronLeft, ChevronRight, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ── Badge de status ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<EmailImportStatus, string> = {
  success: 'Criado',
  duplicate: 'Duplicata',
  blocked: 'Bloqueado',
  error: 'Erro',
};

const STATUS_STYLES: Record<EmailImportStatus, React.CSSProperties> = {
  success: {
    background: '#ebfbee', color: '#2b8a3e',
    border: '1px solid #b2f2bb',
  },
  duplicate: {
    background: '#e8f0fe', color: '#3b5bdb',
    border: '1px solid #c5d3fb',
  },
  blocked: {
    background: '#fff4e6', color: '#b25e00',
    border: '1px solid #ffe8cc',
  },
  error: {
    background: '#fff5f5', color: '#c92a2a',
    border: '1px solid #ffc9c9',
  },
};

function StatusBadge({ status }: { status: EmailImportStatus }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.6875rem',
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: '3px',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        ...STATUS_STYLES[status],
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Filtros de status ─────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'success', label: 'Criados' },
  { value: 'duplicate', label: 'Duplicatas' },
  { value: 'blocked', label: 'Bloqueados' },
  { value: 'error', label: 'Erros' },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailImportLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (status) params.set('status', status);

    fetch(`/api/email-logs?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setLogs(json.data ?? []);
        setTotal(json.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  // Reset página ao mudar filtro
  const handleStatusChange = (s: string) => {
    setStatus(s);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Log de Emails</h1>
          <p className="page-subtitle">
            Histórico de todos os emails recebidos em{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
              databook@prenaarok.resend.app
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          id="btn-refresh-logs"
          aria-label="Atualizar logs"
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
          Atualizar
        </Button>
      </div>

      {/* Filtros por status */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleStatusChange(value)}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: status === value ? 600 : 400,
              borderRadius: '3px',
              border: '1px solid',
              borderColor: status === value ? 'var(--brand-500)' : 'var(--border)',
              background: status === value ? 'var(--brand-50)' : 'var(--surface-card)',
              color: status === value ? 'var(--brand-700)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#6c757d', alignSelf: 'center' }}>
          {total} registro{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="section-card">
        {loading ? (
          <PageLoader />
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Mail size={36} style={{ opacity: 0.3 }} />
            <p style={{ fontWeight: 500 }}>Nenhum log encontrado</p>
            <p style={{ fontSize: '0.875rem' }}>
              {status
                ? 'Nenhum registro com este status.'
                : 'Os emails recebidos aparecerão aqui automaticamente.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Data/Hora</th>
                    <th>Remetente</th>
                    <th>Assunto</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Nº Extraído</th>
                    <th>Status</th>
                    <th>Motivo / Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: '#6c757d' }}>
                        {formatDateTime(log.received_at)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', maxWidth: 200 }}>
                        <span title={log.from_address} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.from_address}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <span title={log.subject ?? ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.subject || <span style={{ color: '#adb5bd' }}>—</span>}
                        </span>
                      </td>
                      <td>
                        {log.databook_number
                          ? <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{log.databook_number}</span>
                          : <span style={{ color: '#adb5bd' }}>—</span>
                        }
                      </td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        {log.error_message
                          ? (
                            <span
                              title={log.error_message}
                              style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', color: '#6c757d' }}
                            >
                              {log.error_message}
                            </span>
                          )
                          : <span style={{ color: '#adb5bd' }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0', marginTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={15} /> Anterior
                </Button>
                <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Próxima página"
                >
                  Próxima <ChevronRight size={15} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
