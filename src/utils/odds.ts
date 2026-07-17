export interface OddsResult {
  oddsA: number;
  oddsB: number;
  pctA: number;
  pctB: number;
  total: number;
}

/**
 * Простая букмекерская модель на основе распределения голосов.
 * Если голосов нет — возвращаем стартовый коэффициент 1.91/1.91.
 */
export function computeOdds(votesA: number, votesB: number): OddsResult {
  const total = votesA + votesB;
  if (total === 0) {
    return { oddsA: 1.91, oddsB: 1.91, pctA: 50, pctB: 50, total: 0 };
  }
  const margin = 0.92;
  const pctA = votesA / total;
  const pctB = votesB / total;
  const clamp = (n: number) => Math.min(15, Math.max(1.01, n));
  const oddsA = pctA > 0 ? clamp((1 / pctA) * margin) : 15;
  const oddsB = pctB > 0 ? clamp((1 / pctB) * margin) : 15;
  return {
    oddsA: Math.round(oddsA * 100) / 100,
    oddsB: Math.round(oddsB * 100) / 100,
    pctA: Math.round(pctA * 100),
    pctB: Math.round(pctB * 100),
    total,
  };
}

export function getVoterId(): string {
  const key = "njdc_voter_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
