'use client';

import { useState, useEffect } from 'react';
import { X, Briefcase, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Databook } from '@/types';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';

interface ResponsiblePanelProps {
  responsibleName: string;
  onClose: () => void;
}

export function ResponsiblePanel({ responsibleName, onClose }: ResponsiblePanelProps) {
  const [loading, setLoading] = useState(true);
  const [databooks, setDatabooks] = useState<Databook[]>([]);

  useEffect(() => {
    // Escuta tecla ESC para fechar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Carrega dados
    const supabase = createClient();
    supabase
      .from('databooks')
      .select('*')
      .eq('responsible_name', responsibleName)
      .then(({ data }) => {
        if (data) {
          setDatabooks(data as Databook[]);
        }
        setLoading(false);
      });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [responsibleName, onClose]);

  // Estatísticas calculadas localmente
  const total = databooks.length;
  const novo = databooks.filter(d => d.general_status === 'Novo').length;
  const emAndamento = databooks.filter(d => d.general_status === 'Em andamento').length;
  const encerrado = databooks.filter(d => d.general_status === 'Encerrado').length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--surface)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          animation: 'slide-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do painel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={18} style={{ color: 'var(--brand-700)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Perfil do Responsável</h2>
          </div>
          <button
            onClick={onClose}
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

        {/* Corpo do painel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Carregando dados...
            </div>
          ) : (
            <div>
              {/* Nome */}
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--brand-700)',
                    color: '#fff',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                  }}
                >
                  {responsibleName.slice(0, 2).toUpperCase()}
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{responsibleName}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--brand-50)', padding: '0.25rem 0.5rem', borderRadius: 4, fontWeight: 600 }}>
                  Colaborador Interno
                </span>
              </div>

              {/* Estatísticas resumidas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.75rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-700)' }}>{total}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Abertos</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>{novo + emAndamento}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Encerrados</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{encerrado}</div>
                </div>
              </div>

              {/* Lista de Databooks sob responsabilidade */}
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Databooks Vinculados ({total})
              </h4>

              {databooks.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                  Nenhum databook vinculado a este colaborador.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {databooks.map((db) => (
                    <div
                      key={db.id}
                      style={{
                        padding: '0.875rem',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: 'var(--card-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Link
                          href={`/databooks/${db.id}`}
                          onClick={onClose}
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'var(--brand-700)',
                            textDecoration: 'none',
                          }}
                        >
                          {db.number}
                        </Link>
                        <StatusBadge status={db.general_status} />
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {db.client_name ?? 'Cliente não informado'}
                      </div>
                      {db.delivery_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <Clock size={12} />
                          Prazo: {formatDate(db.delivery_date)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
