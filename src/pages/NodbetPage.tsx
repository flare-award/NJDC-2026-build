import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Flame,
  Gift,
  TrendingUp,
  Award,
  CircleDollarSign,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Clock,
  History,
  ShoppingCart,
  Crown,
  ShieldCheck,
} from "lucide-react";
import { useNodbet, NODBET_PERKS, buildWheelSectors, type NodbetPerk, type RouletteSpin } from "../context/NodbetContext";
import { useData } from "../context/DataContext";
import { BONUS_ORDER, BONUSES, wheelGradient } from "../utils/roulette";
import { maxMapCount } from "../utils/matchMaps";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { STAGE_LABELS } from "../utils/scoring";

// Варианты ставок на спин (пункт 18).
const SPIN_PRESETS = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const CUSTOM_MIN = 50000;
const CUSTOM_MAX = 500000;

export default function NodbetPage() {
  const {
    balance,
    xp,
    level,
    levelProgress,
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
    setCustomStatus,
    hasDoubleSpin,
  } = useNodbet();

  const { matches, teams } = useData();
  const [activeTab, setActiveTab] = useState<"roulette" | "line" | "shop" | "my_bets" | "leaderboard">("roulette");

  // Roulette state
  const [spinMode, setSpinMode] = useState<"preset" | "free" | "custom" | "all">("preset");
  const [spinBetAmount, setSpinBetAmount] = useState<number>(500);
  const [customSpin, setCustomSpin] = useState<number>(CUSTOM_MIN);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinRotation, setSpinRotation] = useState<number>(0);
  const [lastSpinResults, setLastSpinResults] = useState<RouletteSpin[] | null>(null);
  const [showSpinWinModal, setShowSpinWinModal] = useState<boolean>(false);

  // Bet slip state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMapIndex, setSelectedMapIndex] = useState<number>(0);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [betAmountInput, setBetAmountInput] = useState<number>(1000);
  const [overtimePick, setOvertimePick] = useState<boolean | null>(null);
  const [betSuccessToast, setBetSuccessToast] = useState<string | null>(null);
  const [betErrorToast, setBetErrorToast] = useState<string | null>(null);

  // Custom status input
  const [statusInput, setStatusInput] = useState<string>("");

  const [bonusToast, setBonusToast] = useState<string | null>(null);

  const wheelSectors = useMemo(() => buildWheelSectors(), []);
  const wheelBg = useMemo(() => wheelGradient(wheelSectors), [wheelSectors]);

  // Реальная сумма спина в зависимости от выбранного режима.
  const effectiveSpinAmount = useMemo(() => {
    if (spinMode === "free") return 0;
    if (spinMode === "all") return balance;
    if (spinMode === "custom") return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, customSpin || 0));
    return spinBetAmount;
  }, [spinMode, balance, customSpin, spinBetAmount]);

  // Sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = (type: "tick" | "win" | "jackpot" | "bet" | "lose") => {
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
      } else if (type === "lose") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.5);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
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
      /* ignore */
    }
  };

  const handleDailyBonus = () => {
    const res = claimDailyBonus();
    if (res.ok) {
      playSound("win");
      setBonusToast("🎉 Ежедневный бонус +2,500 NOD и +200 XP успешно зачислены!");
    } else {
      setBonusToast(res.error || "Ежедневный бонус уже получен сегодня.");
    }
    setTimeout(() => setBonusToast(null), 4000);
  };

  const handleSpinWheel = () => {
    if (isSpinning) return;
    const amount = effectiveSpinAmount;
    if (spinMode === "all" && balance <= 0) {
      setBetErrorToast("У вас нет коинов, чтобы поставить всё!");
      setTimeout(() => setBetErrorToast(null), 3000);
      return;
    }
    if (amount > balance) {
      setBetErrorToast("Недостаточно NOD-Коинов на балансе для этой ставки!");
      setTimeout(() => setBetErrorToast(null), 3000);
      return;
    }

    setIsSpinning(true);
    setShowSpinWinModal(false);
    setLastSpinResults(null);

    const { ok, results, error } = spinRoulette(amount);
    if (!ok || !results.length) {
      setIsSpinning(false);
      setBetErrorToast(error || "Ошибка вращения");
      setTimeout(() => setBetErrorToast(null), 3500);
      return;
    }

    // Колесо останавливается на секторе ПЕРВОГО результата (синхронизация, пункт 8).
    const first = results[0];
    const sector = wheelSectors.find((s) => s.id === first.bonusId);
    // Указатель сверху (0deg). Останавливаем середину сектора под указателем.
    const targetOffset = sector ? 360 - sector.midDeg : 0;
    const fullSpins = 360 * (5 + Math.floor(Math.random() * 3));
    const nextAngle = spinRotation + fullSpins + targetOffset;
    setSpinRotation(nextAngle);

    const tickInterval = setInterval(() => playSound("tick"), 180);

    setTimeout(() => {
      clearInterval(tickInterval);
      setIsSpinning(false);
      setLastSpinResults(results);
      setShowSpinWinModal(true);
      const anyNegative = results.some((r) => r.isNegative);
      const anyJackpot = results.some((r) => r.bonusId === "jackpot" || r.bonusId === "super");
      if (anyJackpot) playSound("jackpot");
      else if (anyNegative) playSound("lose");
      else playSound("win");
    }, 3200);
  };

  const handleSelectBetOutcome = (matchId: string, mapIndex: number, teamId: string, teamName: string) => {
    setSelectedMatchId(matchId);
    setSelectedMapIndex(mapIndex);
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setOvertimePick(null);
    setBetErrorToast(null);
    setBetSuccessToast(null);
    playSound("tick");
  };

  const handlePlaceBetSubmit = () => {
    if (!selectedMatchId || !selectedTeamId) return;
    if (overtimePick === null) {
      setBetErrorToast("Сделайте прогноз: будет ли овертайм на этой карте? Это обязательная часть ставки.");
      setTimeout(() => setBetErrorToast(null), 4000);
      return;
    }
    const { ok, error } = placeBet(selectedMatchId, selectedMapIndex, selectedTeamId, selectedTeamName, betAmountInput, overtimePick);
    if (!ok) {
      setBetErrorToast(error || "Не удалось принять ставку");
      setTimeout(() => setBetErrorToast(null), 4000);
      return;
    }
    playSound("bet");
    setBetSuccessToast(
      `🔥 Ставка на ${selectedTeamName} (Карта ${selectedMapIndex + 1}, ${betAmountInput.toLocaleString()} NOD, овертайм: ${overtimePick ? "будет" : "не будет"}) принята!`
    );
    setTimeout(() => setBetSuccessToast(null), 4000);
    setOvertimePick(null);
  };

  const handleBuyPerk = (perkId: NodbetPerk["id"]) => {
    const { ok, error } = buyPerk(perkId);
    if (!ok) {
      setBetErrorToast(error || "Ошибка покупки");
      setTimeout(() => setBetErrorToast(null), 3500);
    } else {
      playSound("jackpot");
      setBonusToast("✨ Привилегия успешно приобретена и активирована!");
      setTimeout(() => setBonusToast(null), 3500);
    }
  };

  const handleSaveStatus = () => {
    const res = setCustomStatus(statusInput);
    if (res.ok) {
      playSound("win");
      setBonusToast("🏷️ Ваш собственный статус сохранён и виден в Топе Хайроллеров!");
    } else {
      setBetErrorToast(res.error || "Ошибка");
      setTimeout(() => setBetErrorToast(null), 3500);
      return;
    }
    setTimeout(() => setBonusToast(null), 3500);
  };

  const pendingBetsCount = bets.filter((b) => b.status === "pending").length;

  // Возможный выигрыш выбранной ставки (для купона).
  const selectedMatch = matches.find((m) => m.id === selectedMatchId);
  const selectedOdds = useMemo(() => {
    if (!selectedMatch || !selectedTeamId) return 1.9;
    const oddsA = Math.round((1.75 + (selectedMatch.match_number % 3) * 0.13 + selectedMapIndex * 0.05) * 100) / 100;
    const oddsB = Math.round((2.05 - (selectedMatch.match_number % 3) * 0.11 + selectedMapIndex * 0.05) * 100) / 100;
    let o = 1.9;
    if (selectedTeamId === selectedMatch.team_a) o = oddsA;
    else if (selectedTeamId === selectedMatch.team_b) o = oddsB;
    return Math.round((o + 0.25) * 100) / 100;
  }, [selectedMatch, selectedTeamId, selectedMapIndex]);

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
              Внимание: Все ставки и рулетка работают <b>на виртуальные NOD-Коины</b> и не имеют ценности вне сайта. Играйте ради азарта — можно и выиграть, и проиграть!
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
                Ставь на матчи турнира NJDC 2026, крути честную Клатч-Рулетку, прокачивай уровень и поднимайся в Зал Славы Хайроллеров!
              </p>
            </div>

            {/* BALANCE BOX + XP/LEVEL (пункт 23) */}
            <div className="flex flex-col gap-4 rounded-2xl border border-red-500/30 bg-[#160a0a]/90 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3.5">
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

                {dailyBonusAvailable && (
                  <button
                    onClick={handleDailyBonus}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/30 active:scale-95 cursor-pointer"
                  >
                    <Gift size={16} /> +2,500 Ежедневный Бонус
                  </button>
                )}
              </div>

              {/* XP BAR + LEVEL (пункт 23) */}
              <div className="w-full min-w-[260px]">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-bold text-yellow-300">
                    <Crown size={12} /> Уровень {level}
                  </span>
                  <span className="font-mono text-zinc-400">
                    {levelProgress.isMax
                      ? "MAX (1000)"
                      : `${levelProgress.xpIntoLevel.toLocaleString()} / ${levelProgress.xpForNext.toLocaleString()} XP`}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/50 border border-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 transition-all duration-500"
                    style={{ width: `${levelProgress.pct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                  <span>Всего XP: {xp.toLocaleString()}{inventory.coinMagnet ? " · 🧲 +10% XP" : ""}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE INVENTORY CHIPS */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/10">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">Ваши привилегии:</span>
            {inventory.radarUnlocked && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                ⚡ AI-Радар
              </span>
            )}
            {inventory.doubleSpin && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                🎡 Дабл спин
              </span>
            )}
            {inventory.hallFrame && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                🖼️ Рамка Зала Славы
              </span>
            )}
            {inventory.customStatusOwned && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                🏷️ {inventory.customStatusText || "Свой статус"}
              </span>
            )}
            {inventory.coinMagnet && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                🧲 Мультипас Хайроллера
              </span>
            )}
            {!inventory.radarUnlocked && !inventory.doubleSpin && !inventory.hallFrame && !inventory.customStatusOwned && !inventory.coinMagnet && (
              <span className="text-xs text-zinc-600">Пока нет купленных привилегий — загляните в Магазин Привилегий.</span>
            )}
          </div>

          {/* TOASTS */}
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

      {/* NAV TABS */}
      <section className="sticky top-[61px] z-40 border-b border-white/10 bg-[#0d0d0d]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8">
          <button
            onClick={() => setActiveTab("roulette")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "roulette" ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-base">🎰</span> Клатч-Рулетка NODBET
          </button>
          <button
            onClick={() => setActiveTab("line")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "line" ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <TrendingUp size={16} className={activeTab === "line" ? "text-yellow-300" : ""} />
            Линия Ставок на Матчи
          </button>
          <button
            onClick={() => setActiveTab("shop")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "shop" ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-amber-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ShoppingCart size={16} className={activeTab === "shop" ? "text-black" : "text-yellow-400"} />
            Магазин Привилегий
          </button>
          <button
            onClick={() => setActiveTab("my_bets")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "my_bets" ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <History size={16} />
            Мои Ставки
            {pendingBetsCount > 0 && <span className="ml-1 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-black text-black">{pendingBetsCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "leaderboard" ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Crown size={16} />
            Топ Хайроллеров
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ======================= TAB 1: ROULETTE ======================= */}
        {activeTab === "roulette" && (
          <div className="grid gap-8 lg:grid-cols-12">
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
                  Честное колесо: можно и выиграть, и потерять. Чем выше ставка — тем крупнее и куш, и риск.
                  {hasDoubleSpin && <b className="text-purple-300"> Дабл спин активен — колесо крутится дважды!</b>}
                </p>
              </div>

              {/* WHEEL */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute -top-6 z-20 flex flex-col items-center">
                  <div className="h-6 w-5 bg-yellow-400 shadow-lg" style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} />
                  <span className="text-[10px] font-black uppercase text-yellow-300 bg-black/80 px-2 py-0.5 rounded border border-yellow-500/40">ПРИЗ</span>
                </div>
                <div
                  className="h-64 w-64 sm:h-80 sm:w-80 rounded-full border-[8px] border-[#222] shadow-[0_0_50px_rgba(225,6,0,0.25)] relative flex items-center justify-center"
                  style={{
                    transform: `rotate(${spinRotation}deg)`,
                    transition: "transform 3000ms cubic-bezier(0.15, 0.85, 0.2, 1)",
                    background: wheelBg,
                  }}
                >
                  <div className="absolute inset-2 rounded-full border-4 border-black/40 bg-transparent pointer-events-none" />
                  {/* Метки секторов, размещены по их средним углам (синхрон с шансами, пункт 8) */}
                  {wheelSectors.map((s) => {
                    // Радиус для подписи внутри колеса.
                    const rad = ((s.midDeg - 90) * Math.PI) / 180;
                    const r = 41; // % от центра
                    const left = 50 + r * Math.cos(rad);
                    const top = 50 + r * Math.sin(rad);
                    return (
                      <span
                        key={s.id}
                        className="absolute font-display text-[11px] sm:text-xs font-black drop-shadow"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          transform: `translate(-50%, -50%) rotate(${s.midDeg}deg)`,
                          color: s.def.textColor,
                        }}
                      >
                        {s.def.emoji}
                      </span>
                    );
                  })}
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-[#111] border-4 border-red-600 flex flex-col items-center justify-center z-10 shadow-inner">
                    <span className="font-display text-lg font-black text-white italic tracking-wider">NOD</span>
                    <span className="font-display text-xs font-black text-yellow-400">SPIN</span>
                  </div>
                </div>
              </div>

              {/* BET AMOUNT SELECTION (пункт 18) */}
              <div className="w-full max-w-md mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Ставка на спин:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {effectiveSpinAmount === 0 ? "Фри-спин (0 NOD)" : `${effectiveSpinAmount.toLocaleString()} NOD`}
                    {hasDoubleSpin && effectiveSpinAmount > 0 && <span className="text-purple-300"> ×2</span>}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {SPIN_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setSpinMode("preset");
                        setSpinBetAmount(amt);
                      }}
                      className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                        spinMode === "preset" && spinBetAmount === amt ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSpinMode("free")}
                    className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                      spinMode === "free" ? "bg-yellow-400 text-black shadow-md" : "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
                    }`}
                  >
                    🎯 Фри-Спин
                  </button>
                  <button
                    onClick={() => setSpinMode("custom")}
                    className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                      spinMode === "custom" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    ✏️ Своя ставка
                  </button>
                  <button
                    onClick={() => setSpinMode("all")}
                    className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                      spinMode === "all" ? "bg-gradient-to-r from-red-600 to-yellow-500 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    💰 Поставить всё
                  </button>
                </div>

                {spinMode === "custom" && (
                  <div>
                    <input
                      type="number"
                      value={customSpin}
                      min={CUSTOM_MIN}
                      max={CUSTOM_MAX}
                      onChange={(e) => setCustomSpin(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-2.5 font-mono text-sm font-bold text-white focus:border-red-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      От {CUSTOM_MIN.toLocaleString()} до {CUSTOM_MAX.toLocaleString()} NOD.
                      {(customSpin < CUSTOM_MIN || customSpin > CUSTOM_MAX) && <span className="text-red-400"> Будет округлено в допустимый диапазон.</span>}
                    </p>
                  </div>
                )}

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
                    <>🎡 КРУТИТЬ РУЛЕТКУ NODBET</>
                  )}
                </button>
              </div>

              {/* RECENT SPINS */}
              <div className="w-full mt-8 pt-6 border-t border-white/10">
                <span className="block text-xs uppercase tracking-wider text-zinc-500 mb-3 text-center">Последние выпавшие бонусы:</span>
                <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                  {rouletteHistory.length === 0 && <span className="text-xs text-zinc-600">Пока нет вращений — крутите колесо!</span>}
                  {rouletteHistory.slice(0, 12).map((spin) => (
                    <span
                      key={spin.id}
                      title={`${spin.label} (${spin.wonCoins >= 0 ? "+" : ""}${spin.wonCoins.toLocaleString()} NOD)`}
                      className="inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black shadow whitespace-nowrap"
                      style={{ background: BONUSES[spin.bonusId].color, color: BONUSES[spin.bonusId].textColor }}
                    >
                      {BONUSES[spin.bonusId].shortLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* PAYOUT TABLE (ordered worst→best, пункт 1) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-6">
              <div className="rounded-3xl border border-white/10 bg-[#161616] p-6 sm:p-8">
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Award className="text-yellow-400" /> Таблица выплат Клатч-Рулетки
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Бонусы расставлены от самого плохого к самому крутому. Все они зависят от суммы спина.
                </p>

                <div className="mt-5 space-y-2.5">
                  {BONUS_ORDER.map((id) => {
                    const b = BONUSES[id];
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between rounded-xl border p-3"
                        style={{ borderColor: b.color + "80", background: b.color + "22" }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{b.emoji}</span>
                          <div>
                            <span className="block font-bold text-white text-sm">{b.order}. {b.label}</span>
                            <span className="text-xs text-zinc-400">{b.description}</span>
                          </div>
                        </div>
                        <span className="font-mono font-black text-sm" style={{ color: b.textColor }}>
                          {b.isNegative ? `−${Math.round(Math.abs(b.multiplier) * 100)}%` : `x${b.multiplier}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-[11px] text-zinc-500">
                  🎯 Фри-спин даёт менее 15 коинов — накопить на крупную ставку с нуля будет непросто.
                </p>
              </div>
            </div>

            {/* SPIN RESULT MODAL */}
            {showSpinWinModal && lastSpinResults && lastSpinResults.length > 0 && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
                <div className="relative w-full max-w-md rounded-3xl border border-yellow-500/50 bg-[#161616] p-8 text-center shadow-2xl">
                  {(() => {
                    const totalDelta = lastSpinResults.reduce((s, r) => s + r.wonCoins, 0);
                    const positive = totalDelta >= 0;
                    return (
                      <>
                        <div
                          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl shadow-lg"
                          style={{ background: positive ? "linear-gradient(135deg,#fbbf24,#d97706)" : "linear-gradient(135deg,#7f1d1d,#450a0a)" }}
                        >
                          {positive ? "🎉" : "💀"}
                        </div>
                        <h3 className="font-display text-2xl font-black uppercase tracking-wider text-white">
                          {positive ? "Удачный спин!" : "Не повезло..."}
                        </h3>
                        <div className="my-5 space-y-2">
                          {lastSpinResults.map((r, i) => (
                            <div key={r.id} className="rounded-2xl bg-white/5 p-3 border border-white/10 flex items-center justify-between">
                              <span className="text-sm font-bold text-white">
                                {hasDoubleSpin ? `Спин ${i + 1}: ` : ""}{r.label}
                              </span>
                              <span className={`font-mono text-lg font-black ${r.wonCoins >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {r.wonCoins >= 0 ? "+" : ""}
                                {r.wonCoins.toLocaleString()} NOD
                              </span>
                            </div>
                          ))}
                          {lastSpinResults.length > 1 && (
                            <div className="rounded-2xl bg-yellow-500/10 p-3 border border-yellow-500/30 flex items-center justify-between">
                              <span className="text-sm font-bold text-yellow-300">Итого:</span>
                              <span className={`font-mono text-xl font-black ${totalDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {totalDelta >= 0 ? "+" : ""}
                                {totalDelta.toLocaleString()} NOD
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setShowSpinWinModal(false)}
                          className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                          Продолжить
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: BETTING LINE ======================= */}
        {activeTab === "line" && (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-red-500" /> Линия Ставок NJDC 2026
                </h3>
                <span className="text-xs text-zinc-500">Ставки принимаются только до начала матча</span>
              </div>

              {matches.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-zinc-400">Матчи пока не запланированы.</div>
              )}

              {matches.map((m) => {
                const teamA = teams.find((t) => t.id === m.team_a);
                const teamB = teams.find((t) => t.id === m.team_b);
                const isUpcoming = m.status === "upcoming";
                const totalMaps = maxMapCount(m.format);

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      selectedMatchId === m.id ? "border-red-500 bg-red-950/20 shadow-lg" : "border-white/10 bg-[#141414] hover:border-white/20"
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
                      <div className="flex items-center gap-2">
                        <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={36} />
                        <span className="font-display font-bold text-white text-sm truncate max-w-[120px]">{teamA?.name ?? "Команда А"}</span>
                      </div>
                      <div className="text-center">
                        {m.status !== "upcoming" ? (
                          <span className="font-mono text-xl font-bold text-white bg-white/10 px-3 py-1 rounded-lg">
                            {m.score_a} : {m.score_b}
                          </span>
                        ) : (
                          <span className="font-display text-sm font-bold text-zinc-500 uppercase tracking-widest">VS</span>
                        )}
                        {m.scheduled_at && <p className="text-[11px] text-zinc-500 mt-1">{m.scheduled_at}</p>}
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <div className="flex items-center gap-2 sm:flex-row-reverse">
                          <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={36} />
                          <span className="font-display font-bold text-white text-sm truncate max-w-[120px] text-right">{teamB?.name ?? "Команда Б"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Пункт 5: ставки только для upcoming. По каждой карте — своя линия (Bo2/Bo3). */}
                    {isUpcoming ? (
                      <div className="mt-4 space-y-3 pt-3 border-t border-white/5">
                        {Array.from({ length: totalMaps }).map((_, mapIdx) => {
                          const oddsA = Math.round((1.75 + (m.match_number % 3) * 0.13 + mapIdx * 0.05 + 0.25) * 100) / 100;
                          const oddsB = Math.round((2.05 - (m.match_number % 3) * 0.11 + mapIdx * 0.05 + 0.25) * 100) / 100;
                          const alreadyBet = bets.some((b) => b.matchId === m.id && b.mapIndex === mapIdx && b.status === "pending");
                          return (
                            <div key={mapIdx}>
                              {totalMaps > 1 && (
                                <div className="mb-1.5 flex items-center gap-2">
                                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                                    Карта {mapIdx + 1}
                                  </span>
                                  {alreadyBet && <span className="text-[10px] font-bold text-green-400">✓ ставка сделана</span>}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => handleSelectBetOutcome(m.id, mapIdx, teamA?.id || "teamA", teamA?.name || "Команда А")}
                                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                                    selectedMatchId === m.id && selectedMapIndex === mapIdx && selectedTeamId === teamA?.id
                                      ? "bg-red-600 text-white shadow"
                                      : "bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <span>Победа {teamA?.name || "П1"}</span>
                                  <span className="font-mono font-black text-yellow-400 text-sm">{oddsA}</span>
                                </button>
                                <button
                                  onClick={() => handleSelectBetOutcome(m.id, mapIdx, teamB?.id || "teamB", teamB?.name || "Команда Б")}
                                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                                    selectedMatchId === m.id && selectedMapIndex === mapIdx && selectedTeamId === teamB?.id
                                      ? "bg-red-600 text-white shadow"
                                      : "bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <span>Победа {teamB?.name || "П2"}</span>
                                  <span className="font-mono font-black text-yellow-400 text-sm">{oddsB}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {m.format === "bo3" && (
                          <p className="text-[11px] text-zinc-500">
                            В Bo3 третья карта играется только при счёте 1:1. Если она не состоится — ставка на неё вернётся.
                          </p>
                        )}
                      </div>
                    ) : m.status === "live" ? (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 text-green-400 font-bold">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400"></span>
                          Матч идёт (LIVE) — ставки закрыты
                        </span>
                        <Link to={`/matches/${m.id}`} className="text-red-400 hover:underline">Смотреть ↗</Link>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
                        <span>Матч завершён · ставки рассчитаны</span>
                        <Link to={`/matches/${m.id}`} className="text-red-400 hover:underline">Статистика матча ↗</Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BET SLIP */}
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
                        setOvertimePick(null);
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
                    <p className="mt-1 text-xs text-zinc-600">Выберите победителя в предстоящем матче, чтобы собрать ставку.</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                      <span className="block text-xs font-semibold text-zinc-400 uppercase">
                        {selectedMatch?.title}
                        {selectedMatch && maxMapCount(selectedMatch.format) > 1 && (
                          <span className="ml-1 text-yellow-400">· Карта {selectedMapIndex + 1}</span>
                        )}
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-display font-bold text-white text-base">
                          Победа: <span className="text-yellow-400">{selectedTeamName}</span>
                        </span>
                        <span className="font-mono font-black text-red-400 text-lg">{selectedOdds}</span>
                      </div>
                    </div>

                    {/* Пункт 6: обязательный прогноз овертайма */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-400 mb-2">
                        Будет ли овертайм на этой карте? <span className="text-red-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setOvertimePick(true)}
                          className={`rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${
                            overtimePick === true ? "bg-green-600 text-white shadow" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          ✅ Овертайм будет
                        </button>
                        <button
                          onClick={() => setOvertimePick(false)}
                          className={`rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${
                            overtimePick === false ? "bg-red-600 text-white shadow" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          ❌ Овертайма не будет
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        Овертайм = у команды больше 13 раундов (напр. 16:14). Если прогноз неверный — ставка сгорает целиком, даже при верной команде.
                      </p>
                    </div>

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
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-yellow-300">Возможный выигрыш:</span>
                      <span className="font-mono text-xl font-black text-yellow-400">
                        {Math.round(betAmountInput * selectedOdds).toLocaleString()} NOD
                      </span>
                    </div>

                    <button
                      onClick={handlePlaceBetSubmit}
                      className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-4 font-display text-base font-black uppercase tracking-wider text-white shadow-xl shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      💥 ЗАРЯДИТЬ СТАВКУ
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: SHOP ======================= */}
        {activeTab === "shop" && (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="inline-block rounded-full bg-yellow-500/20 px-3 py-1 font-mono text-xs font-bold text-yellow-400 uppercase tracking-wider">
                VIP STORE
              </span>
              <h3 className="mt-2 font-display text-3xl font-black text-white uppercase sm:text-4xl">
                Магазин Привилегий <span className="text-gradient">NODBET</span>
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Тратьте честно заработанные NOD-Коины на престижные и косметические привилегии. Никаких читов — только статус и удобство.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {NODBET_PERKS.map((perk) => {
                const isOwned =
                  (perk.id === "radar" && inventory.radarUnlocked) ||
                  (perk.id === "double_spin" && inventory.doubleSpin) ||
                  (perk.id === "hall_frame" && inventory.hallFrame) ||
                  (perk.id === "custom_status" && inventory.customStatusOwned) ||
                  (perk.id === "coin_magnet" && inventory.coinMagnet);

                return (
                  <div
                    key={perk.id}
                    className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#141414] p-6 sm:p-7 transition-all hover:border-yellow-500/40 hover:shadow-xl hover:shadow-yellow-500/10 relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 font-mono text-xs font-bold text-yellow-400 uppercase">{perk.badge}</span>
                        <span className="text-2xl">{perk.icon}</span>
                      </div>
                      <h4 className="font-display text-lg font-bold text-white">{perk.name}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400 min-h-[72px]">{perk.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                      <div className="font-mono text-sm font-bold text-white">
                        {perk.cost.toLocaleString()} <span className="text-xs text-yellow-400">NOD</span>
                      </div>
                      {isOwned ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-500/20 border border-green-500/40 px-4 py-2 text-xs font-bold text-green-300">
                          <ShieldCheck size={14} /> Активно
                        </span>
                      ) : (
                        <button
                          onClick={() => handleBuyPerk(perk.id)}
                          disabled={balance < perk.cost}
                          className="rounded-xl bg-gradient-brand px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Купить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Настройка собственного статуса (пункт 17) */}
            {inventory.customStatusOwned && (
              <div className="mt-6 rounded-3xl border border-yellow-500/30 bg-[#161616] p-6 sm:p-8">
                <h4 className="font-display text-lg font-bold text-yellow-300 flex items-center gap-2">🏷️ Ваш собственный статус</h4>
                <p className="mt-1 text-xs text-zinc-400">Придумайте текст статуса — он появится рядом с ником в Топе Хайроллеров (до 28 символов).</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <input
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    maxLength={28}
                    placeholder={inventory.customStatusText || "Например: 👑 Король Клатчей"}
                    className="flex-1 rounded-xl border border-white/15 bg-black/60 px-4 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveStatus}
                    className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 px-5 py-2.5 text-sm font-bold text-black hover:opacity-90 cursor-pointer"
                  >
                    Сохранить статус
                  </button>
                </div>
                {inventory.customStatusText && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Текущий статус: <b className="text-yellow-300">{inventory.customStatusText}</b>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 4: MY BETS ======================= */}
        {activeTab === "my_bets" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <History className="text-red-500" /> Мои Активные и Сыгравшие Ставки
              </h3>
              <p className="text-xs text-zinc-400">
                Ставки рассчитываются автоматически после завершения матча. Помните: неверный прогноз овертайма сжигает ставку целиком.
              </p>
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
                  <div key={bet.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#141414] p-5 transition-all hover:border-white/20">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-zinc-400">{bet.matchTitle} · Карта {bet.mapIndex + 1}</span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold border ${bet.overtimePrediction ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-zinc-700/40 text-zinc-300 border-white/10"}`}>
                          Овертайм: {bet.overtimePrediction ? "будет" : "не будет"}
                        </span>
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
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-yellow-500/20 border border-yellow-500/40 px-3 py-2 text-xs font-bold text-yellow-300">
                          <Clock size={14} className="animate-pulse" /> В ожидании матча
                        </span>
                      ) : bet.status === "won" ? (
                        <div className="rounded-xl bg-green-500/20 border border-green-500/40 px-4 py-2 text-right">
                          <span className="block text-[10px] font-bold uppercase text-green-300">🎉 ПОБЕДА!</span>
                          <span className="font-mono text-sm font-black text-green-400">+{bet.payout.toLocaleString()} NOD</span>
                        </div>
                      ) : bet.status === "refunded" ? (
                        <div className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-4 py-2 text-right">
                          <span className="block text-[10px] font-bold uppercase text-blue-300">↩️ Возврат (ничья)</span>
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
                Самые успешные бетторы и короли рулетки турнира NJDC 2026. Поднимайтесь по уровням и балансу!
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#141414]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-5 py-4">#</th>
                    <th className="px-5 py-4">Беттор / Игрок</th>
                    <th className="px-5 py-4 text-center">Уровень</th>
                    <th className="px-5 py-4 text-center">Ставок</th>
                    <th className="px-5 py-4 text-center">Всего выиграно</th>
                    <th className="px-5 py-4 text-right">Баланс NOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {highRollers.map((hr, idx) => (
                    <tr
                      key={hr.id}
                      className={`transition-colors ${
                        hr.isCurrentUser ? "bg-red-950/40 border-l-4 border-red-500" : hr.hallFrame ? "bg-amber-500/[0.06]" : idx < 3 ? "bg-yellow-500/[0.04]" : ""
                      }`}
                    >
                      <td className="px-5 py-4 font-display text-lg font-bold text-zinc-400">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`font-bold ${hr.hallFrame ? "text-amber-300 px-2 py-0.5 rounded-md ring-1 ring-amber-400/60 bg-amber-500/10" : "text-white"} ${hr.isCurrentUser ? "text-yellow-400" : ""}`}>
                            {hr.nickname}
                          </span>
                          {hr.isCurrentUser && <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">Вы</span>}
                          {hr.customStatus && (
                            <span className="rounded-full border border-yellow-500/50 bg-yellow-500/20 px-2.5 py-0.5 text-[11px] font-bold text-yellow-300">
                              {hr.customStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs font-bold text-yellow-300">
                          <Crown size={11} /> {hr.level}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-zinc-300 font-mono">{hr.betsCount}</td>
                      <td className="px-5 py-4 text-center font-mono text-zinc-300">{hr.totalWon.toLocaleString()} NOD</td>
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
