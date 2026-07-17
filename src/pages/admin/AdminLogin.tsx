import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AdminLogin() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await login(username, password);
    if (!res.ok) setError(res.error ?? "Ошибка входа");
    setLoading(false);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand">
            <Lock size={20} className="text-white" />
          </span>
          <h1 className="font-display text-xl font-bold text-white">Панель администратора NJDC</h1>
          <p className="text-xs text-zinc-500">Доступ только для организатора турнира.</p>
        </div>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Логин</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500"
          autoComplete="off"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500"
          autoComplete="off"
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-brand py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
