// ==========================================================
// НИКНЕЙМЫ ПОЛЬЗОВАТЕЛЕЙ (профиль / Топ Хайроллеров NODBET)
//
// Правила никнейма:
//  - русские и латинские буквы, цифры
//  - из спецсимволов разрешены только «-», «_» и «+»
//  - пробелы запрещены
//  - длина от 2 до 24 символов
//
// Если пользователь ещё не выбрал никнейм — ему временно
// присваивается случайный «фруктовый» ник (детерминированно
// от id пользователя, чтобы он не менялся при каждом заходе).
// ==========================================================

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 24;

// Латиница, кириллица, цифры и символы - _ +
export const NICKNAME_REGEX = /^[A-Za-zА-Яа-яЁё0-9_+-]+$/u;

export interface NicknameValidation {
  ok: boolean;
  error?: string;
  clean?: string;
}

export function validateNickname(raw: string): NicknameValidation {
  const clean = raw.trim();

  if (!clean) {
    return { ok: false, error: "Введите никнейм" };
  }
  if (/\s/.test(clean)) {
    return { ok: false, error: "Пробелы в никнейме запрещены 🚫" };
  }
  if (clean.length < NICKNAME_MIN_LENGTH || clean.length > NICKNAME_MAX_LENGTH) {
    return { ok: false, error: `Никнейм должен быть от ${NICKNAME_MIN_LENGTH} до ${NICKNAME_MAX_LENGTH} символов` };
  }
  if (!NICKNAME_REGEX.test(clean)) {
    return {
      ok: false,
      error: "Можно использовать только русские и латинские буквы, цифры и символы «-», «_», «+»",
    };
  }
  return { ok: true, clean };
}

// ---------- Фруктовые ники-заглушки ----------

const FRUITS = [
  "Апельсин",
  "Яблоко",
  "Банан",
  "Груша",
  "Арбуз",
  "Дыня",
  "Виноград",
  "Киви",
  "Персик",
  "Манго",
  "Ананас",
  "Вишня",
  "Клубника",
  "Малина",
  "Черешня",
  "Абрикос",
  "Слива",
  "Лимон",
  "Гранат",
  "Мандарин",
  "Нектарин",
  "Хурма",
  "Грейпфрут",
  "Инжир",
  "Кокос",
  "Лайм",
  "Ежевика",
  "Смородина",
  "Голубика",
  "Айва",
  "Фейхоа",
  "Личи",
  "Папайя",
  "Маракуйя",
  "Карамбола",
  "Кумкват",
];

/**
 * Временный ник для пользователя без своего никнейма.
 * Одинаковый userId всегда даёт одинаковый фрукт (djb2-хэш),
 * поэтому ник «не прыгает» между сессиями.
 */
export function fruitNickname(userId: string): string {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) >>> 0;
  }
  const fruit = FRUITS[hash % FRUITS.length];
  const suffix = hash.toString(16).slice(0, 4);
  return `${fruit}_${suffix}`;
}
