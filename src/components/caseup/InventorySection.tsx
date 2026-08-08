// ============================================================
// CASEUP by 1DONY — раздел «Инвентарь».
// Аккуратная сетка полученных предметов: карточка с изображением,
// названием, редкостью и стоимостью. Поиск, фильтры, сортировка.
// Клик по предмету — подробная информация и действия:
// продажа на рынке, апгрейд.
// ============================================================
import { useMemo, useState } from "react";
import { Backpack, Search, Hammer, ShoppingCart, X, Calendar, Tag, Info } from "lucide-react";
import { useCaseup, type CaseupInventoryRow } from "../../context/CaseupContext";
import { useUserAuth } from "../../context/UserAuthContext";
import {
  fmtNod,
  rarityMeta,
  RARITY_ORDER,
  sellPayout,
  itemDisplayName,
  type CaseupItemView,
} from "../../utils/caseup";
import { SectionTitle, ItemCard, PriceChip, CaseupButton, EmptyState, RarityPlate } from "./CaseupShared";
import UpgradeModal from "./UpgradeModal";

type SortKey = "recent" | "price_high" | "price_low" | "rarity";

const SOURCE_LABEL: Record<string, string> = {
  case: "Открыт из кейса",
  market: "Куплен на рынке",
  upgrade: "Получен в апгрейде",
};

// ---------- Детальная карточка предмета ----------
function ItemDetailModal({
  row,
  item,
  onClose,
  onUpgrade,
}: {
  row: CaseupInventoryRow;
  item: CaseupItemView;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const { marketSell, boosts, notify, mode } = useCaseup();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const [selling, setSelling] = useState(false);
  const meta = rarityMeta(item.rarity);
  const payout = sellPayout(item.currentPrice, boosts.marketPro, false);
  const online = mode === "online";

  const handleSell = async () => {
    if (online && !user) {
      setAuthMode("signin");
      setAuthModalOpen(true);
      return;
    }
    setSelling(true);
    const res = await marketSell(row.id);
    setSelling(false);
    if (!res.ok) notify(res.error || "Ошибка продажи", false);
    else {
      notify(`Продано за ${fmtNod(res.payout ?? 0)} NOD`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div
          className="relative flex h-44 items-center justify-center border-b border-white/5"
          style={{ background: `radial-gradient(ellipse at center, ${meta.glow} 0%, #101010 72%)` }}
        >
          <img src={item.image} alt={itemDisplayName(item, row.knifeFinish)} className="h-36 w-36 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.7)]" />
          <button onClick={onClose} className="absolute right-3 top-3 rounded-lg bg-black/50 p-2 text-zinc-300 backdrop-blur transition-colors hover:bg-black/80 hover:text-white">
            <X size={16} />
          </button>
          <div className="absolute left-3 top-3">
            <RarityPlate rarity={item.rarity} />
          </div>
        </div>

        <div className="p-5">
          <h3 className="font-display text-xl font-bold text-white">{itemDisplayName(item, row.knifeFinish)}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-zinc-600">·</span>
            <PriceChip value={item.currentPrice} />
          </div>

          {/* Информация */}
          <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-zinc-400">
            <div className="flex items-center gap-2">
              <Tag size={12} className="text-zinc-600" />
              Текущая цена рынка: <b className="text-yellow-400">{fmtNod(item.currentPrice)} NOD</b>
              {item.currentPrice !== item.basePrice && (
                <span className="text-zinc-600">(базовая {fmtNod(item.basePrice)})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-zinc-600" />
              Получен: <b className="text-zinc-300">{new Date(row.createdAt).toLocaleString("ru-RU")}</b>
            </div>
            <div className="flex items-center gap-2">
              <Info size={12} className="text-zinc-600" />
              Происхождение: <b className="text-zinc-300">{SOURCE_LABEL[row.source] ?? row.source}</b>
              {row.pricePaid > 0 && <> · уплачено {fmtNod(row.pricePaid)} NOD</>}
            </div>
          </div>

          {/* Действия */}
          <div className="mt-4 flex flex-col gap-2">
            <CaseupButton onClick={handleSell} variant="success" disabled={selling} className="w-full">
              <ShoppingCart size={15} /> {selling ? "Продаём..." : `Продать на рынке за ${fmtNod(payout)} NOD`}
            </CaseupButton>
            <CaseupButton onClick={onUpgrade} variant="gold" className="w-full">
              <Hammer size={15} /> Апгрейд оружия
            </CaseupButton>
          </div>
          <div className="mt-3 text-center text-[10px] text-zinc-600">
            Комиссия рынка при продаже: {boosts.marketPro ? "4% (Маркет-Профи)" : "5%"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Раздел ----------
export default function InventorySection() {
  const { inventory, allItems, marketSell, boosts, notify, mode } = useCaseup();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const [query, setQuery] = useState("");
  const [rarities, setRarities] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("recent");
  const [detail, setDetail] = useState<CaseupInventoryRow | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<string | null>(null);
  const [sellBusy, setSellBusy] = useState<string | null>(null);
  const online = mode === "online";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const joined = inventory
      .map((r) => ({ row: r, item: allItems.find((i) => i.id === r.itemId) }))
      .filter((x): x is { row: CaseupInventoryRow; item: CaseupItemView } => !!x.item);

    let list = joined.filter(({ row, item }) => {
      if (rarities.size && !rarities.has(item.rarity)) return false;
      if (q && !`${item.name} ${item.skinName} ${row.knifeFinish ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (sort === "price_high") list = [...list].sort((a, b) => b.item.currentPrice - a.item.currentPrice);
    else if (sort === "price_low") list = [...list].sort((a, b) => a.item.currentPrice - b.item.currentPrice);
    else if (sort === "rarity") list = [...list].sort((a, b) => rarityMeta(b.item.rarity).order - rarityMeta(a.item.rarity).order);
    else list = [...list].sort((a, b) => new Date(b.row.createdAt).getTime() - new Date(a.row.createdAt).getTime());
    return list;
  }, [inventory, allItems, query, rarities, sort]);

  const totalValue = useMemo(() => rows.reduce((acc, { item }) => acc + item.currentPrice, 0), [rows]);

  const toggleRarity = (r: string) => {
    setRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const quickSell = async (row: CaseupInventoryRow) => {
    if (online && !user) {
      setAuthMode("signin");
      setAuthModalOpen(true);
      return;
    }
    setSellBusy(row.id);
    const res = await marketSell(row.id);
    setSellBusy(null);
    if (!res.ok) notify(res.error || "Ошибка продажи", false);
    else notify(`Продано за ${fmtNod(res.payout ?? 0)} NOD`);
  };

  const detailItem = detail ? allItems.find((i) => i.id === detail.itemId) ?? null : null;

  return (
    <div>
      <SectionTitle
        icon={<Backpack size={20} />}
        title="Инвентарь"
        subtitle={`Все полученные предметы — ${inventory.length} шт., общая стоимость ${fmtNod(totalValue)} NOD`}
        right={
          <CaseupButton variant="gold" onClick={() => setUpgradeFor(null)}>
            <Hammer size={15} /> Апгрейд оружия 2.0
          </CaseupButton>
        }
      />

      {/* Управление */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#141414] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full rounded-lg border border-white/10 bg-[#0e0e0e] py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/60"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-[#0e0e0e] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500/60"
          >
            <option value="recent">Сначала новые</option>
            <option value="price_high">Сначала дорогие</option>
            <option value="price_low">Сначала дешёвые</option>
            <option value="rarity">По редкости</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Редкость:</span>
          {RARITY_ORDER.map((rid) => {
            const meta = rarityMeta(rid);
            const active = rarities.has(rid);
            return (
              <button
                key={rid}
                onClick={() => toggleRarity(rid)}
                className="rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all"
                style={{
                  color: active ? meta.color : "#71717a",
                  borderColor: active ? `${meta.color}88` : "rgba(255,255,255,0.1)",
                  background: active ? meta.soft : "transparent",
                }}
              >
                {meta.label}
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

      {/* Сетка */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Backpack size={40} />}
          title={inventory.length === 0 ? "Инвентарь пуст" : "Ничего не найдено"}
          hint={
            inventory.length === 0
              ? "Открой кейсы в разделе «Кейсы» или купи предметы на рынке — всё выпавшее хранится здесь."
              : "Попробуйте изменить запрос или фильтры."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {rows.map(({ row, item }) => {
            const payout = sellPayout(item.currentPrice, boosts.marketPro, false);
            return (
              <ItemCard
                key={row.id}
                item={item}
                knifeFinish={row.knifeFinish}
                onClick={() => setDetail(row)}
                footer={
                  <div className="flex items-center justify-between gap-1">
                    <PriceChip value={item.currentPrice} className="text-[10px]" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        quickSell(row);
                      }}
                      disabled={sellBusy === row.id}
                      title={`Продать за ${fmtNod(payout)} NOD`}
                      className="rounded-md bg-emerald-600/80 px-2 py-1 text-[9px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {sellBusy === row.id ? "..." : "Продать"}
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {detail && detailItem && (
        <ItemDetailModal
          row={detail}
          item={detailItem}
          onClose={() => setDetail(null)}
          onUpgrade={() => {
            setUpgradeFor(detail.id);
            setDetail(null);
          }}
        />
      )}
      <UpgradeModal open={upgradeFor !== null} initialInvId={upgradeFor} onClose={() => setUpgradeFor(null)} onGoInventory={() => setUpgradeFor(null)} />
    </div>
  );
}
