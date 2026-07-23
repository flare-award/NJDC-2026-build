-- ============================================================
-- ФИНАЛЬНЫЙ ИДЕМПОТЕНТНЫЙ ФИКС: «ПОСТАВИТЬ ВСЁ» на огромном балансе
-- ============================================================
--
-- ПРИЧИНА БАГА:
--   JavaScript Number не хранит точно целые > Number.MAX_SAFE_INTEGER
--   (2^53 - 1). Например:
--     Number("84343999183658110").toFixed(0) === "84343999183658112"
--   При «ПОСТАВИТЬ ВСЁ» клиент раньше передавал ТЕКУЩИЙ balance в
--   p_bet_amount. На балансах больше 2^53 этот number теряет точность
--   и становится больше ТОЧНОГО bigint balance в базе. Сервер сравнивал
--   p_bet_amount > balance и возвращал «Недостаточно NOD-Коинов для
--   этого спина!». На 54 000 000 000 000 000 работало, потому что это
--   число случайно попадает в safe-integer диапазон без округления.
--
-- РЕШЕНИЕ:
--   1) Фронтенд (src/context/NodbetContext.tsx, spinRoulette) при
--      betAll === true шлёт p_bet_amount = 0 (безопасный placeholder),
--      а точную сумму считает сервер.
--   2) Сервер при p_bet_all = true ОБЯЗАН полностью игнорировать
--      p_bet_amount и брать ТОЧНЫЙ bigint balance из таблицы
--      nodbet_profiles (floor(balance / v_count)). Клиентский number
--      никогда не участвует в расчёте ставки при bet-all.
--
-- ЭТОТ ФАЙЛ гарантированно запускается ПОСЛЕДНИМ (имя "supabase-zz-..."
-- сортируется после "supabase-z-nodbet-spin-fix.sql"), поэтому он
-- пересоздаёт финальную, рабочую 3-аргументную версию функции,
-- перезаписывая любые предыдущие определения.
--
-- Идемпотентно: запускать повторно безопасно.
-- ============================================================

-- Удаляем ВСЕ возможные сигнатуры (устаревшую 2- и текущую 3-аргументную),
-- чтобы в проде осталась ТОЛЬКО одна актуальная сигнатура:
--   public.nodbet_spin(bigint, text, boolean)
drop function if exists public.nodbet_spin(bigint, text);
drop function if exists public.nodbet_spin(bigint, text, boolean);

-- Единственная, корректная 3-аргументная сигнатура.
-- НЕ ссылаемся на удалённые колонки double_spin / double_spin_enabled.
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
  v_count int := 1;          -- Дабл-спин удалён → всегда один спин
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

  -- Дабл-спин УДАЛЁН: колонки double_spin / double_spin_enabled удалены.
  -- Поэтому всегда один спин (v_count уже = 1). НЕ трогаем удалённые колонки.

  -- ФИКС (огромный баланс / bet-all):
  --   При p_bet_all = true сервер САМ считает ставку по ТОЧНОМУ bigint
  --   балансу из базы (floor(balance / v_count)) и ПОЛНОСТЬЮ игнорирует
  --   p_bet_amount. Клиент при bet-all шлёт безопасный placeholder 0,
  --   поэтому здесь p_bet_amount НИКОГДА не используется для расчёта
  --   ставки при bet-all. Это решает потерю точности float на балансах
  --   больше 2^53 (например, 84 343 999 183 658 110 NOD).
  --   При обычном спине (p_bet_all = false) берём p_bet_amount как есть.
  if p_bet_all then
    v_bet := floor(v_prof.balance / v_count);
    if v_bet < 1 then
      return jsonb_build_object('ok', false, 'error', 'У вас нет коинов, чтобы поставить всё!');
    end if;
  else
    v_bet := greatest(0, coalesce(p_bet_amount, 0));
  end if;

  -- Защита: итоговая ставка не может превышать баланс.
  -- Для bet-all v_bet = floor(balance / 1) = balance, поэтому
  -- v_bet * v_count = balance, что НЕ больше баланса → ошибки нет.
  if v_bet > 0 then
    if v_bet * v_count > v_prof.balance then
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

-- Права на функцию (как в исходных миграциях).
revoke all on function public.nodbet_spin(bigint, text, boolean) from public, anon;
grant execute on function public.nodbet_spin(bigint, text, boolean) to authenticated;

-- Обновляем кэш схемы PostgREST, чтобы он увидел актуальную сигнатуру
-- функции (иначе вызовы с 3 аргументами могут отклоняться, даже если
-- функция уже correct).
select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- Готово! При «ПОСТАВИТЬ ВСЁ» клиент шлёт { p_bet_amount: 0,
-- p_mode: 'classic', p_bet_all: true }, сервер берёт ТОЧНЫЙ bigint
-- balance из nodbet_profiles и спин проходит без ошибки
-- «Недостаточно NOD-Коинов для этого спина!» даже на балансах
-- больше 2^53 (например, 84 343 999 183 658 110 NOD).
-- ============================================================
