// ============================================================
// Система уровней NODBET (пункт 23)
// Уровни считаются из накопленного XP. Все начинают с 0 уровня,
// максимум — 1000 уровень. После 100–500 уровня качать становится
// заметно тяжелее (кривая ускоряется).
// ============================================================

export const MAX_LEVEL = 1000;

/**
 * Сколько XP нужно суммарно, чтобы иметь ровно `level`.
 * Кусочно-нарастающая стоимость уровня:
 *   0–100:    дёшево  (базовый рост)
 *   100–500:  дороже  (замедление)
 *   500–1000: очень дорого (хардкор)
 * Формула монотонно возрастает, поэтому обратный перевод XP→level корректен.
 */
export function totalXpForLevel(level: number): number {
  const lvl = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
  let xp = 0;
  for (let i = 1; i <= lvl; i++) {
    xp += xpCostOfLevel(i);
  }
  return xp;
}

/** Стоимость (в XP) перехода с уровня i-1 на уровень i. */
export function xpCostOfLevel(i: number): number {
  if (i <= 0) return 0;
  if (i <= 100) {
    // Дёшево: 100..~2100 XP за уровень
    return 100 + (i - 1) * 20;
  }
  if (i <= 500) {
    // Средне: заметно дороже
    return 2100 + (i - 100) * 120;
  }
  // Хардкор: 500..1000 — стоимость растёт квадратично
  const d = i - 500;
  return 50100 + d * 800 + d * d * 4;
}

/** Уровень по суммарному XP (обратный перевод, пункт 23). */
export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  let level = 0;
  let acc = 0;
  while (level < MAX_LEVEL) {
    const next = xpCostOfLevel(level + 1);
    if (acc + next > safeXp) break;
    acc += next;
    level += 1;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number; // сколько XP набрано внутри текущего уровня
  xpForNext: number; // сколько XP нужно на следующий уровень
  pct: number; // прогресс до следующего уровня, %
  isMax: boolean;
}

/** Полный прогресс уровня для шкалы XP рядом с балансом. */
export function levelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const level = levelFromXp(safeXp);
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, xpIntoLevel: 0, xpForNext: 0, pct: 100, isMax: true };
  }
  const base = totalXpForLevel(level);
  const xpForNext = xpCostOfLevel(level + 1);
  const xpIntoLevel = safeXp - base;
  const pct = xpForNext > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)) : 0;
  return { level, xpIntoLevel, xpForNext, pct, isMax: false };
}

/** Короткий титул по уровню (для чипа в шапке). */
export function levelTitleFor(level: number): string {
  if (level >= 900) return "👑 Легенда NODBET";
  if (level >= 700) return "💎 Грандмастер";
  if (level >= 500) return "🔥 Кибер-Хайроллер";
  if (level >= 300) return "⚡ Мастер Прогнозов";
  if (level >= 150) return "🎯 Азартный Фрагер";
  if (level >= 50) return "🎲 Игрок NODBET";
  return "🐣 Новичок NODBET";
}
