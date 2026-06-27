// Tipos centrais do sistema de Databooks NETZSCH

// Roles futuras — sem lógica de permissão ainda, apenas para abstração
export type UserRole = 'admin' | 'collaborator' | 'viewer';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
}

export type GeneralStatus = 'Novo' | 'Em andamento' | 'Encerrado';
export type Priority = 'Alta' | 'Normal' | 'Baixa';
export type AuditAction = 'created' | 'updated' | 'deleted';

export interface Databook {
  id: string;
  number: string;
  entry_date: string | null;
  client_name: string | null;
  technical_status: string | null;
  company_name: string | null;
  responsible_name: string | null;
  general_status: GeneralStatus;
  delivery_date: string | null;
  priority: Priority;
  type: string | null;
  fiscal_year: string | null;
  notes: string | null;
  source: string | null;  // 'email' | 'manual' | null
  created_at: string;
  updated_at: string;
}

export interface DatabookInsert {
  number: string;
  entry_date?: string | null;
  client_name?: string | null;
  technical_status?: string | null;
  company_name?: string | null;
  responsible_name?: string | null;
  general_status?: GeneralStatus;
  delivery_date?: string | null;
  priority?: Priority;
  type?: string | null;
  fiscal_year?: string | null;
  notes?: string | null;
  source?: string | null;
}

export type DatabookUpdate = Partial<DatabookInsert>;

export interface Employee {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  databook_id: string | null;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  created_at: string;
  databooks?: { number: string } | null;
}

// Notificacoes geradas localmente (sem tabela no banco por enquanto)
export type NotificationType = 'new' | 'overdue' | 'stale' | 'change';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  databook_id?: string;
  databook_number?: string;
  timestamp: string;
  read: boolean;
}

// Stats de responsavel para o painel lateral
export interface ResponsibleStats {
  responsible_name: string;
  total: number;
  em_andamento: number;
  encerrado: number;
  novo: number;
  avg_days: number | null;
  recent: Databook[];
}

// Filtros usados na listagem
export interface DatabookFilters {
  search?: string;
  general_status?: GeneralStatus | '';
  priority?: Priority | '';
  fiscal_year?: string;
  responsible_name?: string;
  client_name?: string;
  month?: string;  // formato MM
  year?: string;   // formato YYYY
  sort_by?: keyof Databook;
  sort_direction?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// Dados para os cards do dashboard
export interface DashboardStats {
  total: number;
  novo: number;
  em_andamento: number;
  encerrado: number;
  total_mes_atual: number;
  prioridade_alta: number;
  by_fiscal_year: { fiscal_year: string; count: number }[];
  by_responsible: { responsible_name: string; count: number }[];
}

// Resposta paginada da listagem
export interface PaginatedDatabooks {
  data: Databook[];
  total: number;
  page: number;
  page_size: number;
}
