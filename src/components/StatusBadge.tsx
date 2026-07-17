import type { MatchStatus } from "../types";

const MAP: Record<MatchStatus, { label: string; classes: string }> = {
  upcoming: { label: "Скоро", classes: "bg-zinc-800 text-zinc-300 border-zinc-700" },
  live: { label: "LIVE", classes: "bg-red-600/20 text-red-400 border-red-600/50 animate-pulse-glow" },
  finished: { label: "Завершён", classes: "bg-emerald-600/15 text-emerald-400 border-emerald-600/40" },
};

export default function StatusBadge({ status }: { status: MatchStatus }) {
  const cfg = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${cfg.classes}`}>
      {status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
      {cfg.label}
    </span>
  );
}
