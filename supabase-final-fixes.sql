-- ============================================================
-- FINAL FIXES MIGRATION — Исправления всех проблем из тикета
-- Выполните этот файл ОДИН РАЗ в Supabase SQL Editor
-- ============================================================

-- 1. Дабл спин — возможность включать/выключать
-- Добавляем колонку double_spin_enabled (по умолчанию true)
alter table if exists nodbet_profiles
  add column if not exists double_spin_enabled boolean not null default true;

-- Если колонки double_spin не было (на старых базах) — добавим
alter table if exists nodbet_profiles
  add column if not exists double_spin boolean not null default false;

-- 2. Ссылки CYBERSHOKE на каждую катку (Bo2/Bo3)
-- Вариант A: добавляем отдельные колонки для 2-й и 3-й катки на уровне матча
alter table if exists matches
  add column if not exists cybershoke_url_2 text not null default '',
  add column if not exists cybershoke_url_3 text not null default '';

-- Вариант B: расширяем maps jsonb чтобы каждый элемент мог иметь cybershoke_url
-- maps уже есть как jsonb, но убедимся что дефолт пустой массив
alter table if exists matches
  alter column maps set default '[]'::jsonb;

-- Миграция существующих данных:
-- Если у матча есть cybershoke_url, скопируем его как ссылку первой катки в maps,
-- если в maps еще нет своих ссылок.

do $$
declare
  rec record;
  maps_data jsonb;
  has_links boolean;
begin
  for rec in select id, cybershoke_url, maps from matches loop
    -- проверяем есть ли уже ссылки в maps
    select exists (
      select 1 from jsonb_array_elements(coalesce(rec.maps, '[]'::jsonb)) as el
      where el->>'cybershoke_url' is not null and el->>'cybershoke_url' <> ''
    ) into has_links;

    if not has_links and rec.cybershoke_url <> '' then
      -- если maps пустой — создаем 1 элемент с ссылкой
      if rec.maps is null or jsonb_array_length(rec.maps) = 0 then
        maps_data := jsonb_build_array(jsonb_build_object('score_a', 0, 'score_b', 0, 'cybershoke_url', rec.cybershoke_url));
      else
        -- добавляем ссылку в первую карту, если её нет
        maps_data := (
          select jsonb_agg(
            case when idx = 0 and (elem->>'cybershoke_url' is null or elem->>'cybershoke_url' = '')
              then elem || jsonb_build_object('cybershoke_url', rec.cybershoke_url)
              else elem
            end
          )
          from jsonb_array_elements(rec.maps) with ordinality as t(elem, idx)
        );
      end if;

      update matches set maps = maps_data where id = rec.id;
    end if;
  end loop;
end $$;

-- 3. Фикс никнеймов: убедимся что constraint и уникальный индекс корректные
-- Пересоздаём check на формат никнейма (рус/лат + цифры + _ - + , 2-24 символа)
alter table if exists nodbet_profiles drop constraint if exists nodbet_nickname_format;
alter table if exists nodbet_profiles
  add constraint nodbet_nickname_format check (
    nickname is null or nickname ~ '^[A-Za-zА-Яа-яЁё0-9_+-]{2,24}$'
  );

-- Уникальный индекс по lower(nickname) без учёта регистра, NULL не конфликтуют
drop index if exists nodbet_profiles_nickname_unique;
create unique index nodbet_profiles_nickname_unique
  on nodbet_profiles (lower(nickname))
  where nickname is not null;

-- 4. Проверяем что типы баланса и выигрышей bigint (без лимита)
alter table if exists nodbet_profiles alter column balance type bigint;
alter table if exists nodbet_profiles alter column total_won type bigint;
alter table if exists nodbet_bets alter column amount type bigint;
alter table if exists nodbet_bets alter column payout type bigint;
alter table if exists nodbet_roulette_spins alter column won_coins type bigint;

-- 5. Индексы для быстрого доступа по балансу (топ хайроллеров)
create index if not exists nodbet_profiles_balance_desc_idx on nodbet_profiles (balance desc);

-- 6. Компенсация и промокод колонки (если вдруг нет — добавим)
alter table if exists nodbet_profiles add column if not exists promo_used boolean not null default false;
alter table if exists nodbet_profiles add column if not exists compensation_250k_claimed boolean not null default false;
alter table if exists nodbet_profiles add column if not exists crown_badge boolean not null default false;

-- 7. Выдать компенсацию 250k тем, кому ещё не выдавали (на всякий случай)
update nodbet_profiles set balance = balance + 250000, compensation_250k_claimed = true where compensation_250k_claimed = false;

-- 8. Проверка рулетки: убедиться что колонки bonus_id и is_negative есть
alter table if exists nodbet_roulette_spins add column if not exists bonus_id text not null default 'normal';
alter table if exists nodbet_roulette_spins add column if not exists is_negative boolean not null default false;

-- 9. RLS — убедимся что профили могут читать все, а изменять — только свои
-- (политики уже есть в прошлых миграциях, но пересоздадим если нужно)
-- Эти команды можно выполнить только если политики отсутствуют; игнорируем ошибки
do $$
begin
  -- public read
  if not exists (select 1 from pg_policies where tablename='nodbet_profiles' and policyname='public read nodbet profiles') then
    create policy "public read nodbet profiles" on nodbet_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='nodbet_profiles' and policyname='user insert own nodbet profile') then
    create policy "user insert own nodbet profile" on nodbet_profiles for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='nodbet_profiles' and policyname='user update own nodbet profile') then
    create policy "user update own nodbet profile" on nodbet_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- Готово!
-- После выполнения:
--  - double_spin_enabled позволяет вкл/выкл дабл спин
--  - matches.maps[].cybershoke_url хранит ссылку на каждую катку
--  - cybershoke_url_2 / _3 — fallback колонки
--  - никнеймы починены: формат и уникальность
--  - баланс bigint без лимита
-- ============================================================
