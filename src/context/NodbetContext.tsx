import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useData } from "./DataContext";
import { useUserAuth } from "./UserAuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { fruitNickname, validateNickname } from "../utils/nickname";
import { levelFromXp, levelProgress, levelTitleFor, type LevelProgress } from "../utils/levels";
import {
  BONUSES,
  computeSpinResult,
  emptyStreak,
  pickBonus,
  updateStreak,
  type BonusId,
  type RouletteMode,
  type StreakMap,
} from "../utils/roulette";
import { normalizeMaps, mapWinner, mapFinished, mapHadOvertime, relevantMapCount } from "../utils/matchMaps";

// ============================================================
// Привилегии магазина
// ============================================================
export type NodbetPerkId =
  | "radar"
  | "custom_status"
  | "hall_frame"
  | "coin_magnet"
  | "crown_badge"
  | "star_trail"
  | "aura"
  | "multi_bet";

export interface NodbetPerk {
  id: NodbetPerkId;
  name: string;
  description: string;
  cost: number;
  icon: string;
  badge: string;
  oneTime: boolean;
}

export const AURA_COLORS = [
  { id: "red", label: "Красный", color: "#ef4444", glow: "rgba(239,68,68,0.6)" },
  { id: "orange", label: "Оранжевый", color: "#f97316", glow: "rgba(249,115,22,0.6)" },
  { id: "yellow", label: "Жёлтый", color: "#eab308", glow: "rgba(234,179,8,0.6)" },
  { id: "green", label: "Зелёный", color: "#22c55e", glow: "rgba(34,197,94,0.6)" },
  { id: "cyan", label: "Бирюзовый", color: "#06b6d4", glow: "rgba(6,182,212,0.6)" },
  { id: "blue", label: "Синий", color: "#3b82f6", glow: "rgba(59,130,246,0.6)" },
  { id: "purple", label: "Фиолетовый", color: "#a855f7", glow: "rgba(168,85,247,0.6)" },
  { id: "pink", label: "Розовый", color: "#ec4899", glow: "rgba(236,72,153,0.6)" },
] as const;

export const NODBET_PERKS: NodbetPerk[] = [
  {
    id: "radar",
    name: "⚡ Инсайдерский AI-Радар NODBET",
    description:
      "Открывает доступ к аналитике матчей: реальные шансы команд на победу по статистике составов, вероятность клатча 1v2 и вердикт AI на страницах матчей NJDC 2026.",
    cost: 1_530_000,
    icon: "⚡",
    badge: "AI РАДАР",
    oneTime: true,
  },
  {
    id: "hall_frame",
    name: "🖼️ Рамка Зала Славы",
    description:
      "Косметическая золотая рамка вокруг вашей строки в Топе Хайроллеров. Чисто визуальное отличие — на игру и голосования не влияет.",
    cost: 7_225_000,
    icon: "🖼️",
    badge: "ЗОЛОТАЯ РАМКА",
    oneTime: true,
  },
  {
    id: "crown_badge",
    name: "👑 Значок Короны Хайроллера",
    description:
      "Эксклюзивный золотой значок короны 👑 и королевская подсветка перед вашим никнеймом в Топе Хайроллеров. Подчеркивает ваш элитный статус.",
    cost: 21_250_000,
    icon: "👑",
    badge: "КОРОНА",
    oneTime: true,
  },
  {
    id: "custom_status",
    name: "🏷️ Собственный статус",
    description:
      "Позволяет придумать свой личный статус (текст), который отображается рядом с ником в Топе Хайроллеров. Косметика, никаких игровых преимуществ.",
    cost: 40_800_000,
    icon: "🏷️",
    badge: "СВОЙ СТАТУС",
    oneTime: true,
  },
  {
    id: "coin_magnet",
    name: "🧲 Мультипас Хайроллера",
    description:
      "Элитный пожизненный пропуск: +10% XP за все действия в NODBET (быстрее качается уровень). На баланс, шансы и голосования не влияет — честный ускоритель прогресса.",
    cost: 5_525_000_000,
    icon: "🧲",
    badge: "PRESTIGE PASS",
    oneTime: true,
  },
  {
    id: "star_trail",
    name: "✨ Звёздный След",
    description:
      "Анимированные мерцающие звёздные частицы вокруг вашего никнейма в Зале Славы. Визуальный акцент — ваши строки невозможно пропустить!",
    cost: 3_500_000,
    icon: "✨",
    badge: "ЗВЁЗДНЫЙ СЛЕД",
    oneTime: true,
  },
  {
    id: "aura",
    name: "🔮 Аура",
    description:
      "Анимированная аура вокруг вашего никнейма в Зале Славы. Настройте цвет ауры (8 вариантов) и включайте/выключайте по желанию. Аура отображается поверх Рамки Зала Славы.",
    cost: 9_500_000,
    icon: "🔮",
    badge: "АУРА",
    oneTime: true,
  },
  {
    id: "multi_bet",
    name: "🎯 Мульти-Ставка Хайроллера",
    description:
      "Повышает максимальную ставку в режиме «СВОЯ» Клатч-Рулетки с 500 000 до 1 000 000 NOD. Для тех, кто готов рисковать по-крупному!",
    cost: 2_500_000,
    icon: "🎯",
    badge: "x2 ЛИМИТ",
    oneTime: true,
  },
];

export interface NodbetBet {
  id: string;
  matchId: string;
  matchTitle: string;
  mapIndex: number;
  teamChoice: string;
  teamName: string;
  amount: number;
  odds: number;
  overtimePrediction: boolean;
  status: "pending" | "won" | "lost" | "refunded" | "cancelled";
  createdAt: string;
  payout: number;
}

export interface RouletteSpin {
  id: string;
  bonusId: BonusId;
  label: string;
  multiplier: number;
  wonCoins: number;
  isNegative: boolean;
  createdAt: string;
}

export interface HighRoller {
  id: string;
  nickname: string;
  balance: number;
  totalWon: number;
  betsCount: number;
  level: number;
  customStatus?: string | null;
  hallFrame?: boolean;
  crownBadge?: boolean;
  starTrail?: boolean;
  auraOwned?: boolean;
  auraColor?: string | null;
  auraEnabled?: boolean;
  isCurrentUser?: boolean;
}

interface NodbetInventory {
  radarUnlocked: boolean;
  hallFrame: boolean;
  customStatusOwned: boolean;
  coinMagnet: boolean;
  crownBadge: boolean;
  starTrail: boolean;
  auraOwned: boolean;
  auraColor: string;
  auraEnabled: boolean;
  multiBet: boolean;
  customStatusText: string | null;
  promoUsed?: boolean;
  /** Разовый пересчёт ставок после фикса логики (пункт 8). */
  betReconcileV1Done?: boolean;
}

interface NodbetState {
  balance: number;
  xp: number;
  lastDailyClaim: string | null;
  inventory: NodbetInventory;
  bets: NodbetBet[];
  rouletteHistory: RouletteSpin[];
  streak: StreakMap;
}

interface NodbetProfileRow {
  user_id: string;
  nickname: string | null;
  balance: number;
  xp: number;
  last_daily_claim: string | null;
  radar_unlocked: boolean;
  hall_frame: boolean;
  custom_status_owned: boolean;
  coin_magnet: boolean;
  crown_badge?: boolean;
  star_trail?: boolean;
  aura_owned?: boolean;
  aura_color?: string;
  aura_enabled?: boolean;
  multi_bet?: boolean;
  custom_status_text: string | null;
  total_won: number | string;
  bets_count: number;
  promo_used?: boolean;
  bet_reconcile_v1_done?: boolean;
}

export interface NodbetContextValue {
  balance: number;
  xp: number;
  level: number;
  levelProgress: LevelProgress;
  levelTitle: string;
  dailyBonusAvailable: boolean;
  inventory: NodbetInventory;
  bets: NodbetBet[];
  rouletteHistory: RouletteSpin[];
  highRollers: HighRoller[];
  nickname: string | null;
  displayNickname: string;
  hasCustomNickname: boolean;
  setProfileNickname: (raw: string) => Promise<{ ok: boolean; error?: string }>;
  setCustomStatus: (raw: string) => { ok: boolean; error?: string };
  setAuraColor: (color: string) => void;
  setAuraEnabled: (enabled: boolean) => void;
  placeBet: (
    matchId: string,
    mapIndex: number,
    teamChoice: string,
    teamName: string,
    amount: number,
    overtimePrediction: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  cancelBet: (betId: string) => Promise<{ ok: boolean; error?: string; refund?: number }>;
  spinRoulette: (
    betAmount: number,
    mode: RouletteMode,
    betAll?: boolean
  ) => Promise<{ ok: boolean; results: RouletteSpin[]; error?: string; balance?: number; xp?: number }>;
  commitSpin: (results: RouletteSpin[], serverTotals?: { balance: number; xp: number }) => void;
  buyPerk: (perkId: NodbetPerkId) => Promise<{ ok: boolean; error?: string }>;
  claimDailyBonus: () => Promise<{ ok: boolean; error?: string; reward?: number }>;
  activatePromoCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  hasRadar: boolean;
  maxCustomBet: number;
  /** Deduct coins for double roulette bet (returns true if successful) */
  doubleRouletteDeduct: (amount: number) => { ok: boolean; error?: string };
  /** Award coins after double roulette spin */
  doubleRoulettePayout: (amount: number, xpGain: number) => void;
  /** Ставка в Двойной-Рулетке: в онлайн-режиме списание делает сервер (RPC). */
  doubleRoulettePlaceBet: (lobbyId: string, amount: number, bonusId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Перечитать свой профиль с сервера (баланс/XP/инвентарь = истина сервера). */
  refreshOwnProfile: () => Promise<void>;
}

const LOCAL_STORAGE_PREFIX = "njdc_nodbet_state_v3_";
const LOCAL_NICKNAMES_KEY = "njdc_nodbet_nicknames_v1";
const GUEST_ID = "guest_high_roller";
const STARTING_BALANCE = 10000;
const STARTING_XP = 0;

function emptyInventory(): NodbetInventory {
  return {
    radarUnlocked: false,
    hallFrame: false,
    customStatusOwned: false,
    coinMagnet: false,
    crownBadge: false,
    starTrail: false,
    auraOwned: false,
    auraColor: "red",
    auraEnabled: true,
    multiBet: false,
    customStatusText: null,
    promoUsed: false,
    betReconcileV1Done: false,
  };
}

function getInitialState(userId: string): NodbetState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        balance: typeof parsed.balance === "number" ? parsed.balance : STARTING_BALANCE,
        xp: typeof parsed.xp === "number" ? parsed.xp : STARTING_XP,
        lastDailyClaim: parsed.lastDailyClaim || null,
        inventory: {
          radarUnlocked: !!parsed.inventory?.radarUnlocked,
          hallFrame: !!parsed.inventory?.hallFrame,
          customStatusOwned: !!parsed.inventory?.customStatusOwned,
          coinMagnet: !!parsed.inventory?.coinMagnet,
          crownBadge: !!parsed.inventory?.crownBadge,
          starTrail: !!parsed.inventory?.starTrail,
          auraOwned: !!parsed.inventory?.auraOwned,
          auraColor: typeof parsed.inventory?.auraColor === "string" ? parsed.inventory.auraColor : "red",
          auraEnabled: parsed.inventory?.auraEnabled !== false,
          multiBet: !!parsed.inventory?.multiBet,
          customStatusText: parsed.inventory?.customStatusText ?? null,
          promoUsed: !!parsed.inventory?.promoUsed,
          betReconcileV1Done: !!parsed.inventory?.betReconcileV1Done,
        },
        bets: Array.isArray(parsed.bets) ? (parsed.bets as NodbetBet[]) : [],
        rouletteHistory: Array.isArray(parsed.rouletteHistory) ? (parsed.rouletteHistory as RouletteSpin[]) : [],
        streak: parsed.streak && typeof parsed.streak === "object" ? { ...emptyStreak(), ...parsed.streak } : emptyStreak(),
      };
    }
  } catch {
    /* ignore */
  }

  return {
    balance: STARTING_BALANCE,
    xp: STARTING_XP,
    lastDailyClaim: null,
    inventory: emptyInventory(),
    bets: [],
    rouletteHistory: [],
    streak: emptyStreak(),
  };
}

function loadLocalNicknames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_NICKNAMES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveLocalNicknames(map: Record<string, string>) {
  localStorage.setItem(LOCAL_NICKNAMES_KEY, JSON.stringify(map));
}

function normalizeDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function betFromRow(row: Record<string, unknown>): NodbetBet {
  return {
    id: String(row.id),
    matchId: String(row.match_id ?? ""),
    matchTitle: String(row.match_title ?? ""),
    mapIndex: Number(row.map_index) || 0,
    teamChoice: String(row.team_choice ?? ""),
    teamName: String(row.team_name ?? ""),
    amount: Number(row.amount) || 0,
    odds: Number(row.odds) || 1,
    overtimePrediction: !!row.overtime_prediction,
    status: (row.status as NodbetBet["status"]) || "pending",
    createdAt: normalizeDate(String(row.created_at ?? "")) ?? new Date().toISOString(),
    payout: Number(row.payout) || 0,
  };
}

function spinFromRow(row: Record<string, unknown>): RouletteSpin {
  const bonusId = (row.bonus_id as BonusId) || "normal";
  return {
    id: String(row.id),
    bonusId,
    label: String(row.label ?? BONUSES[bonusId]?.label ?? ""),
    multiplier: Number(row.multiplier) || 1,
    wonCoins: Number(row.won_coins) || 0,
    isNegative: !!row.is_negative,
    createdAt: normalizeDate(String(row.created_at ?? "")) ?? new Date().toISOString(),
  };
}

function stateSnapshot(s: NodbetState) {
  return {
    balance: s.balance,
    xp: s.xp,
    lastDailyClaim: s.lastDailyClaim,
    inventory: s.inventory,
    bets: s.bets,
    rouletteHistory: s.rouletteHistory,
  };
}

/**
 * Чистая функция расчёта исхода ставки по актуальным данным матча.
 * Используется и для авто-расчёта pending-ставок, и для разового
 * пересчёта (reconcile) уже рассчитанных ставок.
 *
 * Возвращает корректный статус + выплату, либо null, если исход
 * сейчас определить нельзя (карта ещё не доиграна и не подлежит возврату).
 */
function computeBetOutcome(
  bet: NodbetBet,
  matches: readonly any[]
): { status: "won" | "lost" | "refunded"; payout: number } | null {
  const match = matches.find((m) => m.id === bet.matchId);
  if (!match) return null;
  const maps = normalizeMaps(match);
  const map = maps[bet.mapIndex];
  if (!map) return null;

  // Карта ещё не доиграна по правилам CS2.
  if (!mapFinished(map)) {
    // Если карта в принципе не нужна (например, 3-я катка Bo3 при 2:0) — возврат.
    if (bet.mapIndex >= relevantMapCount(match)) {
      return { status: "refunded", payout: bet.amount };
    }
    return null; // исход пока неизвестен
  }

  const winner = mapWinner(map);
  const actualOvertime = mapHadOvertime(map);

  // Неверный прогноз овертайма — ставка сгорает (правило честной игры).
  if (bet.overtimePrediction !== actualOvertime) {
    return { status: "lost", payout: 0 };
  }

  if (winner && winner === bet.teamChoice) {
    return { status: "won", payout: Math.round(bet.amount * bet.odds) };
  }

  return { status: "lost", payout: 0 };
}

const NodbetContext = createContext<NodbetContextValue | null>(null);

export function NodbetProvider({ children }: { children: ReactNode }) {
  const { matches } = useData();
  const { user } = useUserAuth();

  const [state, setState] = useState<NodbetState>(() => getInitialState(user ? user.id : GUEST_ID));
  const [profiles, setProfiles] = useState<NodbetProfileRow[]>([]);
  const [localNicknames, setLocalNicknames] = useState<Record<string, string>>(loadLocalNicknames);
  const [hydrated, setHydrated] = useState(false);

  const hydratedRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const lastSyncedRef = useRef<string>("{}");
  const localSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Server-authoritative режим: пока колесо крутится (результат УЖЕ
  // записан сервером), откладываем применение realtime-обновлений
  // баланса, чтобы цифры на экране менялись только после остановки
  // колеса (правило «пункт 3» из старой логики).
  const moneyLockRef = useRef(false);
  const pendingServerProfileRef = useRef<NodbetProfileRow | null>(null);
  const settleAttemptsRef = useRef<Record<string, number>>({});
  const reconcileCalledRef = useRef(false);

  // Всегда свежий снимок состояния — для отложенной синхронизации
  // и корректного flush при уходе со страницы.
  const latestStateRef = useRef<NodbetState>(state);
  latestStateRef.current = state;
  const latestUserRef = useRef(user);
  latestUserRef.current = user;

  const userId = user ? user.id : GUEST_ID;

  // ---------- Никнеймы ----------
  const myProfile = useMemo(() => {
    if (!user) return undefined;
    return profiles.find((p) => p.user_id === user.id);
  }, [profiles, user]);

  const nickname = useMemo(() => {
    if (user && myProfile?.nickname) return myProfile.nickname;
    if (localNicknames[userId]) return localNicknames[userId];
    return null;
  }, [user, myProfile, localNicknames, userId]);

  const displayNickname = useMemo(() => {
    return nickname || fruitNickname(userId);
  }, [nickname, userId]);

  const hasCustomNickname = useMemo(() => {
    return !!nickname && nickname !== fruitNickname(userId);
  }, [nickname, userId]);

  // ---------- Загрузка профилей ----------
  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error } = await supabase.from("nodbet_profiles").select("*").order("balance", { ascending: false }).limit(200);
      if (error) {
        console.error("[NODBET] Не удалось загрузить Топ из Supabase", error);
        return;
      }
      setProfiles((data ?? []) as NodbetProfileRow[]);
    } catch (e) {
      console.error("[NODBET] loadProfiles error", e);
    }
  }, []);

  const loadOwnData = useCallback(
    async (uid: string) => {
      if (!isSupabaseConfigured || !supabase) return;
      const [ownRes, betsRes, spinsRes] = await Promise.all([
        supabase.from("nodbet_profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("nodbet_bets").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("nodbet_roulette_spins").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
      ]);

      if (ownRes.error || betsRes.error || spinsRes.error) {
        console.error("[NODBET] Ошибка загрузки профиля из Supabase", ownRes.error || betsRes.error || spinsRes.error);
        return;
      }

      if (!ownRes.data) {
        // Server-authoritative: профиль создаём МИНИМАЛЬНЫМ insert'ом —
        // баланс/XP берутся из default'ов таблицы (10 000 NOD).
        // Локальные (гостевые) накопления в онлайн-профиль НЕ импортируются:
        // иначе это была бы дыра для накрутки баланса.
        const initialNickname = loadLocalNicknames()[uid] ?? null;
        let { error: createErr } = await supabase.from("nodbet_profiles").insert({ user_id: uid, nickname: initialNickname });
        if (createErr && (createErr.code === "23505" || /duplicate|unique/i.test(createErr.message))) {
          const retry = await supabase.from("nodbet_profiles").insert({ user_id: uid, nickname: null });
          createErr = retry.error;
        }
        if (createErr) {
          console.error("[NODBET] Не удалось создать профиль в Supabase", createErr);
          return;
        }
        const fresh: NodbetState = {
          balance: STARTING_BALANCE,
          xp: STARTING_XP,
          lastDailyClaim: null,
          inventory: emptyInventory(),
          bets: [],
          rouletteHistory: [],
          streak: emptyStreak(),
        };
        lastSyncedRef.current = JSON.stringify(stateSnapshot(fresh));
        setState(fresh);
        await loadProfiles();
        return;
      }

      const p = ownRes.data as NodbetProfileRow;
      const serverState: NodbetState = {
        balance: Number(p.balance) || 0,
        xp: Number(p.xp) || 0,
        lastDailyClaim: normalizeDate(p.last_daily_claim),
        inventory: {
          radarUnlocked: !!p.radar_unlocked,
          hallFrame: !!p.hall_frame,
          customStatusOwned: !!p.custom_status_owned,
          coinMagnet: !!p.coin_magnet,
          crownBadge: !!p.crown_badge,
          starTrail: !!p.star_trail,
          auraOwned: !!p.aura_owned,
          auraColor: typeof p.aura_color === "string" ? p.aura_color : "red",
          auraEnabled: (p as any).aura_enabled !== false,
          multiBet: !!p.multi_bet,
          customStatusText: p.custom_status_text ?? null,
          promoUsed: !!p.promo_used,
          betReconcileV1Done: !!p.bet_reconcile_v1_done,
        },
        bets: (betsRes.data ?? []).map((r) => betFromRow(r as Record<string, unknown>)),
        rouletteHistory: (spinsRes.data ?? []).map((r) => spinFromRow(r as Record<string, unknown>)),
        streak: emptyStreak(),
      };
      const snap = JSON.stringify(stateSnapshot(serverState));
      lastSyncedRef.current = snap;
      setState((prev) => {
        const merged = { ...serverState, streak: prev.streak };
        return JSON.stringify(stateSnapshot(prev)) === JSON.stringify(stateSnapshot(merged)) ? prev : merged;
      });
    },
    [loadProfiles]
  );

  // ---------- Server-authoritative: применение серверного профиля ----------
  // Баланс/XP/инвентарь/дейли в онлайн-режиме приходят ТОЛЬКО с сервера
  // (RPC и триггеры). Косметику (ник/ауру/статус) не трогаем — её
  // по-прежнему пишет сам клиент в разрешённые колонки.
  const applyServerProfileMoney = useCallback((p: NodbetProfileRow) => {
    setState((prev) => ({
      ...prev,
      balance: Number(p.balance) || 0,
      xp: Number(p.xp) || 0,
      lastDailyClaim: normalizeDate(p.last_daily_claim),
      inventory: {
        ...prev.inventory,
        radarUnlocked: !!p.radar_unlocked,
        hallFrame: !!p.hall_frame,
        customStatusOwned: !!p.custom_status_owned,
        coinMagnet: !!p.coin_magnet,
        crownBadge: !!p.crown_badge,
        starTrail: !!p.star_trail,
        auraOwned: !!p.aura_owned,
        multiBet: !!p.multi_bet,
        promoUsed: !!p.promo_used,
        betReconcileV1Done: !!p.bet_reconcile_v1_done,
      },
    }));
  }, []);

  const applyServerProfileRow = useCallback(
    (p: NodbetProfileRow) => {
      if (moneyLockRef.current) {
        // Колесо крутится — отложим применение до остановки анимации.
        pendingServerProfileRef.current = p;
        return;
      }
      applyServerProfileMoney(p);
    },
    [applyServerProfileMoney]
  );

  const unlockMoney = useCallback(() => {
    moneyLockRef.current = false;
    const pending = pendingServerProfileRef.current;
    pendingServerProfileRef.current = null;
    if (pending) applyServerProfileMoney(pending);
  }, [applyServerProfileMoney]);

  const refreshOwnProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !latestUserRef.current) return;
    try {
      const { data, error } = await supabase
        .from("nodbet_profiles")
        .select("*")
        .eq("user_id", latestUserRef.current.id)
        .maybeSingle();
      if (!error && data) applyServerProfileRow(data as NodbetProfileRow);
    } catch {
      /* ignore */
    }
  }, [applyServerProfileRow]);

  useEffect(() => {
    hydratedRef.current = false;
    setHydrated(false);
    pendingSyncRef.current = false;
    lastSyncedRef.current = "{}";
    settleAttemptsRef.current = {};
    reconcileCalledRef.current = false;
    moneyLockRef.current = false;
    pendingServerProfileRef.current = null;

    if (isSupabaseConfigured && supabase) {
      loadProfiles();
      if (user) {
        setState(getInitialState(user.id));
        loadOwnData(user.id)
          .catch((e) => console.error("[NODBET] Supabase load failed", e))
          .finally(() => {
            hydratedRef.current = true;
            setHydrated(true);
          });
      } else {
        setState(getInitialState(GUEST_ID));
        hydratedRef.current = true;
        setHydrated(true);
      }
    } else {
      setProfiles([]);
      setState(getInitialState(userId));
      hydratedRef.current = true;
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- Realtime ----------
  // ВАЖНО: мы НЕ перезагружаем собственные ставки/спины по realtime.
  // Раньше это затирало локальные изменения (свежий спин/проигрыш),
  // и игроки теряли коины после обновления страницы. Локальное
  // состояние текущего пользователя — источник правды; в Supabase
  // оно persist'ится синхронизацией ниже. Realtime нужен только для
  // обновления Топа Хайроллеров (профили других игроков).
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("nodbet-profiles-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_profiles" }, () => {
        loadProfiles();
      })
      .subscribe();

    // Подписка на СВОЙ профиль: серверные начисления (выигрыш в
    // Двойной-Рулетке, расчёт ставок и т.п.) прилетают сюда.
    const selfChannel = user
      ? client
          .channel(`nodbet-own-profile-${user.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "nodbet_profiles", filter: `user_id=eq.${user.id}` },
            (payload) => {
              applyServerProfileRow(payload.new as NodbetProfileRow);
            }
          )
          .subscribe()
      : null;

    return () => {
      client.removeChannel(channel);
      if (selfChannel) client.removeChannel(selfChannel);
    };
  }, [loadProfiles, user, applyServerProfileRow]);

  // ---------- Сохранение в localStorage ----------
  useEffect(() => {
    if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
    localSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(stateSnapshot(state)));
      } catch {
        /* ignore */
      }
    }, 150);
    return () => {
      if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
    };
  }, [state, userId]);

  // ---------- Синхронизация с Supabase ----------
  // Ключевой фикс: синхронизация не теряет изменения, сделанные во время
  // уже идущей записи, и принудительно flush'ится при уходе со страницы
  // (refresh/закрытие вкладки) — иначе спины и проигрыши не сохранялись.
  const syncToSupabase = useCallback(
    async (reason: string = "debounced") => {
      const client = supabase;
      const currentUser = latestUserRef.current;
      if (!client || !currentUser || !isSupabaseConfigured) return;
      const snapshot = latestStateRef.current;
      const snapJson = JSON.stringify(stateSnapshot(snapshot));
      if (snapJson === lastSyncedRef.current) return;
      if (pendingSyncRef.current) {
        // Уже идёт запись — после неё finally сам перепланирует свежий снимок.
        return;
      }
      pendingSyncRef.current = true;
      try {
        const uid = currentUser.id;

        // Server-authoritative: клиент пишет ТОЛЬКО косметические поля.
        // Баланс/XP/историю ставок и спинов меняет исключительно сервер
        // через RPC (RLS и GRANT'ы не позволят записать их напрямую).
        const { error: profileErr } = await client
          .from("nodbet_profiles")
          .update({
            custom_status_text: snapshot.inventory.customStatusText,
            aura_color: snapshot.inventory.auraColor,
            aura_enabled: snapshot.inventory.auraEnabled,
          })
          .eq("user_id", uid);
        if (profileErr) throw profileErr;

        lastSyncedRef.current = snapJson;
      } catch (e) {
        console.error("[NODBET] Не удалось синхронизировать с Supabase", reason, e);
      } finally {
        pendingSyncRef.current = false;
        // Если за время записи состояние опять поменялось — перепланируем.
        const latest = latestStateRef.current;
        if (JSON.stringify(stateSnapshot(latest)) !== lastSyncedRef.current) {
          setTimeout(() => {
            void syncToSupabase("recheck");
          }, 150);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    if (!hydrated) return;

    const snapJson = JSON.stringify(stateSnapshot(state));
    if (snapJson === lastSyncedRef.current) return;

    const timer = setTimeout(() => {
      void syncToSupabase("debounced");
    }, 500);
    return () => clearTimeout(timer);
  }, [state, user, hydrated, syncToSupabase]);

  // Принудительный flush при закрытии вкладки / скрытии страницы /
  // уходе с сайта — чтобы спин и списание точно дошли до базы.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    const flush = () => {
      void syncToSupabase("unload");
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, syncToSupabase]);

  // ---------- Авто-расчёт ставок (по актуальным правилам CS2) ----------
  // ЛОКАЛЬНЫЙ расчёт — только для гостей/офлайн-режима.
  // В онлайн-режиме исход считает сервер (RPC ниже).
  useEffect(() => {
    if (isSupabaseConfigured && supabase && latestUserRef.current) return;
    setState((prev) => {
      let changed = false;
      let addedBalance = 0;
      let addedXp = 0;

      const nextBets = prev.bets.map((bet: NodbetBet) => {
        if (bet.status !== "pending") return bet;
        const match = matches.find((m) => m.id === bet.matchId);
        if (!match || match.status !== "finished") return bet;

        const outcome = computeBetOutcome(bet, matches);
        if (!outcome) return bet; // карта ещё не доиграна — ждём

        changed = true;
        if (outcome.status === "won") {
          addedBalance += outcome.payout;
          addedXp += Math.round((outcome.payout / 20) * (prev.inventory.coinMagnet ? 1.1 : 1));
        } else if (outcome.status === "refunded") {
          addedBalance += outcome.payout;
        }
        return { ...bet, status: outcome.status, payout: outcome.payout };
      });

      if (!changed) return prev;
      return {
        ...prev,
        balance: prev.balance + addedBalance,
        xp: prev.xp + addedXp,
        bets: nextBets,
      };
    });
  }, [matches, state.bets]);

  // ---------- Авто-расчёт ставок (ОНЛАЙН-режим): сервер считает исход ----------
  // Клиент вызывает RPC, когда по его pending-ставкам матч завершился.
  // Сервер атомарно обновляет ставки/баланс/XP и возвращает их.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user || !hydrated) return;
    const pendingMatchIds = new Set(
      state.bets.filter((b) => b.status === "pending").map((b) => b.matchId)
    );
    if (pendingMatchIds.size === 0) return;

    for (const m of matches) {
      if (m.status !== "finished" || !pendingMatchIds.has(m.id)) continue;
      const lastTry = settleAttemptsRef.current[m.id] || 0;
      if (Date.now() - lastTry < 10000) continue;
      settleAttemptsRef.current[m.id] = Date.now();

      void (async (matchId: string) => {
        try {
          const { data, error } = await supabase.rpc("nodbet_settle_my_bets", { p_match_id: matchId });
          if (error || !data?.ok) return;
          const changed = ((data as { bets?: { id: string; status: NodbetBet["status"]; payout: number }[] }).bets) || [];
          setState((prev) => ({
            ...prev,
            balance: Number((data as { balance?: number }).balance ?? prev.balance),
            xp: Number((data as { xp?: number }).xp ?? prev.xp),
            bets: prev.bets.map((b) => {
              const c = changed.find((x) => x.id === b.id);
              return c ? { ...b, status: c.status, payout: Number(c.payout) || 0 } : b;
            }),
          }));
        } catch {
          /* следующая попытка через backoff */
        }
      })(m.id);
    }
  }, [matches, state.bets, user, hydrated]);

  // ---------- РАЗОВЫЙ пересчёт ставок (ОНЛАЙН-режим, пункт 8) ----------
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user || !hydrated) return;
    if (reconcileCalledRef.current) return;
    if (state.inventory.betReconcileV1Done) {
      reconcileCalledRef.current = true;
      return;
    }
    if (matches.length === 0) return; // ждём загрузки матчей (как раньше)

    reconcileCalledRef.current = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("nodbet_reconcile_my_bets");
        if (error || !data?.ok) {
          reconcileCalledRef.current = false;
          return;
        }
        const changed = ((data as { changed?: { id: string; status: NodbetBet["status"]; payout: number }[] }).changed) || [];
        setState((prev) => ({
          ...prev,
          balance: Number((data as { balance?: number }).balance ?? prev.balance),
          xp: Number((data as { xp?: number }).xp ?? prev.xp),
          bets: prev.bets.map((b) => {
            const c = changed.find((x) => x.id === b.id);
            return c ? { ...b, status: c.status, payout: Number(c.payout) || 0 } : b;
          }),
          inventory: { ...prev.inventory, betReconcileV1Done: true },
        }));
      } catch {
        reconcileCalledRef.current = false;
      }
    })();
  }, [user, hydrated, matches, state.inventory.betReconcileV1Done]);

  // ---------- РАЗОВЫЙ пересчёт ставок (пункт 8) ----------
  // ЛОКАЛЬНЫЙ вариант — только для гостей/офлайна.
  // Один раз после этого апдейта: перепроверяем УЖЕ рассчитанные ставки
  // против актуальных результатов каток. Если из-за старого бага ставка
  // была ошибочно помечена проигранной (команда выиграла) — засчитываем
  // выигрыш и выплачиваем награду. Если ошибочно выигрышной (команда
  // проиграла) — исправляем на проигрыш и снимаем ошибочно начисленное.
  // Запускается только когда загружены и матчи, и ставки пользователя.
  useEffect(() => {
    if (isSupabaseConfigured && supabase && latestUserRef.current) return;
    if (!hydrated) return;
    if (matches.length === 0) return; // ждём загрузки матчей
    if (state.inventory.betReconcileV1Done) return;

    setState((prev) => {
      if (prev.inventory.betReconcileV1Done) return prev;

      let changed = false;
      let balanceDelta = 0;
      let xpDelta = 0;

      const nextBets = prev.bets.map((bet: NodbetBet) => {
        // Пересчитываем только окончательные ставки (won/lost).
        // refunded/cancelled/pending не трогаем.
        if (bet.status !== "won" && bet.status !== "lost") return bet;

        const outcome = computeBetOutcome(bet, matches);
        if (!outcome) return bet; // исход сейчас нельзя определить — не трогаем

        const oldStatus = bet.status;
        const oldPayout = bet.payout;

        if (outcome.status === oldStatus && outcome.payout === oldPayout) return bet;

        // Корректируем баланс: снимаем старую выплату, начисляем новую.
        balanceDelta += outcome.payout - oldPayout;
        if (outcome.status === "won" && oldStatus !== "won") {
          xpDelta += Math.round((outcome.payout / 20) * (prev.inventory.coinMagnet ? 1.1 : 1));
        }
        changed = true;
        return { ...bet, status: outcome.status, payout: outcome.payout };
      });

      if (!changed) {
        // Нечего исправлять — всё равно фиксируем флаг, чтобы не повторять.
        return { ...prev, inventory: { ...prev.inventory, betReconcileV1Done: true } };
      }
      return {
        ...prev,
        balance: Math.max(0, prev.balance + balanceDelta),
        xp: prev.xp + xpDelta,
        bets: nextBets,
        inventory: { ...prev.inventory, betReconcileV1Done: true },
      };
    });
  }, [hydrated, matches, state.bets, state.inventory.betReconcileV1Done]);

  const level = useMemo(() => levelFromXp(state.xp), [state.xp]);
  const lvlProgress = useMemo(() => levelProgress(state.xp), [state.xp]);
  const levelTitle = useMemo(() => levelTitleFor(level), [level]);

  const dailyBonusAvailable = useMemo(() => {
    if (!state.lastDailyClaim) return true;
    const last = new Date(state.lastDailyClaim);
    const now = new Date();
    return last.toDateString() !== now.toDateString();
  }, [state.lastDailyClaim]);

  // ---------- Никнейм / статус — ИСПРАВЛЕНО ----------
  const setProfileNickname = useCallback(
    async (raw: string) => {
      const result = validateNickname(raw);
      if (!result.ok || !result.clean) {
        return { ok: false, error: result.error || "Неверный никнейм" };
      }
      const clean = result.clean;

      if (isSupabaseConfigured && supabase && user) {
        // Пытаемся обновить существующий профиль
        try {
          // Сначала проверим, не занят ли ник кем-то другим (case-insensitive)
          const { data: existing, error: checkErr } = await supabase
            .from("nodbet_profiles")
            .select("user_id")
            .ilike("nickname", clean)
            .neq("user_id", user.id)
            .limit(1);
          if (!checkErr && existing && existing.length > 0) {
            return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
          }
        } catch {
          /* ignore check */
        }

        // Обновляем профиль — используем update, а не upsert с 2 полями
        const { error: updErr } = await supabase
          .from("nodbet_profiles")
          .update({ nickname: clean })
          .eq("user_id", user.id)
          .select("user_id");

        // Если профиля ещё нет (count 0) — создаём через upsert с минимальными полями
        if (updErr) {
          if (updErr.code === "23505" || /duplicate|unique/i.test(updErr.message)) {
            return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
          }
          // Попытка insert как fallback (минимальный — деньги задаёт сервер)
          const { error: upsertErr } = await supabase.from("nodbet_profiles").insert({
            user_id: user.id,
            nickname: clean,
          });
          if (upsertErr) {
            if (upsertErr.code === "23505" || /duplicate|unique/i.test(upsertErr.message)) {
              return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
            }
            console.error("[NODBET] Ошибка сохранения никнейма", upsertErr);
            return { ok: false, error: "Не удалось сохранить никнейм. Попробуйте ещё раз." };
          }
        } else {
          // Если update не затронул строк (профиля нет) — вставляем
          // supabase v2 не возвращает count без select, поэтому проверим myProfile
          if (!myProfile) {
            const { error: insErr } = await supabase.from("nodbet_profiles").insert({
              user_id: user.id,
              nickname: clean,
            });
            if (insErr && insErr.code === "23505") {
              return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
            }
          }
        }

        setProfiles((prev) => {
          const exists = prev.some((p) => p.user_id === user.id);
          if (exists) return prev.map((p) => (p.user_id === user.id ? { ...p, nickname: clean } : p));
          return [
            ...prev,
            {
              user_id: user.id,
              nickname: clean,
              balance: state.balance,
              xp: state.xp,
              last_daily_claim: state.lastDailyClaim,
              radar_unlocked: state.inventory.radarUnlocked,
              hall_frame: state.inventory.hallFrame,
              custom_status_owned: state.inventory.customStatusOwned,
              coin_magnet: state.inventory.coinMagnet,
              crown_badge: state.inventory.crownBadge,
              star_trail: state.inventory.starTrail,
              aura_owned: state.inventory.auraOwned,
              aura_color: state.inventory.auraColor,
              aura_enabled: state.inventory.auraEnabled,
              multi_bet: state.inventory.multiBet,
              custom_status_text: state.inventory.customStatusText,
              promo_used: state.inventory.promoUsed,
              total_won: 0,
              bets_count: 0,
            },
          ];
        });
        return { ok: true };
      }

      // Локальный режим
      const taken = Object.entries(localNicknames).some(([id, n]) => id !== userId && n.toLowerCase() === clean.toLowerCase());
      if (taken) return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
      const next = { ...localNicknames, [userId]: clean };
      saveLocalNicknames(next);
      setLocalNicknames(next);
      return { ok: true };
    },
    [user, myProfile, state.balance, state.xp, state.lastDailyClaim, state.inventory, localNicknames, userId]
  );

  const setCustomStatus = useCallback(
    (raw: string) => {
      if (!state.inventory.customStatusOwned) {
        return { ok: false, error: "У вас ещё не куплено право на Свой Статус в Магазине Хайроллера!" };
      }
      const clean = raw.trim().slice(0, 32);
      setState((prev) => ({
        ...prev,
        inventory: { ...prev.inventory, customStatusText: clean || null },
      }));
      return { ok: true };
    },
    [state.inventory.customStatusOwned]
  );

  const setAuraColor = useCallback((color: string) => {
    setState((prev) => ({
      ...prev,
      inventory: { ...prev.inventory, auraColor: color },
    }));
  }, []);

  const setAuraEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      inventory: { ...prev.inventory, auraEnabled: enabled },
    }));
  }, []);

  const claimDailyBonus = useCallback(async (): Promise<{ ok: boolean; error?: string; reward?: number }> => {
    if (!dailyBonusAvailable) return { ok: false, error: "Вы уже забирали бонус сегодня. Приходите завтра!" };

    // Server-authoritative: в онлайн-режиме начисление делает сервер.
    if (isSupabaseConfigured && supabase && latestUserRef.current) {
      try {
        const { data, error } = await supabase.rpc("nodbet_claim_daily");
        if (error) return { ok: false, error: "Ошибка сервера при начислении бонуса" };
        if (!data?.ok) return { ok: false, error: (data as { error?: string })?.error || "Бонус пока недоступен" };
        setState((prev) => ({
          ...prev,
          balance: Number((data as { balance?: number }).balance ?? prev.balance),
          xp: Number((data as { xp?: number }).xp ?? prev.xp),
          lastDailyClaim: normalizeDate((data as { last_daily_claim?: string }).last_daily_claim ?? null) ?? new Date().toISOString(),
        }));
        return { ok: true, reward: Number((data as { reward?: number }).reward) || 500 };
      } catch {
        return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
      }
    }

    const reward = 500;
    setState((prev) => ({
      ...prev,
      balance: prev.balance + reward,
      xp: prev.xp + Math.round(200 * (prev.inventory.coinMagnet ? 1.1 : 1)),
      lastDailyClaim: new Date().toISOString(),
    }));
    return { ok: true, reward };
  }, [dailyBonusAvailable]);

  const activatePromoCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (code !== "NJDC-BONUS-2026") {
        return { ok: false, error: "Неверный или просроченный промокод!" };
      }
      if (state.inventory.promoUsed) {
        return { ok: false, error: "Этот промокод уже был активирован на вашем аккаунте!" };
      }

      // Server-authoritative: начисление и флаг — на сервере.
      if (isSupabaseConfigured && supabase && latestUserRef.current) {
        try {
          const { data, error } = await supabase.rpc("nodbet_activate_promo", { p_code: code });
          if (error) return { ok: false, error: "Ошибка сервера при активации промокода" };
          if (!data?.ok) return { ok: false, error: (data as { error?: string })?.error || "Ошибка активации промокода" };
          setState((prev) => ({
            ...prev,
            balance: Number((data as { balance?: number }).balance ?? prev.balance),
            inventory: { ...prev.inventory, promoUsed: true },
          }));
          return { ok: true };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      setState((prev) => ({
        ...prev,
        balance: prev.balance + 10000,
        inventory: {
          ...prev.inventory,
          promoUsed: true,
        },
      }));

      return { ok: true };
    },
    [state.inventory.promoUsed]
  );

  const placeBet = useCallback(
    async (
      matchId: string,
      mapIndex: number,
      teamChoice: string,
      teamName: string,
      amount: number,
      overtimePrediction: boolean
    ): Promise<{ ok: boolean; error?: string }> => {
      if (amount <= 0 || isNaN(amount)) return { ok: false, error: "Укажите корректную сумму ставки" };
      if (amount > state.balance) return { ok: false, error: "Недостаточно NOD-Коинов для такой ставки!" };

      const match = matches.find((m) => m.id === matchId);
      if (!match) return { ok: false, error: "Матч не найден" };
      if (match.status === "live") {
        return { ok: false, error: "Ставки в LIVE запрещены правилами честной игры. Можно ставить только до старта матча!" };
      }
      if (match.status !== "upcoming") {
        return { ok: false, error: "Матч уже завершён или идёт в реальном времени. Ставка отклонена." };
      }

      const duplicate = state.bets.some((b) => b.matchId === matchId && b.mapIndex === mapIndex && b.status === "pending");
      if (duplicate) {
        return {
          ok: false,
          error: `Вы уже сделали ставку на Карту ${mapIndex + 1} этого матча. Дождитесь её расчёта.`,
        };
      }

      // Server-authoritative: ставку принимает и списывает коины сервер.
      if (isSupabaseConfigured && supabase && latestUserRef.current) {
        try {
          const { data, error } = await supabase.rpc("nodbet_place_bet", {
            p_match_id: matchId,
            p_map_index: mapIndex,
            p_team_choice: teamChoice,
            p_amount: Math.round(amount),
            p_overtime: overtimePrediction,
          });
          if (error) return { ok: false, error: "Ошибка сервера при приёме ставки" };
          if (!data?.ok) return { ok: false, error: (data as { error?: string })?.error || "Не удалось принять ставку" };

          const srvBet = (data as { bet?: Record<string, unknown> }).bet;
          const newBet: NodbetBet = {
            id: String(srvBet?.id ?? "bet_" + crypto.randomUUID().slice(0, 8)),
            matchId,
            matchTitle: String(srvBet?.match_title ?? match.title),
            mapIndex,
            teamChoice,
            teamName: String(srvBet?.team_name ?? teamName),
            amount,
            odds: Number(srvBet?.odds) || 1,
            overtimePrediction,
            status: "pending",
            createdAt: new Date().toISOString(),
            payout: 0,
          };
          setState((prev) => ({
            ...prev,
            balance: Number((data as { balance?: number }).balance ?? prev.balance),
            xp: Number((data as { xp?: number }).xp ?? prev.xp),
            bets: [newBet, ...prev.bets],
          }));
          return { ok: true };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      const baseA = Math.round((1.75 + (match.match_number % 3) * 0.13 + mapIndex * 0.05 + 0.25) * 100) / 100;
      const baseB = Math.round((2.05 - (match.match_number % 3) * 0.11 + mapIndex * 0.05 + 0.25) * 100) / 100;
      const odds = teamChoice === match.team_a ? baseA : baseB;

      const newBet: NodbetBet = {
        id: "bet_" + crypto.randomUUID().slice(0, 8),
        matchId,
        matchTitle: match.title,
        mapIndex,
        teamChoice,
        teamName,
        amount,
        odds,
        overtimePrediction,
        status: "pending",
        createdAt: new Date().toISOString(),
        payout: 0,
      };

      setState((prev) => ({
        ...prev,
        balance: prev.balance - amount,
        xp: prev.xp + Math.round((amount / 50) * (prev.inventory.coinMagnet ? 1.1 : 1)),
        bets: [newBet, ...prev.bets],
      }));

      return { ok: true };
    },
    [state.balance, state.bets, matches]
  );

  // ---------- Отмена ставки (пункт 5) ----------
  // Отменять можно ТОЛЬКО ставки на будущие матчи (status "upcoming").
  // На LIVE и завершённые матчи отменять нельзя. При отмене ставка
  // возвращается на баланс.
  const cancelBet = useCallback(
    async (betId: string): Promise<{ ok: boolean; error?: string; refund?: number }> => {
      const bet = state.bets.find((b) => b.id === betId);
      if (!bet) return { ok: false, error: "Ставка не найдена" };
      if (bet.status !== "pending") {
        return { ok: false, error: "Эта ставка уже рассчитана и её нельзя отменить." };
      }
      const match = matches.find((m) => m.id === bet.matchId);
      if (!match) return { ok: false, error: "Матч не найден" };
      if (match.status !== "upcoming") {
        return {
          ok: false,
          error: "Отменять можно только ставки на будущие матчи. Этот матч уже идёт или завершён.",
        };
      }

      // Server-authoritative: возврат делает сервер.
      if (isSupabaseConfigured && supabase && latestUserRef.current) {
        try {
          const { data, error } = await supabase.rpc("nodbet_cancel_bet", { p_bet_id: betId });
          if (error) return { ok: false, error: "Ошибка сервера при отмене ставки" };
          if (!data?.ok) return { ok: false, error: (data as { error?: string })?.error || "Не удалось отменить ставку" };
          const refund = Number((data as { refund?: number }).refund ?? bet.amount);
          setState((prev) => ({
            ...prev,
            balance: Number((data as { balance?: number }).balance ?? prev.balance),
            bets: prev.bets.map((b) => (b.id === betId ? { ...b, status: "cancelled" as const, payout: 0 } : b)),
          }));
          return { ok: true, refund };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      setState((prev) => ({
        ...prev,
        balance: prev.balance + bet.amount,
        bets: prev.bets.map((b) => (b.id === betId ? { ...b, status: "cancelled" as const, payout: 0 } : b)),
      }));

      return { ok: true, refund: bet.amount };
    },
    [state.bets, matches]
  );

  // ---------- Рулетка ----------
  // ВАЖНО (пункт 3): баланс НЕ меняется здесь. Результаты только
  // рассчитываются. Применение к балансу/XP/истории — только в commitSpin,
  // который вызывается ПОСЛЕ окончания анимации колеса.
  const spinRoulette = useCallback(
    async (
      betAmount: number,
      mode: RouletteMode = "classic",
      betAll: boolean = false
    ): Promise<{ ok: boolean; results: RouletteSpin[]; error?: string; balance?: number; xp?: number }> => {
      if (betAmount < 0 || isNaN(betAmount)) {
        return { ok: false, results: [] as RouletteSpin[], error: "Неверная сумма ставки" };
      }
      if (!betAll && betAmount > state.balance) {
        return { ok: false, results: [] as RouletteSpin[], error: "Недостаточно NOD-Коинов для этого спина!" };
      }

      // Server-authoritative: исход спина определяет и записывает сервер.
      if (isSupabaseConfigured && supabase && latestUserRef.current) {
        moneyLockRef.current = true;
        try {
          const { data, error } = await supabase.rpc("nodbet_spin", {
            p_bet_amount: Math.round(betAmount),
            p_mode: mode,
            p_bet_all: betAll,
          });
          if (error) {
            unlockMoney();
            return { ok: false, results: [] as RouletteSpin[], error: "Ошибка сервера при вращении. Попробуйте ещё раз." };
          }
          if (!data?.ok) {
            unlockMoney();
            return { ok: false, results: [] as RouletteSpin[], error: (data as { error?: string })?.error || "Ошибка вращения" };
          }

          const rawResults = ((data as { results?: Record<string, unknown>[] }).results) || [];
          const results: RouletteSpin[] = rawResults.map((r) => {
            const bonusId = (r.bonus_id as BonusId) || "normal";
            const def = BONUSES[bonusId] || BONUSES.normal;
            return {
              id: String(r.id),
              bonusId,
              label: String(r.label ?? def.label),
              multiplier: Number(r.multiplier) || def.multiplier,
              wonCoins: Number(r.won_coins) || 0,
              isNegative: !!r.is_negative,
              createdAt: normalizeDate(String(r.created_at ?? "")) ?? new Date().toISOString(),
            };
          });

          const serverBalance = Number((data as { balance?: number }).balance);
          const serverXp = Number((data as { xp?: number }).xp);
          if (!Number.isFinite(serverBalance) || !Number.isFinite(serverXp)) {
            unlockMoney();
            return { ok: false, results: [] as RouletteSpin[], error: "Некорректный ответ сервера. Попробуйте ещё раз." };
          }

          return {
            ok: true,
            results,
            balance: serverBalance,
            xp: serverXp,
          };
        } catch {
          unlockMoney();
          return { ok: false, results: [] as RouletteSpin[], error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      // Локальный (гостевой/офлайн) режим — как раньше.
      const results: RouletteSpin[] = [];
      let workingStreak = state.streak;

      // Дабл-спин удалён — всегда один спин.
      const spinCount = 1;

      // ФИКС: при betAll — считаем ставку по точному балансу (зеркало сервера).
      let effectiveBet = betAmount;
      if (betAll) {
        effectiveBet = Math.floor(state.balance / spinCount);
        if (effectiveBet < 1) {
          return { ok: false, results: [], error: "У вас нет коинов, чтобы поставить всё!" };
        }
      }

      for (let i = 0; i < spinCount; i++) {
        const bonusId = pickBonus(mode);
        const def = BONUSES[bonusId] || BONUSES.normal;
        const { delta } = computeSpinResult(bonusId, effectiveBet);
        workingStreak = updateStreak(workingStreak, bonusId);

        results.push({
          id: "spin_" + crypto.randomUUID().slice(0, 8),
          bonusId,
          label: def.label,
          multiplier: def.multiplier,
          wonCoins: delta,
          isNegative: def.isNegative,
          createdAt: new Date().toISOString(),
        });
      }

      return { ok: true, results };
    },
    [state.balance, state.streak, unlockMoney]
  );

  const commitSpin = useCallback(
    (results: RouletteSpin[], serverTotals?: { balance: number; xp: number }) => {
      try {
        if (!results.length) return;
        let balanceDelta = 0;
        let xpGain = 0;
        let workingStreak = state.streak;

        for (const r of results) {
          balanceDelta += r.wonCoins;
          xpGain += r.isNegative ? 20 : 60;
          workingStreak = updateStreak(workingStreak, r.bonusId);
        }

        const magnet = state.inventory.coinMagnet ? 1.1 : 1;

        setState((prev) => ({
          ...prev,
          // В онлайн-режиме применяем ТОЧНЫЕ серверные значения (сервер
          // уже записал их), иначе — локальный расчёт, как раньше.
          balance: serverTotals ? Math.max(0, serverTotals.balance) : Math.max(0, prev.balance + balanceDelta),
          xp: serverTotals ? Math.max(0, serverTotals.xp) : prev.xp + Math.round(xpGain * magnet),
          streak: workingStreak,
          rouletteHistory: [...results, ...prev.rouletteHistory].slice(0, 30),
        }));
      } finally {
        // Колесо остановилось — снимаем блокировку realtime-применений.
        unlockMoney();
      }
    },
    [state.streak, state.inventory.coinMagnet, unlockMoney]
  );

  // ---------- Двойная Рулетка: списание и начисление ----------
  const doubleRouletteDeduct = useCallback(
    (amount: number) => {
      if (amount <= 0 || isNaN(amount)) return { ok: false, error: "Неверная сумма" };
      if (amount > state.balance) return { ok: false, error: "Недостаточно NOD-Коинов на балансе!" };

      const magnet = state.inventory.coinMagnet ? 1.1 : 1;
      setState((prev) => ({
        ...prev,
        balance: prev.balance - amount,
        xp: prev.xp + Math.round((amount / 30) * magnet),
      }));
      return { ok: true };
    },
    [state.balance, state.inventory.coinMagnet]
  );

  const doubleRoulettePayout = useCallback(
    (amount: number, xpGain: number) => {
      if (amount <= 0 && xpGain <= 0) return;
      const magnet = state.inventory.coinMagnet ? 1.1 : 1;
      setState((prev) => ({
        ...prev,
        balance: Math.max(0, prev.balance + Math.round(amount)),
        xp: prev.xp + Math.round(xpGain * magnet),
      }));
    },
    [state.inventory.coinMagnet]
  );

  // Ставка в Двойной-Рулетке: в онлайн-режиме списание выполняет сервер
  // (RPC nodbet_double_place_bet), который также фиксирует пик и готовность.
  // В локальном режиме — старое локальное списание.
  const doubleRoulettePlaceBet = useCallback(
    async (lobbyId: string, amount: number, bonusId: string): Promise<{ ok: boolean; error?: string }> => {
      if (isSupabaseConfigured && supabase && latestUserRef.current) {
        try {
          const { data, error } = await supabase.rpc("nodbet_double_place_bet", {
            p_lobby_id: lobbyId,
            p_bet_amount: Math.round(amount),
            p_selected_bonus_id: bonusId,
          });
          if (error) return { ok: false, error: "Ошибка сервера при фиксации ставки" };
          if (!data?.ok) return { ok: false, error: (data as { error?: string })?.error || "Ошибка списания ставки" };
          setState((prev) => ({
            ...prev,
            balance: Number((data as { balance?: number }).balance ?? prev.balance),
            xp: Number((data as { xp?: number }).xp ?? prev.xp),
          }));
          return { ok: true };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }
      return doubleRouletteDeduct(amount);
    },
    [doubleRouletteDeduct]
  );

  // ---------- Магазин ----------
  const buyPerk = useCallback(
    async (perkId: NodbetPerkId): Promise<{ ok: boolean; error?: string }> => {
      const perk = NODBET_PERKS.find((p) => p.id === perkId);
      if (!perk) return { ok: false, error: "Привилегия не найдена" };
      if (state.balance < perk.cost) {
        return { ok: false, error: `Недостаточно монет! Требуется ${perk.cost.toLocaleString()} NOD.` };
      }

      const owned =
        (perkId === "radar" && state.inventory.radarUnlocked) ||
        (perkId === "hall_frame" && state.inventory.hallFrame) ||
        (perkId === "crown_badge" && state.inventory.crownBadge) ||
        (perkId === "custom_status" && state.inventory.customStatusOwned) ||
        (perkId === "coin_magnet" && state.inventory.coinMagnet) ||
        (perkId === "star_trail" && state.inventory.starTrail) ||
        (perkId === "aura" && state.inventory.auraOwned) ||
        (perkId === "multi_bet" && state.inventory.multiBet);
      if (owned) return { ok: false, error: "Эта привилегия у вас уже есть!" };

      // Server-authoritative: покупку и списание проводит сервер.
      if (isSupabaseConfigured && supabase && latestUserRef.current) {
        try {
          const { data, error } = await supabase.rpc("nodbet_buy_perk", { p_perk_id: perkId });
          if (error) return { ok: false, error: "Ошибка сервера при покупке" };
          if (!data?.ok) return { ok: false, error: (data as { error?: string })?.error || "Ошибка покупки" };
          setState((prev) => ({
            ...prev,
            balance: Number((data as { balance?: number }).balance ?? prev.balance),
            xp: Number((data as { xp?: number }).xp ?? prev.xp),
            inventory: {
              ...prev.inventory,
              radarUnlocked: perkId === "radar" ? true : prev.inventory.radarUnlocked,
              hallFrame: perkId === "hall_frame" ? true : prev.inventory.hallFrame,
              crownBadge: perkId === "crown_badge" ? true : prev.inventory.crownBadge,
              customStatusOwned: perkId === "custom_status" ? true : prev.inventory.customStatusOwned,
              coinMagnet: perkId === "coin_magnet" ? true : prev.inventory.coinMagnet,
              starTrail: perkId === "star_trail" ? true : prev.inventory.starTrail,
              auraOwned: perkId === "aura" ? true : prev.inventory.auraOwned,
              multiBet: perkId === "multi_bet" ? true : prev.inventory.multiBet,
            },
          }));
          return { ok: true };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      setState((prev) => ({
        ...prev,
        balance: prev.balance - perk.cost,
        xp: prev.xp + 500,
        inventory: {
          ...prev.inventory,
          radarUnlocked: perkId === "radar" ? true : prev.inventory.radarUnlocked,
          hallFrame: perkId === "hall_frame" ? true : prev.inventory.hallFrame,
          crownBadge: perkId === "crown_badge" ? true : prev.inventory.crownBadge,
          customStatusOwned: perkId === "custom_status" ? true : prev.inventory.customStatusOwned,
          coinMagnet: perkId === "coin_magnet" ? true : prev.inventory.coinMagnet,
          starTrail: perkId === "star_trail" ? true : prev.inventory.starTrail,
          auraOwned: perkId === "aura" ? true : prev.inventory.auraOwned,
          multiBet: perkId === "multi_bet" ? true : prev.inventory.multiBet,
        },
      }));

      return { ok: true };
    },
    [state.balance, state.inventory]
  );

  // ---------- Топ Хайроллеров ----------
  const highRollers = useMemo<HighRoller[]>(() => {
    const totalWonOfLocal = (bets: NodbetBet[], spins: RouletteSpin[]) =>
      bets.filter((b) => b.status === "won").reduce((acc, b) => acc + b.payout, 0) +
      spins.filter((spin) => spin.wonCoins > 0).reduce((acc, spin) => acc + spin.wonCoins, 0);

    if (isSupabaseConfigured) {
      const rows: HighRoller[] = profiles.map((p) => ({
        id: p.user_id,
        nickname: p.nickname || fruitNickname(p.user_id),
        balance: Number(p.balance) || 0,
        totalWon: Number(p.total_won) || 0,
        betsCount: Number(p.bets_count) || 0,
        level: levelFromXp(Number(p.xp) || 0),
        customStatus: p.custom_status_owned ? p.custom_status_text : null,
        hallFrame: !!p.hall_frame,
        crownBadge: !!p.crown_badge,
        starTrail: !!p.star_trail,
        auraOwned: !!p.aura_owned,
        auraColor: typeof p.aura_color === "string" ? p.aura_color : null,
        auraEnabled: (p as any).aura_enabled !== false,
        isCurrentUser: !!user && p.user_id === user.id,
      }));

      const selfRow: HighRoller = {
        id: user ? user.id : "current_user_hr",
        nickname: displayNickname,
        balance: state.balance,
        totalWon: totalWonOfLocal(state.bets, state.rouletteHistory),
        betsCount: state.bets.length + state.rouletteHistory.length,
        level,
        customStatus: state.inventory.customStatusOwned ? state.inventory.customStatusText : null,
        hallFrame: state.inventory.hallFrame,
        crownBadge: state.inventory.crownBadge,
        starTrail: state.inventory.starTrail,
        auraOwned: state.inventory.auraOwned,
        auraColor: state.inventory.auraOwned ? state.inventory.auraColor : null,
        auraEnabled: state.inventory.auraEnabled,
        isCurrentUser: true,
      };

      if (!user) rows.push(selfRow);
      else if (myProfile === undefined) rows.push(selfRow);

      return rows.sort((a, b) => b.balance - a.balance);
    }

    const list: HighRoller[] = [
      { id: "hr_1", nickname: "rezo1n", balance: 84_500_000, totalWon: 210_000_000, betsCount: 42, level: 640, crownBadge: true, hallFrame: true, starTrail: true },
      { id: "hr_2", nickname: "dony_zq", balance: 67_200_000, totalWon: 185_000_000, betsCount: 38, level: 590, hallFrame: true, auraOwned: true, auraColor: "purple", auraEnabled: true },
      { id: "hr_3", nickname: "CyberClutch_99", balance: 52_100_000, totalWon: 140_000_000, betsCount: 29, level: 520 },
      { id: "hr_4", nickname: "Stalk_Aimer", balance: 41_800_000, totalWon: 98_000_000, betsCount: 21, level: 470 },
      { id: "hr_5", nickname: "ShokeFan_2026", balance: 36_400_000, totalWon: 85_000_000, betsCount: 19, level: 430 },
      { id: "hr_6", nickname: "awp_god_rush", balance: 29_500_000, totalWon: 64_000_000, betsCount: 15, level: 380 },
    ];

    const myItem: HighRoller = {
      id: "current_user_hr",
      nickname: displayNickname,
      balance: state.balance,
      totalWon: totalWonOfLocal(state.bets, state.rouletteHistory),
      betsCount: state.bets.length + state.rouletteHistory.length,
      level,
      customStatus: state.inventory.customStatusOwned ? state.inventory.customStatusText : null,
      hallFrame: state.inventory.hallFrame,
      crownBadge: state.inventory.crownBadge,
      starTrail: state.inventory.starTrail,
      auraOwned: state.inventory.auraOwned,
      auraColor: state.inventory.auraOwned ? state.inventory.auraColor : null,
      auraEnabled: state.inventory.auraEnabled,
      isCurrentUser: true,
    };

    return [...list, myItem].sort((a, b) => b.balance - a.balance);
  }, [profiles, user, myProfile, displayNickname, state.balance, state.bets, state.rouletteHistory, state.inventory, level]);

  const maxCustomBet = state.inventory.multiBet ? 1_000_000 : 500_000;

  const value = useMemo<NodbetContextValue>(
    () => ({
      balance: state.balance,
      xp: state.xp,
      level,
      levelProgress: lvlProgress,
      levelTitle,
      dailyBonusAvailable,
      inventory: state.inventory,
      bets: state.bets,
      rouletteHistory: state.rouletteHistory,
      highRollers,
      nickname,
      displayNickname,
      hasCustomNickname,
      setProfileNickname,
      setCustomStatus,
      setAuraColor,
      setAuraEnabled,
      placeBet,
      cancelBet,
      spinRoulette,
      commitSpin,
      buyPerk,
      claimDailyBonus,
      activatePromoCode,
      hasRadar: state.inventory.radarUnlocked,
      maxCustomBet,
      doubleRouletteDeduct,
      doubleRoulettePayout,
      doubleRoulettePlaceBet,
      refreshOwnProfile,
    }),
    [
      state.balance,
      state.xp,
      level,
      lvlProgress,
      levelTitle,
      dailyBonusAvailable,
      state.inventory,
      state.bets,
      state.rouletteHistory,
      highRollers,
      nickname,
      displayNickname,
      hasCustomNickname,
      setProfileNickname,
      setCustomStatus,
      setAuraColor,
      setAuraEnabled,
      placeBet,
      cancelBet,
      spinRoulette,
      commitSpin,
      buyPerk,
      claimDailyBonus,
      activatePromoCode,
      maxCustomBet,
      doubleRouletteDeduct,
      doubleRoulettePayout,
      doubleRoulettePlaceBet,
      refreshOwnProfile,
    ]
  );

  return <NodbetContext.Provider value={value}>{children}</NodbetContext.Provider>;
}

export function useNodbet() {
  const ctx = useContext(NodbetContext);
  if (!ctx) throw new Error("useNodbet must be used within NodbetProvider");
  return ctx;
}
