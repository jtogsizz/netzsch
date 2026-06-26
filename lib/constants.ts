import type { GeneralStatus, Priority } from '@/types';

// Opções padronizadas para selects e filtros
export const STATUS_OPTIONS: { value: GeneralStatus; label: string }[] = [
  { value: 'Novo', label: 'Novo' },
  { value: 'Em andamento', label: 'Em andamento' },
  { value: 'Encerrado', label: 'Encerrado' },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'Alta', label: 'Alta' },
  { value: 'Normal', label: 'Normal' },
  { value: 'Baixa', label: 'Baixa' },
];

// FYs disponíveis — adicionar conforme surgem novos anos fiscais
export const FISCAL_YEAR_OPTIONS = [
  'FY24',
  'FY25',
  'FY26',
  'FY27',
];

// Tipos de databook
export const TYPE_OPTIONS = [
  'Peças',
  'Reparo',
  'Revisão',
  'Inspeção',
  'Outro',
];

// Mapeamento de status para classes CSS (cores corporativas)
export const STATUS_STYLES: Record<GeneralStatus, { badge: string; row: string }> = {
  'Novo': {
    badge: 'bg-blue-50 text-blue-800 border border-blue-200',
    row: '',
  },
  'Em andamento': {
    badge: 'bg-amber-50 text-amber-800 border border-amber-200',
    row: 'bg-amber-50/30',
  },
  'Encerrado': {
    badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    row: '',
  },
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  'Alta': 'bg-red-50 text-red-800 border border-red-200',
  'Normal': 'bg-gray-100 text-gray-700 border border-gray-200',
  'Baixa': 'bg-slate-50 text-slate-600 border border-slate-200',
};

// Nomes dos meses em português
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: name,
}));

// Cores do design system NETZSCH
export const BRAND = {
  primary: '#1a4a3a',
  primaryMedium: '#2d6a4f',
  primaryLight: '#40916c',
  background: '#f8f9fa',
  surface: '#ffffff',
  textPrimary: '#1a1a2e',
  textSecondary: '#6c757d',
} as const;

// Cores para gráficos (palette discreta, corporativa)
export const CHART_COLORS = [
  '#1a4a3a',
  '#2d6a4f',
  '#40916c',
  '#52b788',
  '#74c69d',
  '#95d5b2',
  '#b7e4c7',
];
