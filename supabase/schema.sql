-- ============================================================
-- Schema NETZSCH Databooks
-- Executar no SQL Editor do Supabase (Project > SQL Editor)
-- ============================================================

-- ---- Tabela de funcionarios/responsaveis ----
CREATE TABLE IF NOT EXISTS employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Tabela principal de databooks ----
CREATE TABLE IF NOT EXISTS databooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number           TEXT NOT NULL UNIQUE,
  entry_date       DATE,
  client_name      TEXT,
  technical_status TEXT,
  company_name     TEXT,
  responsible_name TEXT,
  general_status   TEXT NOT NULL DEFAULT 'Novo'
                     CHECK (general_status IN ('Novo', 'Em andamento', 'Encerrado')),
  delivery_date    DATE,
  priority         TEXT NOT NULL DEFAULT 'Normal'
                     CHECK (priority IN ('Alta', 'Normal', 'Baixa')),
  type             TEXT,
  fiscal_year      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_databooks_status   ON databooks (general_status);
CREATE INDEX IF NOT EXISTS idx_databooks_priority ON databooks (priority);
CREATE INDEX IF NOT EXISTS idx_databooks_fy       ON databooks (fiscal_year);
CREATE INDEX IF NOT EXISTS idx_databooks_resp     ON databooks (responsible_name);
CREATE INDEX IF NOT EXISTS idx_databooks_date     ON databooks (entry_date);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tornar a criacao do trigger set_updated_at idempotente
DROP TRIGGER IF EXISTS set_updated_at ON databooks;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON databooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- Tabela de auditoria ----
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  databook_id UUID REFERENCES databooks(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  field_name  TEXT,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_databook ON audit_logs (databook_id);
CREATE INDEX IF NOT EXISTS idx_audit_date     ON audit_logs (created_at);

-- ============================================================
-- Row Level Security (RLS)
-- Apenas usuarios autenticados pelo Supabase Auth podem acessar
-- ============================================================

ALTER TABLE employees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE databooks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies para employees (idempotentes via DROP IF EXISTS)
DROP POLICY IF EXISTS "employees_authenticated_read" ON employees;
DROP POLICY IF EXISTS "employees_authenticated_write" ON employees;
DROP POLICY IF EXISTS "employees_authenticated_insert" ON employees;
DROP POLICY IF EXISTS "employees_authenticated_update" ON employees;
DROP POLICY IF EXISTS "employees_authenticated_delete" ON employees;

CREATE POLICY "employees_authenticated_read"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "employees_authenticated_insert"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "employees_authenticated_update"
  ON employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "employees_authenticated_delete"
  ON employees FOR DELETE
  TO authenticated
  USING (true);

-- Policies para databooks (idempotentes via DROP IF EXISTS)
DROP POLICY IF EXISTS "databooks_authenticated_read" ON databooks;
DROP POLICY IF EXISTS "databooks_authenticated_write" ON databooks;
DROP POLICY IF EXISTS "databooks_authenticated_insert" ON databooks;
DROP POLICY IF EXISTS "databooks_authenticated_update" ON databooks;
DROP POLICY IF EXISTS "databooks_authenticated_delete" ON databooks;

CREATE POLICY "databooks_authenticated_read"
  ON databooks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "databooks_authenticated_insert"
  ON databooks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "databooks_authenticated_update"
  ON databooks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "databooks_authenticated_delete"
  ON databooks FOR DELETE
  TO authenticated
  USING (true);

-- audit_logs: leitura autenticada; escrita apenas via service_role (backend)
-- O cliente nunca escreve diretamente nesta tabela
DROP POLICY IF EXISTS "audit_logs_authenticated_read" ON audit_logs;
CREATE POLICY "audit_logs_authenticated_read"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

-- service_role bypassa RLS automaticamente — nao precisa de policy de escrita
-- A insercao em audit_logs e feita pelo backend com createAdminClient()

-- ============================================================
-- Dados iniciais
-- ============================================================

-- Nenhum dado inicial.
-- Os responsáveis serão cadastrados pelo próprio sistema.

-- ============================================================
-- Migration v2 — Email Inbound: Fila de Aprovação
-- Executar APÓS o schema inicial caso a tabela já exista.
-- ============================================================

-- ---- Novas colunas em email_import_logs ----
-- (idempotentes via ADD COLUMN IF NOT EXISTS)
ALTER TABLE email_import_logs
  ADD COLUMN IF NOT EXISTS from_name        TEXT,
  ADD COLUMN IF NOT EXISTS to_address       TEXT,
  ADD COLUMN IF NOT EXISTS raw_html         TEXT,
  ADD COLUMN IF NOT EXISTS extracted_fields JSONB,
  ADD COLUMN IF NOT EXISTS queue_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (queue_status IN ('pending', 'approved', 'duplicate', 'blocked', 'error'));

-- Índice para filtros de fila
CREATE INDEX IF NOT EXISTS idx_email_logs_queue_status ON email_import_logs (queue_status);
CREATE INDEX IF NOT EXISTS idx_email_logs_received_at  ON email_import_logs (received_at);

-- Migrar registros existentes: mapear status legado para queue_status
-- success   → approved  (já criou databook automaticamente)
-- duplicate → duplicate
-- blocked   → blocked
-- error     → error
-- (queue_status tem DEFAULT 'pending', então registros sem status legado ficam pending)
UPDATE email_import_logs
SET queue_status = CASE status
  WHEN 'success'   THEN 'approved'
  WHEN 'duplicate' THEN 'duplicate'
  WHEN 'blocked'   THEN 'blocked'
  WHEN 'error'     THEN 'error'
  ELSE 'pending'
END
WHERE queue_status = 'pending';  -- só afeta registros ainda sem queue_status definido

-- ---- RLS para email_import_logs ----
ALTER TABLE email_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_authenticated_read"   ON email_import_logs;
DROP POLICY IF EXISTS "email_logs_authenticated_delete" ON email_import_logs;
DROP POLICY IF EXISTS "email_logs_authenticated_update" ON email_import_logs;

-- Leitura: qualquer usuário autenticado pode ver os logs
CREATE POLICY "email_logs_authenticated_read"
  ON email_import_logs FOR SELECT
  TO authenticated
  USING (true);

-- Exclusão: usuários autenticados podem remover registros de log
CREATE POLICY "email_logs_authenticated_delete"
  ON email_import_logs FOR DELETE
  TO authenticated
  USING (true);

-- Atualização: usuários autenticados podem atualizar queue_status/databook_id (via approve)
CREATE POLICY "email_logs_authenticated_update"
  ON email_import_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserção: service_role bypassa RLS automaticamente (webhook usa createServiceClient)
-- Nenhuma policy de INSERT necessária para usuários autenticados.

-- ============================================================
-- Preparação para Anexos (fase futura — tabela NÃO criada agora)
-- ============================================================
--
-- Quando implementado, executar:
--
-- CREATE TABLE IF NOT EXISTS databook_attachments (
--   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   databook_id     UUID NOT NULL REFERENCES databooks(id) ON DELETE CASCADE,
--   email_log_id    UUID REFERENCES email_import_logs(id) ON DELETE SET NULL,
--   filename        TEXT NOT NULL,
--   content_type    TEXT,
--   size_bytes      BIGINT,
--   storage_path    TEXT,   -- caminho no Supabase Storage
--   source          TEXT NOT NULL DEFAULT 'manual', -- 'email' | 'manual'
--   created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS idx_attachments_databook ON databook_attachments(databook_id);
-- ALTER TABLE databook_attachments ENABLE ROW LEVEL SECURITY;
-- (+ policies de RLS conforme padrão do projeto)

