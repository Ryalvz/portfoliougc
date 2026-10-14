-- =============================================================
-- ROTEIROS (a aba "📜 Roteiros" do admin, que antes era Transcrições)
-- Onde colar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Só ACRESCENTA colunas na tabela que você já usa (transcricoes):
-- os seus roteiros salvos continuam lá, nada é apagado.
-- Pode rodar mais de uma vez sem problema.
--
-- A chave da Supadata NÃO fica no banco: ela continua guardada no
-- cofre do Supabase (Edge Functions > Secrets > SUPADATA_API_KEY),
-- onde nem o navegador enxerga. Por isso não existe tabela de
-- configurações aqui.
-- =============================================================

-- De quem é o vídeo: o seu ou de outra creator
alter table public.transcricoes add column if not exists de_quem text not null default 'outra';
alter table public.transcricoes drop constraint if exists transcricoes_de_quem_check;
alter table public.transcricoes add constraint transcricoes_de_quem_check check (de_quem in ('minha', 'outra'));

-- O @ do perfil, as etiquetas livres, a legenda do post e a data em que foi postado
alter table public.transcricoes add column if not exists perfil text check (char_length(perfil) <= 100);
alter table public.transcricoes add column if not exists tags text[] not null default '{}';
alter table public.transcricoes add column if not exists legenda text;
alter table public.transcricoes add column if not exists postado_em date;

-- Andamento da transcrição (separado das etapas do banco de ideias)
--   processando = a Supadata ainda está ouvindo o vídeo
--   pronto      = tem texto (ou você escreveu na mão)
--   falhou      = não deu, e o motivo fica em "erro"
alter table public.transcricoes add column if not exists andamento text not null default 'pronto';
alter table public.transcricoes drop constraint if exists transcricoes_andamento_check;
alter table public.transcricoes add constraint transcricoes_andamento_check check (andamento in ('processando', 'pronto', 'falhou'));
alter table public.transcricoes add column if not exists erro text;

-- Trechos com tempo (quando a Supadata mandar) e a data da última mudança
alter table public.transcricoes add column if not exists segmentos jsonb;
alter table public.transcricoes add column if not exists atualizado_em timestamptz not null default now();

create or replace function public.transcricoes_marcar_mudanca() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists transcricoes_mudanca on public.transcricoes;
create trigger transcricoes_mudanca before update on public.transcricoes
  for each row execute function public.transcricoes_marcar_mudanca();

-- Biblioteca abre mais rápido (os mais novos primeiro)
create index if not exists transcricoes_criado_em on public.transcricoes (criado_em desc);

-- O RLS da tabela já está ligado desde o começo: só o seu login
-- (public.eh_admin) lê e escreve. Nada para quem não está logado.
alter table public.transcricoes enable row level security;
