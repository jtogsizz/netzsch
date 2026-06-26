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
