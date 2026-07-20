// ============================================================
// Клатч-Рулетка NODBET — честная система бонусов (исправлено)
// 5 основных бонусов в колесе (1 отрицательный и 4 положительных):
//   1. strong_neg  — 12% Крупная потеря (x-1, теряете ставку)
//   2. normal      — 38% Обычный (x1.25)
//   3. big         — 22% Большой (x1.8)
//   4. super       — 18% Супер (x2.5)
//   5. jackpot     — 10% Джекпот (x5.0)
// Сумма = 100%, хорошие в сумме 88% — как в описании.
// Шансы теперь СТРОГО равны базовым, без адаптивной подкрутки,
// чтобы написанные % совпадали с реальными.
// ============================================================

export type BonusId = "strong_neg" | "weak_neg" | "normal" | "big" | "super" | "jackpot";

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
  baseWeight: number;
  description: string;
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
    baseWeight: 12,
    description: "Единственный отрицательный сектор: теряете все поставленные деньги на спин.",
  },
  weak_neg: {
    id: "weak_neg",
    order: 2,
    label: "🟤 Небольшая потеря",
    shortLabel: "🟤 −50%",
    color: "#3f2d1a",
    textColor: "#d6b98c",
    emoji: "🟤",
    multiplier: -0.5,
    isNegative: true,
    baseWeight: 0,
    description: "Слабо отрицательный (архивный бонус).",
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
    baseWeight: 38,
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
    baseWeight: 22,
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
    baseWeight: 18,
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
    baseWeight: 10,
    description: "Джекпот (самое редкое): множитель x5.0 к ставке. Чем выше ставка — тем больше куш.",
  },
};

export const BONUS_ORDER: BonusId[] = ["strong_neg", "normal", "big", "super", "jackpot"];

export type StreakMap = Record<BonusId, number>;

export function emptyStreak(): StreakMap {
  return { strong_neg: 0, weak_neg: 0, normal: 0, big: 0, super: 0, jackpot: 0 };
}

/**
 * Честные веса — строго базовые 12/38/22/18/10.
 * Адаптивная подкрутка отключена, чтобы % в UI = реальным шансам.
 */
export function currentWeights(_streak: StreakMap): Record<BonusId, number> {
  return {
    strong_neg: BONUSES.strong_neg.baseWeight,
    weak_neg: 0,
    normal: BONUSES.normal.baseWeight,
    big: BONUSES.big.baseWeight,
    super: BONUSES.super.baseWeight,
    jackpot: BONUSES.jackpot.baseWeight,
  };
}

export function pickBonus(_streak: StreakMap): BonusId {
  const weights = currentWeights(_streak);
  const total = BONUS_ORDER.reduce((s, id) => s + weights[id], 0);
  let roll = Math.random() * total;
  for (const id of BONUS_ORDER) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return "normal";
}

export function updateStreak(streak: StreakMap, won: BonusId): StreakMap {
  const next = { ...streak };
  for (const id of BONUS_ORDER) {
    if (id === won) next[id] = Math.min(24, next[id] + 1);
    else next[id] = Math.max(0, next[id] - 1);
  }
  return next;
}

/**
 * ИСПРАВЛЕННЫЙ расчёт спина.
 * При ставке 5000:
 *  - normal x1.25 => payout 6250, delta +1250 (чистая прибыль 1250, всего вернётся 6250)
 *  - big x1.8 => payout 9000, delta +4000
 *  - super x2.5 => payout 12500, delta +7500
 *  - jackpot x5.0 => payout 25000, delta +20000
 *  - strong_neg => теряете всю ставку (delta -bet)
 * При фри-спине (bet <=0): 50/100/250/600 как заявлено.
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
  def: BonusDef;
}

export function buildWheelSectors(): WheelSector[] {
  const totalWeight = BONUS_ORDER.reduce((s, id) => s + BONUSES[id].baseWeight, 0);
  const sectors: WheelSector[] = [];
  let cursor = 0;
  for (const id of BONUS_ORDER) {
    const def = BONUSES[id];
    const size = (def.baseWeight / totalWeight) * 360;
    const start = cursor;
    const end = cursor + size;
    sectors.push({
      id,
      startDeg: start,
      endDeg: end,
      midDeg: start + size / 2,
      sizeDeg: size,
      def,
    });
    cursor = end;
  }
  return sectors;
}

export function wheelGradient(sectors: WheelSector[]): string {
  const parts = sectors.map((s) => `${s.def.color} ${s.startDeg}deg ${s.endDeg}deg`);
  return `conic-gradient(${parts.join(", ")})`;
}
