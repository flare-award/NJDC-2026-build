import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { STAGE_LABELS } from "../utils/scoring";
import type { MatchStatus } from "../types";

const FILTERS: { key: MatchStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "live", label: "LIVE" },
  { key: "upcoming", label: "Скоро" },
  { key: "finished", label: "Завершённые" },
];

export default function Matches() {
  const { teams, matches } = useData();
  const [filter, setFilter] = useState<MatchStatus | "all">("all");

  const filtered = matches
    .filter((m) => filter === "all" || m.status === filter)
    .sort((a, b) => a.stage - b.stage || a.match_number - b.match_number);

  const byStage = filtered.reduce<Record<number, typeof filtered>>((acc, m) => {
    acc[m.stage] = acc[m.stage] ? [...acc[m.stage], m] : [m];
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
        Матчи <span className="text-gradient">турнира</span>
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-500">Расписание, счёт и ссылки на CYBERSHOKE для всех игр NJDC 2026.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "border-transparent bg-gradient-brand text-white"
                : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-10 space-y-12">
        {Object.keys(byStage).length === 0 && <p className="text-zinc-500">Матчи не найдены.</p>}
        {Object.entries(byStage)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([stage, list]) => (
            <div key={stage}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xl">{STAGE_LABELS[Number(stage)]?.emoji}</span>
                <h2 className="font-display text-xl font-bold text-white">{STAGE_LABELS[Number(stage)]?.name}</h2>
              </div>
              <div className="space-y-3">
                {list.map((m) => {
                  const teamA = teams.find((t) => t.id === m.team_a);
                  const teamB = teams.find((t) => t.id === m.team_b);
                  return (
                    <Link
                      key={m.id}
                      to={`/matches/${m.id}`}
                      className="flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-colors hover:border-fuchsia-500/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 sm:w-40">
                        <span className="text-sm font-semibold text-zinc-300">{m.title}</span>
                      </div>
                      <div className="flex flex-1 items-center justify-center gap-4">
                        <div className="flex items-center gap-2 sm:w-40 sm:justify-end">
                          <span className="text-sm font-medium text-zinc-200">{teamA?.name ?? "TBD"}</span>
                          <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={30} />
                        </div>
                        <span className="font-display min-w-[64px] text-center text-lg font-bold text-white">
                          {m.status === "upcoming" ? "VS" : `${m.score_a} : ${m.score_b}`}
                        </span>
                        <div className="flex items-center gap-2 sm:w-40">
                          <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={30} />
                          <span className="text-sm font-medium text-zinc-200">{teamB?.name ?? "TBD"}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:w-32 sm:justify-end">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-600">{m.format}</span>
                        <StatusBadge status={m.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
