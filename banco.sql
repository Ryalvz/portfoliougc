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


-- -------------------------------------------------------------
-- 18. INSTAGRAM: HISTÓRICO DE SEGUIDORES
-- O Instagram só mostra os últimos 30 dias. Toda vez que o painel
-- busca as métricas, o ajudante "instagram" guarda os seguidores do
-- dia aqui, e assim o gráfico de crescimento vai ficando completo.
-- A chave de acesso do Instagram fica na tabela config_privada
-- (seção 17), que nenhum login acessa: só o ajudante.
-- -------------------------------------------------------------
create table if not exists public.ig_historico (
  data        date primary key,
  seguidores  integer,
  posts       integer
);
alter table public.ig_historico enable row level security;
drop policy if exists "dono le" on public.ig_historico;
create policy "dono le" on public.ig_historico
  for select to authenticated using (public.eh_admin());


-- -------------------------------------------------------------
-- 19. AVISO DE PROPOSTA NOVA NO CELULAR E TIKTOK DE MANHÃ
-- De 2 em 2 horas, das 8h às 22h (horário de Brasília), o ajudante
-- "lembretes" confere o Gmail e avisa no celular quando chega
-- proposta de gente de verdade (e-mail automático não avisa).
-- Cada e-mail só gera um aviso (fica anotado em lembretes_enviados).
-- -------------------------------------------------------------
-- O repasse do TikTok Shop cai de madrugada: o aviso de quarta vem às 8h
select cron.unschedule('lembretes-quarta');
select cron.schedule('lembretes-quarta', '0 11 * * 3', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "quarta"}'::jsonb)
$$);
select cron.schedule('lembretes-propostas', '0 1,11-23/2 * * *', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "propostas"}'::jsonb)
$$);


-- -------------------------------------------------------------
-- 20. LEMBRETES RÁPIDOS
-- Você escreve ("cobrar a RAMPY do pagamento"), escolhe quando, e
-- na hora o celular recebe a notificação. O relógio confere a
-- cada minuto se tem lembrete na hora de avisar.
-- feito: você marcou como resolvido | avisado: a notificação já foi
-- -------------------------------------------------------------
create table if not exists public.lembretes_rapidos (
  id        bigint generated always as identity primary key,
  texto     text not null,
  quando    timestamptz not null,
  feito     boolean not null default false,
  avisado   boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists lembretes_rapidos_pendentes on public.lembretes_rapidos (quando) where not feito;
alter table public.lembretes_rapidos enable row level security;

drop policy if exists "dono faz tudo" on public.lembretes_rapidos;
create policy "dono faz tudo" on public.lembretes_rapidos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

select cron.schedule('lembretes-rapidos', '* * * * *', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "rapidos"}'::jsonb)
$$);


-- -------------------------------------------------------------
-- 21. NICHO DAS MARCAS
-- Separa as marcas em abas por nicho (Tech, Casa e decoração,
-- Moda, Beleza...). Você escreve no cadastro ou vem da planilha.
-- -------------------------------------------------------------
alter table public.marcas add column if not exists nicho text check (char_length(nicho) <= 60);
create index if not exists marcas_nicho on public.marcas (nicho);


-- -------------------------------------------------------------
-- 22. MARCAS FAVORITAS E FIXADAS
-- favorita: estrela (aparece na aba "Favoritas")
-- fixada: alfinete (fica sempre no topo da lista)
-- -------------------------------------------------------------
alter table public.marcas add column if not exists favorita boolean not null default false;
alter table public.marcas add column if not exists fixada boolean not null default false;


-- -------------------------------------------------------------
-- 23. CONTATOS DO SITE (separados da lista de marcas)
-- Quem preenche o formulário "Bora criar juntos?" ou pede o mídia
-- kit entra aqui, e não mais na tabela de marcas. Aparece na aba
-- Portfólio do admin, e o celular recebe um aviso na hora.
--   tipo:    contato (formulário) ou midia_kit (card do mídia kit)
--   visto:   você já abriu a aba e viu
--   avisado: a notificação do celular já saiu
-- -------------------------------------------------------------
create table if not exists public.contatos_site (
  id        bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  tipo      text not null default 'contato' check (tipo in ('contato', 'midia_kit')),
  nome      text not null check (char_length(nome) between 1 and 150),
  marca     text check (char_length(marca) <= 150),
  email     text not null check (char_length(email) <= 200),
  whats     text check (char_length(whats) <= 40),
  mensagem  text check (char_length(mensagem) <= 3000),
  visto     boolean not null default false,
  avisado   boolean not null default false
);
alter table public.contatos_site enable row level security;

drop policy if exists "dono faz tudo" on public.contatos_site;
create policy "dono faz tudo" on public.contatos_site
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- O site só consegue CRIAR um contato novo (não lê, não edita, não apaga)
drop policy if exists "site cria contato" on public.contatos_site;
create policy "site cria contato" on public.contatos_site
  for insert to anon
  with check (visto = false and avisado = false);

-- Assim que um contato chega, chama o ajudante "lembretes" para
-- mandar a notificação no celular (a chave aqui é a pública).
create or replace function public.avisar_contato_site() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "contato"}'::jsonb);
  return new;
end $$;
drop trigger if exists contato_site_avisa on public.contatos_site;
create trigger contato_site_avisa after insert on public.contatos_site
  for each row execute function public.avisar_contato_site();


-- -------------------------------------------------------------
-- 24. CALENDÁRIO COM HORÁRIO E OUTROS COMPROMISSOS
-- Além de gravar, editar e postar: reunião e compromisso.
--   hora / hora_fim: horário (opcional). Sem hora = o dia todo.
--   local: endereço ou link da reunião (Meet, Zoom...)
-- -------------------------------------------------------------
alter table public.calendario drop constraint if exists calendario_tipo_check;
alter table public.calendario add constraint calendario_tipo_check
  check (tipo in ('gravar', 'editar', 'postar', 'reuniao', 'compromisso'));
alter table public.calendario add column if not exists hora time;
alter table public.calendario add column if not exists hora_fim time;
alter table public.calendario add column if not exists local text check (char_length(local) <= 300);


-- -------------------------------------------------------------
-- 25. SINCRONIZAÇÃO COM O GOOGLE AGENDA (calendário "Trabalhos")
-- O que você cria no painel vai para o Google (e para o iPhone),
-- e o que você cria no iPhone, no calendário "Trabalhos", volta
-- para o painel. O ajudante "lembretes" faz essa conversa a cada
-- 5 minutos (e na hora, quando você salva algo no painel).
--   gcal_id:       o número do compromisso no Google
--   sinc_em:       quando foi a última conversa com o Google
--   atualizado_em: quando mudou pela última vez (preenche sozinho)
-- calendario_apagados: o que você apagou no painel, para apagar
--   também no Google (só o ajudante lê).
-- -------------------------------------------------------------
alter table public.calendario add column if not exists gcal_id text;
alter table public.calendario add column if not exists sinc_em timestamptz;
alter table public.calendario add column if not exists atualizado_em timestamptz not null default now();
create unique index if not exists calendario_gcal_id on public.calendario (gcal_id) where gcal_id is not null;

-- Marca a hora de cada mudança. Quando a mudança veio do Google
-- (o ajudante grava sinc_em), não conta como mudança nova.
create or replace function public.calendario_marcar_mudanca() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.sinc_em is not null and (tg_op = 'INSERT' or new.sinc_em is distinct from old.sinc_em) then
    new.atualizado_em := new.sinc_em;
  else
    new.atualizado_em := now();
  end if;
  return new;
end $$;
drop trigger if exists calendario_mudanca on public.calendario;
create trigger calendario_mudanca before insert or update on public.calendario
  for each row execute function public.calendario_marcar_mudanca();

create table if not exists public.calendario_apagados (
  gcal_id   text primary key,
  criado_em timestamptz not null default now()
);
alter table public.calendario_apagados enable row level security;   -- sem regra: só o ajudante lê

create or replace function public.calendario_guardar_apagado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.gcal_id is not null then
    insert into public.calendario_apagados (gcal_id) values (old.gcal_id) on conflict do nothing;
  end if;
  return old;
end $$;
drop trigger if exists calendario_apagado on public.calendario;
create trigger calendario_apagado after delete on public.calendario
  for each row execute function public.calendario_guardar_apagado();

select cron.schedule('agenda-google', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "google"}'::jsonb)
$$);


-- -------------------------------------------------------------
-- 26. CONTRATO PADRÃO EM PDF
-- modelos_contrato: o texto do seu contrato com os lugares que
--   mudam marcados como {{campo}} (ex.: {{razao_social}}, {{valor}}).
--   Fica no banco (e não nos arquivos do site, que são públicos)
--   porque tem o seu CNPJ e os seus dados bancários.
-- contratos_gerados: cada contrato que você gerou, com os dados
--   preenchidos, para baixar o PDF de novo quando quiser.
-- -------------------------------------------------------------
create table if not exists public.modelos_contrato (
  id            bigint generated always as identity primary key,
  nome          text not null default 'Contrato padrão',
  texto         text not null,
  campos        jsonb not null default '[]',
  atualizado_em timestamptz not null default now()
);
alter table public.modelos_contrato enable row level security;
drop policy if exists "dono faz tudo" on public.modelos_contrato;
create policy "dono faz tudo" on public.modelos_contrato
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.contratos_gerados (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  modelo_id   bigint references public.modelos_contrato (id) on delete set null,
  contrato_id bigint,
  marca       text,
  dados       jsonb not null default '{}'
);
alter table public.contratos_gerados enable row level security;
drop policy if exists "dono faz tudo" on public.contratos_gerados;
create policy "dono faz tudo" on public.contratos_gerados
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 27. INSTAGRAM: REELS DA SEMANA, PLANO DA SEMANA E CARROSSÉIS
-- ig_pesquisa: as hashtags que o painel vasculha toda segunda e
--   o andamento da busca (uma linha só). A chave do Apify NÃO fica
--   aqui: ela fica no cofre do Supabase (Edge Functions > Secrets >
--   APIFY_TOKEN).
-- ig_reels:    os 30 reels com mais views da semana, por hashtag.
-- ig_planos:   o plano da semana que você colou da resposta do Claude.
-- carrosseis:  os carrosséis que você montou no gerador.
-- -------------------------------------------------------------
create table if not exists public.ig_pesquisa (
  id           int primary key default 1 check (id = 1),
  hashtags     text[] not null default array['ugcbrasil', 'creatorugc', 'conteudougc', 'vidadecreator', 'dicasdeiphone', 'dicasdecapcut', 'appsuteis'],
  por_hashtag  int not null default 25 check (por_hashtag between 5 and 60),
  run_id       text,
  iniciado_em  timestamptz,
  coletado_em  timestamptz,
  erro         text,
  avisado      boolean not null default true
);
insert into public.ig_pesquisa (id) values (1) on conflict (id) do nothing;
alter table public.ig_pesquisa enable row level security;
drop policy if exists "dono faz tudo" on public.ig_pesquisa;
create policy "dono faz tudo" on public.ig_pesquisa
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.ig_reels (
  id          bigint generated always as identity primary key,
  semana      date not null,
  url         text not null,
  perfil      text,
  legenda     text,
  views       bigint,
  curtidas    bigint,
  comentarios bigint,
  duracao     numeric,
  postado_em  timestamptz,
  hashtag     text,
  capa        text,
  criado_em   timestamptz not null default now(),
  unique (semana, url)
);
create index if not exists ig_reels_semana on public.ig_reels (semana desc, views desc);
alter table public.ig_reels enable row level security;
drop policy if exists "dono faz tudo" on public.ig_reels;
create policy "dono faz tudo" on public.ig_reels
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.ig_planos (
  id        bigint generated always as identity primary key,
  semana    date not null unique,
  resposta  text not null default '',
  itens     jsonb not null default '[]',
  criado_em timestamptz not null default now()
);
alter table public.ig_planos enable row level security;
drop policy if exists "dono faz tudo" on public.ig_planos;
create policy "dono faz tudo" on public.ig_planos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.carrosseis (
  id            bigint generated always as identity primary key,
  titulo        text not null default 'Carrossel',
  slides        jsonb not null default '[]',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.carrosseis enable row level security;
drop policy if exists "dono faz tudo" on public.carrosseis;
create policy "dono faz tudo" on public.carrosseis
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Toda segunda, das 7h às 10h50 (Brasília), de 10 em 10 minutos: começa a busca
-- da semana e, quando o Apify termina, guarda os 30 reels. Pode chamar à vontade:
-- o ajudante só faz uma busca por semana.
select cron.unschedule('reels-semana') where exists (select 1 from cron.job where jobname = 'reels-semana');
select cron.schedule('reels-semana', '*/10 10-13 * * 1', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/tendencias',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "semanal"}'::jsonb)
$$);


-- -------------------------------------------------------------
-- 28. PREFERÊNCIAS DO PAINEL (ex.: o seu guia de voz para roteiros)
-- Uma linha por preferência: chave e valor. Só o seu login lê e grava.
-- -------------------------------------------------------------
create table if not exists public.preferencias (
  chave         text primary key check (char_length(chave) <= 60),
  valor         text not null default '',
  atualizado_em timestamptz not null default now()
);
alter table public.preferencias enable row level security;
drop policy if exists "dono faz tudo" on public.preferencias;
create policy "dono faz tudo" on public.preferencias
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 29. COMPROMISSOS QUE SE REPETEM (ex.: terapia toda sexta às 9h)
--   serie_id:   o mesmo para todos os dias da repetição
--   repete:     semanal, quinzenal, mensal, diario ou dias_uteis
--   repete_ate: até quando repete (vazio = sem data para acabar;
--               o painel vai criando os próximos sozinho)
-- Cada dia vira um compromisso normal, então aparece no Google
-- Agenda e no iPhone, com o aviso de 30 minutos antes.
-- -------------------------------------------------------------
alter table public.calendario add column if not exists serie_id text;
alter table public.calendario add column if not exists repete text;
alter table public.calendario drop constraint if exists calendario_repete_check;
alter table public.calendario add constraint calendario_repete_check check (repete is null or repete in ('semanal', 'quinzenal', 'mensal', 'diario', 'dias_uteis'));
alter table public.calendario add column if not exists repete_ate date;
create index if not exists calendario_serie on public.calendario (serie_id) where serie_id is not null;


-- -------------------------------------------------------------
-- 30. SEÇÕES NOVAS DO PORTFÓLIO
-- Apps & Tecnologia (tech), Autocuidado (cuidado), Alimentos
-- (alimentos), Casa & Utilidades (casa) e Moda Masculina (moda).
-- beleza e fitness continuam aceitos para não quebrar nada antigo.
-- -------------------------------------------------------------
alter table public.videos drop constraint if exists videos_nicho_check;
alter table public.videos add constraint videos_nicho_check check (nicho in ('tech', 'cuidado', 'alimentos', 'casa', 'moda', 'beleza', 'fitness'));


-- -------------------------------------------------------------
-- 31. CONTEÚDO DO SITE EDITÁVEL PELO PAINEL
-- Uma linha por bloco do site: feedbacks, resultados (carrossel),
-- case (case em destaque) e black_friday (faixa do topo).
-- valor é um JSON. O site só LÊ; só o seu login grava.
-- -------------------------------------------------------------
create table if not exists public.site_conteudo (
  chave         text primary key check (chave in ('feedbacks', 'resultados', 'case', 'black_friday')),
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.site_conteudo enable row level security;
drop policy if exists "site le" on public.site_conteudo;
create policy "site le" on public.site_conteudo for select to anon, authenticated using (true);
drop policy if exists "dono grava" on public.site_conteudo;
create policy "dono grava" on public.site_conteudo
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());


-- -------------------------------------------------------------
-- 32. FINANCEIRO PESSOAL (PF)
-- A parte "Pessoal" do Financeiro. Só o seu login lê e grava.
-- pf_cartoes:      seus cartões e o dia de vencimento
-- pf_contas:       contas fixas (plano de saúde, apê, internet...)
--                  inicio/fim: de quando até quando (vazio = sempre)
-- pf_compras:      cada compra do cartão. parcelas = 1 é à vista.
--                  primeiro_mes: o mês da fatura (dia 1) em que caiu
--                  a parcela 1. dono vazio = sua; com nome = de quem
--                  pegou o cartão emprestado. chave evita repetir
--                  a mesma compra quando você importa a fatura.
-- pf_recebimentos: o que cada pessoa te devolveu
-- pf_entradas:     o dinheiro que entrou na sua conta pessoal
-- pf_config:       salário fixo, reserva atual, meta da reserva
-- -------------------------------------------------------------
create table if not exists public.pf_cartoes (
  id         bigint generated always as identity primary key,
  nome       text not null,
  vence_dia  integer check (vence_dia between 1 and 31),
  fecha_dia  integer check (fecha_dia between 1 and 31),
  limite     numeric(12, 2) check (limite >= 0),
  ordem      integer not null default 0
);
create table if not exists public.pf_contas (
  id         bigint generated always as identity primary key,
  nome       text not null,
  valor      numeric(12, 2) not null default 0 check (valor >= 0),
  dia        integer check (dia between 1 and 31),
  categoria  text,
  inicio     date,
  fim        date,
  obs        text
);
create table if not exists public.pf_compras (
  id             bigint generated always as identity primary key,
  criado_em      timestamptz not null default now(),
  cartao_id      bigint references public.pf_cartoes (id) on delete set null,
  descricao      text not null,
  valor_parcela  numeric(12, 2) not null default 0,
  parcelas       integer not null default 1 check (parcelas between 1 and 120),
  primeiro_mes   date not null,
  data_compra    date,
  dono           text,
  categoria      text,
  origem         text not null default 'manual',
  chave          text unique
);
create table if not exists public.pf_recebimentos (
  id      bigint generated always as identity primary key,
  pessoa  text not null,
  valor   numeric(12, 2) not null default 0 check (valor >= 0),
  data    date not null default current_date,
  obs     text
);
create table if not exists public.pf_entradas (
  id         bigint generated always as identity primary key,
  data       date not null default current_date,
  valor      numeric(12, 2) not null default 0 check (valor >= 0),
  descricao  text,
  origem     text
);
create table if not exists public.pf_config (
  chave  text primary key,
  valor  jsonb not null
);
do $$
declare t text;
begin
  foreach t in array array['pf_cartoes', 'pf_contas', 'pf_compras', 'pf_recebimentos', 'pf_entradas', 'pf_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono faz tudo" on public.%I', t);
    execute format('create policy "dono faz tudo" on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', t);
  end loop;
end $$;

-- 32b. Conta fixa paga no cartão: já aparece na fatura, então não soma de novo
alter table public.pf_contas add column if not exists no_cartao boolean not null default false;


-- -------------------------------------------------------------
-- 33. AVISOS DO BOT DE GASTOS NO TELEGRAM
-- Todo dia às 21h (Brasília): fatura vencendo em 2 dias, lembrete
-- de lançar gastos e, no domingo, o resumo da semana.
-- O ajudante "gastos" só manda para o chat conectado pelo painel.
-- -------------------------------------------------------------
select cron.unschedule('gastos-diario') where exists (select 1 from cron.job where jobname = 'gastos-diario');
select cron.schedule('gastos-diario', '0 0 * * *', $$
  select net.http_post(
    url := 'https://jlehawiwklvyvrzbfuiu.supabase.co/functions/v1/gastos',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0"}'::jsonb,
    body := '{"tipo": "diario"}'::jsonb)
$$);


-- -------------------------------------------------------------
-- 34. QUAIS VÍDEOS DO PORTFÓLIO AS MARCAS ASSISTEM
-- Uma linha cada vez que alguém assiste um vídeo do site com som:
-- qual vídeo, quantos segundos e de onde a pessoa veio (Instagram,
-- Google, direto...). Nada que identifique quem assistiu.
-- O site só consegue CRIAR linhas, com a hora de agora; só o seu
-- login lê (é o ranking do Dashboard).
-- -------------------------------------------------------------
create table if not exists public.video_views (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  video_id   bigint,
  titulo     text check (char_length(titulo) <= 160),
  secao      text check (char_length(secao) <= 20),
  segundos   integer not null default 0 check (segundos between 0 and 3600),
  duracao    integer check (duracao between 0 and 3600),
  origem     text check (char_length(origem) <= 200)
);
create index if not exists video_views_data on public.video_views (criado_em);
alter table public.video_views enable row level security;
drop policy if exists "dono faz tudo" on public.video_views;
create policy "dono faz tudo" on public.video_views
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "site registra video" on public.video_views;
create policy "site registra video" on public.video_views
  for insert to anon
  with check (criado_em between now() - interval '5 minutes' and now() + interval '5 minutes');


-- -------------------------------------------------------------
-- 35. CALENDÁRIO: TIPO "OUTROS"
-- Para o que não é gravar, editar, postar, reunião nem compromisso.
-- -------------------------------------------------------------
alter table public.calendario drop constraint if exists calendario_tipo_check;
alter table public.calendario add constraint calendario_tipo_check
  check (tipo in ('gravar', 'editar', 'postar', 'reuniao', 'compromisso', 'outro'));

-- Prospecção na voz do Ryan: o que muda em cada marca ({pessoa}, {conexao}, {ideia})
alter table public.marcas add column if not exists contato_nome text;
alter table public.marcas add column if not exists conexao text;
alter table public.marcas add column if not exists ideia text;


-- -------------------------------------------------------------
-- 36. AUTOMAÇÕES DO INSTAGRAM: comentou a palavra, recebe no direct
-- automacoes: cada regra (palavras, em qual post, a mensagem).
-- automacao_envios: um registro por comentário atendido (o mesmo
-- comentário nunca recebe dois directs). O ajudante "automacao"
-- grava aqui com a chave interna; o painel só lê e apaga.
-- -------------------------------------------------------------
create table if not exists public.automacoes (
  id            bigint generated always as identity primary key,
  nome          text not null default 'Automação' check (char_length(nome) <= 120),
  palavras      text not null check (char_length(palavras) between 1 and 300),
  midia_id      text check (char_length(midia_id) <= 60),
  midia_legenda text check (char_length(midia_legenda) <= 300),
  midia_capa    text check (char_length(midia_capa) <= 2000),
  mensagem      text not null check (char_length(mensagem) between 1 and 1000),
  respostas     text check (char_length(respostas) <= 1000),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now()
);
alter table public.automacoes enable row level security;
drop policy if exists "dono faz tudo" on public.automacoes;
create policy "dono faz tudo" on public.automacoes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create table if not exists public.automacao_envios (
  id            bigint generated always as identity primary key,
  automacao_id  bigint references public.automacoes (id) on delete set null,
  comentario_id text not null unique,
  usuario       text,
  usuario_id    text,
  midia_id      text,
  texto         text,
  status        text not null default 'recebido' check (status in ('recebido', 'enviado', 'erro')),
  erro          text,
  criado_em     timestamptz not null default now()
);
create index if not exists automacao_envios_data on public.automacao_envios (criado_em desc);
alter table public.automacao_envios enable row level security;
drop policy if exists "dono faz tudo" on public.automacao_envios;
create policy "dono faz tudo" on public.automacao_envios
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
