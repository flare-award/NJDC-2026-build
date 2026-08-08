// ============================================================
// CASEUP by 1DONY — каталог кейсов и предметов.
// ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ для клиента. SQL-сид в
// supabase-caseup-migration.sql генерируется из этого файла
// (скрипт scripts/gen-caseup-sql.mjs), чтобы данные не расходились.
// ============================================================

export type CaseupRarity = "mil-spec" | "restricted" | "classified" | "covert" | "knife";

export interface CaseupCaseDef {
  id: string;
  name: string;
  description: string;
  price: number; // цена открытия за 1 кейс (NOD)
  image: string;
  accent: string; // акцентный цвет карточки
  knifeItemId: string; // какой нож выпадает из этого кейса
  knifeChance: number; // шанс ножа (процент, 0.26 = 0.26%)
  sortOrder: number;
}

export interface CaseupItemDef {
  id: string;
  caseId: string | null; // null = глобальный предмет (нож)
  name: string; // база имени, например "AK-47"
  skinName: string; // скин, например "Расплавленный"
  rarity: CaseupRarity;
  image: string;
  basePrice: number; // стартовая рыночная цена
  dropChance: number; // вес шанса среди скинов кейса (сумма по кейсу = 100 - knifeChance)
  sortOrder: number;
}

// Шансы выпадения (в процентах). Для скинов в кейсе сумма = 100 - knifeChance,
// нож добавляется отдельно через case.knifeChance.
export const RARITY_DROP: Record<Exclude<CaseupRarity, "knife">, number> = {
  "mil-spec": 40,
  restricted: 7.95,
  classified: 3.2,
  covert: 0.64,
};

export const KNIFE_CHANCE_DEFAULT = 0.26;

// Случайные "скины" ножа, которые присваиваются при выпадении/покупке ножа.
export const KNIFE_FINISHES = [
  "Градиент",
  "Мраморный Градиент",
  "Убийство",
  "Скользкий",
  "Лазурная Сетка",
  "Фазовый",
] as const;

export const CASEUP_CASES: CaseupCaseDef[] = [
  {
    id: "case_molten",
    name: "Расплавленный Штурм",
    description: "Оружие, закалённое в жерле вулкана. Горячая серия для тех, кто любит рисковать.",
    price: 2500,
    image: "/caseup/cases/case_molten.png",
    accent: "#ff7a1a",
    knifeItemId: "knife_karambit",
    knifeChance: 0.26,
    sortOrder: 1,
  },
  {
    id: "case_neon",
    name: "Неоновый Разлом",
    description: "Киберпанк-серия с неоновыми схемами. Светится в темноте и в твоём инвентаре.",
    price: 4500,
    image: "/caseup/cases/case_neon.png",
    accent: "#22d3ee",
    knifeItemId: "knife_m9",
    knifeChance: 0.26,
    sortOrder: 2,
  },
  {
    id: "case_frost",
    name: "Ледяная Глубина",
    description: "Оружие из вечной мерзлоты. Холодное как расчёт, точное как лёд.",
    price: 7500,
    image: "/caseup/cases/case_frost.png",
    accent: "#7cc7ff",
    knifeItemId: "knife_bayonet",
    knifeChance: 0.26,
    sortOrder: 3,
  },
  {
    id: "case_gold",
    name: "Золотая Лихорадка",
    description: "Легендарная серия для охотников за сокровищами. Джекпот уже близко.",
    price: 12000,
    image: "/caseup/cases/case_gold.png",
    accent: "#ffd54a",
    knifeItemId: "knife_butterfly",
    knifeChance: 0.26,
    sortOrder: 4,
  },
];

export const CASEUP_ITEMS: CaseupItemDef[] = [
  // ===== Кейс 1: Расплавленный Штурм =====
  {
    id: "mol_mp9_blaze",
    caseId: "case_molten",
    name: "MP9",
    skinName: "Вспышка",
    rarity: "mil-spec",
    image: "/caseup/items/mol_mp9_blaze.png",
    basePrice: 650,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 1,
  },
  {
    id: "mol_famas_cinder",
    caseId: "case_molten",
    name: "FAMAS",
    skinName: "Головешка",
    rarity: "mil-spec",
    image: "/caseup/items/mol_famas_cinder.png",
    basePrice: 600,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 2,
  },
  {
    id: "mol_glock_magma",
    caseId: "case_molten",
    name: "Glock-18",
    skinName: "Магма",
    rarity: "restricted",
    image: "/caseup/items/mol_glock_magma.png",
    basePrice: 3200,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 3,
  },
  {
    id: "mol_m4a1_scorch",
    caseId: "case_molten",
    name: "M4A1-S",
    skinName: "Опалённый",
    rarity: "restricted",
    image: "/caseup/items/mol_m4a1_scorch.png",
    basePrice: 3000,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 4,
  },
  {
    id: "mol_usp_ember",
    caseId: "case_molten",
    name: "USP-S",
    skinName: "Уголёк",
    rarity: "classified",
    image: "/caseup/items/mol_usp_ember.png",
    basePrice: 10500,
    dropChance: RARITY_DROP["classified"],
    sortOrder: 5,
  },
  {
    id: "mol_ak47_molten",
    caseId: "case_molten",
    name: "AK-47",
    skinName: "Расплавленный",
    rarity: "covert",
    image: "/caseup/items/mol_ak47_molten.png",
    basePrice: 42000,
    dropChance: RARITY_DROP["covert"],
    sortOrder: 6,
  },
  // ===== Кейс 2: Неоновый Разлом =====
  {
    id: "neo_galil_laser",
    caseId: "case_neon",
    name: "Galil AR",
    skinName: "Лазер",
    rarity: "mil-spec",
    image: "/caseup/items/neo_galil_laser.png",
    basePrice: 1150,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 1,
  },
  {
    id: "neo_tec9_glitch",
    caseId: "case_neon",
    name: "Tec-9",
    skinName: "Глитч",
    rarity: "mil-spec",
    image: "/caseup/items/neo_tec9_glitch.png",
    basePrice: 1100,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 2,
  },
  {
    id: "neo_mp7_signal",
    caseId: "case_neon",
    name: "MP7",
    skinName: "Сигнал",
    rarity: "restricted",
    image: "/caseup/items/neo_mp7_signal.png",
    basePrice: 5650,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 3,
  },
  {
    id: "neo_p90_circuit",
    caseId: "case_neon",
    name: "P90",
    skinName: "Схема",
    rarity: "restricted",
    image: "/caseup/items/neo_p90_circuit.png",
    basePrice: 5600,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 4,
  },
  {
    id: "neo_deagle_pulse",
    caseId: "case_neon",
    name: "Desert Eagle",
    skinName: "Импульс",
    rarity: "classified",
    image: "/caseup/items/neo_deagle_pulse.png",
    basePrice: 18750,
    dropChance: RARITY_DROP["classified"],
    sortOrder: 5,
  },
  {
    id: "neo_awp_volt",
    caseId: "case_neon",
    name: "AWP",
    skinName: "Вольт",
    rarity: "covert",
    image: "/caseup/items/neo_awp_volt.png",
    basePrice: 75000,
    dropChance: RARITY_DROP["covert"],
    sortOrder: 6,
  },
  // ===== Кейс 3: Ледяная Глубина =====
  {
    id: "fro_mac10_frostbite",
    caseId: "case_frost",
    name: "MAC-10",
    skinName: "Обморожение",
    rarity: "mil-spec",
    image: "/caseup/items/fro_mac10_frostbite.png",
    basePrice: 1900,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 1,
  },
  {
    id: "fro_five7_chill",
    caseId: "case_frost",
    name: "Five-SeveN",
    skinName: "Холод",
    rarity: "mil-spec",
    image: "/caseup/items/fro_five7_chill.png",
    basePrice: 1850,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 2,
  },
  {
    id: "fro_ump_hoarfrost",
    caseId: "case_frost",
    name: "UMP-45",
    skinName: "Иней",
    rarity: "restricted",
    image: "/caseup/items/fro_ump_hoarfrost.png",
    basePrice: 9300,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 3,
  },
  {
    id: "fro_m4a4_snowfall",
    caseId: "case_frost",
    name: "M4A4",
    skinName: "Снегопад",
    rarity: "restricted",
    image: "/caseup/items/fro_m4a4_snowfall.png",
    basePrice: 9250,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 4,
  },
  {
    id: "fro_awp_arctic",
    caseId: "case_frost",
    name: "AWP",
    skinName: "Арктика",
    rarity: "classified",
    image: "/caseup/items/fro_awp_arctic.png",
    basePrice: 31000,
    dropChance: RARITY_DROP["classified"],
    sortOrder: 5,
  },
  {
    id: "fro_ak47_glacier",
    caseId: "case_frost",
    name: "AK-47",
    skinName: "Ледник",
    rarity: "covert",
    image: "/caseup/items/fro_ak47_glacier.png",
    basePrice: 124000,
    dropChance: RARITY_DROP["covert"],
    sortOrder: 6,
  },
  // ===== Кейс 4: Золотая Лихорадка =====
  {
    id: "gol_sg553_bullion",
    caseId: "case_gold",
    name: "SG 553",
    skinName: "Слиток",
    rarity: "mil-spec",
    image: "/caseup/items/gol_sg553_bullion.png",
    basePrice: 3000,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 1,
  },
  {
    id: "gol_p250_coin",
    caseId: "case_gold",
    name: "P250",
    skinName: "Монета",
    rarity: "mil-spec",
    image: "/caseup/items/gol_p250_coin.png",
    basePrice: 2950,
    dropChance: RARITY_DROP["mil-spec"],
    sortOrder: 2,
  },
  {
    id: "gol_mp9_nugget",
    caseId: "case_gold",
    name: "MP9",
    skinName: "Самородок",
    rarity: "restricted",
    image: "/caseup/items/gol_mp9_nugget.png",
    basePrice: 14950,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 3,
  },
  {
    id: "gol_m4a1_royal",
    caseId: "case_gold",
    name: "M4A1-S",
    skinName: "Королевский",
    rarity: "restricted",
    image: "/caseup/items/gol_m4a1_royal.png",
    basePrice: 14900,
    dropChance: RARITY_DROP["restricted"],
    sortOrder: 4,
  },
  {
    id: "gol_awp_gilded",
    caseId: "case_gold",
    name: "AWP",
    skinName: "Позолота",
    rarity: "classified",
    image: "/caseup/items/gol_awp_gilded.png",
    basePrice: 49750,
    dropChance: RARITY_DROP["classified"],
    sortOrder: 5,
  },
  {
    id: "gol_ak47_treasure",
    caseId: "case_gold",
    name: "AK-47",
    skinName: "Сокровище",
    rarity: "covert",
    image: "/caseup/items/gol_ak47_treasure.png",
    basePrice: 199000,
    dropChance: RARITY_DROP["covert"],
    sortOrder: 6,
  },
  // ===== Ножи (глобальные, не привязаны к кейсу) =====
  {
    id: "knife_karambit",
    caseId: null,
    name: "Керамбит",
    skinName: "",
    rarity: "knife",
    image: "/caseup/items/knife_karambit.png",
    basePrice: 210000,
    dropChance: 0,
    sortOrder: 1,
  },
  {
    id: "knife_m9",
    caseId: null,
    name: "M9 Байонет",
    skinName: "",
    rarity: "knife",
    image: "/caseup/items/knife_m9.png",
    basePrice: 375000,
    dropChance: 0,
    sortOrder: 2,
  },
  {
    id: "knife_bayonet",
    caseId: null,
    name: "Штык-нож",
    skinName: "",
    rarity: "knife",
    image: "/caseup/items/knife_bayonet.png",
    basePrice: 620000,
    dropChance: 0,
    sortOrder: 3,
  },
  {
    id: "knife_butterfly",
    caseId: null,
    name: "Бабочка",
    skinName: "",
    rarity: "knife",
    image: "/caseup/items/knife_butterfly.png",
    basePrice: 995000,
    dropChance: 0,
    sortOrder: 4,
  },
];

// Комиссия рынка при продаже (в долях, 0.05 = 5%)
export const MARKET_COMMISSION = 0.05;
export const MARKET_COMMISSION_PRO = 0.04; // с привилегией "Маркет-Профи"
// Шаги дрейфа цены за сделку (покупают → цена растёт, продают → падает)
export const PRICE_DRIFT_BUY = 0.015;
export const PRICE_DRIFT_SELL = 0.015;
export const PRICE_LOW_RATIO = 0.55;
export const PRICE_HIGH_RATIO = 1.8;

// Магазин CASEUP: бусты
export type CaseupBoostId =
  | "market_pro"
  | "lucky_ticket"
  | "buy_discount"
  | "sell_bonus"
  | "upgrade_chance"
  | "case_luck";

export interface CaseupBoostDef {
  id: CaseupBoostId;
  name: string;
  description: string;
  cost: number;
  durationMin: number | null; // null = постоянный
  icon: string;
  badge: string;
  permanent: boolean;
}

export const CASEUP_BOOSTS: CaseupBoostDef[] = [
  {
    id: "market_pro",
    name: "📦 Маркет-Профи",
    description: "Постоянная скидка на комиссию рынка: при продаже предметов комиссия 4% вместо 5%.",
    cost: 4000000,
    durationMin: null,
    icon: "📦",
    badge: "КОМИССИЯ 4%",
    permanent: true,
  },
  {
    id: "lucky_ticket",
    name: "🍀 Счастливый Билет",
    description: "Постоянный бонус +1.5% к шансу успеха в Апгрейде оружия. Маленький, но честный.",
    cost: 7000000,
    durationMin: null,
    icon: "🍀",
    badge: "+1.5% АПГРЕЙД",
    permanent: true,
  },
  {
    id: "buy_discount",
    name: "📈 Рыночный Инсайдер",
    description: "Временный буст: −3% к цене при покупке предметов на рынке в течение 30 минут.",
    cost: 1200000,
    durationMin: 30,
    icon: "📈",
    badge: "−3% ПОКУПКА · 30 МИН",
    permanent: false,
  },
  {
    id: "sell_bonus",
    name: "💼 Золотые Руки",
    description: "Временный буст: +2% к выплате при продаже предметов на рынке в течение 60 минут.",
    cost: 1800000,
    durationMin: 60,
    icon: "💼",
    badge: "+2% ПРОДАЖА · 60 МИН",
    permanent: false,
  },
  {
    id: "upgrade_chance",
    name: "🎯 Удачный Контракт",
    description: "Временный буст: +4% к шансу успеха в Апгрейде оружия в течение 45 минут.",
    cost: 2400000,
    durationMin: 45,
    icon: "🎯",
    badge: "+4% АПГРЕЙД · 45 МИН",
    permanent: false,
  },
  {
    id: "case_luck",
    name: "🔮 Фортуна Открывателя",
    description: "Временный буст: шанс выпадения редких предметов (Запрещённое и выше) из кейсов увеличен на 0.5% в течение 90 минут.",
    cost: 3000000,
    durationMin: 90,
    icon: "🔮",
    badge: "+0.5% РЕДКИЕ · 90 МИН",
    permanent: false,
  },
];

export const BOOST_DURATION_MS: Record<CaseupBoostId, number | null> = {
  market_pro: null,
  lucky_ticket: null,
  buy_discount: 30 * 60 * 1000,
  sell_bonus: 60 * 60 * 1000,
  upgrade_chance: 45 * 60 * 1000,
  case_luck: 90 * 60 * 1000,
};
