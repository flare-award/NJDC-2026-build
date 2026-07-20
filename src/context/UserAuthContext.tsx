import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

interface UserInfo {
  id: string;
  email: string;
}

interface UserAuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authMode: "signin" | "signup";
  setAuthMode: (mode: "signin" | "signup") => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  // Сброс пароля: отправка письма со ссылкой для восстановления
  sendResetPasswordEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  // Плашка подтверждения почты после регистрации (пункт 10)
  emailConfirmPrompt: { email: string } | null;
  dismissEmailConfirmPrompt: () => void;
}

const LOCAL_USER_KEY = "njdc_local_user";
const LOCAL_USERS_DB = "njdc_local_users_db";

const UserAuthContext = createContext<UserAuthContextValue | null>(null);

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  // Плашка «подтвердите email» (пункт 10). Живёт только в памяти:
  // при перезагрузке страницы она пропадает и больше не появляется.
  const [emailConfirmPrompt, setEmailConfirmPrompt] = useState<{ email: string } | null>(null);
  const dismissEmailConfirmPrompt = useCallback(() => setEmailConfirmPrompt(null), []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (mounted && data.session?.user) {
          setUser({ id: data.session.user.id, email: data.session.user.email ?? "" });
        }
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            setUser({ id: session.user.id, email: session.user.email ?? "" });
          } else {
            setUser(null);
          }
        });
        setLoading(false);
        return () => sub.subscription.unsubscribe();
      } else {
        try {
          const raw = localStorage.getItem(LOCAL_USER_KEY);
          if (raw) {
            setUser(JSON.parse(raw));
          }
        } catch {
          /* ignore */
        }
        setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { ok: false, error: "Заполните все поля" };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        return { ok: false, error: error.message || "Ошибка входа" };
      }
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? cleanEmail });
      }
      return { ok: true };
    } else {
      // Local fallback DB
      try {
        const dbRaw = localStorage.getItem(LOCAL_USERS_DB);
        const users: Array<{ id: string; email: string; pass: string }> = dbRaw ? JSON.parse(dbRaw) : [];
        const found = users.find((u) => u.email === cleanEmail && u.pass === password);
        if (!found) {
          return { ok: false, error: "Неверный email или пароль (локальный режим)" };
        }
        const userInfo = { id: found.id, email: found.email };
        setUser(userInfo);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userInfo));
        return { ok: true };
      } catch {
        return { ok: false, error: "Ошибка локальной авторизации" };
      }
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 6) {
      return { ok: false, error: "Введите корректный email и пароль (мин. 6 символов)" };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error) {
        return { ok: false, error: error.message || "Ошибка регистрации" };
      }
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? cleanEmail });
      }
      // Пункт 10: показываем плашку с просьбой подтвердить email.
      setEmailConfirmPrompt({ email: cleanEmail });
      return { ok: true };
    } else {
      // Local fallback DB
      try {
        const dbRaw = localStorage.getItem(LOCAL_USERS_DB);
        const users: Array<{ id: string; email: string; pass: string }> = dbRaw ? JSON.parse(dbRaw) : [];
        if (users.some((u) => u.email === cleanEmail)) {
          return { ok: false, error: "Пользователь с таким email уже существует" };
        }
        const newUser = { id: crypto.randomUUID(), email: cleanEmail, pass: password };
        users.push(newUser);
        localStorage.setItem(LOCAL_USERS_DB, JSON.stringify(users));

        const userInfo = { id: newUser.id, email: newUser.email };
        setUser(userInfo);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userInfo));
        return { ok: true };
      } catch {
        return { ok: false, error: "Ошибка локальной регистрации" };
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
  }, []);

  // Отправка письма для сброса пароля.
  // Письмо содержит ссылку, по которой пользователь задаёт новый пароль
  // на отдельной странице /reset-password.
  const sendResetPasswordEmail = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { ok: false, error: "Введите email" };
    }

    if (isSupabaseConfigured && supabase) {
      // redirectTo — куда Supabase перенаправит пользователя после перехода по
      // ссылке из письма. Указываем корень сайта; токены придут в хеше.
      const redirectTo = typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });
      if (error) {
        return { ok: false, error: error.message || "Ошибка отправки письма" };
      }
      return { ok: true };
    } else {
      // Локальный режим без Supabase — сброс пароля недоступен.
      return {
        ok: false,
        error: "Сброс пароля доступен только при подключённом Supabase.",
      };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authModalOpen,
      setAuthModalOpen,
      authMode,
      setAuthMode,
      signIn,
      signUp,
      signOut,
      sendResetPasswordEmail,
      emailConfirmPrompt,
      dismissEmailConfirmPrompt,
    }),
    [user, loading, authModalOpen, authMode, signIn, signUp, signOut, sendResetPasswordEmail, emailConfirmPrompt, dismissEmailConfirmPrompt]
  );

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth must be used within UserAuthProvider");
  return ctx;
}
