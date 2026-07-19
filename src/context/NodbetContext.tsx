import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useData } from "./DataContext";
import { useUserAuth } from "./UserAuthContext";
import { computeOdds } from "../utils/odds";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { fruitNickname, validateNickname } from "../utils/nickname";

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

interface NodbetState {
  balance: number;
  xp: number;
  lastDailyClaim: string | null;
  inventory: NodbetInventory;
  bets: NodbetBet[];
  rouletteHistory: RouletteSpin[];
}

// Строка таблицы nodbet_profiles в Supabase
interface NodbetProfileRow {
  user_id: string;
  nickname: string | null;
  balance: number;
  xp: number;
  last_daily_claim: string | null;
  vip_boost_x3: boolean;
  insurance_count: number;
  double_win_count: number;
  radar_unlocked: boolean;
  gold_badge: boolean;
  total_won: number | string;
  bets_count: number;
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
  // Никнейм профиля
  nickname: string | null; // собственный ник (null = временный «фруктовый»)
  displayNickname: string; // что реально показывается (ник или фрукт)
  hasCustomNickname: boolean;
  setProfileNickname: (raw: string) => Promise<{ ok: boolean; error?: string }>;
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
const LOCAL_NICKNAMES_KEY = "njdc_nodbet_nicknames_v1";
const GUEST_ID = "guest_high_roller";

function getInitialState(userId: string): NodbetState {
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
        rouletteHistory: Array.isArray(parsed.rouletteHistory) ? (parsed.rouletteHistory as RouletteSpin[]) : demoSpins(),
      };
    }
  } catch {
    /* ignore */
  }

  return {
    balance: 10000, // Starter bonus for NJDC 2026 fans
    xp: 500,
    lastDailyClaim: null,
    inventory: {
      vipBoostX3: false,
      insuranceCount: 1, // Free starter insurance!
      doubleWinCount: 1, // Free starter booster!
      radarUnlocked: false,
      goldBadge: false,
    },
    bets: [],
    rouletteHistory: demoSpins(),
  };
}

function demoSpins(): RouletteSpin[] {
  return [
    { id: "s1", label: "🔴 Красно (x2)", color: "red", multiplier: 2, wonCoins: 2000, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "s2", label: "⚫ Черно (x1.5)", color: "black", multiplier: 1.5, wonCoins: 750, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "s3", label: "🟢 ДЖЕКПОТ (x5)", color: "green", multiplier: 5, wonCoins: 5000, bonusText: "+5,000 NOD", createdAt: new Date(Date.now() - 14400000).toISOString() },
  ];
}

// ---------- Локальное хранилище никнеймов (для режима без Supabase / гостя) ----------

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

// ---------- Мэпперы строк Supabase ----------

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
    teamChoice: String(row.team_choice ?? ""),
    teamName: String(row.team_name ?? ""),
    amount: Number(row.amount) || 0,
    odds: Number(row.odds) || 1,
    status: (row.status as NodbetBet["status"]) || "pending",
    createdAt: normalizeDate(row.created_at as string) || new Date().toISOString(),
    usedInsurance: !!row.used_insurance,
    usedDoubleWin: !!row.used_double_win,
    payout: Number(row.payout) || 0,
  };
}

function betToRow(userId: string, b: NodbetBet) {
  return {
    user_id: userId,
    id: b.id,
    match_id: b.matchId,
    match_title: b.matchTitle,
    team_choice: b.teamChoice,
    team_name: b.teamName,
    amount: b.amount,
    odds: b.odds,
    status: b.status,
    used_insurance: b.usedInsurance,
    used_double_win: b.usedDoubleWin,
    payout: b.payout,
    created_at: b.createdAt,
  };
}

function spinFromRow(row: Record<string, unknown>): RouletteSpin {
  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    color: (row.color as RouletteSpin["color"]) || "red",
    multiplier: Number(row.multiplier) || 1,
    bonusText: row.bonus_text ? String(row.bonus_text) : undefined,
    wonCoins: Number(row.won_coins) || 0,
    createdAt: normalizeDate(row.created_at as string) || new Date().toISOString(),
  };
}

function spinToRow(userId: string, s: Omit<RouletteSpin, "bonusText"> & { bonusText?: string | null }) {
  return {
    user_id: userId,
    id: s.id,
    label: s.label,
    color: s.color,
    multiplier: s.multiplier,
    bonus_text: s.bonusText ?? null,
    won_coins: s.wonCoins,
    created_at: s.createdAt,
  };
}

/**
 * Канонический «снимок» состояния со стабильным порядком ключей —
 * используется, чтобы сравнивать локальное состояние с тем, что уже
 * уехало в Supabase (иначе realtime-эхо уйдёт в бесконечный цикл).
 */
function stateSnapshot(s: NodbetState) {
  return {
    balance: s.balance,
    xp: s.xp,
    lastDailyClaim: s.lastDailyClaim,
    inventory: {
      vipBoostX3: s.inventory.vipBoostX3,
      insuranceCount: s.inventory.insuranceCount,
      doubleWinCount: s.inventory.doubleWinCount,
      radarUnlocked: s.inventory.radarUnlocked,
      goldBadge: s.inventory.goldBadge,
    },
    bets: s.bets.map((b) => ({
      id: b.id,
      matchId: b.matchId,
      matchTitle: b.matchTitle,
      teamChoice: b.teamChoice,
      teamName: b.teamName,
      amount: b.amount,
      odds: b.odds,
      status: b.status,
      createdAt: b.createdAt,
      usedInsurance: b.usedInsurance,
      usedDoubleWin: b.usedDoubleWin,
      payout: b.payout,
    })),
    rouletteHistory: s.rouletteHistory.map((sp) => ({
      id: sp.id,
      label: sp.label,
      color: sp.color,
      multiplier: sp.multiplier,
      bonusText: sp.bonusText ?? null,
      wonCoins: sp.wonCoins,
      createdAt: sp.createdAt,
    })),
  };
}

const NodbetContext = createContext<NodbetContextValue | null>(null);

export function NodbetProvider({ children }: { children: ReactNode }) {
  const { user } = useUserAuth();
  const { matches } = useData();
  const userId = user ? user.id : GUEST_ID;

  const [state, setState] = useState<NodbetState>(() => getInitialState(userId));
  const [profiles, setProfiles] = useState<NodbetProfileRow[]>([]);
  const [localNicknames, setLocalNicknames] = useState<Record<string, string>>(() => loadLocalNicknames());

  // Служебные флаги синхронизации
  const hydratedRef = useRef(false); // загрузили ли состояние из Supabase для текущего юзера
  const lastSyncedRef = useRef("{}"); // последний снимок, который знает сервер
  const pendingSyncRef = useRef(false); // идёт ли отложенная отправка локальных изменений

  // Save to localStorage on change (офлайн-кэш в любом режиме)
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(state));
  }, [state, userId]);

  // ---------- Загрузка из Supabase ----------

  // Публичный список профилей = «Топ Хайроллеров» (никнеймы + цифры, без почт!)
  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data, error } = await supabase.from("nodbet_profiles").select("*").order("balance", { ascending: false }).limit(500);
    if (error) {
      console.error("[NODBET] Не удалось загрузить топ хайроллеров", error);
      return;
    }
    if (data) setProfiles(data as NodbetProfileRow[]);
  }, []);

  // Полная загрузка данных текущего пользователя (профиль + ставки + спины)
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
        // Первый запуск при подключённой базе: переносим локальный прогресс в Supabase
        const local = getInitialState(uid);
        const totalWon = local.bets.filter((b) => b.status === "won").reduce((a, b) => a + b.payout, 0) + local.balance;
        const initialNickname = loadLocalNicknames()[uid] ?? null;
        const profilePayload = {
          user_id: uid,
          balance: local.balance,
          xp: local.xp,
          last_daily_claim: local.lastDailyClaim,
          vip_boost_x3: local.inventory.vipBoostX3,
          insurance_count: local.inventory.insuranceCount,
          double_win_count: local.inventory.doubleWinCount,
          radar_unlocked: local.inventory.radarUnlocked,
          gold_badge: local.inventory.goldBadge,
          total_won: totalWon,
          bets_count: local.bets.length + local.rouletteHistory.length,
        };
        let { error: createErr } = await supabase.from("nodbet_profiles").upsert({ ...profilePayload, nickname: initialNickname });
        if (createErr && createErr.code === "23505") {
          // Такой ник уже занят — переносим профиль без него (временный фруктовый)
          const retry = await supabase.from("nodbet_profiles").upsert(profilePayload);
          createErr = retry.error;
        }
        if (createErr) {
          console.error("[NODBET] Не удалось создать профиль в Supabase", createErr);
          return;
        }
        if (local.bets.length) await supabase.from("nodbet_bets").upsert(local.bets.map((b) => betToRow(uid, b)));
        if (local.rouletteHistory.length) await supabase.from("nodbet_roulette_spins").upsert(local.rouletteHistory.map((s) => spinToRow(uid, s)));
        lastSyncedRef.current = JSON.stringify(stateSnapshot(local));
        setState(local);
        await loadProfiles();
        return;
      }

      const p = ownRes.data as NodbetProfileRow;
      const serverState: NodbetState = {
        balance: Number(p.balance) || 0,
        xp: Number(p.xp) || 0,
        lastDailyClaim: normalizeDate(p.last_daily_claim),
        inventory: {
          vipBoostX3: !!p.vip_boost_x3,
          insuranceCount: Number(p.insurance_count) || 0,
          doubleWinCount: Number(p.double_win_count) || 0,
          radarUnlocked: !!p.radar_unlocked,
          goldBadge: !!p.gold_badge,
        },
        bets: (betsRes.data ?? []).map((r) => betFromRow(r as Record<string, unknown>)),
        rouletteHistory: (spinsRes.data ?? []).map((r) => spinFromRow(r as Record<string, unknown>)),
      };
      const snap = JSON.stringify(stateSnapshot(serverState));
      lastSyncedRef.current = snap;
      setState((prev) => (JSON.stringify(stateSnapshot(prev)) === snap ? prev : serverState));
    },
    [loadProfiles]
  );

  // Переключение пользователя: локальный режим или подхват из Supabase
  useEffect(() => {
    hydratedRef.current = false;
    pendingSyncRef.current = false;
    lastSyncedRef.current = "{}";

    if (isSupabaseConfigured && supabase) {
      loadProfiles();
      if (user) {
        // Показываем локальный кэш, пока база отвечает
        setState(getInitialState(user.id));
        loadOwnData(user.id)
          .catch((e) => console.error("[NODBET] Supabase load failed", e))
          .finally(() => {
            hydratedRef.current = true;
          });
      } else {
        setState(getInitialState(GUEST_ID));
      }
    } else {
      setProfiles([]);
      setState(getInitialState(userId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- Realtime-подписки (как у остальных таблиц сайта) ----------

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const uid = user?.id ?? null;
    const channel = client
      .channel("njdc-nodbet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_profiles" }, () => {
        // Любое изменение профилей → обновляем топ хайроллеров у всех онлайн
        loadProfiles();
        // Если изменили НАШ профиль с другого устройства — подхватываем,
        // но только если сейчас нет неотправленных локальных изменений.
        if (uid && !pendingSyncRef.current) loadOwnData(uid);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_bets" }, () => {
        if (uid && !pendingSyncRef.current) loadOwnData(uid);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_roulette_spins" }, () => {
        if (uid && !pendingSyncRef.current) loadOwnData(uid);
      })
      .subscribe((status) => {
        console.log("[NODBET Realtime] subscription status:", status);
      });
    return () => {
      client.removeChannel(channel);
    };
  }, [user?.id, loadProfiles, loadOwnData]);

  // ---------- Отложенная синхронизация локальных изменений в Supabase ----------

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user || !hydratedRef.current) return;
    const client = supabase;
    const snapshot = stateSnapshot(state);
    const snapJson = JSON.stringify(snapshot);
    if (snapJson === lastSyncedRef.current) return;

    const uid = user.id;
    pendingSyncRef.current = true;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const prevSync: ReturnType<typeof stateSnapshot> | null = (() => {
            try {
              return JSON.parse(lastSyncedRef.current);
            } catch {
              return null;
            }
          })();

          const totalWon = snapshot.bets.filter((b) => b.status === "won").reduce((a, b) => a + b.payout, 0) + snapshot.balance;
          const betsCount = snapshot.bets.length + snapshot.rouletteHistory.length;

          const { error: profileErr } = await client.from("nodbet_profiles").upsert({
            user_id: uid,
            balance: snapshot.balance,
            xp: snapshot.xp,
            last_daily_claim: snapshot.lastDailyClaim,
            vip_boost_x3: snapshot.inventory.vipBoostX3,
            insurance_count: snapshot.inventory.insuranceCount,
            double_win_count: snapshot.inventory.doubleWinCount,
            radar_unlocked: snapshot.inventory.radarUnlocked,
            gold_badge: snapshot.inventory.goldBadge,
            total_won: totalWon,
            bets_count: betsCount,
          });
          if (profileErr) throw profileErr;

          // Ставки и спины отправляем только если их списки реально изменились
          if (!prevSync || JSON.stringify(prevSync.bets) !== JSON.stringify(snapshot.bets)) {
            if (snapshot.bets.length) {
              const { error: betsErr } = await client.from("nodbet_bets").upsert(snapshot.bets.map((b) => betToRow(uid, b)));
              if (betsErr) throw betsErr;
            }
          }
          if (!prevSync || JSON.stringify(prevSync.rouletteHistory) !== JSON.stringify(snapshot.rouletteHistory)) {
            if (snapshot.rouletteHistory.length) {
              const { error: spinsErr } = await client
                .from("nodbet_roulette_spins")
                .upsert(snapshot.rouletteHistory.map((s) => spinToRow(uid, s)));
              if (spinsErr) throw spinsErr;
            }
          }

          lastSyncedRef.current = snapJson;
        } catch (e) {
          console.error("[NODBET] Не удалось синхронизировать с Supabase", e);
        } finally {
          pendingSyncRef.current = false;
        }
      })();
    }, 700);

    return () => clearTimeout(timer);
  }, [state, user]);

  // ---------- Авто-расчёт ставок по завершённым матчам ----------

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

  // ---------- Никнейм пользователя ----------

  const myProfile = useMemo(() => (user ? profiles.find((p) => p.user_id === user.id) : undefined), [profiles, user]);
  const nickname: string | null = myProfile?.nickname || localNicknames[userId] || null;
  const displayNickname = nickname || fruitNickname(userId);
  const hasCustomNickname = Boolean(nickname);

  const setProfileNickname = useCallback(
    async (raw: string): Promise<{ ok: boolean; error?: string }> => {
      const check = validateNickname(raw);
      if (!check.ok || !check.clean) return { ok: false, error: check.error };
      const clean = check.clean;

      // Режим с базой: сохраняем в Supabase (уникальность — на уровне БД)
      if (isSupabaseConfigured && supabase && user) {
        const { error } = await supabase.from("nodbet_profiles").upsert({ user_id: user.id, nickname: clean });
        if (error) {
          if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
            return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
          }
          console.error("[NODBET] Ошибка сохранения никнейма", error);
          return { ok: false, error: "Не удалось сохранить никнейм. Попробуйте ещё раз." };
        }
        // Оптимистично обновляем локальный список (realtime подтвердит)
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
              vip_boost_x3: state.inventory.vipBoostX3,
              insurance_count: state.inventory.insuranceCount,
              double_win_count: state.inventory.doubleWinCount,
              radar_unlocked: state.inventory.radarUnlocked,
              gold_badge: state.inventory.goldBadge,
              total_won: 0,
              bets_count: 0,
            },
          ];
        });
        return { ok: true };
      }

      // Локальный режим (без Supabase или для гостя)
      const taken = Object.entries(localNicknames).some(([id, n]) => id !== userId && n.toLowerCase() === clean.toLowerCase());
      if (taken) return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
      const next = { ...localNicknames, [userId]: clean };
      saveLocalNicknames(next);
      setLocalNicknames(next);
      return { ok: true };
    },
    [user, userId, localNicknames, state]
  );

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

  // ---------- Топ Хайроллеров ----------

  const highRollers = useMemo<HighRoller[]>(() => {
    const totalWonOf = (bets: NodbetBet[], bal: number) =>
      bets.filter((b) => b.status === "won").reduce((acc, b) => acc + b.payout, 0) + bal;

    if (isSupabaseConfigured) {
      // Все реальные пользователи из базы (БЕЗ почт — только никнеймы!)
      const rows: HighRoller[] = profiles.map((p) => ({
        id: p.user_id,
        nickname: p.nickname || fruitNickname(p.user_id),
        balance: Number(p.balance) || 0,
        totalWon: Number(p.total_won) || 0,
        betsCount: Number(p.bets_count) || 0,
        isCurrentUser: !!user && p.user_id === user.id,
        badge: p.gold_badge ? "✨ NODBET PRO" : p.vip_boost_x3 ? "👑 VIP x3" : undefined,
      }));

      // Гость видит в топе и свою локальную строку
      if (!user) {
        rows.push({
          id: "current_user_hr",
          nickname: displayNickname,
          balance: state.balance,
          totalWon: totalWonOf(state.bets, state.balance),
          betsCount: state.bets.length + state.rouletteHistory.length,
          isCurrentUser: true,
          badge: state.inventory.goldBadge ? "✨ NODBET PRO" : state.inventory.vipBoostX3 ? "👑 VIP x3" : undefined,
        });
      } else if (myProfile === undefined) {
        // Профиль ещё не попал в список (грузится) — покажем себя по локальным данным
        rows.push({
          id: user.id,
          nickname: displayNickname,
          balance: state.balance,
          totalWon: totalWonOf(state.bets, state.balance),
          betsCount: state.bets.length + state.rouletteHistory.length,
          isCurrentUser: true,
          badge: state.inventory.goldBadge ? "✨ NODBET PRO" : state.inventory.vipBoostX3 ? "👑 VIP x3" : undefined,
        });
      }

      return rows.sort((a, b) => b.balance - a.balance);
    }

    // Локальный режим без базы — демо-соперники, как раньше
    const list: HighRoller[] = [
      { id: "hr_1", nickname: "rezo1n (Captain)", balance: 84500, totalWon: 210000, betsCount: 42, badge: "✨ NODBET PRO" },
      { id: "hr_2", nickname: "dony_zq", balance: 67200, totalWon: 185000, betsCount: 38, badge: "👑 VIP x3" },
      { id: "hr_3", nickname: "CyberClutch_99", balance: 52100, totalWon: 140000, betsCount: 29, badge: "👑 VIP x3" },
      { id: "hr_4", nickname: "Stalk_Aimer", balance: 41800, totalWon: 98000, betsCount: 21 },
      { id: "hr_5", nickname: "ShokeFan_2026", balance: 36400, totalWon: 85000, betsCount: 19 },
      { id: "hr_6", nickname: "awp_god_rush", balance: 29500, totalWon: 64000, betsCount: 15 },
    ];

    const myItem: HighRoller = {
      id: "current_user_hr",
      nickname: displayNickname,
      balance: state.balance,
      totalWon: totalWonOf(state.bets, state.balance),
      betsCount: state.bets.length + state.rouletteHistory.length,
      isCurrentUser: true,
      badge: state.inventory.goldBadge ? "✨ NODBET PRO" : state.inventory.vipBoostX3 ? "👑 VIP x3" : undefined,
    };

    return [...list, myItem].sort((a, b) => b.balance - a.balance);
  }, [profiles, user, myProfile, displayNickname, state.balance, state.bets, state.rouletteHistory, state.inventory]);

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
      nickname,
      displayNickname,
      hasCustomNickname,
      setProfileNickname,
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
      nickname,
      displayNickname,
      hasCustomNickname,
      setProfileNickname,
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
