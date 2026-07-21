import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Users,
  Flame,
  Plus,
  RefreshCw,
  Play,
  Clock,
  EyeOff,
  Sparkles,
  Trash2,
  LogOut,
  Crown,
  HelpCircle,
  CheckCircle2,
  Swords,
  XCircle,
  UserMinus,
  Ban,
} from "lucide-react";
import { useNodbet } from "../context/NodbetContext";
import {
  DOUBLE_BONUSES,
  DOUBLE_BONUS_ORDER,
  buildDoubleWheelSectors,
  doubleWheelGradient,
  computeDoubleRouletteResults,
  pickRandomDoubleBonus,
  type DoubleBonusId,
  type DoublePlayerInput,
  type DoublePlayerResult,
} from "../utils/doubleRoulette";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

export interface DBRowLobby {
  id: string;
  host_id: string;
  host_nickname: string;
  name: string;
  max_players: number;
  min_bet: number;
  status: "waiting" | "betting" | "spinning" | "finished";
  winning_bonus_id: DoubleBonusId | null;
  timer_ends_at: string | null;
  created_at: string;
}

export interface DBRowPlayer {
  id: string;
  lobby_id: string;
  user_id: string;
  nickname: string;
  bet_amount: number;
  selected_bonus_id: DoubleBonusId | null;
  is_ready: boolean;
  joined_at: string;
}

const SPIN_PRESETS = [500, 1000, 2500, 5000, 10000, 25000, 50000];

export default function DoubleRouletteView() {
  const {
    balance,
    displayNickname,
    nickname,
    doubleRouletteDeduct,
    doubleRoulettePayout,
  } = useNodbet();
  const currentUserId = useMemo(() => {
    return nickname || displayNickname;
  }, [nickname, displayNickname]);

  // Lobbies & current active lobby
  const [lobbies, setLobbies] = useState<DBRowLobby[]>([]);
  const [lobbyPlayerCounts, setLobbyPlayerCounts] = useState<Record<string, number>>({});
  const [activeLobbyId, setActiveLobbyId] = useState<string | null>(null);
  const [activeLobby, setActiveLobby] = useState<DBRowLobby | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<DBRowPlayer[]>([]);

  // Modals & inputs
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createName, setCreateName] = useState<string>("");
  const [createMaxPlayers, setCreateMaxPlayers] = useState<number>(2);
  const [createMinBet, setCreateMinBet] = useState<number>(1000);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);

  // Phase 1 betting inputs
  const [myBetAmount, setMyBetAmount] = useState<number>(1000);
  const [customBetInput, setCustomBetInput] = useState<string>("50000");
  const [betMode, setBetMode] = useState<"preset" | "all" | "custom">("preset");
  const [mySelectedBonus, setMySelectedBonus] = useState<DoubleBonusId | null>(null);
  const [hasConfirmedPick, setHasConfirmedPick] = useState<boolean>(false);
  const [betDeducted, setBetDeducted] = useState<boolean>(false);

  // Compute effective bet amount based on mode
  const effectiveBetAmount = useMemo(() => {
    if (betMode === "all") return balance;
    if (betMode === "custom") {
      const val = Math.max(activeLobby?.min_bet ?? 500, parseInt(customBetInput, 10) || (activeLobby?.min_bet ?? 500));
      return Math.min(balance, val);
    }
    return myBetAmount;
  }, [betMode, balance, customBetInput, myBetAmount, activeLobby?.min_bet]);

  // Refs for tracking up-to-date state in timer intervals without stale closure issues
  const hasConfirmedPickRef = useRef<boolean>(false);
  const mySelectedBonusRef = useRef<DoubleBonusId | null>(null);
  const effectiveBetAmountRef = useRef<number>(1000);

  useEffect(() => {
    hasConfirmedPickRef.current = hasConfirmedPick;
  }, [hasConfirmedPick]);

  useEffect(() => {
    mySelectedBonusRef.current = mySelectedBonus;
  }, [mySelectedBonus]);

  useEffect(() => {
    effectiveBetAmountRef.current = effectiveBetAmount;
  }, [effectiveBetAmount]);

  // Wheel animation state
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [finalResults, setFinalResults] = useState<{
    winningBonus: (typeof DOUBLE_BONUSES)[DoubleBonusId];
    totalPool: number;
    results: DoublePlayerResult[];
    allGuessed: boolean;
    noneGuessed: boolean;
  } | null>(null);
  const [payoutApplied, setPayoutApplied] = useState<boolean>(false);

  // Timer countdown state
  const [timeLeft, setTimeLeft] = useState<number>(12);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinAppliedRef = useRef<boolean>(false);

  const wheelSectors = useMemo(() => buildDoubleWheelSectors(), []);
  const wheelBg = useMemo(() => doubleWheelGradient(wheelSectors), [wheelSectors]);

  // Sound effects
  const playSound = (kind: "tick" | "spin" | "win" | "lose" | "jackpot") => {
    try {
      const urls: Record<string, string> = {
        tick: "https://actions.google.com/sounds/v1/ui/click.ogg",
        win: "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg",
        lose: "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg",
        jackpot: "https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg",
        spin: "https://actions.google.com/sounds/v1/tools/ratchet_turn.ogg",
      };
      const url = urls[kind];
      if (!url) return;
      const a = new Audio(url);
      a.volume = 0.25;
      a.play().catch(() => {});
    } catch {
      /* ignore audio */
    }
  };

  // -------------------------------------------------------------
  // SUPABASE SYNC & FETCHING
  // -------------------------------------------------------------
  const fetchLobbies = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      // Call cleanup stale lobbies database function before loading
      await supabase.rpc("cleanup_stale_double_lobbies");

      const { data, error } = await supabase
        .from("nodbet_double_lobbies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!error && data) {
        setLobbies(data as DBRowLobby[]);
        // Fetch player counts for each lobby
        for (const lob of data) {
          const { data: plys } = await supabase
            .from("nodbet_double_lobby_players")
            .select("id", { count: "exact", head: true })
            .eq("lobby_id", lob.id);
          setLobbyPlayerCounts((prev) => ({
            ...prev,
            [lob.id]: plys ? (plys as any).length ?? 0 : 0,
          }));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchActiveLobbyDetails = useCallback(async (lobbyId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const [lobRes, plyRes] = await Promise.all([
        supabase.from("nodbet_double_lobbies").select("*").eq("id", lobbyId).single(),
        supabase.from("nodbet_double_lobby_players").select("*").eq("lobby_id", lobbyId).order("joined_at", { ascending: true }),
      ]);

      if (lobRes.error) {
        // Lobby was deleted or not found
        setActiveLobbyId(null);
        setActiveLobby(null);
        localStorage.removeItem("nodbet_active_lobby_id");
        return;
      }

      if (lobRes.data) {
        setActiveLobby(lobRes.data as DBRowLobby);
      }

      if (plyRes.error) {
        return;
      }

      if (plyRes.data) {
        setLobbyPlayers(plyRes.data as DBRowPlayer[]);
        
        // Check if current user is still in the player list of the lobby
        const isStillIn = plyRes.data.some((p) => p.user_id === currentUserId);
        if (!isStillIn) {
          // Current user was kicked, left, or removed
          setActiveLobbyId(null);
          setActiveLobby(null);
          localStorage.removeItem("nodbet_active_lobby_id");
          setErrorToast("Вы были исключены из лобби или лобби было распущено.");
          setTimeout(() => setErrorToast(null), 3000);
        }
      }
    } catch {
      /* ignore */
    }
  }, [currentUserId]);

  // Load saved lobby from localStorage on mount/refresh
  useEffect(() => {
    const savedLobbyId = localStorage.getItem("nodbet_active_lobby_id");
    if (savedLobbyId && isSupabaseConfigured && supabase) {
      const checkLobby = async () => {
        if (!supabase) return;
        try {
          const { data: player } = await supabase
            .from("nodbet_double_lobby_players")
            .select("*")
            .eq("lobby_id", savedLobbyId)
            .eq("user_id", currentUserId)
            .single();

          if (player) {
            setActiveLobbyId(savedLobbyId);
            fetchActiveLobbyDetails(savedLobbyId);
          } else {
            localStorage.removeItem("nodbet_active_lobby_id");
          }
        } catch {
          localStorage.removeItem("nodbet_active_lobby_id");
        }
      };
      checkLobby();
    }
  }, [currentUserId, fetchActiveLobbyDetails]);

  // Sync activeLobbyId with localStorage
  useEffect(() => {
    if (activeLobbyId) {
      localStorage.setItem("nodbet_active_lobby_id", activeLobbyId);
    } else {
      localStorage.removeItem("nodbet_active_lobby_id");
    }
  }, [activeLobbyId]);

  // Keep-alive: touch active lobby every 2 minutes to prevent deletion due to inactivity
  useEffect(() => {
    if (!activeLobbyId || !isSupabaseConfigured || !supabase) return;
    
    const interval = setInterval(async () => {
      if (!supabase) return;
      try {
        await supabase
          .from("nodbet_double_lobbies")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", activeLobbyId);
      } catch {
        /* ignore */
      }
    }, 120000); // every 2 minutes

    return () => clearInterval(interval);
  }, [activeLobbyId]);

  // Recover local states from database on reload/refresh during betting phase
  useEffect(() => {
    if (activeLobby?.status === "betting" && lobbyPlayers.length > 0) {
      const myPlayer = lobbyPlayers.find((p) => p.user_id === currentUserId);
      if (myPlayer && myPlayer.is_ready && myPlayer.selected_bonus_id) {
        if (!hasConfirmedPick) {
          setMySelectedBonus(myPlayer.selected_bonus_id as DoubleBonusId);
          setMyBetAmount(myPlayer.bet_amount);
          setHasConfirmedPick(true);
          setBetDeducted(true); // Since it is ready in DB, assume bet is already deducted
        }
      }
    }
  }, [activeLobby?.status, lobbyPlayers, currentUserId, hasConfirmedPick]);

  // Poll lobbies and active lobby
  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(() => {
      fetchLobbies();
      if (activeLobbyId) {
        fetchActiveLobbyDetails(activeLobbyId);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [fetchLobbies, activeLobbyId, fetchActiveLobbyDetails]);

  // Realtime channel subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;

    const channel = client
      .channel("double-roulette-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_double_lobbies" }, () => {
        fetchLobbies();
        if (activeLobbyId) fetchActiveLobbyDetails(activeLobbyId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "nodbet_double_lobby_players" }, () => {
        if (activeLobbyId) fetchActiveLobbyDetails(activeLobbyId);
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [fetchLobbies, activeLobbyId, fetchActiveLobbyDetails]);

  // -------------------------------------------------------------
  // LOBBY MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const handleCreateLobby = async () => {
    const lobbyTitle = createName.trim() || `Лобби от ${displayNickname}`;
    if (createMinBet > balance) {
      setErrorToast("Недостаточно средств на балансе для установленной мин. ставки!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: newLobby, error: lErr } = await supabase
          .from("nodbet_double_lobbies")
          .insert({
            host_id: currentUserId,
            host_nickname: displayNickname,
            name: lobbyTitle,
            max_players: createMaxPlayers,
            min_bet: createMinBet,
            status: "waiting",
          })
          .select()
          .single();

        if (lErr || !newLobby) {
          setErrorToast("Ошибка создания лобби в Supabase. Проверьте миграцию SQL!");
          setTimeout(() => setErrorToast(null), 3500);
          return;
        }

        // Add host as player 1
        await supabase.from("nodbet_double_lobby_players").insert({
          lobby_id: newLobby.id,
          user_id: currentUserId,
          nickname: displayNickname,
          bet_amount: createMinBet,
          is_ready: false,
        });

        setActiveLobbyId(newLobby.id);
        setActiveLobby(newLobby as DBRowLobby);
        localStorage.setItem("nodbet_active_lobby_id", newLobby.id);
        setShowCreateModal(false);
        setInfoToast(`🎮 Лобби «${lobbyTitle}» успешно создано! Ожидание игроков...`);
        setTimeout(() => setInfoToast(null), 3000);
      } catch {
        setErrorToast("Ошибка подключения к серверу");
        setTimeout(() => setErrorToast(null), 3000);
      }
    } else {
      // Local mode fallback
      const mockLobby: DBRowLobby = {
        id: "local_" + Date.now(),
        host_id: currentUserId,
        host_nickname: displayNickname,
        name: lobbyTitle,
        max_players: createMaxPlayers,
        min_bet: createMinBet,
        status: "waiting",
        winning_bonus_id: null,
        timer_ends_at: null,
        created_at: new Date().toISOString(),
      };
      const mockPlayer: DBRowPlayer = {
        id: "ply_" + Date.now(),
        lobby_id: mockLobby.id,
        user_id: currentUserId,
        nickname: displayNickname,
        bet_amount: createMinBet,
        selected_bonus_id: null,
        is_ready: false,
        joined_at: new Date().toISOString(),
      };
      setLobbies((prev) => [mockLobby, ...prev]);
      setLobbyPlayerCounts((prev) => ({ ...prev, [mockLobby.id]: 1 }));
      setActiveLobbyId(mockLobby.id);
      setActiveLobby(mockLobby);
      setLobbyPlayers([mockPlayer]);
      setShowCreateModal(false);
    }
  };

  const handleJoinLobby = async (lobby: DBRowLobby) => {
    if (lobby.status !== "waiting") {
      setErrorToast("Нельзя войти в лобби — игра уже началась или завершена!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    const playerCount = lobbyPlayerCounts[lobby.id] ?? 0;
    if (playerCount >= lobby.max_players) {
      setErrorToast("Лобби уже полностью заполнено!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    if (lobby.min_bet > balance) {
      setErrorToast(`Недостаточно монет! Для входа требуется минимум ${lobby.min_bet.toLocaleString()} NOD.`);
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // Check current player count
        const { data: currentPlys } = await supabase
          .from("nodbet_double_lobby_players")
          .select("*")
          .eq("lobby_id", lobby.id);

        if (currentPlys && currentPlys.length >= lobby.max_players) {
          setErrorToast("Лобби уже заполнено!");
          setTimeout(() => setErrorToast(null), 3000);
          return;
        }

        const alreadyIn = currentPlys?.some((p) => p.user_id === currentUserId);
        if (!alreadyIn) {
          await supabase.from("nodbet_double_lobby_players").insert({
            lobby_id: lobby.id,
            user_id: currentUserId,
            nickname: displayNickname,
            bet_amount: lobby.min_bet,
            is_ready: false,
          });
        }

        setActiveLobbyId(lobby.id);
        setActiveLobby(lobby);
        localStorage.setItem("nodbet_active_lobby_id", lobby.id);
        fetchActiveLobbyDetails(lobby.id);
        setInfoToast(`✅ Вы успешно присоединились к лобби «${lobby.name}»!`);
        setTimeout(() => setInfoToast(null), 3000);
      } catch {
        setErrorToast("Не удалось войти в лобби");
        setTimeout(() => setErrorToast(null), 3000);
      }
    } else {
      // Local fallback
      setActiveLobbyId(lobby.id);
      setActiveLobby(lobby);
      const exists = lobbyPlayers.some((p) => p.user_id === currentUserId);
      if (!exists) {
        const newPlayer: DBRowPlayer = {
          id: "ply_" + Date.now(),
          lobby_id: lobby.id,
          user_id: currentUserId,
          nickname: displayNickname,
          bet_amount: lobby.min_bet,
          selected_bonus_id: null,
          is_ready: false,
          joined_at: new Date().toISOString(),
        };
        setLobbyPlayers((prev) => [...prev, newPlayer]);
        setLobbyPlayerCounts((prev) => ({
          ...prev,
          [lobby.id]: (prev[lobby.id] ?? 0) + 1,
        }));
      }
    }
  };

  const handleLeaveLobby = async () => {
    if (!activeLobbyId) return;

    if (isSupabaseConfigured && supabase) {
      if (activeLobby?.host_id === currentUserId) {
        // If Host leaves, we delete the lobby entirely (cascade deletes players)
        await supabase
          .from("nodbet_double_lobbies")
          .delete()
          .eq("id", activeLobbyId);
      } else {
        // If regular player leaves, they just remove themselves
        await supabase
          .from("nodbet_double_lobby_players")
          .delete()
          .eq("lobby_id", activeLobbyId)
          .eq("user_id", currentUserId);
      }
    }

    setActiveLobbyId(null);
    setActiveLobby(null);
    setLobbyPlayers([]);
    setHasConfirmedPick(false);
    setBetDeducted(false);
    setPayoutApplied(false);
    setFinalResults(null);
    setMySelectedBonus(null);
    setBetMode("preset");
    setMyBetAmount(1000);
    localStorage.removeItem("nodbet_active_lobby_id");
  };

  // -------------------------------------------------------------
  // DELETE LOBBY (host only)
  // -------------------------------------------------------------
  const handleDeleteLobby = async () => {
    if (!activeLobby || activeLobby.host_id !== currentUserId) return;
    if (activeLobby.status !== "waiting") {
      setErrorToast("Нельзя удалить лобби во время игры!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from("nodbet_double_lobbies").delete().eq("id", activeLobby.id);
    }

    setActiveLobbyId(null);
    setActiveLobby(null);
    setLobbyPlayers([]);
    setFinalResults(null);
    setHasConfirmedPick(false);
    setBetDeducted(false);
    setPayoutApplied(false);
    localStorage.removeItem("nodbet_active_lobby_id");
    setInfoToast("🗑️ Лобби удалено.");
    setTimeout(() => setInfoToast(null), 3000);
  };

  // -------------------------------------------------------------
  // KICK PLAYER (host only)
  // -------------------------------------------------------------
  const handleKickPlayer = async (playerUserId: string) => {
    if (!activeLobby || activeLobby.host_id !== currentUserId) return;
    if (activeLobby.status !== "waiting") {
      setErrorToast("Нельзя кикать игроков во время игры!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }
    if (playerUserId === currentUserId) {
      setErrorToast("Нельзя кикнуть самого себя!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("nodbet_double_lobby_players")
        .delete()
        .eq("lobby_id", activeLobby.id)
        .eq("user_id", playerUserId);
    } else {
      setLobbyPlayers((prev) => prev.filter((p) => p.user_id !== playerUserId));
    }
    setInfoToast("👢 Игрок исключён из лобби.");
    setTimeout(() => setInfoToast(null), 3000);
  };

  // -------------------------------------------------------------
  // TOGGLE READY (waiting phase)
  // -------------------------------------------------------------
  const handleToggleReady = async () => {
    if (!activeLobbyId) return;
    const myPlayer = lobbyPlayers.find((p) => p.user_id === currentUserId);
    if (!myPlayer) return;

    const newReadyState = !myPlayer.is_ready;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from("nodbet_double_lobby_players")
          .update({ is_ready: newReadyState })
          .eq("lobby_id", activeLobbyId)
          .eq("user_id", currentUserId);
      } catch {
        setErrorToast("Не удалось изменить статус готовности");
        setTimeout(() => setErrorToast(null), 3000);
      }
    } else {
      setLobbyPlayers((prev) =>
        prev.map((p) =>
          p.user_id === currentUserId ? { ...p, is_ready: newReadyState } : p
        )
      );
    }
  };

  // -------------------------------------------------------------
  // AUTO CONFIRM (when timer runs out)
  // -------------------------------------------------------------
  const handleAutoConfirm = async () => {
    if (!activeLobbyId || hasConfirmedPickRef.current) return;

    // Pick a random bonus if not selected
    const randomBonus = mySelectedBonusRef.current || pickRandomDoubleBonus();
    const betAmt = effectiveBetAmountRef.current;

    // Deduct bet from balance
    const { ok } = doubleRouletteDeduct(betAmt);
    if (!ok) {
      setErrorToast("Авто-выбор: недостаточно средств для ставки!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    setMySelectedBonus(randomBonus);
    setHasConfirmedPick(true);
    setBetDeducted(true);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from("nodbet_double_lobby_players")
          .update({
            bet_amount: betAmt,
            selected_bonus_id: randomBonus,
            is_ready: true,
          })
          .eq("lobby_id", activeLobbyId)
          .eq("user_id", currentUserId);
      } catch {
        /* ignore */
      }
    } else {
      setLobbyPlayers((prev) =>
        prev.map((p) =>
          p.user_id === currentUserId
            ? { ...p, bet_amount: betAmt, selected_bonus_id: randomBonus, is_ready: true }
            : p
        )
      );
    }
    setInfoToast(`⏱️ Время вышло! Автоматически выбран бонус: ${DOUBLE_BONUSES[randomBonus].label}`);
    setTimeout(() => setInfoToast(null), 4000);
  };

  // -------------------------------------------------------------
  // START GAME BY HOST
  // -------------------------------------------------------------
  const handleStartGameByHost = async () => {
    if (!activeLobby || activeLobby.host_id !== currentUserId) return;
    if (lobbyPlayers.length < 2) {
      setErrorToast("Минимум 2 игрока должны зайти в лобби перед стартом!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    const timerEndsAt = new Date(Date.now() + 12000).toISOString();
    spinAppliedRef.current = false;

    if (isSupabaseConfigured && supabase) {
      try {
        // Reset player picks and set everyone to not ready for the betting/choosing phase
        await supabase
          .from("nodbet_double_lobby_players")
          .update({
            selected_bonus_id: null,
            is_ready: false,
            bet_amount: activeLobby.min_bet,
          })
          .eq("lobby_id", activeLobby.id);

        await supabase
          .from("nodbet_double_lobbies")
          .update({
            status: "betting",
            timer_ends_at: timerEndsAt,
            winning_bonus_id: null,
          })
          .eq("id", activeLobby.id);
      } catch (err) {
        setErrorToast("Ошибка запуска раунда");
        setTimeout(() => setErrorToast(null), 3000);
      }
    } else {
      setLobbyPlayers((prev) =>
        prev.map((p) => ({ ...p, is_ready: false, selected_bonus_id: null, bet_amount: activeLobby.min_bet }))
      );
      setActiveLobby((prev) => (prev ? { ...prev, status: "betting", timer_ends_at: timerEndsAt, winning_bonus_id: null } : null));
    }
  };

  // -------------------------------------------------------------
  // 12-SECOND TIMER & CONFIRM PICK
  // -------------------------------------------------------------
  useEffect(() => {
    if (!activeLobby || activeLobby.status !== "betting") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const updateTimer = () => {
      if (!activeLobby.timer_ends_at) {
        setTimeLeft(12);
        return;
      }
      const diff = Math.max(0, Math.ceil((new Date(activeLobby.timer_ends_at).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        
        // Auto confirm if we haven't done so yet
        if (!hasConfirmedPickRef.current) {
          handleAutoConfirm();
        }

        // Host triggers wheel spin after a short delay (e.g., 1.5 seconds) to let other players' auto-confirms write to database
        if (activeLobby.host_id === currentUserId) {
          setTimeout(() => {
            triggerWheelSpin();
          }, 1500);
        }
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLobby?.status, activeLobby?.timer_ends_at, activeLobby?.host_id, currentUserId]);

  const handleConfirmPick = async () => {
    if (!activeLobbyId || !mySelectedBonus) {
      setErrorToast("Выберите один из 8 бонусов на рулетке!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }
    if (myBetAmount < (activeLobby?.min_bet ?? 0)) {
      setErrorToast(`Минимальная ставка в этом лобби составляет ${activeLobby?.min_bet?.toLocaleString() ?? 0} NOD!`);
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }
    if (myBetAmount > balance) {
      setErrorToast("Недостаточно NOD на балансе!");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    // DEDUCT BET FROM BALANCE
    if (!betDeducted) {
      const { ok, error } = doubleRouletteDeduct(myBetAmount);
      if (!ok) {
        setErrorToast(error || "Ошибка списания ставки");
        setTimeout(() => setErrorToast(null), 3000);
        return;
      }
      setBetDeducted(true);
    }

    setHasConfirmedPick(true);
    playSound("tick");

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("nodbet_double_lobby_players")
        .update({
          bet_amount: myBetAmount,
          selected_bonus_id: mySelectedBonus,
          is_ready: true,
        })
        .eq("lobby_id", activeLobbyId)
        .eq("user_id", currentUserId);
    } else {
      setLobbyPlayers((prev) =>
        prev.map((p) =>
          p.user_id === currentUserId
            ? { ...p, bet_amount: myBetAmount, selected_bonus_id: mySelectedBonus, is_ready: true }
            : p
        )
      );
    }

    setInfoToast("✓ Ваш выбор и ставка зафиксированы! Ожидаем завершения таймера...");
    setTimeout(() => setInfoToast(null), 3000);
  };

  // -------------------------------------------------------------
  // TRIGGER WHEEL SPIN (Host or Auto)
  // -------------------------------------------------------------
  const triggerWheelSpin = async () => {
    if (!activeLobbyId) return;

    const winningBonus = pickRandomDoubleBonus();

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("nodbet_double_lobbies")
        .update({
          status: "spinning",
          winning_bonus_id: winningBonus,
        })
        .eq("id", activeLobbyId);
    } else {
      setActiveLobby((prev) => (prev ? { ...prev, status: "spinning", winning_bonus_id: winningBonus } : null));
    }
  };

  // -------------------------------------------------------------
  // SPIN ANIMATION & PAYOUT
  // -------------------------------------------------------------
  useEffect(() => {
    if (!activeLobby || activeLobby.status !== "spinning" || !activeLobby.winning_bonus_id || isSpinning) {
      return;
    }

    // Skip if we already processed this spin
    if (spinAppliedRef.current) return;
    spinAppliedRef.current = true;

    setIsSpinning(true);
    playSound("spin");

    const winningId = activeLobby.winning_bonus_id;
    const sector = wheelSectors.find((s) => s.id === winningId);
    const targetRem = sector ? (360 - sector.midDeg) % 360 : 0;
    const currentRem = wheelRotation % 360;
    let diff = targetRem - currentRem;
    if (diff <= 0) diff += 360;

    // 1.5x more rotation turns than normal roulette (standard 5-8 turns, double = 10-12 full turns)
    const fullSpins = 360 * (10 + Math.floor(Math.random() * 3)); // 3600° - 4320°
    const nextAngle = wheelRotation + fullSpins + diff;
    setWheelRotation(nextAngle);

    // Audio ratchet ticks over double duration
    const tickInterval = setInterval(() => playSound("tick"), 220);

    // Duration is ~2x longer (6400ms vs standard 3200ms)
    setTimeout(async () => {
      clearInterval(tickInterval);
      setIsSpinning(false);

      // Compute outcomes for participating players in lobby
      const participatingPlayers = lobbyPlayers.filter(
        (p) => p.selected_bonus_id !== null && p.selected_bonus_id !== undefined
      );

      const formattedInputs: DoublePlayerInput[] = participatingPlayers.map((p) => {
        return {
          userId: p.user_id,
          nickname: p.nickname,
          betAmount: p.bet_amount || (activeLobby?.min_bet ?? 500),
          selectedBonusId: p.selected_bonus_id as DoubleBonusId,
        };
      });

      const res = computeDoubleRouletteResults(formattedInputs, winningId);
      setFinalResults(res);

      // APPLY PAYOUT TO BALANCE for current user
      if (!payoutApplied) {
        const myRes = res.results.find((r) => r.userId === currentUserId);
        if (myRes) {
          if (myRes.netGain > 0) {
            doubleRoulettePayout(myRes.payout, Math.round(myRes.payout / 20));
          } else if (myRes.netGain < 0) {
            // If net is negative but payout is 0, the bet was already deducted
            // No additional deduction needed
          }
          setPayoutApplied(true);
        }
      }

      const myRes = res.results.find((r) => r.userId === currentUserId);
      if (myRes?.guessedCorrectly) {
        if (res.allGuessed) playSound("win");
        else playSound("jackpot");
      } else {
        playSound("lose");
      }

      // SET LOBBY TO "finished" so everyone knows the spin is done
      if (isSupabaseConfigured && supabase && activeLobbyId) {
        await supabase
          .from("nodbet_double_lobbies")
          .update({ status: "finished" })
          .eq("id", activeLobbyId);
      } else if (activeLobby) {
        setActiveLobby((prev) => (prev ? { ...prev, status: "finished" } : null));
      }
    }, 6400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLobby?.status, activeLobby?.winning_bonus_id]);

  // -------------------------------------------------------------
  // RESET LOBBY FOR ANOTHER SPIN (host)
  // -------------------------------------------------------------
  const handleResetLobbyByHost = async () => {
    if (!activeLobby || activeLobby.host_id !== currentUserId) return;
    setFinalResults(null);
    setHasConfirmedPick(false);
    setBetDeducted(false);
    setPayoutApplied(false);
    setMySelectedBonus(null);
    setBetMode("preset");
    setMyBetAmount(activeLobby.min_bet);
    spinAppliedRef.current = false;

    if (isSupabaseConfigured && supabase) {
      // Clear player picks
      await supabase
        .from("nodbet_double_lobby_players")
        .update({
          selected_bonus_id: null,
          is_ready: false,
          bet_amount: activeLobby.min_bet,
        })
        .eq("lobby_id", activeLobby.id);

      // Reset lobby status to waiting
      await supabase
        .from("nodbet_double_lobbies")
        .update({
          status: "waiting",
          winning_bonus_id: null,
          timer_ends_at: null,
        })
        .eq("id", activeLobby.id);
    } else {
      setLobbyPlayers((prev) =>
        prev.map((p) => ({ ...p, selected_bonus_id: null, is_ready: false, bet_amount: activeLobby.min_bet }))
      );
      setActiveLobby((prev) =>
        prev ? { ...prev, status: "waiting", winning_bonus_id: null, timer_ends_at: null } : null
      );
    }
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* HEADER & TOP BANNER */}
      <div className="rounded-3xl border border-red-500/30 bg-gradient-to-r from-[#180a0a] via-[#120a16] to-[#0d0d12] p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-red-500">
          <Swords size={180} />
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-yellow-400">
              <Swords size={14} className="animate-pulse" />
              Новый мультиплеер-режим NODBET
            </div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-white">
              ⚔️ ДВОЙНАЯ-<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-400 to-amber-300">РУЛЕТКА</span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Дуэльный и командный режим (от 2 до 4 игроков). Создавайте лобби, делайте скрытые ставки за 12 секунд. Отрицательные сектора дают <b>ПРИБЫЛЬ</b>, а главная потеря даёт <b>ДЖЕКПОТ (x5.0)</b>! Угадавший забирает банк соперников!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!activeLobbyId && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Plus size={18} /> Создать лобби
              </button>
            )}
            {activeLobbyId && (
              <>
                <button
                  onClick={handleLeaveLobby}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-3 text-xs font-bold uppercase text-red-300 hover:bg-red-900/50 cursor-pointer"
                >
                  <LogOut size={16} /> Покинуть лобби
                </button>
                {activeLobby?.host_id === currentUserId && activeLobby?.status === "waiting" && (
                  <button
                    onClick={handleDeleteLobby}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-600/60 bg-red-950/60 px-5 py-3 text-xs font-bold uppercase text-red-400 hover:bg-red-900/70 cursor-pointer"
                  >
                    <Trash2 size={16} /> Удалить лобби
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* TOAST NOTIFICATIONS */}
        {errorToast && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/90 px-4 py-3 text-xs sm:text-sm font-bold text-red-200 animate-fade-in flex items-center gap-2">
            <XCircle size={18} className="text-red-400 shrink-0" />
            <span>{errorToast}</span>
          </div>
        )}
        {infoToast && (
          <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-950/90 px-4 py-3 text-xs sm:text-sm font-bold text-yellow-200 animate-fade-in flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-400 shrink-0" />
            <span>{infoToast}</span>
          </div>
        )}
      </div>

      {/* CREATE LOBBY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-[#161212] p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-display text-xl font-bold uppercase text-white flex items-center gap-2">
                <Swords size={20} className="text-yellow-400" /> Настройка Двойной-Рулетки
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Название лобби</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={`Лобби от ${displayNickname}`}
                  maxLength={30}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-2.5 text-sm font-bold text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Максимально игроков (2 - 4)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCreateMaxPlayers(num)}
                      className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer border ${
                        createMaxPlayers === num
                          ? "bg-red-600 text-white border-red-500 shadow"
                          : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {num} игрока
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Минимальная ставка лобби (NOD)</label>
                <input
                  type="number"
                  min={100}
                  step={500}
                  value={createMinBet}
                  onChange={(e) => setCreateMinBet(Math.max(100, Number(e.target.value) || 100))}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-2.5 font-mono text-sm font-bold text-yellow-400 focus:border-red-500 focus:outline-none"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[500, 1000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreateMinBet(amt)}
                      className="rounded-lg bg-white/5 py-1 text-[11px] font-mono font-bold text-zinc-300 hover:bg-white/10"
                    >
                      {amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCreateLobby}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-3.5 text-sm font-black uppercase text-white shadow-lg cursor-pointer"
                >
                  ✓ Создать и войти в лобби
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT: LOBBY LIST vs INSIDE ACTIVE LOBBY */}
      {!activeLobbyId ? (
        /* ======================= LOBBY LIST VIEW ======================= */
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <Users className="text-yellow-400" /> Активные лобби «Двойной-Рулетки» ({lobbies.length})
            </h3>
            <span className="text-xs text-zinc-400">Синхронизация через Supabase Realtime</span>
          </div>

          {lobbies.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#141414] py-16 text-center text-zinc-500 space-y-3">
              <Swords size={48} className="mx-auto stroke-1 text-zinc-600" />
              <p className="text-base font-semibold text-zinc-300">Сейчас нет доступных активных лобби</p>
              <p className="text-xs text-zinc-500">Создайте первое лобби и пригласите других пользователей на дуэль!</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black uppercase text-white hover:bg-red-500 cursor-pointer"
              >
                <Plus size={16} /> Создать лобби
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lobbies.map((lob) => {
                const pCount = lobbyPlayerCounts[lob.id] ?? 0;
                const isFull = pCount >= lob.max_players;
                const canJoin = lob.status === "waiting" && !isFull;

                let statusLabel = "Ожидание";
                let statusColor = "bg-green-500/20 text-green-400 border-green-500/30";
                if (lob.status === "betting") { statusLabel = "Выбор (12s)"; statusColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; }
                else if (lob.status === "spinning") { statusLabel = "Вращение"; statusColor = "bg-orange-500/20 text-orange-400 border-orange-500/30"; }
                else if (lob.status === "finished") { statusLabel = "Завершена"; statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30"; }

                return (
                  <div
                    key={lob.id}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#141414] p-5 transition-all hover:border-yellow-500/40 hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
                        <span className="font-display text-base font-bold text-white truncate max-w-[180px]">
                          {lob.name}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-zinc-300">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Создатель:</span>
                          <span className="font-bold text-white flex items-center gap-1">
                            <Crown size={12} className="text-yellow-400" /> {lob.host_nickname}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Игроков:</span>
                          <span className={`font-bold flex items-center gap-1 ${isFull ? "text-red-400" : "text-green-400"}`}>
                            <Users size={12} /> {pCount} / {lob.max_players}
                            {isFull && <span className="text-[10px] text-red-400">(Заполнено)</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Мин. ставка:</span>
                          <span className="font-mono font-bold text-yellow-400">{lob.min_bet.toLocaleString()} NOD</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/5">
                      {canJoin ? (
                        <button
                          onClick={() => handleJoinLobby(lob)}
                          className="w-full rounded-xl bg-gradient-to-r from-red-600 to-yellow-500 py-2.5 text-xs font-black uppercase text-white shadow hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Swords size={14} /> Войти в лобби
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full rounded-xl bg-white/5 py-2.5 text-xs font-black uppercase text-zinc-600 cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {isFull ? <Ban size={14} /> : <Clock size={14} />}
                          {isFull ? "Заполнено" : lob.status === "betting" ? "Идёт игра" : lob.status === "spinning" ? "Вращение..." : "Завершена"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ======================= INSIDE ACTIVE LOBBY VIEW ======================= */
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* LEFT: WHEEL & PLAY GAME CONTROLLER */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-3xl border border-red-500/30 bg-[#141414] p-6 sm:p-8 relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest block">
                    {activeLobby?.status === "waiting" && "Фаза 1: Ожидание состава игроков"}
                    {activeLobby?.status === "betting" && "Фаза 2: Скрытый выбор бонуса и ставки"}
                    {activeLobby?.status === "spinning" && "Фаза 3: Двойное вращение колеса"}
                    {activeLobby?.status === "finished" && "Фаза 4: Результаты раунда"}
                  </span>
                  <h3 className="font-display text-2xl font-black uppercase text-white italic mt-0.5">
                    {activeLobby?.name}
                  </h3>
                </div>

                {activeLobby?.status === "betting" && (
                  <div className="flex items-center gap-2 rounded-2xl bg-red-600/20 border border-red-500/50 px-4 py-2">
                    <Clock size={18} className="text-red-400 animate-pulse" />
                    <span className="font-mono text-xl font-black text-yellow-400">{timeLeft}s</span>
                  </div>
                )}
              </div>

              {/* 12-SECOND COUNTDOWN PROGRESS BAR */}
              {activeLobby?.status === "betting" && (
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/50 border border-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 transition-all duration-1000"
                    style={{ width: `${(timeLeft / 12) * 100}%` }}
                  />
                </div>
              )}

              {/* WHEEL DISPLAY */}
              <div className="relative my-8 flex items-center justify-center">
                <div className="absolute -top-6 z-20 flex flex-col items-center">
                  <div className="h-6 w-5 bg-yellow-400 shadow-lg" style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} />
                  <span className="text-[10px] font-black uppercase text-yellow-300 bg-black/80 px-2 py-0.5 rounded border border-yellow-500/40">
                    ПОБЕДНЫЙ СЕКТОР
                  </span>
                </div>

                <div
                  className="h-64 w-64 sm:h-80 sm:w-80 rounded-full border-[8px] border-[#222] shadow-[0_0_50px_rgba(225,6,0,0.3)] relative flex items-center justify-center"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: isSpinning ? "transform 6400ms cubic-bezier(0.15, 0.85, 0.2, 1)" : "none",
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

              {/* HOST START GAME BUTTON (WHEN WAITING) */}
              {activeLobby?.status === "waiting" && (
                <div className="text-center space-y-4 pt-4 border-t border-white/10">
                  {activeLobby.host_id === currentUserId ? (
                    <div>
                      <p className="text-sm text-zinc-300 mb-3">
                        В лобби зашло <b>{lobbyPlayers.length} / {activeLobby.max_players}</b> игроков.
                      </p>
                      
                      {lobbyPlayers.length < 2 ? (
                        <div className="p-4 mb-3 rounded-2xl bg-red-600/10 border border-red-500/20 text-xs text-red-400">
                          ⚠️ Ожидание соперников (требуется минимум 2 игрока)
                        </div>
                      ) : !lobbyPlayers.filter(p => p.user_id !== activeLobby.host_id).every(p => p.is_ready) ? (
                        <div className="p-4 mb-3 rounded-2xl bg-yellow-600/10 border border-yellow-500/20 text-xs text-yellow-400">
                          ⏳ Ожидание готовности всех игроков (все соперники должны нажать «Готов»)
                        </div>
                      ) : (
                        <div className="p-4 mb-3 rounded-2xl bg-green-600/10 border border-green-500/20 text-xs text-green-400">
                          ✅ Все игроки готовы! Вы можете запустить раунд.
                        </div>
                      )}

                      <button
                        onClick={handleStartGameByHost}
                        disabled={
                          lobbyPlayers.length < 2 ||
                          !lobbyPlayers.filter(p => p.user_id !== activeLobby.host_id).every(p => p.is_ready)
                        }
                        className="rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 px-8 py-4 text-base font-black uppercase text-white shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                      >
                        <Play size={20} /> Начать 12s раунд ставок
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const myPlayer = lobbyPlayers.find((p) => p.user_id === currentUserId);
                        const isReady = myPlayer?.is_ready || false;
                        return (
                          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3">
                            <span className="text-xs text-zinc-300">
                              Статус готовности: {isReady ? (
                                <b className="text-green-400 font-bold">🟢 ВЫ ГОТОВЫ</b>
                              ) : (
                                <b className="text-red-400 font-bold">🔴 ВЫ НЕ ГОТОВЫ</b>
                              )}
                            </span>
                            <button
                              onClick={handleToggleReady}
                              className={`rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer ${
                                isReady
                                  ? "bg-amber-600 hover:bg-amber-500"
                                  : "bg-green-600 hover:bg-green-500"
                              }`}
                            >
                              {isReady ? "❌ Снять готовность" : "✅ Я готов!"}
                            </button>
                            <p className="text-[11px] text-zinc-400">
                              Ожидание, пока создатель лобби (<b>{activeLobby.host_nickname}</b>) запустит раунд ставок...
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* BETTING PHASE SELECTION FORM */}
              {activeLobby?.status === "betting" && (
                <div className="space-y-5 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-zinc-300">
                    <span>1. Выберите бонус для прогноза (Скрыт от других!):</span>
                    <span className="text-yellow-400">
                      {mySelectedBonus ? DOUBLE_BONUSES[mySelectedBonus].label : "Не выбран"}
                    </span>
                  </div>

                  {/* 8 BONUS SECTOR CARDS */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {DOUBLE_BONUS_ORDER.map((id) => {
                      const b = DOUBLE_BONUSES[id];
                      const isSelected = mySelectedBonus === id;
                      return (
                        <button
                          key={b.id}
                          disabled={hasConfirmedPick}
                          onClick={() => setMySelectedBonus(b.id)}
                          className={`rounded-2xl p-3 text-left border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-yellow-400 bg-white/10 shadow-lg scale-102"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-lg">{b.emoji}</span>
                            <span className="font-mono text-xs font-black text-yellow-300">{b.shortLabel}</span>
                          </div>
                          <p className="text-xs font-bold text-white truncate">{b.label}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{b.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* BET AMOUNT INPUT */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-bold text-zinc-300">
                      <span>2. Сумма вашей ставки на спин</span>
                      <span className="font-mono text-yellow-400">Баланс: {balance.toLocaleString()} NOD</span>
                    </div>

                    {/* Bet mode buttons: ПРЕСЕТ / ПОСТАВИТЬ ВСЁ / СВОЯ */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => { setBetMode("preset"); setMyBetAmount(activeLobby?.min_bet ?? 1000); }}
                        disabled={hasConfirmedPick}
                        className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer ${
                          betMode === "preset" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                        }`}
                      >
                        Пресет
                      </button>
                      <button
                        onClick={() => setBetMode("all")}
                        disabled={hasConfirmedPick}
                        className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          betMode === "all" ? "bg-gradient-to-r from-red-600 to-yellow-500 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                        }`}
                      >
                        <Flame size={14} /> ПОСТАВИТЬ ВСЁ
                      </button>
                      <button
                        onClick={() => { setBetMode("custom"); setCustomBetInput(String(activeLobby?.min_bet ?? 50000)); }}
                        disabled={hasConfirmedPick}
                        className={`rounded-xl py-2.5 text-xs font-black uppercase transition-all cursor-pointer ${
                          betMode === "custom" ? "bg-red-600 text-white shadow-md" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                        }`}
                      >
                        СВОЯ
                      </button>
                    </div>

                    {/* PRESET amounts */}
                    {betMode === "preset" && (
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                        {SPIN_PRESETS.map((amt) => (
                          <button
                            key={amt}
                            disabled={hasConfirmedPick}
                            onClick={() => setMyBetAmount(amt)}
                            className={`rounded-lg py-1.5 font-mono text-xs font-bold transition-all cursor-pointer ${
                              myBetAmount === amt ? "bg-red-600 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                          >
                            {amt >= 1000 ? `${amt / 1000}k` : amt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ALL IN display */}
                    {betMode === "all" && (
                      <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 text-center">
                        <span className="font-mono text-lg font-black text-yellow-400">
                          {balance.toLocaleString()} NOD
                        </span>
                        <span className="block text-[11px] text-yellow-300 font-bold mt-0.5">Весь баланс на кон!</span>
                      </div>
                    )}

                    {/* CUSTOM input */}
                    {betMode === "custom" && (
                      <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/10">
                        <span className="text-xs text-zinc-400 font-medium">Своя сумма (NOD):</span>
                        <input
                          type="number"
                          min={activeLobby?.min_bet ?? 500}
                          max={balance}
                          step={500}
                          value={customBetInput}
                          onChange={(e) => setCustomBetInput(e.target.value)}
                          disabled={hasConfirmedPick}
                          className="flex-1 rounded-xl bg-white/10 px-3 py-1.5 font-mono text-sm font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    )}

                    <button
                      onClick={handleConfirmPick}
                      disabled={hasConfirmedPick || !mySelectedBonus}
                      className={`w-full rounded-xl px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer ${
                        hasConfirmedPick
                          ? "bg-green-600 cursor-default"
                          : "bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 hover:scale-102 active:scale-95"
                      }`}
                    >
                      {hasConfirmedPick
                        ? `✓ Выбор Готов (${effectiveBetAmount.toLocaleString()} NOD списано)`
                        : `Подтвердить выбор (${effectiveBetAmount.toLocaleString()} NOD)`}
                    </button>
                  </div>
                </div>
              )}

              {/* SPINNING PHASE ANNOUNCEMENT */}
              {activeLobby?.status === "spinning" && (
                <div className="text-center pt-4 border-t border-white/10">
                  <span className="inline-flex items-center gap-2 font-display text-xl font-black uppercase text-yellow-400 animate-pulse">
                    <RefreshCw size={22} className="animate-spin" /> Колесо рулетки вращается...
                  </span>
                  <p className="text-xs text-zinc-400 mt-1">
                    Шансы равны для всех игроков! Ожидаем остановки стрелки...
                  </p>
                </div>
              )}

              {/* FINISHED PHASE - show summary before results modal */}
              {activeLobby?.status === "finished" && !finalResults && (
                <div className="text-center pt-4 border-t border-white/10 space-y-3">
                  <span className="inline-flex items-center gap-2 font-display text-xl font-black uppercase text-green-400">
                    <CheckCircle2 size={22} /> Раунд завершён!
                  </span>
                  <p className="text-xs text-zinc-400">
                    Ожидайте результатов или нажмите «Сыграть ещё раунд» (только создатель лобби).
                  </p>
                  {activeLobby?.host_id === currentUserId && (
                    <button
                      onClick={handleResetLobbyByHost}
                      className="rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 px-8 py-3 text-sm font-black uppercase text-white shadow-xl cursor-pointer"
                    >
                      🔄 Сыграть ещё раунд
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: PLAYERS LIST IN LOBBY & HIDDEN CHOICES */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-red-500/30 bg-[#141414] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h4 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-yellow-400" /> Состав игроков ({lobbyPlayers.length} / {activeLobby?.max_players})
                </h4>
              </div>

              <div className="mt-4 space-y-3">
                {lobbyPlayers.map((p) => {
                  const isMe = p.user_id === currentUserId;
                  const isHost = p.user_id === activeLobby?.host_id;
                  const canKick =
                    activeLobby?.host_id === currentUserId &&
                    !isMe &&
                    activeLobby?.status === "waiting";

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border p-4 transition-all relative ${
                        isMe ? "border-yellow-500/50 bg-yellow-500/10" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isHost && (
                            <span title="Создатель лобби">
                              <Crown size={16} className="text-yellow-400" />
                            </span>
                          )}
                          <span className="font-bold text-white text-sm">
                            {p.nickname} {isMe && <b className="text-yellow-400 text-xs font-normal">(Вы)</b>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeLobby?.status === "waiting" ? (
                            p.is_ready ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400">
                                <CheckCircle2 size={13} /> Готов
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-zinc-500">Не готов</span>
                            )
                          ) : (
                            p.is_ready ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400">
                                <CheckCircle2 size={13} /> Готов
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-zinc-500">Выбирает...</span>
                            )
                          )}
                          {canKick && (
                            <button
                              onClick={() => handleKickPlayer(p.user_id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/40 px-2 py-1 text-[10px] font-bold text-red-300 hover:bg-red-900/60 cursor-pointer"
                              title="Выгнать игрока"
                            >
                              <UserMinus size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Ставка на спин:</span>
                        <span className="font-mono font-bold text-yellow-400">
                          {p.bet_amount > 0 ? `${p.bet_amount.toLocaleString()} NOD` : "—"}
                        </span>
                      </div>

                      {/* HIDDEN BONUS PICK DISPLAY */}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Выбранный бонус:</span>
                        {isMe && p.selected_bonus_id ? (
                          <span className="font-bold text-white flex items-center gap-1">
                            {DOUBLE_BONUSES[p.selected_bonus_id]?.emoji} {DOUBLE_BONUSES[p.selected_bonus_id]?.shortLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-500 font-mono text-[11px]">
                            <EyeOff size={12} /> ❓ Скрыто от соперников
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PAYOUT LOGIC REFERENCE BOX */}
              <div className="mt-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4 text-xs space-y-1.5 text-zinc-300">
                <div className="flex items-center gap-1.5 font-bold text-yellow-400 mb-1">
                  <HelpCircle size={15} /> Правила расчёта выигрыша:
                </div>
                <p>1. <b>Угадавший игрок</b> забирает всю сумму ставок ВСЕХ соперников + прибыль от своего бонуса!</p>
                <p>2. <b>Если ВСЕ угадали:</b> каждый получает +10% от своей ставки.</p>
                <p>3. <b>Если НИКТО не угадал:</b> ставки всех участников исчезают.</p>
                <p>4. Все 8 бонусов дают прибыль, а худшая потеря (−100%) даёт ДЖЕКПОТ x5.0!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINAL RESULTS MODAL */}
      {finalResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/40 bg-[#161212] p-6 sm:p-8 shadow-2xl relative text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-black text-3xl shadow-lg mb-4">
              {finalResults.winningBonus.emoji}
            </div>

            <h3 className="font-display text-2xl font-black italic uppercase text-white">
              Результат Двойной-Рулетки!
            </h3>

            <div className="mt-2 inline-block rounded-full bg-white/10 px-4 py-1 font-mono text-sm font-bold text-yellow-400 border border-white/15">
              Выпал сектор: {finalResults.winningBonus.label} ({finalResults.winningBonus.shortLabel})
            </div>

            {/* RESULTS TABLE */}
            <div className="mt-6 space-y-3 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                Итоги раунда для всех участников:
              </span>
              {finalResults.results.map((r) => {
                const isMe = r.userId === currentUserId;
                return (
                  <div
                    key={r.userId}
                    className={`rounded-2xl p-4 border flex items-center justify-between ${
                      r.guessedCorrectly ? "border-green-500/40 bg-green-950/30" : "border-red-500/40 bg-red-950/30"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-white text-sm">
                        {r.nickname} {isMe && "(Вы)"}
                      </span>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Прогноз:{" "}
                        <b className="text-zinc-200">
                          {r.selectedBonusId ? DOUBLE_BONUSES[r.selectedBonusId]?.label : "Не выбрал"}
                        </b>
                      </p>
                    </div>

                    <div className="text-right font-mono">
                      <span className={`text-base font-black ${r.netGain >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {r.netGain >= 0 ? `+${r.payout.toLocaleString()}` : `${r.netGain.toLocaleString()}`} NOD
                      </span>
                      <span className="block text-[11px] text-zinc-500">
                        {r.guessedCorrectly ? "✓ Угадал" : "✕ Не угадал"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {activeLobby?.host_id === currentUserId && (
                <button
                  onClick={handleResetLobbyByHost}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 py-3 text-sm font-black uppercase text-white shadow cursor-pointer"
                >
                  🔄 Сыграть ещё раунд
                </button>
              )}
              <button
                onClick={() => setFinalResults(null)}
                className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3 text-sm font-bold text-white hover:bg-white/20 cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
