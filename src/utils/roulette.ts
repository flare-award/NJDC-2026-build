// ============================================================
// Клатч-Рулетка NODBET — честная система бонусов (пункты 1, 8, 20)
//
// 6 бонусов, строго от худшего к лучшему:
//   1. strong_neg  — сильно отрицательный (зависит от суммы спина)
//   2. weak_neg    — слабо отрицательный
//   3. normal      — обычный
//   4. big         — большой
//   5. super       — супер-бонус
//   6. jackpot     — джекпот (самый редкий, зависит от суммы спина)
//
// Все бонусы зависят от суммы спина: чем выше ставка — тем больше
// и выигрыш, и потеря.
//
// Шансы адаптивные: если какой-то бонус выпадает слишком часто, шансы
// на остальные постепенно повышаются на 0.25%, а сам «частый» бонус
// понижается. «Обычный» бонус понижается слабо (он и должен быть базой).
//
// Колесо синхронизировано с бонусами: порядок секторов на колесе, их
// углы и цвета соответствуют выпавшему бонусу (пункт 8).
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
  /** Множитель к сумме спина. Отрицательные = потеря части ставки. */
  multiplier: number;
  isNegative: boolean;
  baseWeight: number; // базовый шанс, %
  description: string;
}

// Базовые определения бонусов (порядок = как на колесе и в таблице).
export const BONUSES: Record<BonusId, BonusDef> = {
  strong_neg: {
    id: "strong_neg",
    order: 1,
    label: "💀 Крупная потеря",
    shortLabel: "💀 −",
    color: "#450a0a",
    textColor: "#fca5a5",
    emoji: "💀",
    multiplier: -1.0, // теряет всю ставку (зависит от суммы спина)
    isNegative: true,
    baseWeight: 13,
    description: "Сильно отрицательный: теряете всю ставку. Чем выше ставка — тем больнее.",
  },
  weak_neg: {
    id: "weak_neg",
    order: 2,
    label: "🟤 Небольшая потеря",
    shortLabel: "🟤 −",
    color: "#3f2d1a",
    textColor: "#d6b98c",
    emoji: "🟤",
    multiplier: -0.5, // теряет половину ставки
    isNegative: true,
    baseWeight: 27,
    description: "Слабо отрицательный: теряете ~50% ставки.",
  },
  normal: {
    id: "normal",
    order: 3,
    label: "⚫ Обычный бонус",
    shortLabel: "⚫ x1.1",
    color: "#27272a",
    textColor: "#e4e4e7",
    emoji: "⚫",
    multiplier: 1.1, // едва выше ставки
    isNegative: false,
    baseWeight: 30,
    description: "Обычный бонус: возвращает ставку с небольшим плюсом (x1.1).",
  },
  big: {
    id: "big",
    order: 4,
    label: "🔴 Большой бонус",
    shortLabel: "🔴 x1.5",
    color: "#b91c1c",
    textColor: "#ffffff",
    emoji: "🔴",
    multiplier: 1.5,
    isNegative: false,
    baseWeight: 17,
    description: "Большой бонус: множитель x1.5 к ставке.",
  },
  super: {
    id: "super",
    order: 5,
    label: "🟣 Супер-бонус",
    shortLabel: "🟣 x2.2",
    color: "#7e22ce",
    textColor: "#ffffff",
    emoji: "🟣",
    multiplier: 2.2,
    isNegative: false,
    baseWeight: 9,
    description: "Супер-бонус: множитель x2.2 к ставке.",
  },
  jackpot: {
    id: "jackpot",
    order: 6,
    label: "🟢 ДЖЕКПОТ",
    shortLabel: "🟢 x4.5",
    color: "#16a34a",
    textColor: "#ffffff",
    emoji: "🟢",
    multiplier: 4.5, // самый крупный, зависит от суммы спина
    isNegative: false,
    baseWeight: 4,
    description: "Джекпот (самое редкое): множитель x4.5 к ставке. Чем выше ставка — тем больше куш.",
  },
};

/** Порядок бонусов от худшего к лучшему — для колеса и таблицы выплат. */
export const BONUS_ORDER: BonusId[] = ["strong_neg", "weak_neg", "normal", "big", "super", "jackpot"];

/**
 * Счётчик «недавних выпадений» для адаптивных шансов.
 * Храним, сколько раз подряд/часто выпадал каждый бонус.
 */
export type StreakMap = Record<BonusId, number>;

export function emptyStreak(): StreakMap {
  return { strong_neg: 0, weak_neg: 0, normal: 0, big: 0, super: 0, jackpot: 0 };
}

const ADAPT_STEP = 0.25; // шаг изменения шанса, % (пункт 1)

/**
 * Считаем текущие веса с учётом «частоты» выпадений.
 * За каждое накопленное «частое» выпадение бонус i теряет ADAPT_STEP%,
 * а этот процент распределяется на остальные (+ADAPT_STEP% суммарно).
 * «Обычный» бонус понижается слабо (в 4 раза медленнее) — он база.
 */
export function currentWeights(streak: StreakMap): Record<BonusId, number> {
  const weights: Record<BonusId, number> = {
    strong_neg: BONUSES.strong_neg.baseWeight,
    weak_neg: BONUSES.weak_neg.baseWeight,
    normal: BONUSES.normal.baseWeight,
    big: BONUSES.big.baseWeight,
    super: BONUSES.super.baseWeight,
    jackpot: BONUSES.jackpot.baseWeight,
  };

  // Понижаем «перегретые» бонусы и повышаем остальные.
  for (const id of BONUS_ORDER) {
    const times = streak[id];
    if (times <= 0) continue;
    // «Обычный» бонус понижается слабо (пункт 1).
    const downFactor = id === "normal" ? 0.25 : 1;
    const totalDown = times * ADAPT_STEP * downFactor;
    weights[id] = Math.max(1, weights[id] - totalDown);
    // Повышаем остальные равномерно.
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
  const def = BONUSES[bonusId];

  // Фри-спин (пункт 20): всегда меньше 15 коинов и никогда не уходит в минус.
  if (betAmount <= 0) {
    if (def.isNegative) {
      // На фри-спине «отрицательный» просто даёт минимум (терять нечего).
      return { delta: 1, netWin: 1 };
    }
    // Максимум 14 коинов, тем меньше — чем слабее бонус.
    const freeMap: Record<BonusId, number> = {
      strong_neg: 1,
      weak_neg: 2,
      normal: 5,
      big: 8,
      super: 11,
      jackpot: 14,
    };
    const won = freeMap[bonusId];
    return { delta: won, netWin: won };
  }

  if (def.isNegative) {
    // Теряем часть ставки. multiplier отрицательный.
    const loss = Math.round(betAmount * Math.abs(def.multiplier));
    return { delta: -loss, netWin: -loss };
  }

  // Положительный бонус: возвращаем ставку * multiplier.
  const payout = Math.round(betAmount * def.multiplier);
  return { delta: payout - betAmount, netWin: payout - betAmount };
}

// ----- Геометрия колеса (синхронизация с бонусами, пункт 8) -----
// Углы секторов пропорциональны базовым шансам, чтобы редкий джекпот
// занимал мало места, а частые бонусы — больше (пункт 8).

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
