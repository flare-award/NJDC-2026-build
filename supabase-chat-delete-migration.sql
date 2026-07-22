-- ============================================================
-- МИГРАЦИЯ: Удаление своих сообщений в чате NODBET
--
-- Выполните этот файл ЦЕЛИКОМ в Supabase → SQL Editor.
-- Требование: должна быть ранее выполнена миграция чата
-- (supabase-chat-migration.sql → таблица nodbet_chat_messages).
-- От миграции реакций НЕ зависит — можно применять до или после
-- supabase-chat-reactions-migration.sql.
-- Идемпотентен: повторный запуск безопасен.
--
-- Что делает:
--  1) Разрешает авторизованным пользователям удалять ТОЛЬКО СВОИ
--     сообщения чата (RLS-политика "chat delete own" + GRANT DELETE).
--  2) Реакции удалённого сообщения удаляются автоматически
--     (ON DELETE CASCADE из миграции реакций).
--  3) Realtime: удалённое сообщение мгновенно исчезает у всех
--     (таблица уже в публикации supabase_realtime; при DELETE
--     передаётся первичный ключ id — этого клиенту достаточно).
-- ============================================================

-- 1. GRANT: в миграции чата у ролей было отобрано всё и выданы
--    только SELECT + INSERT(колонки) — добавляем право на DELETE.
grant delete on table public.nodbet_chat_messages to authenticated;

-- 2. RLS-политика: удалять можно только собственные сообщения.
drop policy if exists "chat delete own" on public.nodbet_chat_messages;
create policy "chat delete own"
  on public.nodbet_chat_messages for delete
  using (auth.uid() is not null and auth.uid() = user_id);

-- ============================================================
-- Готово! Проверка (опционально):
--   select polname, polcmd, pg_get_expr(polqual, polrelid)
--   from pg_policies
--   where polrelid = 'public.nodbet_chat_messages'::regclass;
-- ============================================================
