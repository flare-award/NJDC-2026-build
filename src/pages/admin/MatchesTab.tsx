import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { useData } from "../../context/DataContext";
import type { Match, MatchFormat, MatchStatus, MatchMap } from "../../types";
import { inputClass, labelClass, btnPrimary, btnGhost, btnDanger } from "./adminStyles";
import { STAGE_LABELS } from "../../utils/scoring";
import { maxMapCount, normalizeMaps, withRecomputedSeries, mapHadOvertime, mapWinner } from "../../utils/matchMaps";

function emptyMatch(): Match {
  return {
    id: crypto.randomUUID(),
    stage: 1,
    match_number: 1,
    title: "Матч",
    format: "bo1",
    team_a: null,
    team_b: null,
    score_a: 0,
    score_b: 0,
    maps: [{ score_a: 0, score_b: 0 }],
    status: "upcoming",
    cybershoke_url: "",
    scheduled_at: "",
    note: "",
  };
}

const FORMATS: MatchFormat[] = ["bo1", "bo2", "bo3"];
const STATUSES: MatchStatus[] = ["upcoming", "live", "finished"];

export default function MatchesTab() {
  const { teams, matches, upsertMatch, deleteMatch, resetVotes } = useData();
  const [draft, setDraft] = useState<Match | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      // Пересчитываем счёт серии (карт выиграно) из карт — для таблицы/сетки.
      await upsertMatch(withRecomputedSeries(draft));
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  // Открываем матч на редактирование с нормализованными картами.
  function editMatch(m: Match) {
    setDraft({ ...m, maps: normalizeMaps(m) });
  }

  // Меняем формат — подгоняем число карт.
  function changeFormat(format: MatchFormat) {
    if (!draft) return;
    const max = maxMapCount(format);
    const current = normalizeMaps({ ...draft, format });
    const maps: MatchMap[] = [];
    for (let i = 0; i < max; i++) maps.push(current[i] ?? { score_a: 0, score_b: 0 });
    setDraft({ ...draft, format, maps });
  }

  function updateMap(index: number, patch: Partial<MatchMap>) {
    if (!draft) return;
    const maps = normalizeMaps(draft).map((mp, i) => (i === index ? { ...mp, ...patch } : mp));
    setDraft({ ...draft, maps });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">Матчи</h2>
        <button className={btnPrimary} onClick={() => setDraft(emptyMatch())}>
          <span className="flex items-center gap-1.5">
            <Plus size={16} /> Добавить матч
          </span>
        </button>
      </div>

      <div className="space-y-3">
        {matches
          .slice()
          .sort((a, b) => a.stage - b.stage || a.match_number - b.match_number)
          .map((m) => {
            const teamA = teams.find((t) => t.id === m.team_a);
            const teamB = teams.find((t) => t.id === m.team_b);
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="font-semibold text-white">
                    {STAGE_LABELS[m.stage]?.emoji} {m.title} · {m.format.toUpperCase()}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {teamA?.name ?? "TBD"} {m.score_a}:{m.score_b} {teamB?.name ?? "TBD"} · {m.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={btnGhost}
                    onClick={() => {
                      if (confirm("Сбросить голоса зрителей по этому матчу?")) resetVotes(m.id);
                    }}
                    title="Сбросить голоса"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button className={btnGhost} onClick={() => editMatch(m)}>
                    Изменить
                  </button>
                  <button
                    className={btnDanger}
                    onClick={() => {
                      if (confirm(`Удалить матч "${m.title}"?`)) deleteMatch(m.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {draft && (
        <div className="mt-6 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/[0.04] p-5">
          <h3 className="mb-4 font-display font-bold text-white">{matches.some((m) => m.id === draft.id) ? "Редактирование матча" : "Новый матч"}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Этап</label>
              <select
                className={inputClass}
                value={draft.stage}
                onChange={(e) => setDraft({ ...draft, stage: Number(e.target.value) as Match["stage"] })}
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>
                    {s}. {STAGE_LABELS[s].name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>№ матча</label>
              <input
                type="number"
                className={inputClass}
                value={draft.match_number}
                onChange={(e) => setDraft({ ...draft, match_number: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Формат</label>
              <select className={inputClass} value={draft.format} onChange={(e) => changeFormat(e.target.value as MatchFormat)}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Заголовок (Матч 1, Битва лидеров, Гранд-финал...)</label>
              <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Статус</label>
              <select className={inputClass} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as MatchStatus })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Команда A</label>
              <select
                className={inputClass}
                value={draft.team_a ?? ""}
                onChange={(e) => setDraft({ ...draft, team_a: e.target.value || null })}
              >
                <option value="">TBD</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Команда B</label>
              <select
                className={inputClass}
                value={draft.team_b ?? ""}
                onChange={(e) => setDraft({ ...draft, team_b: e.target.value || null })}
              >
                <option value="">TBD</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Счёт по картам (в раундах). Bo1 — 1 карта, Bo2 — 2, Bo3 — до 3. */}
            <div className="sm:col-span-3">
              <label className={labelClass}>
                Счёт по картам (в раундах) — {draft.format.toUpperCase()} ·{" "}
                {maxMapCount(draft.format)} {maxMapCount(draft.format) === 1 ? "карта" : maxMapCount(draft.format) === 2 ? "карты" : "до 3 карт"}
              </label>
              <div className="mt-1 space-y-2">
                {normalizeMaps(draft).map((mp, i) => {
                  const w = mapWinner(mp);
                  const ot = mapHadOvertime(mp);
                  const isBo3Third = draft.format === "bo3" && i === 2;
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <span className="w-16 text-xs font-semibold text-zinc-400">Карта {i + 1}</span>
                      <input
                        type="number"
                        min={0}
                        className={`${inputClass} w-20`}
                        value={mp.score_a}
                        onChange={(e) => updateMap(i, { score_a: Math.max(0, Number(e.target.value)) })}
                        title="Раунды команды A"
                      />
                      <span className="text-zinc-500">:</span>
                      <input
                        type="number"
                        min={0}
                        className={`${inputClass} w-20`}
                        value={mp.score_b}
                        onChange={(e) => updateMap(i, { score_b: Math.max(0, Number(e.target.value)) })}
                        title="Раунды команды B"
                      />
                      <span className="text-[11px] text-zinc-500">
                        {w ? `Победа ${w === "a" ? "A" : "B"}` : "не сыграна"}
                        {ot ? " · ОВЕРТАЙМ" : ""}
                        {isBo3Third ? " · нужна только при счёте 1:1" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Овертайм определяется автоматически: если у команды больше 13 раундов на карте (например 16:14). Счёт серии
                (карт выиграно) для таблицы и сетки считается сам.
              </p>
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Ссылка на матч CYBERSHOKE</label>
              <input
                className={inputClass}
                placeholder="https://cybershoke.net/ru/match/10010699"
                value={draft.cybershoke_url}
                onChange={(e) => setDraft({ ...draft, cybershoke_url: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Дата / время (произвольный текст)</label>
              <input
                className={inputClass}
                placeholder="12 марта, 20:00 МСК"
                value={draft.scheduled_at}
                onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Примечание</label>
              <input className={inputClass} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Очки в турнирной таблице считаются автоматически: Bo1 — 3 очка победителю; Bo2 — 3 очка за 2:0, по 1
            очку за ничью 1:1; Bo3 (этап 5) — очки не начисляются, это стадия плей-офф.
          </p>
          <div className="mt-5 flex gap-3">
            <button className={btnPrimary} disabled={saving} onClick={handleSave}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button className={btnGhost} onClick={() => setDraft(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
