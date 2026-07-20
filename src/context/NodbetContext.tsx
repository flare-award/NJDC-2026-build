import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useData } from "./DataContext";
import { useUserAuth } from "./UserAuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { fruitNickname, validateNickname } from "../utils/nickname";
import { levelFromXp, levelProgress, levelTitleFor, type LevelProgress } from "../utils/levels";
import {
  BONUSES,
  buildWheelSectors,
  computeSpinResult,
  emptyStreak,
  pickBonus,
  updateStreak,
  type BonusId,
  type StreakMap,
} from "../utils/roulette";
import { normalizeMaps, mapWinner, mapPlayed, mapHadOvertime, maxMapCount, relevantMapCount } from "../utils/matchMaps";

// ============================================================
// Привилегии магазина (пункт 17)
// Всё ЧЕСТНОЕ, без читерских бустов голосов/страховок/удвоений.
// Цены — от 2,5 млн до 10 млрд.
// ============================================================
export interface NodbetPerk {
  id: "radar" | "custom_status" | "double_spin" | "hall_frame" | "coin_magnet";
  name: string;
  description: string;
  cost: number;
  icon: string;
  badge: string;
  oneTime: boolean; // покупается один раз навсегда
}

export const NODBET_PERKS: NodbetPerk[] = [
  {
    id: "radar",
    name: "⚡ Инсайдерский AI-Радар NODBET",
    description:
      "Открывает доступ к аналитике матчей: реальные шансы команд на победу по статистике составов, вероятность клатча 1v2 и вердикт AI на страницах матчей NJDC 2026.",
    cost: 2_500_000,
    icon: "⚡",
    badge: "AI РАДАР",
    oneTime: true,
  },
  {
    id: "hall_frame",
    name: "🖼️ Рамка Зала Славы",
    description:
      "Косметическая золотая рамка вокруг вашей строки в Топе Хайроллеров. Чисто визуальное отличие — на игру и голосования не влияет.",
    cost: 12_000_000,
    icon: "🖼️",
    badge: "ЗОЛОТАЯ РАМКА",
    oneTime: true,
  },
  {
    id: "custom_status",
    name: "🏷️ Собственный статус",
    description:
      "Позволяет придумать свой личный статус (текст), который отображается рядом с ником в Топе Хайроллеров. Косметика, никаких игровых преимуществ.",
    cost: 67_000_000,
    icon: "🏷️",
    badge: "СВОЙ СТАТУС",
    oneTime: true,
  },
  {
    id: "double_spin",
    name: "🎡 Дабл спин",
    description:
      "Разблокирует режим двойного вращения рулетки: колесо крутится два раза подряд, и вы можете выбить два разных бонуса за один заход.",
    cost: 105_000_000,
    icon: "🎡",
    badge: "DOUBLE SPIN",
    oneTime: true,
  },
  {
    id: "coin_magnet",
    name: "🧲 Мультипас Хайроллера",
    description:
      "Элитный пожизненный пропуск: +10% XP за все действия в NODBET (быстрее качается уровень). На баланс, шансы и голосования не влияет — честный ускоритель прогресса.",
    cost: 10_000_000_000,
    icon: "🧲",
    badge: "PRESTIGE PASS",
    oneTime: true,
  },
];

export interface NodbetBet {
  id: string;
  matchId: string;
  matchTitle: string;
  mapIndex: number; // на какую карту матча сделана ставка (Bo2/Bo3)
  teamChoice: string; // team id
  teamName: string;
  amount: number;
  odds: number;
  overtimePrediction: boolean; // прогноз игрока: будет ли овертайм на карте (пункт 6)
  status: "pending" | "won" | "lost" | "refunded";
  createdAt: string;
  payout: number;
}

export interface RouletteSpin {
  id: string;
  bonusId: BonusId;
  label: string;
  multiplier: number;
  wonCoins: number; // изменение баланса (может быть отрицательным)
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
  isCurrentUser?: boolean;
}

interface NodbetInventory {
  radarUnlocked: boolean;
  doubleSpin: boolean;
  hallFrame: boolean;
  customStatusOwned: boolean;
  coinMagnet: boolean;
  customStatusText: string | null;
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

// Строка таблицы nodbet_profiles в Supabase
interface NodbetProfileRow {
  user_id: string;
  nickname: string | null;
  balance: number;
  xp: number;
  last_daily_claim: string | null;
  radar_unlocked: boolean;
  double_spin: boolean;
  hall_frame: boolean;
  custom_status_owned: boolean;
  coin_magnet: boolean;
  custom_status_text: string | null;
  total_won: number | string;
  bets_count: number;
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
  // Никнейм профиля
  nickname: string | null;
  displayNickname: string;
  hasCustomNickname: boolean;
  setProfileNickname: (raw: string) => Promise<{ ok: boolean; error?: string }>;
  setCustomStatus: (raw: string) => { ok: boolean; error?: string };
  // Actions
  placeBet: (
    matchId: string,
    mapIndex: number,
    teamChoice: string,
    teamName: string,
    amount: number,
    overtimePrediction: boolean
  ) => { ok: boolean; error?: string };
  spinRoulette: (betAmount: number) => { ok: boolean; results: RouletteSpin[]; error?: string };
  buyPerk: (perkId: NodbetPerk["id"]) => { ok: boolean; error?: string };
  claimDailyBonus: () => { ok: boolean; error?: string };
  // Helpers
  hasRadar: boolean;
  hasDoubleSpin: boolean;
}

const LOCAL_STORAGE_PREFIX = "njdc_nodbet_state_v3_";
const LOCAL_NICKNAMES_KEY = "njdc_nodbet_nicknames_v1";
const GUEST_ID = "guest_high_roller";
const STARTING_BALANCE = 10000;
const STARTING_XP = 0;

function emptyInventory(): NodbetInventory {
  return {
    radarUnlocked: false,
    doubleSpin: false,
    hallFrame: false,
    customStatusOwned: false,
    coinMagnet: false,
    customStatusText: null,
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
          doubleSpin: !!parsed.inventory?.doubleSpin,
          hallFrame: !!parsed.inventory?.hallFrame,
          customStatusOwned: !!parsed.inventory?.customStatusOwned,
          coinMagnet: !!parsed.inventory?.coinMagnet,
          customStatusText: parsed.inventory?.customStatusText ?? null,
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

// ---------- Локальное хранилище никнеймов ----------

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
    mapIndex: Number(row.map_index) || 0,
    teamChoice: String(row.team_choice ?? ""),
    teamName: String(row.team_name ?? ""),
    amount: Number(row.amount) || 0,
    odds: Number(row.odds) || 1,
    overtimePrediction: !!row.overtime_prediction,
    status: (row.status as NodbetBet["status"]) || "pending",
    createdAt: normalizeDate(row.created_at as string) || new Date().toISOString(),
    payout: Number(row.payout) || 0,
  };
}

function betToRow(userId: string, b: NodbetBet) {
  return {
    user_id: userId,
    id: b.id,
    match_id: b.matchId,
    match_title: b.matchTitle,
    map_index: b.mapIndex,
    team_choice: b.teamChoice,
    team_name: b.teamName,
    amount: b.amount,
    odds: b.odds,
    overtime_prediction: b.overtimePrediction,
    status: b.status,
    payout: b.payout,
    created_at: b.createdAt,
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
    createdAt: normalizeDate(row.created_at as string) || new Date().toISOString(),
  };
}

function spinToRow(userId: string, s: RouletteSpin) {
  return {
    user_id: userId,
    id: s.id,
    bonus_id: s.bonusId,
    label: s.label,
    multiplier: s.multiplier,
    won_coins: s.wonCoins,
    is_negative: s.isNegative,
    created_at: s.createdAt,
  };
}

function stateSnapshot(s: NodbetState) {
  return {
    balance: s.balance,
    xp: s.xp,
    lastDailyClaim: s.lastDailyClaim,
    inventory: { ...s.inventory },
    bets: s.bets.map((b) => ({ ...b })),
    rouletteHistory: s.rouletteHistory.map((sp) => ({ ...sp })),
    streak: { ...s.streak },
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

  const hydratedRef = useRef(false);
  const lastSyncedRef = useRef("{}");
  const pendingSyncRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(state));
  }, [state, userId]);

  // ---------- Загрузка из Supabase ----------

  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data, error } = await supabase.from("nodbet_profiles").select("*").order("balance", { ascending: false }).limit(500);
    if (error) {
      console.error("[NODBET] Не удалось загрузить топ хайроллеров", error);
      return;
    }
    if (data) setProfiles(data as NodbetProfileRow[]);
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
        const local = getInitialState(uid);
        const totalWon = local.balance;
        const initialNickname = loadLocalNicknames()[uid] ?? null;
        const profilePayload = {
          user_id: uid,
          balance: local.balance,
          xp: local.xp,
          last_daily_claim: local.lastDailyClaim,
          radar_unlocked: local.inventory.radarUnlocked,
          double_spin: local.inventory.doubleSpin,
          hall_frame: local.inventory.hallFrame,
          custom_status_owned: local.inventory.customStatusOwned,
          coin_magnet: local.inventory.coinMagnet,
          custom_status_text: local.inventory.customStatusText,
          total_won: totalWon,
          bets_count: local.bets.length + local.rouletteHistory.length,
        };
        let { error: createErr } = await supabase.from("nodbet_profiles").upsert({ ...profilePayload, nickname: initialNickname });
        if (createErr && createErr.code === "23505") {
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
          radarUnlocked: !!p.radar_unlocked,
          doubleSpin: !!p.double_spin,
          hallFrame: !!p.hall_frame,
          customStatusOwned: !!p.custom_status_owned,
          coinMagnet: !!p.coin_magnet,
          customStatusText: p.custom_status_text ?? null,
        },
        bets: (betsRes.data ?? []).map((r) => betFromRow(r as Record<string, unknown>)),
        rouletteHistory: (spinsRes.data ?? []).map((r) => spinFromRow(r as Record<string, unknown>)),
        streak: emptyStreak(),
      };
      const snap = JSON.stringify(stateSnapshot(serverState));
      lastSyncedRef.current = snap;
      setState((prev) => {
        // Сохраняем локальный streak (он клиентский, не хранится на сервере).
        const merged = { ...serverState, streak: prev.streak };
        return JSON.stringify(stateSnapshot(prev)) === JSON.stringify(stateSnapshot(merged)) ? prev : merged;
      });
    },
    [loadProfiles]
  );

  useEffect(() => {
    hydratedRef.current = false;
    pendingSyncRef.current = false;
    lastSyncedRef.current = "{}";

    if (isSupabaseConfigured && supabase) {
      loadProfiles();
      if (user) {
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

  // ---------- Realtime ----------

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const uid = user?.id ?? null;
    const channel = client
      .channel("njdc-nodbet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_profiles" }, () => {
        loadProfiles();
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

  // ---------- Отложенная синхронизация ----------

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
            radar_unlocked: snapshot.inventory.radarUnlocked,
            double_spin: snapshot.inventory.doubleSpin,
            hall_frame: snapshot.inventory.hallFrame,
            custom_status_owned: snapshot.inventory.customStatusOwned,
            coin_magnet: snapshot.inventory.coinMagnet,
            custom_status_text: snapshot.inventory.customStatusText,
            total_won: totalWon,
            bets_count: betsCount,
          });
          if (profileErr) throw profileErr;

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

  // ---------- Авто-расчёт ставок по завершённым матчам (пункты 6, 7) ----------

  useEffect(() => {
    setState((prev) => {
      let changed = false;
      let addedBalance = 0;
      let addedXp = 0;

      const nextBets = prev.bets.map((bet: NodbetBet) => {
        if (bet.status !== "pending") return bet;
        const match = matches.find((m) => m.id === bet.matchId);
        if (!match) return bet;

        // Ставка привязана к конкретной карте (Bo2/Bo3).
        const maps = normalizeMaps(match);
        const map = maps[bet.mapIndex];
        if (!map) return bet;

        // В Bo3 третья карта может не понадобиться (при 2:0). Если так —
        // ставки на неё возвращаем (карта не состоится).
        if (bet.mapIndex >= relevantMapCount(match)) {
          if (match.status === "finished") {
            changed = true;
            addedBalance += bet.amount;
            return { ...bet, status: "refunded" as const, payout: bet.amount };
          }
          return bet;
        }

        // Ждём, пока карта сыграна. Матч необязательно должен быть finished:
        // в Bo2/Bo3 карта 1 может завершиться раньше конца серии.
        const played = mapPlayed(map);
        if (!played) {
          // Если весь матч завершён, а карта так и не сыграна — возвращаем ставку.
          if (match.status === "finished") {
            changed = true;
            addedBalance += bet.amount;
            return { ...bet, status: "refunded" as const, payout: bet.amount };
          }
          return bet;
        }

        changed = true;
        const w = mapWinner(map); // 'a' | 'b' | null
        const winnerTeamId = w === "a" ? match.team_a : w === "b" ? match.team_b : "draw";

        // Пункт 6: прогноз овертайма — по конкретной карте.
        const overtimeActual = mapHadOvertime(map);
        const overtimeCorrect = bet.overtimePrediction === overtimeActual;

        if (winnerTeamId === "draw" || !winnerTeamId) {
          addedBalance += bet.amount;
          return { ...bet, status: "refunded" as const, payout: bet.amount };
        }

        const teamCorrect = bet.teamChoice === winnerTeamId;

        // Ставка выигрывает ТОЛЬКО если верно и команда, и прогноз овертайма (пункт 6).
        if (teamCorrect && overtimeCorrect) {
          // Пункт 7: честный расчёт выплаты = ставка * коэффициент.
          const payout = Math.round(bet.amount * bet.odds);
          addedBalance += payout;
          addedXp += 300;
          return { ...bet, status: "won" as const, payout };
        }

        addedXp += 100;
        return { ...bet, status: "lost" as const, payout: 0 };
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

  const level = useMemo(() => levelFromXp(state.xp), [state.xp]);
  const lvlProgress = useMemo(() => levelProgress(state.xp), [state.xp]);
  const levelTitle = useMemo(() => levelTitleFor(level), [level]);

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

      if (isSupabaseConfigured && supabase && user) {
        const { error } = await supabase.from("nodbet_profiles").upsert({ user_id: user.id, nickname: clean });
        if (error) {
          if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
            return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
          }
          console.error("[NODBET] Ошибка сохранения никнейма", error);
          return { ok: false, error: "Не удалось сохранить никнейм. Попробуйте ещё раз." };
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
              double_spin: state.inventory.doubleSpin,
              hall_frame: state.inventory.hallFrame,
              custom_status_owned: state.inventory.customStatusOwned,
              coin_magnet: state.inventory.coinMagnet,
              custom_status_text: state.inventory.customStatusText,
              total_won: 0,
              bets_count: 0,
            },
          ];
        });
        return { ok: true };
      }

      const taken = Object.entries(localNicknames).some(([id, n]) => id !== userId && n.toLowerCase() === clean.toLowerCase());
      if (taken) return { ok: false, error: "Этот никнейм уже занят другим игроком 😕" };
      const next = { ...localNicknames, [userId]: clean };
      saveLocalNicknames(next);
      setLocalNicknames(next);
      return { ok: true };
    },
    [user, userId, localNicknames, state]
  );

  // Собственный статус (пункт 17) — доступен только владельцам привилегии.
  const setCustomStatus = useCallback(
    (raw: string): { ok: boolean; error?: string } => {
      if (!state.inventory.customStatusOwned) {
        return { ok: false, error: "Сначала купите привилегию «Собственный статус» в магазине." };
      }
      const clean = raw.trim().slice(0, 28);
      if (clean.length < 2) return { ok: false, error: "Статус слишком короткий (минимум 2 символа)." };
      if (!/^[A-Za-zА-Яа-яЁё0-9 _+\-!?.★☆♛♕⚡🔥👑💎🎯🎲]{2,28}$/u.test(clean)) {
        return { ok: false, error: "Недопустимые символы в статусе." };
      }
      setState((prev) => ({ ...prev, inventory: { ...prev.inventory, customStatusText: clean } }));
      return { ok: true };
    },
    [state.inventory.customStatusOwned]
  );

  const claimDailyBonus = useCallback(() => {
    if (!dailyBonusAvailable) {
      return { ok: false, error: "Ежедневный бонус уже получен сегодня! Возвращайтесь завтра." };
    }
    setState((prev) => ({
      ...prev,
      balance: prev.balance + 2500,
      xp: prev.xp + Math.round(200 * (prev.inventory.coinMagnet ? 1.1 : 1)),
      lastDailyClaim: new Date().toISOString(),
    }));
    return { ok: true };
  }, [dailyBonusAvailable]);

  // ---------- Ставки (пункты 2, 5, 6, 7) ----------

  const placeBet = useCallback(
    (matchId: string, mapIndex: number, teamChoice: string, teamName: string, amount: number, overtimePrediction: boolean) => {
      if (amount <= 0 || isNaN(amount)) {
        return { ok: false, error: "Введите корректную сумму ставки" };
      }
      if (amount > state.balance) {
        return { ok: false, error: "Недостаточно NOD-Коинов на балансе!" };
      }

      const match = matches.find((m) => m.id === matchId);
      if (!match) return { ok: false, error: "Матч не найден" };
      // Пункт 5: ставки только на upcoming, не на live и не на finished.
      if (match.status === "finished") return { ok: false, error: "Матч уже завершён!" };
      if (match.status === "live") return { ok: false, error: "Матч уже идёт (LIVE) — ставки закрыты! Ставить можно только до начала матча." };

      const totalMaps = maxMapCount(match.format);
      if (mapIndex < 0 || mapIndex >= totalMaps) {
        return { ok: false, error: "Некорректная карта матча" };
      }

      // Нельзя дважды ставить на одну и ту же карту одного матча.
      const dup = state.bets.some((b) => b.matchId === matchId && b.mapIndex === mapIndex && b.status === "pending");
      if (dup) return { ok: false, error: `У вас уже есть ставка на Карту ${mapIndex + 1} этого матча.` };

      // Коэффициент считаем от силы составов (стабильный, честный), + вариация по карте.
      const oddsA = Math.round((1.75 + (match.match_number % 3) * 0.13 + mapIndex * 0.05) * 100) / 100;
      const oddsB = Math.round((2.05 - (match.match_number % 3) * 0.11 + mapIndex * 0.05) * 100) / 100;
      let chosenOdds = 1.9;
      if (teamChoice === match.team_a) chosenOdds = oddsA;
      else if (teamChoice === match.team_b) chosenOdds = oddsB;
      // Прогноз овертайма повышает коэффициент (риск выше — награда выше, пункт 6).
      chosenOdds = Math.round((chosenOdds + 0.25) * 100) / 100;

      const newBet: NodbetBet = {
        id: "bet_" + crypto.randomUUID().slice(0, 8),
        matchId,
        matchTitle: match.title,
        mapIndex,
        teamChoice,
        teamName,
        amount,
        odds: chosenOdds,
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

  // ---------- Рулетка (пункты 1, 8, 18, 20) ----------

  const spinRoulette = useCallback(
    (betAmount: number) => {
      if (betAmount < 0 || isNaN(betAmount)) {
        return { ok: false, results: [] as RouletteSpin[], error: "Неверная сумма ставки" };
      }
      if (betAmount > state.balance) {
        return { ok: false, results: [] as RouletteSpin[], error: "Недостаточно NOD-Коинов для этого спина!" };
      }

      const results: RouletteSpin[] = [];
      let workingStreak = state.streak;
      let balanceDelta = 0;
      let xpGain = 0;

      // Дабл спин: два вращения подряд (пункт 17). Ставка списывается за каждый.
      const spinCount = state.inventory.doubleSpin ? 2 : 1;
      // При двух спинах суммарная ставка не должна превышать баланс.
      if (betAmount * spinCount > state.balance) {
        return {
          ok: false,
          results: [],
          error: `Дабл спин ставит ${betAmount.toLocaleString()} NOD дважды — не хватает баланса. Уменьшите ставку.`,
        };
      }

      for (let i = 0; i < spinCount; i++) {
        const bonusId = pickBonus(workingStreak);
        const def = BONUSES[bonusId];
        const { delta } = computeSpinResult(bonusId, betAmount);
        // delta уже учитывает списание ставки (payout - bet). При отрицательном — теряем.
        balanceDelta += delta;
        xpGain += def.isNegative ? 20 : 60;
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

      const magnet = state.inventory.coinMagnet ? 1.1 : 1;

      setState((prev) => ({
        ...prev,
        balance: Math.max(0, prev.balance + balanceDelta),
        xp: prev.xp + Math.round(xpGain * magnet),
        streak: workingStreak,
        rouletteHistory: [...results, ...prev.rouletteHistory].slice(0, 30),
      }));

      return { ok: true, results };
    },
    [state.balance, state.streak, state.inventory.doubleSpin, state.inventory.coinMagnet]
  );

  // ---------- Магазин (пункт 17) ----------

  const buyPerk = useCallback(
    (perkId: NodbetPerk["id"]) => {
      const perk = NODBET_PERKS.find((p) => p.id === perkId);
      if (!perk) return { ok: false, error: "Привилегия не найдена" };
      if (state.balance < perk.cost) {
        return { ok: false, error: `Недостаточно монет! Требуется ${perk.cost.toLocaleString()} NOD.` };
      }

      const owned =
        (perkId === "radar" && state.inventory.radarUnlocked) ||
        (perkId === "double_spin" && state.inventory.doubleSpin) ||
        (perkId === "hall_frame" && state.inventory.hallFrame) ||
        (perkId === "custom_status" && state.inventory.customStatusOwned) ||
        (perkId === "coin_magnet" && state.inventory.coinMagnet);
      if (owned) return { ok: false, error: "Эта привилегия у вас уже есть!" };

      setState((prev) => ({
        ...prev,
        balance: prev.balance - perk.cost,
        xp: prev.xp + 500,
        inventory: {
          ...prev.inventory,
          radarUnlocked: perkId === "radar" ? true : prev.inventory.radarUnlocked,
          doubleSpin: perkId === "double_spin" ? true : prev.inventory.doubleSpin,
          hallFrame: perkId === "hall_frame" ? true : prev.inventory.hallFrame,
          customStatusOwned: perkId === "custom_status" ? true : prev.inventory.customStatusOwned,
          coinMagnet: perkId === "coin_magnet" ? true : prev.inventory.coinMagnet,
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
      const rows: HighRoller[] = profiles.map((p) => ({
        id: p.user_id,
        nickname: p.nickname || fruitNickname(p.user_id),
        balance: Number(p.balance) || 0,
        totalWon: Number(p.total_won) || 0,
        betsCount: Number(p.bets_count) || 0,
        level: levelFromXp(Number(p.xp) || 0),
        customStatus: p.custom_status_owned ? p.custom_status_text : null,
        hallFrame: !!p.hall_frame,
        isCurrentUser: !!user && p.user_id === user.id,
      }));

      const selfRow: HighRoller = {
        id: user ? user.id : "current_user_hr",
        nickname: displayNickname,
        balance: state.balance,
        totalWon: totalWonOf(state.bets, state.balance),
        betsCount: state.bets.length + state.rouletteHistory.length,
        level,
        customStatus: state.inventory.customStatusOwned ? state.inventory.customStatusText : null,
        hallFrame: state.inventory.hallFrame,
        isCurrentUser: true,
      };

      if (!user) rows.push(selfRow);
      else if (myProfile === undefined) rows.push(selfRow);

      return rows.sort((a, b) => b.balance - a.balance);
    }

    // Локальный режим — демо-соперники.
    const list: HighRoller[] = [
      { id: "hr_1", nickname: "rezo1n", balance: 84_500_000, totalWon: 210_000_000, betsCount: 42, level: 640 },
      { id: "hr_2", nickname: "dony_zq", balance: 67_200_000, totalWon: 185_000_000, betsCount: 38, level: 590 },
      { id: "hr_3", nickname: "CyberClutch_99", balance: 52_100_000, totalWon: 140_000_000, betsCount: 29, level: 520 },
      { id: "hr_4", nickname: "Stalk_Aimer", balance: 41_800_000, totalWon: 98_000_000, betsCount: 21, level: 470 },
      { id: "hr_5", nickname: "ShokeFan_2026", balance: 36_400_000, totalWon: 85_000_000, betsCount: 19, level: 430 },
      { id: "hr_6", nickname: "awp_god_rush", balance: 29_500_000, totalWon: 64_000_000, betsCount: 15, level: 380 },
    ];

    const myItem: HighRoller = {
      id: "current_user_hr",
      nickname: displayNickname,
      balance: state.balance,
      totalWon: totalWonOf(state.bets, state.balance),
      betsCount: state.bets.length + state.rouletteHistory.length,
      level,
      customStatus: state.inventory.customStatusOwned ? state.inventory.customStatusText : null,
      hallFrame: state.inventory.hallFrame,
      isCurrentUser: true,
    };

    return [...list, myItem].sort((a, b) => b.balance - a.balance);
  }, [profiles, user, myProfile, displayNickname, state.balance, state.bets, state.rouletteHistory, state.inventory, level]);

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
      placeBet,
      spinRoulette,
      buyPerk,
      claimDailyBonus,
      hasRadar: state.inventory.radarUnlocked,
      hasDoubleSpin: state.inventory.doubleSpin,
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
      placeBet,
      spinRoulette,
      buyPerk,
      claimDailyBonus,
    ]
  );

  return <NodbetContext.Provider value={value}>{children}</NodbetContext.Provider>;
}

export function useNodbet() {
  const ctx = useContext(NodbetContext);
  if (!ctx) throw new Error("useNodbet must be used within NodbetProvider");
  return ctx;
}

// Экспортируем построитель секторов колеса для страницы NODBET.
export { buildWheelSectors };
