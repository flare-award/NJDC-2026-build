-- =========================================================
-- МИГРАЦИЯ SUPABASE: ПРОМОКОД И КОРОНА
--
-- Выполните ЭТОТ файл целиком в Supabase → SQL Editor ОДИН РАЗ.
-- Он содержит ТОЛЬКО новые команды для поддержки промокода
-- NJDC-BONUS-2026 и новой привилегии «👑 Корона Хайроллера».
--
-- Предыдущие миграции (supabase-schema.sql, supabase-nodbet-migration.sql
-- и supabase-nodbet-fix-migration.sql) вы уже вводили, их повторять НЕ нужно.
-- =========================================================

-- 1. Добавляем колонку crown_badge в таблицу nodbet_profiles
--    «👑 Значок Короны Хайроллера» — новая элитная привилегия магазина.
alter table if exists nodbet_profiles
  add column if not exists crown_badge boolean not null default false;

-- 2. Добавляем колонку promo_used в таблицу nodbet_profiles
--    Флаг одноразовой активации промокода NJDC-BONUS-2026 (+10,000 NOD).
alter table if exists nodbet_profiles
  add column if not exists promo_used boolean not null default false;

-- =========================================================
-- Готово! После выполнения этого скрипта ваша база данных
-- полностью поддерживает промокоды и корону.
-- =========================================================
