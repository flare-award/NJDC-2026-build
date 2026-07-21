-- ============================================================
-- МИГРАЦИЯ: Двойная-Рулетка (Лобби) NODBET
-- Выполните этот файл в Supabase → SQL Editor
-- ============================================================

-- 1. Создаём таблицу лобби для Двойной-Рулетки
create table if not exists public.nodbet_double_lobbies (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  host_nickname text not null,
  name text not null,
  max_players int not null default 2 check (max_players >= 2 and max_players <= 4),
  min_bet bigint not null default 500,
  status text not null default 'waiting', -- 'waiting' | 'betting' | 'spinning' | 'finished'
  winning_bonus_id text,
  timer_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Создаём таблицу игроков в лобби
create table if not exists public.nodbet_double_lobby_players (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.nodbet_double_lobbies(id) on delete cascade,
  user_id text not null,
  nickname text not null,
  bet_amount bigint not null default 0,
  selected_bonus_id text, -- выбранный бонус (скрыт от соперников на клиенте)
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  constraint nodbet_double_lobby_players_unique unique (lobby_id, user_id)
);

-- 3. Быстрые индексы
create index if not exists idx_nodbet_double_lobbies_status on public.nodbet_double_lobbies(status);
create index if not exists idx_nodbet_double_lobby_players_lobby on public.nodbet_double_lobby_players(lobby_id);

-- 4. Настройка Row Level Security (RLS) — доступ для всех онлайн игроков
alter table public.nodbet_double_lobbies enable row level security;
alter table public.nodbet_double_lobby_players enable row level security;

drop policy if exists "Enable all for nodbet_double_lobbies" on public.nodbet_double_lobbies;
create policy "Enable all for nodbet_double_lobbies"
  on public.nodbet_double_lobbies
  for all
  using (true)
  with check (true);

drop policy if exists "Enable all for nodbet_double_lobby_players" on public.nodbet_double_lobby_players;
create policy "Enable all for nodbet_double_lobby_players"
  on public.nodbet_double_lobby_players
  for all
  using (true)
  with check (true);

-- 5. Подключение к Realtime Publication
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.nodbet_double_lobbies;
alter publication supabase_realtime add table public.nodbet_double_lobby_players;

-- ============================================================
-- Проверка:
-- SELECT * FROM public.nodbet_double_lobbies;
-- SELECT * FROM public.nodbet_double_lobby_players;
-- ============================================================
