import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// ============================================================
// Боковые рекламные баннеры (пункт 11)
//  - три рекламодателя: QEnergy, NODBET, 1DONY
//  - меняются между собой каждые 25 секунд
//  - слева и справа показывают РАЗНЫЕ баннеры (со сдвигом)
//  - видны только на: Главная, Команды, Турнирная сетка, Матчи, Таблица лидеров
//  - на узких экранах (мобилки/планшеты) скрыты, чтобы ничего не ломать;
//    вместо них показывается один компактный баннер снизу.
// ============================================================

const ROTATE_MS = 25000;

// Пути (HashRouter), на которых показываем баннеры.
const ALLOWED_PATHS = ["/", "/teams", "/bracket", "/matches", "/leaderboard"];

type SponsorKey = "qenergy" | "nodbet" | "1dony";

interface QDrink {
  name: string;
  flavor: string;
  img: string;
}

const Q_DRINKS: QDrink[] = [
  { name: "QEnergy «Чкода»", flavor: "Вкус Колы", img: "/sponsors/qenergy-chkoda.png" },
  { name: "QEnergy «БМВноград»", flavor: "Вкус Винограда", img: "/sponsors/qenergy-bmvnograd.png" },
  { name: "QEnergy «Лада Граната»", flavor: "Вкус Граната", img: "/sponsors/qenergy-lada-granata.png" },
];

const SPONSOR_ORDER: SponsorKey[] = ["qenergy", "nodbet", "1dony"];

function QEnergyBanner({ tick }: { tick: number }) {
  const drink = Q_DRINKS[tick % Q_DRINKS.length];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-[#0a1f16] via-[#0d0d0d] to-[#1a0a1f] p-3 text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-400/30">
          QEnergy
        </span>
        <span className="text-[9px] font-mono uppercase text-zinc-500">Реклама</span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40">
        <img key={drink.img} src={drink.img} alt={drink.name} className="h-full max-h-[260px] w-auto object-contain animate-banner-swap" loading="lazy" />
      </div>
      <div className="mt-2 text-center">
        <p className="font-display text-sm font-black leading-tight text-white">{drink.name}</p>
        <p className="text-[11px] font-semibold text-emerald-300">{drink.flavor}</p>
        <p className="mt-1 text-[10px] text-zinc-400">Энергетики от Qusti — заряжай клатчи!</p>
      </div>
    </div>
  );
}

function NodbetBanner() {
  return (
    <Link
      to="/nodbet"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-red-500/40 bg-[#E10600] p-4 text-white shadow-xl transition-transform hover:scale-[1.02]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded bg-black/30 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-yellow-300 border border-white/20">
          Главный спонсор
        </span>
        <span className="text-[9px] font-mono uppercase text-white/60">Реклама</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h3 className="font-display text-3xl font-black italic tracking-wider uppercase drop-shadow -skew-x-6">
          NOD<span className="text-yellow-300">BET</span>
        </h3>
        <p className="mt-2 text-xs font-bold leading-snug text-red-50">«Ставь на своих! Крути Клатч-Рулетку и поднимайся в Зал Славы.»</p>
      </div>
      <span className="mt-3 block rounded-xl bg-white py-2 text-center text-xs font-black uppercase text-[#E10600] transition-colors group-hover:bg-yellow-300 group-hover:text-black">
        🎰 В Арену NODBET
      </span>
    </Link>
  );
}

function DonyBanner() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0a1128] via-[#001f3f] to-[#0077b6] p-4 text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded bg-cyan-950/80 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-cyan-300 border border-cyan-400/30">
          Партнёр
        </span>
        <span className="text-[9px] font-mono uppercase text-cyan-300/60">Реклама</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h3 className="font-display text-3xl font-black italic tracking-wider uppercase drop-shadow -skew-x-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-sky-400">
          1DONY
        </h3>
        <p className="mt-2 text-xs font-bold leading-snug text-cyan-50">«Твой проводник в мир ярких эмоций. Заходи, играй, побеждай!»</p>
      </div>
      <span className="mt-3 block rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-2 text-center text-xs font-black uppercase text-slate-950">
        Забрать бонус +100%
      </span>
    </div>
  );
}

function SponsorBanner({ sponsor, tick }: { sponsor: SponsorKey; tick: number }) {
  if (sponsor === "qenergy") return <QEnergyBanner tick={tick} />;
  if (sponsor === "nodbet") return <NodbetBanner />;
  return <DonyBanner />;
}

export default function SideBanners() {
  const location = useLocation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  // Определяем текущий путь в HashRouter.
  const path = location.pathname;
  const show = useMemo(() => ALLOWED_PATHS.includes(path), [path]);

  if (!show) return null;

  // Слева и справа — разные баннеры (сдвиг индекса), меняются каждые 25 сек.
  const leftSponsor = SPONSOR_ORDER[tick % SPONSOR_ORDER.length];
  const rightSponsor = SPONSOR_ORDER[(tick + 1) % SPONSOR_ORDER.length];
  // Компактный мобильный баннер — третий вариант, чтобы был разнообразным.
  const mobileSponsor = SPONSOR_ORDER[(tick + 2) % SPONSOR_ORDER.length];

  return (
    <>
      {/* Левый баннер — только на широких экранах (xl+), фиксирован сбоку */}
      <aside className="pointer-events-none fixed left-3 top-24 bottom-6 z-30 hidden w-[170px] 2xl:block">
        <div className="pointer-events-auto h-full max-h-[560px]">
          <SponsorBanner key={`l-${leftSponsor}-${tick}`} sponsor={leftSponsor} tick={tick} />
        </div>
      </aside>

      {/* Правый баннер — только на широких экранах (xl+) */}
      <aside className="pointer-events-none fixed right-3 top-24 bottom-6 z-30 hidden w-[170px] 2xl:block">
        <div className="pointer-events-auto h-full max-h-[560px]">
          <SponsorBanner key={`r-${rightSponsor}-${tick}`} sponsor={rightSponsor} tick={tick} />
        </div>
      </aside>

      {/* Мобильная версия: один компактный баннер снизу, не ломает контент.
          Показываем только на телефонах (< md). На средних экранах баннеров нет,
          чтобы не перекрывать контент, а на 2xl+ работают боковые баннеры. */}
      <div className="fixed inset-x-2 bottom-2 z-30 mx-auto max-w-md md:hidden">
        <div className="h-[132px] animate-banner-swap" key={`m-${mobileSponsor}-${tick}`}>
          <SponsorBanner sponsor={mobileSponsor} tick={tick} />
        </div>
      </div>
    </>
  );
}
