import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { seedTeams, seedPlayers, seedMatches, seedFaq, seedSettings } from "../data/seed";
import type { Team, Player, Match, FaqItem, Settings, Vote } from "../types";

const LOCAL_KEY = "njdc_store_v1";

interface LocalStore {
  teams: Team[];
  players: Player[];
  matches: Match[];
  faq: FaqItem[];
  settings: Settings;
  votes: Vote[];
}

function loadLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {
    /* ignore */
  }
  return {
    teams: seedTeams,
    players: seedPlayers,
    matches: seedMatches,
    faq: seedFaq,
    settings: seedSettings,
    votes: [],
  };
}

function saveLocal(store: LocalStore) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function uid() {
  return crypto.randomUUID();
}

interface DataContextValue {
  loading: boolean;
  teams: Team[];
  players: Player[];
  matches: Match[];
  faq: FaqItem[];
  settings: Settings;
  votes: Vote[];
  isSupabaseConfigured: boolean;
  refresh: () => Promise<void>;
  // Teams
  upsertTeam: (team: Team) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  // Players
  upsertPlayer: (player: Player) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  // Matches
  upsertMatch: (match: Match) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  // FAQ
  upsertFaq: (item: FaqItem) => Promise<void>;
  deleteFaq: (id: string) => Promise<void>;
  // Settings
  updateSettings: (s: Settings) => Promise<void>;
  // Votes
  castVote: (matchId: string, teamId: string, voterId: string) => Promise<void>;
  resetVotes: (matchId: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [settings, setSettings] = useState<Settings>(seedSettings);
  const [votes, setVotes] = useState<Vote[]>([]);

  const loadFromSupabase = useCallback(async () => {
    if (!supabase) return;
    const [teamsRes, playersRes, matchesRes, faqRes, settingsRes, votesRes] = await Promise.all([
      supabase.from("teams").select("*").order("sort_order", { ascending: true }),
      supabase.from("players").select("*"),
      supabase.from("matches").select("*").order("stage", { ascending: true }).order("match_number", { ascending: true }),
      supabase.from("faq").select("*").order("sort_order", { ascending: true }),
      supabase.from("settings").select("*").eq("id", "main").maybeSingle(),
      supabase.from("votes").select("*"),
    ]);
    if (teamsRes.data) setTeams(teamsRes.data as Team[]);
    if (playersRes.data) setPlayers(playersRes.data as Player[]);
    if (matchesRes.data) setMatches(matchesRes.data as Match[]);
    if (faqRes.data) setFaq(faqRes.data as FaqItem[]);
    if (settingsRes.data) setSettings(settingsRes.data as unknown as Settings);
    if (votesRes.data) setVotes(votesRes.data as Vote[]);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        await loadFromSupabase();
      } catch (e) {
        console.error("Supabase load failed, falling back to local store", e);
        const local = loadLocal();
        setTeams(local.teams);
        setPlayers(local.players);
        setMatches(local.matches);
        setFaq(local.faq);
        setSettings(local.settings);
        setVotes(local.votes);
      }
    } else {
      const local = loadLocal();
      setTeams(local.teams);
      setPlayers(local.players);
      setMatches(local.matches);
      setFaq(local.faq);
      setSettings(local.settings);
      setVotes(local.votes);
    }
    setLoading(false);
  }, [loadFromSupabase]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Realtime subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("njdc-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        console.log("[Realtime] teams changed");
        loadFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => {
        console.log("[Realtime] players changed");
        loadFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        console.log("[Realtime] matches changed");
        loadFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faq" }, () => {
        console.log("[Realtime] faq changed");
        loadFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        console.log("[Realtime] settings changed");
        loadFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        console.log("[Realtime] votes changed");
        loadFromSupabase();
      })
      .subscribe((status) => {
        console.log("[Realtime] subscription status:", status);
      });
    return () => {
      console.log("[Realtime] unsubscribing");
      client.removeChannel(channel);
    };
  }, [loadFromSupabase]);

  const persistLocalPartial = useCallback(
    (partial: Partial<LocalStore>) => {
      const current: LocalStore = {
        teams,
        players,
        matches,
        faq,
        settings,
        votes,
        ...partial,
      };
      saveLocal(current);
    },
    [teams, players, matches, faq, settings, votes]
  );

  // ---------- TEAMS ----------
  const upsertTeam = useCallback(
    async (team: Team) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("teams").upsert(team);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setTeams((prev) => {
        const exists = prev.some((t) => t.id === team.id);
        const next = exists ? prev.map((t) => (t.id === team.id ? team : t)) : [...prev, team];
        persistLocalPartial({ teams: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  const deleteTeam = useCallback(
    async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("teams").delete().eq("id", id);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setTeams((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persistLocalPartial({ teams: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  // ---------- PLAYERS ----------
  const upsertPlayer = useCallback(
    async (player: Player) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("players").upsert(player);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setPlayers((prev) => {
        const exists = prev.some((p) => p.id === player.id);
        const next = exists ? prev.map((p) => (p.id === player.id ? player : p)) : [...prev, player];
        persistLocalPartial({ players: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  const deletePlayer = useCallback(
    async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("players").delete().eq("id", id);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setPlayers((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persistLocalPartial({ players: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  // ---------- MATCHES ----------
  const upsertMatch = useCallback(
    async (match: Match) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("matches").upsert(match);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setMatches((prev) => {
        const exists = prev.some((m) => m.id === match.id);
        const next = exists ? prev.map((m) => (m.id === match.id ? match : m)) : [...prev, match];
        persistLocalPartial({ matches: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  const deleteMatch = useCallback(
    async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("matches").delete().eq("id", id);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setMatches((prev) => {
        const next = prev.filter((m) => m.id !== id);
        persistLocalPartial({ matches: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  // ---------- FAQ ----------
  const upsertFaq = useCallback(
    async (item: FaqItem) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("faq").upsert(item);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setFaq((prev) => {
        const exists = prev.some((f) => f.id === item.id);
        const next = exists ? prev.map((f) => (f.id === item.id ? item : f)) : [...prev, item];
        persistLocalPartial({ faq: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  const deleteFaq = useCallback(
    async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("faq").delete().eq("id", id);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setFaq((prev) => {
        const next = prev.filter((f) => f.id !== id);
        persistLocalPartial({ faq: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  // ---------- SETTINGS ----------
  const updateSettings = useCallback(
    async (s: Settings) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("settings").upsert({ id: "main", ...s });
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setSettings(s);
      persistLocalPartial({ settings: s });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  // ---------- VOTES ----------
  const castVote = useCallback(
    async (matchId: string, teamId: string, voterId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("votes")
          .upsert({ match_id: matchId, team_choice: teamId, voter_id: voterId }, { onConflict: "match_id,voter_id" });
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setVotes((prev) => {
        const withoutOld = prev.filter((v) => !(v.match_id === matchId && v.voter_id === voterId));
        const next = [
          ...withoutOld,
          { id: uid(), match_id: matchId, team_choice: teamId, voter_id: voterId, created_at: new Date().toISOString() },
        ];
        persistLocalPartial({ votes: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  const resetVotes = useCallback(
    async (matchId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("votes").delete().eq("match_id", matchId);
        if (error) throw error;
        await loadFromSupabase();
        return;
      }
      setVotes((prev) => {
        const next = prev.filter((v) => v.match_id !== matchId);
        persistLocalPartial({ votes: next });
        return next;
      });
    },
    [loadFromSupabase, persistLocalPartial]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      loading,
      teams,
      players,
      matches,
      faq,
      settings,
      votes,
      isSupabaseConfigured,
      refresh: bootstrap,
      upsertTeam,
      deleteTeam,
      upsertPlayer,
      deletePlayer,
      upsertMatch,
      deleteMatch,
      upsertFaq,
      deleteFaq,
      updateSettings,
      castVote,
      resetVotes,
    }),
    [
      loading,
      teams,
      players,
      matches,
      faq,
      settings,
      votes,
      bootstrap,
      upsertTeam,
      deleteTeam,
      upsertPlayer,
      deletePlayer,
      upsertMatch,
      deleteMatch,
      upsertFaq,
      deleteFaq,
      updateSettings,
      castVote,
      resetVotes,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
