import { useState, useEffect } from "react";
import { Search, Save, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { inputClass, btnPrimary, btnGhost } from "./adminStyles";
import { fruitNickname } from "../../utils/nickname";

interface Profile {
  user_id: string;
  nickname: string | null;
  balance: number;
  xp: number;
}

export default function HighRollersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("nodbet_profiles")
        .select("user_id, nickname, balance, xp")
        .order("balance", { ascending: false });
      
      if (!error && data) {
        setProfiles(data as Profile[]);
      } else if (error) {
        console.error("Error fetching profiles:", error);
      }
    } catch (e) {
      console.error("Failed to fetch profiles:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBalance(userId: string) {
    if (!isSupabaseConfigured || !supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("nodbet_profiles")
        .update({ balance: Math.round(editBalance) })
        .eq("user_id", userId);
      
      if (!error) {
        setProfiles(prev => prev.map(p => p.user_id === userId ? { ...p, balance: Math.round(editBalance) } : p));
        setEditingId(null);
      } else {
        alert("Ошибка при сохранении: " + error.message);
      }
    } catch (e: any) {
      alert("Ошибка сети: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = profiles.filter(p => {
    const nick = (p.nickname || fruitNickname(p.user_id)).toLowerCase();
    const id = p.user_id.toLowerCase();
    const s = search.toLowerCase();
    return nick.includes(s) || id.includes(s);
  });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Управление Хайроллерами</h2>
          <p className="text-xs text-zinc-500">Прямое изменение баланса NOD коинов в базе данных</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Никнейм или User ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <th className="px-6 py-4">Пользователь</th>
              <th className="px-6 py-4 hidden md:table-cell">User ID</th>
              <th className="px-6 py-4">Текущий баланс</th>
              <th className="px-6 py-4 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent"></div>
                    <span>Загрузка профилей из Supabase...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                  {search ? `Пользователи по запросу "${search}" не найдены` : "Список пользователей пуст"}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.user_id} className="group transition-colors hover:bg-white/[0.03]">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">
                        {p.nickname || fruitNickname(p.user_id)}
                      </span>
                      {!p.nickname && <span className="text-[10px] text-zinc-500">Временный ник</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="font-mono text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                      {p.user_id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === p.user_id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className={`${inputClass} w-32 border-fuchsia-500/50 bg-fuchsia-500/5`}
                          value={editBalance}
                          onChange={(e) => setEditBalance(Number(e.target.value))}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveBalance(p.user_id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <span className="text-xs font-bold text-yellow-500">NOD</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-yellow-500">
                          {p.balance.toLocaleString()} NOD
                        </span>
                        <span className="text-[10px] text-zinc-500">{p.xp.toLocaleString()} XP</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === p.user_id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                          disabled={saving}
                          onClick={() => handleSaveBalance(p.user_id)}
                          title="Сохранить"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
                          onClick={() => setEditingId(null)}
                          title="Отмена"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className={btnGhost}
                        onClick={() => {
                          setEditingId(p.user_id);
                          setEditBalance(p.balance);
                        }}
                      >
                        Изменить
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {!loading && filtered.length > 0 && (
        <p className="mt-4 text-[11px] text-zinc-500">
          * Изменение баланса происходит мгновенно в базе данных. Пользователь увидит новый баланс при следующем обновлении страницы или через realtime-подписку.
        </p>
      )}
    </div>
  );
}
