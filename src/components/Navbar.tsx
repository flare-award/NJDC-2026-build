import { useRef, useState } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { Menu, X, LogIn, LogOut, User, Flame, Pencil } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext";
import { useNodbet } from "../context/NodbetContext";
import AuthModal from "./AuthModal";
import NicknameModal from "./NicknameModal";

const LINKS = [
  { to: "/", label: "Главная", end: true },
  { to: "/nodbet", label: "NODBET 🎰", special: true },
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
  const { user, signOut, setAuthModalOpen, setAuthMode } = useUserAuth();
  const { balance, level, displayNickname, hasCustomNickname } = useNodbet();
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);

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
    <>
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
                  `rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
                    l.special
                      ? isActive
                        ? "bg-red-600/20 text-yellow-300 border border-red-500/40 shadow-sm"
                        : "text-red-400 hover:bg-red-600/10 hover:text-yellow-300 font-bold"
                      : isActive
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <span className="relative flex items-center gap-1">
                    {l.label}
                    {isActive && !l.special && (
                      <span className="absolute -bottom-[9px] left-0 right-0 h-[2px] bg-gradient-brand" />
                    )}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/nodbet"
              title="Ваш баланс в NODBET Арене"
              className="flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-red-500/10 px-3 py-1.5 text-xs font-mono font-bold text-yellow-400 transition-all hover:scale-105 hover:border-yellow-500/60"
            >
              <Flame size={14} className="fill-yellow-400 text-yellow-400" />
              <span>{balance.toLocaleString()} NOD</span>
            </Link>

            {user ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                <User size={15} className="text-fuchsia-400" />
                <span className="flex max-w-[150px] flex-col leading-tight">
                  <span className="truncate text-xs font-semibold text-zinc-100" title={`Никнейм: ${displayNickname}`}>
                    {displayNickname}
                    <span className="ml-1 text-[9px] text-yellow-400 font-bold" title="Ваш уровень NODBET">Lv.{level}</span>
                    {!hasCustomNickname && <span className="ml-1 text-[9px] text-zinc-500">(временный)</span>}
                  </span>
                  <span className="truncate text-[10px] text-zinc-500" title={user.email}>
                    {user.email}
                  </span>
                </span>
                <button
                  onClick={() => setNicknameModalOpen(true)}
                  title="Изменить никнейм (виден в Топе Хайроллеров)"
                  className="text-zinc-400 hover:text-yellow-300 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => signOut()}
                  title="Выйти"
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("signin");
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <LogIn size={15} /> Войти
              </button>
            )}
          </div>

          <button className="text-zinc-300 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Меню">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-white/5 px-4 py-3 lg:hidden">
            <Link
              to="/nodbet"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-red-500/10 px-3 py-2 text-xs font-mono font-bold text-yellow-400 mb-2"
            >
              <span className="flex items-center gap-1.5">
                <Flame size={14} className="fill-yellow-400 text-yellow-400" /> Баланс NODBET
              </span>
              <span>{balance.toLocaleString()} NOD →</span>
            </Link>

            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2.5 text-sm font-medium ${
                    l.special
                      ? isActive
                        ? "bg-red-600/20 text-yellow-300 font-bold"
                        : "text-red-400 font-bold"
                      : isActive
                      ? "bg-white/5 text-white"
                      : "text-zinc-400"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
              {user ? (
                <div className="flex items-center gap-2 text-xs text-zinc-300 truncate">
                  <User size={14} className="text-fuchsia-400 shrink-0" />
                  <span className="flex flex-col leading-tight truncate">
                    <span className="font-semibold text-zinc-100 truncate">
                      {displayNickname}
                      <span className="ml-1 text-[10px] text-yellow-400">Lv.{level}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate">{user.email}</span>
                  </span>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setNicknameModalOpen(true);
                    }}
                    title="Изменить никнейм"
                    className="text-zinc-400 hover:text-yellow-300 transition-colors shrink-0"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-zinc-500">Войдите для прогнозов</span>
              )}
              {user ? (
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1.5 rounded bg-white/10 px-3 py-1.5 text-xs text-white"
                >
                  <LogOut size={13} /> Выйти
                </button>
              ) : (
                <button
                  onClick={() => {
                    setOpen(false);
                    setAuthMode("signin");
                    setAuthModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <LogIn size={13} /> Войти
                </button>
              )}
            </div>
          </nav>
        )}
      </header>
      <AuthModal />
      <NicknameModal open={nicknameModalOpen} onClose={() => setNicknameModalOpen(false)} />
    </>
  );
}
