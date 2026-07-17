import { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

const LINKS = [
  { to: "/", label: "Главная", end: true },
  { to: "/teams", label: "Команды" },
  { to: "/bracket", label: "Турнирная сетка" },
  { to: "/matches", label: "Матчи" },
  { to: "/leaderboard", label: "Таблица лидеров" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Скрытый вход в админ-панель: 5 быстрых кликов по логотипу
  const handleLogoClick = () => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, 2500);
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      navigate("/nb-admin-9991");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0d0d0d]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={handleLogoClick}
          className="flex select-none items-center gap-2.5 text-left"
          aria-label="NJDC 2026"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand font-display text-lg font-bold text-white">
            N
          </span>
          <span className="font-display text-lg font-bold tracking-wide text-white">
            NJDC <span className="text-gradient">2026</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "text-zinc-400 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <span className="relative">
                  {l.label}
                  {isActive && (
                    <span className="absolute -bottom-[9px] left-0 right-0 h-[2px] bg-gradient-brand" />
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <a
          href="https://cybershoke.net/"
          target="_blank"
          rel="noreferrer"
          className="hidden rounded-md border border-white/10 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-white/30 hover:text-white lg:block"
        >
          CYBERSHOKE ↗
        </a>

        <button className="text-zinc-300 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Меню">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/5 px-4 py-3 lg:hidden">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-2.5 text-sm font-medium ${isActive ? "bg-white/5 text-white" : "text-zinc-400"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <a
            href="https://cybershoke.net/"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2.5 text-sm font-medium text-zinc-400"
          >
            CYBERSHOKE ↗
          </a>
        </nav>
      )}
    </header>
  );
}
