-- =========================================================
-- NODBET: отключение компенсации и исправление «Всего выиграно»
--
-- Выполните файл один раз в Supabase → SQL Editor.
-- Компенсация больше не начисляется приложением. Этот скрипт не
-- списывает уже выданные монеты и не меняет баланс пользователей.
-- =========================================================

-- Восстанавливаем статистику из сохранённой истории. Значение не
-- уменьшается: если в профиле уже есть большее корректное число,
-- оно остаётся без изменений.
with earned as (
  select
    p.user_id,
    coalesce((
      select sum(b.payout)
      from nodbet_bets b
      where b.user_id = p.user_id
        and b.status = 'won'
        and b.payout > 0
    ), 0) + coalesce((
      select sum(s.won_coins)
      from nodbet_roulette_spins s
      where s.user_id = p.user_id
        and s.won_coins > 0
    ), 0) as historical_total_won
  from nodbet_profiles p
)
update nodbet_profiles p
set total_won = greatest(p.total_won, earned.historical_total_won)
from earned
where p.user_id = earned.user_id;

-- Не разрешаем следующей синхронизации профиля обнулить или уменьшить
-- уже накопленный результат.
create or replace function nodbet_keep_total_won() returns trigger as $$
begin
  new.total_won = greatest(coalesce(old.total_won, 0), coalesce(new.total_won, 0));
  return new;
end;
$$ language plpgsql;

drop trigger if exists nodbet_profiles_keep_total_won on nodbet_profiles;
create trigger nodbet_profiles_keep_total_won
  before update on nodbet_profiles
  for each row execute function nodbet_keep_total_won();

-- Прибавляем только новые положительные выигрыши по ставкам. Проигрыш,
-- возврат или исправление ставки никогда не уменьшают «Всего выиграно».
create or replace function nodbet_add_bet_winnings_to_total() returns trigger as $$
declare
  previous_payout bigint := 0;
  added_payout bigint := 0;
begin
  if tg_op = 'UPDATE' and old.status = 'won' and old.payout > 0 then
    previous_payout := old.payout;
  end if;

  if new.status = 'won' and new.payout > 0 then
    added_payout := greatest(new.payout - previous_payout, 0);
  end if;

  if added_payout > 0 then
    update nodbet_profiles
    set total_won = total_won + added_payout
    where user_id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists nodbet_bets_add_winnings_to_total on nodbet_bets;
create trigger nodbet_bets_add_winnings_to_total
  after insert or update of status, payout on nodbet_bets
  for each row execute function nodbet_add_bet_winnings_to_total();

-- Учитываем положительные результаты рулетки по тому же принципу.
create or replace function nodbet_add_spin_winnings_to_total() returns trigger as $$
declare
  previous_winnings bigint := 0;
  added_winnings bigint := 0;
begin
  if tg_op = 'UPDATE' and old.won_coins > 0 then
    previous_winnings := old.won_coins;
  end if;

  if new.won_coins > 0 then
    added_winnings := greatest(new.won_coins - previous_winnings, 0);
  end if;

  if added_winnings > 0 then
    update nodbet_profiles
    set total_won = total_won + added_winnings
    where user_id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists nodbet_spins_add_winnings_to_total on nodbet_roulette_spins;
create trigger nodbet_spins_add_winnings_to_total
  after insert or update of won_coins on nodbet_roulette_spins
  for each row execute function nodbet_add_spin_winnings_to_total();
