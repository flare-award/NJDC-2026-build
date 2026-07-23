-- ============================================================
-- МИГРАЦИЯ: Удаление колонок для удалённых привилегий
--
-- Выполните этот файл ЦЕЛИКОМ в Supabase → SQL Editor
-- ПОСЛЕ всех предыдущих миграций.
--
-- Что удаляет:
--  • double_spin (boolean) — привилегия "Дабл спин"
--  • double_spin_enabled (boolean) — флаг включения дабл-спина
--  • title_scroll (boolean) — привилегия "Титульный Свиток"
--  • neon_signature (boolean) — привилегия "Неоновая Подпись"
--
-- Эти привилегии удалены из магазина и больше не используются.
-- Миграция идемпотентна: безопасна для повторного запуска.
-- ============================================================

-- Удаляем колонки из таблицы nodbet_profiles
alter table if exists public.nodbet_profiles drop column if exists double_spin;
alter table if exists public.nodbet_profiles drop column if exists double_spin_enabled;
alter table if exists public.nodbet_profiles drop column if exists title_scroll;
alter table if exists public.nodbet_profiles drop column if exists neon_signature;

-- ============================================================
-- Готово! Колонки удалены из базы данных.
-- ============================================================
