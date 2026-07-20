-- =========================================================
-- МИГРАЦИЯ SUPABASE: ПРОМОКОД, КОРОНА И КОМПЕНСАЦИЯ 250,000 NOD
--
-- Выполните ЭТОТ файл целиком в Supabase → SQL Editor ОДИН РАЗ.
-- Он содержит ТОЛЬКО новые команды для поддержки промокода
-- NJDC-BONUS-2026, новой привилегии «👑 Корона Хайроллера»
-- и разового начисления компенсации 250,000 NOD всем игрокам.
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

-- 3. Добавляем колонку compensation_250k_claimed в таблицу nodbet_profiles
--    и проводим РАЗОВОЕ начисление +250,000 NOD-Коинов всем игрокам
--    в качестве компенсации за обновление и прошлые неудобства.
alter table if exists nodbet_profiles
  add column if not exists compensation_250k_claimed boolean not null default false;

update nodbet_profiles
set balance = balance + 250000,
    compensation_250k_claimed = true
where compensation_250k_claimed = false;

-- =========================================================
-- Готово! После выполнения этого скрипта ваша база данных
-- полностью поддерживает промокоды, корону и все игроки
-- получают свою законную компенсацию +250,000 NOD.
-- =========================================================
