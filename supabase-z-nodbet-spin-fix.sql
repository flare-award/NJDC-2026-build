-- ============================================================
-- ФИНАЛЬНЫЙ ФИКС: спин-функция nodbet_spin не крутит спины
-- ============================================================
--
-- ПРИЧИНА ПОЛОМКИ:
--   Миграция supabase-remove-deleted-perks-migration.sql УДАЛИЛА колонки
--   double_spin и double_spin_enabled из таблицы nodbet_profiles.
--   Но обе версии функции nodbet_spin (2-аргументная из
--   supabase-server-authoritative-migration.sql и 3-аргументная из
--   supabase-bet-all-fix-migration.sql) по-прежнему ссылались на
--   v_prof.double_spin / v_prof.double_spin_enabled.
--
--   В Postgres тело plpgsql-функции не валидируется при CREATE, поэтому
--   миграции «успешно» накатывались, но при ВЫПОЛНЕНИИ функция падала с
--   ошибкой «record "v_prof" has no field "double_spin"». Результат:
--   НЕ крутятся ВООБЩЕ никакие спины (обычные пресеты, кастом, фри-спин
--   и «ПОСТАВИТЬ ВСЁ») — независимо от режима и размера ставки.
--
--   Привилегия «Дабл-спин» уже удалена из клиента (в NODBET_PERKS нет
--   double_spin), поэтому логика дабл-спина больше не нужна: v_count = 1.
--
-- ЭТОТ ФАЙЛ запускается ПОСЛЕДНИМ (имя сортируется после
-- supabase-server-authoritative-migration.sql), поэтому он гарантированно
-- пересоздаёт финальную, рабочую версию функции, перезаписывая сломанные
-- определения, оставшиеся после предыдущих миграций.
--
-- Идемпотентно: запускать повторно безопасно.
-- ============================================================

-- Удаляем ВСЕ возможные сигнатуры (2- и 3-аргументную), чтобы не осталось
-- ни одной сломанной версии, ссылающейся на удалённые колонки.
drop function if exists public.nodbet_spin(bigint, text);
drop function if exists public.nodbet_spin(bigint, text, boolean);

-- Создаём единственную, корректную 3-аргументную сигнатуру.
-- НЕ ссылаемся на double_spin / double_spin_enabled — их больше нет.
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

  -- ФИКС: если p_bet_all = true, сервер сам считает ставку по ТОЧНОМУ
  -- балансу (floor(balance / v_count)). Клиент передаёт p_bet_amount, но
  -- при bet-all сервер его игнорирует — это решает потерю точности float
  -- на огромных балансах (> 2^53).
  if p_bet_all then
    v_bet := floor(v_prof.balance / v_count);
    if v_bet < 1 then
      return jsonb_build_object('ok', false, 'error', 'У вас нет коинов, чтобы поставить всё!');
    end if;
  else
    v_bet := greatest(0, coalesce(p_bet_amount, 0));

    -- Safety-net для обычной ставки: не отклоняем сумму выше баланса,
    -- а ограничиваем её точным серверным балансом.
    if v_bet > v_prof.balance then
      v_bet := v_prof.balance;
    end if;
  end if;

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
-- Готово! Теперь крутятся ВСЕ спины: обычные пресеты/кастом/фри-спин
-- и «ПОСТАВИТЬ ВСЁ» — и в режиме «Клатч-Рулетка», и в «Всё или ничего».
-- ============================================================
