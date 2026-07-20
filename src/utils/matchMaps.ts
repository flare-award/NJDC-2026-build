import type { Match, MatchFormat, MatchMap } from "../types";

// ============================================================
// Работа с картами матча (Bo1 / Bo2 / Bo3).
//  - Bo1: 1 карта
//  - Bo2: 2 карты (обе играются, возможна ничья 1:1)
//  - Bo3: до 3 карт, но при счёте 2:0 третья не нужна
//
//  К каждой карте теперь можно прикрепить свою ссылку на CYBERSHOKE
//  (для Bo2/Bo3 — отдельная на каждую катку).
// ============================================================

/** Максимальное число карт для формата. */
export function maxMapCount(format: MatchFormat): number {
  if (format === "bo1") return 1;
  if (format === "bo2") return 2;
  return 3; // bo3
}

/** Овертайм на карте = у кого-то больше 13 раундов (16:14, 12:16 и т.п.). */
export function mapHadOvertime(map: MatchMap): boolean {
  return map.score_a > 13 || map.score_b > 13;
}

/** Победитель карты: 'a' | 'b' | null (карта не сыграна / ничья по раундам). */
export function mapWinner(map: MatchMap): "a" | "b" | null {
  if (map.score_a === 0 && map.score_b === 0) return null; // не сыграна
  if (map.score_a > map.score_b) return "a";
  if (map.score_b > map.score_a) return "b";
  return null; // равенство раундов — не считаем победителя карты
}

/** Сыграна ли карта (есть ли счёт). */
export function mapPlayed(map: MatchMap): boolean {
  return map.score_a !== 0 || map.score_b !== 0;
}

/**
 * Нормализуем массив карт матча под его формат.
 * Поддерживает cybershoke_url на каждую катку.
 * Если в maps нет ссылок, пробует взять из cybershoke_url_2/_3 полей матча.
 */
export function normalizeMaps(match: Match): MatchMap[] {
  const max = maxMapCount(match.format);
  const src = Array.isArray(match.maps) ? match.maps.slice(0, max) : [];

  if (src.length === 0 && match.format === "bo1") {
    // Старый bo1: единственная карта = серийный счёт (там он был в раундах).
    return [
      {
        score_a: match.score_a || 0,
        score_b: match.score_b || 0,
        cybershoke_url: (match.cybershoke_url || "").trim() || undefined,
      },
    ];
  }

  const out: MatchMap[] = [];
  for (let i = 0; i < max; i++) {
    const m = src[i] as any;
    // fallback: если в карте нет ссылки, взять из общих полей
    let fallbackUrl: string | undefined;
    if (i === 0) fallbackUrl = (match.cybershoke_url || "").trim() || undefined;
    else if (i === 1) fallbackUrl = (match as any).cybershoke_url_2?.trim() || (match.cybershoke_url || "").trim() || undefined;
    else if (i === 2) fallbackUrl = (match as any).cybershoke_url_3?.trim() || undefined;

    const urlFromMap = m?.cybershoke_url?.trim();
    out.push({
      score_a: m?.score_a ?? 0,
      score_b: m?.score_b ?? 0,
      cybershoke_url: urlFromMap ? urlFromMap : fallbackUrl,
    });
  }
  return out;
}

/**
 * Сколько карт РЕАЛЬНО имеют значение в серии.
 */
export function relevantMapCount(match: Match): number {
  const max = maxMapCount(match.format);
  if (match.format !== "bo3") return max;

  const maps = normalizeMaps(match);
  let a = 0;
  let b = 0;
  for (let i = 0; i < 2; i++) {
    const w = mapWinner(maps[i]);
    if (w === "a") a++;
    else if (w === "b") b++;
  }
  if (a === 2 || b === 2) return 2;
  return 3;
}

/** Счёт серии (карт выиграно). */
export function seriesScore(match: Match): { a: number; b: number } {
  const maps = normalizeMaps(match);
  let a = 0;
  let b = 0;
  const needToWin = match.format === "bo3" ? 2 : maxMapCount(match.format);

  for (const map of maps) {
    if (match.format === "bo3" && (a >= needToWin || b >= needToWin)) break;
    const w = mapWinner(map);
    if (w === "a") a++;
    else if (w === "b") b++;
  }
  return { a, b };
}

/** Пересчитываем серийный счёт из карт. */
export function withRecomputedSeries(match: Match): Match {
  const maps = normalizeMaps(match);
  const { a, b } = seriesScore({ ...match, maps });
  return { ...match, maps, score_a: a, score_b: b };
}

/** Победитель всей серии по картам: team id или "draw". */
export function seriesWinnerTeamId(match: Match): string | "draw" {
  const { a, b } = seriesScore(match);
  if (a > b) return match.team_a ?? "draw";
  if (b > a) return match.team_b ?? "draw";
  return "draw";
}

export function mapLabel(index: number): string {
  return `Карта ${index + 1}`;
}
