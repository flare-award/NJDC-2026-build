import type { Match, MatchFormat, MatchMap } from "../types";

// ============================================================
// Работа с картами матча (Bo1 / Bo2 / Bo3).
//  - Bo1: 1 карта
//  - Bo2: 2 карты (обе играются, возможна ничья 1:1)
//  - Bo3: до 3 карт, но при счёте 2:0 третья не нужна
//
//  К каждой карте теперь можно прикрепить свою ссылку на CYBERSHOKE
//  (для Bo2/Bo3 — отдельная на каждую катку).
//
//  ПРАВИЛА CS2 (MR12 + овертаймы MR3 «до 4 побед в блоке»):
//    Регулярка: первая команда, набравшая 13 раундов, побеждает,
//    НО только если у соперника ≤ 11. Счёт 12:12 = ничья по
//    регулярке → начинается овертайм.
//    Овертайм №n (n≥1): играется блок, цель — набрать 13+3n
//    раундов (1-й ОТ — до 16, 2-й — до 19, 3-й — до 22 …).
//    Проигравший в ОТ набирает от (цель−4) до (цель−2).
//    Равенство в блоке (15:15, 18:18, 21:21 …) = следующий ОТ.
//
//  Примеры ФИНАЛЬНЫХ счётов:
//    13:11, 11:13  — регулярка (без ОТ)
//    12:16, 16:14  — 1-й овертайм
//    19:17, 15:19  — 2-й овертайм
//    22:20, 18:22  — 3-й овертайм
//    12:12, 15:15, 18:18 — игра ещё идёт (начался следующий ОТ)
//    6:8, 12:11    — игра ещё идёт (регулярка)
// ============================================================

/** Максимальное число карт для формата. */
export function maxMapCount(format: MatchFormat): number {
  if (format === "bo1") return 1;
  if (format === "bo2") return 2;
  return 3; // bo3
}

interface MapAnalysis {
  /** Введён ли хоть какой-то счёт (раунд > 0). */
  started: boolean;
  /** Достигнут ли корректный ФИНАЛЬНЫЙ счёт по правилам CS2. */
  finished: boolean;
  /** Номер овертайма, если карта дошла до ОТ (1, 2, 3 …), иначе 0. */
  overtimeNumber: number;
  /** Победитель карты: 'a' | 'b' | null. null, если карта не завершена. */
  winner: "a" | "b" | null;
}

/**
 * Полный анализ счёта одной карты по правилам CS2 MR12 + MR3.
 */
export function analyzeMap(map: MatchMap): MapAnalysis {
  const a = Math.max(0, Math.floor(map.score_a || 0));
  const b = Math.max(0, Math.floor(map.score_b || 0));

  if (a === 0 && b === 0) {
    return { started: false, finished: false, overtimeNumber: 0, winner: null };
  }

  const hi = Math.max(a, b);
  const lo = Math.min(a, b);

  // Регулярка: победил тот, кто первый взял 13, и у соперника ≤ 11.
  if (hi === 13 && lo <= 11) {
    return { started: true, finished: true, overtimeNumber: 0, winner: a > b ? "a" : "b" };
  }

  // Овертаймы: hi должно быть 16, 19, 22 … (то есть 13 + 3n, n≥1),
  // а отрыв победителя — 2, 3 или 4 раунда (lo ∈ [hi−4, hi−2]).
  if (hi >= 16 && (hi - 13) % 3 === 0) {
    const n = (hi - 13) / 3; // номер овертайма
    if (lo >= hi - 4 && lo <= hi - 2) {
      return { started: true, finished: true, overtimeNumber: n, winner: a > b ? "a" : "b" };
    }
  }

  // Любой другой счёт — карта ещё не доиграна (идёт регулярка или овертайм).
  return { started: true, finished: false, overtimeNumber: 0, winner: null };
}

/** Была ли карта начата (есть хоть один раунд). */
export function mapStarted(map: MatchMap): boolean {
  return analyzeMap(map).started;
}

/**
 * Сыграна ли карта ДО КОНЦА (корректный финальный счёт по правилам CS2).
 * ВНИМАНИЕ: это НЕ «введён ли счёт» — счёт 6:8 НЕ считается сыгранным.
 */
export function mapPlayed(map: MatchMap): boolean {
  return analyzeMap(map).finished;
}

/** Алиас mapPlayed — карта завершена по правилам. */
export function mapFinished(map: MatchMap): boolean {
  return analyzeMap(map).finished;
}

/**
 * Был ли овертайм на карте (используется для ставок и бейджа).
 *
 * Овертайм засчитывается ТОЛЬКО если счёт БОЛЬШЕ 12:12 — то есть обе
 * команды дошли до 12 раундов (регулярка завершилась вничью 12:12)
 * и игра ушла дальше (хотя бы у одной команды 13+).
 *
 *   • 12:12 и меньше (12:11, 11:13, 13:11, 6:8 …) → овертайма НЕТ.
 *   • Больше 12:12 (13:12, 14:13, 16:14, 19:17 …) → овертайм ЕСТЬ.
 *
 * Регулярная победа 13:x (x ≤ 11) НЕ считается овертаймом: у проигравшего
 * меньше 12 раундов, то есть до 12:12 дело не дошло. Это работает и для
 * завершённых, и для идущих карт.
 */
export function mapHadOvertime(map: MatchMap): boolean {
  const a = Math.max(0, Math.floor(map.score_a || 0));
  const b = Math.max(0, Math.floor(map.score_b || 0));
  // Овертайм = обе команды взяли ≥ 12 раундов И счёт ушёл дальше ровно 12:12.
  return Math.min(a, b) >= 12 && Math.max(a, b) > 12;
}

/** Номер овертайма (0 = регулярка/не завершено). */
export function mapOvertimeNumber(map: MatchMap): number {
  return analyzeMap(map).overtimeNumber;
}

/** Победитель карты: 'a' | 'b' | null (карта не завершена). */
export function mapWinner(map: MatchMap): "a" | "b" | null {
  return analyzeMap(map).winner;
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

/** Счёт серии (карт выиграно). Считаем только ЗАВЕРШЁННЫЕ карты. */
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
