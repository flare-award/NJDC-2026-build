// ============================================================
// CASEUP by 1DONY — раздел «Магазин».
// Лёгкие бусты без читов: постоянные (комиссия, +1.5% апгрейд)
// и временные (активируются сразу после покупки, 30-90 минут).
// Никаких «скидок 30-100%», бесплатных открытий и прочего читерства.
// ============================================================
import { useMemo, useState } from "react";
import { ShoppingBag, Timer, BadgeCheck, Zap } from "lucide-react";
import { CASEUP_BOOSTS, type CaseupBoostId } from "../../data/caseupCatalog";
import { useCaseup } from "../../context/CaseupContext";
import { useNodbet } from "../../context/NodbetContext";
import { useUserAuth } from "../../context/UserAuthContext";
import { fmtNod, isBoostActive, boostActiveUntil } from "../../utils/caseup";
import { SectionTitle, CaseupButton, useNow, formatRemaining } from "./CaseupShared";

export default function ShopSection() {
  const { boosts, buyBoost, notify, mode } = useCaseup();
  const { balance } = useNodbet();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const [busyId, setBusyId] = useState<CaseupBoostId | null>(null);
  const now = useNow();
  const online = mode === "online";

  const permanent = useMemo(() => CASEUP_BOOSTS.filter((b) => b.permanent), []);
  const temporary = useMemo(() => CASEUP_BOOSTS.filter((b) => !b.permanent), []);

  const handleBuy = async (id: CaseupBoostId) => {
    if (online && !user) {
      setAuthMode("signin");
      setAuthModalOpen(true);
      return;
    }
    setBusyId(id);
    const res = await buyBoost(id);
    setBusyId(null);
    if (!res.ok) notify(res.error || "Ошибка покупки", false);
    else {
      const def = CASEUP_BOOSTS.find((b) => b.id === id);
      notify(`${def?.name} активирован!`);
    }
  };

  const renderCard = (id: CaseupBoostId) => {
    const def = CASEUP_BOOSTS.find((b) => b.id === id)!;
    const active = isBoostActive(boosts, id);
    const until = boostActiveUntil(boosts, id);
    const remaining = until ? until - now : null;
    return (
      <div
        key={id}
        className={`flex flex-col rounded-2xl border p-4 transition-all ${
          active ? "border-emerald-500/40 bg-emerald-500/[0.05]" : "border-white/10 bg-[#141414] hover:border-white/20"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-2xl">{def.icon}</div>
          <span
            className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-zinc-500"
            }`}
          >
            {active ? (def.permanent ? "Куплено" : "Активен") : def.badge}
          </span>
        </div>
        <div className="mt-2.5 font-display text-base font-bold text-white">{def.name}</div>
        <p className="mt-1 flex-1 text-[11px] leading-relaxed text-zinc-500">{def.description}</p>

        {active && remaining !== null && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 self-start rounded-lg bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
            <Timer size={13} /> {formatRemaining(remaining)}
          </div>
        )}
        {active && def.permanent && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 self-start rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
            <BadgeCheck size={13} /> Действует навсегда
          </div>
        )}

        <CaseupButton
          onClick={() => handleBuy(id)}
          disabled={active || busyId === id}
          variant={active ? "ghost" : "gold"}
          className="mt-3 w-full"
        >
          <ShoppingBag size={14} />
          {active ? (def.permanent ? "Куплено" : "Уже активен") : `${fmtNod(def.cost)} NOD`}
        </CaseupButton>
      </div>
    );
  };

  return (
    <div>
      <SectionTitle
        icon={<ShoppingBag size={20} />}
        title="Магазин"
        subtitle="Лёгкие улучшения для кейсов и рынка. Никаких читерских скидок — только честные мелочи."
        right={
          <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-1.5 font-mono text-xs font-bold text-yellow-400">
            Баланс: {fmtNod(balance)} NOD
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
        <BadgeCheck size={14} className="text-emerald-400" /> Постоянные бусты
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{permanent.map((b) => renderCard(b.id))}</div>

      <div className="mb-3 mt-7 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
        <Timer size={14} className="text-amber-400" /> Временные бусты (активируются сразу после покупки)
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{temporary.map((b) => renderCard(b.id))}</div>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3.5 text-[11px] leading-relaxed text-zinc-500">
        <Zap size={14} className="mt-0.5 shrink-0 text-yellow-500" />
        <span>
          Все бусты намеренно лёгкие и не ломают баланс: скидки на рынке не превышают 3–4%, бонусы к шансам — единицы процентов.
          Шансы выпадения предметов из кейсов остаются честными для всех.
        </span>
      </div>
    </div>
  );
}
