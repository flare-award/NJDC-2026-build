-- ============================================================
-- МИГРАЦИЯ: Чат NODBET
--
-- Выполните этот файл ЦЕЛИКОМ в Supabase → SQL Editor.
-- Файл НЕЗАВИСИМ от других миграций: можно выполнять до или после
-- supabase-server-authoritative-migration.sql — конфликтов нет.
-- Идемпотентен: повторный запуск безопасен.
--
-- Что создаёт:
--  1) Таблицу nodbet_chat_messages (текстовые сообщения и
--     «шеры» выпавших бонусов из рулетки).
--  2) RLS: читать чат могут ВСЕ посетители, писать — только
--     авторизованные пользователи от своего имени.
--  3) Анти-спам триггер: не чаще 1 сообщения в 1.5 секунды,
--     ограничения длины текста и размера шара бонусов.
--  4) Авто-хранение истории: в таблице остаются последние
--     ~1000 сообщений (старые подчищаются автоматически).
--  5) Realtime: новые сообщения появляются у всех мгновенно.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. ТАБЛИЦА nodbet_chat_messages
--    id — монотонно растущий bigint: удобен и для сортировки,
--    и для пагинации «загрузить раньше» (cursor = минимальный id).
-- ============================================================
create table if not exists public.nodbet_chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null,                      -- = auth.users.id автора
  nickname text not null default '',          -- ник на момент отправки
  kind text not null default 'text'
    check (kind in ('text', 'share')),        -- text | share (шар бонусов)
  text text not null default ''
    check (char_length(text) <= 500),         -- подпись/сообщение
  bonuses jsonb not null default '[]'::jsonb, -- фишки бонусов для kind='share'
  created_at timestamptz not null default now(),

  constraint nodbet_chat_nickname_len check (char_length(nickname) <= 32),
  constraint nodbet_chat_bonuses_shape check (
    bonuses = '[]'::jsonb
    or (jsonb_typeof(bonuses) = 'array' and jsonb_array_length(bonuses) <= 10)
  )
);

create index if not exists idx_nodbet_chat_created
  on public.nodbet_chat_messages (id desc);

-- ============================================================
-- 2. АНТИ-СПАМ + АВТОЧИСТКА ИСТОРИИ
-- ============================================================
create or replace function public.nodbet_chat_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_text_len int;
begin
  -- Пустые текстовые сообщения не принимаем.
  v_text_len := char_length(btrim(coalesce(new.text, '')));
  if new.kind = 'text' and v_text_len = 0 then
    raise exception 'Пустое сообщение';
  end if;
  -- Для шара бонусов нужен хотя бы один бонус.
  if new.kind = 'share'
     and (jsonb_typeof(new.bonuses) is distinct from 'array' or jsonb_array_length(new.bonuses) = 0) then
    raise exception 'Нет бонусов для публикации';
  end if;

  -- Троттлинг: не чаще одного сообщения в 1.5 секунды на пользователя.
  select max(m.created_at) into v_last
  from public.nodbet_chat_messages m
  where m.user_id = new.user_id;
  if v_last is not null and clock_timestamp() - v_last < interval '1500 milliseconds' then
    raise exception 'Слишком частые сообщения. Подождите пару секунд!';
  end if;

  return new;
end $$;

drop trigger if exists nodbet_chat_guard_trigger on public.nodbet_chat_messages;
create trigger nodbet_chat_guard_trigger
  before insert on public.nodbet_chat_messages
  for each row execute function public.nodbet_chat_guard();

create or replace function public.nodbet_chat_retention()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Храним только последние ~1000 сообщений.
  delete from public.nodbet_chat_messages
  where id < new.id - 1000;
  return new;
end $$;

drop trigger if exists nodbet_chat_retention_trigger on public.nodbet_chat_messages;
create trigger nodbet_chat_retention_trigger
  after insert on public.nodbet_chat_messages
  for each row execute function public.nodbet_chat_retention();

-- ============================================================
-- 3. ПРАВА + RLS
--    Читают все (это открытый чат фанатов турнира).
--    Пишут только авторизованные; изменять/удалять чужое нельзя.
-- ============================================================
revoke all on table public.nodbet_chat_messages from anon;
revoke all on table public.nodbet_chat_messages from authenticated;
grant select on table public.nodbet_chat_messages to anon, authenticated;
grant insert (user_id, nickname, kind, text, bonuses)
  on table public.nodbet_chat_messages to authenticated;

alter table public.nodbet_chat_messages enable row level security;

drop policy if exists "chat read all" on public.nodbet_chat_messages;
create policy "chat read all"
  on public.nodbet_chat_messages for select
  using (true);

drop policy if exists "chat insert own" on public.nodbet_chat_messages;
create policy "chat insert own"
  on public.nodbet_chat_messages for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- ============================================================
-- 4. REALTIME
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nodbet_chat_messages'
  ) then
    alter publication supabase_realtime add table public.nodbet_chat_messages;
  end if;
end $$;

-- ============================================================
-- Готово! Проверка (опционально):
--   select * from public.nodbet_chat_messages order by id desc limit 20;
-- ============================================================
