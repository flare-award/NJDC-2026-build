import type { Match, Team } from "../types";

export interface StandingRow extends Team {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  mapsWon: number;
  mapsLost: number;
  stage1Points: number;
  stage2Points: number;
  stage3Points: number;
  stage4Points: number;
}

/** Очки за один законченный матч групповой стадии (этапы 1-4). */
export function pointsForMatch(format: Match["format"], scoreA: number, scoreB: number): [number, number] {
  if (format === "bo1") {
    return scoreA > scoreB ? [3, 0] : [0, 3];
  }
  // bo2
  if (scoreA === scoreB) return [1, 1];
  return scoreA > scoreB ? [3, 0] : [0, 3];
}

export function computeStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const table: Record<string, StandingRow> = {};
  teams.forEach((t) => {
    table[t.id] = {
      ...t,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      mapsWon: 0,
      mapsLost: 0,
      stage1Points: 0,
      stage2Points: 0,
      stage3Points: 0,
      stage4Points: 0,
    };
  });

  matches
    .filter((m) => m.stage >= 1 && m.stage <= 4 && m.status === "finished" && m.team_a && m.team_b)
    .forEach((m) => {
      const a = table[m.team_a as string];
      const b = table[m.team_b as string];
      if (!a || !b) return;
      const [pa, pb] = pointsForMatch(m.format, m.score_a, m.score_b);
      a.played += 1;
      b.played += 1;
      a.mapsWon += m.score_a;
      a.mapsLost += m.score_b;
      b.mapsWon += m.score_b;
      b.mapsLost += m.score_a;
      a.points += pa;
      b.points += pb;
      const stageKey = `stage${m.stage}Points` as "stage1Points" | "stage2Points" | "stage3Points" | "stage4Points";
      a[stageKey] += pa;
      b[stageKey] += pb;
      if (pa === pb) {
        a.draws += 1;
        b.draws += 1;
      } else if (pa > pb) {
        a.wins += 1;
        b.losses += 1;
      } else {
        b.wins += 1;
        a.losses += 1;
      }
    });

  return Object.values(table).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const diffX = x.mapsWon - x.mapsLost;
    const diffY = y.mapsWon - y.mapsLost;
    if (diffY !== diffX) return diffY - diffX;
    return y.rating - x.rating;
  });
}

export const STAGE_LABELS: Record<number, { name: string; format: string; emoji: string; color: string }> = {
  1: { name: "Этап 1 — Квалификация", format: "Bo1", emoji: "🟢", color: "#22c55e" },
  2: { name: "Этап 2 — Швейцарский раунд", format: "Bo1", emoji: "🟡", color: "#eab308" },
  3: { name: "Этап 3 — Регулярный раунд", format: "Bo2", emoji: "🟠", color: "#f97316" },
  4: { name: "Этап 4 — Финальный отбор", format: "Bo2", emoji: "🔴", color: "#ef4444" },
  5: { name: "Этап 5 — Плей-офф", format: "Bo3", emoji: "🔥", color: "#a855f7" },
};
