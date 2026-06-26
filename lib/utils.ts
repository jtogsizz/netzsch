import { clsx, type ClassValue } from 'clsx';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Combina classes condicionais (wrapper do clsx sem tailwind-merge para não adicionar dependência)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Formata datas ISO para exibição no padrão BR
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '-';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
}

// Formata data e hora para auditoria
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '-';
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '-';
  }
}

// Converte string de data BR (dd/mm/yyyy) para ISO (yyyy-mm-dd)
export function brDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Retorna o mês e ano atuais no formato de filtro
export function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  };
}

// Trunca texto longo para exibição em tabela
export function truncate(text: string | null | undefined, maxLength = 50): string {
  if (!text) return '-';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

// Gera um número de databook padrão sugerido (ex: DB-2026-001)
export function suggestDatabookNumber(year: number, count: number): string {
  return `DB-${year}-${String(count).padStart(3, '0')}`;
}

// Agrupa array de objetos por uma chave
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const groupKey = String(item[key] ?? 'Não informado');
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
