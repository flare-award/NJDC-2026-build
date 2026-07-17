import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "../../context/DataContext";
import type { Player } from "../../types";
import { inputClass, labelClass, btnPrimary, btnGhost, btnDanger } from "./adminStyles";

function emptyPlayer(teamId: string): Player {
  return {
    id: crypto.randomUUID(),
    team_id: teamId,
    nickname: "",
    kd: 1,
    faceit_elo: 1000,
    rating: 100,
    avatar_url: "",
    role: "",
  };
}

export default function PlayersTab() {
  const { teams, players, upsertPlayer, deletePlayer } = useData();
  const [draft, setDraft] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await upsertPlayer(draft);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">Игроки</h2>
        <button className={btnPrimary} onClick={() => setDraft(emptyPlayer(teams[0]?.id ?? ""))} disabled={teams.length === 0}>
          <span className="flex items-center gap-1.5">
            <Plus size={16} /> Добавить игрока
          </span>
        </button>
      </div>

      <div className="space-y-3">
        {teams.map((team) => {
          const roster = players.filter((p) => p.team_id === team.id);
          if (roster.length === 0) return null;
          return (
            <div key={team.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{team.name}</p>
              {roster.map((p) => (
                <div key={p.id} className="mb-2 flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">{p.nickname}</p>
                    <p className="text-xs text-zinc-500">
                      K/D {p.kd} · Elo {p.faceit_elo} · Рейтинг {p.rating}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={btnGhost} onClick={() => setDraft(p)}>
                      Изменить
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => {
                        if (confirm(`Удалить игрока ${p.nickname}?`)) deletePlayer(p.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {draft && (
        <div className="mt-6 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/[0.04] p-5">
          <h3 className="mb-4 font-display font-bold text-white">
            {players.some((p) => p.id === draft.id) ? "Редактирование игрока" : "Новый игрок"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Никнейм</label>
              <input className={inputClass} value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Команда</label>
              <select
                className={inputClass}
                value={draft.team_id}
                onChange={(e) => setDraft({ ...draft, team_id: e.target.value })}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>K/D</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={draft.kd}
                onChange={(e) => setDraft({ ...draft, kd: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Faceit Elo</label>
              <input
                type="number"
                className={inputClass}
                value={draft.faceit_elo}
                onChange={(e) => setDraft({ ...draft, faceit_elo: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Итоговый рейтинг (для таблицы лидеров)</label>
              <input
                type="number"
                className={inputClass}
                value={draft.rating}
                onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Заметка (сильные/слабые стороны)</label>
              <input className={inputClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            </div>
          </div>
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
