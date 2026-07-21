-- ============================================================================
-- МИГРАЦИЯ: Двойная-Рулетка (Лобби) NODBET — Очистка неактивных лобби и триггер активности
-- Выполните этот файл в Supabase → SQL Editor
-- 
-- Этот скрипт добавляет:
-- 1. Триггер для автоматического обновления updated_at лобби при любых действиях игроков.
-- 2. Обновленную функцию cleanup_stale_double_lobbies(), которая удаляет 
--    неактивные лобби через 5 минут после пропажи активности.
-- ============================================================================

-- 1. Создаем функцию триггера для обновления времени активности родительского лобби
CREATE OR REPLACE FUNCTION public.touch_double_lobby_on_player_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.nodbet_double_lobbies
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.lobby_id, OLD.lobby_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер, если он существовал
DROP TRIGGER IF EXISTS trigger_touch_double_lobby ON public.nodbet_double_lobby_players;

-- Создаем триггер, который срабатывает при добавлении, изменении или удалении игроков в лобби
CREATE TRIGGER trigger_touch_double_lobby
AFTER INSERT OR UPDATE OR DELETE ON public.nodbet_double_lobby_players
FOR EACH ROW
EXECUTE FUNCTION public.touch_double_lobby_on_player_change();


-- 2. Обновленная функция автоочистки устаревших и неактивных лобби (старше 5 минут без активности)
CREATE OR REPLACE FUNCTION public.cleanup_stale_double_lobbies()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  cnt bigint;
BEGIN
  -- Удаляем любые лобби, которые не проявляли активности более 5 минут.
  -- Благодаря триггеру выше, любая активность игроков (вход, выход, выбор бонуса, готовность) 
  -- и keep-alive запросы с клиента продлевают жизнь лобби.
  WITH stale_lobbies AS (
    DELETE FROM public.nodbet_double_lobbies
    WHERE updated_at < NOW() - INTERVAL '5 minutes'
    RETURNING 1
  )
  SELECT COUNT(*) INTO cnt FROM stale_lobbies;

  RETURN QUERY SELECT cnt;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ПРОВЕРКА:
-- SELECT * FROM public.nodbet_double_lobbies;
-- SELECT * FROM public.nodbet_double_lobby_players;
-- ============================================================================
