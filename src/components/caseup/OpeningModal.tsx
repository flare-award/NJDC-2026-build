// ============================================================
// CASEUP by 1DONY — модалка открытия кейса.
// Результат определяется сервером (RPC) ещё ДО анимации;
// лента только визуализирует уже выбранный выигрыш:
// быстро прокручивается и плавно замедляется, пока выигрышный
// предмет не остановится точно по центру под указателем.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Zap, Package, Repeat, RefreshCw } from "lucide-react";
import { useCaseup, type CaseupCaseView, type CaseupOpenResult } from "../../context/CaseupContext";
import { rollCaseItem, rarityMeta, fmtNod, type CaseupItemView } from "../../utils/caseup";
import { RarityPlate, PriceChip, CaseupButton, itemFallbackSvg } from "./CaseupShared";

const CARD_W = 148;
const CARD_GAP = 12;
// Лента длинная: стартовая позиция сдвинута вправо на ~5800px,
// поэтому нужно достаточно карточек, чтобы окно не вышло за край.
const RIBBON_LEN = 70;
const WINNER_INDEX = 24;

interface SpinCard {
  name: string;
  skinName: string;
  rarity: string;
  image: string;
  price: number;
  knifeFinish: string | null;
  isKnife: boolean;
  itemId: string;
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export default function OpeningModal({
  caseDef,
  count,
  results,
  fast,
  onClose,
  onGoInventory,
}: {
  caseDef: CaseupCaseView;
  count: number;
  results: CaseupOpenResult[];
  fast: boolean;
  onClose: () => void;
  onGoInventory: () => void;
}) {
  const { openCase, notify } = useCaseup();
  const [phase, setPhase] = useState<"spinning" | "done">("spinning");
  const [spinCards, setSpinCards] = useState<SpinCard[]>([]);
  const [translateX, setTranslateX] = useState(0);
  const [repeatError, setRepeatError] = useState<string | null>(null);
  const [repeating, setRepeating] = useState(false);
  const [currentResults, setCurrentResults] = useState<CaseupOpenResult[]>(results);
  const [currentFast, setCurrentFast] = useState(fast);
  const [runId, setRunId] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const cost = caseDef.price * count;

  // ---------- Построение ленты ----------
  const buildRibbon = useCallback(
    (first: CaseupOpenResult): SpinCard[] => {
      const pool: CaseupItemView[] = [...caseDef.items];
      if (caseDef.knife) pool.push(caseDef.knife);
      const cards: SpinCard[] = [];
      for (let i = 0; i < RIBBON_LEN; i++) {
        if (i === WINNER_INDEX) {
          cards.push({
            name: first.name,
            skinName: first.skinName,
            rarity: first.rarity,
            image: first.image,
            price: first.price,
            knifeFinish: first.knifeFinish,
            isKnife: first.isKnife,
            itemId: first.itemId,
          });
          continue;
        }
        const pick = rollCaseItem(caseDef, caseDef.items, caseDef.knife, false);
        cards.push({
          name: pick.item.name,
          skinName: pick.item.skinName,
          rarity: pick.item.rarity,
          image: pick.item.image,
          price: pool.find((p) => p.id === pick.item.id)?.currentPrice ?? pick.item.basePrice,
          knifeFinish: pick.knifeFinish,
          isKnife: pick.item.rarity === "knife",
          itemId: pick.item.id,
        });
      }
      return cards;
    },
    [caseDef]
  );

  // ---------- Запуск анимации ----------
  const startSpin = useCallback(
    (res: CaseupOpenResult[], isFast: boolean) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const cards = buildRibbon(res[0]);
      setSpinCards(cards);
      setPhase("spinning");
      setRepeatError(null);

      const containerW = trackRef.current?.offsetWidth ?? 900;
      const target = WINNER_INDEX * (CARD_W + CARD_GAP) + CARD_W / 2 - containerW / 2;
      const distance = isFast ? 1900 : 5800;
      const start = target + distance;
      const duration = isFast ? 1500 : 5600;
      const ease = isFast ? easeOutQuart : easeOutQuint;
      const t0 = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        setTranslateX(start + (target - start) * ease(t));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setTranslateX(target);
          setPhase("done");
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [buildRibbon]
  );

  // Запуск анимации: при открытии и при каждом «Ещё раз»
  useEffect(() => {
    if (!currentResults.length) return;
    // маленькая пауза, чтобы модалка отрисовалась и измерилась
    const t = setTimeout(() => startSpin(currentResults, currentFast), 120);
    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const repeat = useCallback(
    async (isFast: boolean) => {
      if (repeating) return;
      setRepeating(true);
      setRepeatError(null);
      const res = await openCase(caseDef.id, count);
      setRepeating(false);
      if (!res.ok || !res.results?.length) {
        setRepeatError(res.error || "Не удалось открыть кейс");
        notify(res.error || "Не удалось открыть кейс", false);
        return;
      }
      setCurrentResults(res.results);
      setCurrentFast(isFast);
      setRunId((v) => v + 1);
    },
    [repeating, openCase, caseDef.id, count, notify]
  );

  const winner = useMemo(() => spinCards[WINNER_INDEX], [spinCards]);
  const winnerMeta = winner ? rarityMeta(winner.rarity) : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
          <div>
            <div className="font-display text-lg font-bold text-white">
              {caseDef.name}
              <span className="ml-2 text-xs font-medium text-zinc-500">
                {count > 1 ? `× ${count}` : ""} · {fmtNod(cost)} NOD
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Открытие кейса</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {/* Лента */}
        <div className="relative px-0 py-8">
          {/* Указатель по центру */}
          <div className="pointer-events-none absolute left-1/2 top-3 bottom-3 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_rgba(253,224,71,0.9)]" />
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[7px] border-t-[10px] border-x-transparent border-t-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]" />
          </div>

          <div className="relative overflow-hidden" ref={trackRef}>
            {/* Затемнение по краям */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#121212] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#121212] to-transparent" />
            <div
              className="flex will-change-transform"
              style={{ transform: `translateX(${translateX}px)` }}
            >
              {spinCards.map((c, i) => {
                const meta = rarityMeta(c.rarity);
                const isWinner = phase === "done" && i === WINNER_INDEX;
                return (
                  <div
                    key={i}
                    className="relative shrink-0 overflow-hidden rounded-lg border bg-[#1a1a1a] transition-shadow"
                    style={{
                      width: CARD_W,
                      marginRight: CARD_GAP,
                      borderColor: isWinner ? meta.color : "rgba(255,255,255,0.06)",
                      boxShadow: isWinner ? `0 0 22px ${meta.glow}` : undefined,
                    }}
                  >
                    <div className="relative h-[104px] bg-[#131313]">
                      <img
                        src={c.image}
                        alt=""
                        draggable={false}
                        onError={(e) => {
                          const el = e.currentTarget;
                          const fb = itemFallbackSvg(c.name + (c.skinName ? " " + c.skinName : ""), c.rarity);
                          if (el.src !== fb) el.src = fb;
                        }}
                        className="h-full w-full object-contain p-2"
                      />
                      {c.isKnife && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1 text-[8px] font-bold uppercase text-yellow-300">
                          ★
                        </span>
                      )}
                    </div>
                    <div className="px-1.5 pb-1.5 pt-1">
                      <div className="line-clamp-1 text-[9px] font-semibold text-zinc-200">
                        {c.name}
                        {c.skinName ? ` | ${c.skinName}` : c.knifeFinish ? ` | ${c.knifeFinish}` : ""}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="font-mono text-[8px] font-bold text-yellow-400/90">{fmtNod(c.price)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Победный предмет */}
          {phase === "done" && winner && winnerMeta && (
            <div className="animate-fade-in mt-5 flex items-center justify-center gap-3">
              <div
                className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
                style={{ borderColor: `${winnerMeta.color}55`, background: `${winnerMeta.soft}` }}
              >
                <img
                  src={winner.image}
                  alt=""
                  onError={(e) => {
                    const el = e.currentTarget;
                    const fb = itemFallbackSvg(winner.name + (winner.skinName ? " " + winner.skinName : ""), winner.rarity);
                    if (el.src !== fb) el.src = fb;
                  }}
                  className="h-12 w-12 rounded-md bg-[#101010] object-contain p-1"
                />
                <div>
                  <div className="text-sm font-bold text-white">
                    {winner.name}
                    {winner.skinName ? ` | ${winner.skinName}` : winner.knifeFinish ? ` | ${winner.knifeFinish}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <RarityPlate rarity={winner.rarity} />
                    <PriceChip value={winner.price} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Результаты (2-3 открытия) */}
        {phase === "done" && currentResults.length > 1 && (
          <div className="animate-fade-in px-5 pb-2">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Результаты открытий</div>
            <div className="flex flex-wrap gap-2">
              {currentResults.map((r, i) => {
                const meta = rarityMeta(r.rarity);
                return (
                  <div
                    key={r.invId}
                    className="animate-fade-in flex items-center gap-2 rounded-lg border bg-[#181818] px-2.5 py-1.5"
                    style={{ borderColor: `${meta.color}44`, animationDelay: `${i * 120}ms` }}
                  >
                    <img
                      src={r.image}
                      alt=""
                      onError={(e) => {
                        const el = e.currentTarget;
                        const fb = itemFallbackSvg(r.name + (r.skinName ? " " + r.skinName : ""), r.rarity);
                        if (el.src !== fb) el.src = fb;
                      }}
                      className="h-8 w-8 rounded bg-[#101010] object-contain p-0.5"
                    />
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-100">
                        {r.name}
                        {r.skinName ? ` | ${r.skinName}` : r.knifeFinish ? ` | ${r.knifeFinish}` : ""}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold uppercase" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="font-mono text-[9px] text-yellow-400">{fmtNod(r.price)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {repeatError && phase === "done" && (
          <div className="animate-fade-in mx-5 mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {repeatError}
          </div>
        )}

        {/* Кнопки */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 px-5 py-5">
          {phase === "spinning" ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <RefreshCw size={15} className="animate-spin" />
              {currentFast ? "Быстрое открытие..." : "Открываем кейс..."}
            </div>
          ) : (
            <>
              <CaseupButton onClick={() => repeat(false)} disabled={repeating}>
                <Repeat size={15} /> Ещё раз за {fmtNod(cost)}
              </CaseupButton>
              <CaseupButton onClick={() => repeat(true)} variant="ghost" disabled={repeating}>
                <Zap size={15} className="text-yellow-400" /> Быстро за {fmtNod(cost)}
              </CaseupButton>
              <CaseupButton onClick={onGoInventory} variant="ghost">
                <Package size={15} /> В инвентарь
              </CaseupButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
