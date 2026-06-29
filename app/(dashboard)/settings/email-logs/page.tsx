/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { EmailImportLog, EmailQueueStatus, EmailLogStats } from '@/types';
import { formatDateTime } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, RefreshCw, Mail,
  Eye, Plus, Trash2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';

// ── Helpers de display ────────────────────────────────────────────────────────

/** Formata o remetente exibindo "Nome\nemail" quando há nome, ou só o email */
function formatSender(log: EmailImportLog): { name: string | null; address: string } {
  return { name: log.from_name ?? null, address: log.from_address };
}

// ── Badge de status da fila ───────────────────────────────────────────────────

const QUEUE_STATUS_LABELS: Record<EmailQueueStatus, string> = {
  pending:   'Pendente',
  approved:  'Aprovado',
  duplicate: 'Duplicata',
  blocked:   'Bloqueado',
  error:     'Erro',
};

const QUEUE_STATUS_STYLES: Record<EmailQueueStatus, React.CSSProperties> = {
  pending: {
    background: '#fff9db', color: '#995200',
    border: '1px solid #ffe066',
  },
  approved: {
    background: '#ebfbee', color: '#1a4a2e',
    border: '1px solid #b2f2bb',
  },
  duplicate: {
    background: '#e8f0fe', color: '#2b4acb',
    border: '1px solid #c5d3fb',
  },
  blocked: {
    background: '#fff5f5', color: '#c92a2a',
    border: '1px solid #ffc9c9',
  },
  error: {
    background: '#fff5f5', color: '#c92a2a',
    border: '1px solid #ffc9c9',
  },
};

function QueueStatusBadge({ status }: { status: EmailQueueStatus }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.6875rem',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '3px',
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        ...QUEUE_STATUS_STYLES[status],
      }}
    >
      {QUEUE_STATUS_LABELS[status]}
    </span>
  );
}

// ── Cards do dashboard ────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  accent?: string;
}

function StatCard({ label, value, accent = 'var(--brand-600)' }: StatCardProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)',
        padding: '0.625rem 0.875rem',
        minWidth: 110,
        flex: '1 1 110px',
      }}
    >
      <div
        style={{
          fontSize: '1.375rem',
          fontWeight: 700,
          color: accent,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

// ── Filtros de status ─────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending',   label: 'Pendentes' },
  { value: 'approved',  label: 'Aprovados' },
  { value: 'duplicate', label: 'Duplicatas' },
  { value: 'blocked',   label: 'Bloqueados' },
  { value: 'error',     label: 'Erros' },
];

// ── Modal de visualização ─────────────────────────────────────────────────────

interface ViewModalProps {
  log: EmailImportLog | null;
  onClose: () => void;
}

function ViewModal({ log, onClose }: ViewModalProps) {
  const [bodyTab, setBodyTab] = useState<'text' | 'html'>('text');

  if (!log) return null;

  const hasHtml = !!log.raw_html;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.25rem 0.625rem',
    fontSize: '0.75rem',
    fontWeight: active ? 600 : 400,
    border: '1px solid var(--border)',
    borderBottom: active ? '1px solid var(--surface-card)' : '1px solid var(--border)',
    background: active ? 'var(--surface-card)' : 'var(--surface-bg)',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: '3px 3px 0 0',
    marginBottom: -1,
    position: 'relative',
  });

  const fieldStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '110px 1fr',
    gap: '0.25rem 0.75rem',
    fontSize: '0.8125rem',
    alignItems: 'start',
    padding: '0.375rem 0',
    borderBottom: '1px solid var(--border)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    paddingTop: 2,
  };

  const { name: senderName, address: senderAddress } = formatSender(log);

  return (
    <Modal
      open={!!log}
      onClose={onClose}
      title="Detalhes do Email"
      maxWidth="680px"
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Cabeçalho de metadados */}
        <div style={{ ...fieldStyle }}>
          <span style={labelStyle}>Remetente</span>
          <span>
            {senderName && (
              <span style={{ fontWeight: 600, display: 'block' }}>{senderName}</span>
            )}
            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{senderAddress}</span>
          </span>
        </div>

        {log.to_address && (
          <div style={fieldStyle}>
            <span style={labelStyle}>Destinatário</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{log.to_address}</span>
          </div>
        )}

        <div style={fieldStyle}>
          <span style={labelStyle}>Assunto</span>
          <span style={{ fontWeight: 500 }}>{log.subject || <span style={{ color: 'var(--text-disabled)' }}>—</span>}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Recebido em</span>
          <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(log.received_at)}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Nº Extraído</span>
          <span>
            {log.databook_number
              ? <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9375rem' }}>{log.databook_number}</span>
              : <span style={{ color: 'var(--text-disabled)' }}>Não identificado</span>
            }
          </span>
        </div>

        <div style={{ ...fieldStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Status</span>
          <QueueStatusBadge status={log.queue_status ?? 'error'} />
        </div>

        {log.error_message && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              background: '#fff5f5',
              border: '1px solid #ffc9c9',
              borderRadius: '3px',
              padding: '0.5rem 0.625rem',
              fontSize: '0.8125rem',
              color: '#c92a2a',
              marginTop: '0.5rem',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {log.error_message}
          </div>
        )}

        {/* Corpo do email */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
            <button style={tabStyle(bodyTab === 'text')} onClick={() => setBodyTab('text')}>
              Texto
            </button>
            {hasHtml && (
              <button style={tabStyle(bodyTab === 'html')} onClick={() => setBodyTab('html')}>
                HTML
              </button>
            )}
          </div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '0 3px 3px 3px',
              background: 'var(--surface-bg)',
              padding: '0.75rem',
              minHeight: 120,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {bodyTab === 'text' ? (
              <pre
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-secondary)',
                }}
              >
                {log.raw_body || <span style={{ color: 'var(--text-disabled)' }}>Sem conteúdo de texto</span>}
              </pre>
            ) : (
              <iframe
                srcDoc={log.raw_html ?? ''}
                title="Conteúdo HTML do email"
                style={{ width: '100%', height: 240, border: 'none', borderRadius: 2 }}
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>

        {/* Seção de Anexos — preparada para implementação futura */}
        <div
          style={{
            marginTop: '1rem',
            padding: '0.625rem 0.75rem',
            background: 'var(--surface-bg)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Anexos
          </span>
          <span style={{ marginLeft: '0.5rem', color: 'var(--text-disabled)', fontSize: '0.75rem' }}>
            — Processamento automático de anexos em desenvolvimento
          </span>
        </div>

      </div>
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailImportLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Stats do dashboard
  const [stats, setStats] = useState<EmailLogStats>({ today: 0, pending: 0, approved: 0, blocked: 0 });

  // Modal de visualização
  const [viewLog, setViewLog] = useState<EmailImportLog | null>(null);

  // Modal de aprovação
  const [approveTarget, setApproveTarget] = useState<EmailImportLog | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<EmailImportLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStats = useCallback(() => {
    fetch('/api/email-logs/stats')
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setStats(json);
      })
      .catch(() => {/* silencioso */});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (queueStatus) params.set('queue_status', queueStatus);

    fetch(`/api/email-logs?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setLogs(json.data ?? []);
        setTotal(json.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, queueStatus]);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);

  // Reset página ao mudar filtro
  const handleStatusChange = (s: string) => {
    setQueueStatus(s);
    setPage(1);
  };

  const handleRefresh = () => { load(); loadStats(); };

  const totalPages = Math.ceil(total / pageSize);

  // ── Aprovação ─────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    setApproveError('');
    try {
      const res = await fetch(`/api/email-logs/${approveTarget.id}/approve`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setApproveError(json.error ?? 'Erro ao aprovar email');
        setApproving(false);
        return;
      }
      // Atualiza inline sem reload completo
      setLogs((prev) =>
        prev.map((l) =>
          l.id === approveTarget.id
            ? { ...l, queue_status: 'approved', databook_id: json.databook_id }
            : l
        )
      );
      setStats((s) => ({
        ...s,
        pending: Math.max(0, s.pending - 1),
        approved: s.approved + 1,
      }));
      setApproveTarget(null);
    } catch {
      setApproveError('Erro de conexão. Tente novamente.');
    }
    setApproving(false);
  };

  // ── Exclusão ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/email-logs/${deleteTarget.id}`, { method: 'DELETE' });
      setLogs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      // Atualiza stats se for pending
      if (deleteTarget.queue_status === 'pending') {
        setStats((s) => ({ ...s, pending: Math.max(0, s.pending - 1) }));
      }
      setDeleteTarget(null);
    } catch {
      /* silencioso */
    }
    setDeleting(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Log de Emails</h1>
          <p className="page-subtitle">
            Fila de revisão de emails recebidos em{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
              databook@prenaarok.resend.app
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          id="btn-refresh-logs"
          aria-label="Atualizar logs"
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
          Atualizar
        </Button>
      </div>

      {/* Dashboard de emails */}
      <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.125rem', flexWrap: 'wrap' }}>
        <StatCard label="Recebidos hoje"  value={stats.today}   accent="var(--text-secondary)" />
        <StatCard label="Pendentes"        value={stats.pending}  accent="#995200" />
        <StatCard label="Aprovados"        value={stats.approved} accent="var(--brand-600)" />
        <StatCard label="Bloqueados"       value={stats.blocked}  accent="#c92a2a" />
      </div>

      {/* Filtros por status */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleStatusChange(value)}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: queueStatus === value ? 600 : 400,
              borderRadius: '3px',
              border: '1px solid',
              borderColor: queueStatus === value ? 'var(--brand-500)' : 'var(--border)',
              background: queueStatus === value ? 'var(--brand-50)' : 'var(--surface-card)',
              color: queueStatus === value ? 'var(--brand-700)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
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
              {queueStatus
                ? 'Nenhum registro com este status.'
                : 'Os emails recebidos aparecerão aqui automaticamente.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: 130 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Data/Hora</th>
                    <th style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Remetente</th>
                    <th style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Assunto</th>
                    <th style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Nº Extraído</th>
                    <th style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Status</th>
                    <th style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Motivo / Erro</th>
                    <th style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const { name: senderName, address: senderAddress } = formatSender(log);
                    const qStatus: EmailQueueStatus = log.queue_status ?? 'error';
                    const isPending = qStatus === 'pending';

                    return (
                      <tr
                        key={log.id}
                        style={{
                          background: isPending ? '#fffdf2' : undefined,
                          transition: 'background var(--transition-fast)',
                        }}
                      >
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {formatDateTime(log.received_at)}
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          {senderName && (
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {senderName}
                            </span>
                          )}
                          <span
                            title={senderAddress}
                            style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {senderAddress}
                          </span>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <span
                            title={log.subject ?? ''}
                            style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}
                          >
                            {log.subject || <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                          </span>
                        </td>
                        <td>
                          {log.databook_number
                            ? <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.875rem' }}>{log.databook_number}</span>
                            : <span style={{ color: 'var(--text-disabled)' }}>—</span>
                          }
                        </td>
                        <td>
                          <QueueStatusBadge status={qStatus} />
                        </td>
                        <td style={{ maxWidth: 140 }}>
                          {log.error_message
                            ? (
                              <span
                                title={log.error_message}
                                style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                              >
                                {log.error_message}
                              </span>
                            )
                            : <span style={{ color: 'var(--text-disabled)' }}>—</span>
                          }
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            {/* Visualizar — sempre disponível */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewLog(log)}
                              title="Visualizar email completo"
                              aria-label={`Visualizar email: ${log.subject ?? log.from_address}`}
                              id={`btn-view-${log.id}`}
                            >
                              <Eye size={13} />
                            </Button>

                            {/* Adicionar ao Sistema — apenas pending */}
                            {isPending && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setApproveError(''); setApproveTarget(log); }}
                                title="Adicionar ao Sistema"
                                aria-label={`Adicionar databook ${log.databook_number} ao sistema`}
                                id={`btn-approve-${log.id}`}
                                style={{ color: 'var(--brand-600)' }}
                              >
                                <Plus size={13} />
                              </Button>
                            )}

                            {/* Excluir — sempre disponível */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(log)}
                              title="Excluir registro do log"
                              aria-label={`Excluir log: ${log.subject ?? log.from_address}`}
                              id={`btn-delete-${log.id}`}
                              style={{ color: '#dc3545' }}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
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

      {/* Modal — Visualizar */}
      <ViewModal log={viewLog} onClose={() => setViewLog(null)} />

      {/* Modal — Adicionar ao Sistema */}
      {approveTarget && (
        <Modal
          open={!!approveTarget}
          onClose={() => !approving && setApproveTarget(null)}
          title="Adicionar ao Sistema"
          maxWidth="480px"
          footer={
            <>
              <Button variant="ghost" onClick={() => setApproveTarget(null)} disabled={approving}>
                Cancelar
              </Button>
              <Button onClick={handleApprove} loading={approving} id="btn-confirm-approve">
                <CheckCircle2 size={14} />
                Confirmar
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Criar o Databook{' '}
              <strong style={{ fontFamily: 'monospace' }}>{approveTarget.databook_number}</strong>{' '}
              a partir deste email?
            </p>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'var(--surface-bg)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.5rem 0.625rem' }}>
              <strong>Remetente:</strong>{' '}
              {approveTarget.from_name ? `${approveTarget.from_name} ` : ''}{approveTarget.from_address}
              <br />
              <strong>Assunto:</strong> {approveTarget.subject || '—'}
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              O databook será criado com os dados extraídos do email. Campos não identificados poderão ser preenchidos manualmente depois.
            </p>
            {approveError && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  background: '#fff5f5',
                  border: '1px solid #ffc9c9',
                  borderRadius: '3px',
                  padding: '0.5rem 0.625rem',
                  fontSize: '0.8125rem',
                  color: '#c92a2a',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {approveError}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal — Excluir log */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Registro"
        message={`Remover este log do email "${deleteTarget?.subject ?? deleteTarget?.from_address}"? Esta ação não afeta databooks já criados.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
