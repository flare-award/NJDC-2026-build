import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const ADMIN_USERNAME = "maronn";
const ADMIN_PASSWORD = "9991";
const ADMIN_EMAIL = "maronn@njdc.local";
const LOCAL_SESSION_KEY = "njdc_admin_session";

interface AuthContextValue {
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (mounted) setIsAdmin(Boolean(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          setIsAdmin(Boolean(session));
        });
        setLoading(false);
        return () => sub.subscription.unsubscribe();
      } else {
        setIsAdmin(sessionStorage.getItem(LOCAL_SESSION_KEY) === "true");
        setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    if (username.trim().toLowerCase() !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return { ok: false, error: "Неверный логин или пароль" };
    }
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
      if (error) {
        return {
          ok: false,
          error:
            "Логин/пароль верны, но учётная запись администратора не настроена в Supabase Auth (см. SETUP.md).",
        };
      }
      setIsAdmin(true);
      return { ok: true };
    }
    sessionStorage.setItem(LOCAL_SESSION_KEY, "true");
    setIsAdmin(true);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
    setIsAdmin(false);
  }, []);

  const value = useMemo(() => ({ isAdmin, loading, login, logout }), [isAdmin, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
