// ============================================================
// CASEUP by 1DONY — раздел «Топ открывателей».
// Сортировка по открытым кейсам. Применяются украшения,
// купленные в NODBET: Рамка Зала Славы, Корона, Звёздный След,
// Аура и Свой Статус.
// ============================================================
import { useMemo, useState } from "react";
import { Trophy, Crown, Box, Search } from "lucide-react";
import { useCaseup } from "../../context/CaseupContext";
import { AURA_COLORS } from "../../context/NodbetContext";
import { fmtNod } from "../../utils/caseup";
import { SectionTitle, EmptyState } from "./CaseupShared";

export default function TopOpenersSection() {
  const { topOpeners, loading } = useCaseup();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = topOpeners;
    if (q) list = topOpeners.filter((t) => t.nickname.toLowerCase().includes(q));
    return list;
  }, [topOpeners, query]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const placeStyle = (i: number) =>
    i === 0
      ? { ring: "ring-2 ring-yellow-400/40", badge: "👑", label: "1 МЕСТО", bg: "from-yellow-500/20 via-[#181410] to-[#141414]", border: "border-yellow-500/50" }
      : i === 1
        ? { ring: "", badge: "🥈", label: "2 МЕСТО", bg: "from-zinc-500/25 to-[#141414]", border: "border-zinc-400/30" }
        : { ring: "", badge: "🥉", label: "3 МЕСТО", bg: "from-amber-700/25 to-[#141414]", border: "border-amber-600/30" };

  return (
    <div>
      <SectionTitle
        icon={<Trophy size={20} />}
        title="Топ открывателей"
        subtitle="Самые активные охотники за скинами. Считается количество открытых кейсов."
        right={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск игрока..."
              className="w-56 rounded-lg border border-white/10 bg-[#0e0e0e] py-2 pl-8 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/60"
            />
          </div>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy size={40} />}
          title="Пока никто не открывал кейсы"
          hint="Открой первый кейс в разделе «Кейсы» и попади в таблицу лидеров!"
        />
      ) : (
        <>
          {/* Подиум топ-3 */}
          <div className="mb-6 grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
            {podium.map((t, i) => {
              const s = placeStyle(i);
              const auraDef = t.auraOwned && t.auraEnabled && t.auraColor ? AURA_COLORS.find((c) => c.id === t.auraColor) : null;
              return (
                <div
                  key={t.userId}
                  className={`relative flex flex-col items-center overflow-hidden rounded-2xl border bg-gradient-to-b p-5 text-center shadow-xl ${s.bg} ${s.border} ${s.ring} ${i === 1 ? "sm:translate-y-3" : i === 2 ? "sm:translate-y-3" : ""}`}
                >
                  <div className="absolute right-0 top-0 rounded-bl-xl bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-200">
                    {s.badge} {s.label}
                  </div>
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-700 text-3xl font-black text-black shadow-lg ${i === 0 ? "animate-bounce" : ""}`}>
                    {s.badge}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    {t.crownBadge && <span className="text-base">👑</span>}
                    <span
                      className={`font-display text-lg font-bold ${
                        t.hallFrame ? "rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-300 ring-1 ring-amber-400/60" : "text-white"
                      } ${t.crownBadge ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" : ""} ${auraDef ? "aura-nickname" : ""}`}
                      style={auraDef ? ({ "--aura-color": auraDef.color, "--aura-glow": auraDef.glow } as React.CSSProperties) : undefined}
                    >
                      {t.nickname}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-lg font-black text-yellow-400">{fmtNod(t.casesOpened)} кейсов</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    Уровень {t.level} · потрачено {fmtNod(t.spent)} NOD
                  </div>
                </div>
              );
            })}
          </div>

          {/* Таблица */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Открыватель</th>
                  <th className="px-5 py-3.5 text-center">Уровень</th>
                  <th className="px-5 py-3.5 text-center">Кейсов открыто</th>
                  <th className="px-5 py-3.5 text-right">Потрачено NOD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rest.map((t, idx) => {
                  const auraDef = t.auraOwned && t.auraEnabled && t.auraColor ? AURA_COLORS.find((c) => c.id === t.auraColor) : null;
                  const place = idx + 4;
                  return (
                    <tr
                      key={t.userId}
                      className={`transition-colors ${t.isSelf ? "bg-violet-950/40" : t.hallFrame ? "bg-amber-500/[0.05]" : ""}`}
                    >
                      <td className="px-5 py-3.5 font-display text-base font-bold text-zinc-500">{place}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {auraDef ? (
                            <span
                              className="aura-nickname relative inline-flex items-center gap-2"
                              style={{ "--aura-color": auraDef.color, "--aura-glow": auraDef.glow } as React.CSSProperties}
                            >
                              {t.crownBadge && <span className="relative z-10 text-sm">👑</span>}
                              <span
                                className={`relative z-10 font-bold ${
                                  t.hallFrame ? "rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-300 ring-1 ring-amber-400/60" : "text-white"
                                } ${t.crownBadge ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" : ""} ${t.isSelf ? "text-yellow-400" : ""}`}
                              >
                                {t.nickname}
                              </span>
                              {t.starTrail && (
                                <span className="star-trail-container pointer-events-none absolute inset-0">
                                  <span className="star-particle" style={{ top: "10%", left: "5%", animationDelay: "0s" }}>✦</span>
                                  <span className="star-particle" style={{ top: "60%", left: "92%", animationDelay: "0.5s" }}>✧</span>
                                  <span className="star-particle" style={{ top: "15%", left: "75%", animationDelay: "1s" }}>✦</span>
                                </span>
                              )}
                            </span>
                          ) : (
                            <>
                              {t.crownBadge && <span className="text-sm">👑</span>}
                              <span
                                className={`font-bold ${
                                  t.hallFrame ? "rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-300 ring-1 ring-amber-400/60" : "text-white"
                                } ${t.crownBadge ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" : ""} ${t.isSelf ? "text-yellow-400" : ""}`}
                              >
                                {t.nickname}
                              </span>
                              {t.starTrail && (
                                <span className="star-trail-container relative ml-1 inline-block">
                                  <span className="star-particle" style={{ top: "-30%", left: "0%", animationDelay: "0s" }}>✦</span>
                                  <span className="star-particle" style={{ top: "20%", left: "60%", animationDelay: "0.5s" }}>✧</span>
                                </span>
                              )}
                            </>
                          )}
                          {t.isSelf && <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">Вы</span>}
                          {t.customStatus && (
                            <span className="rounded-full border border-yellow-500/50 bg-yellow-500/20 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300">
                              {t.customStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs font-bold text-yellow-300">
                          <Crown size={11} /> {t.level}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 font-mono font-bold text-zinc-100">
                          <Box size={13} className="text-violet-400" /> {fmtNod(t.casesOpened)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-zinc-300">{fmtNod(t.spent)} <span className="text-[10px] text-zinc-500">NOD</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
