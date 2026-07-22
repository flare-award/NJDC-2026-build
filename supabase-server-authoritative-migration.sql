-- ============================================================
-- МИГРАЦИЯ: Server-Authoritative NODBET (честная экономика)
--
-- Выполните этот файл ЦЕЛИКОМ в Supabase → SQL Editor
-- ПОСЛЕ всех предыдущих миграций (schema, nodbet, double-roulette...).
--
-- Что делает:
--  1) Вся игровая логика с деньгами переносится в SQL-функции
--     (SECURITY DEFINER): рулетка, ежедневный бонус, промокод,
--     магазин, ставки на матчи, авто-расчёт ставок, Двойная-Рулетка.
--     Клиент больше НЕ может сам менять баланс/XP/историю.
--  2) Строгие права (GRANT/REVOKE) и RLS-политики:
--     пользователи напрямую меняют только «косметические» поля
--     своего профиля (ник, цвет ауры, статус, тумблер дабл-спина).
--  3) Значения (шансы, выплаты, цены, XP) зеркально повторяют
--     клиентскую логику, чтобы поведение игры НЕ изменилось.
--
-- Файл идемпотентен: можно запускать повторно без ошибок.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 0. НОВЫЕ КОЛОНКИ
-- ============================================================

-- Анти-спам троттлинг рулетки (серверный кулдаун между спинами).
alter table if exists public.nodbet_profiles
  add column if not exists last_spin_at timestamptz;

-- Привязка лобби и игроков Двойной-Рулетки к auth-аккаунтам
-- (user_id там исторически хранит НИКНЕЙМ, поэтому для денег
-- нужна настоящая ссылка на auth.users.id).
alter table if exists public.nodbet_double_lobbies
  add column if not exists host_auth_id uuid;
alter table if exists public.nodbet_double_lobby_players
  add column if not exists auth_user_id uuid;

create index if not exists idx_nodbet_double_players_auth
  on public.nodbet_double_lobby_players(auth_user_id);

-- ============================================================
-- 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (правила CS2 — зеркало matchMaps.ts)
-- ============================================================

-- Анализ счёта карты по правилам MR12 + овертаймы MR3.
create or replace function public.nodbet_map_analyze(a int, b int)
returns table(finished boolean, winner text, overtime_number int)
language plpgsql immutable as $$
declare
  hi int;
  lo int;
  n int;
begin
  a := greatest(0, coalesce(a, 0));
  b := greatest(0, coalesce(b, 0));
  if a = 0 and b = 0 then
    return query select false, null::text, 0;
    return;
  end if;
  hi := greatest(a, b);
  lo := least(a, b);
  -- Регулярка: первая команда до 13, у соперника <= 11.
  if hi = 13 and lo <= 11 then
    return query select true, case when a > b then 'a' else 'b' end, 0;
    return;
  end if;
  -- Овертаймы: hi = 16/19/22..., отрыв 2-4 раунда.
  if hi >= 16 and (hi - 13) % 3 = 0 then
    n := (hi - 13) / 3;
    if lo >= hi - 4 and lo <= hi - 2 then
      return query select true, case when a > b then 'a' else 'b' end, n;
      return;
    end if;
  end if;
  return query select false, null::text, 0;
end $$;

-- Был ли овертайм: обе команды >= 12 и счёт ушёл дальше 12:12.
create or replace function public.nodbet_map_had_overtime(a int, b int)
returns boolean language plpgsql immutable as $$
begin
  return least(greatest(0, coalesce(a, 0)), greatest(0, coalesce(b, 0))) >= 12
     and greatest(greatest(0, coalesce(a, 0)), greatest(0, coalesce(b, 0))) > 12;
end $$;

-- Пересчёт денормализованного счётчика «ставки + спины».
create or replace function public.nodbet_recount_bets_count(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.nodbet_profiles p
  set bets_count = coalesce((
        select count(*) from public.nodbet_bets b where b.user_id = p_user_id
      ), 0) + coalesce((
        select count(*) from public.nodbet_roulette_spins s where s.user_id = p_user_id
      ), 0)
  where p.user_id = p_user_id;
end $$;

-- ============================================================
-- 2. РУЛЕТКА: nodbet_spin(bet, mode)
--    Сервер сам выбирает бонус по честным весам пресета,
--    списывает/начисляет, пишет историю и возвращает результат.
--    Дабл-спин определяется инвентарём на сервере (2 вращения).
-- ============================================================
create or replace function public.nodbet_spin(p_bet_amount bigint, p_mode text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_mode text := lower(coalesce(p_mode, 'classic'));
  v_bet bigint := greatest(0, coalesce(p_bet_amount, 0));
  v_count int := 1;
  v_i int;
  v_total_delta bigint := 0;
  v_xp_raw int := 0;
  v_magnet numeric;
  v_bonus text;
  v_label text;
  v_mult numeric;
  v_neg boolean;
  v_delta bigint;
  v_roll numeric;
  v_spin_id text;
  v_results jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  if v_mode not in ('classic', 'allornothing') then
    return jsonb_build_object('ok', false, 'error', 'Неизвестный режим рулетки');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден. Перезагрузите страницу.');
  end if;

  -- Серверный кулдаун: честный игрок физически не крутит чаще
  -- (анимация спина 3.2с), поэтому 2.5с никому не мешает,
  -- но скрипт-спам RPC-спинами останавливает.
  if v_prof.last_spin_at is not null
     and v_now - v_prof.last_spin_at < interval '2500 milliseconds' then
    return jsonb_build_object('ok', false, 'error', 'Колесо ещё крутится — подождите пару секунд!');
  end if;

  -- Дабл-спин: только классика, куплен и включён (флаг на сервере).
  if v_mode = 'classic' and v_prof.double_spin and coalesce(v_prof.double_spin_enabled, true) then
    v_count := 2;
  end if;

  if v_bet > 0 then
    if v_bet * v_count > v_prof.balance then
      if v_count = 2 then
        return jsonb_build_object('ok', false, 'error',
          'Дабл спин ставит ' || v_bet || ' NOD дважды — не хватает баланса. Уменьшите ставку или выключите дабл спин.');
      end if;
      return jsonb_build_object('ok', false, 'error', 'Недостаточно NOD-Коинов для этого спина!');
    end if;
  end if;

  for v_i in 1..v_count loop
    -- Честный взвешенный выбор, веса = клиентские пресеты.
    if v_mode = 'classic' then
      v_roll := random() * 100;
      v_bonus := case
        when v_roll < 5 then 'strong_neg'
        when v_roll < 45 then 'normal'
        when v_roll < 65 then 'big'
        when v_roll < 75 then 'weak_neg'
        when v_roll < 90 then 'super'
        else 'jackpot' end;
    else
      v_bonus := case when random() < 0.5 then 'jackpot' else 'fail' end;
    end if;

    v_mult := case v_bonus
      when 'strong_neg' then -1.0 when 'weak_neg' then -0.5
      when 'normal' then 1.25 when 'big' then 1.8
      when 'super' then 2.5 when 'jackpot' then 5.0
      when 'fail' then -1.0 end;
    v_label := case v_bonus
      when 'strong_neg' then '💀 Крупная потеря' when 'weak_neg' then '🟤 Слабая потеря'
      when 'normal' then '⚫ Обычный бонус' when 'big' then '🔴 Большой бонус'
      when 'super' then '🟣 Супер-бонус' when 'jackpot' then '🟢 ДЖЕКПОТ'
      when 'fail' then '❌ Неудача' end;
    v_neg := v_bonus in ('strong_neg', 'weak_neg', 'fail');

    if v_bet <= 0 then
      -- Фри-спин: фиксированные награды без риска (как на клиенте).
      v_delta := case v_bonus
        when 'normal' then 50 when 'big' then 100
        when 'super' then 250 when 'jackpot' then 600
        else 0 end;
    elsif v_neg then
      v_delta := -round(v_bet * abs(v_mult));
    else
      v_delta := round(v_bet * v_mult) - v_bet;
    end if;

    v_total_delta := v_total_delta + v_delta;
    v_xp_raw := v_xp_raw + case when v_neg then 20 else 60 end;

    v_spin_id := 'spin_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    insert into public.nodbet_roulette_spins
      (user_id, id, bonus_id, label, multiplier, is_negative, won_coins, created_at)
    values
      (v_uid, v_spin_id, v_bonus, v_label, v_mult, v_neg, v_delta, v_now);

    v_results := v_results || jsonb_build_object(
      'id', v_spin_id,
      'bonus_id', v_bonus,
      'label', v_label,
      'multiplier', v_mult,
      'won_coins', v_delta,
      'is_negative', v_neg,
      'created_at', v_now
    );
  end loop;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;

  update public.nodbet_profiles
  set balance = greatest(0, balance + v_total_delta),
      xp = xp + round(v_xp_raw * v_magnet),
      last_spin_at = v_now
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  perform public.nodbet_recount_bets_count(v_uid);

  return jsonb_build_object(
    'ok', true,
    'results', v_results,
    'balance', v_prof.balance,
    'xp', v_prof.xp
  );
end $$;

-- ============================================================
-- 3. ЕЖЕДНЕВНЫЙ БОНУС: +500 NOD раз в день (по UTC-дате)
-- ============================================================
create or replace function public.nodbet_claim_daily()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_reward int := 500;
  v_magnet numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;
  if v_prof.last_daily_claim is not null
     and (v_prof.last_daily_claim at time zone 'UTC')::date = (now() at time zone 'UTC')::date then
    return jsonb_build_object('ok', false, 'error', 'Вы уже забирали бонус сегодня. Приходите завтра!');
  end if;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  update public.nodbet_profiles
  set balance = balance + v_reward,
      xp = xp + round(200 * v_magnet),
      last_daily_claim = clock_timestamp()
  where user_id = v_uid
  returning balance, xp, last_daily_claim into v_prof.balance, v_prof.xp, v_prof.last_daily_claim;

  return jsonb_build_object(
    'ok', true, 'reward', v_reward,
    'balance', v_prof.balance, 'xp', v_prof.xp,
    'last_daily_claim', v_prof.last_daily_claim
  );
end $$;

-- ============================================================
-- 4. ПРОМОКОД: одноразовый NJDC-BONUS-2026 на +10 000 NOD
-- ============================================================
create or replace function public.nodbet_activate_promo(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  if v_code <> 'NJDC-BONUS-2026' then
    return jsonb_build_object('ok', false, 'error', 'Неверный или просроченный промокод!');
  end if;
  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;
  if coalesce(v_prof.promo_used, false) then
    return jsonb_build_object('ok', false, 'error', 'Этот промокод уже был активирован на вашем аккаунте!');
  end if;

  update public.nodbet_profiles
  set balance = balance + 10000, promo_used = true
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object('ok', true, 'balance', v_prof.balance, 'xp', v_prof.xp);
end $$;

-- ============================================================
-- 5. МАГАЗИН: покупка привилегий (цены = клиентский каталог)
-- ============================================================
create or replace function public.nodbet_buy_perk(p_perk_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_perk text := lower(trim(coalesce(p_perk_id, '')));
  v_cost bigint;
  v_owned boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  v_cost := case v_perk
    when 'radar' then 1530000
    when 'hall_frame' then 7225000
    when 'crown_badge' then 21250000
    when 'custom_status' then 40800000
    when 'double_spin' then 63750000
    when 'coin_magnet' then 5525000000
    when 'star_trail' then 3500000
    when 'title_scroll' then 3200000
    when 'neon_signature' then 4500000
    when 'aura' then 9500000
    when 'multi_bet' then 2500000
    else null end;
  if v_cost is null then
    return jsonb_build_object('ok', false, 'error', 'Привилегия не найдена');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;

  v_owned := case v_perk
    when 'radar' then v_prof.radar_unlocked
    when 'hall_frame' then v_prof.hall_frame
    when 'crown_badge' then coalesce(v_prof.crown_badge, false)
    when 'custom_status' then v_prof.custom_status_owned
    when 'double_spin' then v_prof.double_spin
    when 'coin_magnet' then v_prof.coin_magnet
    when 'star_trail' then coalesce(v_prof.star_trail, false)
    when 'title_scroll' then coalesce(v_prof.title_scroll, false)
    when 'neon_signature' then coalesce(v_prof.neon_signature, false)
    when 'aura' then coalesce(v_prof.aura_owned, false)
    when 'multi_bet' then coalesce(v_prof.multi_bet, false)
    else false end;
  if coalesce(v_owned, false) then
    return jsonb_build_object('ok', false, 'error', 'Эта привилегия у вас уже есть!');
  end if;
  if v_prof.balance < v_cost then
    return jsonb_build_object('ok', false, 'error', 'Недостаточно монет! Требуется ' || v_cost || ' NOD.');
  end if;

  update public.nodbet_profiles set
    balance = balance - v_cost,
    xp = xp + 500,
    radar_unlocked      = case when v_perk = 'radar' then true else radar_unlocked end,
    hall_frame          = case when v_perk = 'hall_frame' then true else hall_frame end,
    crown_badge         = case when v_perk = 'crown_badge' then true else coalesce(crown_badge, false) end,
    custom_status_owned = case when v_perk = 'custom_status' then true else custom_status_owned end,
    double_spin         = case when v_perk = 'double_spin' then true else double_spin end,
    double_spin_enabled = case when v_perk = 'double_spin' then true else coalesce(double_spin_enabled, true) end,
    coin_magnet         = case when v_perk = 'coin_magnet' then true else coin_magnet end,
    star_trail          = case when v_perk = 'star_trail' then true else coalesce(star_trail, false) end,
    title_scroll        = case when v_perk = 'title_scroll' then true else coalesce(title_scroll, false) end,
    neon_signature      = case when v_perk = 'neon_signature' then true else coalesce(neon_signature, false) end,
    aura_owned          = case when v_perk = 'aura' then true else coalesce(aura_owned, false) end,
    multi_bet           = case when v_perk = 'multi_bet' then true else coalesce(multi_bet, false) end
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object('ok', true, 'balance', v_prof.balance, 'xp', v_prof.xp, 'perk', v_perk);
end $$;

-- ============================================================
-- 6. СТАВКИ НА МАТЧИ
-- ============================================================

-- Поставить ставку. Коэффициент считается на сервере по той же
-- формуле, что и на клиенте (от match_number и map_index).
create or replace function public.nodbet_place_bet(
  p_match_id text,
  p_map_index int,
  p_team_choice text,
  p_amount bigint,
  p_overtime boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_match public.matches%rowtype;
  v_amount bigint := coalesce(p_amount, 0);
  v_max_maps int;
  v_odds numeric;
  v_team_name text;
  v_bet_id text;
  v_magnet numeric;
  v_dup int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Укажите корректную сумму ставки');
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Матч не найден');
  end if;
  if v_match.status = 'live' then
    return jsonb_build_object('ok', false, 'error', 'Ставки в LIVE запрещены правилами честной игры. Можно ставить только до старта матча!');
  end if;
  if v_match.status <> 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'Матч уже завершён или идёт в реальном времени. Ставка отклонена.');
  end if;

  v_max_maps := case v_match.format when 'bo1' then 1 when 'bo2' then 2 else 3 end;
  if p_map_index is null or p_map_index < 0 or p_map_index >= v_max_maps then
    return jsonb_build_object('ok', false, 'error', 'Некорректная карта матча');
  end if;
  if p_team_choice is null or (p_team_choice is distinct from v_match.team_a and p_team_choice is distinct from v_match.team_b) then
    return jsonb_build_object('ok', false, 'error', 'Некорректная команда');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;
  if v_amount > v_prof.balance then
    return jsonb_build_object('ok', false, 'error', 'Недостаточно NOD-Коинов для такой ставки!');
  end if;

  select count(*) into v_dup from public.nodbet_bets
  where user_id = v_uid and match_id = p_match_id and map_index = p_map_index and status = 'pending';
  if v_dup > 0 then
    return jsonb_build_object('ok', false, 'error',
      'Вы уже сделали ставку на Карту ' || (p_map_index + 1) || ' этого матча. Дождитесь её расчёта.');
  end if;

  -- Формула коэффициентов — зеркало клиентской (placeBet).
  if p_team_choice = v_match.team_a then
    v_odds := round(((1.75 + (v_match.match_number % 3) * 0.13 + p_map_index * 0.05 + 0.25) * 100)::numeric) / 100;
  else
    v_odds := round(((2.05 - (v_match.match_number % 3) * 0.11 + p_map_index * 0.05 + 0.25) * 100)::numeric) / 100;
  end if;

  select name into v_team_name from public.teams where id = p_team_choice;
  v_team_name := coalesce(v_team_name, p_team_choice);
  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  v_bet_id := 'bet_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.nodbet_bets
    (user_id, id, match_id, match_title, map_index, team_choice, team_name,
     amount, odds, overtime_prediction, status, payout, created_at)
  values
    (v_uid, v_bet_id, p_match_id, coalesce(v_match.title, ''), p_map_index, p_team_choice, v_team_name,
     v_amount, v_odds, coalesce(p_overtime, false), 'pending', 0, clock_timestamp());

  update public.nodbet_profiles
  set balance = balance - v_amount,
      xp = xp + round(v_amount / 50.0 * v_magnet)
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  perform public.nodbet_recount_bets_count(v_uid);

  return jsonb_build_object(
    'ok', true,
    'balance', v_prof.balance,
    'xp', v_prof.xp,
    'bet', jsonb_build_object(
      'id', v_bet_id,
      'match_id', p_match_id,
      'match_title', coalesce(v_match.title, ''),
      'map_index', p_map_index,
      'team_choice', p_team_choice,
      'team_name', v_team_name,
      'amount', v_amount,
      'odds', v_odds,
      'overtime_prediction', coalesce(p_overtime, false),
      'status', 'pending',
      'payout', 0
    )
  );
end $$;

-- Отменить ставку (только pending и только если матч ещё upcoming).
create or replace function public.nodbet_cancel_bet(p_bet_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet public.nodbet_bets%rowtype;
  v_match_status text;
  v_balance bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  select * into v_bet from public.nodbet_bets
  where user_id = v_uid and id = p_bet_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ставка не найдена');
  end if;
  if v_bet.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Эта ставка уже рассчитана и её нельзя отменить.');
  end if;
  select status into v_match_status from public.matches where id = v_bet.match_id;
  if v_match_status is distinct from 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'Отменять можно только ставки на будущие матчи. Этот матч уже идёт или завершён.');
  end if;

  update public.nodbet_bets
  set status = 'cancelled', payout = 0
  where user_id = v_uid and id = p_bet_id;

  update public.nodbet_profiles
  set balance = balance + v_bet.amount
  where user_id = v_uid
  returning balance into v_balance;

  return jsonb_build_object('ok', true, 'refund', v_bet.amount, 'balance', v_balance, 'bet_id', p_bet_id);
end $$;

-- Авто-расчёт pending-ставок по завершённому матчу (зеркало
-- клиентского computeBetOutcome: правила CS2 + прогноз овертайма).
create or replace function public.nodbet_settle_my_bets(p_match_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_match public.matches%rowtype;
  v_bet record;
  v_max_maps int;
  v_relevant int;
  v_wins_a int := 0;
  v_wins_b int := 0;
  v_i int;
  v_a int;
  v_b int;
  v_fin boolean;
  v_win text;
  v_otn int;
  v_ot boolean;
  v_maps_len int;
  v_new_status text;
  v_new_payout bigint;
  v_delta bigint := 0;
  v_xp_delta int := 0;
  v_magnet numeric;
  v_settled int := 0;
  v_changed jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Матч не найден');
  end if;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;

  if v_match.status <> 'finished' then
    return jsonb_build_object('ok', true, 'settled', 0, 'balance', v_prof.balance, 'xp', v_prof.xp, 'bets', '[]'::jsonb);
  end if;

  v_max_maps := case v_match.format when 'bo1' then 1 when 'bo2' then 2 else 3 end;
  v_maps_len := coalesce(jsonb_array_length(v_match.maps), 0);

  -- relevantMapCount: для Bo3 при 2:0 третья карта не нужна.
  v_relevant := v_max_maps;
  if v_match.format = 'bo3' then
    for v_i in 0..1 loop
      v_a := coalesce((v_match.maps -> v_i ->> 'score_a')::int, 0);
      v_b := coalesce((v_match.maps -> v_i ->> 'score_b')::int, 0);
      select finished, winner into v_fin, v_win from public.nodbet_map_analyze(v_a, v_b);
      if v_win = 'a' then v_wins_a := v_wins_a + 1; end if;
      if v_win = 'b' then v_wins_b := v_wins_b + 1; end if;
    end loop;
    if v_wins_a = 2 or v_wins_b = 2 then
      v_relevant := 2;
    end if;
  end if;

  for v_bet in
    select * from public.nodbet_bets
    where user_id = v_uid and match_id = p_match_id and status = 'pending'
    order by created_at
    for update
  loop
    -- Нормализация карты (зеркало normalizeMaps).
    if v_match.format = 'bo1' and v_maps_len = 0 then
      v_a := greatest(0, coalesce(v_match.score_a, 0));
      v_b := greatest(0, coalesce(v_match.score_b, 0));
    else
      v_a := coalesce((v_match.maps -> v_bet.map_index ->> 'score_a')::int, 0);
      v_b := coalesce((v_match.maps -> v_bet.map_index ->> 'score_b')::int, 0);
    end if;

    select ma.finished, ma.winner, ma.overtime_number into v_fin, v_win, v_otn
    from public.nodbet_map_analyze(v_a, v_b) ma;

    if not v_fin then
      if v_bet.map_index >= v_relevant then
        v_new_status := 'refunded';
        v_new_payout := v_bet.amount;
        v_delta := v_delta + v_bet.amount;
      else
        continue; -- карта ещё не доиграна — ждём
      end if;
    else
      v_ot := public.nodbet_map_had_overtime(v_a, v_b);
      if coalesce(v_bet.overtime_prediction, false) <> v_ot then
        v_new_status := 'lost';
        v_new_payout := 0;
      elsif (v_win = 'a' and v_bet.team_choice = v_match.team_a)
         or (v_win = 'b' and v_bet.team_choice = v_match.team_b) then
        v_new_status := 'won';
        v_new_payout := round(v_bet.amount * v_bet.odds);
        v_delta := v_delta + v_new_payout;
        v_xp_delta := v_xp_delta + round(v_new_payout / 20.0 * v_magnet);
      else
        v_new_status := 'lost';
        v_new_payout := 0;
      end if;
    end if;

    update public.nodbet_bets
    set status = v_new_status, payout = v_new_payout
    where user_id = v_uid and id = v_bet.id;

    v_settled := v_settled + 1;
    v_changed := v_changed || jsonb_build_object(
      'id', v_bet.id, 'status', v_new_status, 'payout', v_new_payout
    );
  end loop;

  update public.nodbet_profiles
  set balance = greatest(0, balance + v_delta),
      xp = xp + v_xp_delta
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true, 'settled', v_settled,
    'balance', v_prof.balance, 'xp', v_prof.xp,
    'bets', v_changed
  );
end $$;

-- Разовый пересчёт уже рассчитанных ставок (зеркало клиентского
-- reconcile, пункт 8): исправляет ошибочно рассчитанные won/lost,
-- затем помечает профиль флагом bet_reconcile_v1_done.
create or replace function public.nodbet_reconcile_my_bets()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_bet record;
  v_match public.matches%rowtype;
  v_max_maps int;
  v_relevant int;
  v_wins_a int;
  v_wins_b int;
  v_i int;
  v_a int;
  v_b int;
  v_fin boolean;
  v_win text;
  v_ot boolean;
  v_maps_len int;
  v_new_status text;
  v_new_payout bigint;
  v_delta bigint := 0;
  v_xp_delta int := 0;
  v_magnet numeric;
  v_changed jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;

  for v_bet in
    select * from public.nodbet_bets
    where user_id = v_uid and status in ('won', 'lost')
    order by created_at
    for update
  loop
    select * into v_match from public.matches where id = v_bet.match_id;
    if not found then continue; end if;

    v_max_maps := case v_match.format when 'bo1' then 1 when 'bo2' then 2 else 3 end;
    if v_bet.map_index is null or v_bet.map_index < 0 or v_bet.map_index >= v_max_maps then
      continue;
    end if;
    v_maps_len := coalesce(jsonb_array_length(v_match.maps), 0);

    v_relevant := v_max_maps;
    if v_match.format = 'bo3' then
      v_wins_a := 0; v_wins_b := 0;
      for v_i in 0..1 loop
        v_a := coalesce((v_match.maps -> v_i ->> 'score_a')::int, 0);
        v_b := coalesce((v_match.maps -> v_i ->> 'score_b')::int, 0);
        select finished, winner into v_fin, v_win from public.nodbet_map_analyze(v_a, v_b);
        if v_win = 'a' then v_wins_a := v_wins_a + 1; end if;
        if v_win = 'b' then v_wins_b := v_wins_b + 1; end if;
      end loop;
      if v_wins_a = 2 or v_wins_b = 2 then
        v_relevant := 2;
      end if;
    end if;

    if v_match.format = 'bo1' and v_maps_len = 0 then
      v_a := greatest(0, coalesce(v_match.score_a, 0));
      v_b := greatest(0, coalesce(v_match.score_b, 0));
    else
      v_a := coalesce((v_match.maps -> v_bet.map_index ->> 'score_a')::int, 0);
      v_b := coalesce((v_match.maps -> v_bet.map_index ->> 'score_b')::int, 0);
    end if;

    select ma.finished, ma.winner into v_fin, v_win from public.nodbet_map_analyze(v_a, v_b) ma;

    if not v_fin then
      if v_bet.map_index >= v_relevant then
        v_new_status := 'refunded';
        v_new_payout := v_bet.amount;
      else
        continue; -- исход определить нельзя — не трогаем
      end if;
    else
      v_ot := public.nodbet_map_had_overtime(v_a, v_b);
      if coalesce(v_bet.overtime_prediction, false) <> v_ot then
        v_new_status := 'lost';
        v_new_payout := 0;
      elsif (v_win = 'a' and v_bet.team_choice = v_match.team_a)
         or (v_win = 'b' and v_bet.team_choice = v_match.team_b) then
        v_new_status := 'won';
        v_new_payout := round(v_bet.amount * v_bet.odds);
      else
        v_new_status := 'lost';
        v_new_payout := 0;
      end if;
    end if;

    if v_new_status = v_bet.status and v_new_payout = v_bet.payout then
      continue;
    end if;

    v_delta := v_delta + (v_new_payout - v_bet.payout);
    if v_new_status = 'won' and v_bet.status <> 'won' then
      v_xp_delta := v_xp_delta + round(v_new_payout / 20.0 * v_magnet);
    end if;

    update public.nodbet_bets
    set status = v_new_status, payout = v_new_payout
    where user_id = v_uid and id = v_bet.id;

    v_changed := v_changed || jsonb_build_object(
      'id', v_bet.id, 'status', v_new_status, 'payout', v_new_payout
    );
  end loop;

  update public.nodbet_profiles
  set balance = greatest(0, balance + v_delta),
      xp = xp + v_xp_delta,
      bet_reconcile_v1_done = true
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true,
    'balance', v_prof.balance, 'xp', v_prof.xp,
    'changed', v_changed
  );
end $$;

-- ============================================================
-- 7. ДВОЙНАЯ-РУЛЕТКА (лобби)
-- ============================================================

-- Фиксация ставки и скрытого пика (списание на сервере).
create or replace function public.nodbet_double_place_bet(
  p_lobby_id uuid,
  p_bet_amount bigint,
  p_selected_bonus_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_lobby public.nodbet_double_lobbies%rowtype;
  v_player public.nodbet_double_lobby_players%rowtype;
  v_amount bigint := coalesce(p_bet_amount, 0);
  v_bonus text := lower(trim(coalesce(p_selected_bonus_id, '')));
  v_magnet numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  if v_bonus not in ('neg_jackpot','neg_weak','normal','big','super','jackpot','ultra_reverse','mega_bonus') then
    return jsonb_build_object('ok', false, 'error', 'Выберите один из 8 бонусов на рулетке!');
  end if;

  select * into v_lobby from public.nodbet_double_lobbies where id = p_lobby_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Лобби не найдено');
  end if;
  if v_lobby.status <> 'betting' then
    return jsonb_build_object('ok', false, 'error', 'Приём ставок в этом лобби ещё не открыт или уже завершён.');
  end if;

  select * into v_player from public.nodbet_double_lobby_players
  where lobby_id = p_lobby_id and auth_user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Вы не участвуете в этом лобби.');
  end if;
  if v_player.is_ready and v_player.selected_bonus_id is not null then
    return jsonb_build_object('ok', false, 'error', 'Ваш выбор уже зафиксирован! Ожидаем вращения...');
  end if;
  if v_amount < v_lobby.min_bet then
    return jsonb_build_object('ok', false, 'error',
      'Минимальная ставка в этом лобби составляет ' || v_lobby.min_bet || ' NOD!');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;
  if v_amount > v_prof.balance then
    return jsonb_build_object('ok', false, 'error', 'Недостаточно NOD на балансе!');
  end if;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  update public.nodbet_profiles
  set balance = balance - v_amount,
      xp = xp + round(v_amount / 30.0 * v_magnet)
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  update public.nodbet_double_lobby_players
  set bet_amount = v_amount,
      selected_bonus_id = v_bonus,
      is_ready = true
  where lobby_id = p_lobby_id and auth_user_id = v_uid;

  return jsonb_build_object('ok', true, 'balance', v_prof.balance, 'xp', v_prof.xp);
end $$;

-- Управление раундом от имени хоста: start (ставки 12с),
-- reset (снова waiting), finish (завершить после вращения —
-- может вызвать и игрок-участник, если хост оффлайн).
create or replace function public.nodbet_double_round_control(p_lobby_id uuid, p_action text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lobby public.nodbet_double_lobbies%rowtype;
  v_players int;
  v_is_member boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;
  select * into v_lobby from public.nodbet_double_lobbies where id = p_lobby_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Лобби не найдено');
  end if;

  select count(*) into v_players from public.nodbet_double_lobby_players where lobby_id = p_lobby_id;
  select exists(
    select 1 from public.nodbet_double_lobby_players
    where lobby_id = p_lobby_id and auth_user_id = v_uid
  ) into v_is_member;

  if p_action = 'start' then
    if v_lobby.host_auth_id is distinct from v_uid then
      return jsonb_build_object('ok', false, 'error', 'Только хост может начать раунд');
    end if;
    if v_lobby.status <> 'waiting' then
      return jsonb_build_object('ok', false, 'error', 'Раунд уже запущен');
    end if;
    if v_players < 2 then
      return jsonb_build_object('ok', false, 'error', 'Минимум 2 игрока должны зайти в лобби перед стартом!');
    end if;
    update public.nodbet_double_lobby_players
    set selected_bonus_id = null, is_ready = false, bet_amount = v_lobby.min_bet
    where lobby_id = p_lobby_id;
    update public.nodbet_double_lobbies
    set status = 'betting',
        timer_ends_at = clock_timestamp() + interval '12 seconds',
        winning_bonus_id = null
    where id = p_lobby_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'reset' then
    if v_lobby.host_auth_id is distinct from v_uid then
      return jsonb_build_object('ok', false, 'error', 'Только хост может сбросить лобби');
    end if;
    update public.nodbet_double_lobby_players
    set selected_bonus_id = null, is_ready = false, bet_amount = v_lobby.min_bet
    where lobby_id = p_lobby_id;
    update public.nodbet_double_lobbies
    set status = 'waiting', winning_bonus_id = null, timer_ends_at = null
    where id = p_lobby_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'finish' then
    if v_lobby.host_auth_id is distinct from v_uid and not v_is_member then
      return jsonb_build_object('ok', false, 'error', 'Только участники лобби могут завершить раунд');
    end if;
    if v_lobby.status = 'spinning' then
      update public.nodbet_double_lobbies set status = 'finished' where id = p_lobby_id;
    end if;
    return jsonb_build_object('ok', true);

  else
    return jsonb_build_object('ok', false, 'error', 'Неизвестное действие');
  end if;
end $$;

-- Розыгрыш Двойной-Рулетки: сервер выбирает сектор (равномерно
-- 1 из 8), считает результаты по тем же правилам, что и клиент,
-- начисляет выигрыши ВСЕМ участникам атомарно и переводит лобби
-- в 'spinning' (клиенты анимируют колесо к этому сектору).
create or replace function public.nodbet_double_spin(p_lobby_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lobby public.nodbet_double_lobbies%rowtype;
  v_win text;
  v_participants int;
  v_winners int;
  v_losers_pool bigint;
  v_share bigint;
  v_mult numeric;
  v_payout bigint;
  v_player record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  select * into v_lobby from public.nodbet_double_lobbies where id = p_lobby_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Лобби не найдено');
  end if;

  -- Идемпотентность: если спин уже выполнен — просто вернуть сектор.
  if v_lobby.status <> 'betting' then
    return jsonb_build_object('ok', true, 'already', true, 'winning_bonus_id', v_lobby.winning_bonus_id);
  end if;

  -- Запустить может хост в любой момент фазы ставок, либо любой
  -- участник после окончания таймера (+ небольшой запас на запись
  -- авто-выборов остальных игроков).
  if v_lobby.host_auth_id is distinct from v_uid
     and (v_lobby.timer_ends_at is null or clock_timestamp() < v_lobby.timer_ends_at + interval '5 seconds') then
    return jsonb_build_object('ok', false, 'error', 'Запустить колесо может только хост после окончания таймера');
  end if;

  -- Равномерный выбор 1 из 8 (порядок = DOUBLE_BONUS_ORDER).
  v_win := (array['neg_jackpot','normal','big','neg_weak','super','jackpot','ultra_reverse','mega_bonus'])[1 + floor(random() * 8)];

  select count(*),
         count(*) filter (where selected_bonus_id = v_win),
         coalesce(sum(bet_amount) filter (where selected_bonus_id is distinct from v_win), 0)
    into v_participants, v_winners, v_losers_pool
  from public.nodbet_double_lobby_players
  where lobby_id = p_lobby_id and selected_bonus_id is not null;

  v_mult := case v_win
    when 'neg_jackpot' then 5.0 when 'neg_weak' then 1.5
    when 'normal' then 1.25 when 'big' then 1.8
    when 'super' then 2.5 when 'jackpot' then 5.0
    when 'ultra_reverse' then 5.0 when 'mega_bonus' then 3.5 end;

  for v_player in
    select * from public.nodbet_double_lobby_players
    where lobby_id = p_lobby_id and selected_bonus_id is not null
  loop
    if v_participants > 0 and v_winners = v_participants then
      -- allGuessed: каждый получает лишь bet x1.1
      v_payout := round(v_player.bet_amount * 1.1);
    elsif v_winners = 0 then
      -- noneGuessed: все теряют ставки
      v_payout := 0;
    elsif v_player.selected_bonus_id = v_win then
      v_share := round(v_losers_pool::numeric / v_winners);
      v_payout := v_player.bet_amount + v_share + round(v_player.bet_amount * greatest(0, v_mult - 1));
    else
      v_payout := 0;
    end if;

    if v_payout > 0 and v_player.auth_user_id is not null then
      -- Начисляем выплату и XP (зеркало: round(round(payout/20) * magnet)).
      update public.nodbet_profiles
      set balance = balance + v_payout,
          xp = xp + round(round(v_payout / 20.0) * case when coin_magnet then 1.1 else 1.0 end)
      where user_id = v_player.auth_user_id;
    end if;
  end loop;

  update public.nodbet_double_lobbies
  set status = 'spinning', winning_bonus_id = v_win
  where id = p_lobby_id;

  return jsonb_build_object('ok', true, 'winning_bonus_id', v_win);
end $$;

-- Очистка устаревших лобби теперь требует прав дефинера
-- (RLS больше не разрешает удалять чужие строки).
create or replace function public.cleanup_stale_double_lobbies()
returns table(deleted_count bigint)
language plpgsql security definer set search_path = public as $$
declare
  cnt bigint := 0;
  c2 bigint := 0;
  c3 bigint := 0;
begin
  with stale_empty as (
    delete from public.nodbet_double_lobbies
    where id in (
      select l.id
      from public.nodbet_double_lobbies l
      left join public.nodbet_double_lobby_players p on p.lobby_id = l.id
      where p.id is null
        and l.updated_at < now() - interval '30 minutes'
    )
    returning 1
  )
  select count(*) into cnt from stale_empty;

  with stale_finished as (
    delete from public.nodbet_double_lobbies
    where status = 'finished'
      and updated_at < now() - interval '1 hour'
    returning 1
  )
  select count(*) into c2 from stale_finished;

  with stale_stuck as (
    delete from public.nodbet_double_lobbies
    where updated_at < now() - interval '4 hours'
    returning 1
  )
  select count(*) into c3 from stale_stuck;

  return query select cnt + c2 + c3;
end $$;

-- ============================================================
-- 8. ПРАВА ДОСТУПА (GRANT/REVOKE)
--    Деньги/XP/историю меняют ТОЛЬКО функции выше (definer).
-- ============================================================

-- --- nodbet_profiles ---
revoke all on table public.nodbet_profiles from anon;
revoke all on table public.nodbet_profiles from authenticated;
grant select on table public.nodbet_profiles to anon, authenticated;
-- Создать профиль можно только «пустым» (баланс = default 10000).
grant insert (user_id, nickname) on table public.nodbet_profiles to authenticated;
-- Напрямую разрешены только косметические поля.
grant update (nickname, custom_status_text, aura_color, aura_enabled, double_spin_enabled)
  on table public.nodbet_profiles to authenticated;

-- --- nodbet_bets / nodbet_roulette_spins: только чтение своих ---
revoke all on table public.nodbet_bets from anon;
revoke all on table public.nodbet_bets from authenticated;
grant select on table public.nodbet_bets to authenticated;

revoke all on table public.nodbet_roulette_spins from anon;
revoke all on table public.nodbet_roulette_spins from authenticated;
grant select on table public.nodbet_roulette_spins to authenticated;

-- --- Двойная-Рулетка: лобби ---
revoke all on table public.nodbet_double_lobbies from anon;
revoke all on table public.nodbet_double_lobbies from authenticated;
grant select on table public.nodbet_double_lobbies to anon, authenticated;
grant insert (host_id, host_nickname, host_auth_id, name, max_players, min_bet, status)
  on table public.nodbet_double_lobbies to authenticated;
-- Хосту — только keep-alive (updated_at); статусы/сектор — через RPC.
grant update (updated_at) on table public.nodbet_double_lobbies to authenticated;
grant delete on table public.nodbet_double_lobbies to authenticated;

-- --- Двойная-Рулетка: игроки ---
revoke all on table public.nodbet_double_lobby_players from anon;
revoke all on table public.nodbet_double_lobby_players from authenticated;
grant select on table public.nodbet_double_lobby_players to anon, authenticated;
grant insert (lobby_id, user_id, nickname, bet_amount, is_ready, auth_user_id)
  on table public.nodbet_double_lobby_players to authenticated;
grant update (is_ready) on table public.nodbet_double_lobby_players to authenticated;
grant delete on table public.nodbet_double_lobby_players to authenticated;

-- --- Выполнение функций: только авторизованным ---
revoke all on function public.nodbet_spin(bigint, text) from public, anon;
revoke all on function public.nodbet_claim_daily() from public, anon;
revoke all on function public.nodbet_activate_promo(text) from public, anon;
revoke all on function public.nodbet_buy_perk(text) from public, anon;
revoke all on function public.nodbet_place_bet(text, int, text, bigint, boolean) from public, anon;
revoke all on function public.nodbet_cancel_bet(text) from public, anon;
revoke all on function public.nodbet_settle_my_bets(text) from public, anon;
revoke all on function public.nodbet_reconcile_my_bets() from public, anon;
revoke all on function public.nodbet_double_place_bet(uuid, bigint, text) from public, anon;
revoke all on function public.nodbet_double_round_control(uuid, text) from public, anon;
revoke all on function public.nodbet_double_spin(uuid) from public, anon;

grant execute on function public.nodbet_spin(bigint, text) to authenticated;
grant execute on function public.nodbet_claim_daily() to authenticated;
grant execute on function public.nodbet_activate_promo(text) to authenticated;
grant execute on function public.nodbet_buy_perk(text) to authenticated;
grant execute on function public.nodbet_place_bet(text, int, text, bigint, boolean) to authenticated;
grant execute on function public.nodbet_cancel_bet(text) to authenticated;
grant execute on function public.nodbet_settle_my_bets(text) to authenticated;
grant execute on function public.nodbet_reconcile_my_bets() to authenticated;
grant execute on function public.nodbet_double_place_bet(uuid, bigint, text) to authenticated;
grant execute on function public.nodbet_double_round_control(uuid, text) to authenticated;
grant execute on function public.nodbet_double_spin(uuid) to authenticated;
grant execute on function public.cleanup_stale_double_lobbies() to authenticated, anon;

-- ============================================================
-- 9. RLS-ПОЛИТИКИ
-- ============================================================

alter table public.nodbet_profiles enable row level security;
alter table public.nodbet_bets enable row level security;
alter table public.nodbet_roulette_spins enable row level security;
alter table public.nodbet_double_lobbies enable row level security;
alter table public.nodbet_double_lobby_players enable row level security;

-- --- nodbet_profiles ---
drop policy if exists "public read nodbet profiles" on public.nodbet_profiles;
create policy "public read nodbet profiles"
  on public.nodbet_profiles for select using (true);

drop policy if exists "user insert own nodbet profile" on public.nodbet_profiles;
create policy "user insert own nodbet profile"
  on public.nodbet_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "user update own nodbet profile" on public.nodbet_profiles;
create policy "user update own nodbet profile"
  on public.nodbet_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user delete own nodbet profile" on public.nodbet_profiles;

-- --- nodbet_bets: только чтение своих; запись — через функции ---
drop policy if exists "user read own nodbet bets" on public.nodbet_bets;
create policy "user read own nodbet bets"
  on public.nodbet_bets for select
  using (auth.uid() = user_id);
drop policy if exists "user insert own nodbet bets" on public.nodbet_bets;
drop policy if exists "user update own nodbet bets" on public.nodbet_bets;
drop policy if exists "user delete own nodbet bets" on public.nodbet_bets;

-- --- nodbet_roulette_spins: только чтение своих ---
drop policy if exists "user read own nodbet spins" on public.nodbet_roulette_spins;
create policy "user read own nodbet spins"
  on public.nodbet_roulette_spins for select
  using (auth.uid() = user_id);
drop policy if exists "user insert own nodbet spins" on public.nodbet_roulette_spins;
drop policy if exists "user update own nodbet spins" on public.nodbet_roulette_spins;
drop policy if exists "user delete own nodbet spins" on public.nodbet_roulette_spins;

-- --- Двойная-Рулетка: лобби ---
drop policy if exists "Enable all for nodbet_double_lobbies" on public.nodbet_double_lobbies;
drop policy if exists "double lobbies select all" on public.nodbet_double_lobbies;
create policy "double lobbies select all"
  on public.nodbet_double_lobbies for select using (true);

drop policy if exists "double lobbies insert host" on public.nodbet_double_lobbies;
create policy "double lobbies insert host"
  on public.nodbet_double_lobbies for insert
  with check (auth.uid() is not null and auth.uid() = host_auth_id);

drop policy if exists "double lobbies update host" on public.nodbet_double_lobbies;
create policy "double lobbies update host"
  on public.nodbet_double_lobbies for update
  using (auth.uid() = host_auth_id)
  with check (auth.uid() = host_auth_id);

drop policy if exists "double lobbies delete host" on public.nodbet_double_lobbies;
create policy "double lobbies delete host"
  on public.nodbet_double_lobbies for delete
  using (auth.uid() = host_auth_id);

-- --- Двойная-Рулетка: игроки ---
drop policy if exists "Enable all for nodbet_double_lobby_players" on public.nodbet_double_lobby_players;
drop policy if exists "double players select all" on public.nodbet_double_lobby_players;
create policy "double players select all"
  on public.nodbet_double_lobby_players for select using (true);

drop policy if exists "double players insert self" on public.nodbet_double_lobby_players;
create policy "double players insert self"
  on public.nodbet_double_lobby_players for insert
  with check (auth.uid() is not null and auth.uid() = auth_user_id);

drop policy if exists "double players update self ready" on public.nodbet_double_lobby_players;
create policy "double players update self ready"
  on public.nodbet_double_lobby_players for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

drop policy if exists "double players delete self or host" on public.nodbet_double_lobby_players;
create policy "double players delete self or host"
  on public.nodbet_double_lobby_players for delete
  using (
    auth.uid() = auth_user_id
    or exists (
      select 1 from public.nodbet_double_lobbies l
      where l.id = lobby_id and l.host_auth_id = auth.uid()
    )
  );

-- ============================================================
-- 10. ЧЕСТНЫЙ ВОЗВРАТ СТАВОК ПРИ УДАЛЕНИИ ЛОББИ
--     Если лобби удалено (хост вышел / автоочистка) ДО розыгрыша
--     ('waiting'/'betting'), игрокам, успевшим зафиксировать ставку
--     (selected_bonus_id NOT NULL → деньги уже списаны сервером),
--     возвращаем её на баланс. После розыгрыша ('spinning'/'finished')
--     выплаты уже применены — возврат не нужен.
-- ============================================================
create or replace function public.nodbet_double_refund_on_lobby_delete()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  if old.status in ('waiting', 'betting') then
    for p in
      select auth_user_id, bet_amount, selected_bonus_id
      from public.nodbet_double_lobby_players
      where lobby_id = old.id
    loop
      if p.auth_user_id is not null and p.selected_bonus_id is not null and p.bet_amount > 0 then
        update public.nodbet_profiles
        set balance = balance + p.bet_amount
        where user_id = p.auth_user_id;
      end if;
    end loop;
  end if;
  return old;
end $$;

drop trigger if exists nodbet_double_refund_before_delete on public.nodbet_double_lobbies;
create trigger nodbet_double_refund_before_delete
  before delete on public.nodbet_double_lobbies
  for each row execute function public.nodbet_double_refund_on_lobby_delete();

-- ============================================================
-- Готово! Что изменилось для игроков: НИЧЕГО визуально.
-- Что изменилось для безопасности: исходы спинов и баланс
-- теперь решает только сервер.
-- ============================================================
