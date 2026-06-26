'use client';

import type { AuditLog, Databook } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { FilePlus, RefreshCw, User, AlertCircle, StickyNote } from 'lucide-react';

interface DatabookTimelineProps {
  auditLogs: AuditLog[];
  databook: Databook;
}

// Mapeamento de campo para label legivel
const FIELD_LABELS: Record<string, string> = {
  general_status: 'Status',
  priority: 'Prioridade',
  responsible_name: 'Responsavel',
  notes: 'Observacoes',
  delivery_date: 'Previsao de entrega',
  technical_status: 'UF / Status tecnico',
  client_name: 'Cliente',
  company_name: 'Empresa',
  type: 'Tipo',
  fiscal_year: 'Ano Fiscal',
};

// Dot e icone por tipo de alteracao
function getActionMeta(action: string, fieldName?: string | null) {
  if (action === 'created') {
    return { dotClass: 'created', icon: <FilePlus size={14} />, label: 'Databook criado' };
  }
  if (fieldName === 'general_status') {
    return { dotClass: 'status', icon: <RefreshCw size={14} />, label: 'Status alterado' };
  }
  if (fieldName === 'responsible_name') {
    return { dotClass: 'field', icon: <User size={14} />, label: 'Responsavel alterado' };
  }
  if (fieldName === 'priority') {
    return { dotClass: 'field', icon: <AlertCircle size={14} />, label: 'Prioridade alterada' };
  }
  if (fieldName === 'notes') {
    return { dotClass: 'field', icon: <StickyNote size={14} />, label: 'Observacoes atualizadas' };
  }
  return { dotClass: 'field', icon: <RefreshCw size={14} />, label: `${FIELD_LABELS[fieldName ?? ''] ?? fieldName ?? 'Campo'} alterado` };
}

export function DatabookTimeline({ auditLogs, databook }: DatabookTimelineProps) {
  // Combina o evento de criacao com os logs
  const creationEntry = {
    id: 'creation',
    action: 'created' as const,
    field_name: null,
    old_value: null,
    new_value: null,
    changed_by: 'sistema',
    created_at: databook.created_at,
    databook_id: databook.id,
  };

  // Filtra apenas logs relevantes (criacao, status, responsavel, observacoes, prioridade)
  const relevantFields = new Set(['general_status', 'responsible_name', 'notes', 'priority', 'delivery_date', 'client_name', 'company_name', 'technical_status']);
  const filtered = auditLogs.filter(
    (log) => log.action === 'created' || relevantFields.has(log.field_name ?? '')
  );

  const entries = [creationEntry, ...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (entries.length === 1) {
    return (
      <div>
        <div className="timeline">
          <TimelineEntry
            log={creationEntry}
            isLast
            databookNumber={databook.number}
          />
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          Nenhuma alteracao registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {entries.map((log, i) => (
        <TimelineEntry
          key={log.id}
          log={log}
          isLast={i === entries.length - 1}
          databookNumber={databook.number}
        />
      ))}
    </div>
  );
}

interface TimelineEntryProps {
  log: {
    id: string;
    action: string;
    field_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    changed_by: string;
    created_at: string;
  };
  isLast: boolean;
  databookNumber: string;
}

function TimelineEntry({ log, isLast, databookNumber }: TimelineEntryProps) {
  const { dotClass, label } = getActionMeta(log.action, log.field_name);

  return (
    <div className="timeline-item">
      <div className="timeline-line-col">
        <div className={`timeline-dot ${dotClass}`} />
        {!isLast && <div className="timeline-connector" />}
      </div>

      <div className="timeline-content">
        <div className="timeline-header">
          <span className="timeline-action">{label}</span>
          <span className="timeline-time">{formatDateTime(log.created_at)}</span>
        </div>

        <div className="timeline-user">
          por <strong style={{ color: 'var(--text-secondary)' }}>{log.changed_by}</strong>
        </div>

        {/* Diferenca de valores — exibe apenas quando ha mudanca */}
        {log.action !== 'created' && (log.old_value || log.new_value) && (
          <div className="timeline-diff">
            {log.old_value && (
              <div className="timeline-diff-row">
                <span className="timeline-diff-label">Antes</span>
                <span className="timeline-diff-value old">{log.old_value}</span>
              </div>
            )}
            {log.new_value && (
              <div className="timeline-diff-row" style={{ marginTop: '0.25rem' }}>
                <span className="timeline-diff-label">Agora</span>
                <span className="timeline-diff-value new">{log.new_value}</span>
              </div>
            )}
          </div>
        )}

        {log.action === 'created' && (
          <div className="timeline-diff">
            <div className="timeline-diff-row">
              <span className="timeline-diff-label">Numero</span>
              <span className="timeline-diff-value">{databookNumber}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
