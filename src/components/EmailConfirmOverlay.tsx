import { useEffect, useState } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext";

// ============================================================
// Плашка подтверждения почты после регистрации (пункт 10).
//
// Появляется сразу после регистрации, перекрывает сайт и просит
// пользователя подтвердить email. Исчезает при ДВУХ условиях:
//   1) через 30 секунд после появления — и больше не показывается;
//   2) при обновлении страницы — состояние живёт только в памяти,
//      поэтому после reload плашки уже не будет.
// ============================================================

const AUTO_DISMISS_MS = 30000;

export default function EmailConfirmOverlay() {
  const { emailConfirmPrompt, dismissEmailConfirmPrompt } = useUserAuth();
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (!emailConfirmPrompt) return;
    setSecondsLeft(Math.round(AUTO_DISMISS_MS / 1000));

    // Обратный отсчёт для наглядности.
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    // Автозакрытие через 30 секунд (условие 1).
    const timeout = setTimeout(() => {
      dismissEmailConfirmPrompt();
    }, AUTO_DISMISS_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [emailConfirmPrompt, dismissEmailConfirmPrompt]);

  if (!emailConfirmPrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-fuchsia-500/40 bg-[#121212] p-6 sm:p-8 text-white shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-lg">
          <MailCheck size={34} />
        </div>

        <h2 className="text-center font-display text-2xl font-black uppercase tracking-wide text-white">
          Подтвердите свою почту
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-300">
          Мы отправили письмо на адрес{" "}
          <b className="text-fuchsia-300 break-all">{emailConfirmPrompt.email}</b>.
        </p>

        <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
          <p className="flex gap-2">
            <span className="font-bold text-fuchsia-400">1.</span>
            <span>
              Откройте письмо от <b className="text-white">Supabase Auth</b> в своём почтовом ящике (проверьте
              папку «Спам», если письма нет во «Входящих»).
            </span>
          </p>
          <p className="flex gap-2">
            <span className="font-bold text-fuchsia-400">2.</span>
            <span>
              Перейдите по ссылке из письма и <b className="text-white">задержитесь на открывшейся странице 10–20 секунд</b>,
              затем закройте её.
            </span>
          </p>
          <p className="flex gap-2">
            <span className="font-bold text-fuchsia-400">3.</span>
            <span>
              Вернитесь сюда, <b className="text-white">обновите сайт турнира</b> и войдите в свой аккаунт, используя
              те же данные (email и пароль), что и при регистрации.
            </span>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-bold text-white transition-transform hover:scale-[1.01] cursor-pointer"
          >
            <RefreshCw size={16} /> Обновить сайт турнира
          </button>
          <button
            onClick={dismissEmailConfirmPrompt}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 cursor-pointer"
          >
            Понятно
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-500">
          Эта плашка автоматически исчезнет через <b className="text-zinc-300">{secondsLeft} сек</b> и больше не появится.
        </p>
      </div>
    </div>
  );
}
