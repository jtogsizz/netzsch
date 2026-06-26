'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, Pencil, FileText, History, Paperclip } from 'lucide-react';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { DatabookTimeline } from './DatabookTimeline';
import { DatabookFiles } from './DatabookFiles';
import { ResponsiblePanel } from './ResponsiblePanel';
import type { Databook, AuditLog } from '../../types';
import { formatDate, formatDateTime } from '../../lib/utils';

type Tab = 'details' | 'history' | 'files';

interface DatabookDetailClientProps {
  databook: Databook;
  auditLogs: AuditLog[];
}

// Linha de metadado reutilizavel
function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: value ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
        {value ?? 'Nao informado'}
      </span>
    </div>
  );
}

export function DatabookDetailClient({ databook: db, auditLogs }: DatabookDetailClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [responsiblePanelOpen, setResponsiblePanelOpen] = useState(false);

  const tabs: { key: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { key: 'details', label: 'Detalhes', icon: FileText },
    { key: 'history', label: 'Historico', icon: History, count: auditLogs.length },
    { key: 'files', label: 'Arquivos', icon: Paperclip },
  ];

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/databooks"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '0.75rem' }}
        >
          <ChevronLeft size={14} />
          Databooks
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                {db.number}
              </h1>
              <StatusBadge status={db.general_status} />
              <PriorityBadge priority={db.priority} />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
              {db.client_name ?? 'Cliente nao informado'}
              {db.company_name && ` · ${db.company_name}`}
            </p>
          </div>
          <Link href={`/databooks/${db.id}/edit`} className="btn btn-primary btn-sm">
            <Pencil size={14} />
            Editar
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="section-card">
        <div className="tab-bar" role="tablist">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              className={`tab-item ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={14} />
              {label}
              {count !== undefined && count > 0 && (
                <span style={{
                  background: activeTab === key ? 'var(--brand-100)' : 'var(--surface-bg)',
                  color: activeTab === key ? 'var(--brand-700)' : 'var(--text-muted)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Aba Detalhes */}
        {activeTab === 'details' && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Informacoes principais */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Informacoes Gerais
                </div>
                <MetaRow label="Numero" value={db.number} />
                <MetaRow label="Data de entrada" value={formatDate(db.entry_date)} />
                <MetaRow label="Cliente" value={db.client_name} />
                <MetaRow label="Empresa / Usina" value={db.company_name} />
                <MetaRow label="UF / Status Tecnico" value={db.technical_status} />
                <MetaRow label="Tipo" value={db.type} />
                <MetaRow label="Ano Fiscal (FY)" value={db.fiscal_year} />
              </div>

              {/* Status e prazos */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Status e Controle
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</span>
                  <StatusBadge status={db.general_status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Prioridade</span>
                  <PriorityBadge priority={db.priority} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Responsavel</span>
                  {db.responsible_name ? (
                    <button
                      onClick={() => setResponsiblePanelOpen(true)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--brand-700)', fontWeight: 500, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 2 }}
                    >
                      {db.responsible_name}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-disabled)', fontSize: '0.875rem' }}>Nao informado</span>
                  )}
                </div>
                <MetaRow label="Previsao de entrega" value={formatDate(db.delivery_date)} />

                {/* Observacoes */}
                {db.notes && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Observacoes
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0, background: 'var(--surface-bg)', padding: '0.875rem', borderRadius: 7 }}>
                      {db.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodape com timestamps */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '2rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Criado em: <strong style={{ color: 'var(--text-secondary)' }}>{formatDateTime(db.created_at)}</strong>
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Atualizado em: <strong style={{ color: 'var(--text-secondary)' }}>{formatDateTime(db.updated_at)}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Aba Historico */}
        {activeTab === 'history' && (
          <div style={{ padding: '1.5rem' }}>
            <DatabookTimeline auditLogs={auditLogs} databook={db} />
          </div>
        )}

        {/* Aba Arquivos */}
        {activeTab === 'files' && (
          <div style={{ padding: '1.5rem' }}>
            <DatabookFiles databookId={db.id} />
          </div>
        )}
      </div>

      {/* Painel do responsavel */}
      {responsiblePanelOpen && db.responsible_name && (
        <ResponsiblePanel
          responsibleName={db.responsible_name}
          onClose={() => setResponsiblePanelOpen(false)}
        />
      )}
    </>
  );
}
