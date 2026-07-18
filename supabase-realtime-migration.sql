-- =========================================================
-- МИГРАЦИЯ: Включение Realtime для NJDC 2026
-- Выполните этот файл в Supabase → SQL Editor
-- после применения основной схемы (supabase-schema.sql)
-- =========================================================

-- 1. Создаём publication для realtime (если ещё не создана)
create publication if not exists supabase_realtime;

-- 2. Добавляем таблицы в publication
--    Если таблица уже в publication — будет предупреждение, это нормально.
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table faq;
alter publication supabase_realtime add table settings;

-- =========================================================
-- Проверка: убедитесь что таблицы добавлены в realtime
-- =========================================================
-- Выполните этот запрос чтобы проверить:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
