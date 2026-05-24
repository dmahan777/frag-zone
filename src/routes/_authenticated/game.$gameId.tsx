import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMap } from "@/components/GoogleMap";
import { Avatar } from "@/components/Avatar";
import { Bell, Settings, Users as UsersIcon, Share2, Shield, Search, ChevronLeft } from "lucide-react";
import { formatCountdown } from "@/lib/game-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/game/$gameId")({
  component: GameScreen,
});

type Tab = "Activity" | "Players" | "Team" | "Powerups" | "Admin";
const TABS: Tab[] = ["Activity", "Players", "Team", "Powerups", "Admin"];

type GameRow = { id: string; name: string; code: string; status: string; host_id: string; current_round: number; total_rounds: number; round_ends_at: string | null };
type PlayerRow = { id: string; user_id: string; status: string; target_id: string | null; kills: number; team_id: string | null };
type ProfileLite = { id: string; username: string | null; photo_url: string | null; school: string | null };

type PlayerFilter = "All" | "Active" | "Targets" | "Bounties";

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

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }
    );
  }, []);

  const targets = useMemo(() => {
    if (!me?.target_id) return [] as PlayerRow[];
    const direct = players.find((p) => p.user_id === me.target_id);
    return direct ? [direct] : [];
  }, [me, players]);

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
        ringColor: "#ffffff",
      });
    }
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
      <div className="relative w-full h-[52vh] min-h-[360px]">
        <GoogleMap markers={markers} center={center} className="absolute inset-0" />

        {/* Top-left floating controls */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          <FloatBtn onClick={() => isHost && navigate({ to: "/admin/$gameId", params: { gameId: game.id } })}>
            <Settings className="h-5 w-5 text-primary" />
          </FloatBtn>
          <FloatBtn onClick={() => setTab("Players")}>
            <UsersIcon className="h-5 w-5 text-secondary" />
          </FloatBtn>
        </div>

        {/* Top-center game pill */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <button onClick={() => navigate({ to: "/home" })}
            className="bg-white shadow-md rounded-full px-4 py-2 max-w-[60vw] flex items-center gap-1.5 active:scale-95 transition">
            <span className="font-semibold text-sm text-foreground/90 truncate" style={{ color: "#0A0C12" }}>{game.name}</span>
            <span className="text-primary text-xs">▾</span>
          </button>
        </div>

        {/* Top-right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <FloatBtn>
            <Bell className="h-5 w-5 text-primary" />
          </FloatBtn>
          <FloatBtn>
            <Shield className="h-5 w-5 text-secondary" />
          </FloatBtn>
        </div>

        {/* Points pill bottom-right */}
        <div className="absolute bottom-3 right-3 z-10">
          <div className="bg-white shadow-md rounded-full px-4 py-2 text-sm font-semibold" style={{ color: "#0A0C12" }}>
            {me?.kills ?? 0} pts
          </div>
        </div>
      </div>

      {/* Sheet area */}
      <div className="flex-1 -mt-5 relative z-20 bg-surface rounded-t-3xl border-t border-border pt-2 pb-28">
        <div className="h-1 w-12 mx-auto bg-border rounded-full mb-3" />

        {/* Tabs row */}
        <div className="flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide">
          <Link to="/profile" className="shrink-0">
            <Avatar name={profile?.username} url={profile?.photo_url} size={40} ring="danger" />
          </Link>
          {TABS.map((t) => {
            const active = t === tab && t !== "Activity";
            const visible = t !== "Admin" || isHost;
            if (!visible) return null;
            return (
              <button
                key={t}
                onClick={() => {
                  if (t === "Activity") navigate({ to: "/feed" });
                  else setTab(t);
                }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition
                  ${active
                    ? "border-transparent text-foreground bg-transparent"
                    : "border-border text-foreground/70 bg-transparent"}`}
                style={active ? { background: "linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(90deg, #FF5FA0, #00E5FF, #4D8FFF) border-box", border: "1.5px solid transparent" } : undefined}
              >
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
              <button onClick={onShare} className="ml-1 h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Share2 className="h-3.5 w-3.5" />
              </button>
            } />
            <Divider />
            <StatCell label="Team" value="" trailing={
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                <UsersIcon className="h-4 w-4 text-foreground/70" />
              </div>
            } />
          </div>
        </div>

        {/* Tab body — swipe left/right to switch tabs */}
        <SwipeTabs
          tab={tab}
          setTab={setTab}
          tabs={TABS.filter((t) => t !== "Admin" || isHost)}
          className="px-4 mt-4"
        >
          {tab === "Activity" && <ActivitySection />}
          {tab === "Players" && (
            <PlayersSection players={players} profilesById={profilesById} meId={user?.id ?? null} meTargetId={me?.target_id ?? null} />
          )}
          {tab === "Team" && (
            <EmptyHint title="No team yet" body="Join or create a team to coordinate with friends." />
          )}
          {tab === "Powerups" && (
            <EmptyHint title="No powerups" body="Power-ups and gear will show up here." />
          )}
          {tab === "Admin" && isHost && (
            <button onClick={() => navigate({ to: "/admin/$gameId", params: { gameId: game.id } })}
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3.5 rounded-2xl shadow-glow-primary">
              Open admin panel
            </button>
          )}
        </SwipeTabs>
      </div>
    </div>
  );
}

function SwipeTabs({ tab, setTab, tabs, className, children }: { tab: Tab; setTab: (t: Tab) => void; tabs: Tab[]; className?: string; children: React.ReactNode }) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    startX.current = null;
    startY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const idx = tabs.indexOf(tab);
    if (idx === -1) return;
    if (dx < 0 && idx < tabs.length - 1) setTab(tabs[idx + 1]);
    if (dx > 0 && idx > 0) setTab(tabs[idx - 1]);
  };
  return (
    <div className={className} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div key={tab} className="animate-fade-in">
        {children}
      </div>
    </div>
  );
}

function FloatBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="h-11 w-11 rounded-full bg-card border border-border shadow-card flex items-center justify-center active:scale-95 transition">
      {children}
    </button>
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

function ActivitySection() {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-display font-extrabold text-xs">S</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Splashin Team</p>
          <p className="text-sm text-muted-foreground mt-0.5">Keep your friends close and your floaties closer 🐱</p>
        </div>
      </div>
      <div className="text-center pt-4">
        <button className="text-sm text-muted-foreground underline underline-offset-4">Need help?</button>
      </div>
    </div>
  );
}

function PlayersSection({ players, profilesById, meId, meTargetId }: { players: PlayerRow[]; profilesById: Record<string, ProfileLite>; meId: string | null; meTargetId: string | null }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("All");

  const counts = useMemo(() => ({
    All: players.length,
    Active: players.filter((p) => p.status === "active").length,
    Targets: meTargetId ? 1 : 0,
    Bounties: 0,
  }), [players, meTargetId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = players;
    if (filter === "Active") arr = arr.filter((p) => p.status === "active");
    if (filter === "Targets") arr = arr.filter((p) => p.user_id === meTargetId);
    if (filter === "Bounties") arr = [];
    if (needle) {
      arr = arr.filter((p) => {
        const prof = profilesById[p.user_id];
        return [prof?.username, p.team_id].filter(Boolean).some((s) => (s as string).toLowerCase().includes(needle));
      });
    }
    return arr;
  }, [players, profilesById, filter, q, meTargetId]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlayerRow[]>();
    for (const p of filtered) {
      const key = p.team_id ?? "Free agents";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const ringFor = (p: PlayerRow): "primary" | "danger" | "success" | "none" => {
    if (p.user_id === meTargetId) return "danger";
    if (p.status !== "active") return "danger";
    return "none";
  };

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Search className="absolute right-12 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by player or team"
          className="w-full bg-muted/60 rounded-full pl-10 pr-12 py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {(["All", "Active", "Targets", "Bounties"] as PlayerFilter[]).map((f) => {
          const active = f === filter;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition
                ${active ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground/80"}`}>
              {f} {counts[f]}
            </button>
          );
        })}
      </div>

      {/* Groups */}
      <div className="mt-5 space-y-6">
        {grouped.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No players match.</p>}
        {grouped.map(([teamName, members]) => (
          <div key={teamName}>
            <h3 className="font-display font-extrabold text-lg mb-3">{teamName}</h3>
            <div className="grid grid-cols-4 gap-3">
              {members.map((p) => {
                const prof = profilesById[p.user_id];
                const ring = ringFor(p);
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1.5">
                    <Avatar name={prof?.username} url={prof?.photo_url} size={64} ring={ring} />
                    <span className="text-xs text-foreground/90 truncate max-w-full">{prof?.username ?? "player"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
