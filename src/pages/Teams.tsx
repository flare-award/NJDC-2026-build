import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import TeamLogo from "../components/TeamLogo";
import { computeStandings } from "../utils/scoring";

export default function Teams() {
  const { teams, players, matches } = useData();
  const standings = computeStandings(teams, matches);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
        Команды <span className="text-gradient">NJDC 2026</span>
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-500">
        6 составов 2×2, отобранных по реальному K/D за 10+ матчей на сервере, Faceit Elo, статистике CYBERSHOKE и
        экспертной оценке организаторов.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {teams
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((team) => {
            const roster = players.filter((p) => p.team_id === team.id);
            const standing = standings.find((s) => s.id === team.id);
            return (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="group rounded-2xl border border-white/8 bg-white/[0.02] p-6 transition-colors hover:border-fuchsia-500/40"
              >
                <div className="flex items-center gap-4">
                  <TeamLogo src={team.logo_url} alt={team.name} size={64} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Команда {team.code}</p>
                    <h3 className="font-display text-xl font-bold text-white">{team.name}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm text-zinc-400">{team.players_label}</p>
                <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
                  <span className="text-zinc-500">
                    Рейтинг силы: <span className="font-semibold text-zinc-200">{team.rating}</span>
                  </span>
                  <span className="text-zinc-500">
                    Очки: <span className="font-semibold text-fuchsia-400">{standing?.points ?? 0}</span>
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {roster.map((p) => (
                    <span key={p.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                      {p.nickname}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
