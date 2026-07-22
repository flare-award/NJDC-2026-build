import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MessageSquare, Send, Share2, X, RefreshCw, LogIn, ChevronUp } from "lucide-react";
import { useNodbet } from "../context/NodbetContext";
import { useUserAuth } from "../context/UserAuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { BONUSES, type BonusId } from "../utils/roulette";

// ============================================================
// Чат NODBET — мини-окошко рядом с Клатч-Рулеткой.
//  • Текстовые сообщения (писать могут авторизованные, читать — все).
//  • История хранится в Supabase (таблица nodbet_chat_messages).
//  • Кнопка «Поделиться бонусами» публикует последние выпавшие
//    сектора рулетки в виде фишек (kind='share').
//  • Realtime + запасной поллинг каждые 5 секунд.
// ============================================================

interface SharedBonus {
  bonus_id: BonusId;
  won: number;
}

interface ChatMessage {
  id: number;
  user_id: string;
  nickname: string;
  kind: "text" | "share";
  text: string;
  bonuses: SharedBonus[];
  created_at: string;
}

const PAGE_SIZE = 30;

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function BonusChip({ bonus }: { bonus: SharedBonus }) {
  const def = BONUSES[bonus.bonus_id];
  const won = Math.round(bonus.won || 0);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-mono font-black border border-white/15"
      style={{ background: def?.color || "#27272a", color: def?.textColor || "#fff" }}
      title={def?.label || bonus.bonus_id}
    >
      <span>{def?.shortLabel || bonus.bonus_id}</span>
      <span className={`px-1 rounded bg-black/40 ${won >= 0 ? "text-green-300" : "text-red-300"}`}>
        {won >= 0 ? `+${won.toLocaleString()}` : won.toLocaleString()}
      </span>
    </span>
  );
}

export default function NodbetChat() {
  const { displayNickname, rouletteHistory } = useNodbet();
  const { user } = useUserAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCount, setShareCount] = useState<number>(3);

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const maxIdRef = useRef(0);
  const minIdRef = useRef<number | null>(null);

  const canWrite = isSupabaseConfigured && !!user;

  const showError = useCallback((msg: string) => {
    setErrorText(msg);
    setTimeout(() => setErrorText(null), 3000);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const appendMessages = useCallback(
    (incoming: ChatMessage[], forceScroll = false) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = incoming.filter((m) => !seen.has(m.id));
        if (!fresh.length) return prev;
        return [...prev, ...fresh].sort((a, b) => a.id - b.id);
      });
      for (const m of incoming) {
        if (m.id > maxIdRef.current) maxIdRef.current = m.id;
        if (minIdRef.current === null || m.id < minIdRef.current) minIdRef.current = m.id;
      }
      if (forceScroll || stickToBottomRef.current) {
        setTimeout(scrollToBottom, 30);
      }
    },
    [scrollToBottom]
  );

  // ---------- Загрузка ----------
  const fetchLatest = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("nodbet_chat_messages")
        .select("*")
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (!error && data) {
        const rows = (data as ChatMessage[]).reverse();
        setMessages(rows);
        setHasMore(data.length === PAGE_SIZE);
        if (rows.length) {
          maxIdRef.current = rows[rows.length - 1].id;
          minIdRef.current = rows[0].id;
        }
        setTimeout(scrollToBottom, 50);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  const fetchNewer = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || maxIdRef.current === 0) return;
    try {
      const { data, error } = await supabase
        .from("nodbet_chat_messages")
        .select("*")
        .gt("id", maxIdRef.current)
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (!error && data && data.length) appendMessages(data as ChatMessage[]);
    } catch {
      /* ignore */
    }
  }, [appendMessages]);

  const fetchOlder = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || minIdRef.current === null || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from("nodbet_chat_messages")
        .select("*")
        .lt("id", minIdRef.current)
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (!error && data) {
        const rows = (data as ChatMessage[]).reverse();
        if (rows.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const fresh = rows.filter((m) => !seen.has(m.id));
            return [...fresh, ...prev];
          });
          minIdRef.current = rows[0].id;
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  // Realtime + запасной поллинг
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("nodbet-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nodbet_chat_messages" }, (payload) => {
        appendMessages([payload.new as ChatMessage]);
      })
      .subscribe();
    const poll = setInterval(() => {
      // Если история пуста (maxId ещё неизвестен) — подтягиваем последние,
      // иначе догружаем только новые после известного курсора.
      if (maxIdRef.current === 0) void fetchLatest();
      else void fetchNewer();
    }, 5000);

    return () => {
      clearInterval(poll);
      client.removeChannel(channel);
    };
  }, [appendMessages, fetchNewer, fetchLatest]);

  // ---------- Отправка ----------
  const insertMessage = useCallback(
    async (kind: "text" | "share", text: string, bonuses: SharedBonus[] = []): Promise<boolean> => {
      if (!isSupabaseConfigured || !supabase) {
        showError("Чат недоступен в офлайн-режиме");
        return false;
      }
      if (!user) {
        showError("Войдите в аккаунт, чтобы писать в чат");
        return false;
      }
      try {
        const { data, error } = await supabase
          .from("nodbet_chat_messages")
          .insert({
            user_id: user.id,
            nickname: displayNickname.slice(0, 32),
            kind,
            text: text.slice(0, 500),
            bonuses,
          })
          .select()
          .single();
        if (error) {
          showError(error.message.includes("Слишком частые") ? "Слишком частые сообщения. Подождите пару секунд!" : "Не удалось отправить сообщение");
          return false;
        }
        if (data) appendMessages([data as ChatMessage], true);
        return true;
      } catch {
        showError("Ошибка сети. Попробуйте ещё раз.");
        return false;
      }
    },
    [user, displayNickname, appendMessages, showError]
  );

  const handleSend = useCallback(async () => {
    const clean = input.trim();
    if (!clean || sending) return;
    setSending(true);
    const ok = await insertMessage("text", clean);
    if (ok) {
      setInput("");
      void fetchNewer();
    }
    setSending(false);
  }, [input, sending, insertMessage, fetchNewer]);

  const shareableSpins = useMemo(() => rouletteHistory.slice(0, 10), [rouletteHistory]);
  const shareCountClamped = Math.max(1, Math.min(shareCount, shareableSpins.length || 1));

  const handleShare = useCallback(async () => {
    if (sending || !shareableSpins.length) return;
    setSending(true);
    const picked = shareableSpins.slice(0, shareCountClamped);
    const bonuses: SharedBonus[] = picked
      .slice()
      .reverse()
      .map((s) => ({ bonus_id: s.bonusId, won: Math.round(s.wonCoins) }));
    const caption = input.trim();
    const ok = await insertMessage("share", caption, bonuses);
    if (ok) {
      setInput("");
      setShareOpen(false);
      void fetchNewer();
    }
    setSending(false);
  }, [sending, shareableSpins, shareCountClamped, input, insertMessage, fetchNewer]);

  // ---------- Рендер ----------
  return (
    <div className="rounded-3xl border border-white/10 bg-[#141414] shadow-2xl flex flex-col overflow-hidden">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-[#160a0a] to-[#12121a] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-amber-500 text-white shadow">
            <MessageSquare size={16} />
          </span>
          <div>
            <h3 className="font-display text-sm font-black uppercase tracking-wide text-white">Чат NODBET</h3>
            <p className="text-[10px] text-zinc-500">Общайтесь и делитесь выпавшими бонусами</p>
          </div>
        </div>
        <button
          onClick={() => fetchLatest()}
          className="rounded-lg p-1.5 text-zinc-500 hover:text-yellow-300 hover:bg-white/5 transition-colors cursor-pointer"
          title="Обновить чат"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Сообщения */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 min-h-[280px] max-h-[320px] overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin"
      >
        {!isSupabaseConfigured && (
          <div className="text-center text-xs text-zinc-500 italic py-10">Чат недоступен в офлайн-режиме</div>
        )}
        {isSupabaseConfigured && loading && (
          <div className="flex items-center justify-center py-10 text-zinc-500">
            <RefreshCw size={16} className="animate-spin" />
          </div>
        )}
        {isSupabaseConfigured && !loading && messages.length === 0 && (
          <div className="text-center text-xs text-zinc-500 italic py-10">
            Пока пусто. Напишите первым — расскажите, что выбило колесо! 🎰
          </div>
        )}

        {hasMore && (
          <button
            onClick={fetchOlder}
            disabled={loadingOlder}
            className="w-full flex items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-[11px] font-bold text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {loadingOlder ? <RefreshCw size={12} className="animate-spin" /> : <ChevronUp size={12} />}
            Загрузить раньше
          </button>
        )}

        {messages.map((m) => {
          const isMine = !!user && m.user_id === user.id;
          if (m.kind === "share") {
            return (
              <div
                key={m.id}
                className={`rounded-2xl border px-3 py-2.5 ${
                  isMine ? "border-yellow-500/40 bg-yellow-500/10" : "border-purple-500/30 bg-purple-500/10"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[11px] font-black ${isMine ? "text-yellow-300" : "text-purple-300"}`}>
                    {isMine ? "Я" : m.nickname}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">{timeLabel(m.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[11px] font-bold text-zinc-200">
                  🎰 Поделился(лась) последними бонусами в рулетке (<b className="text-yellow-300">{m.bonuses.length}</b>):
                </p>
                {m.text.trim() && <p className="mt-1 text-xs text-zinc-300 break-words whitespace-pre-wrap">«{m.text}»</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.bonuses.map((b, i) => (
                    <BonusChip key={`${m.id}_${i}`} bonus={b} />
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2 ${
                  isMine ? "bg-red-600/20 border border-red-500/30 rounded-br-md" : "bg-white/5 border border-white/10 rounded-bl-md"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`text-[11px] font-black ${isMine ? "text-yellow-300" : "text-cyan-300"}`}>
                    {isMine ? "Я" : m.nickname}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{timeLabel(m.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-100 break-words whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Панель шара бонусов */}
      {shareOpen && (
        <div className="border-t border-white/10 bg-purple-500/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-purple-300">Сколько последних бонусов показать?</span>
            <button onClick={() => setShareOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setShareCount(n)}
                disabled={n > shareableSpins.length}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  shareCountClamped === n ? "bg-purple-600 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={handleShare}
              disabled={sending || !shareableSpins.length || !canWrite}
              className="ml-auto rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-500 px-3 py-1.5 text-[11px] font-black text-white uppercase tracking-wider hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? "..." : "Отправить"}
            </button>
          </div>
          {/* Превью выбранных бонусов */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shareableSpins
              .slice(0, shareCountClamped)
              .slice()
              .reverse()
              .map((s, i) => (
                <BonusChip key={`share_prev_${i}`} bonus={{ bonus_id: s.bonusId, won: Math.round(s.wonCoins) }} />
              ))}
          </div>
        </div>
      )}

      {/* Поле ввода */}
      <div className="border-t border-white/10 bg-black/30 px-3 py-2.5">
        {errorText && <p className="mb-1.5 text-[11px] font-bold text-red-400">⚠️ {errorText}</p>}
        {canWrite ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareOpen((v) => !v)}
              disabled={!shareableSpins.length}
              title={shareableSpins.length ? "Поделиться выпавшими бонусами" : "Сначала сделайте спин — пока нечем делиться"}
              className={`shrink-0 rounded-xl p-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                shareOpen ? "bg-purple-600 text-white" : "bg-white/5 text-purple-300 hover:bg-white/10"
              }`}
            >
              <Share2 size={15} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              maxLength={500}
              placeholder={shareOpen ? "Подпись к бонусам (необязательно)..." : "Написать сообщение..."}
              className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-yellow-400 focus:outline-none"
            />
            <button
              onClick={() => void handleSend()}
              disabled={sending || !input.trim()}
              className="shrink-0 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 p-2 text-white shadow hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Отправить"
            >
              <Send size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/40 px-3 py-2.5 text-[11px] text-zinc-400">
            <LogIn size={13} className="text-yellow-400" />
            Войдите в аккаунт, чтобы писать в чат и делиться бонусами
          </div>
        )}
      </div>
    </div>
  );
}
