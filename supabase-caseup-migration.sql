-- ============================================================
-- CASEUP by 1DONY — миграция Supabase
-- Слоган: Open. Upgrade. Profit.
-- Игра «CASEUP»: открытие кейсов, рынок скинов, апгрейд оружия,
-- магазин лёгких бустов, топ открывателей и инвентарь.
--
-- ВАЖНО:
--   * Выполнять ПОСЛЕ supabase-nodbet-migration.sql (используется
--     таблица nodbet_profiles: баланс NOD, XP, украшения топа).
--   * Файл идемпотентен — повторный запуск безопасен.
--   * Сид (кейсы/предметы) генерируется из src/data/caseupCatalog.ts
--     скриптом scripts/gen-caseup-sql.mjs.
--
-- ПРИНЦИПЫ ЧЕСТНОСТИ:
--   * Результат открытия кейса определяет СЕРВЕР (RPC security
--     definer) с учётом шансов ещё до анимации — анимация на
--     клиенте лишь показывает уже выбранный выигрыш.
--   * Рынок автоматический: покупки толкают цену вверх, продажи —
--     вниз (дрейф ±1.5% за сделку, в пределах ±45%/+80% от базы).
--     Фактора времени в ценах нет.
--   * Шанс апгрейда = (цена_источника / цена_цели)^1.1, кап 95%,
--     минимум 5% + лёгкие бусты (+1.5% постоянный, +4% временный).
--   * Бусты намеренно лёгкие: никаких скидок 30-100% и бесплатных
--     открытий.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. ТАБЛИЦЫ
-- ============================================================

-- Каталог кейсов (только чтение для пользователей)
create table if not exists public.caseup_cases (
  id text primary key,
  name text not null,
  description text not null default '',
  price bigint not null,                    -- цена открытия 1 кейса (NOD)
  image_url text not null default '',
  accent text not null default '#7c3aed',
  knife_item_id text,                       -- какой нож выпадает из кейса
  knife_chance numeric not null default 0.26, -- шанс ножа (в процентах)
  sort_order int not null default 0,
  active boolean not null default true
);

-- Каталог предметов: скины (case_id не null) и ножи (case_id = null, глобальные)
create table if not exists public.caseup_items (
  id text primary key,
  case_id text references public.caseup_cases(id) on delete cascade,
  name text not null,
  skin_name text not null default '',
  rarity text not null default 'mil-spec',
  image_url text not null default '',
  base_price bigint not null,               -- базовая цена (не дрейфует)
  price bigint not null,                    -- текущая цена рынка (дрейфует)
  price_low bigint not null,                -- нижняя граница дрейфа
  price_high bigint not null,               -- верхняя граница дрейфа
  drop_chance numeric not null default 0,   -- вес шанса среди скинов кейса
  is_knife boolean not null default false,
  sort_order int not null default 0,
  constraint caseup_items_rarity_check check (rarity in ('mil-spec', 'restricted', 'classified', 'covert', 'knife'))
);

create index if not exists caseup_items_case_idx on public.caseup_items (case_id);

-- Инвентарь пользователей (каждая строка — отдельный экземпляр предмета)
create table if not exists public.caseup_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.nodbet_profiles(user_id) on delete cascade,
  item_id text not null references public.caseup_items(id) on delete cascade,
  knife_finish text,                        -- случайный скин ножа (если нож)
  source text not null default 'case',      -- case | market | upgrade
  price_paid bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists caseup_inventory_user_idx on public.caseup_inventory (user_id, created_at desc);

-- История открытий кейсов
create table if not exists public.caseup_opens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.nodbet_profiles(user_id) on delete cascade,
  case_id text not null references public.caseup_cases(id) on delete cascade,
  item_id text not null references public.caseup_items(id) on delete cascade,
  cost bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists caseup_opens_user_idx on public.caseup_opens (user_id, created_at desc);

-- Бусты магазина: постоянные флаги + таймеры временных
create table if not exists public.caseup_boosts (
  user_id uuid primary key references public.nodbet_profiles(user_id) on delete cascade,
  market_pro boolean not null default false,        -- 📦 комиссия продажи 4% вместо 5%
  lucky_ticket boolean not null default false,      -- 🍀 +1.5% к шансу апгрейда (постоянно)
  buy_discount_until timestamptz,                   -- 📈 −3% покупка, 30 мин
  sell_bonus_until timestamptz,                     -- 💼 +2% продажа, 60 мин
  upgrade_chance_until timestamptz,                 -- 🎯 +4% апгрейд, 45 мин
  case_luck_until timestamptz                       -- 🔮 +0.5% редкие, 90 мин
);

-- Лента сделок рынка (видна всем)
create table if not exists public.caseup_market_trades (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.caseup_items(id) on delete cascade,
  user_id uuid references public.nodbet_profiles(user_id) on delete set null,
  kind text not null default 'buy',                 -- buy | sell
  price bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists caseup_trades_time_idx on public.caseup_market_trades (created_at desc);

-- Счётчики CASEUP на профиле NODBET (для Топа открывателей)
alter table public.nodbet_profiles add column if not exists caseup_cases_opened int not null default 0;
alter table public.nodbet_profiles add column if not exists caseup_spent bigint not null default 0;

-- ============================================================
-- 2. СИД КАТАЛОГА (генерируется из src/data/caseupCatalog.ts)
--    Запуск: node scripts/gen-caseup-sql.mjs
-- ============================================================
-- [CASEUP_SEED_BEGIN]
-- Кейсы
insert into public.caseup_cases (id, name, description, price, image_url, accent, knife_item_id, knife_chance, sort_order, active) values ('case_molten', 'Расплавленный Штурм', 'Оружие, закалённое в жерле вулкана. Горячая серия для тех, кто любит рисковать.', 2500, '/caseup/cases/case_molten.png', '#ff7a1a', NULL, 0.26, 1, true) on conflict (id) do nothing;
insert into public.caseup_cases (id, name, description, price, image_url, accent, knife_item_id, knife_chance, sort_order, active) values ('case_neon', 'Неоновый Разлом', 'Киберпанк-серия с неоновыми схемами. Светится в темноте и в твоём инвентаре.', 4500, '/caseup/cases/case_neon.png', '#22d3ee', NULL, 0.26, 2, true) on conflict (id) do nothing;
insert into public.caseup_cases (id, name, description, price, image_url, accent, knife_item_id, knife_chance, sort_order, active) values ('case_frost', 'Ледяная Глубина', 'Оружие из вечной мерзлоты. Холодное как расчёт, точное как лёд.', 7500, '/caseup/cases/case_frost.png', '#7cc7ff', NULL, 0.26, 3, true) on conflict (id) do nothing;
insert into public.caseup_cases (id, name, description, price, image_url, accent, knife_item_id, knife_chance, sort_order, active) values ('case_gold', 'Золотая Лихорадка', 'Легендарная серия для охотников за сокровищами. Джекпот уже близко.', 12000, '/caseup/cases/case_gold.png', '#ffd54a', NULL, 0.26, 4, true) on conflict (id) do nothing;

-- Предметы (скины и ножи)
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('mol_mp9_blaze', 'case_molten', 'MP9', 'Вспышка', 'mil-spec', '/caseup/items/mol_mp9_blaze.png', 650, 650, 358, 1170, 40, false, 1) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('mol_famas_cinder', 'case_molten', 'FAMAS', 'Головешка', 'mil-spec', '/caseup/items/mol_famas_cinder.png', 600, 600, 330, 1080, 40, false, 2) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('mol_glock_magma', 'case_molten', 'Glock-18', 'Магма', 'restricted', '/caseup/items/mol_glock_magma.png', 3200, 3200, 1760, 5760, 7.95, false, 3) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('mol_m4a1_scorch', 'case_molten', 'M4A1-S', 'Опалённый', 'restricted', '/caseup/items/mol_m4a1_scorch.png', 3000, 3000, 1650, 5400, 7.95, false, 4) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('mol_usp_ember', 'case_molten', 'USP-S', 'Уголёк', 'classified', '/caseup/items/mol_usp_ember.png', 10500, 10500, 5775, 18900, 3.2, false, 5) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('mol_ak47_molten', 'case_molten', 'AK-47', 'Расплавленный', 'covert', '/caseup/items/mol_ak47_molten.png', 42000, 42000, 23100, 75600, 0.64, false, 6) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('neo_galil_laser', 'case_neon', 'Galil AR', 'Лазер', 'mil-spec', '/caseup/items/neo_galil_laser.png', 1150, 1150, 633, 2070, 40, false, 1) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('neo_tec9_glitch', 'case_neon', 'Tec-9', 'Глитч', 'mil-spec', '/caseup/items/neo_tec9_glitch.png', 1100, 1100, 605, 1980, 40, false, 2) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('neo_mp7_signal', 'case_neon', 'MP7', 'Сигнал', 'restricted', '/caseup/items/neo_mp7_signal.png', 5650, 5650, 3108, 10170, 7.95, false, 3) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('neo_p90_circuit', 'case_neon', 'P90', 'Схема', 'restricted', '/caseup/items/neo_p90_circuit.png', 5600, 5600, 3080, 10080, 7.95, false, 4) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('neo_deagle_pulse', 'case_neon', 'Desert Eagle', 'Импульс', 'classified', '/caseup/items/neo_deagle_pulse.png', 18750, 18750, 10313, 33750, 3.2, false, 5) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('neo_awp_volt', 'case_neon', 'AWP', 'Вольт', 'covert', '/caseup/items/neo_awp_volt.png', 75000, 75000, 41250, 135000, 0.64, false, 6) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('fro_mac10_frostbite', 'case_frost', 'MAC-10', 'Обморожение', 'mil-spec', '/caseup/items/fro_mac10_frostbite.png', 1900, 1900, 1045, 3420, 40, false, 1) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('fro_five7_chill', 'case_frost', 'Five-SeveN', 'Холод', 'mil-spec', '/caseup/items/fro_five7_chill.png', 1850, 1850, 1018, 3330, 40, false, 2) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('fro_ump_hoarfrost', 'case_frost', 'UMP-45', 'Иней', 'restricted', '/caseup/items/fro_ump_hoarfrost.png', 9300, 9300, 5115, 16740, 7.95, false, 3) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('fro_m4a4_snowfall', 'case_frost', 'M4A4', 'Снегопад', 'restricted', '/caseup/items/fro_m4a4_snowfall.png', 9250, 9250, 5088, 16650, 7.95, false, 4) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('fro_awp_arctic', 'case_frost', 'AWP', 'Арктика', 'classified', '/caseup/items/fro_awp_arctic.png', 31000, 31000, 17050, 55800, 3.2, false, 5) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('fro_ak47_glacier', 'case_frost', 'AK-47', 'Ледник', 'covert', '/caseup/items/fro_ak47_glacier.png', 124000, 124000, 68200, 223200, 0.64, false, 6) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('gol_sg553_bullion', 'case_gold', 'SG 553', 'Слиток', 'mil-spec', '/caseup/items/gol_sg553_bullion.png', 3000, 3000, 1650, 5400, 40, false, 1) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('gol_p250_coin', 'case_gold', 'P250', 'Монета', 'mil-spec', '/caseup/items/gol_p250_coin.png', 2950, 2950, 1623, 5310, 40, false, 2) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('gol_mp9_nugget', 'case_gold', 'MP9', 'Самородок', 'restricted', '/caseup/items/gol_mp9_nugget.png', 14950, 14950, 8223, 26910, 7.95, false, 3) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('gol_m4a1_royal', 'case_gold', 'M4A1-S', 'Королевский', 'restricted', '/caseup/items/gol_m4a1_royal.png', 14900, 14900, 8195, 26820, 7.95, false, 4) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('gol_awp_gilded', 'case_gold', 'AWP', 'Позолота', 'classified', '/caseup/items/gol_awp_gilded.png', 49750, 49750, 27363, 89550, 3.2, false, 5) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('gol_ak47_treasure', 'case_gold', 'AK-47', 'Сокровище', 'covert', '/caseup/items/gol_ak47_treasure.png', 199000, 199000, 109450, 358200, 0.64, false, 6) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('knife_karambit', NULL, 'Керамбит', '', 'knife', '/caseup/items/knife_karambit.png', 210000, 210000, 115500, 378000, 0, true, 1) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('knife_m9', NULL, 'M9 Байонет', '', 'knife', '/caseup/items/knife_m9.png', 375000, 375000, 206250, 675000, 0, true, 2) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('knife_bayonet', NULL, 'Штык-нож', '', 'knife', '/caseup/items/knife_bayonet.png', 620000, 620000, 341000, 1116000, 0, true, 3) on conflict (id) do nothing;
insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values ('knife_butterfly', NULL, 'Бабочка', '', 'knife', '/caseup/items/knife_butterfly.png', 995000, 995000, 547250, 1791000, 0, true, 4) on conflict (id) do nothing;

-- Привязка ножей к кейсам
update public.caseup_cases set knife_item_id = 'knife_karambit' where id = 'case_molten' and knife_item_id is null;
update public.caseup_cases set knife_item_id = 'knife_m9' where id = 'case_neon' and knife_item_id is null;
update public.caseup_cases set knife_item_id = 'knife_bayonet' where id = 'case_frost' and knife_item_id is null;
update public.caseup_cases set knife_item_id = 'knife_butterfly' where id = 'case_gold' and knife_item_id is null;
-- [CASEUP_SEED_END]

-- ============================================================
-- 3. ROW LEVEL SECURITY
--    Каталог и лента сделок читают все. Инвентарь, история и
--    бусты — только владелец. Запись во все таблицы — только
--    через RPC (security definer), прямых insert/update/delete
--    у пользователей нет.
-- ============================================================

alter table public.caseup_cases enable row level security;
alter table public.caseup_items enable row level security;
alter table public.caseup_inventory enable row level security;
alter table public.caseup_opens enable row level security;
alter table public.caseup_boosts enable row level security;
alter table public.caseup_market_trades enable row level security;

drop policy if exists "caseup cases public read" on public.caseup_cases;
create policy "caseup cases public read" on public.caseup_cases for select using (true);

drop policy if exists "caseup items public read" on public.caseup_items;
create policy "caseup items public read" on public.caseup_items for select using (true);

drop policy if exists "caseup trades public read" on public.caseup_market_trades;
create policy "caseup trades public read" on public.caseup_market_trades for select using (true);

drop policy if exists "caseup inventory read own" on public.caseup_inventory;
create policy "caseup inventory read own" on public.caseup_inventory for select using (auth.uid() = user_id);

drop policy if exists "caseup opens read own" on public.caseup_opens;
create policy "caseup opens read own" on public.caseup_opens for select using (auth.uid() = user_id);

drop policy if exists "caseup boosts read own" on public.caseup_boosts;
create policy "caseup boosts read own" on public.caseup_boosts for select using (auth.uid() = user_id);

-- ============================================================
-- 4. ХЕЛПЕРЫ И RPC (server-authoritative)
-- ============================================================

-- Округление цены до «красивого» числа (как на клиенте)
create or replace function public.caseup_round_price(p bigint)
returns bigint language sql immutable as $$
  select case
    when p >= 100000 then round(p / 1000.0) * 1000
    when p >= 10000 then round(p / 100.0) * 100
    when p >= 1000 then round(p / 50.0) * 50
    when p >= 100 then round(p / 10.0) * 10
    else greatest(1, p)
  end::bigint;
$$;

-- Случайный финиш ножа (должен совпадать с KNIFE_FINISHES на клиенте)
create or replace function public.caseup_knife_finish()
returns text language sql volatile as $$
  select (array[
    'Градиент', 'Мраморный Градиент', 'Убийство',
    'Скользкий', 'Лазурная Сетка', 'Фазовый'
  ])[1 + floor(random() * 6)::int];
$$;

-- Честный взвешенный выбор предмета из кейса.
-- p_luck = активна «Фортуна Открывателя» (редкие ×1.03, нож ×1.03).
create or replace function public.caseup_roll_item(p_case_id text, p_luck boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.caseup_cases%rowtype;
  v_knife public.caseup_items%rowtype;
  v_knife_w numeric := 0;
  v_total numeric := 0;
  v_roll numeric;
  v_acc numeric := 0;
  v_pick_id text;
  v_pick public.caseup_items%rowtype;
  v_rec record;
  v_w numeric;
begin
  select * into v_case from public.caseup_cases where id = p_case_id;
  if not found then return null; end if;

  select * into v_knife from public.caseup_items where id = v_case.knife_item_id;
  if v_knife.id is not null then
    v_knife_w := case when p_luck then v_case.knife_chance * 1.03 else v_case.knife_chance end;
    v_total := v_total + v_knife_w;
  end if;

  for v_rec in select * from public.caseup_items where case_id = p_case_id loop
    v_w := v_rec.drop_chance;
    if p_luck and v_rec.rarity <> 'mil-spec' then v_w := v_w * 1.03; end if;
    v_total := v_total + greatest(0.0001, v_w);
  end loop;

  v_roll := random() * v_total;

  if v_knife.id is not null then
    v_acc := v_acc + v_knife_w;
    if v_roll <= v_acc then v_pick_id := v_knife.id; end if;
  end if;

  if v_pick_id is null then
    for v_rec in select * from public.caseup_items where case_id = p_case_id order by sort_order loop
      v_w := v_rec.drop_chance;
      if p_luck and v_rec.rarity <> 'mil-spec' then v_w := v_w * 1.03; end if;
      v_acc := v_acc + greatest(0.0001, v_w);
      if v_roll <= v_acc then
        v_pick_id := v_rec.id;
        exit;
      end if;
    end loop;
  end if;

  if v_pick_id is null then
    select * into v_pick from public.caseup_items where case_id = p_case_id order by drop_chance desc limit 1;
  else
    select * into v_pick from public.caseup_items where id = v_pick_id;
  end if;
  if v_pick.id is null then return null; end if;

  return jsonb_build_object(
    'item_id', v_pick.id,
    'name', v_pick.name,
    'skin_name', v_pick.skin_name,
    'rarity', v_pick.rarity,
    'image_url', v_pick.image_url,
    'price', v_pick.price,
    'is_knife', v_pick.is_knife
  );
end $$;

-- ============================================================
-- 4.1 ОТКРЫТИЕ КЕЙСА
-- Сервер заранее выбирает выигрышные предметы с учётом шансов,
-- списывает стоимость и кладёт предметы в инвентарь. Анимация
-- на клиенте только показывает результат.
-- ============================================================
create or replace function public.caseup_open_case(p_case_id text, p_count int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_case public.caseup_cases%rowtype;
  v_count int := greatest(1, least(3, coalesce(p_count, 1)));
  v_cost bigint;
  v_luck boolean := false;
  v_i int;
  v_pick jsonb;
  v_pick_id text;
  v_inv_id uuid;
  v_finish text;
  v_results jsonb := '[]'::jsonb;
  v_magnet numeric;
  v_xp int := 0;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  insert into public.nodbet_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.caseup_boosts (user_id) values (v_uid) on conflict (user_id) do nothing;

  select * into v_case from public.caseup_cases where id = p_case_id and active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Кейс не найден');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден. Перезагрузите страницу.');
  end if;

  -- Защита от спама RPC: анимация открытия идёт ~5 секунд
  if v_prof.last_spin_at is not null and v_now - v_prof.last_spin_at < interval '1.5 seconds' then
    return jsonb_build_object('ok', false, 'error', 'Слишком быстро! Дождитесь окончания анимации.');
  end if;

  v_cost := v_case.price * v_count;
  if v_prof.balance < v_cost then
    return jsonb_build_object('ok', false, 'error',
      'Недостаточно NOD-Коинов! Нужно ' || v_cost || ' NOD.');
  end if;

  select (now() < coalesce(case_luck_until, '-infinity'::timestamptz))
    into v_luck from public.caseup_boosts where user_id = v_uid;

  for v_i in 1..v_count loop
    v_pick := public.caseup_roll_item(p_case_id, v_luck);
    if v_pick is null then
      return jsonb_build_object('ok', false, 'error', 'Ошибка каталога кейса');
    end if;
    v_pick_id := v_pick ->> 'item_id';
    v_finish := case when (v_pick ->> 'is_knife')::boolean then public.caseup_knife_finish() else null end;

    v_inv_id := gen_random_uuid();
    insert into public.caseup_inventory (id, user_id, item_id, knife_finish, source, price_paid, created_at)
    values (v_inv_id, v_uid, v_pick_id, v_finish, 'case', (v_pick ->> 'price')::bigint, v_now);

    insert into public.caseup_opens (user_id, case_id, item_id, cost, created_at)
    values (v_uid, p_case_id, v_pick_id, v_case.price, v_now);

    v_results := v_results || jsonb_build_object(
      'invId', v_inv_id,
      'itemId', v_pick_id,
      'name', v_pick ->> 'name',
      'skinName', v_pick ->> 'skin_name',
      'rarity', v_pick ->> 'rarity',
      'image', v_pick ->> 'image_url',
      'price', (v_pick ->> 'price')::bigint,
      'knifeFinish', v_finish,
      'isKnife', (v_pick ->> 'is_knife')::boolean
    );
    v_xp := v_xp + 30;
  end loop;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;

  update public.nodbet_profiles
  set balance = balance - v_cost,
      xp = xp + round(v_xp * v_magnet),
      last_spin_at = v_now,
      caseup_cases_opened = caseup_cases_opened + v_count,
      caseup_spent = caseup_spent + v_cost
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true,
    'balance', v_prof.balance,
    'xp', v_prof.xp,
    'results', v_results
  );
end $$;

-- ============================================================
-- 4.2 ПОКУПКА НА РЫНКЕ
-- Покупка по текущей цене (−3% при активном «Рыночном Инсайдере»).
-- После покупки цена дрейфует вверх (+1.5%, в пределах границ).
-- ============================================================
create or replace function public.caseup_market_buy(p_item_id text, p_count int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_item public.caseup_items%rowtype;
  v_count int := greatest(1, least(10, coalesce(p_count, 1)));
  v_discount boolean := false;
  v_unit bigint;
  v_total bigint;
  v_new_price bigint;
  v_i int;
  v_inv_id uuid;
  v_finish text;
  v_rows jsonb := '[]'::jsonb;
  v_magnet numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  insert into public.nodbet_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.caseup_boosts (user_id) values (v_uid) on conflict (user_id) do nothing;

  select * into v_item from public.caseup_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Предмет не найден на рынке');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;

  select (now() < coalesce(buy_discount_until, '-infinity'::timestamptz))
    into v_discount from public.caseup_boosts where user_id = v_uid;

  v_unit := round(v_item.price * case when v_discount then 0.97 else 1.0 end);
  v_total := v_unit * v_count;
  if v_prof.balance < v_total then
    return jsonb_build_object('ok', false, 'error',
      'Недостаточно NOD-Коинов! Нужно ' || v_total || ' NOD.');
  end if;

  for v_i in 1..v_count loop
    v_inv_id := gen_random_uuid();
    v_finish := case when v_item.is_knife then public.caseup_knife_finish() else null end;
    insert into public.caseup_inventory (id, user_id, item_id, knife_finish, source, price_paid, created_at)
    values (v_inv_id, v_uid, v_item.id, v_finish, 'market', v_unit, clock_timestamp());
    v_rows := v_rows || jsonb_build_object('inv_id', v_inv_id, 'knife_finish', v_finish, 'price_paid', v_unit);
  end loop;

  insert into public.caseup_market_trades (item_id, user_id, kind, price, created_at)
  values (v_item.id, v_uid, 'buy', v_unit, clock_timestamp());

  -- Дрейф цены вверх от спроса
  update public.caseup_items
  set price = public.caseup_round_price(least(price_high, round(price * 1.015)))
  where id = v_item.id
  returning price into v_new_price;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  update public.nodbet_profiles
  set balance = balance - v_total,
      xp = xp + round(15 * v_count * v_magnet)
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true,
    'balance', v_prof.balance,
    'xp', v_prof.xp,
    'new_price', v_new_price,
    'rows', v_rows
  );
end $$;

-- ============================================================
-- 4.3 ПРОДАЖА НА РЫНКЕ
-- Мгновенная продажа рынку по текущей цене минус комиссия 5%
-- (4% с «Маркет-Профи», +2% к выплате при «Золотых Руках»).
-- Цена дрейфует вниз (−1.5%, в пределах границ).
-- ============================================================
create or replace function public.caseup_market_sell(p_inv_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_inv public.caseup_inventory%rowtype;
  v_item public.caseup_items%rowtype;
  v_pro boolean := false;
  v_sellbonus boolean := false;
  v_comm numeric := 0.05;
  v_payout bigint;
  v_new_price bigint;
  v_magnet numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  insert into public.nodbet_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.caseup_boosts (user_id) values (v_uid) on conflict (user_id) do nothing;

  select * into v_inv from public.caseup_inventory where id = p_inv_id and user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Предмет не найден в инвентаре');
  end if;

  select * into v_item from public.caseup_items where id = v_inv.item_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Предмет не найден на рынке');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;

  select market_pro, (now() < coalesce(sell_bonus_until, '-infinity'::timestamptz))
    into v_pro, v_sellbonus from public.caseup_boosts where user_id = v_uid;

  v_comm := case when v_pro then 0.04 else 0.05 end;
  v_payout := round(v_item.price * (1 - v_comm) * (case when v_sellbonus then 1.02 else 1.0 end));
  v_payout := greatest(1, v_payout);

  delete from public.caseup_inventory where id = p_inv_id;

  insert into public.caseup_market_trades (item_id, user_id, kind, price, created_at)
  values (v_item.id, v_uid, 'sell', v_payout, clock_timestamp());

  -- Дрейф цены вниз от предложения
  update public.caseup_items
  set price = public.caseup_round_price(greatest(price_low, round(price * 0.985)))
  where id = v_item.id
  returning price into v_new_price;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  update public.nodbet_profiles
  set balance = balance + v_payout,
      xp = xp + round(20 * v_magnet)
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true,
    'balance', v_prof.balance,
    'xp', v_prof.xp,
    'payout', v_payout,
    'new_price', v_new_price
  );
end $$;

-- ============================================================
-- 4.4 АПГРЕЙД ОРУЖИЯ (Модернизация Оружия 2.0)
-- Шанс = (цена_источника / цена_цели)^1.1 × 100% + бусты,
-- кап 95%. При неудаче предмет сгорает. При успехе цель
-- попадает в инвентарь, её цена слегка растёт.
-- ============================================================
create or replace function public.caseup_upgrade(p_inv_id uuid, p_target_item_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_inv public.caseup_inventory%rowtype;
  v_source public.caseup_items%rowtype;
  v_target public.caseup_items%rowtype;
  v_lucky boolean := false;
  v_contract boolean := false;
  v_chance numeric;
  v_ratio numeric;
  v_success boolean;
  v_new_inv uuid;
  v_finish text;
  v_new_price bigint;
  v_magnet numeric;
  v_xp int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  insert into public.nodbet_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.caseup_boosts (user_id) values (v_uid) on conflict (user_id) do nothing;

  select * into v_inv from public.caseup_inventory where id = p_inv_id and user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Предмет не найден в инвентаре');
  end if;

  select * into v_source from public.caseup_items where id = v_inv.item_id;
  select * into v_target from public.caseup_items where id = p_target_item_id for update;
  if v_source.id is null or v_target.id is null then
    return jsonb_build_object('ok', false, 'error', 'Предмет не найден');
  end if;

  if v_target.price < v_source.price then
    return jsonb_build_object('ok', false, 'error', 'Цель должна быть не дешевле вашего предмета');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;

  select lucky_ticket, (now() < coalesce(upgrade_chance_until, '-infinity'::timestamptz))
    into v_lucky, v_contract from public.caseup_boosts where user_id = v_uid;

  v_ratio := v_source.price::numeric / v_target.price::numeric;
  v_ratio := least(1.0, v_ratio);
  v_chance := power(v_ratio, 1.1) * 100;
  if v_lucky then v_chance := v_chance + 1.5; end if;
  if v_contract then v_chance := v_chance + 4; end if;
  v_chance := least(95, greatest(5, v_chance));

  v_success := random() * 100 < v_chance;

  if v_success then
    v_new_inv := gen_random_uuid();
    v_finish := case when v_target.is_knife then public.caseup_knife_finish() else null end;
    insert into public.caseup_inventory (id, user_id, item_id, knife_finish, source, price_paid, created_at)
    values (v_new_inv, v_uid, v_target.id, v_finish, 'upgrade', v_target.price, clock_timestamp());

    update public.caseup_items
    set price = public.caseup_round_price(least(price_high, round(price * 1.01)))
    where id = v_target.id
    returning price into v_new_price;

    v_xp := 150;
  else
    v_xp := 40;
  end if;

  delete from public.caseup_inventory where id = p_inv_id;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  update public.nodbet_profiles
  set xp = xp + round(v_xp * v_magnet)
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true,
    'success', v_success,
    'chance', round(v_chance::numeric, 1),
    'balance', v_prof.balance,
    'xp', v_prof.xp,
    'new_price', case when v_success then v_new_price else null end,
    'result', case
      when v_success then jsonb_build_object('item_id', v_target.id, 'knife_finish', v_finish, 'inv_id', v_new_inv)
      else null end
  );
end $$;

-- ============================================================
-- 4.5 МАГАЗИН БУСТОВ
-- Постоянные: market_pro (4 млн), lucky_ticket (7 млн).
-- Временные (активируются сразу, продлеваются от текущего
-- максимума): buy_discount −3% 30 мин (1.2 млн),
-- sell_bonus +2% 60 мин (1.8 млн), upgrade_chance +4% 45 мин
-- (2.4 млн), case_luck +0.5% редкие 90 мин (3 млн).
-- ============================================================
create or replace function public.caseup_buy_boost(p_boost_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.nodbet_profiles%rowtype;
  v_boost text := lower(trim(coalesce(p_boost_id, '')));
  v_cost bigint;
  v_owned boolean := false;
  v_active boolean := false;
  v_magnet numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется авторизация');
  end if;

  insert into public.nodbet_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.caseup_boosts (user_id) values (v_uid) on conflict (user_id) do nothing;

  v_cost := case v_boost
    when 'market_pro' then 4000000
    when 'lucky_ticket' then 7000000
    when 'buy_discount' then 1200000
    when 'sell_bonus' then 1800000
    when 'upgrade_chance' then 2400000
    when 'case_luck' then 3000000
    else null end;
  if v_cost is null then
    return jsonb_build_object('ok', false, 'error', 'Буст не найден');
  end if;

  select * into v_prof from public.nodbet_profiles where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Профиль не найден');
  end if;

  select
    case
      when v_boost = 'market_pro' then market_pro
      when v_boost = 'lucky_ticket' then lucky_ticket
      else false
    end,
    case
      when v_boost = 'buy_discount' then now() < coalesce(buy_discount_until, '-infinity'::timestamptz)
      when v_boost = 'sell_bonus' then now() < coalesce(sell_bonus_until, '-infinity'::timestamptz)
      when v_boost = 'upgrade_chance' then now() < coalesce(upgrade_chance_until, '-infinity'::timestamptz)
      when v_boost = 'case_luck' then now() < coalesce(case_luck_until, '-infinity'::timestamptz)
      else false
    end
    into v_owned, v_active from public.caseup_boosts where user_id = v_uid;

  if v_owned or v_active then
    return jsonb_build_object('ok', false, 'error',
      case when v_boost in ('market_pro', 'lucky_ticket') then 'Этот буст у вас уже есть!' else 'Этот буст уже активен!' end);
  end if;

  if v_prof.balance < v_cost then
    return jsonb_build_object('ok', false, 'error',
      'Недостаточно NOD-Коинов! Нужно ' || v_cost || ' NOD.');
  end if;

  update public.caseup_boosts set
    market_pro = case when v_boost = 'market_pro' then true else market_pro end,
    lucky_ticket = case when v_boost = 'lucky_ticket' then true else lucky_ticket end,
    buy_discount_until = case
      when v_boost = 'buy_discount' then greatest(now(), coalesce(buy_discount_until, now())) + interval '30 minutes'
      else buy_discount_until end,
    sell_bonus_until = case
      when v_boost = 'sell_bonus' then greatest(now(), coalesce(sell_bonus_until, now())) + interval '60 minutes'
      else sell_bonus_until end,
    upgrade_chance_until = case
      when v_boost = 'upgrade_chance' then greatest(now(), coalesce(upgrade_chance_until, now())) + interval '45 minutes'
      else upgrade_chance_until end,
    case_luck_until = case
      when v_boost = 'case_luck' then greatest(now(), coalesce(case_luck_until, now())) + interval '90 minutes'
      else case_luck_until end
  where user_id = v_uid;

  v_magnet := case when v_prof.coin_magnet then 1.1 else 1.0 end;
  update public.nodbet_profiles
  set balance = balance - v_cost,
      xp = xp + round(100 * v_magnet)
  where user_id = v_uid
  returning balance, xp into v_prof.balance, v_prof.xp;

  return jsonb_build_object(
    'ok', true,
    'balance', v_prof.balance,
    'xp', v_prof.xp,
    'boosts', (select to_jsonb(b) from public.caseup_boosts b where b.user_id = v_uid)
  );
end $$;

-- ============================================================
-- 5. ПРАВА НА ФУНКЦИИ
-- ============================================================
revoke all on function public.caseup_open_case(text, int) from public, anon;
revoke all on function public.caseup_market_buy(text, int) from public, anon;
revoke all on function public.caseup_market_sell(uuid) from public, anon;
revoke all on function public.caseup_upgrade(uuid, text) from public, anon;
revoke all on function public.caseup_buy_boost(text) from public, anon;
revoke all on function public.caseup_roll_item(text, boolean) from public, anon;
revoke all on function public.caseup_round_price(bigint) from public, anon;
revoke all on function public.caseup_knife_finish() from public, anon;

grant execute on function public.caseup_open_case(text, int) to authenticated;
grant execute on function public.caseup_market_buy(text, int) to authenticated;
grant execute on function public.caseup_market_sell(uuid) to authenticated;
grant execute on function public.caseup_upgrade(uuid, text) to authenticated;
grant execute on function public.caseup_buy_boost(text) to authenticated;

-- ============================================================
-- 6. REALTIME: цены, сделки и бусты обновляются у всех онлайн
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'caseup_cases', 'caseup_items', 'caseup_inventory',
    'caseup_opens', 'caseup_boosts', 'caseup_market_trades'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Обновляем кэш схемы PostgREST, чтобы новые таблицы и функции
-- сразу стали доступны клиенту.
select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- Проверка (по желанию):
--   select count(*) from public.caseup_cases;      -- 4
--   select count(*) from public.caseup_items;      -- 28
-- ============================================================
