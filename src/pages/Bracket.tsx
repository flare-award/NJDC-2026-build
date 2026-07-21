import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import { computeStandings, STAGE_LABELS } from "../utils/scoring";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";

export default function Bracket() {
  const { teams, matches } = useData();
  const standings = computeStandings(teams, matches);

  const groupStages = [1, 2, 3, 4] as const;
  const playoffMatches = matches
    .filter((m) => m.stage === 5)
    .sort((a, b) => a.match_number - b.match_number);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
        Турнирная <span className="text-gradient">сетка</span>
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-500">
        Групповая стадия из 4 этапов формирует итоговую таблицу, по которой шесть команд распределяются на
        плей-офф Bo3.
      </p>

      {/* STANDINGS TABLE */}
      <div className="mt-10 overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Команда</th>
              <th className="px-4 py-3 text-center">И</th>
              <th className="px-4 py-3 text-center">В</th>
              <th className="px-4 py-3 text-center">Н</th>
              <th className="px-4 py-3 text-center">П</th>
              <th className="px-4 py-3 text-center">Карты</th>
              <th className="px-4 py-3 text-center">Очки</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {standings.map((s, idx) => (
              <tr key={s.id} className={idx < 2 ? "bg-fuchsia-500/[0.04]" : idx >= 4 ? "bg-red-500/[0.03]" : ""}>
                <td className="px-4 py-3 font-display font-bold text-zinc-400">{idx + 1}</td>
                <td className="px-4 py-3">
                  <Link to={`/teams/${s.id}`} className="flex items-center gap-3 hover:text-fuchsia-400">
                    <TeamLogo src={s.logo_url} alt={s.name} size={32} />
                    <span className="font-semibold text-white">{s.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-center text-zinc-300">{s.played}</td>
                <td className="px-4 py-3 text-center text-emerald-400">{s.wins}</td>
                <td className="px-4 py-3 text-center text-zinc-400">{s.draws}</td>
                <td className="px-4 py-3 text-center text-red-400">{s.losses}</td>
                <td className="px-4 py-3 text-center text-zinc-400">
                  {s.mapsWon}:{s.mapsLost}
                </td>
                <td className="px-4 py-3 text-center font-display text-lg font-bold text-white">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Топ-2 (подсветка) идут в верхнюю половину плей-офф, нижние 2 команды поборются за 5-е место. Очки: Bo1 — 3
        за победу; Bo2 — 3 за победу 2:0, по 1 за ничью 1:1.
      </p>

      {/* STAGES */}
      <div className="mt-16 space-y-14">
        {groupStages.map((stage) => {
          const stageMatches = matches
            .filter((m) => m.stage === stage)
            .sort((a, b) => a.match_number - b.match_number);
          const label = STAGE_LABELS[stage];
          return (
            <div key={stage}>
              <div className="mb-5 flex items-center gap-3">
                <span className="text-2xl">{label.emoji}</span>
                <h2 className="font-display text-2xl font-bold text-white">{label.name}</h2>
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {label.format}
                </span>
              </div>
              {stageMatches.length === 0 ? (
                <p className="text-sm text-zinc-600">Матчи этого этапа ещё не назначены.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {stageMatches.map((m) => (
                    <MatchMiniCard key={m.id} matchId={m.id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* PLAYOFFS */}
        <div>
          <div className="mb-5 flex items-center gap-3">
            <span className="text-2xl">{STAGE_LABELS[5].emoji}</span>
            <h2 className="font-display text-2xl font-bold text-white">{STAGE_LABELS[5].name}</h2>
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {STAGE_LABELS[5].format}
            </span>
          </div>
          {playoffMatches.length === 0 ? (
            <p className="text-sm text-zinc-600">Плей-офф сформируется по итогам групповой стадии.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {playoffMatches.map((m) => (
                <MatchMiniCard key={m.id} matchId={m.id} highlight={m.title.toLowerCase().includes("финал")} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchMiniCard({ matchId, highlight = false }: { matchId: string; highlight?: boolean }) {
  const { teams, matches } = useData();
  const m = matches.find((x) => x.id === matchId);
  if (!m) return null;
  const teamA = teams.find((t) => t.id === m.team_a);
  const teamB = teams.find((t) => t.id === m.team_b);
  return (
    <Link
      to={`/matches/${m.id}`}
      className={`rounded-xl border p-4 transition-colors hover:border-fuchsia-500/40 ${
        highlight ? "border-yellow-500/30 bg-yellow-500/[0.04]" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{m.title}</span>
        <StatusBadge status={m.status} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={28} />
          <span className="font-medium text-zinc-200">{teamA?.name ?? "TBD"}</span>
        </div>
        <span className="font-display font-bold text-white">
          {m.status === "upcoming" ? "—" : `${m.score_a}:${m.score_b}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-200">{teamB?.name ?? "TBD"}</span>
          <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={28} />
        </div>
      </div>
    </Link>
  );
}
