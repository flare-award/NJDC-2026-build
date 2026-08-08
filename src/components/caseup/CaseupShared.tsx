// ============================================================
// CASEUP by 1DONY — общие UI-элементы.
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { rarityMeta, fmtNod, type CaseupItemView } from "../../utils/caseup";
import { itemDisplayName } from "../../utils/caseup";

// ---------- Плашка редкости (приглушённая) ----------
export function RarityPlate({ rarity, className = "", small = false }: { rarity: string; className?: string; small?: boolean }) {
  const meta = rarityMeta(rarity);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider ${small ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"} ${className}`}
      style={{ color: meta.color, backgroundColor: meta.soft, border: `1px solid ${meta.color}33` }}
    >
      {meta.label}
    </span>
  );
}

// ---------- Цена ----------
export function PriceChip({ value, className = "", icon = "NOD" }: { value: number; className?: string; icon?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold text-yellow-400 ${className}`}>
      <span className="text-[10px]">◆</span>
      {fmtNod(value)}
      <span className="text-[9px] text-yellow-500/70">{icon}</span>
    </span>
  );
}

// ---------- SVG-fallback, если png предмета не найден ----------
export function itemFallbackSvg(itemName: string, rarity: string): string {
  const meta = rarityMeta(rarity);
  const initials = itemName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
<stop offset='0%' stop-color='${meta.color}40'/><stop offset='100%' stop-color='#00000000'/>
</linearGradient></defs>
<rect width='400' height='300' fill='#101010'/>
<rect width='400' height='300' fill='url(#g)'/>
<path d='M0 230 L400 120 L400 300 L0 300 Z' fill='${meta.color}22'/>
<path d='M0 250 L400 140' stroke='${meta.color}55' stroke-width='2'/>
<circle cx='200' cy='120' r='52' fill='none' stroke='${meta.color}66' stroke-width='3'/>
<circle cx='200' cy='120' r='8' fill='${meta.color}88'/>
<text x='200' y='236' font-family='Arial, sans-serif' font-size='64' font-weight='900' fill='${meta.color}77' text-anchor='middle'>${initials}</text>
</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// ---------- Арт предмета ----------
export function ItemArt({
  item,
  knifeFinish,
  className = "",
  glow = true,
}: {
  item: CaseupItemView;
  knifeFinish?: string | null;
  className?: string;
  glow?: boolean;
}) {
  const meta = rarityMeta(item.rarity);
  const fallback = itemFallbackSvg(itemDisplayName(item, knifeFinish), item.rarity);
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {glow && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, ${meta.glow} 0%, transparent 70%)` }}
        />
      )}
      <img
        src={item.image}
        alt={itemDisplayName(item, knifeFinish)}
        loading="lazy"
        draggable={false}
        onError={(e) => {
          const el = e.currentTarget;
          if (el.src !== fallback) el.src = fallback;
        }}
        className="relative z-10 h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
      />
    </div>
  );
}

// ---------- Золотая медаль ножа с «?» (как в CS2) ----------
export function KnifeMedal({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-label="Нож">
      <defs>
        <radialGradient id="km-gold" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="45%" stopColor="#ffd54a" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
        <radialGradient id="km-inner" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="60%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#a06c0a" />
        </radialGradient>
      </defs>
      {/* Лента */}
      <path d="M28 82 L36 96 L50 88 L64 96 L72 82 Z" fill="#b01e1e" opacity="0.9" />
      <path d="M28 82 L36 90 L50 83 L64 90 L72 82 Z" fill="#e23b3b" />
      {/* Медаль */}
      <circle cx="50" cy="44" r="40" fill="url(#km-gold)" stroke="#8a6508" strokeWidth="2.5" />
      <circle cx="50" cy="44" r="31" fill="url(#km-inner)" stroke="#c99b1f" strokeWidth="2" />
      <circle cx="50" cy="44" r="31" fill="none" stroke="#fff8dc" strokeWidth="1" opacity="0.4" />
      {/* Блик */}
      <ellipse cx="38" cy="28" rx="10" ry="6" fill="#ffffff" opacity="0.35" transform="rotate(-25 38 28)" />
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontSize="42"
        fontWeight="900"
        fontFamily="Inter, sans-serif"
        fill="#6b4a06"
      >
        ?
      </text>
    </svg>
  );
}

// ---------- Текущее время (для таймеров бустов) ----------
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ---------- Карточка предмета (общая) ----------
export function ItemCard({
  item,
  knifeFinish,
  footer,
  onClick,
  selected,
  compact = false,
}: {
  item: CaseupItemView;
  knifeFinish?: string | null;
  footer?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const meta = rarityMeta(item.rarity);
  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-[#161616] transition-all ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : ""
      } ${selected ? "ring-2" : ""}`}
      style={{
        borderColor: selected ? meta.color : "rgba(255,255,255,0.07)",
        boxShadow: selected ? `0 0 18px ${meta.glow}` : undefined,
      }}
    >
      <div className={`relative w-full ${compact ? "h-16" : "aspect-[4/3]"} bg-[#101010]`}>
        <ItemArt item={item} knifeFinish={knifeFinish} className={`absolute inset-0 ${compact ? "p-1" : "p-2.5"}`} />
        <div className="absolute right-1.5 top-1.5 z-20">
          <RarityPlate rarity={item.rarity} small />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="text-[11px] font-semibold leading-tight text-zinc-100 line-clamp-2">
          {itemDisplayName(item, knifeFinish)}
        </div>
        {footer && <div className="mt-auto pt-1">{footer}</div>}
      </div>
      {/* Полоска редкости снизу */}
      <div className="h-[3px] w-full" style={{ backgroundColor: `${meta.color}99` }} />
    </div>
  );
}

// ---------- Заголовок раздела ----------
export function SectionTitle({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
          <span className="text-violet-400">{icon}</span>
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Кнопка (единый стиль) ----------
export function CaseupButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "success" | "danger" | "gold";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-900/40",
    ghost: "bg-white/5 text-zinc-200 hover:bg-white/10 border border-white/10",
    success: "bg-emerald-600/90 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/40",
    danger: "bg-red-600/90 text-white hover:bg-red-500 shadow-lg shadow-red-900/40",
    gold: "bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold hover:from-yellow-400 hover:to-amber-500 shadow-lg shadow-amber-900/40",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ---------- Пустое состояние ----------
export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="text-3xl opacity-50">{icon}</div>
      <div className="text-sm font-semibold text-zinc-300">{title}</div>
      {hint && <div className="max-w-sm text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

// ---------- Поиск по названию ----------
export function useFilteredItems(items: CaseupItemView[], query: string, rarities: Set<string>, sort: "relevant" | "expensive" | "cheap") {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((i) => {
      if (rarities.size && !rarities.has(i.rarity)) return false;
      if (!q) return true;
      return `${i.name} ${i.skinName}`.toLowerCase().includes(q);
    });
    if (sort === "expensive") list = [...list].sort((a, b) => b.currentPrice - a.currentPrice);
    else if (sort === "cheap") list = [...list].sort((a, b) => a.currentPrice - b.currentPrice);
    else
      list = [...list].sort((a, b) => {
        if (q) {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
        }
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
    return list;
  }, [items, query, rarities, sort]);
}
