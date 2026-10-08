-- =============================================================
-- BANCO DE DADOS DO PORTFÓLIO E DO ADMIN DO RYAN ALVES
--
-- Onde colar: Supabase > seu projeto > SQL Editor (ícone de terminal
-- no menu da esquerda) > New query. Cole TUDO e clique em Run.
--
-- Pode rodar mais de uma vez sem estragar nada: as tabelas só são
-- criadas se ainda não existirem, as regras são recriadas e as linhas
-- de exemplo só entram em tabela vazia.
-- =============================================================


-- -------------------------------------------------------------
-- 1. QUEM É O DONO
-- Esta função responde "sim" só quando quem está logado é o Ryan.
-- Todas as regras de segurança lá embaixo perguntam para ela.
-- Para trocar o e-mail de login um dia, troque só aqui.
-- -------------------------------------------------------------
create or replace function public.eh_admin()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'heyryan.ugc@gmail.com', false);
$$;


-- -------------------------------------------------------------
-- 2. TABELA VIDEOS
-- Os vídeos que aparecem em "Trabalhos por nicho" no portfólio.
-- link: endereço do vídeo (arquivo .mp4 do site, Reels, TikTok...)
-- capa: imagem de capa (opcional)
-- destaque: o número de resultado, ex: "2,4M views"
-- ordem: posição na lista (menor aparece primeiro)
-- visivel: se aparece ou não no site
-- exemplo: marca as linhas de exemplo, para você apagar depois
-- -------------------------------------------------------------
create table if not exists public.videos (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  titulo     text not null,
  link       text,
  capa       text,
  nicho      text check (nicho in ('beleza', 'moda', 'fitness', 'tech')),
  formato    text,
  marca      text,
  destaque   text,
  ordem      integer not null default 0,
  visivel    boolean not null default true,
  exemplo    boolean not null default false
);


-- -------------------------------------------------------------
-- 3. TABELA MARCAS
-- Sua base de contatos de empresas. O formulário do site também
-- grava aqui, sempre como "lead".
-- -------------------------------------------------------------
create table if not exists public.marcas (
  id              bigint generated always as identity primary key,
  criado_em       timestamptz not null default now(),
  nome            text not null check (char_length(nome) between 1 and 150),
  instagram       text check (char_length(instagram) <= 100),
  email           text check (char_length(email) <= 200),
  telefone        text check (char_length(telefone) <= 40),
  situacao        text not null default 'lead'
                  check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs             text check (char_length(obs) <= 3000),
  ultimo_contato  date,
  exemplo         boolean not null default false
);


-- -------------------------------------------------------------
-- 4. TABELA CALENDARIO
-- O que você tem para gravar, editar e postar, dia a dia.
-- -------------------------------------------------------------
create table if not exists public.calendario (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  titulo     text not null,
  marca      text,
  tipo       text not null default 'gravar' check (tipo in ('gravar', 'editar', 'postar')),
  data       date not null,
  status     text not null default 'a fazer' check (status in ('a fazer', 'feito')),
  exemplo    boolean not null default false
);


-- -------------------------------------------------------------
-- 5. TABELA CAMPANHAS
-- Seus trabalhos fechados. O prazo aparece sozinho no calendário.
-- qtd: quantos vídeos | valor: valor total da campanha
-- -------------------------------------------------------------
create table if not exists public.campanhas (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  campanha   text not null,
  cliente    text,
  tipo       text not null default 'Conteúdo' check (tipo in ('Conteúdo', 'Publicidade')),
  status     text not null default 'Briefing'
             check (status in ('Briefing', 'Roteiro', 'Aprovação Roteiro', 'Gravação', 'Edição', 'Aprovado', 'Entregue')),
  qtd        integer not null default 1 check (qtd >= 0),
  valor      numeric(12, 2) not null default 0 check (valor >= 0),
  prazo      date,
  pagamento  text not null default 'pendente' check (pagamento in ('pendente', 'pago')),
  ativa      boolean not null default true,
  favorita   boolean not null default false,
  exemplo    boolean not null default false
);


-- -------------------------------------------------------------
-- 6. TABELA MARCADOS
-- O que você já marcou no checklist. Cada item tem uma chave de
-- texto, ex: "checklist:capa:0".
-- -------------------------------------------------------------
create table if not exists public.marcados (
  chave          text primary key,
  marcado        boolean not null default true,
  atualizado_em  timestamptz not null default now()
);


-- -------------------------------------------------------------
-- 7. TABELA VISITAS
-- Um registro por visita ao portfólio. Não guarda nada pessoal:
-- só quando foi, qual página e de onde a pessoa veio.
-- -------------------------------------------------------------
create table if not exists public.visitas (
  id      bigint generated always as identity primary key,
  data    timestamptz not null default now(),
  pagina  text check (char_length(pagina) <= 200),
  origem  text check (char_length(origem) <= 200)
);
create index if not exists visitas_data_idx on public.visitas (data);


-- -------------------------------------------------------------
-- 8. A TRANCA (RLS, Row Level Security)
-- Com o RLS ligado, o banco bloqueia TUDO por padrão. Só passa o
-- que uma regra (policy) abaixo liberar.
-- -------------------------------------------------------------
alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;


-- 8.1 Você (logado com o seu e-mail) pode ler, criar, editar e
--     apagar tudo, em todas as tabelas.
drop policy if exists "dono faz tudo" on public.videos;
create policy "dono faz tudo" on public.videos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "dono faz tudo" on public.marcas;
create policy "dono faz tudo" on public.marcas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "dono faz tudo" on public.calendario;
create policy "dono faz tudo" on public.calendario
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "dono faz tudo" on public.campanhas;
create policy "dono faz tudo" on public.campanhas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "dono faz tudo" on public.marcados;
create policy "dono faz tudo" on public.marcados
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "dono faz tudo" on public.visitas;
create policy "dono faz tudo" on public.visitas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- 8.2 EXCEÇÃO 1: o formulário do site pode CRIAR uma marca, e só
--     como "lead". Ele não consegue ler, editar nem apagar nada.
drop policy if exists "formulario do site cria lead" on public.marcas;
create policy "formulario do site cria lead" on public.marcas
  for insert to anon
  with check (situacao = 'lead' and exemplo = false);


-- 8.3 EXCEÇÃO 2: o site pode CRIAR um registro de visita, sempre
--     com a data de agora (ninguém consegue inventar visita antiga).
drop policy if exists "site registra visita" on public.visitas;
create policy "site registra visita" on public.visitas
  for insert to anon
  with check (data between now() - interval '5 minutes' and now() + interval '5 minutes');


-- 8.4 EXCEÇÃO 3 (necessária para o site mostrar os trabalhos):
--     qualquer pessoa pode LER os vídeos marcados como visíveis.
--     São os mesmos vídeos que já aparecem no portfólio público.
--     Vídeo escondido (olhinho fechado) continua invisível.
drop policy if exists "site le videos visiveis" on public.videos;
create policy "site le videos visiveis" on public.videos
  for select to anon
  using (visivel = true);


-- -------------------------------------------------------------
-- 9. PRIMEIRAS LINHAS
-- Videos: o seu vídeo real da Zapay, que já está no site.
-- Marcas, calendário e campanhas: UMA linha de exemplo cada,
-- marcada como exemplo, só para você ver o formato e apagar.
-- Marcados e visitas começam vazias (zero mesmo).
-- -------------------------------------------------------------
insert into public.videos (titulo, link, capa, nicho, formato, marca, destaque, ordem, visivel)
select 'Campanha Zapay', 'videos/zapay-tech.mp4', 'videos/zapay-tech.jpg', 'tech', 'Vídeo UGC', 'Zapay', null, 1, true
where not exists (select 1 from public.videos);

insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato, exemplo)
select 'EXEMPLO Marca de teste', '@marcadeteste', 'contato@marcadeteste.com.br', '(00) 00000-0000',
       'lead', 'Linha de exemplo para você ver o formato. Pode apagar.', current_date, true
where not exists (select 1 from public.marcas);

insert into public.calendario (titulo, marca, tipo, data, status, exemplo)
select 'EXEMPLO Gravar vídeo de teste', 'Marca de teste', 'gravar', current_date + 2, 'a fazer', true
where not exists (select 1 from public.calendario);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita, exemplo)
select 'EXEMPLO Campanha de teste', 'Marca de teste', 'Conteúdo', 'Briefing', 1, 0, current_date + 7, 'pendente', true, false, true
where not exists (select 1 from public.campanhas);


-- -------------------------------------------------------------
-- 10. ESPAÇO DE ARQUIVOS (Storage) PARA OS VÍDEOS
-- Os vídeos e capas que você envia pelo admin ficam guardados aqui,
-- num espaço chamado "portfolio".
-- public = true: o site consegue EXIBIR os arquivos (só exibir).
-- Limite de 50 MB por arquivo (o máximo do plano grátis) e só
-- formatos de vídeo e imagem.
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Só você (logado) pode enviar, trocar, ver a lista e apagar arquivos.
-- Ninguém de fora consegue enviar nem apagar nada.
drop policy if exists "dono envia arquivos" on storage.objects;
create policy "dono envia arquivos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio' and public.eh_admin());

drop policy if exists "dono troca arquivos" on storage.objects;
create policy "dono troca arquivos" on storage.objects
  for update to authenticated
  using (bucket_id = 'portfolio' and public.eh_admin())
  with check (bucket_id = 'portfolio' and public.eh_admin());

drop policy if exists "dono ve arquivos" on storage.objects;
create policy "dono ve arquivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'portfolio' and public.eh_admin());

drop policy if exists "dono apaga arquivos" on storage.objects;
create policy "dono apaga arquivos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio' and public.eh_admin());
