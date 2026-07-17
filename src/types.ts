export type MatchFormat = "bo1" | "bo2" | "bo3";
export type MatchStatus = "upcoming" | "live" | "finished";

export interface Team {
  id: string;
  code: string; // A, B, C, D, E, F
  name: string;
  players_label: string; // "rezo1n & dony_zq"
  logo_url: string;
  rating: number; // исходный рейтинг силы
  sort_order: number;
}

export interface Player {
  id: string;
  team_id: string;
  nickname: string;
  kd: number;
  faceit_elo: number;
  rating: number; // итоговый рейтинг игрока для таблицы лидеров
  avatar_url: string;
  role: string; // короткая заметка о сильных сторонах
}

export interface Match {
  id: string;
  stage: 1 | 2 | 3 | 4 | 5;
  match_number: number;
  title: string; // "Матч 1", "Битва лидеров" и т.д.
  format: MatchFormat;
  team_a: string | null; // team id
  team_b: string | null;
  score_a: number;
  score_b: number;
  status: MatchStatus;
  cybershoke_url: string;
  scheduled_at: string; // произвольный текст/дата
  note: string;
}

export interface Vote {
  id: string;
  match_id: string;
  voter_id: string;
  team_choice: string;
  created_at: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export interface Settings {
  hero_title: string;
  hero_subtitle: string;
  announcement: string;
  prize_text: string;
  regulations_url: string;
  server_name: string;
}
