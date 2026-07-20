import { useEffect, useState } from "react";
import { Lock, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

// Ключ, под которым инлайн-скрипт в index.html сохраняет хеш с токенами
// из письма (recovery / signup / magic_link).
const STORAGE_KEY = "njdc_supabase_auth_hash";

type Phase = "loading" | "form" | "success" | "error";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase не настроен. Обратитесь к администратору.");
        setPhase("error");
        return;
      }

      // Хеш мог быть сохранён инлайн-скриптом в index.html.
      const storedHash = sessionStorage.getItem(STORAGE_KEY);

      if (!storedHash) {
        // Пользователь открыл страницу вручную — без ссылки из письма.
        setPhase("error");
        setError(
          "Ссылка для сброса пароля не найдена. Откройте страницу входа, " +
            "введите email и нажмите «Забыли пароль?» — мы вышлем письмо с инструкцией."
        );
        return;
      }

      // Разбираем параметры из хеша.
      const hash = storedHash.startsWith("#") ? storedHash.slice(1) : storedHash;
      const params = new URLSearchParams(hash);

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token") ?? "";
      const type = params.get("type");

      // Очищаем хеш из хранилища — он больше не нужен.
      sessionStorage.removeItem(STORAGE_KEY);

      if (!accessToken) {
        setPhase("error");
        setError("Не удалось извлечь токен из ссылки. Возможно, она недействительна.");
        return;
      }

      if (type === "signup") {
        // Подтверждение email — просто устанавливаем сессию и радуемся.
        try {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) {
            setError(sessionErr.message || "Ошибка подтверждения email.");
            setPhase("error");
          } else {
            setPhase("success");
          }
        } catch {
          setError("Ошибка подтверждения email.");
          setPhase("error");
        }
        return;
      }

      if (type === "recovery") {
        // Устанавливаем сессию с recovery-токеном, чтобы updateUser сработал.
        try {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) {
            setError(
              sessionErr.message ||
                "Ссылка для восстановления недействительна или просрочена. Запросите новую."
            );
            setPhase("error");
          } else {
            setPhase("form");
          }
        } catch {
          setError("Ошибка обработки ссылки восстановления.");
          setPhase("error");
        }
        return;
      }

      // Неизвестный тип ссылки.
      setPhase("error");
      setError("Неизвестный тип ссылки. Попробуйте запросить восстановление заново.");
    };

    run();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    if (!supabase) {
      setError("Supabase недоступен.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message || "Ошибка смены пароля.");
      } else {
        setPhase("success");
      }
    } catch {
      setError("Ошибка смены пароля.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500" />
          <span className="text-sm">Обрабатываем ссылку…</span>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
          <h2 className="font-display text-2xl font-bold text-white mb-2">Готово!</h2>
          <p className="mb-6 text-sm text-zinc-300">
            Ваш пароль успешно изменён. Теперь можно войти в аккаунт с новым паролем.
          </p>
          <Link
            to="/"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01]"
          >
            <ArrowLeft size={16} />
            Войти на сайт
          </Link>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
          <h2 className="font-display text-xl font-bold text-white mb-2">Ошибка</h2>
          <p className="mb-6 text-sm text-zinc-300">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01]"
          >
            <ArrowLeft size={16} />
            На главную
          </Link>
        </div>
      </div>
    );
  }

  // ── Form (recovery) ──────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <Lock size={22} className="text-fuchsia-400" />
          <h2 className="font-display text-xl font-bold text-white">Новый пароль</h2>
        </div>

        <p className="mb-6 text-sm text-zinc-400">
          Придумайте новый пароль (минимум 6 символов). Пароль хранится в зашифрованном виде и
          недоступен даже администратору.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Новый пароль
            </label>
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Повторите пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-zinc-500" size={16} />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {submitting ? "Сохраняем..." : "Сохранить новый пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}
