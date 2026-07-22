import { useState, useMemo, useEffect } from "react";
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
  Crown,
  ShieldCheck,
  X,
} from "lucide-react";
import { useNodbet, NODBET_PERKS, AURA_COLORS, type NodbetPerkId, type RouletteSpin } from "../context/NodbetContext";
import { useData } from "../context/DataContext";
import DoubleRouletteView from "../components/DoubleRouletteView";
import NodbetChat from "../components/NodbetChat";
import {
  BONUSES,
  ROULETTE_PRESETS,
  activeSectors,
  buildWheelSectors,
  wheelGradient,
  pickLandingRemainderDeg,
  type RouletteMode,
} from "../utils/roulette";
import { maxMapCount } from "../utils/matchMaps";
import TeamLogo from "../components/TeamLogo";
import StatusBadge from "../components/StatusBadge";
import { STAGE_LABELS } from "../utils/scoring";

const SPIN_PRESETS = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const CUSTOM_MIN = 50000;

export default function NodbetPage() {
  const {
    balance,
    xp,
    level,
    levelProgress,
    dailyBonusAvailable,
    inventory,
    bets,
    rouletteHistory,
    highRollers,
    placeBet,
    cancelBet,
    spinRoulette,
    commitSpin,
    buyPerk,
    claimDailyBonus,
    activatePromoCode,
    setCustomStatus,
    setDoubleSpinEnabled,
    setAuraColor,
    setAuraEnabled,
    hasDoubleSpin,
    doubleSpinEnabled,
    doubleSpinActive,
    maxCustomBet,
  } = useNodbet();

  const { matches, teams } = useData();
  const [activeTab, setActiveTab] = useState<"roulette" | "double_roulette" | "allornothing" | "line" | "shop" | "my_bets" | "leaderboard">("roulette");

  // Automatically switch to double roulette tab on mount/refresh if the player has an active lobby saved
  useEffect(() => {
    const savedLobbyId = localStorage.getItem("nodbet_active_lobby_id");
    if (savedLobbyId) {
      setActiveTab("double_roulette");
    }
  }, []);

  /** Активный режим рулетки определяется выбранной вкладкой. */
  const rouletteMode: RouletteMode = activeTab === "allornothing" ? "allornothing" : "classic";
  /** Дабл-спин работает только в классическом режиме. */
  const effectiveDoubleSpin = rouletteMode === "classic" && doubleSpinActive;

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

  // Leaderboard category
  const [leaderboardCategory, setLeaderboardCategory] = useState<"balance" | "totalWon" | "betsCount" | "level">("balance");

  // Promo code state (пункт 6)
  const [promoInput, setPromoInput] = useState<string>("");
  const [promoToast, setPromoToast] = useState<{ ok: boolean; text: string } | null>(null);

  // Daily bonus state
  const [bonusToast, setBonusToast] = useState<string | null>(null);

  const playSound = (kind: "spin" | "win" | "lose" | "jackpot" | "tick" | "bet") => {
    try {
      const urls: Record<string, string> = {
        tick: "https://actions.google.com/sounds/v1/ui/click.ogg",
        win: "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg",
        lose: "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg",
        jackpot: "https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg",
        bet: "https://actions.google.com/sounds/v1/ui/button_click.ogg",
        spin: "https://actions.google.com/sounds/v1/tools/ratchet_turn.ogg",
      };
      const url = urls[kind];
      if (!url) return;
      const a = new Audio(url);
      a.volume = 0.25;
      a.play().catch(() => {});
    } catch {
      /* no audio */
    }
  };

  const effectiveSpinAmount = useMemo(() => {
    if (spinMode === "free") return 0;
    if (spinMode === "all") return balance;
    if (spinMode === "custom") return Math.min(maxCustomBet, Math.max(CUSTOM_MIN, customSpin || 0));
    return spinBetAmount;
  }, [spinMode, balance, customSpin, spinBetAmount, maxCustomBet]);

  const wheelSectors = useMemo(() => buildWheelSectors(rouletteMode), [rouletteMode]);
  const wheelBg = useMemo(() => wheelGradient(wheelSectors), [wheelSectors]);
  const activeSectorIds = useMemo(() => activeSectors(rouletteMode), [rouletteMode]);

  const activeMatch = useMemo(() => matches.find((m) => m.id === selectedMatchId), [matches, selectedMatchId]);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const sa = a.status === "live" ? 0 : a.status === "upcoming" ? 1 : 2;
      const sb = b.status === "live" ? 0 : b.status === "upcoming" ? 1 : 2;
      if (sa !== sb) return sa - sb;
      return a.stage - b.stage || a.match_number - b.match_number;
    });
  }, [matches]);

  const pendingBets = useMemo(() => bets.filter((b) => b.status === "pending"), [bets]);
  const resolvedBets = useMemo(() => bets.filter((b) => b.status !== "pending"), [bets]);

  const sortedHighRollers = useMemo(() => {
    const sorted = [...highRollers];
    switch (leaderboardCategory) {
      case "totalWon":
        return sorted.sort((a, b) => b.totalWon - a.totalWon);
      case "betsCount":
        return sorted.sort((a, b) => b.betsCount - a.betsCount);
      case "level":
        return sorted.sort((a, b) => b.level - a.level);
      case "balance":
      default:
        return sorted.sort((a, b) => b.balance - a.balance);
    }
  }, [highRollers, leaderboardCategory]);

  const handleDailyBonus = async () => {
    const { ok, error, reward } = await claimDailyBonus();
    if (!ok) {
      setBetErrorToast(error || "Бонус пока недоступен");
      setTimeout(() => setBetErrorToast(null), 3000);
    } else {
      playSound("jackpot");
      setBonusToast(`🎁 Вы получили ежедневный бонус +${reward?.toLocaleString()} NOD!`);
      setTimeout(() => setBonusToast(null), 4000);
    }
  };

  const handleActivatePromo = async () => {
    if (!promoInput.trim()) return;
    const res = await activatePromoCode(promoInput);
    if (res.ok) {
      playSound("jackpot");
      setPromoToast({ ok: true, text: "🎉 Промокод NJDC-BONUS-2026 успешно активирован! Начислено +10,000 NOD-Коинов!" });
      setPromoInput("");
    } else {
      playSound("lose");
      setPromoToast({ ok: false, text: res.error || "Ошибка активации промокода" });
    }
    setTimeout(() => setPromoToast(null), 4500);
  };

  // Вращение рулетки с синхронизированной остановкой и отложенным балансом (пункты 2, 3, 8)
  // Обновление: исход определяет СЕРВЕР (RPC) до начала анимации, а колесо
  // останавливается в СЛУЧАЙНОЙ точке внутри выпавшего сектора — как
  // настоящее колесо фортуны, а не всегда ровно по центру.
  const handleSpinWheel = async () => {
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

    // Запрашиваем результат (в онлайн-режиме его уже записал сервер),
    // баланс на экране не меняется до окончания анимации (пункт 3)
    const { ok, results, error, balance: serverBalance, xp: serverXp } = await spinRoulette(amount, rouletteMode);
    if (!ok || !results.length) {
      setIsSpinning(false);
      setBetErrorToast(error || "Ошибка вращения");
      setTimeout(() => setBetErrorToast(null), 3500);
      return;
    }

    // Колесо останавливается на секторе ПЕРВОГО результата (синхронизация, пункт 2),
    // но стрелка указывает в случайное место ВНУТРИ сектора — остановленный
    // сектор под стрелкой всегда совпадает с реально выпавшим бонусом.
    const first = results[0];
    const sector = wheelSectors.find((s) => s.id === first.bonusId);
    const targetRem = sector ? pickLandingRemainderDeg(sector) : 0;
    const currentRem = spinRotation % 360;
    let diff = targetRem - currentRem;
    if (diff <= 0) diff += 360;
    const fullSpins = 360 * (5 + Math.floor(Math.random() * 3));
    const nextAngle = spinRotation + fullSpins + diff;
    setSpinRotation(nextAngle);

    const tickInterval = setInterval(() => playSound("tick"), 180);

    setTimeout(() => {
      clearInterval(tickInterval);
      // Вот ТОГДА и только тогда пополняется баланс, начисляется XP и обновляется история! (пункт 3)
      commitSpin(results, serverBalance !== undefined ? { balance: serverBalance, xp: serverXp ?? 0 } : undefined);
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

  const handlePlaceBetSubmit = async () => {
    if (!selectedMatchId || !selectedTeamId) return;
    if (overtimePick === null) {
      setBetErrorToast("Сделайте прогноз: будет ли овертайм на этой карте? Это обязательная часть ставки.");
      setTimeout(() => setBetErrorToast(null), 4000);
      return;
    }
    const { ok, error } = await placeBet(selectedMatchId, selectedMapIndex, selectedTeamId, selectedTeamName, betAmountInput, overtimePick);
    if (!ok) {
      setBetErrorToast(error || "Не удалось принять ставку");
      setTimeout(() => setBetErrorToast(null), 3500);
      return;
    }
    playSound("bet");
    setBetSuccessToast(
      `🔥 Ставка на ${selectedTeamName} (Карта ${selectedMapIndex + 1}, ${betAmountInput.toLocaleString()} NOD, овертайм: ${overtimePick ? "будет" : "не будет"}) принята!`
    );
    setTimeout(() => setBetSuccessToast(null), 4000);
    setOvertimePick(null);
  };

  const handleCancelBet = async (betId: string) => {
    const { ok, error, refund } = await cancelBet(betId);
    if (!ok) {
      setBetErrorToast(error || "Не удалось отменить ставку");
      setTimeout(() => setBetErrorToast(null), 3500);
      return;
    }
    playSound("bet");
    setBetSuccessToast(`↩️ Ставка отменена. Вам возвращено ${refund?.toLocaleString()} NOD на баланс.`);
    setTimeout(() => setBetSuccessToast(null), 4000);
  };

  const handleBuyPerk = async (perkId: NodbetPerkId) => {
    const { ok, error } = await buyPerk(perkId);
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
    const { ok, error } = setCustomStatus(statusInput);
    if (!ok) {
      setBetErrorToast(error || "Ошибка сохранения");
      setTimeout(() => setBetErrorToast(null), 3000);
    } else {
      setBonusToast("🏷️ Собственный статус сохранён! Он отображается в Топе Хайроллеров.");
      setTimeout(() => setBonusToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-24 text-white">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden border-b border-red-500/30 bg-gradient-to-r from-red-950/80 via-[#160a0a] to-[#120a16] pt-10 pb-12">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-red-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-yellow-400">
                <Flame size={14} className="animate-pulse" />
                Официальный спонсор NJDC 2026
              </div>
              <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-6xl font-black italic uppercase tracking-tight text-white leading-none">
                АРЕНА <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-400 to-amber-300">NODBET</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-zinc-300">
                Честная рулетка с реальными шансами, ставки по картам матчей (Bo2/Bo3), магазин без читов и Топ Хайроллеров. Зарабатывайте XP и поднимайтесь на вершину!
              </p>
            </div>

            {/* BALANCE BOX + XP/LEVEL + PROMO (пункты 6, 23) */}
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
                    <Gift size={16} /> +500 Ежедневный Бонус
                  </button>
                )}
              </div>

              {/* XP BAR + LEVEL */}
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

              {/* PROMO CODE INPUT (пункт 6) */}
              <div className="mt-1 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <Gift size={15} className="text-cyan-400 shrink-0" />
                  <span className="font-semibold">Промокод от спонсора:</span>
                </div>
                {inventory.promoUsed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/20 border border-green-500/40 px-3 py-1.5 text-xs font-bold text-green-300">
                    <ShieldCheck size={14} /> ✓ Активирован (NJDC-BONUS-2026)
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="NJDC-BONUS-2026"
                      className="w-40 sm:w-48 rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-mono font-bold text-white uppercase placeholder:text-zinc-600 focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      onClick={handleActivatePromo}
                      className="rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
                    >
                      Активировать
                    </button>
                  </div>
                )}
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
            {inventory.crownBadge && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/60 bg-yellow-500/20 px-3 py-1 text-xs font-black text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">
                👑 Корона Хайроллера
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
            {inventory.starTrail && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                ✨ Звёздный След
              </span>
            )}
            {inventory.titleScroll && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                📜 Титульный Свиток
              </span>
            )}
            {inventory.neonSignature && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-300">
                💫 Неоновая Подпись
              </span>
            )}
            {inventory.auraOwned && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
                🔮 Аура {inventory.auraEnabled ? "(ВКЛ)" : "(ВЫКЛ)"}
              </span>
            )}
            {inventory.multiBet && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-300">
                🎯 Мульти-Ставка (x2 лимит)
              </span>
            )}
            {!inventory.radarUnlocked && !inventory.doubleSpin && !inventory.hallFrame && !inventory.crownBadge && !inventory.customStatusOwned && !inventory.coinMagnet && !inventory.starTrail && !inventory.titleScroll && !inventory.neonSignature && !inventory.auraOwned && !inventory.multiBet && (
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
          {promoToast && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium animate-fade-in flex items-center gap-2 ${
              promoToast.ok ? "border-cyan-500/40 bg-cyan-950/80 text-cyan-200" : "border-red-500/40 bg-red-950/80 text-red-200"
            }`}>
              <Gift size={18} className="shrink-0" />
              <span>{promoToast.text}</span>
            </div>
          )}
          {betSuccessToast && (
            <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-950/80 px-4 py-3 text-sm font-medium text-yellow-200 animate-fade-in flex items-center gap-2">
              <Flame size={18} className="text-yellow-400 shrink-0" />
              <span>{betSuccessToast}</span>
            </div>
          )}
          {betErrorToast && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/80 px-4 py-3 text-sm font-medium text-red-200 animate-fade-in">
              <span>⚠️ {betErrorToast}</span>
            </div>
          )}
        </div>
      </div>

      {/* SUB-NAV TABS */}
      <div className="border-b border-white/10 bg-[#121212] sticky top-0 z-30 backdrop-blur-md bg-opacity-90">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto py-2 gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { key: "roulette", label: "🎰 Клатч-Рулетка", desc: "Честное колесо и фри-спин" },
                { key: "double_roulette", label: "⚔️ Двойная-Рулетка", desc: "Мультиплеер лобби (2-4 игрока)" },
                { key: "allornothing", label: "🎲 Всё или ничего", desc: "50% Джекпот · 50% Неудача" },
                { key: "line", label: "⚡ Линия ставок", desc: `Боевые линии · ${matches.length} игр` },
                { key: "shop", label: "👑 Магазин", desc: "Честные привилегии" },
                { key: "my_bets", label: "📜 Мои ставки", desc: `В игре: ${pendingBets.length}` },
                { key: "leaderboard", label: "🏆 Зал Славы", desc: "Топ Хайроллеров по балансу" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as typeof activeTab)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === t.key
                      ? "bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 text-white shadow-lg shadow-red-600/30 scale-102"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ======================= TAB: DOUBLE ROULETTE ======================= */}
        {activeTab === "double_roulette" && <DoubleRouletteView />}

        {/* ======================= TAB 1: ROULETTE (classic + allornothing) ======================= */}
        {(activeTab === "roulette" || activeTab === "allornothing") && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* CHAT — мини-окошко слева от колеса (на узких экранах — под ним) */}
            <div className="order-3 lg:order-3 lg:col-span-12 xl:order-1 xl:col-span-3">
              <NodbetChat />
            </div>

            {/* WHEEL CONTROLLER */}
            <div className="order-1 lg:order-1 lg:col-span-7 xl:order-2 xl:col-span-6 rounded-3xl border border-red-500/20 bg-[#141414] p-6 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-600 via-yellow-400 to-red-600" />

              <div className="text-center">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs font-bold text-yellow-400 uppercase tracking-widest">
                    {rouletteMode === "allornothing" ? "Всё или ничего · NODBET" : "Честная рулетка · NODBET v3"}
                  </span>
                  <button
                    onClick={() => setActiveTab("double_roulette")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-amber-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow hover:scale-105 transition-transform cursor-pointer"
                  >
                    ⚔️ Попробовать Двойную-Рулетку (Лобби) ↗
                  </button>
                </div>
                <h2 className="mt-3 font-display text-2xl sm:text-3xl font-black italic uppercase text-white tracking-tight">
                  {rouletteMode === "allornothing" ? (
                    <>Колесо <span className="text-yellow-400">Всё или ничего</span></>
                  ) : (
                    <>Колесо <span className="text-yellow-400">Клатч-Фортуны</span></>
                  )}
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  {rouletteMode === "allornothing" ? (
                    <>
                      Только два сектора: <b className="text-green-400">50% — Джекпот x5.0</b>, <b className="text-red-400">50% — Неудача (−100%)</b>. Ставка на кону целиком — либо x5, либо ноль.
                    </>
                  ) : (
                    <>
                      Честное колесо: можно и выиграть, и потерять. Чем выше ставка — тем крупнее и куш, и риск.
                      {doubleSpinActive && <b className="text-purple-300"> Дабл спин ВКЛ — колесо крутится дважды!</b>}
                      {hasDoubleSpin && !doubleSpinActive && <b className="text-zinc-500"> Дабл спин выключен (включите тумблер ниже).</b>}
                    </>
                  )}
                </p>

                {rouletteMode === "classic" && hasDoubleSpin && (
                  <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-purple-500/10 border border-purple-500/30 px-4 py-2.5">
                    <span className="text-xs font-bold text-purple-300">🎡 Дабл спин:</span>
                    <button
                      onClick={() => setDoubleSpinEnabled(!doubleSpinEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${doubleSpinEnabled ? "bg-purple-600" : "bg-zinc-700"}`}
                      title={doubleSpinEnabled ? "Выключить дабл спин" : "Включить дабл спин"}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${doubleSpinEnabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <span className={`text-xs font-black ${doubleSpinEnabled ? "text-purple-300" : "text-zinc-500"}`}>
                      {doubleSpinEnabled ? "ВКЛ (x2)" : "ВЫКЛ (x1)"}
                    </span>
                  </div>
                )}
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
                  {wheelSectors.map((s) => {
                    const rad = ((s.midDeg - 90) * Math.PI) / 180;
                    const r = 41;
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
                  <div className="h-16 w-16 rounded-full bg-[#1a1a1a] border-4 border-yellow-500 shadow-inner flex items-center justify-center z-10">
                    <span className="font-display text-sm font-black italic text-yellow-400">NOD</span>
                  </div>
                </div>
              </div>

              {/* BET SELECTOR */}
              <div className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <span>Выберите ставку на спин</span>
                  <span className="text-yellow-400 font-mono">
                    К списанию: {effectiveSpinAmount > 0 ? `${(effectiveSpinAmount * (effectiveDoubleSpin ? 2 : 1)).toLocaleString()} NOD` : "ФРИ-СПИН (0 NOD)"}
                    {effectiveDoubleSpin && effectiveSpinAmount > 0 ? " (x2 спина)" : ""}
                  </span>
                </div>

                {/* PRESETS */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {SPIN_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        setSpinMode("preset");
                        setSpinBetAmount(amt);
                      }}
                      disabled={isSpinning}
                      className={`rounded-xl py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
                        spinMode === "preset" && spinBetAmount === amt ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>

                {/* SPECIAL BUTTONS */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSpinMode("free")}
                    disabled={isSpinning}
                    className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      spinMode === "free" ? "bg-yellow-400 text-black shadow-md" : "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
                    }`}
                  >
                    <Gift size={14} /> ФРИ-СПИН (50 NOD)
                  </button>
                  <button
                    onClick={() => setSpinMode("custom")}
                    disabled={isSpinning}
                    className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      spinMode === "custom" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    <span>Своя (50k–{(maxCustomBet / 1000).toFixed(0)}k)</span>
                  </button>
                  <button
                    onClick={() => setSpinMode("all")}
                    disabled={isSpinning}
                    className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      spinMode === "all" ? "bg-gradient-to-r from-red-600 to-yellow-500 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    <Flame size={14} /> ПОСТАВИТЬ ВСЁ
                  </button>
                </div>

                {spinMode === "custom" && (
                  <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/10">
                    <span className="text-xs text-zinc-400 font-medium">Своя сумма (NOD):</span>
                    <input
                      type="number"
                      min={CUSTOM_MIN}
                      max={maxCustomBet}
                      step={10000}
                      value={customSpin}
                      onChange={(e) => setCustomSpin(Math.max(CUSTOM_MIN, Math.min(maxCustomBet, Number(e.target.value) || CUSTOM_MIN)))}
                      disabled={isSpinning}
                      className="flex-1 rounded-xl bg-white/10 px-3 py-1.5 font-mono text-sm font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-[11px] text-zinc-500">мин 50k / макс {(maxCustomBet / 1000).toFixed(0)}k</span>
                  </div>
                )}

                {/* SPIN BUTTON */}
                <button
                  onClick={handleSpinWheel}
                  disabled={isSpinning}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-4 text-base sm:text-lg font-black uppercase text-white shadow-xl shadow-red-600/30 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSpinning ? (
                    <>
                      <RefreshCw size={22} className="animate-spin" /> Вращение колеса...
                    </>
                  ) : (
                    <>
                      <span>🎰 ВРАЩАТЬ КОЛЕСО ФОРТУНЫ</span>
                    </>
                  )}
                </button>
              </div>

              {/* RECENT SPINS FEED */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">Последние выпадения на сервере:</span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                  {rouletteHistory.slice(0, 12).map((spin) => (
                    <span
                      key={spin.id}
                      title={`${spin.label} (${spin.wonCoins >= 0 ? "+" : ""}${spin.wonCoins.toLocaleString()} NOD)`}
                      className="shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold border border-white/15"
                      style={{ background: BONUSES[spin.bonusId]?.color || "#27272a", color: BONUSES[spin.bonusId]?.textColor || "#fff" }}
                    >
                      {BONUSES[spin.bonusId]?.shortLabel || spin.label}
                    </span>
                  ))}
                  {rouletteHistory.length === 0 && <span className="text-xs text-zinc-600 italic">Пока нет истории вращений...</span>}
                </div>
              </div>
            </div>

            {/* PAYTABLE & ODDS INFO */}
            <div className="order-2 lg:order-2 lg:col-span-5 xl:order-3 xl:col-span-3 space-y-6">
              <div className="rounded-3xl border border-white/10 bg-[#141414] p-6">
                <div className="flex items-center gap-2 text-yellow-400 mb-4">
                  <HelpCircle size={20} />
                  <h3 className="font-display text-lg font-bold text-white">Таблица выплат (Честные шансы)</h3>
                </div>
                <div className="space-y-2.5">
                  {activeSectorIds.map((id) => {
                    const b = BONUSES[id];
                    const weight = ROULETTE_PRESETS[rouletteMode].weights[id];
                    return (
                      <div key={b.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3.5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: b.color, color: b.textColor }}>
                            {b.emoji}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-white">{b.label}</p>
                            <p className="text-[11px] text-zinc-400">{b.description}</p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black px-2.5 py-1 rounded bg-black/50 border border-white/10 shrink-0 text-yellow-300">
                          {weight}% шанс
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-zinc-300 space-y-1">
                  <p className="font-bold text-yellow-400">
                    ⚖️ Как работает {rouletteMode === "allornothing" ? "«Всё или ничего»" : "честная рулетка"}:
                  </p>
                  {rouletteMode === "allornothing" ? (
                    <>
                      <p>1. Ровно 2 сектора по 50%: 🟢 ДЖЕКПОТ (x5.0) и ❌ Неудача (−100% ставки).</p>
                      <p>2. Пример на ставке 5000 NOD: 🟢 Джекпот → возврат 25 000 (прибыль +20 000); ❌ Неудача → теряете все 5000.</p>
                      <p>3. На фри-спине (0 NOD): Джекпот даёт 600 NOD, Неудача — 0.</p>
                    </>
                  ) : (
                    <>
                      <p>1. Шансы строго 5% 💀 / 10% 🟤 / 40% ⚫ / 20% 🔴 / 15% 🟣 / 10% 🟢 — как написано, без подкрутки. Размеры секторов колеса совпадают с шансами.</p>
                      <p>2. Пример на ставке 5000 NOD: ⚫ x1.25 → возврат 6250 (прибыль +1250), 🔴 x1.8 → 9000 (+4000), 🟣 x2.5 → 12500 (+7500), 🟢 x5.0 → 25000 (+20000).</p>
                      <p>3. 💀 забирает всю ставку, 🟤 — половину ставки. На фри-спине (0 NOD) даёт 50/100/250/600 без риска.</p>
                      <p>4. Дабл спин можно включать/выключать тумблером выше, если куплен в магазине.</p>
                    </>
                  )}
                  <p className="text-zinc-500 pt-1">Прибыль и списание применяются ТОЛЬКО после остановки колеса.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: LINE (MATCH BETS) ======================= */}
        {activeTab === "line" && (
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* MATCHES LIST */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-yellow-400" /> Боевые Линии Ставок ({sortedMatches.length})
                </h3>
                <span className="text-xs text-zinc-500">Коэффициенты рассчитываются честно из прогнозов зрителей</span>
              </div>

              <div className="space-y-4">
                {sortedMatches.map((m) => {
                  const teamA = teams.find((t) => t.id === m.team_a);
                  const teamB = teams.find((t) => t.id === m.team_b);
                  const isUpcoming = m.status === "upcoming";
                  const totalMaps = maxMapCount(m.format);

                  return (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-[#141414] p-5 transition-all hover:border-white/20">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{STAGE_LABELS[m.stage]?.emoji}</span>
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            {STAGE_LABELS[m.stage]?.name} · <b className="text-yellow-400">{m.format.toUpperCase()}</b>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.scheduled_at && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                              <Clock size={12} /> {m.scheduled_at}
                            </span>
                          )}
                          <StatusBadge status={m.status} />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 items-center gap-4">
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <TeamLogo src={teamA?.logo_url} alt={teamA?.name ?? "TBD"} size={44} />
                          <span className="font-display text-sm sm:text-base font-bold text-white">{teamA?.name || "TBD"}</span>
                        </div>
                        <div className="text-center font-display text-xl sm:text-2xl font-black text-zinc-500">VS</div>
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <TeamLogo src={teamB?.logo_url} alt={teamB?.name ?? "TBD"} size={44} />
                          <span className="font-display text-sm sm:text-base font-bold text-white">{teamB?.name || "TBD"}</span>
                        </div>
                      </div>

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
                          <span>Матч завершён</span>
                          <Link to={`/matches/${m.id}`} className="text-zinc-400 hover:underline">Итоговый счёт ↗</Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BET SLIP */}
            <div className="lg:col-span-4 sticky top-24">
              <div className="rounded-3xl border border-red-500/30 bg-[#141414] p-6 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4 text-yellow-400">
                  <Award size={22} />
                  <h3 className="font-display text-lg font-bold text-white">Купон Ставки</h3>
                </div>

                {!activeMatch || !selectedTeamId ? (
                  <div className="py-10 text-center text-zinc-500 space-y-2">
                    <HelpCircle size={32} className="mx-auto stroke-1" />
                    <p className="text-sm">Выберите исход в любой линии слева, чтобы сформировать купон ставки.</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-xl bg-white/5 p-4 border border-white/10 space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Матч</span>
                        <span className="font-mono text-yellow-400">
                          {maxMapCount(activeMatch.format) > 1 ? `Карта ${selectedMapIndex + 1}` : "Bo1"}
                        </span>
                      </div>
                      <p className="font-bold text-white text-sm">{activeMatch.title}</p>
                      <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-zinc-300">Победа: <b className="text-white">{selectedTeamName}</b></span>
                        <span className="font-mono text-sm font-black text-yellow-400">
                          x{(
                            selectedTeamId === activeMatch.team_a
                              ? Math.round((1.75 + (activeMatch.match_number % 3) * 0.13 + selectedMapIndex * 0.05 + 0.25) * 100) / 100
                              : Math.round((2.05 - (activeMatch.match_number % 3) * 0.11 + selectedMapIndex * 0.05 + 0.25) * 100) / 100
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* OVERTIME PREDICTION */}
                    <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-300">
                        <HelpCircle size={14} /> Обязательный прогноз: Овертайм на карте?
                      </div>
                      <p className="text-[11px] leading-snug text-zinc-300">
                        Овертайм засчитывается, только если счёт больше 12:12 (обе команды набрали 12+ раундов и игра ушла дальше). Регулярная победа 13:x (x ≤ 11) — без овертайма. При ошибке в прогнозе ставка сгорает.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => setOvertimePick(true)}
                          className={`rounded-xl py-2 text-xs font-bold border transition-all cursor-pointer ${
                            overtimePick === true ? "bg-yellow-400 text-black border-yellow-400 font-black shadow" : "bg-black/40 text-zinc-300 border-white/10 hover:border-white/30"
                          }`}
                        >
                          ⚡ Да (будет ОТ)
                        </button>
                        <button
                          onClick={() => setOvertimePick(false)}
                          className={`rounded-xl py-2 text-xs font-bold border transition-all cursor-pointer ${
                            overtimePick === false ? "bg-yellow-400 text-black border-yellow-400 font-black shadow" : "bg-black/40 text-zinc-300 border-white/10 hover:border-white/30"
                          }`}
                        >
                          🛡️ Нет (≤ 12:12)
                        </button>
                      </div>
                    </div>

                    {/* AMOUNT */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-zinc-400">
                        <span>Сумма ставки</span>
                        <span className="font-mono text-yellow-400">Баланс: {balance.toLocaleString()} NOD</span>
                      </div>
                      <input
                        type="number"
                        min={100}
                        max={balance}
                        step={100}
                        value={betAmountInput}
                        onChange={(e) => setBetAmountInput(Number(e.target.value) || 0)}
                        className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 font-mono text-base font-bold text-white focus:border-red-500 focus:outline-none"
                      />
                      <div className="grid grid-cols-4 gap-1.5">
                        {[500, 1000, 5000, 10000].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setBetAmountInput(amt)}
                            className="rounded-lg bg-white/5 py-1.5 text-[11px] font-mono text-zinc-300 hover:bg-white/10"
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                      onClick={handlePlaceBetSubmit}
                      disabled={balance < betAmountInput || betAmountInput <= 0}
                      className="w-full rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-3.5 text-sm font-black uppercase text-white shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ✓ ЗАКЛЮЧИТЬ ПАРИ
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: SHOP (CHEATS REMOVED, пункты 9, 17) ======================= */}
        {activeTab === "shop" && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-bold text-yellow-400 uppercase tracking-widest">
                Престижный Магазин NODBET
              </span>
              <h3 className="mt-2 font-display text-3xl font-black uppercase italic text-white">
                Элитные привилегии <span className="text-yellow-400">Хайроллера</span>
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-zinc-400">
                Тратьте честно заработанные NOD-Коины на престижные и косметические привилегии. Никаких читов — только статус и удобство.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {NODBET_PERKS.map((perk) => {
                const isOwned =
                  (perk.id === "radar" && inventory.radarUnlocked) ||
                  (perk.id === "double_spin" && inventory.doubleSpin) ||
                  (perk.id === "hall_frame" && inventory.hallFrame) ||
                  (perk.id === "crown_badge" && inventory.crownBadge) ||
                  (perk.id === "custom_status" && inventory.customStatusOwned) ||
                  (perk.id === "coin_magnet" && inventory.coinMagnet) ||
                  (perk.id === "star_trail" && inventory.starTrail) ||
                  (perk.id === "title_scroll" && inventory.titleScroll) ||
                  (perk.id === "neon_signature" && inventory.neonSignature) ||
                  (perk.id === "aura" && inventory.auraOwned) ||
                  (perk.id === "multi_bet" && inventory.multiBet);

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
                  <p className="mt-3 text-xs text-green-400 font-medium">✓ Текущий статус: «{inventory.customStatusText}»</p>
                )}
              </div>
            )}

            {/* AURA SETTINGS PANEL */}
            {inventory.auraOwned && (
              <div className="mt-6 rounded-3xl border border-violet-500/30 bg-[#161616] p-6 sm:p-8">
                <h4 className="font-display text-lg font-bold text-violet-300 flex items-center gap-2">🔮 Настройка Ауры</h4>
                <p className="mt-1 text-xs text-zinc-400">Настройте цвет и отображение анимированной ауры вокруг вашего никнейма в Зале Славы.</p>

                {/* ON/OFF TOGGLE */}
                <div className="mt-5 flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                  <div>
                    <p className="text-sm font-bold text-white">Отображение ауры</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{inventory.auraEnabled ? "Аура видна всем в Зале Славы" : "Аура скрыта — никто не видит её"}</p>
                  </div>
                  <button
                    onClick={() => setAuraEnabled(!inventory.auraEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${inventory.auraEnabled ? "bg-violet-600" : "bg-zinc-700"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${inventory.auraEnabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* COLOR PALETTE */}
                <div className="mt-5">
                  <p className="text-sm font-bold text-white mb-3">Цвет ауры:</p>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {AURA_COLORS.map((ac) => (
                      <button
                        key={ac.id}
                        onClick={() => setAuraColor(ac.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-all cursor-pointer border-2 ${
                          inventory.auraColor === ac.id
                            ? "border-white bg-white/10 scale-105 shadow-lg"
                            : "border-transparent bg-white/5 hover:bg-white/10 hover:border-white/20"
                        }`}
                      >
                        <span
                          className="h-8 w-8 rounded-full shadow-lg"
                          style={{
                            backgroundColor: ac.color,
                            boxShadow: `0 0 12px ${ac.glow}`,
                          }}
                        />
                        <span className="text-[10px] font-bold text-zinc-300">{ac.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PREVIEW */}
                <div className="mt-5 rounded-xl bg-black/40 border border-white/10 p-4">
                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Предпросмотр:</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-white px-2 py-1 rounded ${inventory.auraEnabled ? "aura-nickname" : ""}`}
                      style={
                        inventory.auraEnabled
                          ? {
                              ["--aura-color" as any]: AURA_COLORS.find((c) => c.id === inventory.auraColor)?.color || "#ef4444",
                              ["--aura-glow" as any]: AURA_COLORS.find((c) => c.id === inventory.auraColor)?.glow || "rgba(239,68,68,0.6)",
                            }
                          : {}
                      }
                    >
                      Ваш никнейм
                    </span>
                    {!inventory.auraEnabled && <span className="text-[11px] text-zinc-500 italic">(аура выключена)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 4: MY BETS ======================= */}
        {activeTab === "my_bets" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <History className="text-yellow-400" /> История и активные ставки
              </h3>
              <span className="text-xs text-zinc-400">Всего пари: {bets.length}</span>
            </div>

            {bets.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#141414] py-16 text-center text-zinc-500">
                <History size={40} className="mx-auto mb-3 stroke-1 text-zinc-600" />
                <p className="text-base font-semibold text-zinc-300">Вы ещё не заключали пари в Арене NODBET</p>
                <p className="mt-1 text-xs text-zinc-500">Перейдите на вкладку «⚡ Линия ставок» и выберите матч для прогноза.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingBets.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-yellow-400 mb-3 flex items-center gap-1.5">
                      <Clock size={14} /> В игре ({pendingBets.length})
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {pendingBets.map((b) => {
                        const matchStatus = matches.find((m) => m.id === b.matchId)?.status;
                        const canCancel = matchStatus === "upcoming";
                        return (
                          <div key={b.id} className="rounded-xl border border-yellow-500/30 bg-[#161414] p-4 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                                <span>{b.matchTitle}</span>
                                <span className="font-mono text-yellow-400">Карта {b.mapIndex + 1}</span>
                              </div>
                              <div className="font-bold text-white text-sm">
                                Прогноз: <span className="text-yellow-400">{b.teamName}</span> (x{b.odds.toFixed(2)})
                              </div>
                              <div className="mt-1 text-[11px] text-zinc-400">
                                Овертайм: <b className={b.overtimePrediction ? "text-yellow-300" : "text-zinc-300"}>{b.overtimePrediction ? "⚡ Будет (>12:12)" : "🛡️ Нет (≤ 12:12)"}</b>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center font-mono text-xs">
                              <span className="text-zinc-400">Ставка: {b.amount.toLocaleString()} NOD</span>
                              <span className="text-green-400 font-bold">Выплата: {Math.round(b.amount * b.odds).toLocaleString()} NOD</span>
                            </div>
                            {canCancel ? (
                              <button
                                onClick={() => handleCancelBet(b.id)}
                                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                                title="Отменить ставку (матч ещё не начался)"
                              >
                                <X size={13} /> Отменить ставку · вернуть {b.amount.toLocaleString()} NOD
                              </button>
                            ) : (
                              <p className="mt-3 text-[11px] text-zinc-600">Отмена недоступна: матч уже идёт или завершён.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {resolvedBets.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Рассчитанные пари ({resolvedBets.length})</h4>
                    <div className="space-y-2">
                      {resolvedBets.map((b) => (
                        <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-white/10 bg-[#141414] p-3.5 gap-2 text-xs">
                          <div>
                            <span className="font-bold text-white">{b.matchTitle}</span>
                            <span className="text-zinc-400 ml-2">({b.teamName}, Карта {b.mapIndex + 1}, x{b.odds.toFixed(2)})</span>
                            <span className="text-[11px] text-zinc-500 block mt-0.5">Овертайм прогноз: {b.overtimePrediction ? "Да" : "Нет"}</span>
                          </div>
                          <div className="flex items-center gap-4 sm:justify-end font-mono">
                            <span className="text-zinc-400">{b.amount.toLocaleString()} NOD</span>
                            {b.status === "won" && <span className="text-green-400 font-bold">+{b.payout.toLocaleString()} NOD ✓</span>}
                            {b.status === "lost" && <span className="text-red-400 font-bold">−{b.amount.toLocaleString()} NOD ✕</span>}
                            {b.status === "refunded" && <span className="text-yellow-400 font-bold">Возврат ({b.amount.toLocaleString()} NOD)</span>}
                            {b.status === "cancelled" && <span className="text-zinc-400 font-bold">Отменена · возврат {b.amount.toLocaleString()} NOD</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 5: LEADERBOARD ======================= */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Crown className="text-yellow-400" /> Зал Славы Хайроллеров
                </h3>
                <p className="text-xs text-zinc-400">Топ игроков NODBET — выберите категорию для просмотра.</p>
              </div>
            </div>

            {/* CATEGORY TABS */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: "balance" as const, label: "💰 Баланс NOD", desc: "Топ по балансу монет" },
                { key: "totalWon" as const, label: "🏆 Всего выиграно", desc: "Топ по общему выигрышу" },
                { key: "betsCount" as const, label: "📊 Ставок", desc: "Топ по количеству ставок" },
                { key: "level" as const, label: "⭐ Уровень", desc: "Топ по уровню XP" },
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setLeaderboardCategory(cat.key)}
                  className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    leaderboardCategory === cat.key
                      ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/20"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
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
                  {sortedHighRollers.map((hr, idx) => {
                    const auraColorDef = hr.auraOwned && hr.auraEnabled && hr.auraColor
                      ? AURA_COLORS.find((c) => c.id === hr.auraColor)
                      : null;

                    return (
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
                          <div className="flex flex-col gap-1">
                            {/* TITLE SCROLL - above everything */}
                            {hr.titleScroll && (
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 opacity-90">
                                ★ Легенда NODBET ★
                              </span>
                            )}
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* AURA WRAPPER — above Hall Frame, wraps the nickname */}
                              {auraColorDef ? (
                                <span
                                  className="aura-nickname relative inline-flex items-center gap-2.5"
                                  style={{
                                    ["--aura-color" as any]: auraColorDef.color,
                                    ["--aura-glow" as any]: auraColorDef.glow,
                                  }}
                                >
                                  {hr.crownBadge && (
                                    <span className="text-base relative z-10" title="👑 Корона Хайроллера">
                                      👑
                                    </span>
                                  )}
                                  <span className={`relative z-10 font-bold ${hr.hallFrame ? "text-amber-300 px-2 py-0.5 rounded-md ring-1 ring-amber-400/60 bg-amber-500/10" : "text-white"} ${hr.crownBadge ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)] font-black" : ""} ${hr.isCurrentUser ? "text-yellow-400" : ""}`}>
                                    {hr.nickname}
                                  </span>
                                  {/* Star trail particles */}
                                  {hr.starTrail && (
                                    <span className="star-trail-container absolute inset-0 pointer-events-none">
                                      <span className="star-particle" style={{ top: "10%", left: "5%", animationDelay: "0s" }}>✦</span>
                                      <span className="star-particle" style={{ top: "60%", left: "90%", animationDelay: "0.5s" }}>✧</span>
                                      <span className="star-particle" style={{ top: "20%", left: "70%", animationDelay: "1s" }}>✦</span>
                                      <span className="star-particle" style={{ top: "80%", left: "30%", animationDelay: "1.5s" }}>✧</span>
                                      <span className="star-particle" style={{ top: "40%", left: "50%", animationDelay: "0.3s" }}>⭑</span>
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <>
                                  {hr.crownBadge && (
                                    <span className="text-base" title="👑 Корона Хайроллера">
                                      👑
                                    </span>
                                  )}
                                  <span className={`font-bold ${hr.hallFrame ? "text-amber-300 px-2 py-0.5 rounded-md ring-1 ring-amber-400/60 bg-amber-500/10" : "text-white"} ${hr.crownBadge ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)] font-black" : ""} ${hr.isCurrentUser ? "text-yellow-400" : ""}`}>
                                    {hr.nickname}
                                  </span>
                                  {/* Star trail without aura */}
                                  {hr.starTrail && (
                                    <span className="star-trail-container relative inline-block ml-1 pointer-events-none">
                                      <span className="star-particle" style={{ top: "-30%", left: "0%", animationDelay: "0s" }}>✦</span>
                                      <span className="star-particle" style={{ top: "20%", left: "60%", animationDelay: "0.5s" }}>✧</span>
                                      <span className="star-particle" style={{ top: "-20%", left: "40%", animationDelay: "1s" }}>⭑</span>
                                    </span>
                                  )}
                                </>
                              )}

                              {hr.isCurrentUser && <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">Вы</span>}
                              {hr.customStatus && (
                                <span className="rounded-full border border-yellow-500/50 bg-yellow-500/20 px-2.5 py-0.5 text-[11px] font-bold text-yellow-300">
                                  {hr.customStatus}
                                </span>
                              )}
                            </div>
                            {/* NEON SIGNATURE — below the nickname row */}
                            {hr.neonSignature && (
                              <span className="neon-signature text-[9px] font-bold tracking-widest uppercase" style={{ color: "#e879f9" }}>
                                ✧ NODBET PLAYER ✧
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                            leaderboardCategory === "level" ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-400/40" : "bg-white/5 text-yellow-300"
                          }`}>
                            <Crown size={11} /> {hr.level}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`font-mono ${leaderboardCategory === "betsCount" ? "text-yellow-300 font-bold" : "text-zinc-300"}`}>
                            {hr.betsCount}
                          </span>
                        </td>
                        <td className={`px-5 py-4 text-center font-mono ${leaderboardCategory === "totalWon" ? "text-yellow-300 font-bold text-base" : "text-zinc-300"}`}>
                          {hr.totalWon.toLocaleString()} NOD
                        </td>
                        <td className={`px-5 py-4 text-right font-mono ${leaderboardCategory === "balance" ? "text-lg font-black text-yellow-400" : "text-base font-bold text-yellow-400"}`}>
                          {hr.balance.toLocaleString()} <span className="text-xs text-zinc-400">NOD</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SPIN WIN MODAL */}
      {showSpinWinModal && lastSpinResults && lastSpinResults.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-red-500/40 bg-[#161212] p-6 sm:p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-black text-3xl shadow-lg mb-4">
              {lastSpinResults.some((r) => r.isNegative) ? "💀" : lastSpinResults.some((r) => r.bonusId === "jackpot") ? "🟢" : "🎰"}
            </div>

            <h3 className="font-display text-2xl font-black italic uppercase text-white">
              {lastSpinResults.length > 1 ? "Результат Дабл Спина!" : "Спин завершён!"}
            </h3>

            <div className="mt-4 space-y-3">
              {lastSpinResults.map((res, i) => (
                <div key={res.id || i} className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                    {lastSpinResults.length > 1 ? `Вращение ${i + 1}` : "Выпавший сектор"}:
                  </span>
                  <p className="font-display text-xl font-bold text-white mt-1">{res.label}</p>
                  <p className={`font-mono text-lg font-black mt-1 ${res.wonCoins >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {res.wonCoins >= 0 ? `+${res.wonCoins.toLocaleString()}` : `${res.wonCoins.toLocaleString()}`} NOD
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSpinWinModal(false)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-3.5 text-sm font-black uppercase text-white shadow-lg cursor-pointer"
            >
              Отлично, продолжаем!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
