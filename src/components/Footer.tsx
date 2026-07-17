import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";

export default function Footer() {
  const { faq, settings } = useData();
  const [openId, setOpenId] = useState<string | null>(faq[0]?.id ?? null);
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleYearClick = () => {
    clickCount.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => (clickCount.current = 0), 2500);
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      navigate("/nb-admin-9991");
    }
  };

  return (
    <footer className="mt-24 border-t border-white/5 bg-[#0a0a0a]">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Часто задаваемые <span className="text-gradient">вопросы</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-500">Всё, что нужно знать об NJDC 2026 перед стартом турнира.</p>

        <div className="mt-8 divide-y divide-white/5 border-y border-white/5">
          {faq
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => {
              const isOpen = openId === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <span className="font-medium text-zinc-100">{item.question}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-zinc-500 transition-transform ${isOpen ? "rotate-180 text-fuchsia-400" : ""}`}
                    />
                  </button>
                  {isOpen && <p className="pb-4 text-sm leading-relaxed text-zinc-400">{item.answer}</p>}
                </div>
              );
            })}
        </div>

        {/* SPONSORS MINI BAR */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.01] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Официальные партнёры турнира:
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display italic font-black uppercase tracking-wider text-white text-sm bg-[#E10600] px-3 py-0.5 rounded shadow-sm">
              NOD<span className="text-yellow-300">BET</span>
            </span>
            <span className="font-display italic font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-sky-400 text-sm bg-slate-900 border border-cyan-500/30 px-3 py-0.5 rounded shadow-sm">
              1DONY
            </span>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-center sm:flex-row sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 text-xs text-zinc-500">
            <p className="select-none" onClick={handleYearClick}>
              © 2026 NJDC — Nodben Joski Duo Cup. Сервер «{settings.server_name}».
            </p>
            <a
              href={encodeURI(settings.regulations_url)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-fuchsia-400 hover:text-fuchsia-300 underline underline-offset-4 transition-colors"
            >
              Регламент
            </a>
          </div>
          <p className="text-xs text-zinc-600">Неофициальный турнир сообщества. CS2 на CYBERSHOKE.</p>
        </div>
      </div>
    </footer>
  );
}
