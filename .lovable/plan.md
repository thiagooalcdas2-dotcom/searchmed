## Plano — Credenciais no painel admin

Objetivo: nas abas **Ativas** e **Bloqueadas** (Sessões & Acessos), cada linha passa a mostrar o **e-mail (login)**, a **senha atual** (mascarada, com botão "mostrar") e um botão discreto para **redefinir senha** — tudo sem poluir a interface.

### Como senhas serão tratadas (importante)
O Supabase armazena senhas só em hash bcrypt — é **impossível recuperar a senha original** de contas já existentes. Para viabilizar o "ver senha atual":

- Toda conta **criada pelo painel admin** (agora e no futuro) terá a senha salva em uma nova tabela `admin_credentials` (texto plano, acessível só por admin via RLS).
- Ao **redefinir senha** pelo painel, a nova senha é aplicada no Auth e atualizada na `admin_credentials` — então continua visível.
- Contas que **já existem hoje** (criadas antes desta mudança) não terão senha visível até você redefinir uma vez — a linha mostrará "— (redefinir para visualizar)".

Você confirmou que isso é aceitável; fica registrado que senhas em texto plano no banco são um trade-off consciente de conveniência.

### Mudanças no banco (migration)
1. Nova tabela `public.admin_credentials`:
   - `user_id uuid PK` (referência lógica a auth.users)
   - `email text not null`
   - `password text not null`
   - `updated_at timestamptz default now()`
2. RLS: somente `has_role(auth.uid(), 'admin')` pode SELECT/INSERT/UPDATE/DELETE. Nenhum acesso para `student`.
3. Trigger `touch_updated_at` reaproveitado.

### Edge functions
1. **`admin-create-user`** (editar): após criar a conta, `upsert` em `admin_credentials` com `{user_id, email, password}`.
2. **`admin-reset-password`** (nova): recebe `{user_id, new_password}`, valida que quem chama é admin, chama `auth.admin.updateUserById(user_id, { password })` e dá `upsert` em `admin_credentials`. Bloqueia redefinir senha de outro admin.
3. **`admin-list-emails`** (nova, opcional mas recomendada): retorna `{user_id: email}` para todos os usuários via `auth.admin.listUsers()`, só para admin. Isso cobre o login dos usuários antigos que não estão em `admin_credentials`.

### UI — `SessionsPanel.tsx`
Design enxuto, sem poluir:

- Nova coluna **"Credenciais"** nas abas **Ativas** e **Bloqueadas**, no formato compacto:
  ```
  joao12@gmail.com
  ••••••••  [olho]  [↻]
  ```
  - `[olho]` alterna mostrar/ocultar a senha em texto.
  - `[↻]` abre um pequeno dialog "Redefinir senha" com um único campo (nova senha, mín. 6). Após salvar, a linha já reflete a nova senha.
- Se não houver senha salva (conta antiga): mostra `— redefinir para visualizar` + botão `↻`.
- Tudo carregado junto do `load()` atual (query extra em `admin_credentials` + invoke `admin-list-emails`).
- Admin vê seu próprio e-mail, mas **sem** botão de redefinir/mostrar senha (protegido).
- Aba **Histórico** permanece como está (não adiciona credenciais ali, para manter o foco em IP/dispositivo).

### Técnico — arquivos afetados
- `supabase/migrations/<novo>.sql` — cria `admin_credentials` + RLS.
- `supabase/functions/admin-create-user/index.ts` — grava credencial após criar.
- `supabase/functions/admin-reset-password/index.ts` — nova função.
- `supabase/functions/admin-list-emails/index.ts` — nova função (fallback p/ contas antigas).
- `src/components/admin/SessionsPanel.tsx` — nova coluna compacta + dialog de reset + estado `showPw` por linha.

### O que não será feito
- Não expor senhas na aba Histórico.
- Não permitir redefinir/bloquear a conta admin.
- Não tentar "recuperar" senhas antigas (impossível tecnicamente).
