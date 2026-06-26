'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { MONTH_NAMES } from '@/lib/constants';

// Paleta corporativa alinhada ao Design System
const BRAND_GREEN = '#1f5a47';
const BRAND_LIGHT = '#40916c';

const PALETTE = ['#1f5a47', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc'];

// Tooltip padrao — estilo corporativo
const CustomTooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8e5',
  borderRadius: 7,
  padding: '0.5rem 0.875rem',
  fontSize: '0.8125rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

// ---- Status geral — donut chart ----
interface ByStatusChartProps {
  data: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  'Novo': '#1e6091',
  'Em andamento': '#d97706',
  'Encerrado': '#16a34a',
};

export function ByStatusChart({ data }: ByStatusChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={3}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? BRAND_GREEN} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={CustomTooltipStyle}
          formatter={(v, name) => [`${v}`, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '0.8125rem', paddingTop: '0.5rem' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---- Prioridade — donut chart ----
interface ByPriorityChartProps {
  data: { priority: string; count: number }[];
}

const PRIORITY_COLORS: Record<string, string> = {
  'Alta':   '#dc2626',
  'Normal': '#6c757d',
  'Baixa':  '#94a3b8',
};

export function ByPriorityChart({ data }: ByPriorityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="priority"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={3}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] ?? BRAND_GREEN} />
          ))}
        </Pie>
        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v, name) => [`${v}`, name]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.8125rem', paddingTop: '0.5rem' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---- Por responsavel — barras horizontais ----
interface ByResponsibleChartProps {
  data: { responsible_name: string; count: number }[];
}

export function ByResponsibleChart({ data }: ByResponsibleChartProps) {
  const truncated = data.slice(0, 10).map((d) => ({
    ...d,
    name: d.responsible_name
      ? d.responsible_name.length > 16 ? d.responsible_name.slice(0, 16) + '…' : d.responsible_name
      : 'Nao informado',
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, truncated.length * 30 + 40)}>
      <BarChart data={truncated} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#f0f2f1" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#718096' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#4a5568' }} width={110} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v} databooks`, 'Total']} />
        <Bar dataKey="count" fill={BRAND_GREEN} radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Entrada por mes — area chart ----
interface ByMonthChartProps {
  data: { month: string; count: number }[];
}

export function ByMonthChart({ data }: ByMonthChartProps) {
  const formatted = data.map((d) => {
    const [year, month] = d.month.split('-');
    const monthName = MONTH_NAMES[parseInt(month) - 1]?.slice(0, 3) ?? month;
    return { ...d, label: `${monthName}/${year?.slice(2)}` };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ left: -8, right: 8, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_GREEN} stopOpacity={0.18} />
            <stop offset="100%" stopColor={BRAND_GREEN} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f0f2f1" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#718096' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v} databooks`, 'Entradas']} />
        <Area type="monotone" dataKey="count" stroke={BRAND_GREEN} strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 3, fill: BRAND_GREEN }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---- Por FY — colunas ----
interface ByFYChartProps {
  data: { fiscal_year: string; count: number }[];
}

export function ByFYChart({ data }: ByFYChartProps) {
  const sorted = [...data].sort((a, b) => (a.fiscal_year ?? '').localeCompare(b.fiscal_year ?? ''));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={sorted} margin={{ left: -8, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f0f2f1" />
        <XAxis dataKey="fiscal_year" tick={{ fontSize: 12, fill: '#718096' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#718096' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v} databooks`, 'Total']} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {sorted.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Por UF / Status tecnico — barras horizontais ----
interface ByTechnicalStatusChartProps {
  data: { technical_status: string; count: number }[];
}

export function ByTechnicalStatusChart({ data }: ByTechnicalStatusChartProps) {
  const sorted = data
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((d) => ({
      ...d,
      label: d.technical_status
        ? d.technical_status.length > 12 ? d.technical_status.slice(0, 12) + '…' : d.technical_status
        : 'Nao inf.',
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 28 + 40)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#f0f2f1" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#718096' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#4a5568' }} width={90} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v} databooks`, 'Total']} />
        <Bar dataKey="count" fill={BRAND_LIGHT} radius={[0, 4, 4, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
