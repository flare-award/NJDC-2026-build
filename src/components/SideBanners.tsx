import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// ============================================================
// Боковые рекламные баннеры (пункт 5, 11)
//  - три рекламодателя: QEnergy, NODBET, 1DONY
//  - меняются между собой каждые 25 секунд
//  - слева и справа показывают РАЗНЫЕ баннеры (со сдвигом)
//  - видны только на: Главная, Команды, Турнирная сетка, Матчи, Таблица лидеров
//  - QEnergy: фото энергетика увеличено в 1.45 раза (max-h 348px, min-h 320px, scale 1.45)
// ============================================================

const ROTATE_MS = 25000;

const ALLOWED_PATHS = ["/", "/teams", "/bracket", "/matches", "/leaderboard"];

type SponsorKey = "qenergy" | "nodbet" | "1dony";

interface QDrink {
  name: string;
  flavor: string;
  img: string;
}

const Q_DRINKS: QDrink[] = [
  { name: "«Чкода»", flavor: "Вкус Колы", img: "https://i.imgur.com/CYNila6.png" },
  { name: "«БМВноград»", flavor: "Вкус Винограда", img: "https://i.imgur.com/uChsiuE.png" },
  { name: "«Лада Граната»", flavor: "Вкус Граната", img: "https://i.imgur.com/PmSzRxf.png" },
];

const SPONSOR_ORDER: SponsorKey[] = ["qenergy", "nodbet", "1dony"];

function QEnergyBanner({ tick }: { tick: number }) {
  const drink = Q_DRINKS[tick % Q_DRINKS.length];
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#25e3c9]/40 bg-gradient-to-b from-[#05201d] via-[#0a0f10] to-black p-3.5 text-white shadow-xl justify-between">
      <div>
        <div className="relative z-10 mb-1 flex items-center justify-between">
          <span className="rounded bg-[#25e3c9] px-2 py-0.5 font-display text-xs font-black uppercase tracking-widest text-black shadow">
            QEnergy
          </span>
          <span className="text-[10px] font-mono uppercase text-zinc-500">18+ Реклама</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden my-3 min-h-[320px]">
        <img
          key={drink.img}
          src={drink.img}
          alt={`QEnergy ${drink.name}`}
          className="h-full max-h-[348px] w-auto object-contain drop-shadow-[0_0_22px_rgba(37,227,201,0.45)] animate-banner-swap"
          style={{ transform: "scale(1.45)", transformOrigin: "center" }}
          loading="lazy"
        />
      </div>

      <div className="relative z-10 mt-1 text-center">
        <p className="font-display text-base font-black italic uppercase leading-tight tracking-tight text-white drop-shadow break-words">
          #ЗАГОРАЙСЯ<br />И ПОБЕЖДАЙ
        </p>
        <div className="mt-1.5 inline-block -rotate-1 rounded bg-black px-2 py-0.5">
          <p className="text-[10px] font-bold text-[#25e3c9]">Энергетик от @qusti</p>
        </div>
        <p className="mt-1 font-display text-xs font-black leading-tight text-white">
          {drink.name} <span className="text-[#25e3c9]">· {drink.flavor}</span>
        </p>
      </div>
    </div>
  );
}

function NodbetBanner() {
  return (
    <Link
      to="/nodbet"
      className="group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-red-500/40 bg-[#E10600] p-4.5 text-white shadow-xl transition-transform hover:scale-[1.02]"
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded bg-black/30 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-yellow-300 border border-white/20">
            Главный спонсор
          </span>
          <span className="text-[9px] font-mono uppercase text-white/60">Реклама</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center my-3">
        <h3 className="font-display text-4xl font-black italic tracking-wider uppercase drop-shadow -skew-x-6">
          NOD<span className="text-yellow-300">BET</span>
        </h3>
        <p className="mt-3 text-xs font-bold leading-relaxed text-red-50">«Ставь на своих! Крути Клатч-Рулетку и поднимайся в Зал Славы.»</p>
      </div>
      <span className="mt-3 block rounded-xl bg-white py-2.5 text-center text-xs font-black uppercase text-[#E10600] transition-colors group-hover:bg-yellow-300 group-hover:text-black">
        🎰 В Арену NODBET
      </span>
    </Link>
  );
}

function DonyBanner() {
  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0a1128] via-[#001f3f] to-[#0077b6] p-4.5 text-white shadow-xl">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded bg-cyan-950/80 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-cyan-300 border border-cyan-400/30">
            Партнёр
          </span>
          <span className="text-[9px] font-mono uppercase text-cyan-300/60">Реклама</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center my-3">
        <h3 className="font-display text-4xl font-black italic tracking-wider uppercase drop-shadow -skew-x-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-sky-400">
          1DONY
        </h3>
        <p className="mt-3 text-xs font-bold leading-relaxed text-cyan-50">«Твой проводник в мир ярких эмоций. Заходи, играй, побеждай!»</p>
      </div>
      <span className="mt-3 block rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-2.5 text-center text-xs font-black uppercase text-slate-950">
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

  const path = location.pathname;
  const show = useMemo(() => ALLOWED_PATHS.includes(path), [path]);

  if (!show) return null;

  const leftSponsor = SPONSOR_ORDER[tick % SPONSOR_ORDER.length];
  const rightSponsor = SPONSOR_ORDER[(tick + 1) % SPONSOR_ORDER.length];
  const mobileSponsor = SPONSOR_ORDER[(tick + 2) % SPONSOR_ORDER.length];

  return (
    <>
      {/* Левый баннер — увеличен фото энергетика в 1.45 раза */}
      <aside className="pointer-events-none fixed left-3 top-24 bottom-6 z-30 hidden w-[204px] 2xl:block">
        <div className="pointer-events-auto h-full max-h-[720px]">
          <SponsorBanner key={`l-${leftSponsor}-${tick}`} sponsor={leftSponsor} tick={tick} />
        </div>
      </aside>

      {/* Правый баннер — увеличен фото энергетика в 1.45 раза */}
      <aside className="pointer-events-none fixed right-3 top-24 bottom-6 z-30 hidden w-[204px] 2xl:block">
        <div className="pointer-events-auto h-full max-h-[720px]">
          <SponsorBanner key={`r-${rightSponsor}-${tick}`} sponsor={rightSponsor} tick={tick} />
        </div>
      </aside>

      {/* Мобильная версия */}
      <div className="fixed inset-x-2 bottom-2 z-30 mx-auto max-w-md md:hidden">
        <div className="h-[142px] animate-banner-swap" key={`m-${mobileSponsor}-${tick}`}>
          <SponsorBanner sponsor={mobileSponsor} tick={tick} />
        </div>
      </div>
    </>
  );
}
