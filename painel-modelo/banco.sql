-- =============================================================
-- BANCO DO MEU PAINEL TIKTOK SHOP (curso Shopflow)
-- Cole este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema: não apaga nada.
--
-- Regra de ouro: cada usuário só enxerga e só mexe nas linhas dele.
-- Todas as tabelas têm user_id e a trava (RLS) "user_id = auth.uid()".
-- Ninguém deslogado lê nada.
-- =============================================================

-- 1. PERFIL: seu nome, seu @, suas metas e a aparência do painel
create table if not exists public.perfis (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  email          text,
  nome           text check (char_length(nome) <= 120),
  whatsapp       text check (char_length(whatsapp) <= 20),
  tiktok         text check (char_length(tiktok) <= 60),
  aceite_avisos  boolean not null default false,
  meta_videos    integer not null default 15 check (meta_videos between 1 and 60),
  meta_comissao  numeric(12, 2),
  criado_em      timestamptz not null default now()
);
-- Meta do mês em vendas (GMV) e a aparência que o aluno escolheu
alter table public.perfis add column if not exists meta_gmv numeric(12, 2);
alter table public.perfis add column if not exists estilo text not null default 'classico' check (estilo in ('classico', 'grafico', 'minimal'));
alter table public.perfis add column if not exists cor text not null default 'cafe' check (cor in ('cafe', 'grafite', 'rosa', 'oliva', 'azul'));
-- Como você quer ser chamado e os primeiros passos marcados (modo Começando)
alter table public.perfis add column if not exists apelido text check (char_length(apelido) <= 40);
alter table public.perfis add column if not exists passos jsonb not null default '{}'::jsonb;
-- A sua chave da Supadata (transcrição da aba Criar). Só você lê: a trava do perfil vale para ela também.
alter table public.perfis add column if not exists supadata_key text check (char_length(supadata_key) <= 200);
alter table public.perfis enable row level security;
drop policy if exists "aluno le o proprio perfil" on public.perfis;
create policy "aluno le o proprio perfil" on public.perfis
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "aluno edita o proprio perfil" on public.perfis;
create policy "aluno edita o proprio perfil" on public.perfis
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "aluno cria o proprio perfil" on public.perfis;
create policy "aluno cria o proprio perfil" on public.perfis
  for insert to authenticated with check (user_id = auth.uid());

-- O perfil nasce sozinho quando a pessoa cria a conta, com os dados do cadastro
create or replace function public.novo_aluno() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, email, nome, whatsapp, tiktok, aceite_avisos)
  values (
    new.id, new.email,
    left(new.raw_user_meta_data ->> 'nome', 120),
    left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), '\D', '', 'g'), 20),
    left(new.raw_user_meta_data ->> 'tiktok', 60),
    coalesce((new.raw_user_meta_data ->> 'aceite')::boolean, false)
  )
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_aluno on auth.users;
create trigger ao_criar_aluno after insert on auth.users
  for each row execute function public.novo_aluno();

-- 2. PEDIDOS: o arquivo "Pedidos de afiliados" exportado do TikTok Shop
create table if not exists public.pedidos (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pedido_id      text not null check (char_length(pedido_id) <= 40),
  sku_id         text not null default '' check (char_length(sku_id) <= 40),
  produto_id     text check (char_length(produto_id) <= 40),
  produto        text check (char_length(produto) <= 400),
  loja           text check (char_length(loja) <= 200),
  itens          integer not null default 0,
  reembolsados   integer not null default 0,
  status         text check (char_length(status) <= 40),
  tipo_conteudo  text check (char_length(tipo_conteudo) <= 40),
  conteudo_id    text check (char_length(conteudo_id) <= 40),
  gmv            numeric(12, 2) not null default 0,
  comissao_est   numeric(12, 2) not null default 0,
  comissao_real  numeric(12, 2),
  data           timestamp not null,
  liquidado_em   timestamp,
  atualizado_em  timestamptz not null default now(),
  primary key (user_id, pedido_id, sku_id)
);
create index if not exists pedidos_user_data on public.pedidos (user_id, data);

-- 3. PRODUTOS: categoria e apelido que o aluno escolhe pra cada anúncio
create table if not exists public.produtos (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produto_id  text not null check (char_length(produto_id) <= 40),
  apelido     text check (char_length(apelido) <= 120),
  categoria   text check (categoria in ('tech', 'casa', 'beleza', 'moda', 'fitness', 'infantil', 'outros')),
  primary key (user_id, produto_id)
);

-- 4. IMPORTAÇÕES: um registro por arquivo enviado
create table if not exists public.importacoes (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  arquivo       text check (char_length(arquivo) <= 200),
  periodo_ini   timestamp,
  periodo_fim   timestamp,
  linhas        integer not null default 0,
  novas         integer not null default 0,
  atualizadas   integer not null default 0,
  importado_em  timestamptz not null default now()
);
create index if not exists importacoes_user on public.importacoes (user_id, importado_em desc);

-- 5. VÍDEOS: o plano de cada dia
create table if not exists public.videos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data       date not null,
  hora       time,
  produto    text not null check (char_length(produto) between 1 and 300),
  bloco      text check (bloco in ('principal', 'com_vendas', 'teste')),
  status     text not null default 'rascunho' check (status in ('rascunho', 'agendado', 'postado')),
  criado_em  timestamptz not null default now()
);
create index if not exists videos_user_data on public.videos (user_id, data);

-- 6. AMOSTRAS: produtos recebidos pra testar
create table if not exists public.amostras (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produto       text not null check (char_length(produto) between 1 and 300),
  recebida_em   date,
  prazo_postar  date,
  custo         numeric(12, 2) not null default 0,
  decisao       text not null default 'testando' check (decisao in ('testando', 'escalar', 'monitorar', 'pausar')),
  obs           text check (char_length(obs) <= 500),
  criado_em     timestamptz not null default now()
);

-- 7. REFERÊNCIAS: vídeos que deram certo, para modelar a copy (aba Criar)
create table if not exists public.referencias (
  id         text primary key check (char_length(id) <= 40),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  link       text check (char_length(link) <= 400),
  autor      text check (char_length(autor) <= 120),
  texto      text check (char_length(texto) <= 6000),
  copy       text check (char_length(copy) <= 20000),
  criado_em  timestamptz not null default now()
);
create index if not exists referencias_user on public.referencias (user_id, criado_em desc);

-- Segurança igual em todas: o aluno só vê e mexe no que é dele
do $$
declare t text;
begin
  foreach t in array array['pedidos', 'produtos', 'importacoes', 'videos', 'amostras', 'referencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "so o dono" on public.%I', t);
    execute format('create policy "so o dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Libera as tabelas para o painel logado (vale mesmo se "Grant API access to new tables" ficou desmarcado).
-- Quem garante que cada um só vê o que é seu são as travas (RLS) acima.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.perfis, public.pedidos, public.produtos, public.importacoes, public.videos, public.amostras, public.referencias to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.perfis, public.pedidos, public.produtos, public.importacoes, public.videos, public.amostras, public.referencias from anon;

-- Se você criou o seu usuário ANTES de rodar este arquivo, o perfil nasce aqui
insert into public.perfis (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;
