import { useState } from "react";
import { LogOut, ShieldCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import AdminLogin from "./AdminLogin";
import TeamsTab from "./TeamsTab";
import PlayersTab from "./PlayersTab";
import MatchesTab from "./MatchesTab";
import FaqTab from "./FaqTab";
import SettingsTab from "./SettingsTab";
import HighRollersTab from "./HighRollersTab";

const TABS = [
  { key: "matches", label: "Матчи" },
  { key: "teams", label: "Команды" },
  { key: "players", label: "Игроки" },
  { key: "highrollers", label: "Хайроллеры" },
  { key: "faq", label: "FAQ" },
  { key: "settings", label: "Настройки" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const { isAdmin, logout } = useAuth();
  const { isSupabaseConfigured: connected } = useData();
  const [tab, setTab] = useState<TabKey>("matches");

  if (!isAdmin) return <AdminLogin />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand">
            <ShieldCheck size={18} className="text-white" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Админ-панель NJDC 2026</h1>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              Вошли как maronn ·
              {connected ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span>
                  <span className="text-green-400">realtime активен — изменения видны сразу</span>
                </>
              ) : (
                "изменения сохраняются локально"
              )}
            </p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:border-white/40">
          <LogOut size={15} /> Выйти
        </button>
      </div>

      {!connected && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/[0.06] px-4 py-3 text-sm text-yellow-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            Supabase не подключён: изменения сохраняются только в этом браузере (localStorage). Чтобы изменения были
            видны всем посетителям сайта, настройте переменные окружения — см. файл <code>SETUP.md</code>.
          </span>
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-gradient-brand text-white" : "border border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "matches" && <MatchesTab />}
      {tab === "teams" && <TeamsTab />}
      {tab === "players" && <PlayersTab />}
      {tab === "highrollers" && <HighRollersTab />}
      {tab === "faq" && <FaqTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
