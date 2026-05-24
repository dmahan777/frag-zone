import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { assignTargetsForGame } from "@/lib/assign-targets";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, Check, X, Megaphone, Shuffle, Trash2, Crown, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$gameId")({
  component: AdminPage,
});

type Game = { id: string; name: string; code: string; host_id: string; status: string; mode: string; current_round: number; total_rounds: number };
type Player = { id: string; user_id: string; status: string; kills: number; target_id: string | null };
type Elim = { id: string; game_id: string; eliminator_id: string; eliminated_id: string; status: string; created_at: string };
type Profile = { id: string; username: string | null; photo_url: string | null; school: string | null };

function AdminPage() {
  const { gameId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [pendingElims, setPendingElims] = useState<Elim[]>([]);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const load = async () => {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    setGame(g as Game);
    const { data: ps } = await supabase.from("players").select("id, user_id, status, kills, target_id").eq("game_id", gameId);
    setPlayers((ps as Player[]) ?? []);
    const ids = (ps ?? []).map((p: any) => p.user_id);
    if (ids.length) {
      const { data: pr } = await supabase.from("profiles").select("id, username, photo_url, school").in("id", ids);
      const map: Record<string, Profile> = {};
      (pr ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    const { data: es } = await supabase.from("eliminations").select("*").eq("game_id", gameId).eq("status", "pending").order("created_at", { ascending: false });
    setPendingElims((es as Elim[]) ?? []);
  };

  useEffect(() => { load(); }, [gameId]);

  useEffect(() => {
    const ch = supabase.channel(`admin-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "eliminations", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  if (!game) {
    return (
      <div className="px-5 pt-16 text-center text-muted-foreground">Loading game…</div>
    );
  }

  const isHost = game.host_id === user?.id;
  if (!isHost) {
    return (
      <div className="px-5 pt-16 text-center">
        <p className="font-display text-lg">Host only</p>
        <p className="text-sm text-muted-foreground mt-1">You're not the host of this game.</p>
        <Link to="/home" className="inline-block mt-4 text-primary text-sm font-semibold">← Back home</Link>
      </div>
    );
  }

  const startGame = async () => {
    if (players.length < 2) { toast.error("Need at least 2 players"); return; }
    setBusy(true);
    try {
      const count = await assignTargetsForGame(game.id);
      const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("games").update({ status: "active", current_round: 1, round_ends_at: endsAt }).eq("id", game.id);
      await supabase.from("events").insert({ game_id: game.id, type: "system", message: `🎯 Round 1 started — ${count} players in the chain`, created_by: user!.id });
      toast.success("Game live. Targets assigned.");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const reshuffle = async () => {
    setBusy(true);
    try {
      const count = await assignTargetsForGame(game.id);
      await supabase.from("events").insert({ game_id: game.id, type: "system", message: `🔀 Targets reshuffled — ${count} players`, created_by: user!.id });
      toast.success("Targets reshuffled");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const togglePause = async () => {
    const next = game.status === "active" ? "paused" : "active";
    await supabase.from("games").update({ status: next }).eq("id", game.id);
    await supabase.from("events").insert({ game_id: game.id, type: "system", message: next === "paused" ? "⏸ Game paused" : "▶ Game resumed", created_by: user!.id });
  };

  const endGame = async () => {
    if (!confirm("End this game? Players will see final standings.")) return;
    await supabase.from("games").update({ status: "ended" }).eq("id", game.id);
    await supabase.from("events").insert({ game_id: game.id, type: "system", message: "🏁 Game over", created_by: user!.id });
    toast.success("Game ended");
  };

  const confirmElim = async (e: Elim) => {
    setBusy(true);
    try {
      // Mark eliminated player & reassign target chain
      const elimPlayer = players.find(p => p.user_id === e.eliminated_id);
      const killer = players.find(p => p.user_id === e.eliminator_id);
      if (!elimPlayer || !killer) throw new Error("Player not found");

      // Pass eliminated player's target to killer
      await supabase.from("players").update({
        status: "eliminated",
        target_id: null,
      }).eq("id", elimPlayer.id);

      await supabase.from("players").update({
        kills: (killer.kills ?? 0) + 1,
        target_id: elimPlayer.target_id,
      }).eq("id", killer.id);

      await supabase.from("eliminations").update({ status: "confirmed", points_awarded: 10 }).eq("id", e.id);

      const killerName = profiles[e.eliminator_id]?.username ?? "?";
      const victimName = profiles[e.eliminated_id]?.username ?? "?";
      await supabase.from("events").insert({
        game_id: game.id, type: "elimination", created_by: user!.id,
        message: `💀 @${killerName} fragged @${victimName}`,
      });
      toast.success("Confirmed");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const rejectElim = async (e: Elim) => {
    await supabase.from("eliminations").update({ status: "rejected" }).eq("id", e.id);
    toast.success("Rejected");
  };

  const overridePlayer = async (p: Player, newStatus: "active" | "eliminated" | "safe") => {
    await supabase.from("players").update({ status: newStatus }).eq("id", p.id);
    const name = profiles[p.user_id]?.username ?? "?";
    await supabase.from("events").insert({
      game_id: game.id, type: "system", created_by: user!.id,
      message: `⚙ Admin set @${name} → ${newStatus}`,
    });
  };

  const kickPlayer = async (p: Player) => {
    if (!confirm(`Kick @${profiles[p.user_id]?.username ?? "player"}?`)) return;
    await supabase.from("players").delete().eq("id", p.id);
  };

  const sendAnnouncement = async () => {
    if (!announcement.trim()) return;
    await supabase.from("events").insert({
      game_id: game.id, type: "announcement", created_by: user!.id,
      message: `📣 ${announcement.trim()}`,
    });
    setAnnouncement("");
    toast.success("Sent");
  };

  const aliveCount = players.filter(p => p.status === "active").length;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/home" })} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1"><Crown className="h-3 w-3" /> Admin</p>
          <h1 className="font-display text-xl font-extrabold truncate">{game.name}</h1>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">#{game.code}</span>
      </div>

      {/* Game controls */}
      <div className="px-5">
        <div className="bg-gradient-to-br from-card to-secondary/10 border border-border rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Status</p>
              <p className="font-display text-2xl font-extrabold capitalize">{game.status}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Alive</p>
              <p className="font-display text-2xl font-extrabold">{aliveCount}<span className="text-muted-foreground text-sm">/{players.length}</span></p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {game.status === "lobby" ? (
              <button disabled={busy} onClick={startGame} className="col-span-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3.5 rounded-2xl shadow-glow-primary disabled:opacity-50 flex items-center justify-center gap-2">
                <Play className="h-4 w-4" /> Start game
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={togglePause} className="bg-card border border-border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5">
                  {game.status === "paused" ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}
                </button>
                <button disabled={busy} onClick={reshuffle} className="bg-card border border-border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5">
                  <Shuffle className="h-3.5 w-3.5" /> Reshuffle
                </button>
                <button disabled={busy} onClick={endGame} className="col-span-2 bg-danger/10 border border-danger/30 text-danger rounded-xl py-2.5 text-sm font-semibold">
                  End game
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pending eliminations */}
      <div className="px-5 mt-6">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Pending frags ({pendingElims.length})</h3>
        {pendingElims.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No reports awaiting confirmation.</p>
        ) : (
          <div className="space-y-2">
            {pendingElims.map((e) => {
              const killer = profiles[e.eliminator_id];
              const victim = profiles[e.eliminated_id];
              return (
                <div key={e.id} className="bg-card border border-border rounded-2xl p-3 animate-float-in">
                  <div className="flex items-center gap-3">
                    <Avatar name={killer?.username} url={killer?.photo_url} size={36} ring="primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">@{killer?.username} <span className="text-muted-foreground font-normal">fragged</span> @{victim?.username}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <button disabled={busy} onClick={() => rejectElim(e)} className="h-9 w-9 rounded-lg bg-danger/10 border border-danger/30 text-danger flex items-center justify-center">
                      <X className="h-4 w-4" />
                    </button>
                    <button disabled={busy} onClick={() => confirmElim(e)} className="h-9 w-9 rounded-lg bg-success/15 border border-success/40 text-success flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Announcement */}
      <div className="px-5 mt-6">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Broadcast</h3>
        <div className="flex gap-2">
          <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="Announcement to all players…" maxLength={140}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
          <button onClick={sendAnnouncement} disabled={!announcement.trim()} className="h-12 w-12 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center disabled:opacity-40">
            <Megaphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="px-5 mt-6">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Players ({players.length})
        </h3>
        <div className="space-y-2">
          {players.map((p) => {
            const prof = profiles[p.user_id];
            return (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={prof?.username} url={prof?.photo_url} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">@{prof?.username ?? "unknown"} {p.user_id === game.host_id && <Crown className="inline h-3 w-3 text-secondary ml-1" />}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={p.status} size="sm" />
                      <span className="text-[10px] text-muted-foreground">{p.kills} kills</span>
                    </div>
                  </div>
                  <select
                    value={p.status}
                    onChange={(e) => overridePlayer(p, e.target.value as any)}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="safe">Safe</option>
                    <option value="eliminated">Eliminated</option>
                  </select>
                  {p.user_id !== game.host_id && (
                    <button onClick={() => kickPlayer(p)} className="h-8 w-8 rounded-lg bg-danger/10 border border-danger/30 text-danger flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
