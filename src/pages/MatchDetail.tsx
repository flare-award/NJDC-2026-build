import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, TrendingUp, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUserAuth } from "../context/UserAuthContext";
import { useNodbet } from "../context/NodbetContext";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { STAGE_LABELS } from "../utils/scoring";
import { computeOdds } from "../utils/odds";

export default function MatchDetail() {
  const { id } = useParams();
  const { teams, players, matches, votes, castVote, isSupabaseConfigured } = useData();
  const { user, setAuthModalOpen, setAuthMode } = useUserAuth();
  const { hasVipBoost, hasRadar, hasGoldBadge, buyPerk, placeBet, balance } = useNodbet();
  const [voting, setVoting] = useState(false);
  const [fastBetToast, setFastBetToast] = useState<string | null>(null);

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

  // Consider VIP boost x3 from NODBET if current user voted with VIP status!
  const rawVotesA = votes.filter((v) => v.match_id === match.id && v.team_choice === match.team_a).length;
  const rawVotesB = votes.filter((v) => v.match_id === match.id && v.team_choice === match.team_b).length;
  const votesA = rawVotesA + (myVote?.team_choice === match.team_a && hasVipBoost ? 2 : 0);
  const votesB = rawVotesB + (myVote?.team_choice === match.team_b && hasVipBoost ? 2 : 0);
  const odds = computeOdds(votesA, votesB);
  const votingLocked = match.status === "finished";

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

  function handleQuickNodbet(teamChoice: string, teamName: string) {
    const res = placeBet(match!.id, teamChoice, teamName, 1000);
    if (res.ok) {
      setFastBetToast(`🔥 Экспресс-ставка 1,000 NOD на победу ${teamName} успешно принята! Проверьте вкладку NODBET.`);
      setTimeout(() => setFastBetToast(null), 4000);
    } else {
      setFastBetToast(`❌ ${res.error || "Ошибка ставки"}`);
      setTimeout(() => setFastBetToast(null), 4000);
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

          {(hasVipBoost || hasGoldBadge) && (
            <div className="mb-6 rounded-xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-red-600/10 p-3.5 flex items-center gap-3 text-xs text-yellow-200 shadow-md">
              <span className="text-xl">{hasGoldBadge ? "✨" : "👑"}</span>
              <div>
                <b className="text-yellow-300 block">
                  {hasGoldBadge ? "✨ У вас активен статус «NODBET Pro» и VIP-Бустер!" : "👑 У вас активен VIP-Бустер от NODBET!"}
                </b>
                <span>
                  Ваш голос в прогнозе учитывается с силой х3, оказывая тройное влияние на зрительский расклад{hasGoldBadge ? " и выделяя ваш никнейм золотым знаком!" : "."}
                </span>
              </div>
            </div>
          )}

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
            Всего голосов: {votesA + votesB}. Для защиты от накрутки голосование доступно авторизованным пользователям.
          </p>
        </div>
      )}

      {/* NODBET AI RADAR PERK INTEGRATION */}
      {teamA && teamB && (
        <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-[#151212] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-yellow-500 via-red-600 to-yellow-500" />
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 text-black font-black text-lg">
                ⚡
              </span>
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
                Разблокировать за 1,500 NOD
              </button>
            )}
          </div>

          {!hasRadar ? (
            <div className="rounded-xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur-md">
              <Lock size={28} className="mx-auto text-yellow-400 mb-2" />
              <h4 className="font-display text-base font-bold text-white">Аналитика закрыта защитным экраном NODBET</h4>
              <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                Откройте AI-Радар, чтобы увидеть вероятность победы на основе Elo, историю K/D в очных встречах и секретный прогноз аналитиков турнира!
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl bg-black/40 p-4 border border-white/10 space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-white">{teamA.name} <span className="text-yellow-400 font-mono">61%</span></span>
                  <span className="text-zinc-400">Шансы на победу по версии NODBET AI</span>
                  <span className="text-white"><span className="text-red-400 font-mono">39%</span> {teamB.name}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-red-600/40 overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-500" style={{ width: "61%" }} />
                  <div className="h-full bg-red-600 transition-all duration-500" style={{ width: "39%" }} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                  <span className="text-xs font-bold text-zinc-400 uppercase block mb-1">ФАКТОР КЛАТЧА</span>
                  <p className="text-xs text-zinc-300">
                    Игроки {teamA.name} имеют средний Faceit Elo <b>2,450+</b>. Вероятность успешного клатча 1v2 в этом матче оценивается в <b>74%</b>.
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                  <span className="text-xs font-bold text-yellow-400 uppercase block mb-1">ВЕРДИКТ NODBET</span>
                  <p className="text-xs text-zinc-300">
                    «Рекомендуемая ставка: <b>Победа {teamA.name} (П1)</b> с коэффициентом <b>1.85+</b> или тотал карт в формате {match.format.toUpperCase()}.»
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK NODBET BETTING WIDGET RIGHT ON MATCH DETAIL */}
      {teamA && teamB && match.status !== "finished" && (
        <div className="mt-8 rounded-2xl border border-red-500/40 bg-gradient-to-br from-[#1c0a0a] via-[#120808] to-[#121212] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white font-black text-lg shadow-lg shadow-red-600/30">
                🎰
              </span>
              <div>
                <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest block">
                  NODBET QUICK-BET
                </span>
                <h3 className="font-display text-xl font-bold text-white">Экспресс-ставка на этот матч</h3>
              </div>
            </div>
            <Link
              to="/nodbet"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              В Арену NODBET →
            </Link>
          </div>

          {fastBetToast && (
            <div className="mb-4 rounded-xl border border-yellow-500/40 bg-yellow-950/80 px-4 py-3 text-xs font-bold text-yellow-200 animate-fade-in flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400 shrink-0" />
              <span>{fastBetToast}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleQuickNodbet(teamA.id, teamA.name)}
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4 transition-all hover:border-red-500/60 hover:bg-red-950/30 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <TeamLogo src={teamA.logo_url} alt={teamA.name} size={32} />
                <div className="text-left">
                  <span className="block font-display font-bold text-white group-hover:text-yellow-300 transition-colors">
                    Поставить 1,000 NOD на {teamA.name}
                  </span>
                  <span className="text-[11px] text-zinc-400">Победа П1 в матче</span>
                </div>
              </div>
              <span className="font-mono font-black text-yellow-400 text-lg">1.85</span>
            </button>

            <button
              onClick={() => handleQuickNodbet(teamB.id, teamB.name)}
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4 transition-all hover:border-red-500/60 hover:bg-red-950/30 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <TeamLogo src={teamB.logo_url} alt={teamB.name} size={32} />
                <div className="text-left">
                  <span className="block font-display font-bold text-white group-hover:text-yellow-300 transition-colors">
                    Поставить 1,000 NOD на {teamB.name}
                  </span>
                  <span className="text-[11px] text-zinc-400">Победа П2 в матче</span>
                </div>
              </div>
              <span className="font-mono font-black text-yellow-400 text-lg">2.15</span>
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-500">
            Ваш баланс: <b className="text-yellow-400 font-mono">{balance.toLocaleString()} NOD</b>. Все ставки совершаются на виртуальную валюту спонсора!
          </p>
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
        className="absolute inset-y-0 left-0 bg-gradient-brand/10"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, rgba(124,58,237,0.12), rgba(220,38,38,0.12))" }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TeamLogo src={team.logo_url} alt={team.name} size={40} />
          <div>
            <p className="font-semibold text-white">{team.name}</p>
            <p className="text-xs text-zinc-500">{votes} голосов · {pct}%</p>
          </div>
        </div>
        <span className="font-display text-2xl font-bold text-white">{odds.toFixed(2)}</span>
      </div>
      {selected && <p className="relative mt-3 text-xs font-medium text-fuchsia-400">✓ Ваш голос учтён</p>}
    </button>
  );
}
