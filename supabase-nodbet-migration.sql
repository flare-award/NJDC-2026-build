-- =========================================================
-- МИГРАЦИЯ NODBET: баланс NOD-Коинов, ставки, рулетка,
-- Топ Хайроллеров и никнеймы пользователей.
--
-- Выполните этот файл целиком в Supabase → SQL Editor.
-- Выполнять нужно ПОСЛЕ основного файла supabase-schema.sql
-- (те команды вы уже вводили — этот файл ничего в них не меняет,
-- он только добавляет новые таблицы вкладки NODBET).
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. NODBET PROFILES — профиль игрока NODBET
--    Баланс, опыт, инвентарь бустов, никнейм и статистика
--    для Топа Хайроллеров. Создаётся автоматически при
--    первом заходе пользователя на вкладку NODBET.
--    Почт в таблице НЕТ — топ не раскрывает email никого!
-- =========================================================
create table if not exists nodbet_profiles (
  user_id uuid primary key,                  -- = auth.users.id (Supabase Auth)
  nickname text,                             -- NULL = временный «фруктовый» ник на клиенте
  balance int not null default 10000,        -- баланс NOD-Коинов
  xp int not null default 500,               -- опыт игрока
  last_daily_claim timestamptz,              -- когда забран ежедневный бонус
  vip_boost_x3 boolean not null default false,
  insurance_count int not null default 1,
  double_win_count int not null default 1,
  radar_unlocked boolean not null default false,
  gold_badge boolean not null default false,
  total_won bigint not null default 0,       -- всего выиграно (денормализовано для топа)
  bets_count int not null default 0,         -- ставки + спины (денормализовано для топа)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Формат никнейма: рус/лат буквы, цифры и только «-», «_», «+».
  -- Без пробелов и прочих символов, 2–24 знака. NULL разрешён (временный ник).
  constraint nodbet_nickname_format check (
    nickname is null or nickname ~ '^[A-Za-zА-Яа-яЁё0-9_+-]{2,24}$'
  )
);

-- Уникальность никнеймов БЕЗ учёта регистра (ReZo и rEZO — один ник).
-- NULL-ники (временные фруктовые) между собой не конфликтуют.
create unique index if not exists nodbet_profiles_nickname_unique
  on nodbet_profiles (lower(nickname))
  where nickname is not null;

-- auto-update поля updated_at
create or replace function nodbet_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists nodbet_profiles_touch on nodbet_profiles;
create trigger nodbet_profiles_touch
  before update on nodbet_profiles
  for each row execute function nodbet_touch_updated_at();

-- =========================================================
-- 2. NODBET BETS — ставки пользователей на матчи
-- =========================================================
create table if not exists nodbet_bets (
  user_id uuid not null references nodbet_profiles(user_id) on delete cascade,
  id text not null,
  match_id text,
  match_title text not null default '',
  team_choice text not null default '',
  team_name text not null default '',
  amount int not null default 0,
  odds numeric not null default 1.9,
  status text not null default 'pending',      -- pending | won | lost | refunded
  used_insurance boolean not null default false,
  used_double_win boolean not null default false,
  payout int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists nodbet_bets_user_idx on nodbet_bets (user_id, created_at desc);

-- =========================================================
-- 3. NODBET ROULETTE SPINS — история спинов рулетки
-- =========================================================
create table if not exists nodbet_roulette_spins (
  user_id uuid not null references nodbet_profiles(user_id) on delete cascade,
  id text not null,
  label text not null default '',
  color text not null default 'red',           -- red | black | green | gold | purple
  multiplier numeric not null default 1,
  bonus_text text,
  won_coins int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists nodbet_spins_user_idx on nodbet_roulette_spins (user_id, created_at desc);

-- =========================================================
-- 4. ROW LEVEL SECURITY
--    - Топ хайроллеров (nodbet_profiles) читают ВСЕ посетители
--      (там только никнейм и игровые цифры — почт нет).
--    - Профиль, ставки и спины пользователь создаёт и меняет
--      ТОЛЬКО свои собственные (auth.uid() = user_id).
-- =========================================================

alter table nodbet_profiles enable row level security;
alter table nodbet_bets enable row level security;
alter table nodbet_roulette_spins enable row level security;

-- --- nodbet_profiles ---
create policy "public read nodbet profiles"
  on nodbet_profiles for select using (true);

create policy "user insert own nodbet profile"
  on nodbet_profiles for insert
  with check (auth.uid() = user_id);

create policy "user update own nodbet profile"
  on nodbet_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user delete own nodbet profile"
  on nodbet_profiles for delete
  using (auth.uid() = user_id);

-- --- nodbet_bets ---
create policy "user read own nodbet bets"
  on nodbet_bets for select
  using (auth.uid() = user_id);

create policy "user insert own nodbet bets"
  on nodbet_bets for insert
  with check (auth.uid() = user_id);

create policy "user update own nodbet bets"
  on nodbet_bets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user delete own nodbet bets"
  on nodbet_bets for delete
  using (auth.uid() = user_id);

-- --- nodbet_roulette_spins ---
create policy "user read own nodbet spins"
  on nodbet_roulette_spins for select
  using (auth.uid() = user_id);

create policy "user insert own nodbet spins"
  on nodbet_roulette_spins for insert
  with check (auth.uid() = user_id);

create policy "user update own nodbet spins"
  on nodbet_roulette_spins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user delete own nodbet spins"
  on nodbet_roulette_spins for delete
  using (auth.uid() = user_id);

-- =========================================================
-- 5. REALTIME — включаем мгновенные обновления для всех
--    таблиц NODBET (топ хайроллеров и балансы обновляются
--    у всех онлайн-посетителей без перезагрузки страницы).
--    Проверки NOT EXISTS нужны, чтобы файл можно было
--    запускать повторно без ошибок.
-- =========================================================

-- Создаём publication, если её вдруг нет
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Добавляем таблицы NODBET в realtime-publication
do $$
declare
  t text;
begin
  foreach t in array array['nodbet_profiles', 'nodbet_bets', 'nodbet_roulette_spins']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- =========================================================
-- Готово! Проверка (по желанию) — должны вернуться 3 строки:
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime'
--     and tablename like 'nodbet_%';
-- =========================================================
