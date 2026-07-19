import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import TeamLogo from "../components/TeamLogo";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { players, teams } = useData();
  const sorted = players.slice().sort((a, b) => b.rating - a.rating);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Таблица <span className="text-gradient">лидеров</span>
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-500">
            Рейтинг игроков NJDC 2026, составленный по K/D за 10+ матчей на сервере, Faceit Elo и статистике CYBERSHOKE.
          </p>
        </div>

        <Link
          to="/nodbet"
          className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-red-500/10 px-4 py-2.5 text-xs font-bold text-yellow-400 hover:border-yellow-500/60 transition-all shadow-md shrink-0"
        >
          <span>👑 Рейтинг по ставкам (Топ Хайроллеров NODBET)</span>
          <span>→</span>
        </Link>
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Игрок</th>
              <th className="px-4 py-3">Команда</th>
              <th className="px-4 py-3 text-center">K/D</th>
              <th className="px-4 py-3 text-center">Faceit Elo</th>
              <th className="px-4 py-3 text-center">Рейтинг</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((p, idx) => {
              const team = teams.find((t) => t.id === p.team_id);
              return (
                <tr key={p.id} className={idx < 3 ? "bg-fuchsia-500/[0.04]" : ""}>
                  <td className="px-4 py-3 font-display text-lg font-bold text-zinc-400">
                    {MEDALS[idx] ?? idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-white">{p.nickname}</p>
                      <p className="text-xs text-zinc-500">{p.role}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {team && (
                      <Link to={`/teams/${team.id}`} className="flex items-center gap-2 hover:text-fuchsia-400">
                        <TeamLogo src={team.logo_url} alt={team.name} size={26} />
                        <span className="text-zinc-300">{team.name}</span>
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-300">{p.kd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center text-zinc-300">{p.faceit_elo}</td>
                  <td className="px-4 py-3 text-center font-display text-lg font-bold text-white">{p.rating}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
