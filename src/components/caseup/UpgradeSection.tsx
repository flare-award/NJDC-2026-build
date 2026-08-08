// ============================================================
// CASEUP by 1DONY — раздел «Апгрейд» (Модернизация Оружия 2.0).
// Отдельный раздел вкладки 1DONY: ставишь предмет из инвентаря,
// выбираешь цель дороже и запускаешь рулетку. Шанс успеха зависит
// от разницы цен (r^1.1); результат определяет сервер (в демо-режиме
// клиент с той же математикой), рулетка лишь показывает исход.
// При неудаче предмет сгорает. При успехе — получаешь цель.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Box, Hammer, Package, RefreshCw, Search, Store } from "lucide-react";
import { useCaseup, type CaseupInventoryRow } from "../../context/CaseupContext";
import { fmtNod, rarityMeta, upgradeChance, itemDisplayName, isBoostActive, boostActiveUntil, type CaseupItemView } from "../../utils/caseup";
import { useNodbet } from "../../context/NodbetContext";
import { PriceChip, CaseupButton, ItemArt, EmptyState, SectionTitle, useNow, formatRemaining } from "./CaseupShared";

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// ---------- Сектор круга для SVG ----------
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function Wheel({ chance, spinning, onSpinEnd, success }: { chance: number; spinning: boolean; onSpinEnd: () => void; success: boolean }) {
  const size = 240;
  const c = size / 2;
  const r = 104;
  const [rotation, setRotation] = useState(0);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const successAngle = Math.max(2, Math.min(358, (chance / 100) * 360));

  // Сектора (по часовой от 12 часов)
  const sectors = useMemo(() => {
    const mk = (a1: number, a2: number) => {
      const large = a2 - a1 > 180 ? 1 : 0;
      const [x1, y1] = polar(c, c, r, a1);
      const [x2, y2] = polar(c, c, r, a2);
      return `M ${c} ${c} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    };
    return [
      { path: mk(0, successAngle), fill: "rgba(34,197,94,0.28)", stroke: "rgba(34,197,94,0.7)" },
      { path: mk(successAngle, 360), fill: "rgba(239,68,68,0.24)", stroke: "rgba(239,68,68,0.6)" },
    ];
  }, [successAngle]);

  // Запуск вращения при старте спина
  useEffect(() => {
    if (!spinning) return;
    doneRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const spins = 6 + Math.floor(Math.random() * 4);
    const targetAngle = success ? successAngle * Math.random() : successAngle + Math.random() * (360 - successAngle);
    const targetRot = spins * 360 + (360 - targetAngle);
    const duration = 3200;
    const t0 = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      setRotation(targetRot * easeOutQuart(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setRotation(targetRot);
        setTimeout(onSpinEnd, 500);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  const ticks = useMemo(() => {
    const arr: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let a = 0; a < 360; a += 30) {
      const [x1, y1] = polar(c, c, r - 8, a);
      const [x2, y2] = polar(c, c, r - 14, a);
      arr.push({ x1, y1, x2, y2 });
    }
    return arr;
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r + 6} fill="#1c1c1c" stroke="rgba(255,255,255,0.12)" />
        <g transform={`rotate(${rotation} ${c} ${c})`}>
          {sectors.map((s, i) => (
            <path key={i} d={s.path} fill={s.fill} stroke={s.stroke} strokeWidth={1} />
          ))}
          {ticks.map((t, i) => (
            <line key={i} {...t} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
          ))}
        </g>
        <circle cx={c} cy={c} r={26} fill="#262626" stroke="rgba(255,255,255,0.2)" />
      </svg>
      {/* Стрелка сверху */}
      <div className="absolute left-1/2 top-[-6px] -translate-x-1/2">
        <div className="h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]" />
      </div>
      {/* Центр: шанс */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-xl font-black text-white">{chance.toFixed(1).replace(".", ",")}%</div>
          <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">успех</div>
        </div>
      </div>
    </div>
  );
}

/** Переход на раздел вкладки 1DONY. */
function goTo(tab: string) {
  window.dispatchEvent(new CustomEvent("caseup-goto-tab", { detail: { tab } }));
}

export default function UpgradeSection({ initialInvId }: { initialInvId: string | null }) {
  const { inventory, allItems, upgradeItem, boosts } = useCaseup();
  const { balance } = useNodbet();
  const [sourceId, setSourceId] = useState<string | null>(initialInvId);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"pick" | "rolling" | "result">("pick");
  const [outcome, setOutcome] = useState<{ success: boolean; chance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  // Сброс при монтировании раздела или при новом initialInvId (переход из инвентаря)
  useEffect(() => {
    setSourceId(initialInvId);
    setTargetId(null);
    setQuery("");
    setPhase("pick");
    setOutcome(null);
    setError(null);
  }, [initialInvId]);

  const sourceRow: CaseupInventoryRow | null = sourceId ? inventory.find((r) => r.id === sourceId) ?? null : null;
  const sourceItem = sourceRow ? allItems.find((i) => i.id === sourceRow.itemId) ?? null : null;

  // Цели: дороже или равны источнику, исключая тот же предмет
  const targets = useMemo(() => {
    if (!sourceItem) return [];
    const q = query.trim().toLowerCase();
    return allItems
      .filter((i) => i.id !== sourceItem.id && i.currentPrice >= sourceItem.currentPrice)
      .filter((i) => (q ? `${i.name} ${i.skinName}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.currentPrice - b.currentPrice)
      .slice(0, 24);
  }, [allItems, sourceItem, query]);

  const targetItem: CaseupItemView | null = targetId ? allItems.find((i) => i.id === targetId) ?? null : null;

  const chance = useMemo(() => {
    if (!sourceItem || !targetItem) return 0;
    return upgradeChance(sourceItem.currentPrice, targetItem.currentPrice, {
      luckyTicket: boosts.luckyTicket,
      upgradeChanceActive: isBoostActive(boosts, "upgrade_chance"),
    });
  }, [sourceItem, targetItem, boosts]);

  // Активные бусты апгрейда (для подсказки)
  const boostChips = useMemo(() => {
    const chips: { text: string }[] = [];
    if (boosts.luckyTicket) chips.push({ text: "🍀 +1.5% (постоянно)" });
    const until = boostActiveUntil(boosts, "upgrade_chance");
    if (until) chips.push({ text: `🎯 +4% · осталось ${formatRemaining(until - now)}` });
    return chips;
  }, [boosts, now]);

  const handleRun = async () => {
    if (!sourceRow || !targetItem) return;
    if (sourceItem && targetItem.currentPrice < sourceItem.currentPrice) {
      setError("Цель должна быть не дешевле вашего предмета");
      return;
    }
    setError(null);
    setPhase("rolling");
    const res = await upgradeItem(sourceRow.id, targetItem.id);
    if (!res.ok || !res.outcome) {
      setError(res.error || "Ошибка апгрейда");
      setPhase("pick");
      return;
    }
    setOutcome({ success: res.outcome.success, chance: res.outcome.chance });
    // Ждём, пока рулетка доиграет — onSpinEnd переведёт в result
  };

  const onSpinEnd = () => {
    setPhase("result");
  };

  return (
    <div>
      <SectionTitle
        icon={<Hammer size={20} />}
        title="Апгрейд оружия 2.0"
        subtitle="Модернизация Оружия: поставь скин из инвентаря, выбери цель дороже и запусти рулетку. Шанс зависит от разницы цен — при неудаче предмет сгорает."
        right={
          boostChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {boostChips.map((c, i) => (
                <span key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                  {c.text}
                </span>
              ))}
            </div>
          ) : undefined
        }
      />

      {phase === "pick" && (
        <div className="rounded-2xl border border-white/10 bg-[#141414] p-5">
          {/* Шаг 1: источник */}
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Шаг 1 — выбери предмет из инвентаря
          </div>
          {inventory.length === 0 ? (
            <EmptyState
              icon={<Package size={32} />}
              title="Инвентарь пуст"
              hint="Открой кейсы или купи предмет на рынке, чтобы апгрейдить."
            />
          ) : (
            <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 md:grid-cols-7">
              {inventory.map((r) => {
                const item = allItems.find((i) => i.id === r.itemId);
                if (!item) return null;
                const meta = rarityMeta(item.rarity);
                const selected = sourceId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSourceId(r.id);
                      setTargetId(null);
                      setQuery("");
                      setError(null);
                    }}
                    className={`relative overflow-hidden rounded-lg border bg-[#181818] p-1.5 text-left transition-all ${
                      selected ? "ring-2" : "hover:bg-[#202020]"
                    }`}
                    style={{ borderColor: selected ? meta.color : "rgba(255,255,255,0.08)", boxShadow: selected ? `0 0 12px ${meta.glow}` : undefined }}
                  >
                    <ItemArt item={item} knifeFinish={r.knifeFinish} className="h-12" glow={false} />
                    <div className="mt-1 line-clamp-1 text-[8px] font-semibold text-zinc-300">{itemDisplayName(item, r.knifeFinish)}</div>
                    <div className="font-mono text-[8px] text-yellow-400">{fmtNod(item.currentPrice)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {inventory.length === 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <CaseupButton variant="ghost" onClick={() => goTo("cases")}>
                <Box size={15} /> К кейсам
              </CaseupButton>
              <CaseupButton variant="ghost" onClick={() => goTo("market")}>
                <Store size={15} /> На рынок
              </CaseupButton>
            </div>
          )}

          {sourceItem && sourceRow && (
            <>
              {/* Шаг 2: цель */}
              <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Шаг 2 — выбери цель (цена цели ≥ {fmtNod(sourceItem.currentPrice)} NOD)
              </div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск цели..."
                  className="w-full rounded-lg border border-white/10 bg-[#0e0e0e] py-2 pl-8 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/60"
                />
              </div>
              {targets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-zinc-500">
                  Нет предметов дороже или равных вашему.
                </div>
              ) : (
                <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-6">
                  {targets.map((item) => {
                    const meta = rarityMeta(item.rarity);
                    const selected = targetId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setTargetId(item.id)}
                        className={`relative overflow-hidden rounded-lg border bg-[#181818] p-1.5 text-left transition-all ${
                          selected ? "ring-2" : "hover:bg-[#202020]"
                        }`}
                        style={{ borderColor: selected ? meta.color : "rgba(255,255,255,0.08)", boxShadow: selected ? `0 0 12px ${meta.glow}` : undefined }}
                      >
                        <ItemArt item={item} className="h-12" glow={false} />
                        <div className="mt-1 line-clamp-1 text-[8px] font-semibold text-zinc-300">{itemDisplayName(item)}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[7px] font-bold uppercase" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="font-mono text-[8px] text-yellow-400">{fmtNod(item.currentPrice)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Сводка и шанс */}
              {targetItem && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#181818] p-4">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-24 text-center">
                      <ItemArt item={sourceItem} knifeFinish={sourceRow.knifeFinish} className="mx-auto h-14" />
                      <div className="mt-1 line-clamp-1 text-[9px] text-zinc-400">{itemDisplayName(sourceItem, sourceRow.knifeFinish)}</div>
                      <PriceChip value={sourceItem.currentPrice} className="text-[10px]" />
                    </div>
                    <ArrowRight size={20} className="text-zinc-600" />
                    <div className="w-24 text-center">
                      <ItemArt item={targetItem} className="mx-auto h-14" />
                      <div className="mt-1 line-clamp-1 text-[9px] text-zinc-400">{itemDisplayName(targetItem)}</div>
                      <PriceChip value={targetItem.currentPrice} className="text-[10px]" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-zinc-400">Шанс успеха</span>
                      <span className="font-mono font-black text-emerald-400">{chance.toFixed(1).replace(".", ",")}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                        style={{ width: `${chance}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-relaxed text-zinc-500">
                      <span>
                        Чем ближе цены, тем выше шанс. При неудаче предмет <b className="text-red-400">сгорает</b>. При успехе вы получаете выбранную цель.
                      </span>
                      <span className="font-mono text-yellow-400">Баланс: {fmtNod(balance)} NOD</span>
                    </div>
                  </div>
                  {error && (
                    <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
                  )}
                  <CaseupButton onClick={handleRun} className="mt-3 w-full py-3" disabled={!targetItem}>
                    <Hammer size={16} /> Запустить апгрейд
                  </CaseupButton>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {phase === "rolling" && outcome && (
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#141414] px-5 py-12">
          <Wheel chance={outcome.chance} spinning success={outcome.success} onSpinEnd={onSpinEnd} />
          <div className="mt-4 text-sm text-zinc-400">Модернизация оружия...</div>
        </div>
      )}

      {phase === "result" && outcome && (
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#141414] px-5 py-10">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-2xl ${
              outcome.success ? "bg-emerald-500/20 ring-2 ring-emerald-400" : "bg-red-500/20 ring-2 ring-red-500"
            }`}
          >
            {outcome.success ? "✅" : "💥"}
          </div>
          <div className={`mt-3 font-display text-xl font-black ${outcome.success ? "text-emerald-400" : "text-red-400"}`}>
            {outcome.success ? "Апгрейд успешен!" : "Неудача..."}
          </div>
          <div className="mt-1 max-w-sm text-center text-xs leading-relaxed text-zinc-400">
            {outcome.success
              ? `Шанс ${outcome.chance.toFixed(1).replace(".", ",")}% — и вам повезло! Новый предмет уже в инвентаре.`
              : `Шанс был ${outcome.chance.toFixed(1).replace(".", ",")}%. Предмет сгорел — попробуйте ещё раз с другим предметом.`}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <CaseupButton onClick={() => goTo("inventory")} variant="ghost">
              <Package size={15} /> В инвентарь
            </CaseupButton>
            <CaseupButton
              onClick={() => {
                setPhase("pick");
                setOutcome(null);
                setTargetId(null);
                setQuery("");
              }}
            >
              <RefreshCw size={15} /> Апгрейднуть другой предмет
            </CaseupButton>
          </div>
        </div>
      )}

      {/* Как это работает */}
      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3.5 text-[11px] leading-relaxed text-zinc-500">
        <Hammer size={14} className="mt-0.5 shrink-0 text-violet-400" />
        <span>
          <b className="text-zinc-300">Как считается шанс:</b> отношение цены вашего предмета к цене цели в степени 1.1. Равные цены — почти 100%,
          разрыв ×5 — около 17%. Бусты «Счастливый Билет» (+1.5%) и «Удачный Контракт» (+4%) честно повышают шанс. Результат определяет сервер ещё до
          анимации рулетки — она лишь показывает уже выбранный исход.
        </span>
      </div>
    </div>
  );
}
