-- =========================================================
-- NJDC 2026 (Nodben Joski Duo Cup) — схема базы данных Supabase
-- Выполните этот файл целиком в Supabase → SQL Editor
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- TEAMS ----------
create table if not exists teams (
  id text primary key,
  code text not null,
  name text not null,
  players_label text not null default '',
  logo_url text not null default '',
  rating int not null default 100,
  sort_order int not null default 99
);

-- ---------- PLAYERS ----------
create table if not exists players (
  id text primary key,
  team_id text references teams(id) on delete cascade,
  nickname text not null,
  kd numeric not null default 1,
  faceit_elo int not null default 1000,
  rating numeric not null default 100,
  avatar_url text not null default '',
  role text not null default ''
);

-- ---------- MATCHES ----------
create table if not exists matches (
  id text primary key,
  stage int not null,
  match_number int not null default 1,
  title text not null default '',
  format text not null default 'bo1',
  team_a text references teams(id) on delete set null,
  team_b text references teams(id) on delete set null,
  score_a int not null default 0,
  score_b int not null default 0,
  status text not null default 'upcoming',
  cybershoke_url text not null default '',
  scheduled_at text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- VOTES (голосование / прогнозы зрителей) ----------
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  match_id text references matches(id) on delete cascade,
  voter_id text not null,
  team_choice text references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, voter_id)
);

-- ---------- FAQ ----------
create table if not exists faq (
  id text primary key,
  question text not null,
  answer text not null,
  sort_order int not null default 0
);

-- ---------- SETTINGS (одна строка с id = 'main') ----------
create table if not exists settings (
  id text primary key default 'main',
  hero_title text not null default 'NJDC 2026',
  hero_subtitle text not null default '',
  announcement text not null default '',
  prize_text text not null default '',
  regulations_url text not null default '/NJDC 2026 regulations.pdf',
  server_name text not null default 'Нодбин Жоски'
);

-- =========================================================
-- ROW LEVEL SECURITY
-- Публичное чтение разрешено всем (anon).
-- Запись (insert/update/delete) разрешена только авторизованным
-- пользователям Supabase Auth (то есть только вам как админу).
-- Исключение: таблица votes — публика может голосовать (insert),
-- но не может редактировать/удалять чужие голоса.
-- =========================================================

alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table votes enable row level security;
alter table faq enable row level security;
alter table settings enable row level security;

-- Публичное чтение
create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read votes" on votes for select using (true);
create policy "public read faq" on faq for select using (true);
create policy "public read settings" on settings for select using (true);

-- Запись только для авторизованных (админ)
create policy "admin write teams" on teams for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write players" on players for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write matches" on matches for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write faq" on faq for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write settings" on settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Голоса: любой посетитель может проголосовать (insert), но
-- изменять/удалять чужие голоса могут только авторизованные (админ, сброс)
create policy "public insert votes" on votes for insert with check (true);
create policy "admin manage votes" on votes for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete votes" on votes for delete
  using (auth.role() = 'authenticated');

-- =========================================================
-- REALTIME — включаем для всех таблиц, чтобы сайт получал
-- обновления мгновенно без перезагрузки страницы.
-- Без этого блока Supabase не будет отправлять события
-- postgres_changes подписчикам.
-- =========================================================

-- Создаём publication для realtime (если ещё не создана)
create publication if not exists supabase_realtime;

-- Добавляем таблицы в publication
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table faq;
alter publication supabase_realtime add table settings;

-- =========================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ (аналог seed.ts на сайте)
-- =========================================================

insert into teams (id, code, name, players_label, logo_url, rating, sort_order) values
  ('team-a', 'A', 'Команда А', 'rezo1n & dony_zq', '/logos/team-a.png', 130, 1),
  ('team-b', 'B', 'Команда Б', 'thesameone & balabol', '/logos/team-b.png', 125, 2),
  ('team-c', 'C', 'Команда В', 'akirakume & Izumrudik', '/logos/team-c.png', 104, 3),
  ('team-d', 'D', 'Команда Г', 'awal & Cloury', '/logos/team-d.png', 114, 4),
  ('team-e', 'E', 'Команда Д', 'Eozik & qusti', '/logos/team-e.png', 88, 5),
  ('team-f', 'F', 'Команда Е', 'Nodben & Flourin', '/logos/team-f.png', 88, 6)
on conflict (id) do nothing;

insert into players (id, team_id, nickname, kd, faceit_elo, rating, role) values
  ('p1', 'team-a', 'rezo1n', 1.42, 2450, 138, 'Лидер, входит с равного'),
  ('p2', 'team-a', 'dony_zq', 1.25, 2100, 122, 'Стабильный саппорт'),
  ('p3', 'team-b', 'thesameone', 1.30, 2200, 128, 'AWP, агрессивный стиль'),
  ('p4', 'team-b', 'balabol', 1.18, 1950, 122, 'Универсальный игрок'),
  ('p5', 'team-c', 'akirakume', 1.05, 1700, 108, 'Тактик, ротации'),
  ('p6', 'team-c', 'Izumrudik', 0.98, 1600, 100, 'Клатч-потенциал'),
  ('p7', 'team-d', 'awal', 1.15, 1850, 118, 'Опорный игрок'),
  ('p8', 'team-d', 'Cloury', 1.02, 1700, 110, 'Внимательный саппорт'),
  ('p9', 'team-e', 'Eozik', 0.85, 1400, 90, 'Развивается быстро'),
  ('p10', 'team-e', 'qusti', 0.80, 1350, 86, 'Стабильность на входах'),
  ('p11', 'team-f', 'Nodben', 0.88, 1450, 92, 'Организатор, хост сервера'),
  ('p12', 'team-f', 'Flourin', 0.79, 1300, 84, 'Осторожная игра')
on conflict (id) do nothing;

insert into matches (id, stage, match_number, title, format, team_a, team_b, status, note) values
  ('m1', 1, 1, 'Матч 1', 'bo1', 'team-a', 'team-b', 'upcoming', 'Жеребьёвка — Этап 1'),
  ('m2', 1, 2, 'Матч 2', 'bo1', 'team-c', 'team-d', 'upcoming', 'Жеребьёвка — Этап 1'),
  ('m3', 1, 3, 'Матч 3', 'bo1', 'team-e', 'team-f', 'upcoming', 'Жеребьёвка — Этап 1')
on conflict (id) do nothing;

insert into faq (id, question, answer, sort_order) values
  ('f1', 'Что такое NJDC 2026?', 'NJDC 2026 (Nodben Joski Duo Cup) — турнир 2 на 2 по Counter-Strike 2 на платформе CYBERSHOKE, который проводится на сервере «Нодбин Жоски». В турнире участвуют 6 команд по 2 игрока.', 1),
  ('f2', 'Как формировались составы и рейтинг силы команд?', 'Рейтинг силы построен на комбинации факторов: реальный K/D за 10+ матчей на сервере, Faceit Elo и статистика CYBERSHOKE, проверенные данные о сильных и слабых сторонах игроков, а также личные ограничения отдельных игроков.', 2),
  ('f3', 'Какой формат турнира?', '5 этапов: Этап 1 (Bo1, жеребьёвка), Этап 2 (Bo1, швейцарская система), Этап 3 и 4 (Bo2, пары по соседству в таблице), Этап 5 — плей-офф Bo3.', 3),
  ('f4', 'Как начисляются очки?', 'Bo1: победитель получает 3 очка, проигравший — 0. Bo2: победа 2:0 — 3 очка, ничья 1:1 — по 1 очку каждой команде. В плей-офф (Bo3) очки не начисляются.', 4),
  ('f5', 'Какой призовой фонд?', 'Команда, занявшая 1-е место, получает Lite подписку CYBERSHOKE для двух игроков состава и памятный диплом победителя турнира.', 5),
  ('f6', 'Где смотреть демки и статистику матчей?', 'У каждого матча указана ссылка на страницу матча CYBERSHOKE — там можно посмотреть статистику и скачать демо-запись после игры.', 6),
  ('f7', 'Где посмотреть правила турнира?', 'Полный регламент турнира доступен в PDF-файле внизу страницы, в разделе «Регламент».', 7)
on conflict (id) do nothing;

insert into settings (id, hero_title, hero_subtitle, announcement, prize_text, regulations_url, server_name) values
  ('main', 'NJDC 2026', 'Nodben Joski Duo Cup — турнир 2×2 по Counter-Strike 2',
   'Регистрация завершена. Жеребьёвка Этапа 1 проведена — впереди 5 этапов борьбы!',
   'Lite подписка CYBERSHOKE для двух игроков команды-чемпиона + официальный диплом победителя турнира.',
   '/NJDC 2026 regulations.pdf', 'Нодбин Жоски')
on conflict (id) do nothing;
