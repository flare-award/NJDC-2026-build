import { useRef, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
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

        <div className="mt-10 flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand">
              <FileText size={18} className="text-white" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Официальный регламент турнира</p>
              <p className="text-xs text-zinc-500">NJDC 2026 regulations.pdf</p>
            </div>
          </div>
          <a
            href={encodeURI(settings.regulations_url)}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:border-transparent hover:bg-gradient-brand sm:w-auto"
          >
            Открыть регламент (PDF)
          </a>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-center sm:flex-row sm:text-left">
          <p className="select-none text-xs text-zinc-600" onClick={handleYearClick}>
            © 2026 NJDC — Nodben Joski Duo Cup. Сервер «{settings.server_name}» · CS2 на CYBERSHOKE.
          </p>
          <p className="text-xs text-zinc-600">Неофициальный турнир сообщества. Не связан с Valve.</p>
        </div>
      </div>
    </footer>
  );
}
