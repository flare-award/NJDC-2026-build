-- ============================================================
-- NODBET — МИГРАЦИЯ НОВЫХ ПРЕДМЕТОВ МАГАЗИНА И АУРЫ
-- Выполните этот файл ОДИН РАЗ в Supabase -> SQL Editor
-- (после выполнения supabase-nodbet-migration.sql)
--
-- Что добавляет эта миграция:
--   1) star_trail      — ✨ Звёздный След (анимированные звёздные частицы в Зале Славы)
--   2) title_scroll    — 📜 Титульный Свиток (декоративный титул «★ Легенда NODBET ★» над никнеймом)
--   3) neon_signature  — 💫 Неоновая Подпись (пульсирующая неоновая подпись под никнеймом)
--   4) aura_owned      — 🔮 Аура (наличие купленной анимированной ауры в Зале Славы)
--   5) aura_color      — 🔮 Цвет Ауры (red, orange, yellow, green, cyan, blue, purple, pink)
--   6) aura_enabled    — 🔮 Включена/выключена Аура (переключатель ON/OFF в магазине)
--   7) multi_bet       — 🎯 Мульти-Ставка Хайроллера (повышение лимита в Клатч-Рулетке до 1,000,000 NOD)
-- ============================================================

-- 1. ✨ Звёздный След
alter table if exists nodbet_profiles
  add column if not exists star_trail boolean not null default false;

-- 2. 📜 Титульный Свиток
alter table if exists nodbet_profiles
  add column if not exists title_scroll boolean not null default false;

-- 3. 💫 Неоновая Подпись
alter table if exists nodbet_profiles
  add column if not exists neon_signature boolean not null default false;

-- 4. 🔮 Аура (факт покупки)
alter table if exists nodbet_profiles
  add column if not exists aura_owned boolean not null default false;

-- 5. 🔮 Цвет Ауры (по умолчанию red)
alter table if exists nodbet_profiles
  add column if not exists aura_color text not null default 'red';

-- 6. 🔮 Переключатель Ауры ВКЛ/ВЫКЛ (по умолчанию true)
alter table if exists nodbet_profiles
  add column if not exists aura_enabled boolean not null default true;

-- 7. 🎯 Мульти-Ставка Хайроллера (лимит ставки до 1,000,000 NOD)
alter table if exists nodbet_profiles
  add column if not exists multi_bet boolean not null default false;

-- ============================================================
-- Обновление существующих записей в таблице (если какие-то поля имели NULL)
-- ============================================================
update nodbet_profiles set star_trail = false where star_trail is null;
update nodbet_profiles set title_scroll = false where title_scroll is null;
update nodbet_profiles set neon_signature = false where neon_signature is null;
update nodbet_profiles set aura_owned = false where aura_owned is null;
update nodbet_profiles set aura_color = 'red' where aura_color is null or aura_color = '';
update nodbet_profiles set aura_enabled = true where aura_enabled is null;
update nodbet_profiles set multi_bet = false where multi_bet is null;

-- ============================================================
-- Готово! Теперь при покупке новых предметов, изменении цвета ауры
-- или переключении ON/OFF данные будут сохраняться в Supabase.
-- ============================================================
