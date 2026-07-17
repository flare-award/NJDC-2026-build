import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "../../context/DataContext";
import type { FaqItem } from "../../types";
import { inputClass, labelClass, btnPrimary, btnGhost, btnDanger } from "./adminStyles";

function emptyFaq(order: number): FaqItem {
  return { id: crypto.randomUUID(), question: "", answer: "", sort_order: order };
}

export default function FaqTab() {
  const { faq, upsertFaq, deleteFaq } = useData();
  const [draft, setDraft] = useState<FaqItem | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await upsertFaq(draft);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">FAQ</h2>
        <button className={btnPrimary} onClick={() => setDraft(emptyFaq(faq.length + 1))}>
          <span className="flex items-center gap-1.5">
            <Plus size={16} /> Добавить вопрос
          </span>
        </button>
      </div>

      <div className="space-y-3">
        {faq
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="font-semibold text-white">{f.question}</p>
                <p className="mt-1 text-xs text-zinc-500">{f.answer}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button className={btnGhost} onClick={() => setDraft(f)}>
                  Изменить
                </button>
                <button
                  className={btnDanger}
                  onClick={() => {
                    if (confirm("Удалить вопрос?")) deleteFaq(f.id);
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
          <h3 className="mb-4 font-display font-bold text-white">{faq.some((f) => f.id === draft.id) ? "Редактирование вопроса" : "Новый вопрос"}</h3>
          <label className={labelClass}>Вопрос</label>
          <input className={`${inputClass} mb-4`} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          <label className={labelClass}>Ответ</label>
          <textarea
            className={`${inputClass} mb-4 min-h-[100px]`}
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
          />
          <label className={labelClass}>Порядок</label>
          <input
            type="number"
            className={`${inputClass} mb-4`}
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
          />
          <div className="flex gap-3">
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
