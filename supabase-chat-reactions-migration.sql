-- ============================================================
-- МИГРАЦИЯ: Реакции в чате NODBET (лайки/дизлайки + эмодзи)
--
-- Выполните этот файл ЦЕЛИКОМ в Supabase → SQL Editor.
-- Требование: должна быть ранее выполнена миграция чата
-- (supabase-chat-migration.sql → таблица nodbet_chat_messages).
-- Идемпотентен: повторный запуск безопасен.
--
-- Что создаёт:
--  1) Таблицу nodbet_chat_reactions — кто, на какое сообщение
--     и какую реакцию поставил (лайк / дизлайк / эмодзи).
--  2) Серверную функцию nodbet_chat_toggle_reaction(...):
--       • повторное нажатие на ту же реакцию снимает её;
--       • лайк и дизлайк взаимоисключающие (переключают друг друга);
--       • не больше 5 разных эмодзи от одного пользователя
--         на одно сообщение;
--       • ник для всплывающей подсказки берётся из профиля.
--  3) RLS: читать реакции могут все посетители, а ставить/снимать —
--     только авторизованные и только через RPC (прямые
--     INSERT/UPDATE/DELETE запрещены).
--  4) Realtime: реакции появляются/исчезают мгновенно у всех.
-- ============================================================

-- ============================================================
-- 1. ТАБЛИЦА nodbet_chat_reactions
--    Одна строка = одна реакция одного пользователя на одно
--    сообщение. Уникальность (message_id, user_id, reaction)
--    не даёт поставить одну и ту же реакцию дважды.
--    ON DELETE CASCADE: при автоочистке старых сообщений чата
--    их реакции удаляются вместе с ними.
-- ============================================================
create table if not exists public.nodbet_chat_reactions (
  id bigint generated always as identity primary key,
  message_id bigint not null
    references public.nodbet_chat_messages(id) on delete cascade,
  user_id uuid not null,                    -- = auth.users.id автора реакции
  nickname text not null default '',        -- ник на момент реакции (для тултипа)
  reaction text not null,                   -- 'like' | 'dislike' | эмодзи из белого списка
  created_at timestamptz not null default now(),

  constraint nodbet_chat_reactions_uniq unique (message_id, user_id, reaction),
  constraint nodbet_chat_reactions_valid check (
    reaction in (
      'like', 'dislike',
      '❤️', '🔥', '😂', '😮', '😢', '👏',
      '💀', '🎉', '🤝', '💪', '🍀', '🤡'
    )
  ),
  constraint nodbet_chat_reactions_nick_len check (char_length(nickname) <= 32)
);

-- REPLICA IDENTITY FULL: чтобы realtime-события DELETE несли
-- полную старую строку (message_id, user_id, reaction), а не
-- только id — так клиент точно знает, какую реакцию снять.
alter table public.nodbet_chat_reactions replica identity full;

-- ============================================================
-- 2. RPC nodbet_chat_toggle_reaction
--    Единственная «дверь» для изменения реакций.
--    Возвращает jsonb:
--      { ok, action: 'added' | 'removed', reaction, replaced, row? }
--    • action='removed' — реакция стояла и теперь снята;
--    • action='added'   — реакция поставлена (row = созданная строка);
--    • replaced=true    — при добавлении like/dislike снят
--      противоположный ранее стоявший голос этого пользователя.
-- ============================================================
create or replace function public.nodbet_chat_toggle_reaction(
  p_message_id bigint,
  p_reaction text,
  p_nickname text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid();
  v_nick text;
  v_existing_id bigint;
  v_removed_other_id bigint;
  v_emoji_count int;
  v_row public.nodbet_chat_reactions%rowtype;
begin
  -- Только авторизованные.
  if v_uid is null then
    raise exception 'Требуется авторизация';
  end if;

  -- Белый список реакций (совпадает с CHECK таблицы).
  if p_reaction not in (
    'like', 'dislike',
    '❤️', '🔥', '😂', '😮', '😢', '👏',
    '💀', '🎉', '🤝', '💪', '🍀', '🤡'
  ) then
    raise exception 'Недопустимая реакция';
  end if;

  -- Сообщение должно существовать.
  if not exists (select 1 from public.nodbet_chat_messages m where m.id = p_message_id) then
    raise exception 'Сообщение не найдено';
  end if;

  -- Ник: профиль (источник правды) → переданный параметр → «Игрок».
  select pr.nickname into v_nick
  from public.nodbet_profiles pr
  where pr.user_id = v_uid;
  v_nick := left(
    coalesce(nullif(btrim(v_nick), ''), nullif(btrim(p_nickname), ''), 'Игрок'),
    32
  );

  -- Уже стоит такая же реакция? → снимаем (toggle off).
  select r.id into v_existing_id
  from public.nodbet_chat_reactions r
  where r.message_id = p_message_id and r.user_id = v_uid and r.reaction = p_reaction;

  if v_existing_id is not null then
    delete from public.nodbet_chat_reactions r where r.id = v_existing_id;
    return jsonb_build_object(
      'ok', true, 'action', 'removed', 'reaction', p_reaction, 'replaced', false
    );
  end if;

  -- Лайк и дизлайк взаимоисключающие: ставя один — снимаем другой.
  v_removed_other_id := null;
  if p_reaction = 'like' then
    delete from public.nodbet_chat_reactions r
      where r.message_id = p_message_id and r.user_id = v_uid and r.reaction = 'dislike'
      returning r.id into v_removed_other_id;
  elsif p_reaction = 'dislike' then
    delete from public.nodbet_chat_reactions r
      where r.message_id = p_message_id and r.user_id = v_uid and r.reaction = 'like'
      returning r.id into v_removed_other_id;
  else
    -- Ограничение: не больше 5 разных эмодзи от одного пользователя
    -- на одно сообщение (лайк/дизлайк не считаются).
    select count(*) into v_emoji_count
    from public.nodbet_chat_reactions r
    where r.message_id = p_message_id
      and r.user_id = v_uid
      and r.reaction <> 'like' and r.reaction <> 'dislike';
    if v_emoji_count >= 5 then
      raise exception 'Не больше 5 реакций на одно сообщение';
    end if;
  end if;

  insert into public.nodbet_chat_reactions (message_id, user_id, nickname, reaction)
  values (p_message_id, v_uid, v_nick, p_reaction)
  returning * into v_row;

  return jsonb_build_object(
    'ok', true, 'action', 'added', 'reaction', p_reaction,
    'replaced', v_removed_other_id is not null,
    'row', to_jsonb(v_row)
  );

exception
  -- Параллельные клики: вторая транзакция упирается в UNIQUE.
  -- Итог всё равно «реакция добавлена» — возвращаем существующую строку.
  when unique_violation then
    select * into v_row
    from public.nodbet_chat_reactions r
    where r.message_id = p_message_id and r.user_id = v_uid and r.reaction = p_reaction;
    return jsonb_build_object(
      'ok', true, 'action', 'added', 'reaction', p_reaction,
      'replaced', false, 'row', to_jsonb(v_row)
    );
end
$$;

revoke all on function public.nodbet_chat_toggle_reaction(bigint, text, text) from public, anon;
grant execute on function public.nodbet_chat_toggle_reaction(bigint, text, text) to authenticated;

-- ============================================================
-- 3. ПРАВА + RLS
--    Читают все (реакции видны и гостям). Пишет только RPC.
-- ============================================================
revoke all on table public.nodbet_chat_reactions from anon;
revoke all on table public.nodbet_chat_reactions from authenticated;
grant select on table public.nodbet_chat_reactions to anon, authenticated;

alter table public.nodbet_chat_reactions enable row level security;

drop policy if exists "chat reactions read all" on public.nodbet_chat_reactions;
create policy "chat reactions read all"
  on public.nodbet_chat_reactions for select
  using (true);

-- Политик INSERT/UPDATE/DELETE намеренно НЕТ: изменения только
-- через nodbet_chat_toggle_reaction (security definer).

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
      and tablename = 'nodbet_chat_reactions'
  ) then
    alter publication supabase_realtime add table public.nodbet_chat_reactions;
  end if;
end $$;

-- ============================================================
-- Готово! Проверка (опционально):
--   select message_id, reaction, count(*), string_agg(nickname, ', ')
--   from public.nodbet_chat_reactions
--   group by message_id, reaction
--   order by message_id desc;
-- ============================================================
