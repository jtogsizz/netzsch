/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, X } from 'lucide-react';
import type { Databook } from '@/types';
import { formatDate } from '@/lib/utils';

interface GlobalSearchProps {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Databook[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Busca com debounce para nao disparar a cada tecla
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query, page_size: '8' });
        const res = await fetch(`/api/databooks?${params}`);
        const json = await res.json();
        setResults(json.data ?? []);
        setFocusedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (db: Databook) => {
    onClose();
    router.push(`/databooks/${db.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[focusedIdx]) {
      handleSelect(results[focusedIdx]);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="global-search-overlay" onClick={handleBackdropClick}>
      <div className="global-search-panel" onKeyDown={handleKeyDown}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0 1.125rem' }}>
          <Search size={17} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="global-search-input"
            style={{ padding: '0.9375rem 0' }}
            placeholder="Buscar databook, cliente, empresa, responsavel, UF..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) {
                setResults([]);
                setLoading(false);
              }
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="global-search-results">
          {loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Buscando...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Nenhum resultado para &quot;{query}&quot;
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '1.25rem 1.25rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Como usar
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Digite qualquer informacao do databook: numero, cliente, empresa, usina, responsavel, UF, status tecnico, FY ou observacoes.
              </div>
            </div>
          )}

          {results.map((db, i) => (
            <div
              key={db.id}
              className={`global-search-result ${i === focusedIdx ? 'focused' : ''}`}
              onClick={() => handleSelect(db)}
              onMouseEnter={() => setFocusedIdx(i)}
            >
              <div className="global-search-result-icon">
                <FileText size={15} />
              </div>
              <div className="global-search-result-content">
                <div className="global-search-result-title">
                  {db.number}
                  {db.client_name && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      — {db.client_name}
                    </span>
                  )}
                </div>
                <div className="global-search-result-sub">
                  {[db.company_name, db.responsible_name, db.fiscal_year, db.general_status]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', flexShrink: 0 }}>
                {formatDate(db.entry_date)}
              </div>
            </div>
          ))}
        </div>

        {/* Rodape com atalhos */}
        <div className="global-search-footer">
          <div className="global-search-kbd">
            <span className="kbd">↑↓</span> navegar
          </div>
          <div className="global-search-kbd">
            <span className="kbd">Enter</span> abrir
          </div>
          <div className="global-search-kbd">
            <span className="kbd">Esc</span> fechar
          </div>
        </div>
      </div>
    </div>
  );
}
