// ============================================================
// CASEUP by 1DONY — раздел «Кейсы».
// Список кейсов → страничка кейса (содержимое, выбор 1-3,
// «Открыть» / «Быстро») → модалка открытия.
// ============================================================
import { useMemo, useState } from "react";
import { ArrowLeft, Box, Eye, Lock, PackageOpen, Zap, ShoppingBag } from "lucide-react";
import { useCaseup, type CaseupCaseView } from "../../context/CaseupContext";
import { fmtNod, caseExpectedValue, rarityMeta } from "../../utils/caseup";
import { itemDisplayName } from "../../utils/caseup";
import { useNodbet } from "../../context/NodbetContext";
import { useUserAuth } from "../../context/UserAuthContext";
import { SectionTitle, PriceChip, CaseupButton, KnifeMedal, RarityPlate, EmptyState } from "./CaseupShared";
import OpeningModal from "./OpeningModal";

// ---------- Модалка «содержимое кейса» ----------
function CaseContentsModal({ caseDef, onClose }: { caseDef: CaseupCaseView; onClose: () => void }) {
  const sorted = useMemo(() => {
    const list = [...caseDef.items];
    if (caseDef.knife) list.push(caseDef.knife);
    return list.sort((a, b) => rarityMeta(a.rarity).order - rarityMeta(b.rarity).order || a.currentPrice - b.currentPrice);
  }, [caseDef]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#121212]/95 px-5 py-3.5 backdrop-blur">
          <div>
            <div className="font-display text-lg font-bold text-white">{caseDef.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Содержимое кейса · шансы</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        <div className="space-y-1.5 p-4">
          {sorted.map((item) => {
            const meta = rarityMeta(item.rarity);
            const isKnife = item.rarity === "knife";
            const chance = isKnife ? caseDef.knifeChance : item.dropChance;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border bg-[#181818] px-3 py-2.5"
                style={{ borderColor: `${meta.color}33` }}
              >
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#101010]">
                  {isKnife ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <KnifeMedal size={40} />
                    </div>
                  ) : (
                    <img src={item.image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-100">{itemDisplayName(item)}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <RarityPlate rarity={item.rarity} small />
                    <span className="font-mono text-[10px] text-zinc-500">{chance.toFixed(chance < 1 ? 2 : 2).replace(".", ",")}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-yellow-400">{fmtNod(item.currentPrice)}</div>
                  <div className="text-[9px] uppercase tracking-wider text-zinc-600">NOD</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/5 px-5 py-3 text-center text-[11px] text-zinc-500">
          Шанс выпадения каждого предмета фиксирован и честен. Нож — золотая медаль с «?»: его скин определяется случайно при открытии.
        </div>
      </div>
    </div>
  );
}

// ---------- Страничка кейса ----------
function CaseDetail({ caseDef, onBack }: { caseDef: CaseupCaseView; onBack: () => void }) {
  const { openCase, notify, loading, mode: caseupMode } = useCaseup();
  const { balance } = useNodbet();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const [count, setCount] = useState(1);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openResult, setOpenResult] = useState<{ results: Parameters<typeof OpeningModal>[0]["results"]; fast: boolean } | null>(null);

  const cost = caseDef.price * count;
  const online = caseupMode === "online";

  const startOpen = async (fast: boolean) => {
    if (!user && online) {
      setAuthMode("signin");
      setAuthModalOpen(true);
      return;
    }
    if (balance < cost) {
      notify(`Недостаточно NOD-Коинов! Нужно ${fmtNod(cost)} NOD.`, false);
      return;
    }
    setOpening(true);
    const res = await openCase(caseDef.id, count);
    setOpening(false);
    if (!res.ok || !res.results?.length) {
      notify(res.error || "Не удалось открыть кейс", false);
      return;
    }
    setOpenResult({ results: res.results, fast });
  };

  const ev = caseExpectedValue(caseDef, caseDef.items, caseDef.knife, (id) => caseDef.items.find((i) => i.id === id)?.currentPrice ?? caseDef.knife?.currentPrice ?? 0);

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
        <ArrowLeft size={15} /> Все кейсы
      </button>

      <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-[#141414] p-5 sm:p-7 lg:flex-row">
        {/* Картинка кейса */}
        <div
          className="relative mx-auto flex w-full max-w-[300px] shrink-0 items-center justify-center overflow-hidden rounded-xl border"
          style={{ borderColor: `${caseDef.accent}44`, background: `radial-gradient(ellipse at center, ${caseDef.accent}1f 0%, #101010 75%)` }}
        >
          <img src={caseDef.image} alt={caseDef.name} className="w-full object-contain p-4 drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]" />
          <div className="absolute left-3 top-3">
            <RarityPlate rarity="knife" small />
          </div>
        </div>

        {/* Инфо и управление */}
        <div className="flex flex-1 flex-col">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{caseDef.name}</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-zinc-400">{caseDef.description}</p>

          <div className="mt-4 grid max-w-md grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Цена кейса</div>
              <PriceChip value={caseDef.price} className="text-sm" />
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Шанс ножа</div>
              <div className="font-mono text-sm font-bold text-yellow-300">{caseDef.knifeChance.toFixed(2).replace(".", ",")}%</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Средн. ценность</div>
              <div className="font-mono text-sm font-bold text-zinc-200">≈ {fmtNod(Math.round(ev))}</div>
            </div>
          </div>

          {/* Выбор количества */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Открыть за раз:</span>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`h-10 w-10 rounded-lg border text-sm font-bold transition-all ${
                    count === n
                      ? "border-violet-500 bg-violet-600/30 text-white shadow-lg shadow-violet-900/40"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {count > 1 && <span className="text-xs text-zinc-500">× {fmtNod(caseDef.price)} = <b className="text-yellow-400">{fmtNod(cost)} NOD</b></span>}
          </div>

          {/* Кнопки */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CaseupButton onClick={() => startOpen(false)} disabled={opening || loading} className="px-6 py-3 text-base">
              <PackageOpen size={18} /> Открыть за {fmtNod(cost)}
            </CaseupButton>
            <CaseupButton onClick={() => startOpen(true)} variant="gold" disabled={opening || loading} className="px-6 py-3 text-base">
              <Zap size={18} /> Быстро за {fmtNod(cost)}
            </CaseupButton>
            <CaseupButton onClick={() => setContentsOpen(true)} variant="ghost">
              <Eye size={16} /> Содержимое
            </CaseupButton>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500">
            <Lock size={13} className="mt-0.5 shrink-0 text-zinc-600" />
            <span>
              Выигрыш определяется честно с учётом шансов ещё до анимации — лента лишь показывает уже выбранный предмет.
              Кейсы не продаются и не хранятся в инвентаре: открытие происходит только здесь.
            </span>
          </div>
        </div>
      </div>

      {contentsOpen && <CaseContentsModal caseDef={caseDef} onClose={() => setContentsOpen(false)} />}
      {openResult && (
        <OpeningModal
          caseDef={caseDef}
          count={count}
          results={openResult.results}
          fast={openResult.fast}
          onClose={() => setOpenResult(null)}
          onGoInventory={() => {
            setOpenResult(null);
            window.dispatchEvent(new CustomEvent("caseup-goto-inventory"));
          }}
        />
      )}
    </div>
  );
}

// ---------- Список кейсов ----------
export default function CasesSection() {
  const { cases, loading, balance } = useCaseup();
  const [selected, setSelected] = useState<CaseupCaseView | null>(null);
  const [contentsFor, setContentsFor] = useState<CaseupCaseView | null>(null);

  if (selected) return <CaseDetail caseDef={selected} onBack={() => setSelected(null)} />;

  return (
    <div>
      <SectionTitle
        icon={<Box size={20} />}
        title="Кейсы"
        subtitle="Выбери кейс, посмотри содержимое и испытай удачу. Нож — самый редкий и дорогой приз."
        right={
          <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-1.5 font-mono text-xs font-bold text-yellow-400">
            Баланс: {fmtNod(balance)} NOD
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#141414] transition-all hover:-translate-y-1 hover:shadow-2xl"
              style={{ boxShadow: undefined }}
            >
              <div
                className="relative flex h-44 items-center justify-center overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 60%, ${c.accent}26 0%, #101010 75%)` }}
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="h-40 w-40 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]"
                />
                <div className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 backdrop-blur">
                  {c.items.length + 1} предметов
                </div>
                <div className="absolute right-2.5 top-2.5 rounded-md bg-black/50 px-2 py-0.5 text-[9px] font-bold text-yellow-300 backdrop-blur">
                  ★ {c.knifeChance.toFixed(2).replace(".", ",")}%
                </div>
              </div>
              <div className="p-3.5">
                <div className="font-display text-base font-bold text-white">{c.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <PriceChip value={c.price} />
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContentsFor(c);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Eye size={12} className="mr-1 inline" />
                      Содержимое
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(c);
                      }}
                      className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                    >
                      <ShoppingBag size={12} className="mr-1 inline" />
                      Открыть
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && cases.length === 0 && (
        <EmptyState icon={<Box size={40} />} title="Кейсы скоро появятся" hint="Каталог кейсов подгружается из Supabase." />
      )}

      {contentsFor && <CaseContentsModal caseDef={contentsFor} onClose={() => setContentsFor(null)} />}
    </div>
  );
}
