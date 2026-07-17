import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { useData } from "../../context/DataContext";
import type { Match, MatchFormat, MatchStatus } from "../../types";
import { inputClass, labelClass, btnPrimary, btnGhost, btnDanger } from "./adminStyles";
import { STAGE_LABELS } from "../../utils/scoring";

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
      await upsertMatch(draft);
      setDraft(null);
    } finally {
      setSaving(false);
    }
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
                  <button className={btnGhost} onClick={() => setDraft(m)}>
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
              <select className={inputClass} value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as MatchFormat })}>
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
            <div>
              <label className={labelClass}>Счёт A (карт/побед)</label>
              <input
                type="number"
                className={inputClass}
                value={draft.score_a}
                onChange={(e) => setDraft({ ...draft, score_a: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Счёт B (карт/побед)</label>
              <input
                type="number"
                className={inputClass}
                value={draft.score_b}
                onChange={(e) => setDraft({ ...draft, score_b: Number(e.target.value) })}
              />
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
