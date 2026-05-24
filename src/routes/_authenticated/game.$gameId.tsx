import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMap } from "@/components/GoogleMap";
import { Avatar } from "@/components/Avatar";
import { Bell, Settings, Users as UsersIcon, Share2, Sparkles } from "lucide-react";
import { formatCountdown } from "@/lib/game-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/game/$gameId")({
  component: GameScreen,
});

type Tab = "Activity" | "Players" | "Team" | "Items" | "Admin";
const TABS: Tab[] = ["Activity", "Players", "Team", "Items", "Admin"];

type GameRow = { id: string; name: string; code: string; status: string; host_id: string; current_round: number; total_rounds: number; round_ends_at: string | null };
type PlayerRow = { id: string; user_id: string; status: string; target_id: string | null; kills: number; team_id: string | null };
type ProfileLite = { id: string; username: string | null; photo_url: string | null; school: string | null };

function GameScreen() {
  const { gameId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameRow | null>(null);
  const [me, setMe] = useState<PlayerRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [tab, setTab] = useState<Tab>("Activity");
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);

  const load = async () => {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    setGame(g as GameRow);
    const { data: ps } = await supabase.from("players").select("id, user_id, status, target_id, kills, team_id").eq("game_id", gameId);
    const arr = (ps as PlayerRow[]) ?? [];
    setPlayers(arr);
    setMe(arr.find((p) => p.user_id === user?.id) ?? null);
    if (arr.length) {
      const ids = Array.from(new Set(arr.map((p) => p.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, username, photo_url, school").in("id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs as ProfileLite[] | null)?.forEach((p) => { map[p.id] = p; });
      setProfilesById(map);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [gameId, user?.id]);

  useEffect(() => {
    const ch = supabase.channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [gameId]);

  // Get the current user's geolocation (best-effort) so the map has something real to show
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }
    );
  }, []);

  // Build map markers: me + my targets (placeholder offsets when no real location-share yet)
  const targets = useMemo(() => {
    if (!me?.target_id) return [] as PlayerRow[];
    // Targets = chain follow if needed; for now show only direct target + any teammates
    const direct = players.find((p) => p.user_id === me.target_id);
    return direct ? [direct] : [];
  }, [me, players]);

  const myTargetsList = useMemo(() => {
    // Show up to 3 "targets" — direct target + a couple of nearby live players as preview
    const list: PlayerRow[] = [];
    if (me?.target_id) {
      const d = players.find((p) => p.user_id === me.target_id);
      if (d) list.push(d);
    }
    players.filter((p) => p.user_id !== user?.id && p.status === "active" && !list.includes(p))
      .slice(0, 3 - list.length)
      .forEach((p) => list.push(p));
    return list;
  }, [me, players, user?.id]);

  const center = myPos ?? { lat: 25.768, lng: -80.135 };
  const markers = useMemo(() => {
    const out: { id: string; lat: number; lng: number; label?: string; photoUrl?: string | null; ringColor?: string }[] = [];
    if (myPos && user) {
      out.push({
        id: "me",
        lat: myPos.lat,
        lng: myPos.lng,
        label: profile?.username ?? "You",
        photoUrl: profile?.photo_url ?? null,
        ringColor: "#22c55e",
      });
    }
    // Scatter targets around the center as placeholder positions (no real share yet)
    targets.forEach((t, i) => {
      const p = profilesById[t.user_id];
      const offset = 0.0015 * (i + 1);
      const angle = (i / Math.max(targets.length, 1)) * Math.PI * 2;
      out.push({
        id: t.id,
        lat: center.lat + Math.cos(angle) * offset,
        lng: center.lng + Math.sin(angle) * offset,
        label: p?.username ?? "Target",
        photoUrl: p?.photo_url ?? null,
        ringColor: "#ef4444",
      });
    });
    return out;
  }, [myPos, user, profile, targets, profilesById, center.lat, center.lng]);

  const isHost = game?.host_id === user?.id;

  const onShare = async () => {
    if (!game) return;
    const text = `Join my game "${game.name}" with code ${game.code}`;
    try {
      if ((navigator as any).share) await (navigator as any).share({ text, title: game.name });
      else { await navigator.clipboard.writeText(game.code); toast.success("Code copied"); }
    } catch {}
  };

  if (!game) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm">Loading game…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Map area */}
      <div className="relative w-full h-[58vh] min-h-[380px]">
        <GoogleMap markers={markers} center={center} className="absolute inset-0" />

        {/* Top-left floating controls */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          <button onClick={() => isHost && navigate({ to: "/admin/$gameId", params: { gameId: game.id } })}
            className="h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition">
            <Settings className="h-5 w-5 text-foreground" />
          </button>
          <button onClick={() => setTab("Players")}
            className="h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition">
            <UsersIcon className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Top-center game pill */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <button onClick={() => navigate({ to: "/home" })}
            className="bg-white shadow-md rounded-full px-4 py-2 max-w-[60vw] flex items-center gap-1 active:scale-95 transition">
            <span className="font-semibold text-sm truncate">{game.name}</span>
            <span className="text-muted-foreground text-xs">▾</span>
          </button>
        </div>

        {/* Top-right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button className="h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition">
            <Bell className="h-5 w-5 text-foreground" />
          </button>
          <button className="h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition">
            <Sparkles className="h-5 w-5 text-amber-500" />
          </button>
        </div>

        {/* Points pill bottom-right */}
        <div className="absolute bottom-3 right-3 z-10">
          <div className="bg-white shadow-md rounded-full px-4 py-2 text-sm font-semibold">
            {me?.kills ?? 0} pts
          </div>
        </div>
      </div>

      {/* Sheet area */}
      <div className="flex-1 -mt-4 relative z-20 bg-surface rounded-t-3xl border-t border-border pt-2 pb-28 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="h-1 w-12 mx-auto bg-border rounded-full mb-3" />

        {/* Tabs row */}
        <div className="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar">
          <Link to="/profile" className="shrink-0">
            <Avatar name={profile?.username} url={profile?.photo_url} size={40} ring="primary" />
          </Link>
          {TABS.map((t) => {
            const active = t === tab;
            const visible = t !== "Admin" || isHost;
            if (!visible) return null;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition
                  ${active
                    ? "border-primary text-primary bg-primary/5"
                    : "border-border text-foreground/80 bg-card"}`}>
                {t}
              </button>
            );
          })}
        </div>

        {/* Stats strip */}
        <div className="mt-4 px-4">
          <div className="flex items-stretch gap-3 border-y border-border py-3">
            <StatCell label="Round" value={`${game.current_round}`} />
            <Divider />
            <StatCell label="Time Left" value={formatCountdown(game.round_ends_at)} />
            <Divider />
            <StatCell label="Game Code" value={game.code} trailing={
              <button onClick={onShare} className="ml-1 h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Share2 className="h-3.5 w-3.5" />
              </button>
            } />
            <Divider />
            <StatCell label="Team" value="" trailing={
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                <UsersIcon className="h-4 w-4 text-foreground/70" />
              </div>
            } />
          </div>
        </div>

        {/* Tab body */}
        <div className="px-4 mt-4">
          {tab === "Activity" && (
            <ActivitySection myTargets={myTargetsList} profilesById={profilesById} />
          )}
          {tab === "Players" && (
            <PlayersSection players={players} profilesById={profilesById} />
          )}
          {tab === "Team" && (
            <EmptyHint title="No team yet" body="Join or create a team to coordinate with friends." />
          )}
          {tab === "Items" && (
            <EmptyHint title="No items" body="Power-ups and gear will show up here." />
          )}
          {tab === "Admin" && isHost && (
            <button onClick={() => navigate({ to: "/admin/$gameId", params: { gameId: game.id } })}
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3.5 rounded-2xl shadow-glow-primary">
              Open admin panel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, trailing }: { label: string; value: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {value && <p className="font-display font-bold text-sm truncate">{value}</p>}
        {trailing}
      </div>
    </div>
  );
}

function Divider() { return <div className="w-px bg-border" />; }

function ActivitySection({ myTargets, profilesById }: { myTargets: PlayerRow[]; profilesById: Record<string, ProfileLite> }) {
  return (
    <div>
      <h3 className="text-sm text-muted-foreground mb-3">My Targets</h3>
      {myTargets.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No active targets yet.</p>
      ) : (
        <div className="flex items-start gap-5">
          {myTargets.map((t) => {
            const p = profilesById[t.user_id];
            return (
              <Link key={t.id} to="/target" className="flex flex-col items-center gap-1.5 active:scale-95 transition">
                <Avatar name={p?.username} url={p?.photo_url} size={64} ring="danger" />
                <span className="text-sm font-medium">{p?.username ?? "Player"}</span>
                <div className="h-3 w-8 bg-success rounded-sm" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayersSection({ players, profilesById }: { players: PlayerRow[]; profilesById: Record<string, ProfileLite> }) {
  return (
    <div className="space-y-2">
      {players.map((p) => {
        const prof = profilesById[p.user_id];
        return (
          <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-2xl p-2.5">
            <Avatar name={prof?.username} url={prof?.photo_url} size={40} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">@{prof?.username ?? "player"}</p>
              <p className="text-xs text-muted-foreground">{p.status} · {p.kills} kills</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-8">
      <p className="font-display font-bold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </div>
  );
}
