-- =========================================================
-- NODBET FIX & CLEANUP MIGRATION (обновление баланса игры)
--
-- Выполните ЭТОТ файл целиком в Supabase → SQL Editor ОДИН РАЗ.
-- Он содержит ТОЛЬКО новые команды, которых не было в прошлых
-- миграциях (supabase-schema.sql и supabase-nodbet-migration.sql
-- вы уже выполняли — их повторять НЕ нужно).
--
-- Что делает этот файл:
--   1) Удаляет читерские привилегии (VIP x3, страховки, x2 бустеры,
--      «NODBET Pro» / золотой знак) из базы у ВСЕХ пользователей.
--   2) Добавляет новые честные привилегии (дабл спин, своя рамка,
--      собственный статус, мультипас) и прогноз овертайма в ставках.
--   3) РАЗОВО наказывает накрутчиков:
--        - у кого баланс > 100 000 000 — ставит ровно 100 000 000;
--        - удаляет их ставки с суммой > 100 000 000.
--   4) Снимает искусственный лимит баланса (если он был выставлен).
-- =========================================================

-- ---------------------------------------------------------
-- 0. Снимаем возможный лимит на баланс (пункт 21).
--    Если раньше стоял CHECK/триггер, ограничивающий баланс
--    (например 2 млрд) — убираем его, чтобы честные игроки
--    могли расти без потолка. bigint вмещает огромные суммы.
-- ---------------------------------------------------------
alter table nodbet_profiles
  alter column balance type bigint;

alter table nodbet_profiles
  alter column total_won type bigint;

-- Снимаем любые чек-ограничения на баланс, если они были добавлены.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'nodbet_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%balance%'
  loop
    execute format('alter table nodbet_profiles drop constraint %I', c.conname);
  end loop;
end $$;

-- Убираем возможные триггеры-ограничители баланса (кроме служебного updated_at).
do $$
declare
  t record;
begin
  for t in
    select tgname
    from pg_trigger
    where tgrelid = 'nodbet_profiles'::regclass
      and not tgisinternal
      and tgname ilike '%balance%'
  loop
    execute format('drop trigger if exists %I on nodbet_profiles', t.tgname);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 1. РАЗОВОЕ наказание накрутчиков — баланс (пункт 19).
--    У кого баланс > 100 млн, ставим ровно 100 млн.
--    У кого меньше — не трогаем.
-- ---------------------------------------------------------
update nodbet_profiles
set balance = 100000000
where balance > 100000000;

-- ---------------------------------------------------------
-- 2. РАЗОВОЕ удаление накрученных ставок (пункт 22).
--    Удаляем ставки с суммой > 100 млн (следы «Демо-расчёта»).
--    Ставки < 100 млн остаются нетронутыми.
-- ---------------------------------------------------------
delete from nodbet_bets
where amount > 100000000;

-- ---------------------------------------------------------
-- 3. Удаляем читерские привилегии у всех (пункты 3, 4, 16).
--    Сбрасываем инвентарь читерских бустов и удаляем сами колонки.
-- ---------------------------------------------------------

-- Сначала обнуляем (на случай, если колонки ещё используются где-то).
update nodbet_profiles
set
  vip_boost_x3 = false,
  insurance_count = 0,
  double_win_count = 0,
  gold_badge = false
where vip_boost_x3 = true
   or insurance_count <> 0
   or double_win_count <> 0
   or gold_badge = true;

-- Удаляем колонки читерских бустов из профилей.
alter table nodbet_profiles drop column if exists vip_boost_x3;
alter table nodbet_profiles drop column if exists insurance_count;
alter table nodbet_profiles drop column if exists double_win_count;
alter table nodbet_profiles drop column if exists gold_badge;

-- Удаляем поля страховки/удвоения из ставок.
alter table nodbet_bets drop column if exists used_insurance;
alter table nodbet_bets drop column if exists used_double_win;

-- ---------------------------------------------------------
-- 4. Новые честные привилегии (пункт 17) и стартовые значения.
-- ---------------------------------------------------------
alter table nodbet_profiles add column if not exists radar_unlocked boolean not null default false;
alter table nodbet_profiles add column if not exists double_spin boolean not null default false;
alter table nodbet_profiles add column if not exists hall_frame boolean not null default false;
alter table nodbet_profiles add column if not exists custom_status_owned boolean not null default false;
alter table nodbet_profiles add column if not exists coin_magnet boolean not null default false;
alter table nodbet_profiles add column if not exists custom_status_text text;

-- Новые игроки теперь начинают с 0 XP (уровни, пункт 23). Старым не меняем.
alter table nodbet_profiles alter column xp set default 0;

-- ---------------------------------------------------------
-- 5. Прогноз овертайма в ставках (пункт 6).
-- ---------------------------------------------------------
alter table nodbet_bets add column if not exists overtime_prediction boolean not null default false;

-- ---------------------------------------------------------
-- 6. Обновление таблицы спинов рулетки под новую систему бонусов
--    (пункты 1, 8). Добавляем bonus_id и is_negative, разрешаем
--    отрицательные выигрыши (won_coins может быть < 0).
-- ---------------------------------------------------------
alter table nodbet_roulette_spins add column if not exists bonus_id text not null default 'normal';
alter table nodbet_roulette_spins add column if not exists is_negative boolean not null default false;

-- won_coins может быть отрицательным (потеря на рулетке) — снимаем возможный
-- default-триггер/чек, если он был. Тип int вмещает и отрицательные значения,
-- расширять до bigint не обязательно, но сделаем на всякий случай.
alter table nodbet_roulette_spins alter column won_coins type bigint;

-- Старые колонки рулетки, которые больше не используются, можно удалить.
alter table nodbet_roulette_spins drop column if exists color;
alter table nodbet_roulette_spins drop column if exists bonus_text;

-- =========================================================
-- Готово! После выполнения:
--   - у всех убраны читерские бусты и накрученные ставки > 100 млн,
--   - балансы > 100 млн срезаны до 100 млн,
--   - лимит баланса снят,
--   - добавлены поля для честных привилегий, овертайма и новой рулетки.
--
-- Этот файл нужно выполнить ТОЛЬКО ОДИН РАЗ.
-- =========================================================
