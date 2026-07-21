// ============================================================
// Клатч-Рулетка NODBET — честная система бонусов.
//
// ДВА режима колеса:
//
// 1) CLASSIC («Клатч-Рулетка NODBET») — 6 секторов:
//    💀 Крупная потеря  (−100% ставки)  —  5%
//    🟤 Слабая потеря   (−50% ставки)   — 10%   ← НОВЫЙ отрицательный сектор
//    ⚫ Обычный бонус   (x1.25)         — 40%
//    🔴 Большой бонус   (x1.8)          — 20%
//    🟣 Супер-бонус     (x2.5)          — 15%
//    🟢 ДЖЕКПОТ         (x5.0)          — 10%
//    Сумма = 100%.
//
// 2) ALLORNOTHING («Всё или ничего») — 2 сектора ровно по 50%:
//    🟢 ДЖЕКПОТ         (x5.0)          — 50%
//    ❌ Неудача         (−100% ставки)  — 50%
//
// Шансы СТРОГО равны заявленным, без адаптивной подкрутки.
// Геометрия колеса строится из ТЕХ ЖЕ весов, что и выбор бонуса,
// поэтому сектор, на котором останавливается стрелка, всегда
// совпадает с реально выпавшим бонусом.
// ============================================================

export type BonusId = "strong_neg" | "weak_neg" | "normal" | "big" | "super" | "jackpot" | "fail";

export type RouletteMode = "classic" | "allornothing";

export interface BonusDef {
  id: BonusId;
  order: number;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  emoji: string;
  multiplier: number;
  isNegative: boolean;
  description: string;
}

/** Вес сектора для конкретного режима (0 = сектор не участвует). */
export type WeightMap = Record<BonusId, number>;

export interface RoulettePreset {
  id: RouletteMode;
  name: string;
  description: string;
  order: BonusId[]; // порядок секторов на колесе (по часовой от верха)
  weights: WeightMap; // шансы (сумма = 100)
}

export const BONUSES: Record<BonusId, BonusDef> = {
  strong_neg: {
    id: "strong_neg",
    order: 1,
    label: "💀 Крупная потеря",
    shortLabel: "💀 −100%",
    color: "#450a0a",
    textColor: "#fca5a5",
    emoji: "💀",
    multiplier: -1.0,
    isNegative: true,
    description: "Крупная потеря: теряете ВСЮ ставку на спин.",
  },
  weak_neg: {
    id: "weak_neg",
    order: 2,
    label: "🟤 Слабая потеря",
    shortLabel: "🟤 −50%",
    color: "#5b3a1a",
    textColor: "#e0b98c",
    emoji: "🟤",
    multiplier: -0.5,
    isNegative: true,
    description: "Слабая потеря: теряете 50% от ставки на спин.",
  },
  normal: {
    id: "normal",
    order: 3,
    label: "⚫ Обычный бонус",
    shortLabel: "⚫ x1.25",
    color: "#27272a",
    textColor: "#e4e4e7",
    emoji: "⚫",
    multiplier: 1.25,
    isNegative: false,
    description: "Обычный бонус: возвращает ставку с плюсом (x1.25). При фри-спине даёт 50 NOD.",
  },
  big: {
    id: "big",
    order: 4,
    label: "🔴 Большой бонус",
    shortLabel: "🔴 x1.8",
    color: "#b91c1c",
    textColor: "#ffffff",
    emoji: "🔴",
    multiplier: 1.8,
    isNegative: false,
    description: "Большой бонус: множитель x1.8 к ставке.",
  },
  super: {
    id: "super",
    order: 5,
    label: "🟣 Супер-бонус",
    shortLabel: "🟣 x2.5",
    color: "#7e22ce",
    textColor: "#ffffff",
    emoji: "🟣",
    multiplier: 2.5,
    isNegative: false,
    description: "Супер-бонус: множитель x2.5 к ставке.",
  },
  jackpot: {
    id: "jackpot",
    order: 6,
    label: "🟢 ДЖЕКПОТ",
    shortLabel: "🟢 x5.0",
    color: "#16a34a",
    textColor: "#ffffff",
    emoji: "🟢",
    multiplier: 5.0,
    isNegative: false,
    description: "Джекпот: множитель x5.0 к ставке. Чем выше ставка — тем больше куш.",
  },
  fail: {
    id: "fail",
    order: 7,
    label: "❌ Неудача",
    shortLabel: "❌ −100%",
    color: "#3f0d0d",
    textColor: "#fecaca",
    emoji: "❌",
    multiplier: -1.0,
    isNegative: true,
    description: "Неудача: теряете всю ставку на спин (режим «Всё или ничего»).",
  },
};

function emptyAll(): WeightMap {
  return { strong_neg: 0, weak_neg: 0, normal: 0, big: 0, super: 0, jackpot: 0, fail: 0 };
}

/** Пресеты режимов колеса (единственный источник правды для шансов). */
export const ROULETTE_PRESETS: Record<RouletteMode, RoulettePreset> = {
  classic: {
    id: "classic",
    name: "Клатч-Рулетка NODBET",
    description: "Честное колесо с 6 секторами: можно и выиграть, и потерять.",
    order: ["strong_neg", "normal", "big", "weak_neg", "super", "jackpot"],
    weights: {
      ...emptyAll(),
      strong_neg: 5,
      weak_neg: 10,
      normal: 40,
      big: 20,
      super: 15,
      jackpot: 10,
    },
  },
  allornothing: {
    id: "allornothing",
    name: "Всё или ничего",
    description: "Только 2 сектора: 50% — Джекпот x5.0, 50% — Неудача (−100%).",
    order: ["jackpot", "fail"],
    weights: {
      ...emptyAll(),
      jackpot: 50,
      fail: 50,
    },
  },
};

/** Обратная совместимость: порядок секторов классического режима. */
export const BONUS_ORDER: BonusId[] = ROULETTE_PRESETS.classic.order;

export type StreakMap = Record<BonusId, number>;

export function emptyStreak(): StreakMap {
  return { strong_neg: 0, weak_neg: 0, normal: 0, big: 0, super: 0, jackpot: 0, fail: 0 };
}

/**
 * Честные веса — строго из пресета режима. Никакой адаптивной подкрутки,
 * чтобы % в UI = реальным шансам.
 */
export function currentWeights(mode: RouletteMode): WeightMap {
  return { ...ROULETTE_PRESETS[mode].weights };
}

/** Список активных секторов режима (вес > 0) в порядке колеса. */
export function activeSectors(mode: RouletteMode): BonusId[] {
  return ROULETTE_PRESETS[mode].order.filter((id) => ROULETTE_PRESETS[mode].weights[id] > 0);
}

export function pickBonus(mode: RouletteMode): BonusId {
  const weights = currentWeights(mode);
  const ids = activeSectors(mode);
  const total = ids.reduce((s, id) => s + weights[id], 0);
  let roll = Math.random() * total;
  for (const id of ids) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return ids[ids.length - 1] ?? "normal";
}

export function updateStreak(streak: StreakMap, won: BonusId): StreakMap {
  const next = { ...streak };
  for (const id of Object.keys(next) as BonusId[]) {
    if (id === won) next[id] = Math.min(24, next[id] + 1);
    else next[id] = Math.max(0, next[id] - 1);
  }
  return next;
}

/**
 * Расчёт результата спина.
 * Возвращает «дельту» баланса (прибыль/убыток относительно ставки).
 * Ставка списывается/возвращается НЕ отдельно — она уже учтена в дельте:
 *   - normal x1.25 при ставке 5000 → delta +1250 (вернётся 6250)
 *   - big x1.8     при ставке 5000 → delta +4000
 *   - super x2.5   при ставке 5000 → delta +7500
 *   - jackpot x5.0 при ставке 5000 → delta +20000
 *   - strong_neg / fail → delta −bet (теряете всю ставку)
 *   - weak_neg          → delta −bet/2 (теряете половину)
 * При фри-спине (bet <= 0): 50/100/250/600 как заявлено, без риска.
 */
export function computeSpinResult(bonusId: BonusId, betAmount: number): {
  delta: number;
  netWin: number;
  payout: number;
} {
  const def = BONUSES[bonusId] || BONUSES.normal;

  if (betAmount <= 0) {
    const freeMap: Record<BonusId, number> = {
      strong_neg: 0,
      weak_neg: 0,
      normal: 50,
      big: 100,
      super: 250,
      jackpot: 600,
      fail: 0,
    };
    const won = freeMap[bonusId] ?? 50;
    return { delta: won, netWin: won, payout: won };
  }

  if (def.isNegative) {
    const loss = Math.round(betAmount * Math.abs(def.multiplier));
    return { delta: -loss, netWin: -loss, payout: 0 };
  }

  const payout = Math.round(betAmount * def.multiplier);
  const delta = payout - betAmount;
  return { delta, netWin: delta, payout };
}

// ----- Геометрия колеса -----
export interface WheelSector {
  id: BonusId;
  startDeg: number;
  endDeg: number;
  midDeg: number;
  sizeDeg: number;
  weight: number;
  def: BonusDef;
}

/**
 * Строим секторы колеса из ТЕХ ЖЕ весов пресета, что и pickBonus.
 * Размер каждого сектора строго пропорционален его шансу.
 */
export function buildWheelSectors(mode: RouletteMode = "classic"): WheelSector[] {
  const preset = ROULETTE_PRESETS[mode];
  const ids = activeSectors(mode);
  const totalWeight = ids.reduce((s, id) => s + preset.weights[id], 0) || 1;
  const sectors: WheelSector[] = [];
  let cursor = 0;
  for (const id of ids) {
    const def = BONUSES[id];
    const weight = preset.weights[id];
    const size = (weight / totalWeight) * 360;
    const start = cursor;
    const end = cursor + size;
    sectors.push({
      id,
      startDeg: start,
      endDeg: end,
      midDeg: start + size / 2,
      sizeDeg: size,
      weight,
      def,
    });
    cursor = end;
  }
  return sectors;
}

export function wheelGradient(sectors: WheelSector[]): string {
  if (!sectors.length) return "conic-gradient(#27272a 0deg 360deg)";
  const parts = sectors.map((s) => `${s.def.color} ${s.startDeg}deg ${s.endDeg}deg`);
  return `conic-gradient(${parts.join(", ")})`;
}
