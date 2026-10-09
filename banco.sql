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


-- -------------------------------------------------------------
-- 11. TABELA TRANSCRICOES
-- Vídeos de referência (YouTube, Instagram, TikTok) com o roteiro
-- transcrito, sempre em português, e as suas observações.
-- transcricao: o texto em português (o que você lê e edita)
-- categoria: tiktok_shop (TikTok Shop), organico (ideias para vídeos
-- orgânicos) ou publi (publi e UGC)
-- transcricao_original / idioma_original: o texto como veio, quando
-- precisou ser traduzido
-- Só você (logado) lê e mexe aqui. Ninguém de fora vê nada.
-- -------------------------------------------------------------
create table if not exists public.transcricoes (
  id                    bigint generated always as identity primary key,
  criado_em             timestamptz not null default now(),
  link                  text not null,
  plataforma            text check (plataforma in ('youtube', 'instagram', 'tiktok', 'outro')),
  categoria             text not null default 'organico'
                        check (categoria in ('tiktok_shop', 'organico', 'publi')),
  titulo                text,
  transcricao           text,
  transcricao_original  text,
  idioma_original       text,
  observacoes           text
);
alter table public.transcricoes enable row level security;

drop policy if exists "dono faz tudo" on public.transcricoes;
create policy "dono faz tudo" on public.transcricoes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 12. BANCO DE IDEIAS (etapas e a sua versão do roteiro)
-- status: em que etapa a ideia está
--   ideia   = Banco de ideias (não quero fazer agora)
--   agora   = Fazer agora
--   fazendo = Fazendo
--   feito   = Feito
-- minha_versao: o seu roteiro, adaptado da referência
-- O link deixa de ser obrigatório, para você anotar ideias sem vídeo.
-- -------------------------------------------------------------
alter table public.transcricoes add column if not exists status text not null default 'ideia';
alter table public.transcricoes add column if not exists minha_versao text;
alter table public.transcricoes alter column link drop not null;

alter table public.transcricoes drop constraint if exists transcricoes_status_check;
alter table public.transcricoes add constraint transcricoes_status_check
  check (status in ('ideia', 'agora', 'fazendo', 'feito'));


-- -------------------------------------------------------------
-- 13. TABELA CONTRATOS (financeiro)
-- Um contrato por linha, como na sua planilha de contabilidade.
-- O painel calcula sozinho: data prevista de pagamento (nota + prazo),
-- total recebido (parcela 1 + parcela 2), saldo e se está vencido.
-- mes / ano: mês de fechamento do trabalho
-- Os seus dados NÃO ficam neste arquivo (ele é público no GitHub):
-- eles foram importados direto no banco, que só você acessa.
-- -------------------------------------------------------------
create table if not exists public.contratos (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  cliente     text not null,
  tipo        text not null default 'UGC'
              check (tipo in ('UGC', 'Influencer', 'Freelance', 'Videomaker', 'Infoproduto/Comissão', 'Outro')),
  descricao   text,
  valor       numeric(12, 2) not null default 0 check (valor >= 0),
  mes         integer check (mes between 1 and 12),
  ano         integer not null default extract(year from now())::integer,
  data_nf     date,
  prazo_dias  integer check (prazo_dias >= 0),
  status      text not null default 'Aguardando briefing'
              check (status in ('Aguardando briefing', 'Aprovação de roteiro', 'Gravando', 'Editando',
                                'Enviado p/ aprovação', 'Entregue', 'Pago', 'Vencido', 'Cancelado')),
  parcela1    numeric(12, 2),
  data_p1     date,
  parcela2    numeric(12, 2),
  data_p2     date,
  obs         text
);
alter table public.contratos enable row level security;

drop policy if exists "dono faz tudo" on public.contratos;
create policy "dono faz tudo" on public.contratos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 14. CAMPANHAS E FINANCEIRO JUNTOS
-- A aba Campanhas passa a usar a mesma tabela contratos: você
-- cadastra uma vez e o trabalho aparece no Financeiro (dinheiro) e em
-- Campanhas (etapas de produção). Campos novos:
-- qtd: quantos vídeos | prazo_entrega: data de entrega para a marca
-- favorita: a estrela de destaque
-- A tabela antiga "campanhas" não é mais usada pelo painel.
-- -------------------------------------------------------------
alter table public.contratos add column if not exists qtd integer check (qtd >= 0);
alter table public.contratos add column if not exists prazo_entrega date;
alter table public.contratos add column if not exists favorita boolean not null default false;

-- Preenche a quantidade de vídeos a partir da descrição (ex: "2 videos" vira 2)
update public.contratos
   set qtd = (regexp_match(descricao, '^\s*(\d+)'))[1]::integer
 where qtd is null and descricao ~ '^\s*\d+';

-- Apaga a linha de exemplo da tabela antiga de campanhas
delete from public.campanhas where exemplo = true;


-- -------------------------------------------------------------
-- 15. COMISSÕES DO TIKTOK SHOP
-- Um lançamento por repasse (o TikTok paga toda quarta).
-- data: o dia que o dinheiro caiu | valor: comissão recebida
-- gmv / itens: opcionais, o quanto você vendeu naquela semana
-- Entra no Financeiro como "TikTok Shop", somando no faturado,
-- no recebido e nos gráficos. Só você (logado) vê e mexe.
-- -------------------------------------------------------------
create table if not exists public.comissoes_ttk (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  data       date not null,
  valor      numeric(12, 2) not null default 0 check (valor >= 0),
  gmv        numeric(12, 2) check (gmv >= 0),
  itens      integer check (itens >= 0),
  obs        text
);
alter table public.comissoes_ttk enable row level security;

drop policy if exists "dono faz tudo" on public.comissoes_ttk;
create policy "dono faz tudo" on public.comissoes_ttk
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 16. ETAPAS COMPLETAS DO CONTRATO E META DO MÊS
-- O contrato agora acompanha a marca do começo ao fim:
--   negociação: Em negociação, Assinatura de contrato
--   produção:   Aguardando briefing, Roteiro em andamento,
--               Aguardando aprovação de roteiro, Gravando, Editando,
--               Enviado p/ aprovação
--   dinheiro:   Entregue, Nota fiscal enviada, Aguardando pagamento, Pago
--   fora:       Perdida (a negociação não fechou), Cancelado
-- "Vencido" continua automático: o painel mostra sozinho quando o
-- prazo de pagamento passou e ainda falta receber.
-- -------------------------------------------------------------
alter table public.contratos drop constraint if exists contratos_status_check;

-- Ajusta os contratos que já existem para as etapas novas
update public.contratos set status = 'Aguardando aprovação de roteiro' where status = 'Aprovação de roteiro';
update public.contratos set status = 'Aguardando pagamento' where status = 'Vencido';
update public.contratos set status = 'Pago'
 where status = 'Entregue' and valor > 0 and coalesce(parcela1, 0) + coalesce(parcela2, 0) >= valor;
update public.contratos set status = 'Aguardando pagamento'
 where status = 'Entregue' and data_nf is not null;

alter table public.contratos add constraint contratos_status_check
  check (status in ('Em negociação', 'Assinatura de contrato',
                    'Aguardando briefing', 'Roteiro em andamento', 'Aguardando aprovação de roteiro',
                    'Gravando', 'Editando', 'Enviado p/ aprovação',
                    'Entregue', 'Nota fiscal enviada', 'Aguardando pagamento', 'Pago',
                    'Perdida', 'Cancelado'));
alter table public.contratos alter column status set default 'Em negociação';

-- Meta de faturamento de cada mês
create table if not exists public.metas (
  ano    integer not null,
  mes    integer not null check (mes between 1 and 12),
  valor  numeric(12, 2) not null default 0 check (valor >= 0),
  primary key (ano, mes)
);
alter table public.metas enable row level security;

drop policy if exists "dono faz tudo" on public.metas;
create policy "dono faz tudo" on public.metas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 17. LEMBRETES E NOTIFICAÇÕES NO CELULAR
-- lembretes_adiados: quando você responde "ainda não" ou "lembrar
--   depois", o lembrete some até a data "ate".
-- push_inscricoes: os aparelhos (iPhone, computador) que aceitaram
--   receber notificação do painel.
-- config_privada e lembretes_enviados: só o ajudante "lembretes" do
--   Supabase lê (nenhum login acessa). A chave de assinatura das
--   notificações é criada lá dentro sozinha e nunca sai do banco.
-- -------------------------------------------------------------
create table if not exists public.lembretes_adiados (
  chave  text primary key,
  ate    date not null
);
alter table public.lembretes_adiados enable row level security;
drop policy if exists "dono faz tudo" on public.lembretes_adiados;
create policy "dono faz tudo" on public.lembretes_adiados
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.push_inscricoes (
  endpoint   text primary key,
  inscricao  jsonb not null,
  aparelho   text,
  criado_em  timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
drop policy if exists "dono faz tudo" on public.push_inscricoes;
create policy "dono faz tudo" on public.push_inscricoes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.config_privada (
  chave  text primary key,
  valor  text not null
);
alter table public.config_privada enable row level security;   -- sem regra: só o ajudante lê

create table if not exists public.lembretes_enviados (
  chave      text primary key,
  enviado_em timestamptz not null default now()
);
alter table public.lembretes_enviados enable row level security;   -- sem regra: só o ajudante lê

-- Relógio do Supabase: chama o ajudante "lembretes"
--   todo dia às 9h (horário de Brasília): resumo do que está pendente
--   toda quarta às 18h: lembra do repasse do TikTok Shop, se ainda não foi lançado
-- A chave usada aqui é a pública (a mesma do js/banco.js), não é segredo.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule('lembretes-diario', '0 12 * * *', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "diario"}'::jsonb)
$$);
select cron.schedule('lembretes-quarta', '0 21 * * 3', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "quarta"}'::jsonb)
$$);
