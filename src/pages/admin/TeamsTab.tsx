import { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { useData } from "../../context/DataContext";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { Team } from "../../types";
import TeamLogo from "../../components/TeamLogo";
import { inputClass, labelClass, btnPrimary, btnGhost, btnDanger } from "./adminStyles";

function emptyTeam(): Team {
  return {
    id: crypto.randomUUID(),
    code: "",
    name: "",
    players_label: "",
    logo_url: "",
    rating: 100,
    sort_order: 99,
  };
}

export default function TeamsTab() {
  const { teams, upsertTeam, deleteTeam } = useData();
  const [draft, setDraft] = useState<Team | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload(file: File) {
    if (!supabase) return;
    setUploading(true);
    try {
      const path = `teams/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setDraft((d) => (d ? { ...d, logo_url: data.publicUrl } : d));
    } catch (e) {
      alert("Не удалось загрузить файл. Проверьте bucket 'logos' в Supabase Storage.");
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await upsertTeam(draft);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">Команды</h2>
        <button className={btnPrimary} onClick={() => setDraft(emptyTeam())}>
          <span className="flex items-center gap-1.5">
            <Plus size={16} /> Добавить команду
          </span>
        </button>
      </div>

      <div className="space-y-3">
        {teams
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-3">
                <TeamLogo src={t.logo_url} alt={t.name} size={40} />
                <div>
                  <p className="font-semibold text-white">
                    {t.code} · {t.name}
                  </p>
                  <p className="text-xs text-zinc-500">{t.players_label} · рейтинг {t.rating}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className={btnGhost} onClick={() => setDraft(t)}>
                  Изменить
                </button>
                <button
                  className={btnDanger}
                  onClick={() => {
                    if (confirm(`Удалить команду ${t.name}?`)) deleteTeam(t.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
      </div>

      {draft && (
        <div className="mt-6 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/[0.04] p-5">
          <h3 className="mb-4 font-display font-bold text-white">{teams.some((t) => t.id === draft.id) ? "Редактирование команды" : "Новая команда"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Буква/код (A, B, C...)</label>
              <input className={inputClass} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Название команды</label>
              <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Игроки (например: rezo1n & dony_zq)</label>
              <input
                className={inputClass}
                value={draft.players_label}
                onChange={(e) => setDraft({ ...draft, players_label: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Рейтинг силы</label>
              <input
                type="number"
                className={inputClass}
                value={draft.rating}
                onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Порядок сортировки</label>
              <input
                type="number"
                className={inputClass}
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Логотип (URL, желательно на прозрачном/тёмном фоне)</label>
              <div className="flex items-center gap-3">
                <input className={inputClass} value={draft.logo_url} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} />
                {isSupabaseConfigured && (
                  <label className={`${btnGhost} flex cursor-pointer items-center gap-1.5 whitespace-nowrap`}>
                    <Upload size={14} /> {uploading ? "..." : "Файл"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                  </label>
                )}
                <TeamLogo src={draft.logo_url} alt="preview" size={40} />
              </div>
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
