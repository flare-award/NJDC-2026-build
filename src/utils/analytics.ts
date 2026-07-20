import type { Match, Player, Team } from "../types";

export interface TeamStrength {
  team: Team | undefined;
  avgKd: number;
  avgElo: number;
  avgRating: number;
  power: number; // сводная сила команды
}

export interface MatchAnalytics {
  hasData: boolean;
  a: TeamStrength;
  b: TeamStrength;
  pctA: number; // шанс победы команды A, %
  pctB: number; // шанс победы команды B, %
  clutchPct: number; // вероятность успешного клатча 1v2 у фаворита
  favorite: "a" | "b" | "even";
  favoriteName: string;
  recommendedOdds: number;
  verdict: string;
}

/**
 * Считаем силу команды по её игрокам:
 * усредняем Faceit Elo, K/D и рейтинг, приводим к единой шкале «силы».
 */
export function computeTeamStrength(team: Team | undefined, roster: Player[]): TeamStrength {
  if (!roster.length) {
    return { team, avgKd: 0, avgElo: 0, avgRating: 0, power: team?.rating ?? 0 };
  }
  const avgKd = roster.reduce((s, p) => s + (p.kd || 0), 0) / roster.length;
  const avgElo = roster.reduce((s, p) => s + (p.faceit_elo || 0), 0) / roster.length;
  const avgRating = roster.reduce((s, p) => s + (p.rating || 0), 0) / roster.length;

  // Нормализуем каждый показатель и складываем с весами.
  // Elo (обычно 1000–3500), K/D (~0.7–1.6), rating (условный ~50–150).
  const eloScore = avgElo / 100; // 10–35
  const kdScore = avgKd * 25; // ~17–40
  const ratingScore = avgRating / 3; // ~16–50
  const power = eloScore * 0.45 + kdScore * 0.3 + ratingScore * 0.25;

  return { team, avgKd, avgElo, avgRating, power: Math.round(power * 100) / 100 };
}

/**
 * Полный анализ матча: реальные проценты на победу по силе составов
 * (для «Инсайдерского AI-Радара»). Никаких захардкоженных 61/39!
 */
export function computeMatchAnalytics(match: Match, teams: Team[], players: Player[]): MatchAnalytics {
  const teamA = teams.find((t) => t.id === match.team_a);
  const teamB = teams.find((t) => t.id === match.team_b);
  const rosterA = players.filter((p) => p.team_id === match.team_a);
  const rosterB = players.filter((p) => p.team_id === match.team_b);

  const a = computeTeamStrength(teamA, rosterA);
  const b = computeTeamStrength(teamB, rosterB);

  const hasData = a.power > 0 && b.power > 0;

  if (!hasData) {
    return {
      hasData: false,
      a,
      b,
      pctA: 50,
      pctB: 50,
      clutchPct: 50,
      favorite: "even",
      favoriteName: teamA?.name ?? "Команда А",
      recommendedOdds: 1.9,
      verdict: "Недостаточно статистики по составам для точного прогноза.",
    };
  }

  // Логистическая модель: разница сил → вероятность.
  const diff = a.power - b.power;
  const rawA = 1 / (1 + Math.pow(10, -diff / 6));
  let pctA = Math.round(rawA * 100);
  // Не даём вырожденных 0/100 — оставляем интригу.
  pctA = Math.min(88, Math.max(12, pctA));
  const pctB = 100 - pctA;

  const favorite: MatchAnalytics["favorite"] = pctA > pctB ? "a" : pctB > pctA ? "b" : "even";
  const fav = favorite === "b" ? b : a;
  const favName = fav.team?.name ?? (favorite === "b" ? "Команда Б" : "Команда А");
  const favPct = Math.max(pctA, pctB);

  // Вероятность успешного клатча 1v2 у фаворита — из его K/D и Elo.
  const clutchPct = Math.min(
    82,
    Math.max(28, Math.round(fav.avgKd * 32 + (fav.avgElo / 3500) * 30))
  );

  // Рекомендуемый коэффициент — обратная вероятность с маржой.
  const recommendedOdds = Math.round((1 / (favPct / 100)) * 0.92 * 100) / 100;

  const verdict =
    favorite === "even"
      ? `Составы равны по силе — исход открытый. Осторожная ставка на тотал карт в формате ${match.format.toUpperCase()}.`
      : `Рекомендуемая ставка: победа ${favName} (${favorite === "a" ? "П1" : "П2"}) с коэффициентом от ${recommendedOdds.toFixed(
          2
        )}. Средний Faceit Elo фаворита — ${Math.round(fav.avgElo)}, средний K/D — ${fav.avgKd.toFixed(2)}.`;

  return {
    hasData: true,
    a,
    b,
    pctA,
    pctB,
    clutchPct,
    favorite,
    favoriteName: favName,
    recommendedOdds,
    verdict,
  };
}
