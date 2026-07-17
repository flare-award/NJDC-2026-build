import type { Team, Player, Match, FaqItem, Settings } from "../types";

export const seedTeams: Team[] = [
  {
    id: "team-a",
    code: "A",
    name: "Команда А",
    players_label: "rezo1n & dony_zq",
    logo_url: "/logos/team-a.png",
    rating: 130,
    sort_order: 1,
  },
  {
    id: "team-b",
    code: "B",
    name: "Команда Б",
    players_label: "thesameone & balabol",
    logo_url: "/logos/team-b.png",
    rating: 125,
    sort_order: 2,
  },
  {
    id: "team-c",
    code: "C",
    name: "Команда В",
    players_label: "akirakume & Izumrudik",
    logo_url: "/logos/team-c.png",
    rating: 104,
    sort_order: 3,
  },
  {
    id: "team-d",
    code: "D",
    name: "Команда Г",
    players_label: "awal & Cloury",
    logo_url: "/logos/team-d.png",
    rating: 114,
    sort_order: 4,
  },
  {
    id: "team-e",
    code: "E",
    name: "Команда Д",
    players_label: "Eozik & qusti",
    logo_url: "/logos/team-e.png",
    rating: 88,
    sort_order: 5,
  },
  {
    id: "team-f",
    code: "F",
    name: "Команда Е",
    players_label: "Nodben & Flourin",
    logo_url: "/logos/team-f.png",
    rating: 88,
    sort_order: 6,
  },
];

export const seedPlayers: Player[] = [
  { id: "p1", team_id: "team-a", nickname: "rezo1n", kd: 1.42, faceit_elo: 2450, rating: 138, avatar_url: "", role: "Лидер, входит с равного" },
  { id: "p2", team_id: "team-a", nickname: "dony_zq", kd: 1.25, faceit_elo: 2100, rating: 122, avatar_url: "", role: "Стабильный саппорт" },
  { id: "p3", team_id: "team-b", nickname: "thesameone", kd: 1.30, faceit_elo: 2200, rating: 128, avatar_url: "", role: "AWP, агрессивный стиль" },
  { id: "p4", team_id: "team-b", nickname: "balabol", kd: 1.18, faceit_elo: 1950, rating: 122, avatar_url: "", role: "Универсальный игрок" },
  { id: "p5", team_id: "team-c", nickname: "akirakume", kd: 1.05, faceit_elo: 1700, rating: 108, avatar_url: "", role: "Тактик, ротации" },
  { id: "p6", team_id: "team-c", nickname: "Izumrudik", kd: 0.98, faceit_elo: 1600, rating: 100, avatar_url: "", role: "Клатч-потенциал" },
  { id: "p7", team_id: "team-d", nickname: "awal", kd: 1.15, faceit_elo: 1850, rating: 118, avatar_url: "", role: "Опорный игрок" },
  { id: "p8", team_id: "team-d", nickname: "Cloury", kd: 1.02, faceit_elo: 1700, rating: 110, avatar_url: "", role: "Внимательный саппорт" },
  { id: "p9", team_id: "team-e", nickname: "Eozik", kd: 0.85, faceit_elo: 1400, rating: 90, avatar_url: "", role: "Развивается быстро" },
  { id: "p10", team_id: "team-e", nickname: "qusti", kd: 0.80, faceit_elo: 1350, rating: 86, avatar_url: "", role: "Стабильность на входах" },
  { id: "p11", team_id: "team-f", nickname: "Nodben", kd: 0.88, faceit_elo: 1450, rating: 92, avatar_url: "", role: "Организатор, хост сервера" },
  { id: "p12", team_id: "team-f", nickname: "Flourin", kd: 0.79, faceit_elo: 1300, rating: 84, avatar_url: "", role: "Осторожная игра" },
];

export const seedMatches: Match[] = [
  {
    id: "m1",
    stage: 1,
    match_number: 1,
    title: "Матч 1",
    format: "bo1",
    team_a: "team-a",
    team_b: "team-b",
    score_a: 0,
    score_b: 0,
    status: "upcoming",
    cybershoke_url: "",
    scheduled_at: "",
    note: "Жеребьёвка — Этап 1",
  },
  {
    id: "m2",
    stage: 1,
    match_number: 2,
    title: "Матч 2",
    format: "bo1",
    team_a: "team-c",
    team_b: "team-d",
    score_a: 0,
    score_b: 0,
    status: "upcoming",
    cybershoke_url: "",
    scheduled_at: "",
    note: "Жеребьёвка — Этап 1",
  },
  {
    id: "m3",
    stage: 1,
    match_number: 3,
    title: "Матч 3",
    format: "bo1",
    team_a: "team-e",
    team_b: "team-f",
    score_a: 0,
    score_b: 0,
    status: "upcoming",
    cybershoke_url: "",
    scheduled_at: "",
    note: "Жеребьёвка — Этап 1",
  },
];

export const seedFaq: FaqItem[] = [
  {
    id: "f1",
    question: "Что такое NJDC 2026?",
    answer:
      "NJDC 2026 (Nodben Joski Duo Cup) — турнир 2 на 2 по Counter-Strike 2 на платформе CYBERSHOKE, который проводится на сервере «Нодбин Жоски». В турнире участвуют 6 команд по 2 игрока.",
    sort_order: 1,
  },
  {
    id: "f2",
    question: "Как формировались составы и рейтинг силы команд?",
    answer:
      "Рейтинг силы построен не на ощущениях, а на комбинации факторов: реальный K/D за 10+ матчей на сервере, Faceit Elo и статистика CYBERSHOKE, проверенные субъективные данные о сильных и слабых сторонах игроков, а также личные ограничения отдельных игроков. Итоговый вариант неоднократно пересматривался организаторами.",
    sort_order: 2,
  },
  {
    id: "f3",
    question: "Какой формат турнира?",
    answer:
      "5 этапов: Этап 1 (Bo1, случайная жеребьёвка), Этап 2 (Bo1, швейцарская система), Этап 3 и 4 (Bo2, пары по соседству в таблице), Этап 5 — плей-офф Bo3 (матч за 5-е место, матч за 3-е место и Гранд-финал).",
    sort_order: 3,
  },
  {
    id: "f4",
    question: "Как начисляются очки?",
    answer:
      "В форматах Bo1 победитель получает 3 очка, проигравший — 0. В форматах Bo2 победа 2:0 приносит 3 очка, поражение — 0, а ничья 1:1 приносит по 1 очку каждой команде. На этапе плей-офф (Bo3) очки не начисляются — играют до двух побед на выбывание.",
    sort_order: 4,
  },
  {
    id: "f5",
    question: "Какой призовой фонд?",
    answer:
      "Команда, занявшая 1-е место, получает Lite подписку CYBERSHOKE для двух игроков состава и памятный диплом победителя турнира.",
    sort_order: 5,
  },
  {
    id: "f6",
    question: "Где смотреть демки и статистику матчей?",
    answer:
      "У каждого матча указана прямая ссылка на страницу матча CYBERSHOKE — там можно посмотреть статистику и скачать демо-запись после завершения игры.",
    sort_order: 6,
  },
  {
    id: "f7",
    question: "Где посмотреть правила турнира?",
    answer:
      "Полный регламент турнира доступен в PDF-файле внизу страницы, в разделе «Регламент».",
    sort_order: 7,
  },
];

export const seedSettings: Settings = {
  hero_title: "NJDC 2026",
  hero_subtitle: "Nodben Joski Duo Cup — турнир 2×2 по Counter-Strike 2",
  announcement: "Регистрация завершена. Жеребьёвка Этапа 1 проведена — впереди 5 этапов борьбы!",
  prize_text: "Lite подписка CYBERSHOKE для двух игроков команды-чемпиона + официальный диплом победителя турнира.",
  regulations_url: "/NJDC 2026 regulations.pdf",
  server_name: "Нодбин Жоски",
};
