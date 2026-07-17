import { useState } from "react";
import { useData } from "../../context/DataContext";
import { inputClass, labelClass, btnPrimary } from "./adminStyles";

export default function SettingsTab() {
  const { settings, updateSettings } = useData();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-5 font-display text-xl font-bold text-white">Общие настройки сайта</h2>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Заголовок на главной</label>
          <input className={inputClass} value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Подзаголовок</label>
          <input className={inputClass} value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Плашка-объявление вверху главной</label>
          <input className={inputClass} value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Текст призового фонда</label>
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={form.prize_text}
            onChange={(e) => setForm({ ...form, prize_text: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Название сервера</label>
          <input className={inputClass} value={form.server_name} onChange={(e) => setForm({ ...form, server_name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Путь к PDF регламента</label>
          <input
            className={inputClass}
            value={form.regulations_url}
            onChange={(e) => setForm({ ...form, regulations_url: e.target.value })}
          />
          <p className="mt-1 text-xs text-zinc-600">По умолчанию: /NJDC 2026 regulations.pdf (файл лежит в папке public/ проекта).</p>
        </div>
      </div>
      <button className={`${btnPrimary} mt-6`} disabled={saving} onClick={handleSave}>
        {saving ? "Сохранение..." : saved ? "Сохранено ✓" : "Сохранить настройки"}
      </button>
    </div>
  );
}
