// ============================================================
// CASEUP by 1DONY — главная страница игры.
// Слоган: Open. Upgrade. Profit.
// Разделы: Кейсы · Апгрейд · Рынок · Магазин · Топ открывателей · Инвентарь
// ============================================================
import { useEffect, useState } from "react";
import { Box, Store, ShoppingBag, Trophy, Backpack, TriangleAlert, Flame, Hammer } from "lucide-react";
import { useCaseup } from "../context/CaseupContext";
import { useNodbet } from "../context/NodbetContext";
import { fmtNod } from "../utils/caseup";
import CasesSection from "../components/caseup/CasesSection";
import UpgradeSection from "../components/caseup/UpgradeSection";
import MarketSection from "../components/caseup/MarketSection";
import ShopSection from "../components/caseup/ShopSection";
import TopOpenersSection from "../components/caseup/TopOpenersSection";
import InventorySection from "../components/caseup/InventorySection";

type TabKey = "cases" | "upgrade" | "market" | "shop" | "top" | "inventory";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "cases", label: "Кейсы", icon: <Box size={15} /> },
  { key: "upgrade", label: "Апгрейд", icon: <Hammer size={15} /> },
  { key: "market", label: "Рынок", icon: <Store size={15} /> },
  { key: "shop", label: "Магазин", icon: <ShoppingBag size={15} /> },
  { key: "top", label: "Топ открывателей", icon: <Trophy size={15} /> },
  { key: "inventory", label: "Инвентарь", icon: <Backpack size={15} /> },
];

export default function CaseupPage() {
  const { demoMode, loading, inventory, toast, balance } = useCaseup();
  const { balance: nodBalance } = useNodbet();
  const [tab, setTab] = useState<TabKey>("cases");
  // Предвыбранный предмет для раздела «Апгрейд» (переход из инвентаря)
  const [upgradeInvId, setUpgradeInvId] = useState<string | null>(null);

  // Переход в инвентарь из модалок открытия
  useEffect(() => {
    const handler = () => setTab("inventory");
    window.addEventListener("caseup-goto-inventory", handler);
    return () => window.removeEventListener("caseup-goto-inventory", handler);
  }, []);

  // Переходы между разделами (кнопки «К кейсам», «В инвентарь» и т.п.)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: string } | undefined;
      if (detail?.tab) setTab(detail.tab as TabKey);
    };
    window.addEventListener("caseup-goto-tab", handler);
    return () => window.removeEventListener("caseup-goto-tab", handler);
  }, []);

  // Переход в раздел «Апгрейд» с предвыбранным предметом из инвентаря
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { invId?: string | null } | undefined;
      setUpgradeInvId(detail?.invId ?? null);
      setTab("upgrade");
    };
    window.addEventListener("caseup-goto-upgrade", handler);
    return () => window.removeEventListener("caseup-goto-upgrade", handler);
  }, []);

  const displayBalance = balance || nodBalance;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ===== Шапка 1DONY ===== */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-r from-violet-950/70 via-[#141018] to-fuchsia-950/40 p-6 shadow-2xl sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-yellow-400" />
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-fuchsia-600/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-300">
                by 1DONY
              </span>
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-yellow-300">
                🎁 CASEUP
              </span>
            </div>
            <h1 className="font-display mt-3 text-4xl font-black tracking-wide text-white sm:text-5xl">
              Open. <span className="text-gradient">Upgrade.</span> Profit.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Открывай кейсы как в CS2, выбивай скины и ножи, продавай на живом рынке и апгрейдь оружие в «Модернизации 2.0».
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-red-500/10 px-4 py-2.5">
              <Flame size={18} className="fill-yellow-400 text-yellow-400" />
              <span className="font-mono text-lg font-black text-yellow-400">{fmtNod(displayBalance)}</span>
              <span className="text-xs font-bold text-yellow-500/70">NOD</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              {loading ? "Загрузка..." : demoMode ? "Демо-режим (localStorage)" : "Онлайн · Supabase"}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Демо-баннер ===== */}
      {demoMode && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3.5">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="text-xs leading-relaxed text-amber-200/90">
            <b>Демо-режим CASEUP:</b> таблицы игры ещё не созданы в Supabase. Примените файл{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-300">supabase-caseup-migration.sql</code>{" "}
            в SQL Editor вашего проекта — и игра переключится на онлайн автоматически (прогресс демо-режима хранится только в этом браузере).
          </div>
        </div>
      )}

      {/* ===== Вкладки ===== */}
      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#141414] p-2 shadow-lg">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              // При ручном переходе в «Апгрейд» не тащим старый предвыбор из инвентаря
              if (t.key === "upgrade") setUpgradeInvId(null);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all sm:text-sm ${
              tab === t.key
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 text-white shadow-lg shadow-violet-900/40"
                : "text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t.icon}
            {t.label}
            {t.key === "inventory" && inventory.length > 0 && (
              <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white">{inventory.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Контент ===== */}
      <div className="mt-6">
        {tab === "cases" && <CasesSection />}
        {tab === "upgrade" && <UpgradeSection initialInvId={upgradeInvId} />}
        {tab === "market" && <MarketSection />}
        {tab === "shop" && <ShopSection />}
        {tab === "top" && <TopOpenersSection />}
        {tab === "inventory" && <InventorySection />}
      </div>

      {/* ===== Тост ===== */}
      {toast && (
        <div
          key={toast.id}
          className={`animate-fade-in fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl border px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
            toast.ok ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-300" : "border-red-500/40 bg-red-950/90 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
