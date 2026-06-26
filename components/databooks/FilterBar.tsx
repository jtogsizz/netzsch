'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Search, X } from 'lucide-react';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  FISCAL_YEAR_OPTIONS,
  MONTH_OPTIONS,
} from '@/lib/constants';

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set('page', '1'); // reseta para primeira página ao filtrar
      router.push(`/databooks?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', search);
  };

  const handleClear = () => {
    setSearch('');
    router.push('/databooks');
  };

  const hasActiveFilters =
    searchParams.has('search') ||
    searchParams.has('general_status') ||
    searchParams.has('priority') ||
    searchParams.has('fiscal_year') ||
    searchParams.has('responsible_name') ||
    searchParams.has('month') ||
    searchParams.has('year');

  return (
    <div className="filter-bar">
      {/* Busca livre */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.375rem', flex: '1 1 200px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#adb5bd',
              pointerEvents: 'none',
            }}
          />
          <input
            className="form-control"
            style={{ paddingLeft: '2rem' }}
            placeholder="Buscar numero, cliente, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm">Buscar</Button>
      </form>

      {/* Filtros por select */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 140 }}
          value={searchParams.get('general_status') ?? ''}
          onChange={(e) => updateParam('general_status', e.target.value)}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 120 }}
          value={searchParams.get('priority') ?? ''}
          onChange={(e) => updateParam('priority', e.target.value)}
          aria-label="Filtrar por prioridade"
        >
          <option value="">Prioridade</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 100 }}
          value={searchParams.get('fiscal_year') ?? ''}
          onChange={(e) => updateParam('fiscal_year', e.target.value)}
          aria-label="Filtrar por FY"
        >
          <option value="">FY</option>
          {FISCAL_YEAR_OPTIONS.map((fy) => (
            <option key={fy} value={fy}>{fy}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: 120 }}
          value={searchParams.get('month') ?? ''}
          onChange={(e) => updateParam('month', e.target.value)}
          aria-label="Filtrar por mes"
        >
          <option value="">Mes</option>
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <input
          type="number"
          className="form-control"
          style={{ width: 80 }}
          placeholder="Ano"
          min="2020"
          max="2030"
          value={searchParams.get('year') ?? ''}
          onChange={(e) => updateParam('year', e.target.value)}
          aria-label="Filtrar por ano"
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            title="Limpar filtros"
          >
            <X size={14} />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
