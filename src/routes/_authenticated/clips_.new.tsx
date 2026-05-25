import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Upload, Video, Loader2, Crosshair, Flame, DollarSign, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clips_/new")({
  component: NewClipPage,
});

type GameLite = { id: string; name: string; host_id: string; purge_enabled: boolean; status: string };
type PlayerLite = { id: string; user_id: string; status: string; target_id: string | null; team_id: string | null };
type ProfileLite = { id: string; username: string | null; display_name: string | null; photo_url: string | null };

type KillType = "target" | "purge" | "bounty" | "other";

function NewClipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [games, setGames] = useState<GameLite[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});

  const [eliminatedId, setEliminatedId] = useState<string | null>(null);
  const [killType, setKillType] = useState<KillType>("target");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Load games the user is in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ps } = await supabase.from("players").select("game_id").eq("user_id", user.id);
      const ids = Array.from(new Set((ps ?? []).map((p: any) => p.game_id))).filter(Boolean);
      if (!ids.length) { setGames([]); return; }
      const { data: gs } = await supabase
        .from("games")
        .select("id,name,host_id,purge_enabled,status")
        .in("id", ids);
      const arr = (gs as GameLite[]) ?? [];
      setGames(arr);
      if (arr.length === 1) setGameId(arr[0].id);
    })();
  }, [user]);

  // Load players for selected game
  useEffect(() => {
    if (!gameId) { setPlayers([]); setProfiles({}); return; }
    (async () => {
      const { data: ps } = await supabase
        .from("players")
        .select("id,user_id,status,target_id,team_id")
        .eq("game_id", gameId);
      const arr = (ps as PlayerLite[]) ?? [];
      setPlayers(arr);
      const ids = Array.from(new Set(arr.map((p) => p.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,display_name,photo_url")
          .in("id", ids);
        const map: Record<string, ProfileLite> = {};
        (profs as ProfileLite[] | null)?.forEach((p) => { map[p.id] = p; });
        setProfiles(map);
      }
    })();
  }, [gameId]);

  const me = players.find((p) => p.user_id === user?.id) ?? null;
  const myTargetUserId = me?.target_id
    ? players.find((p) => p.id === me.target_id)?.user_id ?? null
    : null;
  const game = games.find((g) => g.id === gameId) ?? null;

  // Eligible targets depending on kill type
  const eligible: PlayerLite[] = (() => {
    if (!me) return [];
    if (killType === "target") {
      const t = players.find((p) => p.user_id === myTargetUserId);
      return t ? [t] : [];
    }
    if (killType === "purge" || killType === "bounty") {
      return players.filter((p) => p.user_id !== user?.id && p.status === "active");
    }
    return players.filter((p) => p.user_id !== user?.id);
  })();

  // Auto-pick the only valid target
  useEffect(() => {
    if (killType === "target" && eligible.length === 1) {
      setEliminatedId(eligible[0].id);
    } else if (eligible.length && !eligible.find((p) => p.id === eliminatedId)) {
      setEliminatedId(null);
    }
  }, [killType, gameId, players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024 * 1024) { toast.error("Clip must be under 2GB"); return; }
    setFile(f);
  };

  const submit = async () => {
    if (!user) return;
    if (!gameId) { toast.error("Pick a game"); return; }
    if (!eliminatedId) { toast.error("Pick who you eliminated"); return; }
    if (!file) { toast.error("Upload a clip video"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/clip-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("clips")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("clips").getPublicUrl(path);
      const target = players.find((p) => p.id === eliminatedId);
      const { error: insErr } = await supabase.from("clips").insert({
        user_id: user.id,
        video_url: pub.publicUrl,
        game_id: gameId,
        eliminated_id: target?.user_id ?? null,
        kill_type: killType,
        description: description.trim() || null,
        caption: description.trim() || null,
        status: "pending",
      } as never);
      if (insErr) throw insErr;
      toast.success("Clip submitted — waiting for host approval");
      navigate({ to: "/clips" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const KILL_TYPES: { key: KillType; label: string; icon: typeof Crosshair; hint: string }[] = [
    { key: "target", label: "My target", icon: Crosshair, hint: "Person you were assigned" },
    { key: "purge", label: "Purge", icon: Flame, hint: "Anyone during purge" },
    { key: "bounty", label: "Bounty", icon: DollarSign, hint: "Player with a bounty" },
    { key: "other", label: "Other", icon: MoreHorizontal, hint: "Anything else" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <div className="flex items-center justify-between px-4 pt-3">
        <button
          onClick={() => navigate({ to: "/clips" })}
          className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display font-extrabold text-lg">New clip</h1>
        <div className="h-10 w-10" />
      </div>

      <div className="px-5 mt-5 space-y-5">
        {/* Game picker */}
        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-surface border border-border rounded-2xl p-4 text-center">
            Join a game first to upload a clip.
          </p>
        ) : games.length > 1 ? (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Game</p>
            <select
              value={gameId ?? ""}
              onChange={(e) => setGameId(e.target.value || null)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Pick a game…</option>
              {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        ) : game ? (
          <p className="text-xs text-muted-foreground">Game: <span className="font-semibold text-foreground">{game.name}</span></p>
        ) : null}

        {/* Kill type */}
        {gameId && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Elimination type</p>
            <div className="grid grid-cols-2 gap-2">
              {KILL_TYPES.map(({ key, label, icon: Icon, hint }) => {
                const active = killType === key;
                return (
                  <button
                    key={key}
                    onClick={() => setKillType(key)}
                    className={`flex items-start gap-2 text-left p-3 rounded-xl border transition ${active ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Eligible targets */}
        {gameId && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Who did you eliminate?</p>
            {eligible.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-surface border border-border rounded-xl p-3">
                {killType === "target" ? "You don't have an assigned target yet." : "No eligible players."}
              </p>
            ) : (
              <ul className="space-y-2">
                {eligible.map((p) => {
                  const prof = profiles[p.user_id];
                  const name = prof?.username || prof?.display_name || "Player";
                  const active = eliminatedId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setEliminatedId(p.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition ${active ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                      >
                        <Avatar name={name} url={prof?.photo_url} size={40} ring={active ? "primary" : "none"} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-semibold text-sm truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{p.status}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Description */}
        {gameId && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Description (optional)</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell the story behind the clip…"
              maxLength={500}
              rows={3}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>
        )}

        {/* File */}
        {gameId && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Video</p>
            {file ? (
              <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-3 text-sm">
                <Video className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1 font-medium">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-xs text-muted-foreground">Change</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-sm">Pick video</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPickFile} />
          </div>
        )}

        {/* Submit */}
        {gameId && (
          <button
            onClick={submit}
            disabled={busy || !eliminatedId || !file}
            className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3.5 rounded-2xl shadow-glow-primary disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Submitting…" : "Submit for review"}
          </button>
        )}
      </div>
    </div>
  );
}
