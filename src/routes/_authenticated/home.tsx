import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCountdown, generateGameCode } from "@/lib/game-utils";
import { toast } from "sonner";
import { Crosshair, Plus, LogIn, Users, Clock, ChevronRight, Megaphone, Zap, Skull } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

type GameRow = { id: string; name: string; code: string; status: string; host_id: string; current_round: number; total_rounds: number; round_ends_at: string | null };
type PlayerRow = { id: string; game_id: string; status: string; target_id: string | null; kills: number; user_id: string };
type EventRow = { id: string; type: string; message: string; created_at: string; game_id: string };

function HomePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activePlayer, setActivePlayer] = useState<PlayerRow | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [aliveCount, setAliveCount] = useState(0);
  const [targetProfile, setTargetProfile] = useState<{ username: string | null; photo_url: string | null; school: string | null } | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [showJoinCreate, setShowJoinCreate] = useState(false);

  // Load current game (most recent active membership)
  const load = async () => {
    if (!user) return;
    const { data: pdata } = await supabase
      .from("players")
      .select("id, game_id, status, target_id, kills, user_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pdata) { setActivePlayer(null); setGame(null); return; }
    setActivePlayer(pdata as PlayerRow);
    const { data: gdata } = await supabase.from("games").select("*").eq("id", pdata.game_id).maybeSingle();
    setGame(gdata as GameRow);

    const { count } = await supabase.from("players").select("id", { count: "exact", head: true })
      .eq("game_id", pdata.game_id).eq("status", "active");
    setAliveCount(count ?? 0);

    if (pdata.target_id) {
      const { data: tp } = await supabase.from("profiles").select("username, photo_url, school").eq("id", pdata.target_id).maybeSingle();
      setTargetProfile(tp as any);
    } else {
      setTargetProfile(null);
    }

    const { data: evs } = await supabase.from("events").select("*").eq("game_id", pdata.game_id).order("created_at", { ascending: false }).limit(20);
    setEvents((evs as EventRow[]) ?? []);
  };

  useEffect(() => { load(); }, [user]);

  // Realtime subscriptions
  useEffect(() => {
    if (!game?.id) return;
    const ch = supabase.channel(`home-${game.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `game_id=eq.${game.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${game.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${game.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [game?.id]);

  // If user has an active game, the home screen IS the game screen
  if (game) {
    return <Navigate to="/game/$gameId" params={{ gameId: game.id }} replace />;
  }

  return (
    <div>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <Link to="/profile" className="flex items-center gap-3">
          <Avatar name={profile?.username} url={profile?.photo_url} size={42} ring="primary" />
          <div>
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <p className="font-display font-bold text-lg leading-tight">@{profile?.username}</p>
          </div>
        </Link>
        {activePlayer && <StatusBadge status={activePlayer.status} />}
      </div>

      {/* Empty state — user has no active game */}
      <div className="px-5">
        <EmptyGameState onOpen={() => setShowJoinCreate(true)} />
      </div>

      {showJoinCreate && <JoinCreateModal onClose={() => setShowJoinCreate(false)} onJoined={() => { setShowJoinCreate(false); load(); }} />}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-background/40 rounded-xl p-2.5 border border-border">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="font-display font-bold text-lg mt-0.5">{value}</p>
    </div>
  );
}

function EventItem({ ev }: { ev: EventRow }) {
  const icon = ev.type === "elimination" ? <Skull className="h-4 w-4 text-danger" />
    : ev.type === "powerup" ? <Zap className="h-4 w-4 text-primary" />
    : ev.type === "announcement" ? <Megaphone className="h-4 w-4 text-secondary" />
    : <Crosshair className="h-4 w-4 text-muted-foreground" />;
  return (
    <div className="flex items-start gap-3 bg-card border border-border rounded-2xl p-3 animate-float-in">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{ev.message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </div>
  );
}

function EmptyGameState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 text-center animate-float-in">
      <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <Crosshair className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mt-4 font-display text-xl font-bold">No active game</h3>
      <p className="text-sm text-muted-foreground mt-1">Create a lobby or join with a code.</p>
      <button onClick={onOpen} className="mt-5 w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3.5 rounded-2xl shadow-glow-primary active:scale-[0.98] transition">
        Get in a game
      </button>
    </div>
  );
}

function JoinCreateModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const join = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: g, error } = await supabase.from("games").select("*").eq("code", code.toUpperCase()).maybeSingle();
      if (error || !g) throw new Error("Game not found");
      const { error: pe } = await supabase.from("players").insert({ game_id: g.id, user_id: user.id });
      if (pe && !pe.message.includes("duplicate")) throw pe;
      await supabase.from("events").insert({ game_id: g.id, type: "system", message: `@${profile?.username} joined the game`, created_by: user.id });
      toast.success(`Joined ${g.name}`);
      onJoined();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const create = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const code = generateGameCode();
      const { data: g, error } = await supabase.from("games").insert({
        name: name || "Untitled Game",
        code,
        host_id: user.id,
        mode: "solo",
        total_rounds: 5,
      }).select().single();
      if (error) throw error;
      await supabase.from("players").insert({ game_id: g.id, user_id: user.id });
      await supabase.from("events").insert({ game_id: g.id, type: "system", message: `Lobby opened by @${profile?.username}`, created_by: user.id });
      toast.success(`Lobby created · ${code}`);
      onJoined();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[430px] bg-surface border-t border-border rounded-t-3xl p-6 pb-10 animate-float-in">
        <div className="h-1 w-12 mx-auto bg-border rounded-full mb-5" />
        <div className="grid grid-cols-2 gap-2 bg-card rounded-xl p-1">
          <button onClick={() => setTab("join")} className={`py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${tab === "join" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <LogIn className="h-4 w-4" /> Join
          </button>
          <button onClick={() => setTab("create")} className={`py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${tab === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>

        {tab === "join" ? (
          <div className="mt-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Game code</p>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABCD12" className="w-full bg-card border border-border rounded-2xl px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] focus:outline-none focus:border-primary uppercase" />
            <button disabled={loading || code.length !== 6} onClick={join} className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-4 rounded-2xl shadow-glow-primary disabled:opacity-50">{loading ? "..." : "Join game"}</button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Game name</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Showdown" maxLength={40} className="w-full bg-card border border-border rounded-2xl px-4 py-4 focus:outline-none focus:border-primary" />
            <button disabled={loading} onClick={create} className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-4 rounded-2xl shadow-glow-primary disabled:opacity-50">{loading ? "..." : "Create lobby"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
