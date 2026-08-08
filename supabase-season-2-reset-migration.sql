-- =========================================================
-- МИГРАЦИЯ: СБРОС ПРОГРЕССА ДЛЯ СЕЗОНА 2 NODBET
-- Выполните этот файл в Supabase → SQL Editor один раз для
-- полного сброса всех профилей, балансов, привилегий,
-- украшений и ставок до состояния чистого листа (Сезон 2).
-- =========================================================

-- 1. Сброс всех профилей пользователей до начальных значений Сезона 2 (10,000 NOD, 0 XP, без привилегий и украшений)
update nodbet_profiles
set
  balance = 10000,
  xp = 0,
  last_daily_claim = null,
  radar_unlocked = false,
  hall_frame = false,
  custom_status_owned = false,
  coin_magnet = false,
  crown_badge = false,
  star_trail = false,
  aura_owned = false,
  aura_color = 'red',
  aura_enabled = true,
  multi_bet = false,
  custom_status_text = null,
  total_won = 0,
  bets_count = 0,
  promo_used = false,
  bet_reconcile_v1_done = false,
  updated_at = now();

-- 2. Очистка старых ставок (Сезон 1)
delete from nodbet_bets;

-- 3. Очистка истории спинов рулетки (Сезон 1)
delete from nodbet_roulette_spins;

-- 4. Очистка лобби двойной рулетки
delete from nodbet_double_lobby_players;
delete from nodbet_double_lobbies;
