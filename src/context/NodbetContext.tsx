import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useData } from "./DataContext";
import { useUserAuth } from "./UserAuthContext";
import { computeOdds } from "../utils/odds";

export interface NodbetPerk {
  id: "vip_boost_x3" | "insurance" | "radar" | "double_win" | "gold_badge";
  name: string;
  description: string;
  cost: number;
  icon: string;
  badge: string;
}

export const NODBET_PERKS: NodbetPerk[] = [
  {
    id: "vip_boost_x3",
    name: "👑 VIP-Бустер Прогноза (x3 вес)",
    description: "Ваш голос в зрительских прогнозах на матчи считается за 3, увеличивает влияние на коэффициенты и дает +15% к выигрышу в ставках!",
    cost: 3000,
    icon: "👑",
    badge: "VIP x3 BOOST",
  },
  {
    id: "insurance",
    name: "🛡️ Страховка ставки (1 шт.)",
    description: "В случае проигрыша вашей команды в матче 100% суммы ставки полностью вернется на ваш баланс NOD-Коинов.",
    cost: 2000,
    icon: "🛡️",
    badge: "СТРАХОВКА 100%",
  },
  {
    id: "radar",
    name: "⚡ Инсайдерский AI-Радар NODBET",
    description: "Открывает доступ к секретной аналитике матчей, вероятностям клатчей и экспертным прогнозам на страницах матчей NJDC 2026.",
    cost: 1500,
    icon: "⚡",
    badge: "AI РАДАР",
  },
  {
    id: "double_win",
    name: "🔥 Бустер x2 Выигрыша (1 шт.)",
    description: "Применяется к ставке: если она выигрывает, ваш чистый профит утраивается (x2 буст коэффициента)!",
    cost: 2500,
    icon: "🔥",
    badge: "x2 БУСТЕР",
  },
  {
    id: "gold_badge",
    name: "✨ Статус «NODBET Pro» & Золотой знак",
    description: "Эксклюзивная золотая рамка и свечение вашего никнейма в таблице лидеров, прогнозах и зале славы хайроллеров.",
    cost: 5000,
    icon: "✨",
    badge: "NODBET PRO 👑",
  },
];

export interface NodbetBet {
  id: string;
  matchId: string;
  matchTitle: string;
  teamChoice: string; // team id
  teamName: string;
  amount: number;
  odds: number;
  status: "pending" | "won" | "lost" | "refunded";
  createdAt: string;
  usedInsurance: boolean;
  usedDoubleWin: boolean;
  payout: number;
}

export interface RouletteSpin {
  id: string;
  label: string;
  color: "red" | "green" | "gold" | "black" | "purple";
  multiplier: number;
  bonusText?: string;
  wonCoins: number;
  createdAt: string;
}

export interface HighRoller {
  id: string;
  nickname: string;
  balance: number;
  totalWon: number;
  betsCount: number;
  isCurrentUser?: boolean;
  badge?: string;
}

interface NodbetInventory {
  vipBoostX3: boolean;
  insuranceCount: number;
  doubleWinCount: number;
  radarUnlocked: boolean;
  goldBadge: boolean;
}

export interface NodbetContextValue {
  balance: number;
  xp: number;
  levelTitle: string;
  dailyBonusAvailable: boolean;
  inventory: NodbetInventory;
  bets: NodbetBet[];
  rouletteHistory: RouletteSpin[];
  highRollers: HighRoller[];
  // Actions
  placeBet: (matchId: string, teamChoice: string, teamName: string, amount: number, useInsurance?: boolean, useDoubleWin?: boolean) => { ok: boolean; error?: string };
  spinRoulette: (betAmount: number) => { ok: boolean; result: RouletteSpin; error?: string };
  buyPerk: (perkId: NodbetPerk["id"]) => { ok: boolean; error?: string };
  claimDailyBonus: () => { ok: boolean; error?: string };
  fastResolveBetDemo: (betId: string) => void;
  // Helpers
  hasVipBoost: boolean;
  hasRadar: boolean;
  hasGoldBadge: boolean;
}

const LOCAL_STORAGE_PREFIX = "njdc_nodbet_state_v2_";

function getInitialState(userId: string) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        balance: typeof parsed.balance === "number" ? parsed.balance : 10000,
        xp: typeof parsed.xp === "number" ? parsed.xp : 500,
        lastDailyClaim: parsed.lastDailyClaim || null,
        inventory: {
          vipBoostX3: !!parsed.inventory?.vipBoostX3,
          insuranceCount: parsed.inventory?.insuranceCount ?? 1,
          doubleWinCount: parsed.inventory?.doubleWinCount ?? 1,
          radarUnlocked: !!parsed.inventory?.radarUnlocked,
          goldBadge: !!parsed.inventory?.goldBadge,
        },
        bets: Array.isArray(parsed.bets) ? (parsed.bets as NodbetBet[]) : [],
        rouletteHistory: Array.isArray(parsed.rouletteHistory) ? (parsed.rouletteHistory as RouletteSpin[]) : [
          { id: "s1", label: "🔴 Красно (x2)", color: "red" as const, multiplier: 2, wonCoins: 2000, createdAt: new Date(Date.now() - 3600000).toISOString() },
          { id: "s2", label: "⚫ Черно (x1.5)", color: "black" as const, multiplier: 1.5, wonCoins: 750, createdAt: new Date(Date.now() - 7200000).toISOString() },
          { id: "s3", label: "🟢 ДЖЕКПОТ (x5)", color: "green" as const, multiplier: 5, wonCoins: 5000, bonusText: "+5,000 NOD", createdAt: new Date(Date.now() - 14400000).toISOString() },
        ],
      };
    }
  } catch {
    /* ignore */
  }

  return {
    balance: 10000, // Starter bonus for NJDC 2026 fans
    xp: 500,
    lastDailyClaim: null as string | null,
    inventory: {
      vipBoostX3: false,
      insuranceCount: 1, // Free starter insurance!
      doubleWinCount: 1, // Free starter booster!
      radarUnlocked: false,
      goldBadge: false,
    },
    bets: [] as NodbetBet[],
    rouletteHistory: [
      { id: "s1", label: "🔴 Красно (x2)", color: "red" as const, multiplier: 2, wonCoins: 2000, createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: "s2", label: "⚫ Черно (x1.5)", color: "black" as const, multiplier: 1.5, wonCoins: 750, createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: "s3", label: "🟢 ДЖЕКПОТ (x5)", color: "green" as const, multiplier: 5, wonCoins: 5000, bonusText: "+5,000 NOD", createdAt: new Date(Date.now() - 14400000).toISOString() },
    ] as RouletteSpin[],
  };
}

const NodbetContext = createContext<NodbetContextValue | null>(null);

export function NodbetProvider({ children }: { children: ReactNode }) {
  const { user } = useUserAuth();
  const { matches } = useData();
  const userId = user ? user.id : "guest_high_roller";

  const [state, setState] = useState(() => getInitialState(userId));

  // Switch state when user logs in/out
  useEffect(() => {
    setState(getInitialState(userId));
  }, [userId]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(state));
  }, [state, userId]);

  // Check and auto-settle finished matches
  useEffect(() => {
    setState((prev) => {
      let changed = false;
      let addedBalance = 0;
      let addedXp = 0;

      const nextBets = prev.bets.map((bet: NodbetBet) => {
        if (bet.status !== "pending") return bet;
        const match = matches.find((m) => m.id === bet.matchId);
        if (!match || match.status !== "finished") return bet;

        changed = true;
        const winnerTeamId = match.score_a > match.score_b ? match.team_a : match.score_b > match.score_a ? match.team_b : "draw";

        if (bet.teamChoice === winnerTeamId) {
          // Won!
          let payout = Math.round(bet.amount * bet.odds);
          if (bet.usedDoubleWin) {
            payout = bet.amount + Math.round((bet.amount * bet.odds - bet.amount) * 2);
          }
          if (prev.inventory.vipBoostX3) {
            payout = Math.round(payout * 1.15); // +15% for VIP
          }
          addedBalance += payout;
          addedXp += 300;
          return { ...bet, status: "won" as const, payout };
        } else if (winnerTeamId === "draw") {
          // Refund on draw
          addedBalance += bet.amount;
          return { ...bet, status: "refunded" as const, payout: bet.amount };
        } else {
          // Lost
          if (bet.usedInsurance) {
            addedBalance += bet.amount;
            addedXp += 50;
            return { ...bet, status: "refunded" as const, payout: bet.amount };
          } else {
            addedXp += 100;
            return { ...bet, status: "lost" as const, payout: 0 };
          }
        }
      });

      if (!changed) return prev;
      return {
        ...prev,
        balance: prev.balance + addedBalance,
        xp: prev.xp + addedXp,
        bets: nextBets,
      };
    });
  }, [matches]);

  const dailyBonusAvailable = useMemo(() => {
    if (!state.lastDailyClaim) return true;
    const last = new Date(state.lastDailyClaim).getTime();
    const now = Date.now();
    return now - last > 24 * 60 * 60 * 1000;
  }, [state.lastDailyClaim]);

  const levelTitle = useMemo(() => {
    const { xp, balance } = state;
    if (xp > 5000 || balance > 50000 || state.inventory.goldBadge) return "👑 Кибер-Хайроллер NODBET";
    if (xp > 2500 || balance > 25000) return "🔥 Мастер Прогнозов";
    if (xp > 1200 || balance > 15000) return "⚡ Азартный Фрагер";
    return "🎯 Новичок NODBET";
  }, [state.xp, state.balance, state.inventory.goldBadge]);

  const claimDailyBonus = useCallback(() => {
    if (!dailyBonusAvailable) {
      return { ok: false, error: "Ежедневный бонус уже получен сегодня! Возвращайтесь завтра." };
    }
    setState((prev) => ({
      ...prev,
      balance: prev.balance + 2500,
      xp: prev.xp + 200,
      lastDailyClaim: new Date().toISOString(),
    }));
    return { ok: true };
  }, [dailyBonusAvailable]);

  const placeBet = useCallback(
    (matchId: string, teamChoice: string, teamName: string, amount: number, useInsurance = false, useDoubleWin = false) => {
      if (amount <= 0 || isNaN(amount)) {
        return { ok: false, error: "Введите корректную сумму ставки" };
      }
      if (amount > state.balance) {
        return { ok: false, error: "Недостаточно NOD-Коинов на балансе!" };
      }
      if (useInsurance && state.inventory.insuranceCount <= 0) {
        return { ok: false, error: "У вас нет активных страховок!" };
      }
      if (useDoubleWin && state.inventory.doubleWinCount <= 0) {
        return { ok: false, error: "У вас нет активных бустеров x2!" };
      }

      const match = matches.find((m) => m.id === matchId);
      if (!match) return { ok: false, error: "Матч не найден" };
      if (match.status === "finished") return { ok: false, error: "Матч уже завершен!" };

      // Calculate odds dynamically
      const oddsRes = computeOdds(10, 10); // fallback or get actual match odds
      let chosenOdds = 1.95;
      if (teamChoice === match.team_a) chosenOdds = oddsRes.oddsA || 1.91;
      if (teamChoice === match.team_b) chosenOdds = oddsRes.oddsB || 1.91;
      // Add dynamic variation based on match number
      chosenOdds = Math.round((chosenOdds + (match.match_number % 3) * 0.12) * 100) / 100;

      const newBet: NodbetBet = {
        id: "bet_" + crypto.randomUUID().slice(0, 8),
        matchId,
        matchTitle: match.title,
        teamChoice,
        teamName,
        amount,
        odds: chosenOdds,
        status: "pending",
        createdAt: new Date().toISOString(),
        usedInsurance: useInsurance,
        usedDoubleWin: useDoubleWin,
        payout: 0,
      };

      setState((prev) => ({
        ...prev,
        balance: prev.balance - amount,
        xp: prev.xp + Math.round(amount / 50),
        inventory: {
          ...prev.inventory,
          insuranceCount: useInsurance ? Math.max(0, prev.inventory.insuranceCount - 1) : prev.inventory.insuranceCount,
          doubleWinCount: useDoubleWin ? Math.max(0, prev.inventory.doubleWinCount - 1) : prev.inventory.doubleWinCount,
        },
        bets: [newBet, ...prev.bets],
      }));

      return { ok: true };
    },
    [state.balance, state.inventory, matches]
  );

  const fastResolveBetDemo = useCallback((betId: string) => {
    setState((prev) => {
      const bet = prev.bets.find((b: NodbetBet) => b.id === betId);
      if (!bet || bet.status !== "pending") return prev;

      // For simulated/demo thrill: 65% chance to win, 35% chance to trigger insurance or loss
      const isWin = Math.random() < 0.65;
      let payout = 0;
      let nextStatus: NodbetBet["status"] = "lost";
      let balanceChange = 0;
      let xpChange = 100;

      if (isWin) {
        payout = Math.round(bet.amount * bet.odds);
        if (bet.usedDoubleWin) {
          payout = bet.amount + Math.round((bet.amount * bet.odds - bet.amount) * 2);
        }
        if (prev.inventory.vipBoostX3) {
          payout = Math.round(payout * 1.15);
        }
        balanceChange = payout;
        xpChange = 350;
        nextStatus = "won";
      } else {
        if (bet.usedInsurance) {
          payout = bet.amount;
          balanceChange = bet.amount;
          nextStatus = "refunded";
          xpChange = 80;
        } else {
          payout = 0;
          balanceChange = 0;
          nextStatus = "lost";
        }
      }

      const updatedBets = prev.bets.map((b: NodbetBet) => (b.id === betId ? { ...b, status: nextStatus, payout } : b));
      return {
        ...prev,
        balance: prev.balance + balanceChange,
        xp: prev.xp + xpChange,
        bets: updatedBets,
      };
    });
  }, []);

  const spinRoulette = useCallback(
    (betAmount: number) => {
      if (betAmount < 0 || isNaN(betAmount)) {
        return { ok: false, result: {} as RouletteSpin, error: "Неверная сумма ставки" };
      }
      if (betAmount > state.balance) {
        return { ok: false, result: {} as RouletteSpin, error: "Недостаточно NOD-Коинов для этого спина!" };
      }

      // Wheel sectors probability
      const roll = Math.random();
      let sector: { color: RouletteSpin["color"]; label: string; multiplier: number; bonus?: string };

      if (roll < 0.08) {
        sector = { color: "green", label: "🟢 ДЖЕКПОТ (x5)", multiplier: 5, bonus: "Мега-куш NODBET!" };
      } else if (roll < 0.18) {
        sector = { color: "gold", label: "🟡 ЗОЛОТОЙ КЛАТЧ (+Страховка)", multiplier: 2.5, bonus: "+1 Страховка ставки!" };
      } else if (roll < 0.33) {
        sector = { color: "purple", label: "🟣 1DONY БОНУС (x3)", multiplier: 3, bonus: "+1 Бустер x2!" };
      } else if (roll < 0.65) {
        sector = { color: "red", label: "🔴 КРАСНОЕ (x2)", multiplier: 2 };
      } else {
        sector = { color: "black", label: "⚫ ЧЕРНОЕ (x1.5)", multiplier: 1.5 };
      }

      const wonCoins = betAmount === 0 ? (sector.color === "green" ? 3000 : 1000) : Math.round(betAmount * sector.multiplier);

      const newSpin: RouletteSpin = {
        id: "spin_" + crypto.randomUUID().slice(0, 8),
        label: sector.label,
        color: sector.color,
        multiplier: sector.multiplier,
        bonusText: sector.bonus,
        wonCoins,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => {
        const nextBalance = prev.balance - betAmount + wonCoins;
        const nextInsurance = sector.bonus?.includes("Страховка") ? prev.inventory.insuranceCount + 1 : prev.inventory.insuranceCount;
        const nextDouble = sector.bonus?.includes("Бустер") ? prev.inventory.doubleWinCount + 1 : prev.inventory.doubleWinCount;

        return {
          ...prev,
          balance: nextBalance,
          xp: prev.xp + 150,
          inventory: {
            ...prev.inventory,
            insuranceCount: nextInsurance,
            doubleWinCount: nextDouble,
          },
          rouletteHistory: [newSpin, ...prev.rouletteHistory.slice(0, 24)],
        };
      });

      return { ok: true, result: newSpin };
    },
    [state.balance]
  );

  const buyPerk = useCallback(
    (perkId: NodbetPerk["id"]) => {
      const perk = NODBET_PERKS.find((p) => p.id === perkId);
      if (!perk) return { ok: false, error: "Привилегия не найдена" };
      if (state.balance < perk.cost) {
        return { ok: false, error: `Недостаточно монет! Требуется ${perk.cost.toLocaleString()} NOD.` };
      }

      if (perkId === "vip_boost_x3" && state.inventory.vipBoostX3) {
        return { ok: false, error: "У вас уже активирован VIP-Бустер Прогноза x3!" };
      }
      if (perkId === "radar" && state.inventory.radarUnlocked) {
        return { ok: false, error: "Инсайдерский AI-Радар уже разблокирован навсегда!" };
      }
      if (perkId === "gold_badge" && state.inventory.goldBadge) {
        return { ok: false, error: "У вас уже есть статус «NODBET Pro» и золотой знак!" };
      }

      setState((prev) => ({
        ...prev,
        balance: prev.balance - perk.cost,
        xp: prev.xp + 400,
        inventory: {
          ...prev.inventory,
          vipBoostX3: perkId === "vip_boost_x3" ? true : prev.inventory.vipBoostX3,
          insuranceCount: perkId === "insurance" ? prev.inventory.insuranceCount + 1 : prev.inventory.insuranceCount,
          doubleWinCount: perkId === "double_win" ? prev.inventory.doubleWinCount + 1 : prev.inventory.doubleWinCount,
          radarUnlocked: perkId === "radar" ? true : prev.inventory.radarUnlocked,
          goldBadge: perkId === "gold_badge" ? true : prev.inventory.goldBadge,
        },
      }));

      return { ok: true };
    },
    [state.balance, state.inventory]
  );

  const highRollers = useMemo<HighRoller[]>(() => {
    const list: HighRoller[] = [
      { id: "hr_1", nickname: "rezo1n (Captain)", balance: 84500, totalWon: 210000, betsCount: 42, badge: "✨ NODBET PRO" },
      { id: "hr_2", nickname: "dony_zq", balance: 67200, totalWon: 185000, betsCount: 38, badge: "👑 VIP x3" },
      { id: "hr_3", nickname: "CyberClutch_99", balance: 52100, totalWon: 140000, betsCount: 29, badge: "👑 VIP x3" },
      { id: "hr_4", nickname: "Stalk_Aimer", balance: 41800, totalWon: 98000, betsCount: 21 },
      { id: "hr_5", nickname: "ShokeFan_2026", balance: 36400, totalWon: 85000, betsCount: 19 },
      { id: "hr_6", nickname: "awp_god_rush", balance: 29500, totalWon: 64000, betsCount: 15 },
    ];

    const currentNick = user?.email?.split("@")[0] || "Вы (Хайроллер)";
    const myItem: HighRoller = {
      id: "current_user_hr",
      nickname: currentNick,
      balance: state.balance,
      totalWon: state.bets.filter((b: NodbetBet) => b.status === "won").reduce((acc: number, b: NodbetBet) => acc + b.payout, 0) + state.balance,
      betsCount: state.bets.length + state.rouletteHistory.length,
      isCurrentUser: true,
      badge: state.inventory.goldBadge ? "✨ NODBET PRO" : state.inventory.vipBoostX3 ? "👑 VIP x3" : undefined,
    };

    const combined = [...list, myItem].sort((a, b) => b.balance - a.balance);
    return combined;
  }, [user, state.balance, state.bets, state.rouletteHistory, state.inventory]);

  const value = useMemo<NodbetContextValue>(
    () => ({
      balance: state.balance,
      xp: state.xp,
      levelTitle,
      dailyBonusAvailable,
      inventory: state.inventory,
      bets: state.bets,
      rouletteHistory: state.rouletteHistory,
      highRollers,
      placeBet,
      spinRoulette,
      buyPerk,
      claimDailyBonus,
      fastResolveBetDemo,
      hasVipBoost: state.inventory.vipBoostX3,
      hasRadar: state.inventory.radarUnlocked,
      hasGoldBadge: state.inventory.goldBadge,
    }),
    [
      state.balance,
      state.xp,
      levelTitle,
      dailyBonusAvailable,
      state.inventory,
      state.bets,
      state.rouletteHistory,
      highRollers,
      placeBet,
      spinRoulette,
      buyPerk,
      claimDailyBonus,
      fastResolveBetDemo,
    ]
  );

  return <NodbetContext.Provider value={value}>{children}</NodbetContext.Provider>;
}

export function useNodbet() {
  const ctx = useContext(NodbetContext);
  if (!ctx) throw new Error("useNodbet must be used within NodbetProvider");
  return ctx;
}
