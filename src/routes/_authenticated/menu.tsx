import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateGameCode } from "@/lib/game-utils";
import { requestLocationOnce } from "@/lib/location";
import { toast } from "sonner";
import { Plus, LogIn, ChevronRight, Gamepad2, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MainMenu,
});

type GameRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  host_id: string;
};

function MainMenu() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<null | "join" | "create">(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ps } = await supabase
      .from("players")
      .select("game_id, joined_at")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });
    const ids = Array.from(new Set((ps ?? []).map((p) => p.game_id)));
    if (!ids.length) {
      setGames([]);
      setLoading(false);
      return;
    }
    const { data: gs } = await supabase
      .from("games")
      .select("id, name, code, status, host_id")
      .in("id", ids);
    // preserve join order
    const byId = new Map<string, GameRow>(((gs as GameRow[]) ?? []).map((g) => [g.id, g]));
    setGames(ids.map((id) => byId.get(id)).filter(Boolean) as GameRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const join = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // Require location permission before joining
      let loc: { lat: number; lng: number; accuracy: number };
      try {
        loc = await requestLocationOnce();
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
      const { data: g, error } = await supabase
        .from("games")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (error || !g) throw new Error("Game not found");
      const { error: pe } = await supabase
        .from("players")
        .insert({ game_id: g.id, user_id: user.id });
      if (pe && !pe.message.includes("duplicate")) throw pe;
      await supabase.from("player_locations").upsert(
        { user_id: user.id, game_id: g.id, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, updated_at: new Date().toISOString() },
        { onConflict: "user_id,game_id" }
      );
      await supabase.from("events").insert({
        game_id: g.id,
        type: "system",
        message: `@${profile?.username} joined the game`,
        created_by: user.id,
      });
      toast.success(`Joined ${g.name}`);
      navigate({ to: "/game/$gameId", params: { gameId: g.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let loc: { lat: number; lng: number; accuracy: number };
      try {
        loc = await requestLocationOnce();
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
      const newCode = generateGameCode();
      const { data: g, error } = await supabase
        .from("games")
        .insert({
          name: name || "Untitled Game",
          code: newCode,
          host_id: user.id,
          mode: "solo",
          total_rounds: 5,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("players").insert({ game_id: g.id, user_id: user.id });
      await supabase.from("player_locations").upsert(
        { user_id: user.id, game_id: g.id, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, updated_at: new Date().toISOString() },
        { onConflict: "user_id,game_id" }
      );
      await supabase.from("events").insert({
        game_id: g.id,
        type: "system",
        message: `Lobby opened by @${profile?.username}`,
        created_by: user.id,
      });
      toast.success(`Lobby created · ${newCode}`);
      navigate({ to: "/game/$gameId", params: { gameId: g.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <div className="px-5 pt-12 pb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Main menu</p>
        <h1 className="font-display text-3xl font-extrabold mt-1">Choose your game</h1>
      </div>

      {/* Actions */}
      <div className="px-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => { setMode(mode === "create" ? null : "create"); setCode(""); }}
          className="rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground p-5 text-left shadow-glow-primary active:scale-[0.98] transition"
        >
          <Plus className="h-6 w-6" />
          <p className="font-display font-extrabold text-lg mt-2">Create game</p>
          <p className="text-xs opacity-90">Host a new lobby</p>
        </button>
        <button
          onClick={() => { setMode(mode === "join" ? null : "join"); setName(""); }}
          className="rounded-2xl bg-surface border border-border p-5 text-left active:scale-[0.98] transition"
        >
          <LogIn className="h-6 w-6 text-primary" />
          <p className="font-display font-extrabold text-lg mt-2">Join a game</p>
          <p className="text-xs text-muted-foreground">Enter a 6-letter code</p>
        </button>
      </div>

      {/* Inline panel */}
      {mode === "join" && (
        <div className="px-5 mt-4 animate-float-in">
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Game code</p>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABCD12"
              className="w-full bg-card border border-border rounded-2xl px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] focus:outline-none focus:border-primary uppercase"
            />
            <button
              disabled={busy || code.length !== 6}
              onClick={join}
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3 rounded-2xl shadow-glow-primary disabled:opacity-50"
            >
              {busy ? "..." : "Join game"}
            </button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="px-5 mt-4 animate-float-in">
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Game name</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Showdown"
              maxLength={40}
              className="w-full bg-card border border-border rounded-2xl px-4 py-4 focus:outline-none focus:border-primary"
            />
            <button
              disabled={busy}
              onClick={create}
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3 rounded-2xl shadow-glow-primary disabled:opacity-50"
            >
              {busy ? "..." : "Create lobby"}
            </button>
          </div>
        </div>
      )}

      {/* Your games */}
      <div className="px-5 mt-8">
        <h2 className="font-display font-extrabold text-xl">Your games</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Tap to jump back in.</p>

        <div className="mt-4 space-y-2">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
          {!loading && games.length === 0 && (
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <Gamepad2 className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">You're not in any games yet.</p>
            </div>
          )}
          {!loading && games.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate({ to: "/game/$gameId", params: { gameId: g.id } })}
              className="w-full flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 text-left active:scale-[0.99] transition"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                <Gamepad2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  Code {g.code} · {g.status}
                  {g.host_id === user?.id ? " · Host" : ""}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
