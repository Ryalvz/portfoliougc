-- =============================================================
-- PROSPECÇÃO POR E-MAIL (aba Prospecção do admin)
-- Onde colar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Pode rodar mais de uma vez sem problema: nada é apagado.
-- =============================================================


-- -------------------------------------------------------------
-- 1. REGISTRO DE ENVIOS (email_envios)
-- Uma linha por e-mail mandado. Serve para saber quem recebeu,
-- quem deu erro, e para continuar um disparo que parou no meio
-- sem mandar duas vezes para a mesma pessoa.
--   status:   ok (saiu) ou erro (não saiu)
--   erro:     o motivo, quando deu errado
--   resend_id: o número que o Resend devolve
--   via:      resend (automático) ou gmail (modo rascunho, você
--             mandou pelo Gmail e marcou como enviada)
-- -------------------------------------------------------------
create table if not exists public.email_envios (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) <= 200),
  assunto    text not null check (char_length(assunto) <= 300),
  status     text not null check (status in ('ok', 'erro')),
  erro       text check (char_length(erro) <= 1000),
  resend_id  text,
  via        text not null default 'resend' check (via in ('resend', 'gmail')),
  marca_id   bigint,
  criado_em  timestamptz not null default now()
);
create index if not exists email_envios_email on public.email_envios (lower(email));
create index if not exists email_envios_assunto on public.email_envios (assunto);
alter table public.email_envios enable row level security;

drop policy if exists "dono faz tudo" on public.email_envios;
create policy "dono faz tudo" on public.email_envios
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 2. DESCADASTRO (email_optout)
-- Quem respondeu SAIR. Esses e-mails nunca mais recebem nada,
-- em nenhum disparo.
-- -------------------------------------------------------------
create table if not exists public.email_optout (
  email      text primary key check (char_length(email) <= 200),
  criado_em  timestamptz not null default now()
);
alter table public.email_optout enable row level security;

drop policy if exists "dono faz tudo" on public.email_optout;
create policy "dono faz tudo" on public.email_optout
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 3. DUAS COLUNAS NOVAS NA TABELA DE MARCAS (nada é apagado)
--   selecionada:      a caixinha da aba Marcas. Fica salva, então
--                     você marca hoje e dispara amanhã.
--   email_enviado_em: o dia em que a marca recebeu seu e-mail de
--                     apresentação.
-- -------------------------------------------------------------
alter table public.marcas add column if not exists selecionada boolean not null default false;
alter table public.marcas add column if not exists email_enviado_em date;
