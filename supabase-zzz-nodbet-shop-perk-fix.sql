-- ============================================================
-- ФИНАЛЬНЫЙ ФИКС: покупка привилегий в Престижном Магазине NODBET
-- ============================================================
--
-- ПРИЧИНА ПОЛОМКИ:
--   Миграция supabase-remove-deleted-perks-migration.sql УДАЛИЛА колонки
--   double_spin, double_spin_enabled, title_scroll и neon_signature из
--   таблицы nodbet_profiles (привилегии «Дабл спин», «Титульный Свиток»
--   и «Неоновая Подпись» убраны из магазина).
--
--   Но RPC-функция public.nodbet_buy_perk(text) из
--   supabase-server-authoritative-migration.sql по-прежнему ссылалась на
--   эти удалённые колонки в UPDATE ... SET (строки вида
--   double_spin = case when v_perk = 'double_spin' then true else double_spin end).
--
--   В Postgres тело plpgsql-функции не валидируется при CREATE, поэтому
--   миграции «успешно» накатывались, но при ВЫПОЛНЕНИИ любая покупка
--   падала с ошибкой («column "double_spin" does not exist» /
--   «record "v_prof" has no field "double_spin"»). Фронтенд получал
--   ошибку RPC и показывал пользователю «Ошибка сервера при покупке».
--
--   (Аналогичная поломка функции nodbet_spin уже была исправлена
--   файлами supabase-z-nodbet-spin-fix.sql и
--   supabase-zz-nodbet-bet-all-huge-balance-fix.sql — а вот
--   nodbet_buy_perk осталась без исправления.)
--
-- РЕШЕНИЕ:
--   Пересоздаём nodbet_buy_perk БЕЗ ссылок на удалённые колонки.
--   Цены, начисление XP (+500) и формат ответа ({ok, balance, xp, perk})
--   полностью совпадают с клиентом (src/context/NodbetContext.tsx и
--   NODBET_PERKS). Привилегии double_spin / title_scroll / neon_signature
--   больше не в магазине — такие запросы честно отклоняются
--   («Привилегия не найдена»).
--
-- ЭТОТ ФАЙЛ гарантированно запускается ПОСЛЕДНИМ (имя "supabase-zzz-..."
-- сортируется после "supabase-zz-nodbet-bet-all-huge-balance-fix.sql"),
-- поэтому он пересоздаёт финальную, рабочую версию функции.
--
-- Идемпотентно: запускать повторно безопасно.
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

  -- Только актуальные привилегии магазина (удалённые double_spin /
  -- title_scroll / neon_signature здесь отсутствуют).
  v_cost := case v_perk
    when 'radar' then 1530000
    when 'hall_frame' then 7225000
    when 'crown_badge' then 21250000
    when 'custom_status' then 40800000
    when 'coin_magnet' then 5525000000
    when 'star_trail' then 3500000
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
    when 'coin_magnet' then v_prof.coin_magnet
    when 'star_trail' then coalesce(v_prof.star_trail, false)
    when 'aura' then coalesce(v_prof.aura_owned, false)
    when 'multi_bet' then coalesce(v_prof.multi_bet, false)
    else false end;
  if coalesce(v_owned, false) then
    return jsonb_build_object('ok', false, 'error', 'Эта привилегия у вас уже есть!');
  end if;
  if v_prof.balance < v_cost then
    return jsonb_build_object('ok', false, 'error', 'Недостаточно монет! Требуется ' || v_cost || ' NOD.');
  end if;

  -- НЕ ссылаемся на удалённые колонки double_spin / double_spin_enabled /
  -- title_scroll / neon_signature — их больше нет в таблице.
  update public.nodbet_profiles set
    balance = balance - v_cost,
    xp = xp + 500,
    radar_unlocked      = case when v_perk = 'radar' then true else radar_unlocked end,
    hall_frame          = case when v_perk = 'hall_frame' then true else hall_frame end,
    crown_badge         = case when v_perk = 'crown_badge' then true else coalesce(crown_badge, false) end,
    custom_status_owned = case when v_perk = 'custom_status' then true else custom_status_owned end,
    coin_magnet         = case when v_perk = 'coin_magnet' then true else coin_magnet end,
    star_trail          = case when v_perk = 'star_trail' then true else coalesce(star_trail, false) end,
    aura_owned          = case when v_perk = 'aura' then true else coalesce(aura_owned, false) end,
    multi_bet           = case when v_perk = 'multi_bet' then true else coalesce(multi_bet, false) end
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object('ok', true, 'balance', v_prof.balance, 'xp', v_prof.xp, 'perk', v_perk);
end $$;

-- Права на функцию (как в исходной миграции).
revoke all on function public.nodbet_buy_perk(text) from public, anon;
grant execute on function public.nodbet_buy_perk(text) to authenticated;

-- Обновляем кэш схемы PostgREST, чтобы он сразу увидел актуальную функцию.
select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- Готово! После применения покупка привилегий в Престижном
-- Магазине NODBET снова работает: сервер списывает баланс,
-- начисляет XP, ставит флаг привилегии в nodbet_profiles и
-- возвращает клиенту {ok: true, balance, xp, perk}.
-- ============================================================
