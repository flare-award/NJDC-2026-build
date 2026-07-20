import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useData } from "../context/DataContext";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { computeStandings } from "../utils/scoring";
import { seriesScore } from "../utils/matchMaps";

export default function TeamDetail() {
  const { id } = useParams();
  const { teams, players, matches } = useData();
  const team = teams.find((t) => t.id === id);
  const standings = computeStandings(teams, matches);
  const standing = standings.find((s) => s.id === id);
  const roster = players.filter((p) => p.team_id === id).sort((a, b) => b.rating - a.rating);
  const teamMatches = matches
    .filter((m) => m.team_a === id || m.team_b === id)
    .sort((a, b) => a.stage - b.stage || a.match_number - b.match_number);

  if (!team) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-zinc-400">Команда не найдена.</p>
        <Link to="/teams" className="mt-4 inline-block text-fuchsia-400">
          ← Ко всем командам
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <Link to="/teams" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
        <ArrowLeft size={16} /> Ко всем командам
      </Link>

      <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center sm:flex-row sm:text-left">
        <TeamLogo src={team.logo_url} alt={team.name} size={96} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Команда {team.code}</p>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{team.name}</h1>
          <p className="mt-1 text-zinc-400">{team.players_label}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:ml-auto">
          <Stat label="Рейтинг" value={team.rating} />
          <Stat label="Очки" value={standing?.points ?? 0} />
          <Stat label="М / Н / П" value={`${standing?.wins ?? 0}/${standing?.draws ?? 0}/${standing?.losses ?? 0}`} />
        </div>
      </div>

      <h2 className="mt-12 font-display text-2xl font-bold text-white">Состав</h2>
      <div className="mt-5 overflow-hidden rounded-xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Игрок</th>
              <th className="px-4 py-3">K/D</th>
              <th className="px-4 py-3">Faceit Elo</th>
              <th className="px-4 py-3">Рейтинг</th>
              <th className="px-4 py-3">Заметка</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {roster.map((p) => (
              <tr key={p.id} className="text-zinc-300">
                <td className="px-4 py-3 font-semibold text-white">{p.nickname}</td>
                <td className="px-4 py-3">{p.kd.toFixed(2)}</td>
                <td className="px-4 py-3">{p.faceit_elo}</td>
                <td className="px-4 py-3 text-fuchsia-400">{p.rating}</td>
                <td className="px-4 py-3 text-zinc-500">{p.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 font-display text-2xl font-bold text-white">История матчей</h2>
      <div className="mt-5 space-y-3">
        {teamMatches.length === 0 && <p className="text-sm text-zinc-500">Матчи ещё не назначены.</p>}
        {teamMatches.map((m) => {
          const opponentId = m.team_a === id ? m.team_b : m.team_a;
          const opponent = teams.find((t) => t.id === opponentId);
          const series = seriesScore(m);
          const myScore = m.team_a === id ? series.a : series.b;
          const oppScore = m.team_a === id ? series.b : series.a;
          return (
            <Link
              key={m.id}
              to={`/matches/${m.id}`}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-5 py-3 hover:border-white/20"
            >
              <div>
                <p className="text-sm font-semibold text-white">{m.title}</p>
                <p className="text-xs text-zinc-500">vs {opponent?.name ?? "TBD"} · Этап {m.stage} · {m.format.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-4">
                {m.status === "finished" && (
                  <span className="font-display text-lg font-bold text-white">
                    {myScore} : {oppScore}
                  </span>
                )}
                <StatusBadge status={m.status} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}
