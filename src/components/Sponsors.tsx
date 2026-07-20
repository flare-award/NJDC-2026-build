import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Gift, ShieldCheck, Flame, ExternalLink, X, CheckCircle2 } from "lucide-react";

export default function Sponsors() {
  const [activeModal, setActiveModal] = useState<"nodbet" | "1dony" | null>(null);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-8 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Официальные партнёры
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
            Спонсоры <span className="text-gradient">турнира</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Главные инвесторы и партнеры киберспортивного турнира NJDC 2026.
          </p>
        </div>
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-600 border border-zinc-800 px-2.5 py-1 rounded bg-zinc-950/50">
          Реклама · 18+
        </span>
      </div>

      {/* BANNERS GRID */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* ==================== 1. NODBET ==================== */}
        <div className="group relative overflow-hidden rounded-2xl bg-[#E10600] p-6 sm:p-8 text-white shadow-xl shadow-red-950/20 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-red-600/30 border border-red-500/30 flex flex-col justify-between">
          {/* Decorative background overlay */}
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.15)_0%,transparent_60%)] pointer-events-none" />
          
          <div>
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 rounded bg-black/30 px-2.5 py-1 font-display text-xs font-black tracking-widest text-white uppercase backdrop-blur-sm border border-white/20">
                <Flame size={14} className="text-yellow-400 fill-yellow-400" />
                ГЛАВНЫЙ СПОНСОР
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-white/70 bg-black/20 px-2 py-0.5 rounded">
                E-SPORTS BETTING
              </span>
            </div>

            {/* Logo Header */}
            <div className="my-2">
              <h3 className="font-display text-5xl sm:text-6xl font-black italic tracking-wider text-white uppercase drop-shadow-md transform -skew-x-6">
                NOD<span className="text-yellow-300">BET</span>
              </h3>
              <p className="mt-1 text-xs font-bold tracking-widest text-red-100 uppercase opacity-90">
                Пародия на легендарного букмекера
              </p>
            </div>

            {/* Main Text Content */}
            <div className="mt-6 space-y-3">
              <div className="rounded-xl bg-black/25 backdrop-blur-md p-4 border border-white/15">
                <p className="font-display text-base sm:text-lg font-bold leading-snug text-white">
                  «NODBET — Ставь на своих! Главный спонсор твоих уверенных побед и сочных клатчей.»
                </p>
              </div>

              <div className="flex items-start gap-2 text-xs text-red-100 font-medium pl-1">
                <Zap size={14} className="text-yellow-300 shrink-0 mt-0.5" />
                <span>Быстрые ставки, честные исходы. NODBET — заряжай на красивую игру!</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/20">
            <div className="text-xs font-bold text-white/90">
              Коэффициент 2.50+ на CS2 · <span className="text-yellow-300">Бонус 10,000 NOD</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveModal("nodbet")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black/40 px-3.5 py-2.5 text-xs font-bold text-white border border-white/20 hover:bg-black/60 cursor-pointer"
              >
                Промокод
              </button>
              <Link
                to="/nodbet"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#E10600] uppercase tracking-wider transition-all duration-200 hover:bg-yellow-300 hover:text-black hover:shadow-lg active:scale-95 cursor-pointer"
              >
                В Арену Ставок 🎰
                <ExternalLink size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* ==================== 2. 1DONY ==================== */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1128] via-[#001f3f] to-[#0077b6] p-6 sm:p-8 text-white shadow-xl shadow-cyan-950/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-cyan-500/20 border border-cyan-500/30 flex flex-col justify-between">
          {/* Decorative glows */}
          <div className="absolute -right-10 -bottom-10 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-600" />

          <div>
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 rounded bg-cyan-950/80 px-2.5 py-1 font-display text-xs font-black tracking-widest text-cyan-300 uppercase backdrop-blur-sm border border-cyan-400/30">
                <Gift size={14} className="text-cyan-400" />
                ГЕЙМИНГ ПЛАТФОРМА
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300/80 bg-black/30 px-2 py-0.5 rounded border border-cyan-500/20">
                БОНУС +100%
              </span>
            </div>

            {/* Logo Header */}
            <div className="my-2">
              <h3 className="font-display text-5xl sm:text-6xl font-black italic tracking-wider uppercase drop-shadow-md transform -skew-x-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-sky-400">
                1DONY
              </h3>
              <p className="mt-1 text-xs font-bold tracking-widest text-cyan-200/90 uppercase">
                Технологичный сервис с бонусами для геймеров
              </p>
            </div>

            {/* Main Text Content */}
            <div className="mt-6 space-y-3">
              <div className="rounded-xl bg-slate-900/60 backdrop-blur-md p-4 border border-cyan-500/25">
                <p className="font-display text-base sm:text-lg font-bold leading-snug text-cyan-50">
                  «1DONY — Твой надежный проводник в мир ярких эмоций. Заходи, играй, побеждай!»
                </p>
              </div>

              <div className="flex items-start gap-2 text-xs text-cyan-200 font-medium pl-1">
                <ShieldCheck size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>Регистрируйся на 1DONY прямо сейчас и забирай свой стартовый бонус на первую игру!</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-8 flex items-center justify-between pt-4 border-t border-cyan-500/20">
            <div className="text-xs font-bold text-cyan-300">
              Промокод: <span className="font-mono text-white underline decoration-cyan-400">NJDC-BONUS-2026</span>
            </div>
            <button
              onClick={() => setActiveModal("1dony")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-2.5 text-sm font-black text-slate-950 uppercase tracking-wider transition-all duration-200 hover:from-cyan-300 hover:to-sky-400 hover:shadow-[0_0_20px_rgba(56,189,248,0.6)] active:scale-95 cursor-pointer"
            >
              Забрать бонус
              <ExternalLink size={16} />
            </button>
          </div>
        </div>
        {/* ==================== 3. QENERGY (стиль LIT ENERGY) ==================== */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#05201d] via-[#0a0f10] to-black p-6 sm:p-8 text-white shadow-xl shadow-[#25e3c9]/10 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-[#25e3c9]/20 border border-[#25e3c9]/40 flex flex-col justify-between">
          <div className="absolute -right-10 -top-10 h-60 w-60 rounded-full bg-[#25e3c9]/20 blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#25e3c9] via-white to-[#25e3c9]" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 rounded bg-[#25e3c9] px-2.5 py-1 font-display text-xs font-black tracking-widest text-black uppercase shadow">
                <Zap size={14} className="text-black fill-black" />
                QEnergy
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#25e3c9]/80 bg-black/40 px-2 py-0.5 rounded border border-[#25e3c9]/20">
                ЭНЕРГЕТИК · 18+
              </span>
            </div>

            {/* слоган в стиле референса */}
            <div className="my-2">
              <h3 className="font-display text-4xl sm:text-5xl font-black italic tracking-tight uppercase leading-[0.9] drop-shadow-md">
                #ЗАГОРАЙСЯ<br />И <span className="text-[#25e3c9]">ПОБЕЖДАЙ</span>
              </h3>
              <div className="mt-3 inline-block -rotate-1 rounded bg-black px-3 py-1">
                <p className="text-xs font-bold text-[#25e3c9]">Энергетик от @qusti</p>
              </div>
            </div>

            {/* Три напитка */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { img: "/sponsors/qenergy-chkoda.png", name: "«Чкода»", flavor: "Кола" },
                { img: "/sponsors/qenergy-bmvnograd.png", name: "«БМВноград»", flavor: "Виноград" },
                { img: "/sponsors/qenergy-lada-granata.png", name: "«Лада Граната»", flavor: "Гранат" },
              ].map((d) => (
                <div key={d.name} className="rounded-xl bg-black/40 border border-[#25e3c9]/20 p-2 text-center">
                  <img src={d.img} alt={`QEnergy ${d.name}`} className="mx-auto h-24 w-auto object-contain drop-shadow-[0_0_12px_rgba(37,227,201,0.3)]" loading="lazy" />
                  <p className="mt-1 text-[11px] font-bold text-white leading-tight">{d.name}</p>
                  <p className="text-[10px] text-[#25e3c9]">{d.flavor}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-[#25e3c9]/20">
            <p className="text-[10px] leading-tight text-zinc-500">
              Напиток не рекомендуется детям до 18 лет, беременным и лицам с повышенной нервной возбудимостью.
            </p>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#25e3c9] px-4 py-2.5 text-sm font-black text-black uppercase tracking-wider">
              Три вкуса
            </span>
          </div>
        </div>
      </div>

      {/* MODAL DIALOG */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 text-white shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 rounded-lg bg-white/5 p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div
                className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
                  activeModal === "nodbet" ? "bg-[#E10600] text-white" : "bg-cyan-500 text-slate-950"
                }`}
              >
                <CheckCircle2 size={36} />
              </div>

              <h4 className="font-display text-2xl font-bold uppercase tracking-wider">
                {activeModal === "nodbet" ? "NODBET x NJDC 2026" : "1DONY x NJDC 2026"}
              </h4>

              <p className="mt-2 text-sm text-zinc-300">
                {activeModal === "nodbet"
                  ? "NODBET — Ставь на своих! Главный спонсор твоих уверенных побед и сочных клатчей. Быстрые ставки, честные исходы."
                  : "1DONY — Твой надежный проводник в мир ярких эмоций. Регистрируйся на 1DONY прямо сейчас и забирай свой стартовый бонус на первую игру!"}
              </p>

              <div className="mt-5 w-full rounded-xl bg-white/5 p-3 text-center border border-white/10">
                <span className="text-xs uppercase text-zinc-400 block">Активированный промокод</span>
                <span className="font-mono text-lg font-bold text-gradient">NJDC-BONUS-2026</span>
              </div>

              {activeModal === "nodbet" ? (
                <div className="mt-6 flex flex-col gap-2.5 w-full">
                  <Link
                    to="/nodbet"
                    onClick={() => setActiveModal(null)}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-3.5 text-sm font-black uppercase text-white shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer block text-center"
                  >
                    🎰 Открыть Арену Ставок и Рулетку (+10,000 NOD)
                  </Link>
                  <button
                    onClick={() => setActiveModal(null)}
                    className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/20 cursor-pointer"
                  >
                    Закрыть
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveModal(null)}
                  className="mt-6 w-full rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
                >
                  Понятно, на главный экран
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
