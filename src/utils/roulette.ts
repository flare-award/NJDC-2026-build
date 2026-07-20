// ============================================================
// Клатч-Рулетка NODBET — честная система бонусов (пункты 1, 8, 20)
//
// 5 основных бонусов в колесе (1 отрицательный и 4 положительных):
//   1. strong_neg  — отрицательный (теряет все деньги, ставку)
//   2. normal      — обычный (x1.25)
//   3. big         — большой (x1.8)
//   4. super       — супер-бонус (x2.5)
//   5. jackpot     — джекпот (x5.0)
// (weak_neg оставлен в справочнике для совместимости со старыми записями истории)
//
// Хорошие бонусы выпадают в сумме на 88% (против 12% плохого).
// Плохой бонус только один, который сливает все поставленные деньги.
//
// Колесо синхронизировано с бонусами: порядок секторов на колесе, их
// углы и цвета соответствуют выпавшему бонусу.
// ============================================================

export type BonusId = "strong_neg" | "weak_neg" | "normal" | "big" | "super" | "jackpot";

export interface BonusDef {
  id: BonusId;
  order: number; // 1..6, от худшего к лучшему
  label: string; // подпись сектора
  shortLabel: string; // для ленты истории
  color: string; // hex для conic-gradient колеса
  textColor: string; // цвет текста на секторе
  emoji: string;
  /** Множитель к сумме спина. Отрицательные = потеря ставки. */
  multiplier: number;
  isNegative: boolean;
  baseWeight: number; // базовый шанс, %
  description: string;
}

// Базовые определения бонусов.
export const BONUSES: Record<BonusId, BonusDef> = {
  strong_neg: {
    id: "strong_neg",
    order: 1,
    label: "💀 Крупная потеря",
    shortLabel: "💀 −100%",
    color: "#450a0a",
    textColor: "#fca5a5",
    emoji: "💀",
    multiplier: -1.0, // теряет все поставленные деньги на спин
    isNegative: true,
    baseWeight: 12, // 12% шанс (единственный плохой)
    description: "Единственный отрицательный сектор: теряете все поставленные деньги на спин.",
  },
  weak_neg: {
    // Оставлен для совместимости истории в БД/UI, на колесе больше не выпадает
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
    multiplier: 1.25, // возвращает ставку с небольшим плюсом
    isNegative: false,
    baseWeight: 38, // 38% шанс
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
    baseWeight: 22, // 22% шанс
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
    baseWeight: 18, // 18% шанс
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
    baseWeight: 10, // 10% шанс
    description: "Джекпот (самое редкое): множитель x5.0 к ставке. Чем выше ставка — тем больше куш.",
  },
};

/** Порядок активных бонусов для колеса и таблицы выплат: 1 отрицательный и 4 положительных. */
export const BONUS_ORDER: BonusId[] = ["strong_neg", "normal", "big", "super", "jackpot"];

/**
 * Счётчик «недавних выпадений» для адаптивных шансов.
 * Храним, сколько раз подряд/часто выпадал каждый бонус.
 */
export type StreakMap = Record<BonusId, number>;

export function emptyStreak(): StreakMap {
  return { strong_neg: 0, weak_neg: 0, normal: 0, big: 0, super: 0, jackpot: 0 };
}

const ADAPT_STEP = 0.25; // шаг изменения шанса, %

/**
 * Считаем текущие веса с учётом «частоты» выпадений.
 * За каждое накопленное «частое» выпадение бонус i теряет ADAPT_STEP%,
 * а этот процент распределяется на остальные (+ADAPT_STEP% суммарно).
 * «Обычный» бонус понижается слабо — он база.
 */
export function currentWeights(streak: StreakMap): Record<BonusId, number> {
  const weights: Record<BonusId, number> = {
    strong_neg: BONUSES.strong_neg.baseWeight,
    weak_neg: 0,
    normal: BONUSES.normal.baseWeight,
    big: BONUSES.big.baseWeight,
    super: BONUSES.super.baseWeight,
    jackpot: BONUSES.jackpot.baseWeight,
  };

  // Понижаем «перегретые» бонусы и повышаем остальные.
  for (const id of BONUS_ORDER) {
    const times = streak[id];
    if (times <= 0) continue;
    const downFactor = id === "normal" ? 0.25 : 1;
    const totalDown = times * ADAPT_STEP * downFactor;
    weights[id] = Math.max(1, weights[id] - totalDown);
    const others = BONUS_ORDER.filter((o) => o !== id);
    const bump = totalDown / others.length;
    for (const o of others) weights[o] += bump;
  }

  return weights;
}

/** Выбираем бонус по адаптивным весам. */
export function pickBonus(streak: StreakMap): BonusId {
  const weights = currentWeights(streak);
  const total = BONUS_ORDER.reduce((s, id) => s + weights[id], 0);
  let roll = Math.random() * total;
  for (const id of BONUS_ORDER) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return "normal";
}

/**
 * Обновляем счётчик частоты после выпадения бонуса `won`:
 *  - у выпавшего +1 (он «нагрелся»),
 *  - у остальных немного «остывает» (−1, но не ниже 0),
 * чтобы система постепенно возвращалась к базовым шансам.
 */
export function updateStreak(streak: StreakMap, won: BonusId): StreakMap {
  const next = { ...streak };
  for (const id of BONUS_ORDER) {
    if (id === won) next[id] = Math.min(24, next[id] + 1);
    else next[id] = Math.max(0, next[id] - 1);
  }
  return next;
}

/**
 * Считаем итог спина.
 * @param betAmount сумма спина (0 = фри-спин)
 * @returns delta — изменение баланса (может быть отрицательным)
 */
export function computeSpinResult(bonusId: BonusId, betAmount: number): {
  delta: number;
  netWin: number; // чистый выигрыш/проигрыш относительно ставки
} {
  const def = BONUSES[bonusId] || BONUSES.normal;

  // Фри-спин (пункт 8): за обычный бонус дается 50, остальные также щедро увеличены.
  if (betAmount <= 0) {
    const freeMap: Record<BonusId, number> = {
      strong_neg: 0,
      weak_neg: 0,
      normal: 50,   // ровно 50 за обычный бонус по требованию
      big: 100,
      super: 250,
      jackpot: 600,
    };
    const won = freeMap[bonusId] ?? 50;
    return { delta: won, netWin: won };
  }

  if (def.isNegative) {
    // Теряем всю или часть ставки.
    const loss = Math.round(betAmount * Math.abs(def.multiplier));
    return { delta: -loss, netWin: -loss };
  }

  // Положительный бонус: возвращаем ставку * multiplier.
  const payout = Math.round(betAmount * def.multiplier);
  return { delta: payout - betAmount, netWin: payout - betAmount };
}

// ----- Геометрия колеса -----
// Углы секторов пропорциональны базовым шансам.

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

/** CSS conic-gradient для колеса на основе секторов. */
export function wheelGradient(sectors: WheelSector[]): string {
  const parts = sectors.map((s) => `${s.def.color} ${s.startDeg}deg ${s.endDeg}deg`);
  return `conic-gradient(${parts.join(", ")})`;
}
