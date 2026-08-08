// ============================================================
// CASEUP by 1DONY — утилиты: редкости, шансы, дрейф цен, формат.
// Вся математика дублируется на сервере (Supabase RPC) —
// здесь только отображение и локальный демо-режим.
// ============================================================
import {
  KNIFE_FINISHES,
  MARKET_COMMISSION,
  MARKET_COMMISSION_PRO,
  PRICE_DRIFT_BUY,
  PRICE_DRIFT_SELL,
  PRICE_LOW_RATIO,
  PRICE_HIGH_RATIO,
  type CaseupBoostId,
  type CaseupItemDef,
  type CaseupRarity,
} from "../data/caseupCatalog";

export type { CaseupBoostId, CaseupItemDef, CaseupRarity } from "../data/caseupCatalog";

/** Предмет каталога с актуальной (дрейфующей) ценой. */
export interface CaseupItemView extends CaseupItemDef {
  currentPrice: number;
  low: number;
  high: number;
}

export interface RarityMeta {
  id: CaseupRarity;
  label: string;
  order: number;
  color: string;
  soft: string; // приглушённая плашка
  glow: string; // свечение
}

export const RARITY_META: Record<CaseupRarity, RarityMeta> = {
  "mil-spec": {
    id: "mil-spec",
    label: "Армейское",
    order: 1,
    color: "#5b7cfa",
    soft: "rgba(91,124,250,0.16)",
    glow: "rgba(91,124,250,0.35)",
  },
  restricted: {
    id: "restricted",
    label: "Запрещённое",
    order: 2,
    color: "#9d6bff",
    soft: "rgba(157,107,255,0.16)",
    glow: "rgba(157,107,255,0.35)",
  },
  classified: {
    id: "classified",
    label: "Засекреченное",
    order: 3,
    color: "#e05ce0",
    soft: "rgba(224,92,224,0.16)",
    glow: "rgba(224,92,224,0.35)",
  },
  covert: {
    id: "covert",
    label: "Тайное",
    order: 4,
    color: "#f05555",
    soft: "rgba(240,85,85,0.16)",
    glow: "rgba(240,85,85,0.4)",
  },
  knife: {
    id: "knife",
    label: "Нож",
    order: 5,
    color: "#ffcf4d",
    soft: "rgba(255,207,77,0.16)",
    glow: "rgba(255,207,77,0.45)",
  },
};

export const RARITY_ORDER: CaseupRarity[] = ["mil-spec", "restricted", "classified", "covert", "knife"];

export function rarityMeta(r: string): RarityMeta {
  return RARITY_META[(r as CaseupRarity) in RARITY_META ? (r as CaseupRarity) : "mil-spec"];
}

// ---------- Форматирование ----------
export function fmtNod(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

export function fmtPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

// ---------- Дрейф цен ----------
export function priceLow(base: number): number {
  return Math.max(10, Math.round(base * PRICE_LOW_RATIO));
}
export function priceHigh(base: number): number {
  return Math.round(base * PRICE_HIGH_RATIO);
}

/** Округление цены до "красивого" числа. */
export function roundPrice(p: number): number {
  const v = Math.max(1, Math.round(p));
  if (v >= 100000) return Math.round(v / 1000) * 1000;
  if (v >= 10000) return Math.round(v / 100) * 100;
  if (v >= 1000) return Math.round(v / 50) * 50;
  if (v >= 100) return Math.round(v / 10) * 10;
  return v;
}

export function driftPriceUp(price: number, base: number): number {
  return roundPrice(Math.min(priceHigh(base), Math.max(priceLow(base), price * (1 + PRICE_DRIFT_BUY))));
}

export function driftPriceDown(price: number, base: number): number {
  return roundPrice(Math.max(priceLow(base), Math.min(priceHigh(base), price * (1 - PRICE_DRIFT_SELL))));
}

export function priceTrend(price: number, base: number): number {
  if (base <= 0) return 0;
  return (price - base) / base;
}

// ---------- Шансы ----------
/**
 * Шанс успеха апгрейда (в %).
 * r = цена источника / цена цели (0..1). Чем больше разрыв, тем ниже шанс.
 * chance = r^1.1 * 100, + постоянные/временные бусты, кап 95%, минимум 5%.
 */
export function upgradeChance(sourcePrice: number, targetPrice: number, boosts: { luckyTicket: boolean; upgradeChanceActive: boolean }): number {
  if (targetPrice <= 0 || sourcePrice <= 0) return 5;
  const r = Math.min(1, sourcePrice / targetPrice);
  let chance = Math.pow(r, 1.1) * 100;
  if (boosts.luckyTicket) chance += 1.5;
  if (boosts.upgradeChanceActive) chance += 4;
  return Math.min(95, Math.max(5, chance));
}

/** Ожидаемая стоимость открытия кейса (для UI). */
export function caseExpectedValue(
  caseDef: { id: string; knifeItemId: string; knifeChance: number },
  skins: CaseupItemView[],
  knife: CaseupItemView | undefined,
  priceOf: (itemId: string) => number
): number {
  let ev = 0;
  if (knife) ev += (caseDef.knifeChance / 100) * priceOf(knife.id);
  const skinSum = skins.reduce((a, s) => a + s.dropChance, 0) || 1;
  for (const s of skins) {
    ev += (s.dropChance / skinSum) * (1 - caseDef.knifeChance / 100) * priceOf(s.id);
  }
  return ev;
}

// ---------- Ножи ----------
export function pickKnifeFinish(): string {
  return KNIFE_FINISHES[Math.floor(Math.random() * KNIFE_FINISHES.length)];
}

/** Полное имя предмета: "AK-47 | Расплавленный" или "Керамбит | Градиент". */
export function itemDisplayName(item: { name: string; skinName: string; rarity: CaseupRarity }, knifeFinish?: string | null): string {
  if (item.rarity === "knife") {
    return knifeFinish ? `${item.name} | ${knifeFinish}` : `${item.name} | ?`;
  }
  return `${item.name} | ${item.skinName}`;
}

// ---------- Комиссии ----------
export function sellCommission(marketPro: boolean): number {
  return marketPro ? MARKET_COMMISSION_PRO : MARKET_COMMISSION;
}

export function sellPayout(price: number, marketPro: boolean, sellBonusActive: boolean): number {
  const payout = price * (1 - sellCommission(marketPro)) * (sellBonusActive ? 1.02 : 1);
  return Math.max(1, Math.round(payout));
}

export function buyTotal(price: number, buyDiscountActive: boolean): number {
  const v = price * (buyDiscountActive ? 0.97 : 1);
  return Math.max(1, Math.round(v));
}

// ---------- Временные бусты: активность ----------
export interface CaseupBoostsState {
  marketPro: boolean;
  luckyTicket: boolean;
  buyDiscountUntil: string | null;
  sellBonusUntil: string | null;
  upgradeChanceUntil: string | null;
  caseLuckUntil: string | null;
}

export function boostActiveUntil(state: CaseupBoostsState, id: CaseupBoostId): number | null {
  const map: Record<CaseupBoostId, string | null> = {
    market_pro: null,
    lucky_ticket: null,
    buy_discount: state.buyDiscountUntil,
    sell_bonus: state.sellBonusUntil,
    upgrade_chance: state.upgradeChanceUntil,
    case_luck: state.caseLuckUntil,
  };
  const until = map[id];
  if (!until) return null;
  const t = new Date(until).getTime();
  return t > Date.now() ? t : null;
}

export function isBoostActive(state: CaseupBoostsState, id: CaseupBoostId): boolean {
  if (id === "market_pro") return state.marketPro;
  if (id === "lucky_ticket") return state.luckyTicket;
  return boostActiveUntil(state, id) !== null;
}

export function emptyBoosts(): CaseupBoostsState {
  return {
    marketPro: false,
    luckyTicket: false,
    buyDiscountUntil: null,
    sellBonusUntil: null,
    upgradeChanceUntil: null,
    caseLuckUntil: null,
  };
}

// ---------- Локальный (демо) режим ----------
export interface LocalInventoryRow {
  id: string;
  itemId: string;
  knifeFinish: string | null;
  source: "case" | "market" | "upgrade";
  pricePaid: number;
  createdAt: string;
}

export interface LocalTradeRow {
  id: string;
  itemId: string;
  kind: "buy" | "sell";
  price: number;
  createdAt: string;
}

export interface LocalCaseupState {
  prices: Record<string, number>;
  inventory: LocalInventoryRow[];
  boosts: CaseupBoostsState;
  opensCount: number;
  spent: number;
  trades: LocalTradeRow[];
}

export const LOCAL_CASEUP_KEY_PREFIX = "njdc_caseup_v1_";

export function loadLocalCaseup(userId: string): LocalCaseupState {
  try {
    const raw = localStorage.getItem(LOCAL_CASEUP_KEY_PREFIX + userId);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        prices: typeof p.prices === "object" && p.prices ? p.prices : {},
        inventory: Array.isArray(p.inventory) ? p.inventory : [],
        boosts: { ...emptyBoosts(), ...(typeof p.boosts === "object" && p.boosts ? p.boosts : {}) },
        opensCount: typeof p.opensCount === "number" ? p.opensCount : 0,
        spent: typeof p.spent === "number" ? p.spent : 0,
        trades: Array.isArray(p.trades) ? p.trades : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { prices: {}, inventory: [], boosts: emptyBoosts(), opensCount: 0, spent: 0, trades: [] };
}

export function saveLocalCaseup(userId: string, state: LocalCaseupState) {
  try {
    localStorage.setItem(LOCAL_CASEUP_KEY_PREFIX + userId, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function localPrice(state: LocalCaseupState, item: CaseupItemDef): number {
  return state.prices[item.id] ?? item.basePrice;
}

export function setLocalPrice(state: LocalCaseupState, itemId: string, price: number): LocalCaseupState {
  return { ...state, prices: { ...state.prices, [itemId]: price } };
}

export function genLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Взвешенный выбор предмета из кейса (демо-режим; на сервере та же логика). */
export function rollCaseItem(
  caseDef: { knifeItemId: string; knifeChance: number },
  skins: CaseupItemDef[],
  knife: CaseupItemDef | undefined,
  luckBoost: boolean
): { item: CaseupItemDef; knifeFinish: string | null } {
  // Буст "Фортуна Открывателя": вес редких (кроме mil-spec) умножаем на 1.03
  const weightOf = (it: CaseupItemDef): number => {
    if (it.rarity === "knife") return 1;
    let w = it.dropChance;
    if (luckBoost && it.rarity !== "mil-spec") w *= 1.03;
    return Math.max(0.0001, w);
  };
  const knifeW = luckBoost ? caseDef.knifeChance * 1.03 : caseDef.knifeChance;
  const entries: { item: CaseupItemDef; w: number }[] = [];
  if (knife) entries.push({ item: knife, w: knifeW });
  for (const s of skins) entries.push({ item: s, w: weightOf(s) });
  const total = entries.reduce((a, e) => a + e.w, 0);
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.w;
    if (roll <= 0) return { item: e.item, knifeFinish: e.item.rarity === "knife" ? pickKnifeFinish() : null };
  }
  const last = entries[entries.length - 1];
  return { item: last.item, knifeFinish: last.item.rarity === "knife" ? pickKnifeFinish() : null };
}
