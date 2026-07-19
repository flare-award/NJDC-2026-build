import { useState } from "react";
import { X, Mail, Lock, AlertCircle } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext";

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, authMode, setAuthMode, signIn, signUp } = useUserAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = authMode === "signin" ? await signIn(email, password) : await signUp(email, password);
      if (res.ok) {
        setAuthModalOpen(false);
        setEmail("");
        setPassword("");
      } else {
        setError(res.error || "Произошла ошибка");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl sm:p-8">
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>

        <div className="mb-6 flex gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => {
              setAuthMode("signin");
              setError(null);
            }}
            className={`font-display text-lg font-bold pb-1 transition-colors ${
              authMode === "signin" ? "text-white border-b-2 border-fuchsia-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Вход
          </button>
          <button
            onClick={() => {
              setAuthMode("signup");
              setError(null);
            }}
            className={`font-display text-lg font-bold pb-1 transition-colors ${
              authMode === "signup" ? "text-white border-b-2 border-fuchsia-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Регистрация
          </button>
        </div>

        <p className="mb-6 text-sm text-zinc-400">
          {authMode === "signin"
            ? "Войдите в аккаунт, чтобы оставлять прогнозы на матчи NJDC 2026."
            : "Создайте аккаунт по email и паролю для участия в прогнозах."}
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-zinc-500" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Пароль</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-zinc-500" size={16} />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? "Загрузка..." : authMode === "signin" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}
