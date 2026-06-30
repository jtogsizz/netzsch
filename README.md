# NETZSCH Databooks — Sistema Interno de Gerenciamento

Sistema web interno para gerenciamento de Databooks de Pecas da NETZSCH.
Substituicao do controle por Excel/Trello por uma aplicacao segura, auditavel e responsiva.

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Estilo**: Tailwind CSS + CSS customizado
- **Banco de dados**: Supabase (PostgreSQL + Auth + RLS)
- **Graficos**: Recharts
- **Exportacao**: SheetJS (xlsx)
- **Deploy**: Vercel

---

## Configuracao Inicial

### 1. Supabase — Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. No menu lateral, va em **SQL Editor** e execute o conteudo completo de `supabase/schema.sql`.
   - Isso cria as tabelas, indices, RLS policies e o trigger de `updated_at`.

### 2. Supabase — Criar o usuario de login

1. No painel do Supabase, va em **Authentication > Users > Add User**.
2. Preencha:
   - **Email**: `sistema@netzsch.internal` (ou o email real da empresa)
   - **Password**: `netzsch@2026`
   - Marque **Auto Confirm User** para nao precisar de verificacao de email.
3. Salve. Este sera o unico usuario de acesso inicial.

> Para adicionar mais usuarios no futuro, repita este processo ou implemente um fluxo de convite por email.

### 3. Variaveis de ambiente

Copie o arquivo de exemplo e preencha com os valores do seu projeto Supabase:

```bash
cp .env.example .env.local
```

Edite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # Project Settings > API > Publishable key
SUPABASE_SECRET_KEY=eyJ...                    # Project Settings > API > Secret key
```

**IMPORTANTE**: A `SUPABASE_SECRET_KEY` e usada apenas em API Routes (server-side).
Ela **nunca** e exposta ao browser. Nao a compartilhe nem commite no repositorio.

### 4. Instalar dependencias e rodar localmente

```bash
npm install
npm run dev
```

Acesse em: [http://localhost:3000](http://localhost:3000)

---

## Login

- **Email**: `sistema@netzsch.internal` (ou o email cadastrado no passo 2)
- **Senha**: `netzsch@2026`

A senha nao esta no codigo-fonte. A autenticacao e feita 100% via Supabase Auth no servidor.

---

## Estrutura de Pastas

```
app/
  (auth)/login/         Tela de login
  (dashboard)/          Paginas protegidas (dashboard, databooks, relatorios, responsaveis)
  api/                  API Routes server-side (databooks, employees, reports, export)
components/
  ui/                   Componentes base (Button, Input, Select, Modal, Badge...)
  layout/               Sidebar e Header
  dashboard/            StatCard e Charts
  databooks/            DatabookTable, DatabookForm, FilterBar
lib/
  supabase/             client.ts (browser) | server.ts (server-side)
  constants.ts          Status, prioridades, FY, cores
  utils.ts              Formatacao de datas, utilitarios gerais
types/                  Interfaces TypeScript (Databook, Employee, AuditLog...)
middleware.ts           Protecao de rotas via sessao Supabase
supabase/
  schema.sql            DDL completo com RLS
```

---

## Seguranca

- Todas as tabelas tem **RLS (Row Level Security)** ativo no Supabase.
- Apenas usuarios autenticados podem acessar dados.
- O middleware Next.js bloqueia qualquer rota privada sem sessao valida.
- A `service_role` key (que bypassa RLS) so existe em variaveis server-side.
- Audit log registra todas as alteracoes com campo antigo, campo novo, usuario e timestamp.
- Nenhuma senha ou chave secreta aparece no codigo do frontend.

---

## Deploy na Vercel

1. Conecte o repositorio Git na [Vercel](https://vercel.com).
2. Em **Settings > Environment Variables**, adicione as 3 variaveis do `.env.example`.
3. Deploy automatico via push para `main`.

> O dominio de deploy na Vercel precisa ser adicionado como **Allowed URL** no Supabase:
> Authentication > URL Configuration > Redirect URLs

---

## Funcionalidades

| Modulo | Descricao |
|---|---|
| Dashboard | Cards de totais + 4 graficos (status, FY, responsavel, mes) |
| Databooks | Listagem com filtros, busca, ordenacao e paginacao |
| Cadastro/Edicao | Formulario completo com validacao e verificacao de numero duplicado |
| Status rapido | Alteracao de status direto na tabela sem abrir o formulario |
| Relatorios | 5 graficos + tabela FY + exportacao Excel/CSV |
| Responsaveis | CRUD de funcionarios com status ativo/inativo |
| Audit log | Historico de cada alteracao por campo, com usuario e timestamp |

---

## Preparado para o futuro

- Estrutura da API `/api/databooks` suporta import em massa (endpoint a implementar).
- Tabela `employees` suporta multiplos usuarios com permissoes.
- `SUPABASE_SECRET_KEY` permite operacoes admin sem alterar RLS.

---

## Email Inbound (Resend)

Funcionarios podem criar databooks apenas **encaminhando um email** para:

```
databook@prenaarok.resend.app
```

O sistema valida o remetente, extrai o numero e cria o databook automaticamente.

---

### Como funciona

1. Funcionario autorizado encaminha email para `databook@prenaarok.resend.app`
2. A Resend recebe o email e dispara webhook para `/api/inbound-email` (com headers Svix)
3. O sistema verifica a assinatura criptografica (`RESEND_WEBHOOK_SECRET`)
4. O sistema chama `resend.emails.receiving.get(email_id)` para obter o corpo completo
5. Valida o remetente na whitelist de remetentes autorizados
6. Extrai o numero do databook do assunto/corpo
7. Grava o email em `email_import_logs` com `queue_status = pending`
8. O operador revisa em **Log de Emails** e clica **Adicionar ao Sistema** para criar o databook

> O databook NAO e criado automaticamente. O operador aprova manualmente.

---

### Dois modos de operacao da rota

A rota `/api/inbound-email` detecta automaticamente o modo pelo header recebido:

| Header presente | Modo | Autenticacao |
|---|---|---|
| `svix-id` | Webhook real Resend (producao) | Assinatura Svix + `RESEND_WEBHOOK_SECRET` |
| `Authorization: Bearer` | Teste manual (PowerShell/curl) | `INBOUND_EMAIL_SECRET` |

---

### Seguranca

| Camada | Mecanismo |
|--------|-----------|
| Webhook real | Assinatura HMAC Svix (`RESEND_WEBHOOK_SECRET`) — impossivel de forjar |
| Teste manual | `INBOUND_EMAIL_SECRET` no header `Authorization: Bearer` |
| Whitelist | Tabela `inbound_email_allowed_senders` — apenas emails com `active = true` |
| Deduplicacao | Numero ja existente → registra `duplicate`, nao cria databook |
| Retorno 200 | blocked/duplicate/error retornam 200 para evitar reenvios da Resend |

---

### Configuracao do webhook na Resend

1. Acesse **Resend Dashboard → Webhooks**
2. Clique **Add Endpoint**
3. Em **Endpoint URL**: `https://netzsch.vercel.app/api/inbound-email`
4. Em **Events**: marque apenas `email.received`
5. Salve e copie o **Signing Secret** (comeca com `whsec_`)
6. Configure `RESEND_WEBHOOK_SECRET=whsec_...` na Vercel (ver abaixo)

> **Importante:** Nao configure nenhum header customizado (Authorization) no webhook da Resend.
> A autenticacao e feita exclusivamente via assinatura Svix automatica.

---

### Variaveis de ambiente necessarias

```env
# Resend — webhook real (producao)
RESEND_WEBHOOK_SECRET=whsec_...    # Resend Dashboard → Webhooks → Signing Secret
RESEND_API_KEY=re_...              # Resend Dashboard → API Keys

# Teste manual (PowerShell/curl)
INBOUND_EMAIL_SECRET=<token>       # gerar com: openssl rand -hex 32

# Supabase (ja existentes)
SUPABASE_SECRET_KEY=<service_role_key>
```

### Configuracao das variaveis na Vercel

1. Acesse **Vercel Dashboard → seu projeto → Settings → Environment Variables**
2. Adicione:
   - `RESEND_WEBHOOK_SECRET` = valor do Signing Secret (whsec_...)
   - `RESEND_API_KEY` = sua API key da Resend (re_...)
3. Clique **Save** e faca **Redeploy** do projeto para aplicar

---

### Gerenciamento da whitelist

Acesse no sistema:
- **Sidebar → Email → Remetentes** (`/settings/senders`) — adicionar/editar/desativar
- **Sidebar → Email → Logs de Email** (`/settings/email-logs`) — fila de aprovacao e auditoria

---

### Status dos logs

| queue_status | Significado |
|---|---|
| `pending` | Email recebido, aguardando revisao do operador |
| `approved` | Operador clicou "Adicionar ao Sistema" — databook criado |
| `duplicate` | Numero ja existe no sistema — nenhuma acao necessaria |
| `blocked` | Remetente nao autorizado |
| `error` | Erro tecnico (sem numero no email, falha no banco, etc.) |

---

### Exemplos de emails aceitos

```
Assunto: Novo databook 500662
Corpo:   Segue solicitação 500662 recebida por email.
```

```
Assunto: HD 500662
Corpo:   (qualquer texto ou vazio)
```

```
Assunto: FW: Solicitação de peças
Corpo:   Segue databook 500662 para providências.
```

O numero pode aparecer em qualquer parte do email — o parser detecta automaticamente qualquer sequencia de 5 a 8 digitos.

---

### Teste manual via PowerShell

```powershell
# Teste com remetente autorizado e numero novo
Invoke-RestMethod `
  -Uri "https://netzsch.vercel.app/api/inbound-email" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer SEU_INBOUND_EMAIL_SECRET"
    "Content-Type"  = "application/json"
  } `
  -Body '{"from":"joao@empresa.com","to":"databook@prenaarok.resend.app","subject":"HD 500662","text":"Segue databook 500662"}'
```

Resposta esperada:
```json
{ "received": true, "action": "queued", "queue_status": "pending", "databook_number": "500662" }
```

### Teste manual via curl

```bash
curl -X POST https://netzsch.vercel.app/api/inbound-email \
  -H "Authorization: Bearer SEU_INBOUND_EMAIL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"from":"joao@empresa.com","to":"databook@prenaarok.resend.app","subject":"HD 500662","text":"Segue databook 500662"}'
```

---

### SQL Migration

Execute o bloco de migration no **SQL Editor** do Supabase.
O script completo esta em `supabase/schema.sql` (secao "Migration v2").



---

### Seguranca

| Camada | Mecanismo |
|--------|-----------|
| Token | `INBOUND_EMAIL_SECRET` no header `Authorization: Bearer` |
| Whitelist | Tabela `inbound_email_allowed_senders` — apenas emails com `active = true` |
| Deduplicacao | Se o numero ja existir, registra `duplicate` e nao cria nem altera |
| Retorno 200 | blocked/duplicate/error controlado retornam 200 para evitar reenvios do Resend |

---

### Configuracao do webhook Resend

1. Acesse **Resend → Inbound**
2. Configure o dominio `prenaarok.resend.app` (ja configurado)
3. Em **Webhook URL**: `https://SEU_PROJETO.vercel.app/api/inbound-email`
4. Em **Authorization header**: `Bearer <valor_do_INBOUND_EMAIL_SECRET>`

---

### Variaveis de ambiente necessarias

```env
INBOUND_EMAIL_SECRET=<token_secreto>  # gerar com: openssl rand -hex 32
SUPABASE_SECRET_KEY=<service_role_key> # ja existente
```

---

### Gerenciamento da whitelist

Acesse no sistema:
- **Sidebar → Email → Remetentes** (`/settings/senders`) — adicionar/editar/desativar
- **Sidebar → Email → Logs de Email** (`/settings/email-logs`) — auditoria completa

---

### Status dos logs

| Status | Significado |
|--------|-------------|
| `success` | Databook criado com sucesso |
| `duplicate` | Numero ja existe — nenhuma acao tomada |
| `blocked` | Remetente nao esta na whitelist ou esta inativo |
| `error` | Erro no processamento (sem numero, falha no banco, etc.) |

---

### Exemplos de emails aceitos

```
Assunto: Novo databook 500662
Corpo:   Segue solicitação 500662 recebida por email.
```

```
Assunto: HD 500662
Corpo:   (qualquer texto ou vazio)
```

```
Assunto: FW: Solicitação de peças
Corpo:   Segue databook 500662 para providências.
```

O numero pode aparecer em qualquer parte do email — o parser detecta automaticamente qualquer sequencia de 5 a 8 digitos.

---

### Defaults ao criar via email simples

| Campo | Valor padrao |
|-------|-------------|
| `general_status` | Novo |
| `priority` | Normal |
| `type` | Pecas |
| `entry_date` | Data atual |
| `source` | email |
| `notes` | "Criado automaticamente por email. Completar dados manualmente." |

---

### Testes via curl

**Criar databook (remetente autorizado e numero novo):**
```bash
curl -X POST https://SEU_PROJETO.vercel.app/api/inbound-email \
  -H "Authorization: Bearer SEU_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "funcionario@empresa.com",
    "to": "databook@prenaarok.resend.app",
    "subject": "Novo databook 500662",
    "text": "Segue solicitação 500662 recebida por email."
  }'
```

Resposta:
```json
{ "received": true, "action": "created", "databook_number": "500662", "databook_id": "<uuid>" }
```

**Remetente nao autorizado:**
```json
{ "received": true, "action": "blocked", "reason": "Remetente não encontrado na whitelist" }
```

**Numero ja existe (duplicata):**
```json
{ "received": true, "action": "duplicate", "databook_number": "500662", "databook_id": "<uuid>" }
```

---

### SQL Migration

Execute `sql_migration.sql` no **SQL Editor** do Supabase.
Cria: `inbound_email_allowed_senders`, atualiza constraint `email_import_logs.status`.

