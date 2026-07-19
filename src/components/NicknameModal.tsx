import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2, PencilLine } from "lucide-react";
import { useNodbet } from "../context/NodbetContext";

interface NicknameModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NicknameModal({ open, onClose }: NicknameModalProps) {
  const { nickname, displayNickname, setProfileNickname } = useNodbet();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(nickname || "");
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [open, nickname]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await setProfileNickname(value);
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => onClose(), 800);
    } else {
      setError(res.error || "Произошла ошибка");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-zinc-400 hover:text-white" aria-label="Закрыть">
          <X size={20} />
        </button>

        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
          <PencilLine size={20} className="text-yellow-400" />
          <h3 className="font-display text-lg font-bold text-white">Ваш никнейм</h3>
        </div>

        <p className="mb-4 text-sm text-zinc-400">
          Никнейм виден всем в <b className="text-yellow-300">Топе Хайроллеров NODBET</b> и на сайте — вместо вашей
          почты. Так адреса почт никто не увидит 😉
        </p>

        {!nickname && (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            🍉 Сейчас у вас временный фруктовый ник: <b className="font-mono">{displayNickname}</b>
            <br />
            Придумайте свой, чтобы заменить его!
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Никнейм сохранён! Он уже виден в топе хайроллеров.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Никнейм
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={displayNickname}
              maxLength={30}
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white placeholder-zinc-600 focus:border-yellow-400 focus:outline-none"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              Можно: русские и латинские буквы, цифры и символы <b className="text-zinc-300">«-»</b>,{" "}
              <b className="text-zinc-300">«_»</b>, <b className="text-zinc-300">«+»</b>.<br />
              Нельзя: пробелы и другие спецсимволы. От 2 до 24 символов.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Сохраняем..." : "Сохранить никнейм"}
          </button>
        </form>
      </div>
    </div>
  );
}
