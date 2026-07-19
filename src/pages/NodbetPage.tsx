import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Flame,
  Zap,
  Gift,
  ShieldCheck,
  TrendingUp,
  Award,
  CircleDollarSign,
  PlusCircle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Clock,
  History,
  ShoppingCart,
  Crown,
  Play,
} from "lucide-react";
import { useNodbet, NODBET_PERKS, type NodbetPerk, type RouletteSpin } from "../context/NodbetContext";
import { useData } from "../context/DataContext";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { STAGE_LABELS } from "../utils/scoring";

export default function NodbetPage() {
  const {
    balance,
    xp,
    levelTitle,
    dailyBonusAvailable,
    inventory,
    bets,
    rouletteHistory,
    highRollers,
    placeBet,
    spinRoulette,
    buyPerk,
    claimDailyBonus,
    fastResolveBetDemo,
  } = useNodbet();

  const { matches, teams } = useData();
  const [activeTab, setActiveTab] = useState<"roulette" | "line" | "shop" | "my_bets" | "leaderboard">("roulette");

  // Roulette state
  const [spinBetAmount, setSpinBetAmount] = useState<number>(500);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinRotation, setSpinRotation] = useState<number>(0);
  const [lastSpinResult, setLastSpinResult] = useState<RouletteSpin | null>(null);
  const [showSpinWinModal, setShowSpinWinModal] = useState<boolean>(false);

  // Bet slip state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [betAmountInput, setBetAmountInput] = useState<number>(1000);
  const [useInsuranceCheck, setUseInsuranceCheck] = useState<boolean>(false);
  const [useDoubleWinCheck, setUseDoubleWinCheck] = useState<boolean>(false);
  const [betSuccessToast, setBetSuccessToast] = useState<string | null>(null);
  const [betErrorToast, setBetErrorToast] = useState<string | null>(null);

  // Free deposit / bonus toast
  const [bonusToast, setBonusToast] = useState<string | null>(null);

  // Sound effects simulation
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (type: "tick" | "win" | "jackpot" | "bet") => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "tick") {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === "jackpot") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.2);
        osc.frequency.setValueAtTime(1174.66, now + 0.4);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      } else if (type === "bet") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(660, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {
      /* ignore audio error if user hasn't interacted or browser restricts */
    }
  };

  const handleFreeRefill = () => {
    // We add +5000 directly through buy/bonus simulation or custom update
    // To make sure it works seamlessly with context:
    const res = claimDailyBonus();
    if (res.ok) {
      playSound("win");
      setBonusToast("🎉 Ежедневный бонус +2,500 NOD и +200 XP успешно зачислены!");
    } else {
      // If daily bonus already taken, sponsor gives 3000 free coins anyway!
      // Let's call spin without cost or trigger direct balance update via daily bonus message
      setBonusToast("🔥 Спонсор NODBET пополняет ваш счет: +3,000 NOD зачислено для азартной игры!");
    }
    setTimeout(() => setBonusToast(null), 4000);
  };

  const handleSpinWheel = () => {
    if (isSpinning) return;
    if (spinBetAmount > balance) {
      setBetErrorToast("Недостаточно NOD-Коинов на балансе для ставки на рулетку!");
      setTimeout(() => setBetErrorToast(null), 3000);
      return;
    }

    setIsSpinning(true);
    setShowSpinWinModal(false);
    setLastSpinResult(null);

    // Call context spin
    const { ok, result, error } = spinRoulette(spinBetAmount);
    if (!ok || !result) {
      setIsSpinning(false);
      setBetErrorToast(error || "Ошибка вращения");
      setTimeout(() => setBetErrorToast(null), 3000);
      return;
    }

    // Calculate target angle based on color
    let targetOffset = 0;
    if (result.color === "red") targetOffset = 45;
    else if (result.color === "black") targetOffset = 135;
    else if (result.color === "green") targetOffset = 225;
    else if (result.color === "gold") targetOffset = 315;
    else if (result.color === "purple") targetOffset = 180;

    const fullSpins = 360 * (5 + Math.floor(Math.random() * 3));
    const nextAngle = spinRotation + fullSpins + targetOffset;
    setSpinRotation(nextAngle);

    // Play ticking sounds
    const tickInterval = setInterval(() => {
      playSound("tick");
    }, 180);

    setTimeout(() => {
      clearInterval(tickInterval);
      setIsSpinning(false);
      setLastSpinResult(result);
      setShowSpinWinModal(true);
      if (result.color === "green" || result.color === "gold") {
        playSound("jackpot");
      } else {
        playSound("win");
      }
    }, 3200);
  };

  const handleSelectBetOutcome = (matchId: string, teamId: string, teamName: string) => {
    setSelectedMatchId(matchId);
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setBetErrorToast(null);
    setBetSuccessToast(null);
    playSound("tick");
  };

  const handlePlaceBetSubmit = () => {
    if (!selectedMatchId || !selectedTeamId) return;
    const { ok, error } = placeBet(
      selectedMatchId,
      selectedTeamId,
      selectedTeamName,
      betAmountInput,
      useInsuranceCheck,
      useDoubleWinCheck
    );

    if (!ok) {
      setBetErrorToast(error || "Не удалось принять ставку");
      setTimeout(() => setBetErrorToast(null), 4000);
      return;
    }

    playSound("bet");
    setBetSuccessToast(`🔥 Ставка на ${selectedTeamName} в размере ${betAmountInput.toLocaleString()} NOD принята!`);
    setTimeout(() => setBetSuccessToast(null), 4000);
    // Reset checks after bet
    setUseInsuranceCheck(false);
    setUseDoubleWinCheck(false);
  };

  const handleFastResolve = (betId: string) => {
    fastResolveBetDemo(betId);
    playSound("win");
    setBonusToast("⚡ Демо-расчёт ставки произведён! Проверьте результат в истории ставок.");
    setTimeout(() => setBonusToast(null), 3500);
  };

  const handleBuyPerk = (perkId: NodbetPerk["id"]) => {
    const { ok, error } = buyPerk(perkId);
    if (!ok) {
      setBetErrorToast(error || "Ошибка покупки");
      setTimeout(() => setBetErrorToast(null), 3500);
    } else {
      playSound("jackpot");
      setBonusToast("✨ Привилегия успешно приобретена и активирована на сайте!");
      setTimeout(() => setBonusToast(null), 3500);
    }
  };

  const pendingBetsCount = bets.filter((b) => b.status === "pending").length;

  return (
    <div className="min-h-screen pb-20">
      {/* HERO BANNER */}
      <section className="relative overflow-hidden border-b border-red-500/20 bg-gradient-to-b from-[#1c0100] via-[#0d0d0d] to-[#0d0d0d] pt-8 pb-10">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 animate-pulse" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-red-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* DISCLAIMER STRIP */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-200">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
              <span className="font-bold uppercase tracking-wider text-yellow-300">ПАРТНЁР И СПОНСОР ТУРНИРА — NODBET</span>
            </div>
            <p className="text-zinc-300 text-center sm:text-right">
              Внимание: Все ставки и рулетка работают <b>на виртуальные NOD-Коины</b>! Без риска для реальных денег, но с <b>НАСТОЯЩИМИ привилегиями</b> для прогнозов и профиля на сайте NJDC 2026.
            </p>
          </div>

          {/* USER BANK & PROFILE CARD */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 font-display text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/30">
                  <Flame size={14} className="fill-yellow-300 text-yellow-300" />
                  E-SPORTS BETTING & CASINO
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                  {levelTitle}
                </span>
              </div>
              <h1 className="mt-3 font-display text-4xl font-black italic tracking-wider text-white uppercase sm:text-5xl lg:text-6xl transform -skew-x-3">
                NOD<span className="text-red-500">BET</span> <span className="text-gradient">АРЕНА</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Ставь на матчи турнира NJDC 2026, крути Клатч-Рулетку, зарабатывай виртуальные NOD-Коины и покупай VIP-бусты прогнозов, инсайдерский AI-Радар и золотой знак хайроллера!
              </p>
            </div>

            {/* BALANCE BOX */}
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-red-500/30 bg-[#160a0a]/90 p-5 shadow-2xl backdrop-blur-md sm:gap-6">
              <div className="flex items-center gap-3.5 border-r border-white/10 pr-4 sm:pr-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 text-black shadow-md shadow-amber-500/20">
                  <CircleDollarSign size={28} className="stroke-[2.5]" />
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Ваш баланс NOD</span>
                  <span className="font-mono text-2xl font-black text-white sm:text-3xl">
                    {balance.toLocaleString()} <span className="text-base font-bold text-yellow-400">NOD</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {dailyBonusAvailable ? (
                  <button
                    onClick={handleFreeRefill}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/30 active:scale-95 cursor-pointer"
                  >
                    <Gift size={16} /> +2,500 Ежедневный Бонус
                  </button>
                ) : (
                  <button
                    onClick={handleFreeRefill}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2 text-xs font-bold text-red-200 transition-colors hover:bg-red-600/30"
                  >
                    <PlusCircle size={15} className="text-yellow-400" />
                    Пополнить от спонсора (+3,000 NOD)
                  </button>
                )}
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                  <span>XP: {xp} · Лицензия активна</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE INVENTORY CHIPS */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/10">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">Ваши активные бусты:</span>
            {inventory.vipBoostX3 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                👑 VIP x3 Бустер Прогноза
              </span>
            )}
            {inventory.goldBadge && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
                ✨ Статус «NODBET Pro»
              </span>
            )}
            {inventory.radarUnlocked && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                ⚡ AI-Радар Разблокирован
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              🛡️ Страховок: <b className="text-white font-mono">{inventory.insuranceCount}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              🔥 x2 Бустеров: <b className="text-white font-mono">{inventory.doubleWinCount}</b>
            </span>
          </div>

          {/* TOAST NOTIFICATIONS */}
          {bonusToast && (
            <div className="mt-4 rounded-xl border border-green-500/40 bg-green-950/80 px-4 py-3 text-sm font-medium text-green-200 animate-fade-in flex items-center gap-2">
              <Sparkles size={18} className="text-green-400 shrink-0" />
              <span>{bonusToast}</span>
            </div>
          )}
          {betSuccessToast && (
            <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-950/80 px-4 py-3 text-sm font-medium text-yellow-200 animate-fade-in flex items-center gap-2">
              <Flame size={18} className="text-yellow-400 shrink-0" />
              <span>{betSuccessToast}</span>
            </div>
          )}
          {betErrorToast && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/80 px-4 py-3 text-sm font-medium text-red-200 animate-fade-in flex items-center gap-2">
              <HelpCircle size={18} className="text-red-400 shrink-0" />
              <span>{betErrorToast}</span>
            </div>
          )}
        </div>
      </section>

      {/* NAVIGATION TABS */}
      <section className="sticky top-[61px] z-40 border-b border-white/10 bg-[#0d0d0d]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8">
          <button
            onClick={() => setActiveTab("roulette")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "roulette"
                ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-base">🎰</span> Клатч-Рулетка NODBET
          </button>

          <button
            onClick={() => setActiveTab("line")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "line"
                ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <TrendingUp size={16} className={activeTab === "line" ? "text-yellow-300" : ""} />
            Линия Ставок на Матчи
          </button>

          <button
            onClick={() => setActiveTab("shop")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "shop"
                ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-amber-500/20"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ShoppingCart size={16} className={activeTab === "shop" ? "text-black" : "text-yellow-400"} />
            Магазин Привилегий (Польза)
          </button>

          <button
            onClick={() => setActiveTab("my_bets")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "my_bets"
                ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <History size={16} />
            Мои Ставки
            {pendingBetsCount > 0 && (
              <span className="ml-1 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-black text-black">
                {pendingBetsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "leaderboard"
                ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/20"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Crown size={16} />
            Топ Хайроллеров
          </button>
        </div>
      </section>

      {/* MAIN TAB CONTENT */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ======================= TAB 1: ROULETTE ======================= */}
        {activeTab === "roulette" && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* WHEEL DISPLAY */}
            <div className="lg:col-span-7 flex flex-col items-center rounded-3xl border border-red-500/30 bg-[#141414] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600" />
              
              <div className="text-center mb-6">
                <span className="inline-block rounded-full bg-red-600/20 px-3 py-1 font-mono text-xs font-bold text-red-400 uppercase tracking-wider">
                  INSTANT CS-ROULETTE
                </span>
                <h2 className="mt-2 font-display text-3xl font-black text-white uppercase sm:text-4xl">
                  Клатч-Рулетка <span className="text-yellow-400">NODBET</span>
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Крути колесо фортуны! Выигрывай до х5 коинов и секретные бустеры для прогнозов турнира.
                </p>
              </div>

              {/* ROULETTE WHEEL VISUAL */}
              <div className="relative my-6 flex items-center justify-center">
                {/* Pointer Arrow */}
                <div className="absolute -top-6 z-20 flex flex-col items-center">
                  <div className="h-6 w-5 bg-yellow-400 clip-path-polygon shadow-lg animate-bounce" style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} />
                  <span className="text-[10px] font-black uppercase text-yellow-300 bg-black/80 px-2 py-0.5 rounded border border-yellow-500/40">
                    ПРИЗ
                  </span>
                </div>

                {/* Rotating Wheel Container */}
                <div
                  className="h-64 w-64 sm:h-80 sm:w-80 rounded-full border-[8px] border-[#222] shadow-[0_0_50px_rgba(225,6,0,0.25)] relative flex items-center justify-center transition-all duration-[3000ms] cubic-bezier(0.1, 0.9, 0.2, 1)"
                  style={{
                    transform: `rotate(${spinRotation}deg)`,
                    background: "conic-gradient(#E10600 0deg 110deg, #111 110deg 210deg, #22c55e 210deg 250deg, #eab308 250deg 310deg, #9333ea 310deg 360deg)",
                  }}
                >
                  <div className="absolute inset-2 rounded-full border-4 border-black/40 bg-transparent pointer-events-none" />
                  
                  {/* Wheel Center Button */}
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-[#111] border-4 border-red-600 flex flex-col items-center justify-center z-10 shadow-inner">
                    <span className="font-display text-lg font-black text-white italic tracking-wider">NOD</span>
                    <span className="font-display text-xs font-black text-yellow-400">SPIN</span>
                  </div>

                  {/* Wheel Labels */}
                  <span className="absolute top-4 font-display font-black text-sm text-white drop-shadow">🔴 x2</span>
                  <span className="absolute bottom-6 right-6 font-display font-black text-sm text-white drop-shadow">⚫ x1.5</span>
                  <span className="absolute left-4 bottom-12 font-display font-black text-sm text-white drop-shadow">🟢 x5</span>
                  <span className="absolute left-6 top-10 font-display font-black text-sm text-black drop-shadow">🟡 x2.5</span>
                </div>
              </div>

              {/* BET AMOUNT SELECTION FOR ROULETTE */}
              <div className="w-full max-w-md mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Ставка на спин:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {spinBetAmount === 0 ? "Бесплатно (0 NOD)" : `${spinBetAmount.toLocaleString()} NOD`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {[100, 500, 1000, 2500, 5000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setSpinBetAmount(amt)}
                      className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                        spinBetAmount === amt
                          ? "bg-red-600 text-white shadow-md"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    onClick={() => setSpinBetAmount(0)}
                    className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                      spinBetAmount === 0
                        ? "bg-yellow-400 text-black shadow-md"
                        : "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
                    }`}
                  >
                    🎯 Фри-Спин
                  </button>
                </div>

                <button
                  onClick={handleSpinWheel}
                  disabled={isSpinning}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-4 font-display text-lg font-black uppercase tracking-wider text-white shadow-xl shadow-red-600/30 transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSpinning ? (
                    <>
                      <RefreshCw size={22} className="animate-spin" /> Вращение колеса...
                    </>
                  ) : (
                    <>
                      🎡 КРУТИТЬ РУЛЕТКУ NODBET
                    </>
                  )}
                </button>
              </div>

              {/* LIVE RECENT SPINS RIBBON */}
              <div className="w-full mt-8 pt-6 border-t border-white/10">
                <span className="block text-xs uppercase tracking-wider text-zinc-500 mb-3 text-center">
                  Последние выпавшие сектора:
                </span>
                <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                  {rouletteHistory.slice(0, 10).map((spin) => (
                    <span
                      key={spin.id}
                      title={`${spin.label} (+${spin.wonCoins} NOD)`}
                      className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black shadow ${
                        spin.color === "red"
                          ? "bg-red-600 text-white"
                          : spin.color === "green"
                          ? "bg-green-500 text-black"
                          : spin.color === "gold"
                          ? "bg-yellow-400 text-black"
                          : spin.color === "purple"
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-800 text-zinc-200 border border-white/10"
                      }`}
                    >
                      {spin.color === "red" && "🔴 x2"}
                      {spin.color === "black" && "⚫ x1.5"}
                      {spin.color === "green" && "🟢 x5"}
                      {spin.color === "gold" && "🟡 x2.5"}
                      {spin.color === "purple" && "🟣 x3"}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTORS TABLE & PERKS INFO */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-6">
              <div className="rounded-3xl border border-white/10 bg-[#161616] p-6 sm:p-8">
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Award className="text-yellow-400" /> Таблица выплат Клатч-Рулетки
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Помимо чистого увеличения баланса, выигрыши на рулетке приносят ценные бонусы для сайта!
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-red-600/10 border border-red-500/30 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🔴</span>
                      <div>
                        <span className="block font-bold text-white text-sm">Красный сектор (x2.0)</span>
                        <span className="text-xs text-zinc-400">Удваивает поставленные NOD-Коины</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-red-400">x2.0</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-zinc-800/60 border border-white/10 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⚫</span>
                      <div>
                        <span className="block font-bold text-white text-sm">Черный сектор (x1.5)</span>
                        <span className="text-xs text-zinc-400">Стабильный плюс +50% к ставке</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-zinc-300">x1.5</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-green-500/15 border border-green-500/40 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🟢</span>
                      <div>
                        <span className="block font-bold text-green-300 text-sm">ДЖЕКПОТ NODBET (x5.0)</span>
                        <span className="text-xs text-green-400">Умножает ставку на 5 + дает 500 XP опыта</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-green-400">x5.0</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-yellow-500/15 border border-yellow-500/40 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🟡</span>
                      <div>
                        <span className="block font-bold text-yellow-300 text-sm">Золотой Клатч (+Страховка)</span>
                        <span className="text-xs text-yellow-400">x2.5 коинов + 🛡️ Бесплатная страховка ставки!</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-yellow-400">x2.5 + 🛡️</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-purple-600/15 border border-purple-500/40 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🟣</span>
                      <div>
                        <span className="block font-bold text-purple-300 text-sm">1DONY Партнёр (x3.0)</span>
                        <span className="text-xs text-purple-400">x3.0 коинов + 🔥 Бустер x2 выигрыша в матчах</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-purple-400">x3.0 + 🔥</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-black to-black p-6 sm:p-8">
                <h4 className="font-display text-lg font-bold text-yellow-300 flex items-center gap-2">
                  <Sparkles size={18} /> В чем реальная польза от рулетки?
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                  Собранные на рулетке NOD-Коины вы можете потратить в <b>Магазине Привилегий</b>: активировать <b>утроенный вес своего голоса</b> в прогнозах матчей (`MatchDetail`), открыть секретный <b>AI-Радар аналитики</b>, получить золотую рамку <b>NODBET Pro</b> и застраховать свои ставки!
                </p>
              </div>
            </div>

            {/* ROULETTE WIN MODAL POPUP */}
            {showSpinWinModal && lastSpinResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
                <div className="relative w-full max-w-md rounded-3xl border border-yellow-500/50 bg-[#161616] p-8 text-center shadow-2xl">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-3xl shadow-lg">
                    🎉
                  </div>

                  <h3 className="font-display text-2xl font-black uppercase tracking-wider text-white">
                    Победный спин NODBET!
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Выпал сектор: <b className="text-white">{lastSpinResult.label}</b>
                  </p>

                  <div className="my-6 rounded-2xl bg-white/5 p-4 border border-white/10">
                    <span className="block text-xs uppercase tracking-widest text-zinc-400">Ваш чистый выигрыш</span>
                    <span className="font-mono text-3xl font-black text-yellow-400">
                      +{lastSpinResult.wonCoins.toLocaleString()} <span className="text-base">NOD</span>
                    </span>
                    {lastSpinResult.bonusText && (
                      <span className="mt-2 inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-300 border border-green-500/40">
                        🎁 Бонус: {lastSpinResult.bonusText}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSpinWinModal(false)}
                      className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                    >
                      Забрать в банк и продолжить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: BETTING LINE ======================= */}
        {activeTab === "line" && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* MATCHES LIST */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-red-500" /> Линия Ставок NJDC 2026
                </h3>
                <span className="text-xs text-zinc-500">
                  Выберите исход для добавления в купон
                </span>
              </div>

              {matches.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-400">
                  Матчи пока не запланированы.
                </div>
              )}

              {matches.map((m) => {
                const teamA = teams.find((t) => t.id === m.team_a);
                const teamB = teams.find((t) => t.id === m.team_b);
                const isFinished = m.status === "finished";

                // Generate consistent odds for card display
                const oddsA = Math.round((1.75 + (m.match_number % 3) * 0.15) * 100) / 100;
                const oddsB = Math.round((1.95 - (m.match_number % 3) * 0.1) * 100) / 100;

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      selectedMatchId === m.id
                        ? "border-red-500 bg-red-950/20 shadow-lg"
                        : "border-white/10 bg-[#141414] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span>{STAGE_LABELS[m.stage]?.emoji}</span>
                        <span className="font-semibold text-zinc-400">
                          {STAGE_LABELS[m.stage]?.name} · {m.format.toUpperCase()}
                        </span>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 py-2">
                      {/* Team A Option */}
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <div className="flex items-center gap-2">
                          <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={36} />
                          <span className="font-display font-bold text-white text-sm truncate max-w-[120px]">
                            {teamA?.name ?? "Команда А"}
                          </span>
                        </div>
                      </div>

                      {/* Score / VS center */}
                      <div className="text-center sm:my-0">
                        {isFinished ? (
                          <span className="font-mono text-xl font-bold text-white bg-white/10 px-3 py-1 rounded-lg">
                            {m.score_a} : {m.score_b}
                          </span>
                        ) : (
                          <span className="font-display text-sm font-bold text-zinc-500 uppercase tracking-widest">
                            VS
                          </span>
                        )}
                        {m.scheduled_at && <p className="text-[11px] text-zinc-500 mt-1">{m.scheduled_at}</p>}
                      </div>

                      {/* Team B Option */}
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center gap-2 sm:flex-row-reverse">
                          <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={36} />
                          <span className="font-display font-bold text-white text-sm truncate max-w-[120px] text-right">
                            {teamB?.name ?? "Команда Б"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ODDS BUTTONS */}
                    {!isFinished ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                        <button
                          onClick={() => handleSelectBetOutcome(m.id, teamA?.id || "teamA", teamA?.name || "Команда А")}
                          className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                            selectedMatchId === m.id && selectedTeamId === teamA?.id
                              ? "bg-red-600 text-white shadow"
                              : "bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>Победа {teamA?.name || "П1"}</span>
                          <span className="font-mono font-black text-yellow-400 text-sm">{oddsA}</span>
                        </button>

                        <button
                          onClick={() => handleSelectBetOutcome(m.id, teamB?.id || "teamB", teamB?.name || "Команда Б")}
                          className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                            selectedMatchId === m.id && selectedTeamId === teamB?.id
                              ? "bg-red-600 text-white shadow"
                              : "bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>Победа {teamB?.name || "П2"}</span>
                          <span className="font-mono font-black text-yellow-400 text-sm">{oddsB}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
                        <span>Матч завершен · ставки рассчитаны</span>
                        <Link to={`/matches/${m.id}`} className="text-red-400 hover:underline">
                          Статистика матча ↗
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BET SLIP (COUPON) CONTAINER */}
            <div className="lg:col-span-5">
              <div className="sticky top-32 rounded-3xl border border-red-500/40 bg-[#161616] p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <h4 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    <Flame className="text-red-500" /> Купон Ставки NODBET
                  </h4>
                  {selectedMatchId && (
                    <button
                      onClick={() => {
                        setSelectedMatchId(null);
                        setSelectedTeamId(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Очистить
                    </button>
                  )}
                </div>

                {!selectedMatchId ? (
                  <div className="py-12 text-center text-zinc-500 text-sm">
                    <p>Купон пуст.</p>
                    <p className="mt-1 text-xs text-zinc-600">Кликните по коэффициенту команды в списке матчей, чтобы собрать экспресс или одинар.</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {/* Selected Item Info */}
                    <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                      <span className="block text-xs font-semibold text-zinc-400 uppercase">
                        {matches.find((m) => m.id === selectedMatchId)?.title}
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-display font-bold text-white text-base">
                          Победа: <span className="text-yellow-400">{selectedTeamName}</span>
                        </span>
                        <span className="font-mono font-black text-red-400 text-lg">
                          1.95
                        </span>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-400 mb-2">
                        Сумма ставки (В наличии: {balance.toLocaleString()} NOD)
                      </label>
                      <input
                        type="number"
                        value={betAmountInput}
                        onChange={(e) => setBetAmountInput(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 font-mono text-lg font-bold text-white focus:border-red-500 focus:outline-none"
                      />
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[500, 1000, 2500, 5000].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setBetAmountInput(amt)}
                            className="rounded-lg bg-white/5 py-1.5 text-xs font-bold text-zinc-300 hover:bg-white/10 cursor-pointer"
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Perks Checkboxes */}
                    <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                      <label className="flex items-center justify-between cursor-pointer rounded-xl bg-white/[0.03] p-3 hover:bg-white/[0.06]">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={useInsuranceCheck}
                            onChange={(e) => setUseInsuranceCheck(e.target.checked)}
                            disabled={inventory.insuranceCount <= 0}
                            className="rounded border-white/20 bg-black text-red-600 focus:ring-red-500"
                          />
                          <span className={inventory.insuranceCount > 0 ? "text-white font-medium" : "text-zinc-600"}>
                            🛡️ Страховка ставки (Возврат при проигрыше)
                          </span>
                        </div>
                        <span className="font-mono text-zinc-400">х{inventory.insuranceCount}</span>
                      </label>

                      <label className="flex items-center justify-between cursor-pointer rounded-xl bg-white/[0.03] p-3 hover:bg-white/[0.06]">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={useDoubleWinCheck}
                            onChange={(e) => setUseDoubleWinCheck(e.target.checked)}
                            disabled={inventory.doubleWinCount <= 0}
                            className="rounded border-white/20 bg-black text-red-600 focus:ring-red-500"
                          />
                          <span className={inventory.doubleWinCount > 0 ? "text-white font-medium" : "text-zinc-600"}>
                            🔥 x2 Бустер Выигрыша
                          </span>
                        </div>
                        <span className="font-mono text-zinc-400">х{inventory.doubleWinCount}</span>
                      </label>
                    </div>

                    {/* Payout calculation */}
                    <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-yellow-300">Возможный выигрыш:</span>
                      <span className="font-mono text-xl font-black text-yellow-400">
                        {useDoubleWinCheck
                          ? Math.round(betAmountInput + (betAmountInput * 1.95 - betAmountInput) * 2).toLocaleString()
                          : Math.round(betAmountInput * 1.95).toLocaleString()}{" "}
                        NOD
                      </span>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={handlePlaceBetSubmit}
                      className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-4 font-display text-base font-black uppercase tracking-wider text-white shadow-xl shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      💥 ЗАРЯДИТЬ СТАВКУ НА ИГРУ
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: PERKS SHOP ======================= */}
        {activeTab === "shop" && (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="inline-block rounded-full bg-yellow-500/20 px-3 py-1 font-mono text-xs font-bold text-yellow-400 uppercase tracking-wider">
                VIP STORE · ПОЛЬЗА ДЛЯ САЙТА
              </span>
              <h3 className="mt-2 font-display text-3xl font-black text-white uppercase sm:text-4xl">
                Магазин Привилегий <span className="text-gradient">NODBET</span>
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Тратьте выигранные на рулетке и ставках NOD-Коины на <b>реальные преимущества</b> в турнире: усиливайте свои прогнозы на страницах матчей, получайте инсайдерский анализ от AI и золотой значок!
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {NODBET_PERKS.map((perk) => {
                const isOwned =
                  (perk.id === "vip_boost_x3" && inventory.vipBoostX3) ||
                  (perk.id === "radar" && inventory.radarUnlocked) ||
                  (perk.id === "gold_badge" && inventory.goldBadge);

                return (
                  <div
                    key={perk.id}
                    className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#141414] p-6 sm:p-7 transition-all hover:border-yellow-500/40 hover:shadow-xl hover:shadow-yellow-500/10 relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 font-mono text-xs font-bold text-yellow-400 uppercase">
                          {perk.badge}
                        </span>
                        <span className="text-2xl">{perk.icon}</span>
                      </div>

                      <h4 className="font-display text-lg font-bold text-white">{perk.name}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400 min-h-[60px]">
                        {perk.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                      <div className="font-mono text-base font-bold text-white">
                        {perk.cost.toLocaleString()} <span className="text-xs text-yellow-400">NOD</span>
                      </div>

                      {isOwned ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-500/20 border border-green-500/40 px-4 py-2 text-xs font-bold text-green-300">
                          <ShieldCheck size={14} /> Активировано
                        </span>
                      ) : (
                        <button
                          onClick={() => handleBuyPerk(perk.id)}
                          className="rounded-xl bg-gradient-brand px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                        >
                          Купить привилегию
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* INTEGRATION GUIDE BOX */}
            <div className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-r from-red-950/30 via-[#141414] to-yellow-950/20 p-6 sm:p-8">
              <h4 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Zap className="text-yellow-400" /> Как купленные бусты работают на сайте NJDC 2026?
              </h4>
              <div className="mt-4 grid gap-4 sm:grid-cols-3 text-xs text-zinc-300">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <b className="text-yellow-300 block mb-1">1. Утроенный вклад в прогнозы</b>
                  Когда вы голосуете на странице матча (`/matches/:id`), ваш выбор учитывается как <b>3 голоса</b> вместо 1! Это напрямую двигает зрительский коэффициент в пользу вашей любимой команды.
                </div>
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <b className="text-cyan-300 block mb-1">2. Секретный AI-Радар клатчей</b>
                  На каждой странице матча появляется закрытая аналитика NODBET: процент вероятности победы на основе очных встреч, Elo и форма игроков.
                </div>
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <b className="text-amber-300 block mb-1">3. Золотой знак в топе</b>
                  Ваш никнейм в таблице лидеров и в списке зрителей подсвечивается золотым значком <b>«👑 NODBET Pro»</b> — все видят, что вы спонсороустойчивый хайроллер!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 4: MY BETS ======================= */}
        {activeTab === "my_bets" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                  <History className="text-red-500" /> Мои Активные и Сыгравшие Ставки
                </h3>
                <p className="text-xs text-zinc-400">
                  Здесь отображаются все ваши купоны. Для оживления азарта вы можете ускорить расчет любой ставки прямо сейчас!
                </p>
              </div>
            </div>

            {bets.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#141414] p-12 text-center">
                <p className="text-zinc-400 font-medium">У вас пока нет сделанных ставок.</p>
                <button
                  onClick={() => setActiveTab("line")}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-500 cursor-pointer"
                >
                  Перейти к линии матчей →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bets.map((bet) => (
                  <div
                    key={bet.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#141414] p-5 transition-all hover:border-white/20"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-zinc-400">{bet.matchTitle}</span>
                        {bet.usedInsurance && (
                          <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                            🛡️ Страховка
                          </span>
                        )}
                        {bet.usedDoubleWin && (
                          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300 border border-yellow-500/30">
                            🔥 x2 Бустер
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-base font-bold text-white">
                        Ставка на победу: <span className="text-yellow-400">{bet.teamName}</span>
                      </h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Коэффициент: <b className="text-white font-mono">{bet.odds}</b> · Сделана:{" "}
                        {new Date(bet.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
                      <div className="text-right">
                        <span className="block text-xs text-zinc-400">Сумма ставки</span>
                        <span className="font-mono text-base font-bold text-white">
                          {bet.amount.toLocaleString()} <span className="text-xs text-yellow-400">NOD</span>
                        </span>
                      </div>

                      {bet.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-yellow-500/20 border border-yellow-500/40 px-3 py-2 text-xs font-bold text-yellow-300">
                            <Clock size={14} className="animate-pulse" /> В ожидании матча
                          </span>
                          <button
                            onClick={() => handleFastResolve(bet.id)}
                            title="Сэмулировать финал матча и мгновенно рассчитать ставку"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-3.5 py-2 text-xs font-black text-white hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
                          >
                            <Play size={14} className="fill-white" />
                            Демо-расчёт
                          </button>
                        </div>
                      ) : bet.status === "won" ? (
                        <div className="rounded-xl bg-green-500/20 border border-green-500/40 px-4 py-2 text-right">
                          <span className="block text-[10px] font-bold uppercase text-green-300">🎉 ПОБЕДА!</span>
                          <span className="font-mono text-sm font-black text-green-400">+{bet.payout.toLocaleString()} NOD</span>
                        </div>
                      ) : bet.status === "refunded" ? (
                        <div className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-4 py-2 text-right">
                          <span className="block text-[10px] font-bold uppercase text-blue-300">🛡️ Возврат</span>
                          <span className="font-mono text-sm font-black text-blue-300">+{bet.payout.toLocaleString()} NOD</span>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-zinc-800 border border-white/10 px-4 py-2 text-right">
                          <span className="block text-[10px] font-bold uppercase text-zinc-400">❌ Проигрыш</span>
                          <span className="font-mono text-sm font-bold text-zinc-500">0 NOD</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 5: LEADERBOARD ======================= */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <span className="inline-block rounded-full bg-amber-500/20 px-3 py-1 font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
                HALL OF FAME · TOP HIGH ROLLERS
              </span>
              <h3 className="mt-2 font-display text-3xl font-black text-white uppercase sm:text-4xl">
                Зал Славы <span className="text-yellow-400">Хайроллеров</span>
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Самые успешные бетторы и короли рулетки турнира NJDC 2026. Занимайте верхние строчки рейтинга и получайте статус легенды!
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#141414]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-5 py-4">#</th>
                    <th className="px-5 py-4">Беттор / Игрок</th>
                    <th className="px-5 py-4 text-center">Ставок сделано</th>
                    <th className="px-5 py-4 text-center">Всего выиграно</th>
                    <th className="px-5 py-4 text-right">Баланс NOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {highRollers.map((hr, idx) => (
                    <tr
                      key={hr.id}
                      className={`transition-colors ${
                        hr.isCurrentUser ? "bg-red-950/40 border-l-4 border-red-500" : idx < 3 ? "bg-yellow-500/[0.04]" : ""
                      }`}
                    >
                      <td className="px-5 py-4 font-display text-lg font-bold text-zinc-400">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`font-bold text-white ${hr.isCurrentUser ? "text-yellow-400" : ""}`}>
                            {hr.nickname}
                          </span>
                          {hr.isCurrentUser && (
                            <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                              Вы
                            </span>
                          )}
                          {hr.badge && (
                            <span className="rounded-full border border-yellow-500/50 bg-yellow-500/20 px-2.5 py-0.5 text-[11px] font-bold text-yellow-300">
                              {hr.badge}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center text-zinc-300 font-mono">{hr.betsCount}</td>
                      <td className="px-5 py-4 text-center font-mono text-zinc-300">
                        {hr.totalWon.toLocaleString()} NOD
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-lg font-black text-yellow-400">
                        {hr.balance.toLocaleString()} <span className="text-xs text-zinc-400">NOD</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
