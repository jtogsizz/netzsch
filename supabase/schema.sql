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
