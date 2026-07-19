import { Link } from "react-router-dom";
import { Trophy, Users, Swords, Layers, ArrowRight, Sparkles, Crown } from "lucide-react";
import { useData } from "../context/DataContext";
import { STAGE_LABELS } from "../utils/scoring";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import Sponsors from "../components/Sponsors";

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Все команды стартуют с нуля. Пары определяет случайная жеребьёвка — 3 матча Bo1, три победителя получают по 3 очка.",
  2: "Швейцарская система: битва лидеров, битва аутсайдеров и кросс-матч. После этапа команды расходятся на 6, 3 и 0 очков.",
  3: "Формат Bo2 допускает ничью 1:1. Пары формируются по соседству в таблице — 1 к 2, 3 к 4, 5 к 6.",
  4: "Финальный отборочный раунд Bo2. Актуальная таблица сводит ближайших соперников, которые ещё не встречались.",
  5: "Плей-офф без очков и таблиц: матч за 5-е место, бронзовый матч и Гранд-финал — всё решает серия до двух побед (Bo3).",
};

export default function Home() {
  const { teams, matches, settings } = useData();

  const featured = matches
    .filter((m) => m.status !== "finished")
    .slice(0, 3);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/hero-bg.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#0d0d0d]/80 to-[#0d0d0d]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          {settings.announcement && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {settings.announcement}
            </div>
          )}
          <h1 className="font-display max-w-3xl text-5xl font-bold leading-[1.05] text-white sm:text-7xl">
            {settings.hero_title}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-300 sm:text-xl">{settings.hero_subtitle}</p>
          <p className="mt-3 max-w-xl text-sm text-zinc-500">
            Сервер «{settings.server_name}» · Counter-Strike 2 · Платформа{" "}
            <a href="https://cybershoke.net/" target="_blank" rel="noreferrer" className="text-zinc-300 underline decoration-dotted underline-offset-4 hover:text-white">
              CYBERSHOKE
            </a>
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/bracket"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Турнирная сетка <ArrowRight size={16} />
            </Link>
            <Link
              to="/teams"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40"
            >
              Составы команд
            </Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Users, label: "Команд", value: "6" },
            { icon: Swords, label: "Игроков 2×2", value: "12" },
            { icon: Layers, label: "Этапов", value: "5" },
            { icon: Trophy, label: "Формат", value: "Bo1 / Bo2 / Bo3" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 text-center">
              <s.icon className="mx-auto mb-2 text-fuchsia-400" size={22} />
              <p className="font-display text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FORMAT */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Формат турнира</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Путь от жеребьёвки до Гранд-финала — 5 строгих этапов, каждый со своей системой начисления очков.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(STAGE_LABELS).map(([stageNum, s]) => (
            <div
              key={stageNum}
              className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-6 transition-colors hover:border-white/20"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">{s.emoji}</span>
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {s.format}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-white">{s.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{STAGE_DESCRIPTIONS[Number(stageNum)]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MATCHES PREVIEW */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Ближайшие матчи</h2>
            <Link to="/matches" className="text-sm font-medium text-zinc-400 hover:text-white">
              Все матчи →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map((m) => {
              const teamA = teams.find((t) => t.id === m.team_a);
              const teamB = teams.find((t) => t.id === m.team_b);
              return (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-colors hover:border-fuchsia-500/40"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{m.title}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2">
                      <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "?"} size={44} />
                      <span className="text-xs font-medium text-zinc-300">{teamA?.name ?? "TBD"}</span>
                    </div>
                    <span className="font-display text-lg font-bold text-zinc-600">VS</span>
                    <div className="flex flex-col items-center gap-2">
                      <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "?"} size={44} />
                      <span className="text-xs font-medium text-zinc-300">{teamB?.name ?? "TBD"}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* SPONSORS */}
      <Sponsors />

      {/* PRIZE POOL — HIGHLIGHTED & PROMINENT */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-purple-950/70 to-fuchsia-950/60 p-8 sm:p-12 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
          <div className="absolute -right-10 -bottom-10 pointer-events-none opacity-10">
            <Crown size={280} className="text-amber-400" />
          </div>
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300 backdrop-blur">
              <Sparkles size={14} className="text-amber-400 animate-pulse" /> Главный приз турнира
            </div>
            <h2 className="font-display max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Награды для чемпионов <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">NJDC 2026</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base text-zinc-200 sm:text-lg leading-relaxed">{settings.prize_text}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-black/40 px-5 py-3.5 backdrop-blur shadow-lg">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 text-xl font-bold">
                  🏆
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Подписки CYBERSHOKE</p>
                  <p className="text-sm font-bold text-white">2× Подписки Lite (для каждого игрока команды)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/30 bg-black/40 px-5 py-3.5 backdrop-blur shadow-lg">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300 text-xl font-bold">
                  📜
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-fuchsia-400 font-semibold">Официальный статус</p>
                  <p className="text-sm font-bold text-white">Именной диплом победителя турнира</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEAMS PREVIEW */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Участники</h2>
          <Link to="/teams" className="text-sm font-medium text-zinc-400 hover:text-white">
            Все команды →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {teams
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((t) => (
              <Link
                key={t.id}
                to="/teams"
                className="flex flex-col items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-5 text-center transition-colors hover:border-white/20"
              >
                <TeamLogo src={t.logo_url} alt={t.name} size={56} />
                <span className="text-sm font-semibold text-white">{t.name}</span>
                <span className="text-[11px] text-zinc-500">{t.players_label}</span>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
