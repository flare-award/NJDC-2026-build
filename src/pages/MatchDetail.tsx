import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, TrendingUp, Lock, ShieldCheck, MapPin } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUserAuth } from "../context/UserAuthContext";
import { useNodbet } from "../context/NodbetContext";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { STAGE_LABELS } from "../utils/scoring";
import { computeOdds } from "../utils/odds";
import { computeMatchAnalytics } from "../utils/analytics";
import { normalizeMaps, mapPlayed, mapHadOvertime, mapWinner, maxMapCount, relevantMapCount } from "../utils/matchMaps";

export default function MatchDetail() {
  const { id } = useParams();
  const { teams, players, matches, votes, castVote, isSupabaseConfigured } = useData();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const { hasRadar, buyPerk } = useNodbet();
  const [voting, setVoting] = useState(false);

  const match = matches.find((m) => m.id === id);
  const myVote = user ? votes.find((v) => v.match_id === id && v.voter_id === user.id) : null;

  if (!match) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-zinc-400">Матч не найден.</p>
        <Link to="/matches" className="mt-4 inline-block text-fuchsia-400">
          ← Ко всем матчам
        </Link>
      </div>
    );
  }

  const teamA = teams.find((t) => t.id === match.team_a);
  const teamB = teams.find((t) => t.id === match.team_b);
  const rosterA = players.filter((p) => p.team_id === match.team_a);
  const rosterB = players.filter((p) => p.team_id === match.team_b);

  const votesA = votes.filter((v) => v.match_id === match.id && v.team_choice === match.team_a).length;
  const votesB = votes.filter((v) => v.match_id === match.id && v.team_choice === match.team_b).length;
  const odds = computeOdds(votesA, votesB);
  const votingLocked = match.status === "finished";

  const analytics = computeMatchAnalytics(match, teams, players);

  async function handleVote(teamId: string | null) {
    if (!teamId || voting || votingLocked) return;
    if (!user) {
      setAuthMode("signin");
      setAuthModalOpen(true);
      return;
    }
    setVoting(true);
    try {
      await castVote(match!.id, teamId, user.id);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <Link to="/matches" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
        <ArrowLeft size={16} /> Ко всем матчам
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">{STAGE_LABELS[match.stage]?.emoji}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {STAGE_LABELS[match.stage]?.name} · {match.format.toUpperCase()}
            </p>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{match.title}</h1>
            {match.note && <p className="text-sm text-zinc-500">{match.note}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseConfigured && match.status === "live" && (
            <span className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-green-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400"></span>
              LIVE
            </span>
          )}
          <StatusBadge status={match.status} />
        </div>
      </div>

      {/* SCORE */}
      <div className="mt-10 grid grid-cols-3 items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-8">
        <Link to={`/teams/${teamA?.id}`} className="flex flex-col items-center gap-3 text-center">
          <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={80} />
          <span className="font-display text-lg font-bold text-white">{teamA?.name ?? "TBD"}</span>
          <span className="text-xs text-zinc-500">{teamA?.players_label}</span>
        </Link>
        <div className="text-center">
          <p className="font-display text-5xl font-bold text-white sm:text-6xl">
            {match.status === "upcoming" ? "VS" : `${match.score_a} : ${match.score_b}`}
          </p>
          {maxMapCount(match.format) > 1 && match.status !== "upcoming" && (
            <div className="mt-2 flex flex-col items-center gap-0.5">
              {normalizeMaps(match).slice(0, relevantMapCount(match)).map((mp, i) =>
                mapPlayed(mp) ? (
                  <span key={i} className="text-[11px] font-mono text-zinc-400">
                    Карта {i + 1}: <b className="text-zinc-200">{mp.score_a}:{mp.score_b}</b>
                    {mapHadOvertime(mp) && <span className="ml-1 text-yellow-400">ОТ</span>}
                  </span>
                ) : (
                  <span key={i} className="text-[11px] font-mono text-zinc-600">
                    Карта {i + 1}: —
                  </span>
                )
              )}
            </div>
          )}
          {match.scheduled_at && <p className="mt-2 text-xs text-zinc-500">{match.scheduled_at}</p>}
        </div>
        <Link to={`/teams/${teamB?.id}`} className="flex flex-col items-center gap-3 text-center">
          <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={80} />
          <span className="font-display text-lg font-bold text-white">{teamB?.name ?? "TBD"}</span>
          <span className="text-xs text-zinc-500">{teamB?.players_label}</span>
        </Link>
      </div>

      {match.cybershoke_url && (
        <a
          href={match.cybershoke_url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-white/15 py-3 text-sm font-semibold text-white transition-colors hover:border-transparent hover:bg-gradient-brand"
        >
          Открыть матч на CYBERSHOKE <ExternalLink size={16} />
        </a>
      )}

      {/* КАРТЫ (КАТКИ) МАТЧА Bo2 / Bo3 (пункт 10) */}
      {maxMapCount(match.format) > 1 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="text-yellow-400" size={20} /> Катки матча ({match.format.toUpperCase()})
            </h2>
            <span className="text-xs text-zinc-400">
              {match.format === "bo2" ? "Формат Bo2 (две катки)" : "Формат Bo3 (серия до двух побед)"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Катка 1 — отображается всегда */}
            {(() => {
              const maps = normalizeMaps(match);
              const mp1 = maps[0] || { score_a: 0, score_b: 0 };
              const w1 = mapWinner(mp1);
              const played1 = mapPlayed(mp1);
              const ot1 = mapHadOvertime(mp1);
              return (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-white/5 pb-2">
                      <span className="text-yellow-400">Карта 1 (Катка 1)</span>
                      <span>{played1 ? "Сыграна" : match.status === "live" ? "Идёт (LIVE)" : "Ожидание"}</span>
                    </div>

                    <div className="flex items-center justify-between my-3 font-display">
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={26} />
                        <span className="font-bold text-white text-sm">{teamA?.name || "TBD"}</span>
                      </div>
                      <span className="text-xl font-black font-mono text-yellow-400">{mp1.score_a}</span>
                    </div>

                    <div className="flex items-center justify-between my-3 font-display">
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={26} />
                        <span className="font-bold text-white text-sm">{teamB?.name || "TBD"}</span>
                      </div>
                      <span className="text-xl font-black font-mono text-yellow-400">{mp1.score_b}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    {played1 && w1 ? (
                      <span className="inline-flex items-center gap-1.5 text-green-400 font-bold">
                        🏆 Победа: {w1 === "a" ? teamA?.name : teamB?.name}
                      </span>
                    ) : played1 ? (
                      <span className="text-zinc-400">Ничья по раундам</span>
                    ) : (
                      <span className="text-zinc-500">Счёт ещё не открыт</span>
                    )}
                    {ot1 && <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">⚡ Овертайм</span>}
                  </div>
                </div>
              );
            })()}

            {/* Катка 2 — отображается, только если первая катка/матч не в status === 'upcoming' */}
            {(() => {
              if (match.status === "upcoming") {
                return (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 flex flex-col justify-center items-center text-center text-zinc-500 min-h-[190px]">
                    <span className="text-2xl mb-2">🔒</span>
                    <p className="font-bold text-zinc-400 text-sm">Карта 2 (Катка 2)</p>
                    <p className="text-xs mt-1 text-zinc-600">Отобразится во время LIVE или после завершения 1-й катки.</p>
                  </div>
                );
              }
              const maps = normalizeMaps(match);
              const mp2 = maps[1] || { score_a: 0, score_b: 0 };
              const w2 = mapWinner(mp2);
              const played2 = mapPlayed(mp2);
              const ot2 = mapHadOvertime(mp2);
              return (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-white/5 pb-2">
                      <span className="text-yellow-400">Карта 2 (Катка 2)</span>
                      <span>{played2 ? "Сыграна" : match.status === "finished" ? "Не состоялась" : "В процессе / Скоро"}</span>
                    </div>

                    <div className="flex items-center justify-between my-3 font-display">
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={26} />
                        <span className="font-bold text-white text-sm">{teamA?.name || "TBD"}</span>
                      </div>
                      <span className="text-xl font-black font-mono text-yellow-400">{mp2.score_a}</span>
                    </div>

                    <div className="flex items-center justify-between my-3 font-display">
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={26} />
                        <span className="font-bold text-white text-sm">{teamB?.name || "TBD"}</span>
                      </div>
                      <span className="text-xl font-black font-mono text-yellow-400">{mp2.score_b}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    {played2 && w2 ? (
                      <span className="inline-flex items-center gap-1.5 text-green-400 font-bold">
                        🏆 Победа: {w2 === "a" ? teamA?.name : teamB?.name}
                      </span>
                    ) : played2 ? (
                      <span className="text-zinc-400">Ничья по раундам</span>
                    ) : (
                      <span className="text-zinc-500">Счёт ещё не открыт</span>
                    )}
                    {ot2 && <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">⚡ Овертайм</span>}
                  </div>
                </div>
              );
            })()}

            {/* Катка 3 — отображается ТОЛЬКО при Bo3, если потребовалась */}
            {match.format === "bo3" && (() => {
              if (match.status === "upcoming") {
                return (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 flex flex-col justify-center items-center text-center text-zinc-500 min-h-[190px]">
                    <span className="text-2xl mb-2">🔒</span>
                    <p className="font-bold text-zinc-400 text-sm">Карта 3 (Катка 3)</p>
                    <p className="text-xs mt-1 text-zinc-600">Отобразится, если потребуется (при счёте 1:1 по картам).</p>
                  </div>
                );
              }
              const relCount = relevantMapCount(match);
              if (relCount < 3 && match.status === "finished") {
                return (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 flex flex-col justify-center items-center text-center text-zinc-500 min-h-[190px]">
                    <span className="text-2xl mb-2">⚡</span>
                    <p className="font-bold text-zinc-400 text-sm">Карта 3 (Катка 3)</p>
                    <p className="text-xs mt-1 text-green-400/80 font-semibold">Не потребовалась — серия завершена (2:0 / 0:2)</p>
                  </div>
                );
              }
              const maps = normalizeMaps(match);
              const mp3 = maps[2] || { score_a: 0, score_b: 0 };
              const w3 = mapWinner(mp3);
              const played3 = mapPlayed(mp3);
              const ot3 = mapHadOvertime(mp3);
              return (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-white/5 pb-2">
                      <span className="text-yellow-400">Карта 3 (Катка 3)</span>
                      <span>{played3 ? "Сыграна" : "В процессе / Скоро"}</span>
                    </div>

                    <div className="flex items-center justify-between my-3 font-display">
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={26} />
                        <span className="font-bold text-white text-sm">{teamA?.name || "TBD"}</span>
                      </div>
                      <span className="text-xl font-black font-mono text-yellow-400">{mp3.score_a}</span>
                    </div>

                    <div className="flex items-center justify-between my-3 font-display">
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={26} />
                        <span className="font-bold text-white text-sm">{teamB?.name || "TBD"}</span>
                      </div>
                      <span className="text-xl font-black font-mono text-yellow-400">{mp3.score_b}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    {played3 && w3 ? (
                      <span className="inline-flex items-center gap-1.5 text-green-400 font-bold">
                        🏆 Победа: {w3 === "a" ? teamA?.name : teamB?.name}
                      </span>
                    ) : played3 ? (
                      <span className="text-zinc-400">Ничья по раундам</span>
                    ) : (
                      <span className="text-zinc-500">Решающая катка серии</span>
                    )}
                    {ot3 && <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">⚡ Овертайм</span>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ROSTERS */}
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <RosterTable teamName={teamA?.name ?? "TBD"} roster={rosterA} />
        <RosterTable teamName={teamB?.name ?? "TBD"} roster={rosterB} />
      </div>

      {/* VOTING / ODDS */}
      {teamA && teamB && (
        <div className="mt-12 rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-fuchsia-400" />
              <h2 className="font-display text-xl font-bold text-white">Прогнозы зрителей</h2>
              {votingLocked && <span className="text-xs text-zinc-500">— голосование завершено</span>}
            </div>
            {!user && (
              <button
                onClick={() => {
                  setAuthMode("signin");
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300"
              >
                <Lock size={13} /> Войдите, чтобы проголосовать
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <VoteOption
              team={teamA}
              odds={odds.oddsA}
              pct={odds.pctA}
              votes={votesA}
              selected={myVote?.team_choice === teamA.id}
              disabled={voting || votingLocked}
              onVote={() => handleVote(teamA.id)}
            />
            <VoteOption
              team={teamB}
              odds={odds.oddsB}
              pct={odds.pctB}
              votes={votesB}
              selected={myVote?.team_choice === teamB.id}
              disabled={voting || votingLocked}
              onVote={() => handleVote(teamB.id)}
            />
          </div>
          <p className="mt-4 text-center text-xs text-zinc-600">
            Всего голосов: {votesA + votesB}. Каждый авторизованный пользователь = 1 честный голос.
          </p>
        </div>
      )}

      {/* NODBET AI RADAR — реальная аналитика по составам (пункт 9) */}
      {teamA && teamB && (
        <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-[#151212] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-yellow-500 via-red-600 to-yellow-500" />
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 text-black font-black text-lg">⚡</span>
              <div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                  NODBET ANALYTICS & PREDICTION
                </span>
                <h3 className="font-display text-xl font-bold text-white mt-0.5">Инсайдерский AI-Радар Исходов</h3>
              </div>
            </div>

            {hasRadar ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/20 border border-green-500/40 px-3 py-1 text-xs font-bold text-green-300">
                <ShieldCheck size={14} /> Сканер Активен
              </span>
            ) : (
              <button
                onClick={() => buyPerk("radar")}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 px-4 py-2 text-xs font-black text-black hover:opacity-90 active:scale-95 cursor-pointer"
              >
                Разблокировать за 1,800,000 NOD
              </button>
            )}
          </div>

          {!hasRadar ? (
            <div className="rounded-xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur-md">
              <Lock size={28} className="mx-auto text-yellow-400 mb-2" />
              <h4 className="font-display text-base font-bold text-white">Аналитика закрыта защитным экраном NODBET</h4>
              <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                Откройте AI-Радар, чтобы увидеть реальные шансы команд на победу, посчитанные по Faceit Elo, K/D и рейтингу игроков каждого состава!
              </p>
            </div>
          ) : !analytics.hasData ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-center">
              <p className="text-sm text-zinc-400">
                Недостаточно статистики по составам этого матча для точного анализа. Данные появятся, как только будут заполнены игроки обеих команд.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl bg-black/40 p-4 border border-white/10 space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-white">
                    {teamA.name} <span className="text-yellow-400 font-mono">{analytics.pctA}%</span>
                  </span>
                  <span className="text-zinc-400">Шансы на победу по версии NODBET AI</span>
                  <span className="text-white">
                    <span className="text-red-400 font-mono">{analytics.pctB}%</span> {teamB.name}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-red-600/40 overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-500" style={{ width: `${analytics.pctA}%` }} />
                  <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${analytics.pctB}%` }} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                  <span className="text-xs font-bold text-zinc-400 uppercase block mb-1">{teamA.name}</span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Ср. Faceit Elo: <b className="text-white">{Math.round(analytics.a.avgElo)}</b>
                    <br />
                    Ср. K/D: <b className="text-white">{analytics.a.avgKd.toFixed(2)}</b>
                    <br />
                    Индекс силы: <b className="text-yellow-300">{analytics.a.power}</b>
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                  <span className="text-xs font-bold text-zinc-400 uppercase block mb-1">{teamB.name}</span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Ср. Faceit Elo: <b className="text-white">{Math.round(analytics.b.avgElo)}</b>
                    <br />
                    Ср. K/D: <b className="text-white">{analytics.b.avgKd.toFixed(2)}</b>
                    <br />
                    Индекс силы: <b className="text-yellow-300">{analytics.b.power}</b>
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                  <span className="text-xs font-bold text-zinc-400 uppercase block mb-1">Фактор клатча</span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Вероятность успешного клатча 1v2 у фаворита{" "}
                    (<b className="text-white">{analytics.favoriteName}</b>) оценивается в{" "}
                    <b className="text-yellow-300">{analytics.clutchPct}%</b>.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-yellow-500/5 p-4 border border-yellow-500/20">
                <span className="text-xs font-bold text-yellow-400 uppercase block mb-1">ВЕРДИКТ NODBET AI</span>
                <p className="text-xs text-zinc-300">«{analytics.verdict}»</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RosterTable({ teamName, roster }: { teamName: string; roster: { id: string; nickname: string; kd: number; faceit_elo: number; rating: number }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8">
      <div className="bg-white/5 px-4 py-3">
        <h3 className="font-display font-bold text-white">{teamName}</h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-600">
          <tr>
            <th className="px-4 py-2">Игрок</th>
            <th className="px-4 py-2">K/D</th>
            <th className="px-4 py-2">Elo</th>
            <th className="px-4 py-2">Рейтинг</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {roster.map((p) => (
            <tr key={p.id} className="text-zinc-300">
              <td className="px-4 py-2.5 font-medium text-white">{p.nickname}</td>
              <td className="px-4 py-2.5">{p.kd.toFixed(2)}</td>
              <td className="px-4 py-2.5">{p.faceit_elo}</td>
              <td className="px-4 py-2.5 text-fuchsia-400">{p.rating}</td>
            </tr>
          ))}
          {roster.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-3 text-zinc-600">
                Состав уточняется
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VoteOption({
  team,
  odds,
  pct,
  votes,
  selected,
  disabled,
  onVote,
}: {
  team: { id: string; name: string; logo_url: string };
  odds: number;
  pct: number;
  votes: number;
  selected: boolean;
  disabled: boolean;
  onVote: () => void;
}) {
  return (
    <button
      onClick={onVote}
      disabled={disabled}
      className={`relative overflow-hidden rounded-xl border p-5 text-left transition-colors ${
        selected ? "border-fuchsia-500 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/30"
      } ${disabled && !selected ? "cursor-default opacity-70" : ""}`}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, rgba(124,58,237,0.12), rgba(220,38,38,0.12))" }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TeamLogo src={team.logo_url} alt={team.name} size={40} />
          <div>
            <p className="font-semibold text-white">{team.name}</p>
            <p className="text-xs text-zinc-500">
              {votes} голосов · {pct}%
            </p>
          </div>
        </div>
        <span className="font-display text-2xl font-bold text-white">{odds.toFixed(2)}</span>
      </div>
      {selected && <p className="relative mt-3 text-xs font-medium text-fuchsia-400">✓ Ваш голос учтён</p>}
    </button>
  );
}
