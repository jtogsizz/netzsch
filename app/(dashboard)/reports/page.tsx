/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import {
  ByStatusChart,
  ByResponsibleChart,
  ByMonthChart,
  ByFYChart,
  ByTechnicalStatusChart,
} from '@/components/dashboard/Charts';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { FISCAL_YEAR_OPTIONS } from '@/lib/constants';
import { Download } from 'lucide-react';

interface ReportData {
  cards: { total: number; total_mes: number; prioridade_alta: number };
  byStatus: { status: string; count: number }[];
  byFY: { fiscal_year: string; count: number }[];
  byResponsible: { responsible_name: string; count: number }[];
  byMonth: { month: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byTechnicalStatus: { technical_status: string; count: number }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFY, setSelectedFY] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = selectedFY ? `?fiscal_year=${selectedFY}` : '';
    fetch(`/api/reports${params}`)
      .then((r) => r.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, [selectedFY]);

  const exportUrl = (format: 'xlsx' | 'csv') =>
    `/api/export?format=${format}${selectedFY ? `&fiscal_year=${selectedFY}` : ''}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatorios</h1>
          <p className="page-subtitle">Analise de Databooks por status, responsavel, mes e FY</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: 110 }}
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            aria-label="Filtrar relatorio por FY"
          >
            <option value="">Todos os FY</option>
            {FISCAL_YEAR_OPTIONS.map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>

          <a href={exportUrl('xlsx')}>
            <Button variant="secondary" size="sm">
              <Download size={14} />
              Excel
            </Button>
          </a>
          <a href={exportUrl('csv')}>
            <Button variant="ghost" size="sm">
              <Download size={14} />
              CSV
            </Button>
          </a>
        </div>
      </div>

      {loading || !data ? (
        <PageLoader />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: '1rem',
          }}
        >
          <div className="section-card">
            <div className="section-card-header">
              <h2>Por Status Geral</h2>
            </div>
            <div className="section-card-body">
              {data.byStatus.length > 0
                ? <ByStatusChart data={data.byStatus} />
                : <div className="empty-state">Nenhum dado</div>}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <h2>Por Ano Fiscal (FY)</h2>
            </div>
            <div className="section-card-body">
              {data.byFY.length > 0
                ? <ByFYChart data={data.byFY} />
                : <div className="empty-state">Nenhum dado</div>}
            </div>
          </div>

          <div className="section-card" style={{ gridColumn: 'span 1' }}>
            <div className="section-card-header">
              <h2>Por Responsavel</h2>
            </div>
            <div className="section-card-body">
              {data.byResponsible.length > 0
                ? <ByResponsibleChart data={data.byResponsible} />
                : <div className="empty-state">Nenhum dado</div>}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <h2>Entrada por Mes</h2>
            </div>
            <div className="section-card-body">
              {data.byMonth.length > 0
                ? <ByMonthChart data={data.byMonth} />
                : <div className="empty-state">Nenhum dado</div>}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <h2>Por UF / Status Tecnico (Top 15)</h2>
            </div>
            <div className="section-card-body">
              {data.byTechnicalStatus.length > 0
                ? <ByTechnicalStatusChart data={data.byTechnicalStatus} />
                : <div className="empty-state">Nenhum dado</div>}
            </div>
          </div>

          {/* Tabela resumo por FY */}
          <div className="section-card">
            <div className="section-card-header">
              <h2>Resumo por FY</h2>
            </div>
            <div className="section-card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ano Fiscal</th>
                    <th>Total</th>
                    <th>% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFY
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <tr key={row.fiscal_year}>
                        <td style={{ fontWeight: 600 }}>{row.fiscal_year}</td>
                        <td>{row.count}</td>
                        <td>
                          {data.cards.total > 0
                            ? `${((row.count / data.cards.total) * 100).toFixed(1)}%`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
