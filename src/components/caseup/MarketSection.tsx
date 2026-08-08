// ============================================================
// CASEUP by 1DONY — раздел «Рынок».
// Автоматический рынок: предметы покупаются и продаются не
// между пользователями, а напрямую у рынка. Цены дрейфуют от
// спроса и предложения (покупки толкают цену вверх, продажи —
// вниз), без фактора времени.
// ============================================================
import { useMemo, useState } from "react";
import { Search, Store, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, History, ShoppingCart, Wallet } from "lucide-react";
import { useCaseup } from "../../context/CaseupContext";
import { useNodbet } from "../../context/NodbetContext";
import { useUserAuth } from "../../context/UserAuthContext";
import { fmtNod, sellPayout, priceTrend, rarityMeta, RARITY_ORDER, type CaseupRarity } from "../../utils/caseup";
import { itemDisplayName } from "../../utils/caseup";
import { SectionTitle, ItemCard, PriceChip, CaseupButton, EmptyState, useFilteredItems } from "./CaseupShared";

type SortKey = "relevant" | "expensive" | "cheap";

const RARITY_FILTERS: { id: CaseupRarity; label: string }[] = RARITY_ORDER.map((r) => ({ id: r, label: rarityMeta(r).label }));

export default function MarketSection() {
  const { allItems, inventory, trades, marketBuy, marketSell, boosts, notify, mode } = useCaseup();
  const { balance } = useNodbet();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const [query, setQuery] = useState("");
  const [rarities, setRarities] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("relevant");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sellBusy, setSellBusy] = useState<string | null>(null);

  const online = mode === "online";

  const filtered = useFilteredItems(allItems, query, rarities, sort);

  const toggleRarity = (r: string) => {
    setRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const requireAuth = (): boolean => {
    if (online && !user) {
      setAuthMode("signin");
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleBuy = async (itemId: string) => {
    if (!requireAuth()) return;
    setBusyId(itemId);
    const res = await marketBuy(itemId);
    setBusyId(null);
    if (!res.ok) notify(res.error || "Ошибка покупки", false);
    else notify(`Куплено за ${fmtNod(res.newPrice ?? 0)} NOD`);
  };

  const handleSell = async (invId: string, itemId: string) => {
    if (!requireAuth()) return;
    setSellBusy(invId);
    const res = await marketSell(invId);
    setSellBusy(null);
    if (!res.ok) notify(res.error || "Ошибка продажи", false);
    else {
      const item = allItems.find((i) => i.id === itemId);
      notify(`Продано за ${fmtNod(res.payout ?? 0)} NOD${item ? ` (${itemDisplayName(item)})` : ""}`);
    }
  };

  // Мои предметы (для быстрой продажи)
  const mySellable = useMemo(() => {
    return inventory
      .map((r) => ({ row: r, item: allItems.find((i) => i.id === r.itemId) }))
      .filter((x): x is { row: (typeof inventory)[number]; item: NonNullable<typeof x.item> } => !!x.item)
      .slice(0, 8);
  }, [inventory, allItems]);

  return (
    <div>
      <SectionTitle
        icon={<Store size={20} />}
        title="Рынок"
        subtitle="Покупай и продавай скины за NOD-Коины. Цены двигаются от спроса и предложения — лови момент!"
        right={
          <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-1.5 font-mono text-xs font-bold text-yellow-400">
            <Wallet size={12} className="mr-1 inline" /> {fmtNod(balance)} NOD
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ------ Левая колонка: каталог ------ */}
        <div>
          {/* Управление */}
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#141414] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по названию..."
                  className="w-full rounded-lg border border-white/10 bg-[#0e0e0e] py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-violet-500/60"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-white/10 bg-[#0e0e0e] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500/60"
              >
                <option value="relevant">Релевантные</option>
                <option value="expensive">Сначала дорогие</option>
                <option value="cheap">Сначала дешёвые</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Редкость:</span>
              {RARITY_FILTERS.map((r) => {
                const meta = rarityMeta(r.id);
                const active = rarities.has(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRarity(r.id)}
                    className="rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all"
                    style={{
                      color: active ? meta.color : "#71717a",
                      borderColor: active ? `${meta.color}88` : "rgba(255,255,255,0.1)",
                      background: active ? meta.soft : "transparent",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
              {rarities.size > 0 && (
                <button onClick={() => setRarities(new Set())} className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Сетка предметов */}
          {filtered.length === 0 ? (
            <EmptyState icon={<Search size={40} />} title="Ничего не найдено" hint="Попробуйте изменить запрос или фильтры." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => {
                const trend = priceTrend(item.currentPrice, item.basePrice);
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    footer={
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <PriceChip value={item.currentPrice} className="text-xs" />
                          <span
                            className={`inline-flex items-center gap-0.5 font-mono text-[9px] font-bold ${
                              trend > 0.001 ? "text-emerald-400" : trend < -0.001 ? "text-red-400" : "text-zinc-600"
                            }`}
                            title="Отклонение от базовой цены"
                          >
                            {trend > 0.001 ? <TrendingUp size={10} /> : trend < -0.001 ? <TrendingDown size={10} /> : null}
                            {trend > 0.001 ? "+" : ""}
                            {(trend * 100).toFixed(0)}%
                          </span>
                        </div>
                        <CaseupButton
                          onClick={() => handleBuy(item.id)}
                          disabled={busyId === item.id}
                          variant="primary"
                          className="w-full py-1.5! text-xs"
                        >
                          <ShoppingCart size={13} /> {busyId === item.id ? "Покупаем..." : "Купить"}
                        </CaseupButton>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Мои предметы — быстрая продажа */}
          {mySellable.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <ArrowUpRight size={14} className="text-emerald-400" /> Мои предметы — продать по рыночной цене
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {mySellable.map(({ row, item }) => {
                  const payout = sellPayout(item.currentPrice, boosts.marketPro, false);
                  return (
                    <ItemCard
                      key={row.id}
                      item={item}
                      knifeFinish={row.knifeFinish}
                      compact
                      footer={
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-zinc-500">+{fmtNod(payout)}</span>
                          <button
                            onClick={() => handleSell(row.id, item.id)}
                            disabled={sellBusy === row.id}
                            className="rounded-md bg-emerald-600/80 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {sellBusy === row.id ? "..." : "Продать"}
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ------ Правая колонка: лента сделок ------ */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <History size={15} className="text-violet-400" /> Последние сделки
            </div>
            {trades.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-600">Сделок пока нет — стань первым!</div>
            ) : (
              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {trades.map((t) => {
                  const item = allItems.find((i) => i.id === t.itemId);
                  if (!item) return null;
                  const meta = rarityMeta(item.rarity);
                  const isBuy = t.kind === "buy";
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
                      <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded bg-[#101010] object-contain p-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-zinc-200">{itemDisplayName(item)}</div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase ${isBuy ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {isBuy ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                            {isBuy ? "куплен" : "продан"}
                          </span>
                          <span className="text-[9px]" style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                      </div>
                      <div className="font-mono text-[10px] font-bold text-yellow-400">{fmtNod(t.price)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#141414] p-4 text-[11px] leading-relaxed text-zinc-500">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white">
              <TrendingUp size={14} className="text-emerald-400" /> Как работает рынок
            </div>
            <ul className="space-y-1.5">
              <li>• Ты покупаешь и продаёшь предметы напрямую у рынка, а не у других игроков.</li>
              <li>• Каждая покупка немного поднимает цену предмета, каждая продажа — опускает.</li>
              <li>• Комиссия рынка при продаже: <b className="text-zinc-300">5%</b>{boosts.marketPro && <span className="text-emerald-400"> (у тебя 4% — Маркет-Профи!)</span>}.</li>
              <li>• Кейсы на рынке не продаются — только скины и ножи.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
