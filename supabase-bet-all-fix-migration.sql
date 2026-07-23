-- ============================================================
-- МИГРАЦИЯ: Фикс кнопки «ПОСТАВИТЬ ВСЁ» (bet-all)
--
-- Выполните этот файл ЦЕЛИКОМ в Supabase → SQL Editor
-- ПОСЛЕ всех предыдущих миграций (schema, nodbet, server-authoritative...).
--
-- Что исправляет:
--  1) ПОТЕРЯ ТОЧНОСТИ float: баланс > 2^53 терял точность при передаче
--     через JSON (bigint → number → bigint). Сервер теперь сам считает
--     ставку «всё» по ТОЧНОМУ балансу из базы.
--  2) ДАБЛ-СПИН: при v_count=2 проверка v_bet*2 > balance отклоняла
--     спин «всё» ВСЕГДА. Теперь сервер делит баланс на v_count через
--     floor(), и остаток (0–1 NOD) остаётся на балансе.
--
-- Как работает:
--  • Новый параметр p_bet_all (boolean, default false).
--  • Если p_bet_all = true, сервер считает v_bet := floor(balance / v_count).
--  • Если p_bet_all = false, работает как раньше (v_bet := p_bet_amount).
--  • Проверка v_bet * v_count > balance остаётся (для bet-all она всегда проходит).
--
-- Файл идемпотентен: можно запускать повторно без ошибок.
-- ============================================================

-- Удаляем старую 2-аргументную сигнатуру, чтобы не было неоднозначности
-- выбора функции в PostgREST.
drop function if exists public.nodbet_spin(bigint, text);

-- Создаём новую 3-аргументную сигнатуру с параметром p_bet_all.
-- Тело функции идентично исходному (из supabase-server-authoritative-migration.sql),
-- кроме вычисления v_bet после select ... for update и определения v_count.
create or replace function public.nodbet_spin(
  p_bet_amount bigint,
  p_mode text,
  p_bet_all boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_mode text := lower(coalesce(p_mode, 'classic'));
  v_bet bigint;
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

  -- ФИКС: если p_bet_all = true, сервер сам считает ставку по ТОЧНОМУ балансу.
  -- floor(balance / v_count) делит «всё» на два спина поровну при дабл-спине.
  -- Остаток от деления (0–1 NOD) остаётся на балансе — это нормально.
  if p_bet_all then
    v_bet := floor(v_prof.balance / v_count);
    if v_bet < 1 then
      return jsonb_build_object('ok', false, 'error', 'У вас нет коинов, чтобы поставить всё!');
    end if;
  else
    v_bet := greatest(0, coalesce(p_bet_amount, 0));
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

-- Выдаём права на НОВУЮ сигнатуру (как в исходной миграции).
revoke all on function public.nodbet_spin(bigint, text, boolean) from public, anon;
grant execute on function public.nodbet_spin(bigint, text, boolean) to authenticated;

-- ============================================================
-- Готово! Теперь кнопка «ПОСТАВИТЬ ВСЁ» работает корректно:
--  • На сервере: точный расчёт по bigint-балансу (без потери точности).
--  • С дабл-спином: баланс делится на 2 спина через floor().
--  • Клиент просто шлёт p_bet_all=true, сервер сам считает ставку.
-- ============================================================
