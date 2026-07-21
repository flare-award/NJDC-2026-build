export type DoubleBonusId =
  | "neg_jackpot"
  | "neg_weak"
  | "normal"
  | "big"
  | "super"
  | "jackpot"
  | "ultra_reverse"
  | "mega_bonus";

export interface DoubleBonusDef {
  id: DoubleBonusId;
  order: number;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  emoji: string;
  multiplier: number;
  description: string;
}

export const DOUBLE_BONUSES: Record<DoubleBonusId, DoubleBonusDef> = {
  neg_jackpot: {
    id: "neg_jackpot",
    order: 1,
    label: "💀 Мега-Реверс",
    shortLabel: "💀 x5.0",
    color: "#450a0a",
    textColor: "#fca5a5",
    emoji: "💀",
    multiplier: 5.0,
    description: "Бывшая крупная потеря стала Реверс-Джекпотом (x5.0)! Куш максимален.",
  },
  neg_weak: {
    id: "neg_weak",
    order: 2,
    label: "🟤 Слабый Реверс",
    shortLabel: "🟤 x1.5",
    color: "#5b3a1a",
    textColor: "#e0b98c",
    emoji: "🟤",
    multiplier: 1.5,
    description: "Бывшая слабая потеря теперь даёт прибыль! Множитель x1.5 (+50%).",
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
    description: "Обычный бонус: возвращает ставку с множителем x1.25 (+25%).",
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
    description: "Большой бонус: множитель x1.8 к вашей ставке (+80%).",
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
    description: "Супер-бонус: множитель x2.5 к вашей ставке (+150%).",
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
    description: "Классический ДЖЕКПОТ: множитель x5.0 к вашей ставке (+400%).",
  },
  ultra_reverse: {
    id: "ultra_reverse",
    order: 7,
    label: "❌ Ультра-Реверс",
    shortLabel: "❌ x5.0",
    color: "#7f1d1d",
    textColor: "#fecaca",
    emoji: "❌",
    multiplier: 5.0,
    description: "Бывшая неудача сработала как Ультра-Реверс! Множитель x5.0 к вашей ставке.",
  },
  mega_bonus: {
    id: "mega_bonus",
    order: 8,
    label: "💎 Мега-Бонус",
    shortLabel: "💎 x3.5",
    color: "#0284c7",
    textColor: "#ffffff",
    emoji: "💎",
    multiplier: 3.5,
    description: "Редкий Мега-Бонус: множитель x3.5 к вашей ставке (+250%).",
  },
};

export const DOUBLE_BONUS_ORDER: DoubleBonusId[] = [
  "neg_jackpot",
  "normal",
  "big",
  "neg_weak",
  "super",
  "jackpot",
  "ultra_reverse",
  "mega_bonus",
];

export interface DoubleWheelSector {
  id: DoubleBonusId;
  startDeg: number;
  endDeg: number;
  midDeg: number;
  sizeDeg: number;
  def: DoubleBonusDef;
}

export function buildDoubleWheelSectors(): DoubleWheelSector[] {
  const sectors: DoubleWheelSector[] = [];
  const size = 360 / DOUBLE_BONUS_ORDER.length;
  let cursor = 0;
  for (const id of DOUBLE_BONUS_ORDER) {
    const def = DOUBLE_BONUSES[id];
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

export function doubleWheelGradient(sectors: DoubleWheelSector[]): string {
  if (!sectors.length) return "conic-gradient(#27272a 0deg 360deg)";
  const parts = sectors.map((s) => `${s.def.color} ${s.startDeg}deg ${s.endDeg}deg`);
  return `conic-gradient(${parts.join(", ")})`;
}

export function pickRandomDoubleBonus(): DoubleBonusId {
  const idx = Math.floor(Math.random() * DOUBLE_BONUS_ORDER.length);
  return DOUBLE_BONUS_ORDER[idx];
}

export interface DoublePlayerInput {
  userId: string;
  nickname: string;
  betAmount: number;
  selectedBonusId: DoubleBonusId | null;
}

export interface DoublePlayerResult {
  userId: string;
  nickname: string;
  betAmount: number;
  selectedBonusId: DoubleBonusId | null;
  guessedCorrectly: boolean;
  profitFromBonus: number;
  shareFromLostBets: number;
  payout: number;
  netGain: number;
}

export function computeDoubleRouletteResults(
  players: DoublePlayerInput[],
  winningBonusId: DoubleBonusId
): {
  winningBonus: DoubleBonusDef;
  totalPool: number;
  results: DoublePlayerResult[];
  allGuessed: boolean;
  noneGuessed: boolean;
} {
  const winningBonus = DOUBLE_BONUSES[winningBonusId] || DOUBLE_BONUSES.normal;
  const totalPool = players.reduce((sum, p) => sum + Math.max(0, p.betAmount), 0);

  const winners = players.filter((p) => p.selectedBonusId === winningBonusId);
  const allGuessed = players.length > 0 && winners.length === players.length;
  const noneGuessed = winners.length === 0;

  const results: DoublePlayerResult[] = [];

  if (allGuessed) {
    for (const p of players) {
      const payout = Math.round(p.betAmount * 1.1);
      results.push({
        userId: p.userId,
        nickname: p.nickname,
        betAmount: p.betAmount,
        selectedBonusId: p.selectedBonusId,
        guessedCorrectly: true,
        profitFromBonus: Math.round(p.betAmount * 0.1),
        shareFromLostBets: 0,
        payout,
        netGain: payout - p.betAmount,
      });
    }
  } else if (noneGuessed) {
    for (const p of players) {
      results.push({
        userId: p.userId,
        nickname: p.nickname,
        betAmount: p.betAmount,
        selectedBonusId: p.selectedBonusId,
        guessedCorrectly: false,
        profitFromBonus: 0,
        shareFromLostBets: 0,
        payout: 0,
        netGain: -p.betAmount,
      });
    }
  } else {
    const losersPool = players
      .filter((p) => p.selectedBonusId !== winningBonusId)
      .reduce((s, p) => s + p.betAmount, 0);

    const sharePerWinner = Math.round(losersPool / winners.length);

    for (const p of players) {
      const isWinner = p.selectedBonusId === winningBonusId;
      if (isWinner) {
        const profitFromBonus = Math.round(p.betAmount * Math.max(0, winningBonus.multiplier - 1));
        const payout = p.betAmount + sharePerWinner + profitFromBonus;
        results.push({
          userId: p.userId,
          nickname: p.nickname,
          betAmount: p.betAmount,
          selectedBonusId: p.selectedBonusId,
          guessedCorrectly: true,
          profitFromBonus,
          shareFromLostBets: sharePerWinner,
          payout,
          netGain: payout - p.betAmount,
        });
      } else {
        results.push({
          userId: p.userId,
          nickname: p.nickname,
          betAmount: p.betAmount,
          selectedBonusId: p.selectedBonusId,
          guessedCorrectly: false,
          profitFromBonus: 0,
          shareFromLostBets: 0,
          payout: 0,
          netGain: -p.betAmount,
        });
      }
    }
  }

  return {
    winningBonus,
    totalPool,
    results,
    allGuessed,
    noneGuessed,
  };
}
