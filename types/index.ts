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

// ── Email Inbound ──────────────────────────────────────────────────────────────

/** Remetente autorizado na whitelist de inbound email */
export interface EmailSender {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  created_at: string;
}

/**
 * Status legado do webhook — mantido para compatibilidade com registros antigos.
 * Novos registros ainda gravam este campo, mas o fluxo usa queue_status.
 */
export type EmailImportStatus = 'success' | 'duplicate' | 'blocked' | 'error';

/**
 * Status da fila de aprovação.
 * - pending:   recebido, aguardando revisão do operador
 * - approved:  operador clicou "Adicionar ao Sistema" — databook criado
 * - duplicate: número já existe no sistema — nenhuma ação necessária
 * - blocked:   remetente não autorizado — nenhuma ação disponível
 * - error:     falha técnica — verificar error_message
 */
export type EmailQueueStatus = 'pending' | 'approved' | 'duplicate' | 'blocked' | 'error';

/** Log de cada tentativa de importação via email inbound */
export interface EmailImportLog {
  id: string;
  received_at: string;
  /** Email do remetente (extraído do campo from, sem o nome) */
  from_address: string;
  /** Nome do remetente, quando disponível no campo "from" do payload */
  from_name: string | null;
  /** Destinatário do email */
  to_address: string | null;
  subject: string | null;
  /** Corpo do email em texto puro */
  raw_body: string | null;
  /** Corpo do email em HTML (salvo quando disponível no payload) */
  raw_html: string | null;
  /** Campos estruturados extraídos do corpo (ex.: { client_name, responsible_name }) */
  extracted_fields: Record<string, string> | null;
  /** Status legado do webhook */
  status: EmailImportStatus;
  /** Status da fila de aprovação (campo principal para o fluxo de revisão) */
  queue_status: EmailQueueStatus;
  error_message: string | null;
  databook_number: string | null;
  databook_id: string | null;
}

/** Contagens para o dashboard de emails */
export interface EmailLogStats {
  /** Total de emails recebidos hoje (pelo received_at) */
  today: number;
  /** Aguardando revisão */
  pending: number;
  /** Criados no sistema */
  approved: number;
  /** Bloqueados (remetente não autorizado) */
  blocked: number;
}

// ── Histórico de Atividades (estrutura para expansão futura) ──────────────────

/**
 * Tipos de evento que serão registrados no histórico do Databook.
 * Mapeiam para a coluna `action` da tabela audit_logs.
 *
 * Eventos já suportados: 'created' | 'updated' | 'deleted'
 * Eventos futuros planejados (adicionar ao CHECK constraint do banco):
 *   - 'email_received'    → criado via email inbound
 *   - 'responsible_changed' → responsável alterado
 *   - 'file_uploaded'    → arquivo enviado
 *   - 'status_changed'   → status alterado
 *   - 'comment_added'    → comentário inserido (não implementado ainda)
 */
export type ActivityEventType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'email_received'
  | 'responsible_changed'
  | 'file_uploaded'
  | 'status_changed'
  | 'comment_added';

// ── Anexos de Databook (estrutura preparada — upload não implementado ainda) ───

/**
 * Arquivo vinculado a um Databook.
 * A tabela databook_attachments será criada em uma futura fase quando
 * o processamento automático de anexos de email for implementado.
 *
 * Campos planejados:
 * - databook_id   → FK para databooks
 * - email_log_id  → FK para email_import_logs (origem do anexo, se vier por email)
 * - filename      → nome original do arquivo
 * - content_type  → MIME type (application/pdf, image/dwg, etc.)
 * - size_bytes    → tamanho em bytes
 * - storage_path  → caminho no Supabase Storage
 * - source        → 'email' | 'manual'
 */
export interface DatabookAttachment {
  id: string;
  databook_id: string;
  email_log_id: string | null;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  source: 'email' | 'manual';
  created_at: string;
}
