// ============================================================
// CASEUP by 1DONY — контекст игры.
// Онлайн-режим: все действия выполняются на сервере (Supabase RPC,
// security definer) — результат открытия кейсов, покупки/продажи
// на рынке, апгрейды и бусты честно определяет сервер.
// Локальный режим: если Supabase не настроен ИЛИ таблицы CASEUP ещё
// не созданы (миграция не применена) — игра работает в демо-режиме
// на localStorage с той же математикой (для предпросмотра).
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUserAuth } from "./UserAuthContext";
import { useNodbet } from "./NodbetContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  CASEUP_BOOSTS,
  CASEUP_CASES,
  CASEUP_ITEMS,
  BOOST_DURATION_MS,
  type CaseupBoostId,
  type CaseupCaseDef,
  type CaseupItemDef,
  type CaseupRarity,
} from "../data/caseupCatalog";
import {
  buyTotal,
  driftPriceDown,
  driftPriceUp,
  emptyBoosts,
  genLocalId,
  isBoostActive,
  loadLocalCaseup,
  localPrice,
  pickKnifeFinish,
  priceHigh,
  priceLow,
  rollCaseItem,
  saveLocalCaseup,
  sellPayout,
  setLocalPrice,
  upgradeChance,
  type CaseupBoostsState,
  type LocalCaseupState,
  type LocalInventoryRow,
  type LocalTradeRow,
} from "../utils/caseup";
import { levelFromXp } from "../utils/levels";

// ---------------- Типы ----------------

export type CaseupMode = "online" | "local";

export interface CaseupItemView extends CaseupItemDef {
  currentPrice: number;
  low: number;
  high: number;
}

export interface CaseupCaseView extends CaseupCaseDef {
  items: CaseupItemView[]; // скины кейса (без ножа)
  knife?: CaseupItemView;
}

export interface CaseupInventoryRow {
  id: string;
  itemId: string;
  knifeFinish: string | null;
  source: "case" | "market" | "upgrade";
  pricePaid: number;
  createdAt: string;
}

export interface CaseupOpenResult {
  invId: string;
  itemId: string;
  name: string;
  skinName: string;
  rarity: CaseupRarity;
  image: string;
  price: number;
  knifeFinish: string | null;
  isKnife: boolean;
}

export interface CaseupTradeRow {
  id: string;
  itemId: string;
  kind: "buy" | "sell";
  price: number;
  createdAt: string;
}

export interface TopOpenerRow {
  userId: string;
  nickname: string;
  level: number;
  casesOpened: number;
  spent: number;
  hallFrame: boolean;
  crownBadge: boolean;
  starTrail: boolean;
  auraOwned: boolean;
  auraColor: string | null;
  auraEnabled: boolean;
  customStatus: string | null;
  isSelf: boolean;
}

export interface UpgradeOutcome {
  success: boolean;
  chance: number; // итоговый шанс, который показала рулетка
  sourceItemId: string;
  resultItemId: string | null;
  resultKnifeFinish: string | null;
}

export interface CaseupActionResult {
  ok: boolean;
  error?: string;
}

export interface OpenCaseResult {
  ok: boolean;
  error?: string;
  results?: CaseupOpenResult[];
  balance?: number;
}

interface CaseupContextValue {
  mode: CaseupMode;
  demoMode: boolean; // Supabase настроен, но таблиц CASEUP нет — демо на localStorage
  loading: boolean;
  cases: CaseupCaseView[];
  allItems: CaseupItemView[];
  inventory: CaseupInventoryRow[];
  boosts: CaseupBoostsState;
  trades: CaseupTradeRow[];
  topOpeners: TopOpenerRow[];
  balance: number;
  myCasesOpened: number;
  mySpent: number;
  toast: { id: number; msg: string; ok: boolean } | null;
  notify: (msg: string, ok?: boolean) => void;
  openCase: (caseId: string, count: number) => Promise<OpenCaseResult>;
  marketBuy: (itemId: string) => Promise<{ ok: boolean; error?: string; newPrice?: number; row?: CaseupInventoryRow }>;
  marketSell: (invId: string) => Promise<{ ok: boolean; error?: string; payout?: number; newPrice?: number }>;
  upgradeItem: (invId: string, targetItemId: string) => Promise<{ ok: boolean; error?: string; outcome?: UpgradeOutcome }>;
  buyBoost: (boostId: CaseupBoostId) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const CaseupContext = createContext<CaseupContextValue | null>(null);

// ---------------- Маппинг строк БД ----------------

interface DbItemRow {
  id: string;
  case_id: string | null;
  name: string;
  skin_name: string;
  rarity: CaseupRarity;
  image_url: string;
  base_price: number;
  price: number;
  drop_chance: number;
  is_knife: boolean;
  sort_order: number;
}

interface DbCaseRow {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  accent: string;
  knife_item_id: string | null;
  knife_chance: number;
  sort_order: number;
}

interface DbInvRow {
  id: string;
  item_id: string;
  knife_finish: string | null;
  source: "case" | "market" | "upgrade";
  price_paid: number;
  created_at: string;
}

interface DbBoostRow {
  user_id: string;
  market_pro: boolean;
  lucky_ticket: boolean;
  buy_discount_until: string | null;
  sell_bonus_until: string | null;
  upgrade_chance_until: string | null;
  case_luck_until: string | null;
}

interface DbTradeRow {
  id: string;
  item_id: string;
  kind: "buy" | "sell";
  price: number;
  created_at: string;
}

interface DbProfileRow {
  user_id: string;
  nickname: string | null;
  xp: number;
  hall_frame: boolean;
  crown_badge: boolean;
  star_trail: boolean;
  aura_owned: boolean;
  aura_color: string | null;
  aura_enabled: boolean;
  custom_status_owned: boolean;
  custom_status_text: string | null;
  caseup_cases_opened: number;
  caseup_spent: number;
}

function itemViewFromDb(r: DbItemRow): CaseupItemView {
  return {
    id: r.id,
    caseId: r.case_id,
    name: r.name,
    skinName: r.skin_name,
    rarity: r.rarity,
    image: r.image_url,
    basePrice: Number(r.base_price) || 0,
    dropChance: Number(r.drop_chance) || 0,
    sortOrder: r.sort_order,
    currentPrice: Number(r.price) || Number(r.base_price) || 0,
    low: priceLow(Number(r.base_price) || 0),
    high: priceHigh(Number(r.base_price) || 0),
  };
}

function boostsFromDb(r: DbBoostRow | null): CaseupBoostsState {
  if (!r) return emptyBoosts();
  return {
    marketPro: !!r.market_pro,
    luckyTicket: !!r.lucky_ticket,
    buyDiscountUntil: r.buy_discount_until,
    sellBonusUntil: r.sell_bonus_until,
    upgradeChanceUntil: r.upgrade_chance_until,
    caseLuckUntil: r.case_luck_until,
  };
}

// ---------------- Провайдер ----------------

export function CaseupProvider({ children }: { children: ReactNode }) {
  const { user } = useUserAuth();
  const nodbet = useNodbet();
  const [mode, setMode] = useState<CaseupMode>("local");
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<CaseupCaseView[]>([]);
  const [allItems, setAllItems] = useState<CaseupItemView[]>([]);
  const [inventory, setInventory] = useState<CaseupInventoryRow[]>([]);
  const [boosts, setBoosts] = useState<CaseupBoostsState>(emptyBoosts());
  const [trades, setTrades] = useState<CaseupTradeRow[]>([]);
  const [topOpeners, setTopOpeners] = useState<TopOpenerRow[]>([]);
  const [myCasesOpened, setMyCasesOpened] = useState(0);
  const [mySpent, setMySpent] = useState(0);
  const [toast, setToast] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Локальное состояние (демо-режим)
  const [localState, setLocalState] = useState<LocalCaseupState>(() =>
    loadLocalCaseup(user?.id ?? "guest")
  );
  const localUserId = user?.id ?? "guest";

  // Баланс: источник истины — NODBET (сервер или локальный); RPC-ответы
  // обновляют мгновенно, realtime/refresh догоняют.
  const [balance, setBalance] = useState(nodbet.balance);
  useEffect(() => {
    setBalance(nodbet.balance);
  }, [nodbet.balance]);

  const notify = useCallback((msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // ---------- Локальный режим: персистентность ----------
  useEffect(() => {
    if (mode !== "local") return;
    const t = setTimeout(() => saveLocalCaseup(localUserId, localState), 120);
    return () => clearTimeout(t);
  }, [localState, localUserId, mode]);

  // ---------- Построение вью кейсов ----------
  const buildViews = useCallback(
    (defs: CaseupCaseDef[], items: CaseupItemView[]): CaseupCaseView[] => {
      return defs.map((c) => {
        const skins = items
          .filter((i) => i.caseId === c.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const knife = items.find((i) => i.id === c.knifeItemId);
        return { ...c, items: skins, knife };
      });
    },
    []
  );

  const localItemsView = useCallback(
    (defs: CaseupItemDef[], ls: LocalCaseupState): CaseupItemView[] => {
      return defs.map((d) => {
        const p = localPrice(ls, d);
        return {
          ...d,
          currentPrice: p,
          low: priceLow(d.basePrice),
          high: priceHigh(d.basePrice),
        };
      });
    },
    []
  );

  // ---------- Загрузка (онлайн) ----------
  const loadOnline = useCallback(
    async (uid: string) => {
      if (!supabase) return false;
      try {
        const [casesRes, itemsRes, invRes, boostRes, tradeRes, topRes, selfRes] = await Promise.all([
          supabase.from("caseup_cases").select("*").order("sort_order", { ascending: true }),
          supabase.from("caseup_items").select("*"),
          supabase.from("caseup_inventory").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(500),
          supabase.from("caseup_boosts").select("*").eq("user_id", uid).maybeSingle(),
          supabase.from("caseup_market_trades").select("*").order("created_at", { ascending: false }).limit(25),
          supabase
            .from("nodbet_profiles")
            .select("user_id,nickname,xp,hall_frame,crown_badge,star_trail,aura_owned,aura_color,aura_enabled,custom_status_owned,custom_status_text,caseup_cases_opened,caseup_spent")
            .order("caseup_cases_opened", { ascending: false })
            .order("caseup_spent", { ascending: false })
            .limit(50),
          supabase
            .from("nodbet_profiles")
            .select("caseup_cases_opened,caseup_spent")
            .eq("user_id", uid)
            .maybeSingle(),
        ]);

        // Если таблиц CASEUP нет (миграция не применена) — уходим в демо-режим
        const missing =
          casesRes.error || itemsRes.error || invRes.error || boostRes.error || tradeRes.error;
        if (missing) {
          console.warn("[CASEUP] Таблицы CASEUP не найдены — включаю демо-режим", missing);
          setDemoMode(true);
          return false;
        }

        const itemRows = (itemsRes.data ?? []) as DbItemRow[];
        const items = itemRows.map(itemViewFromDb);
        const caseRows = (casesRes.data ?? []) as DbCaseRow[];
        const caseDefs: CaseupCaseDef[] = caseRows.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          price: Number(c.price) || 0,
          image: c.image_url,
          accent: c.accent,
          knifeItemId: c.knife_item_id || "",
          knifeChance: Number(c.knife_chance) || 0.26,
          sortOrder: c.sort_order,
        }));

        setCases(buildViews(caseDefs, items));
        setAllItems(items);
        setInventory(((invRes.data ?? []) as DbInvRow[]).map((r) => ({
          id: r.id,
          itemId: r.item_id,
          knifeFinish: r.knife_finish,
          source: r.source,
          pricePaid: Number(r.price_paid) || 0,
          createdAt: r.created_at,
        })));
        setBoosts(boostsFromDb((boostRes.data as DbBoostRow | null) ?? null));
        setTrades(((tradeRes.data ?? []) as DbTradeRow[]).map((r) => ({
          id: r.id,
          itemId: r.item_id,
          kind: r.kind,
          price: Number(r.price) || 0,
          createdAt: r.created_at,
        })));

        // Топ открывателей + своя строка
        const rows = (topRes.data ?? []) as DbProfileRow[];
        const mapped: TopOpenerRow[] = rows.map((p) => ({
          userId: p.user_id,
          nickname: p.nickname || "Игрок",
          level: levelFromXp(Number(p.xp) || 0),
          casesOpened: Number(p.caseup_cases_opened) || 0,
          spent: Number(p.caseup_spent) || 0,
          hallFrame: !!p.hall_frame,
          crownBadge: !!p.crown_badge,
          starTrail: !!p.star_trail,
          auraOwned: !!p.aura_owned,
          auraColor: p.aura_color,
          auraEnabled: p.aura_enabled !== false,
          customStatus: p.custom_status_owned ? p.custom_status_text : null,
          isSelf: p.user_id === uid,
        }));
        const selfRow = (selfRes.data as { caseup_cases_opened?: number; caseup_spent?: number } | null) ?? null;
        const selfOpened = Number(selfRow?.caseup_cases_opened) || 0;
        const selfSpent = Number(selfRow?.caseup_spent) || 0;
        setMyCasesOpened(selfOpened);
        setMySpent(selfSpent);
        const inTop = mapped.some((t) => t.userId === uid);
        if (!inTop) {
          mapped.push({
            userId: uid,
            nickname: nodbet.displayNickname || "Игрок",
            level: nodbet.level,
            casesOpened: selfOpened,
            spent: selfSpent,
            hallFrame: nodbet.inventory.hallFrame,
            crownBadge: nodbet.inventory.crownBadge,
            starTrail: nodbet.inventory.starTrail,
            auraOwned: nodbet.inventory.auraOwned,
            auraColor: nodbet.inventory.auraColor,
            auraEnabled: nodbet.inventory.auraEnabled,
            customStatus: nodbet.inventory.customStatusOwned ? nodbet.inventory.customStatusText : null,
            isSelf: true,
          });
        }
        setTopOpeners(mapped);

        setMode("online");
        setDemoMode(false);
        return true;
      } catch (e) {
        console.warn("[CASEUP] Ошибка загрузки Supabase — демо-режим", e);
        setDemoMode(true);
        return false;
      }
    },
    [buildViews, nodbet.displayNickname, nodbet.inventory, nodbet.level]
  );

  // ---------- Локальная загрузка ----------
  const loadLocal = useCallback(
    (uid: string) => {
      const ls = loadLocalCaseup(uid);
      setLocalState(ls);
      const items = localItemsView(CASEUP_ITEMS, ls);
      setCases(buildViews(CASEUP_CASES, items));
      setAllItems(items);
      setInventory(
        ls.inventory.map((r) => ({
          id: r.id,
          itemId: r.itemId,
          knifeFinish: r.knifeFinish,
          source: r.source,
          pricePaid: r.pricePaid,
          createdAt: r.createdAt,
        }))
      );
      setBoosts(ls.boosts);
      setTrades(ls.trades);
      setMyCasesOpened(ls.opensCount);
      setMySpent(ls.spent);
      // Демо-топ: из локального стейта только свои данные
      setTopOpeners([
        {
          userId: uid,
          nickname: nodbet.displayNickname || "Игрок",
          level: nodbet.level,
          casesOpened: ls.opensCount,
          spent: ls.spent,
          hallFrame: nodbet.inventory.hallFrame,
          crownBadge: nodbet.inventory.crownBadge,
          starTrail: nodbet.inventory.starTrail,
          auraOwned: nodbet.inventory.auraOwned,
          auraColor: nodbet.inventory.auraColor,
          auraEnabled: nodbet.inventory.auraEnabled,
          customStatus: nodbet.inventory.customStatusOwned ? nodbet.inventory.customStatusText : null,
          isSelf: true,
        },
      ]);
    },
    [buildViews, localItemsView, nodbet.displayNickname, nodbet.inventory, nodbet.level]
  );

  // ---------- Инициализация ----------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const boot = async () => {
      if (isSupabaseConfigured && supabase && user) {
        const ok = await loadOnline(user.id);
        if (cancelled) return;
        if (!ok) {
          loadLocal(user.id);
          setMode("local");
        }
      } else {
        loadLocal(user?.id ?? "guest");
        setMode("local");
      }
      if (!cancelled) setLoading(false);
    };
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- Realtime (онлайн) ----------
  useEffect(() => {
    if (mode !== "online" || !supabase || !user) return;
    const client = supabase;
    const channel = client
      .channel("caseup-feed")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "caseup_items" }, (payload) => {
        const row = payload.new as DbItemRow;
        if (!row?.id) return;
        setAllItems((prev) => {
          const idx = prev.findIndex((i) => i.id === row.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], currentPrice: Number(row.price) || next[idx].currentPrice };
          return next;
        });
        setCases((prev) =>
          prev.map((c) => {
            const items = c.items.map((i) => (i.id === row.id ? { ...i, currentPrice: Number(row.price) || i.currentPrice } : i));
            const knife = c.knife && c.knife.id === row.id ? { ...c.knife, currentPrice: Number(row.price) || c.knife.currentPrice } : c.knife;
            return { ...c, items, knife };
          })
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "caseup_market_trades" }, (payload) => {
        const row = payload.new as DbTradeRow;
        if (!row?.id) return;
        setTrades((prev) =>
          [
            { id: row.id, itemId: row.item_id, kind: row.kind, price: Number(row.price) || 0, createdAt: row.created_at },
            ...prev,
          ].slice(0, 30)
        );
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "caseup_boosts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setBoosts(boostsFromDb(payload.new as DbBoostRow));
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [mode, user]);

  // ---------- Вспомогательные ----------
  const priceOf = useCallback(
    (itemId: string): number => {
      const it = allItems.find((i) => i.id === itemId);
      return it ? it.currentPrice : CASEUP_ITEMS.find((i) => i.id === itemId)?.basePrice ?? 0;
    },
    [allItems]
  );

  const applyItemPrice = useCallback(
    (itemId: string, newPrice: number) => {
      setAllItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, currentPrice: newPrice } : i)));
      setCases((prev) =>
        prev.map((c) => ({
          ...c,
          items: c.items.map((i) => (i.id === itemId ? { ...i, currentPrice: newPrice } : i)),
          knife: c.knife && c.knife.id === itemId ? { ...c.knife, currentPrice: newPrice } : c.knife,
        }))
      );
    },
    []
  );

  // ---------- Открытие кейса ----------
  const openCase = useCallback(
    async (caseId: string, count: number): Promise<OpenCaseResult> => {
      const n = Math.max(1, Math.min(3, Math.round(count) || 1));
      const caseDef = cases.find((c) => c.id === caseId) || CASEUP_CASES.find((c) => c.id === caseId);
      if (!caseDef) return { ok: false, error: "Кейс не найден" };

      if (mode === "online" && supabase && user) {
        try {
          const { data, error } = await supabase.rpc("caseup_open_case", { p_case_id: caseId, p_count: n });
          if (error || !data?.ok) {
            return { ok: false, error: (data as { error?: string })?.error || "Ошибка сервера при открытии" };
          }
          const d = data as { ok: boolean; balance?: number; results?: CaseupOpenResult[] };
          if (typeof d.balance === "number") setBalance(d.balance);
          const res = (d.results ?? []).map((r) => ({
            invId: r.invId,
            itemId: r.itemId,
            name: r.name,
            skinName: r.skinName,
            rarity: r.rarity,
            image: r.image,
            price: Number(r.price) || 0,
            knifeFinish: r.knifeFinish,
            isKnife: r.isKnife,
          }));
          if (res.length) {
            setInventory((prev) =>
              [
                ...res.map((r) => ({
                  id: r.invId,
                  itemId: r.itemId,
                  knifeFinish: r.knifeFinish,
                  source: "case" as const,
                  pricePaid: Number(r.price) || 0,
                  createdAt: new Date().toISOString(),
                })),
                ...prev,
              ]
            );
            setMyCasesOpened((v) => v + res.length);
            setMySpent((v) => v + caseDef.price * res.length);
          }
          nodbet.refreshOwnProfile();
          return { ok: true, results: res, balance: d.balance };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      // ---- Локальный (демо) режим ----
      if (nodbet.balance < caseDef.price * n) {
        return { ok: false, error: "Недостаточно NOD-Коинов для открытия!" };
      }
      const skins = CASEUP_ITEMS.filter((i) => i.caseId === caseDef.id);
      const knife = CASEUP_ITEMS.find((i) => i.id === caseDef.knifeItemId);
      const luck = isBoostActive(boosts, "case_luck");
      const results: CaseupOpenResult[] = [];
      const newRows: LocalInventoryRow[] = [];
      for (let i = 0; i < n; i++) {
        const { item, knifeFinish } = rollCaseItem(caseDef, skins, knife, luck);
        const row: LocalInventoryRow = {
          id: genLocalId("inv"),
          itemId: item.id,
          knifeFinish,
          source: "case",
          pricePaid: priceOf(item.id),
          createdAt: new Date().toISOString(),
        };
        newRows.push(row);
        results.push({
          invId: row.id,
          itemId: item.id,
          name: item.name,
          skinName: item.skinName,
          rarity: item.rarity,
          image: item.image,
          price: priceOf(item.id),
          knifeFinish,
          isKnife: item.rarity === "knife",
        });
      }
      setLocalState((prev) => ({
        ...prev,
        inventory: [...newRows, ...prev.inventory],
        opensCount: prev.opensCount + n,
        spent: prev.spent + caseDef.price * n,
      }));
      setInventory((prev) => [...newRows, ...prev]);
      setMyCasesOpened((v) => v + n);
      setMySpent((v) => v + caseDef.price * n);
      nodbet.adjustLocalBalance(-caseDef.price * n, 30 * n);
      return { ok: true, results };
    },
    [cases, mode, user, boosts, nodbet, priceOf]
  );

  // ---------- Рынок: покупка ----------
  const marketBuy = useCallback(
    async (itemId: string): Promise<{ ok: boolean; error?: string; newPrice?: number; row?: CaseupInventoryRow }> => {
      const def = CASEUP_ITEMS.find((i) => i.id === itemId);
      if (!def) return { ok: false, error: "Предмет не найден" };

      if (mode === "online" && supabase && user) {
        try {
          const { data, error } = await supabase.rpc("caseup_market_buy", { p_item_id: itemId });
          if (error || !data?.ok) {
            return { ok: false, error: (data as { error?: string })?.error || "Ошибка сервера при покупке" };
          }
          const d = data as { ok: boolean; balance?: number; new_price?: number; rows?: { inv_id: string; knife_finish: string | null; price_paid: number }[] };
          if (typeof d.balance === "number") setBalance(d.balance);
          if (typeof d.new_price === "number") applyItemPrice(itemId, d.new_price);
          const row = (d.rows ?? [])[0];
          const invRow: CaseupInventoryRow | undefined = row
            ? {
                id: row.inv_id,
                itemId,
                knifeFinish: row.knife_finish,
                source: "market",
                pricePaid: Number(row.price_paid) || 0,
                createdAt: new Date().toISOString(),
              }
            : undefined;
          if (invRow) setInventory((prev) => [invRow, ...prev]);
          nodbet.refreshOwnProfile();
          return { ok: true, newPrice: d.new_price, row: invRow };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      // ---- Локальный режим ----
      const price = localPrice(localState, def);
      const discount = isBoostActive(boosts, "buy_discount");
      const total = buyTotal(price, discount);
      if (nodbet.balance < total) {
        return { ok: false, error: `Недостаточно NOD-Коинов! Нужно ${total.toLocaleString("ru-RU")} NOD.` };
      }
      const knifeFinish = def.rarity === "knife" ? pickKnifeFinish() : null;
      const row: LocalInventoryRow = {
        id: genLocalId("inv"),
        itemId,
        knifeFinish,
        source: "market",
        pricePaid: total,
        createdAt: new Date().toISOString(),
      };
      const newPrice = driftPriceUp(price, def.basePrice);
      const trade: LocalTradeRow = { id: genLocalId("trd"), itemId, kind: "buy", price: total, createdAt: new Date().toISOString() };
      setLocalState((prev) =>
        setLocalPrice({ ...prev, inventory: [row, ...prev.inventory], trades: [trade, ...prev.trades].slice(0, 30) }, itemId, newPrice)
      );
      setInventory((prev) => [row, ...prev]);
      applyItemPrice(itemId, newPrice);
      setTrades((prev) => [trade, ...prev].slice(0, 30));
      nodbet.adjustLocalBalance(-total, 15);
      return { ok: true, newPrice, row };
    },
    [mode, user, localState, boosts, nodbet, applyItemPrice]
  );

  // ---------- Рынок: продажа ----------
  const marketSell = useCallback(
    async (invId: string): Promise<{ ok: boolean; error?: string; payout?: number; newPrice?: number }> => {
      const invRow = inventory.find((r) => r.id === invId);
      if (!invRow) return { ok: false, error: "Предмет не найден в инвентаре" };
      const def = CASEUP_ITEMS.find((i) => i.id === invRow.itemId);
      if (!def) return { ok: false, error: "Предмет не найден" };

      if (mode === "online" && supabase && user) {
        try {
          const { data, error } = await supabase.rpc("caseup_market_sell", { p_inv_id: invId });
          if (error || !data?.ok) {
            return { ok: false, error: (data as { error?: string })?.error || "Ошибка сервера при продаже" };
          }
          const d = data as { ok: boolean; balance?: number; payout?: number; new_price?: number };
          if (typeof d.balance === "number") setBalance(d.balance);
          if (typeof d.new_price === "number") applyItemPrice(invRow.itemId, d.new_price);
          setInventory((prev) => prev.filter((r) => r.id !== invId));
          nodbet.refreshOwnProfile();
          return { ok: true, payout: d.payout, newPrice: d.new_price };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      // ---- Локальный режим ----
      const price = localPrice(localState, def);
      const payout = sellPayout(price, boosts.marketPro, isBoostActive(boosts, "sell_bonus"));
      const newPrice = driftPriceDown(price, def.basePrice);
      const trade: LocalTradeRow = { id: genLocalId("trd"), itemId: def.id, kind: "sell", price: payout, createdAt: new Date().toISOString() };
      setLocalState((prev) =>
        setLocalPrice(
          { ...prev, inventory: prev.inventory.filter((r) => r.id !== invId), trades: [trade, ...prev.trades].slice(0, 30) },
          def.id,
          newPrice
        )
      );
      setInventory((prev) => prev.filter((r) => r.id !== invId));
      applyItemPrice(def.id, newPrice);
      setTrades((prev) => [trade, ...prev].slice(0, 30));
      nodbet.adjustLocalBalance(payout, 20);
      return { ok: true, payout, newPrice };
    },
    [mode, user, inventory, localState, boosts, nodbet, applyItemPrice]
  );

  // ---------- Апгрейд ----------
  const upgradeItem = useCallback(
    async (invId: string, targetItemId: string): Promise<{ ok: boolean; error?: string; outcome?: UpgradeOutcome }> => {
      const invRow = inventory.find((r) => r.id === invId);
      if (!invRow) return { ok: false, error: "Предмет не найден в инвентаре" };
      const source = CASEUP_ITEMS.find((i) => i.id === invRow.itemId);
      const target = CASEUP_ITEMS.find((i) => i.id === targetItemId);
      if (!source || !target) return { ok: false, error: "Предмет не найден" };
      const sourcePrice = priceOf(source.id);
      const targetPrice = priceOf(target.id);
      if (targetPrice < sourcePrice) {
        return { ok: false, error: "Цель должна быть не дешевле вашего предмета" };
      }

      if (mode === "online" && supabase && user) {
        try {
          const { data, error } = await supabase.rpc("caseup_upgrade", { p_inv_id: invId, p_target_item_id: targetItemId });
          if (error || !data?.ok) {
            return { ok: false, error: (data as { error?: string })?.error || "Ошибка сервера при апгрейде" };
          }
          const d = data as {
            ok: boolean;
            success: boolean;
            chance: number;
            balance?: number;
            result?: { item_id: string; knife_finish: string | null; inv_id?: string } | null;
          };
          if (typeof d.balance === "number") setBalance(d.balance);
          setInventory((prev) => prev.filter((r) => r.id !== invId));
          if (d.success && d.result?.item_id) {
            const r = d.result;
            const def = CASEUP_ITEMS.find((i) => i.id === r.item_id);
            if (def) {
              const row: CaseupInventoryRow = {
                id: r.inv_id || genLocalId("inv"),
                itemId: def.id,
                knifeFinish: r.knife_finish,
                source: "upgrade",
                pricePaid: targetPrice,
                createdAt: new Date().toISOString(),
              };
              setInventory((prev) => [row, ...prev]);
            }
          }
          nodbet.refreshOwnProfile();
          return {
            ok: true,
            outcome: {
              success: d.success,
              chance: Number(d.chance) || 0,
              sourceItemId: source.id,
              resultItemId: d.success && d.result?.item_id ? d.result.item_id : null,
              resultKnifeFinish: d.success ? d.result?.knife_finish ?? null : null,
            },
          };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      // ---- Локальный режим ----
      const chance = upgradeChance(sourcePrice, targetPrice, {
        luckyTicket: boosts.luckyTicket,
        upgradeChanceActive: isBoostActive(boosts, "upgrade_chance"),
      });
      const success = Math.random() * 100 < chance;
      if (success) {
        const knifeFinish = target.rarity === "knife" ? pickKnifeFinish() : null;
        const row: LocalInventoryRow = {
          id: genLocalId("inv"),
          itemId: target.id,
          knifeFinish,
          source: "upgrade",
          pricePaid: targetPrice,
          createdAt: new Date().toISOString(),
        };
        const newPrice = driftPriceUp(targetPrice, target.basePrice);
        setLocalState((prev) =>
          setLocalPrice(
            { ...prev, inventory: [row, ...prev.inventory.filter((r) => r.id !== invId)] },
            target.id,
            newPrice
          )
        );
        setInventory((prev) => [row, ...prev.filter((r) => r.id !== invId)]);
        applyItemPrice(target.id, newPrice);
        nodbet.adjustLocalBalance(0, 150);
        return {
          ok: true,
          outcome: { success: true, chance, sourceItemId: source.id, resultItemId: target.id, resultKnifeFinish: knifeFinish },
        };
      }
      setLocalState((prev) => ({ ...prev, inventory: prev.inventory.filter((r) => r.id !== invId) }));
      setInventory((prev) => prev.filter((r) => r.id !== invId));
      nodbet.adjustLocalBalance(0, 40);
      return { ok: true, outcome: { success: false, chance, sourceItemId: source.id, resultItemId: null, resultKnifeFinish: null } };
    },
    [mode, user, inventory, boosts, nodbet, priceOf, applyItemPrice]
  );

  // ---------- Магазин бустов ----------
  const buyBoost = useCallback(
    async (boostId: CaseupBoostId): Promise<{ ok: boolean; error?: string }> => {
      const boost = CASEUP_BOOSTS.find((b) => b.id === boostId);
      if (!boost) return { ok: false, error: "Буст не найден" };
      if (isBoostActive(boosts, boostId)) {
        return { ok: false, error: boost.permanent ? "Этот буст у вас уже есть!" : "Этот буст уже активен!" };
      }

      if (mode === "online" && supabase && user) {
        try {
          const { data, error } = await supabase.rpc("caseup_buy_boost", { p_boost_id: boostId });
          if (error || !data?.ok) {
            return { ok: false, error: (data as { error?: string })?.error || "Ошибка сервера при покупке" };
          }
          const d = data as { ok: boolean; balance?: number; boosts?: DbBoostRow };
          if (typeof d.balance === "number") setBalance(d.balance);
          if (d.boosts) setBoosts(boostsFromDb(d.boosts));
          nodbet.refreshOwnProfile();
          return { ok: true };
        } catch {
          return { ok: false, error: "Ошибка сети. Попробуйте ещё раз." };
        }
      }

      // ---- Локальный режим ----
      if (nodbet.balance < boost.cost) {
        return { ok: false, error: `Недостаточно NOD-Коинов! Нужно ${boost.cost.toLocaleString("ru-RU")} NOD.` };
      }
      const dur = BOOST_DURATION_MS[boostId];
      setLocalState((prev) => {
        const b = { ...prev.boosts };
        if (boostId === "market_pro") b.marketPro = true;
        if (boostId === "lucky_ticket") b.luckyTicket = true;
        if (dur) {
          const base = (() => {
            switch (boostId) {
              case "buy_discount": return b.buyDiscountUntil;
              case "sell_bonus": return b.sellBonusUntil;
              case "upgrade_chance": return b.upgradeChanceUntil;
              case "case_luck": return b.caseLuckUntil;
              default: return null;
            }
          })();
          const from = base ? Math.max(Date.now(), new Date(base).getTime()) : Date.now();
          const until = new Date(from + dur).toISOString();
          if (boostId === "buy_discount") b.buyDiscountUntil = until;
          if (boostId === "sell_bonus") b.sellBonusUntil = until;
          if (boostId === "upgrade_chance") b.upgradeChanceUntil = until;
          if (boostId === "case_luck") b.caseLuckUntil = until;
        }
        return { ...prev, boosts: b };
      });
      setBoosts((prev) => {
        const b = { ...prev };
        if (boostId === "market_pro") b.marketPro = true;
        if (boostId === "lucky_ticket") b.luckyTicket = true;
        if (dur) {
          const from = (() => {
            switch (boostId) {
              case "buy_discount": return b.buyDiscountUntil;
              case "sell_bonus": return b.sellBonusUntil;
              case "upgrade_chance": return b.upgradeChanceUntil;
              case "case_luck": return b.caseLuckUntil;
              default: return null;
            }
          })();
          const baseT = from ? Math.max(Date.now(), new Date(from).getTime()) : Date.now();
          const until = new Date(baseT + dur).toISOString();
          if (boostId === "buy_discount") b.buyDiscountUntil = until;
          if (boostId === "sell_bonus") b.sellBonusUntil = until;
          if (boostId === "upgrade_chance") b.upgradeChanceUntil = until;
          if (boostId === "case_luck") b.caseLuckUntil = until;
        }
        return b;
      });
      nodbet.adjustLocalBalance(-boost.cost, 100);
      return { ok: true };
    },
    [mode, user, boosts, nodbet]
  );

  // ---------- Полное обновление ----------
  const refresh = useCallback(async () => {
    if (mode === "online" && supabase && user) {
      await loadOnline(user.id);
    } else {
      loadLocal(user?.id ?? "guest");
    }
  }, [mode, user, loadOnline, loadLocal]);

  const value = useMemo<CaseupContextValue>(
    () => ({
      mode,
      demoMode,
      loading,
      cases,
      allItems,
      inventory,
      boosts,
      trades,
      topOpeners,
      balance,
      myCasesOpened,
      mySpent,
      toast,
      notify,
      openCase,
      marketBuy,
      marketSell,
      upgradeItem,
      buyBoost,
      refresh,
    }),
    [
      mode,
      demoMode,
      loading,
      cases,
      allItems,
      inventory,
      boosts,
      trades,
      topOpeners,
      balance,
      myCasesOpened,
      mySpent,
      toast,
      notify,
      openCase,
      marketBuy,
      marketSell,
      upgradeItem,
      buyBoost,
      refresh,
    ]
  );

  return <CaseupContext.Provider value={value}>{children}</CaseupContext.Provider>;
}

export function useCaseup() {
  const ctx = useContext(CaseupContext);
  if (!ctx) throw new Error("useCaseup must be used within CaseupProvider");
  return ctx;
}
