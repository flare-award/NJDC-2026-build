-- ============================================================
-- МИГРАЦИЯ: Исправления Двойной-Рулетки NODBET
-- Выполните этот файл в Supabase → SQL Editor
-- 
-- Этот скрипт дополняет supabase-double-roulette-migration.sql
-- и добавляет улучшения, необходимые для корректной работы:
-- 
-- 1. Триггер автообновления updated_at
-- 2. Функция очистки устаревших лобби
-- 3. Индексы для подсчёта игроков в лобби
-- 4. Проверка Realtime-публикации
-- ============================================================

-- ==========================================
-- 1. ТРИГГЕР ДЛЯ АВТООБНОВЛЕНИЯ updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем к лобби, если ещё нет триггера
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_nodbet_double_lobbies'
  ) THEN
    CREATE TRIGGER set_updated_at_nodbet_double_lobbies
      BEFORE UPDATE ON public.nodbet_double_lobbies
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ==========================================
-- 2. ФУНКЦИЯ ОЧИСТКИ УСТАРЕВШИХ ЛОББИ
-- Удаляет лобби, которые не обновлялись > 2 часов
-- (можно вызывать вручную или по крону)
-- ==========================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_double_lobbies()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  cnt bigint;
BEGIN
  -- Удаляем лобби без игроков (все вышли) старше 30 минут
  WITH stale_empty AS (
    DELETE FROM public.nodbet_double_lobbies
    WHERE id IN (
      SELECT l.id
      FROM public.nodbet_double_lobbies l
      LEFT JOIN public.nodbet_double_lobby_players p ON p.lobby_id = l.id
      WHERE p.id IS NULL
        AND l.updated_at < NOW() - INTERVAL '30 minutes'
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO cnt FROM stale_empty;

  -- Удаляем лобби со статусом 'finished' старше 1 часа
  WITH stale_finished AS (
    DELETE FROM public.nodbet_double_lobbies
    WHERE status = 'finished'
      AND updated_at < NOW() - INTERVAL '1 hour'
    RETURNING 1
  )
  SELECT cnt + COUNT(*) INTO cnt FROM stale_finished;

  -- Удаляем лобби, которые не обновлялись > 4 часов (зависшие)
  WITH stale_stuck AS (
    DELETE FROM public.nodbet_double_lobbies
    WHERE updated_at < NOW() - INTERVAL '4 hours'
    RETURNING 1
  )
  SELECT cnt + COUNT(*) INTO cnt FROM stale_stuck;

  RETURN QUERY SELECT cnt;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 3. ИНДЕКС ДЛЯ БЫСТРОГО ПОДСЧЁТА ИГРОКОВ
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_nodbet_double_lobby_players_count
  ON public.nodbet_double_lobby_players(lobby_id, user_id);

-- ==========================================
-- 4. ПРОВЕРКА И ПОДКЛЮЧЕНИЕ REALTIME (повторно)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Убедимся, что обе таблицы в Realtime-публикации
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodbet_double_lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodbet_double_lobby_players;

-- ==========================================
-- 5. ПРОВЕРКА: RLS ПОЛИТИКИ
-- Убеждаемся, что политики включены
-- ==========================================
ALTER TABLE public.nodbet_double_lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodbet_double_lobby_players ENABLE ROW LEVEL SECURITY;

-- Если политики по какой-то причине отсутствуют — создаём
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nodbet_double_lobbies' AND policyname = 'Enable all for nodbet_double_lobbies'
  ) THEN
    CREATE POLICY "Enable all for nodbet_double_lobbies"
      ON public.nodbet_double_lobbies
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nodbet_double_lobby_players' AND policyname = 'Enable all for nodbet_double_lobby_players'
  ) THEN
    CREATE POLICY "Enable all for nodbet_double_lobby_players"
      ON public.nodbet_double_lobby_players
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ==========================================
-- ИТОГ: После выполнения этого скрипта:
-- 1. Лобби будут автоматически обновлять updated_at
-- 2. Старые/пустые лобби можно чистить вызовом:
--    SELECT * FROM cleanup_stale_double_lobbies();
-- 3. Подсчёт игроков работает быстрее
-- 4. Realtime гарантированно подключён
-- ==========================================
