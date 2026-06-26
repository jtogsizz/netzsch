import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  description?: string;
  accent?: 'default' | 'blue' | 'amber' | 'green' | 'red';
  icon?: ReactNode;
}

// Mapeia accents para variáveis CSS customizadas do stat-card
const ACCENT_MAP: Record<string, { accent: string; iconBg: string; iconColor: string }> = {
  default: { accent: 'var(--border)', iconBg: 'var(--surface-bg)', iconColor: 'var(--brand-600)' },
  blue:    { accent: 'var(--status-novo-border)', iconBg: 'var(--status-novo-bg)', iconColor: 'var(--status-novo-text)' },
  amber:   { accent: '#fcd34d', iconBg: '#fffbeb', iconColor: '#d97706' },
  green:   { accent: 'var(--status-encerrado-border)', iconBg: 'var(--status-encerrado-bg)', iconColor: 'var(--status-encerrado-text)' },
  red:     { accent: 'var(--prio-alta-border)', iconBg: 'var(--prio-alta-bg)', iconColor: 'var(--prio-alta-text)' },
};

export function StatCard({ label, value, description, accent = 'default', icon }: StatCardProps) {
  const s = ACCENT_MAP[accent];

  return (
    <div
      className="stat-card"
      style={{
        '--card-accent': s.accent,
        '--icon-bg': s.iconBg,
        '--icon-color': s.iconColor,
      } as React.CSSProperties}
    >
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        {icon && (
          <div className="stat-card-icon">{icon}</div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {description && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem', lineHeight: 1.3 }}>
          {description}
        </div>
      )}
    </div>
  );
}
