import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMap } from "@/components/GoogleMap";
import { Avatar } from "@/components/Avatar";
import { Bell, Settings, Users as UsersIcon, Share2, Shield, Search, ChevronLeft } from "lucide-react";
import { formatCountdown } from "@/lib/game-utils";
import { useLiveLocation } from "@/hooks/use-live-location";
import { toast } from "sonner";
import { reverseGeocodeCity } from "@/lib/geocode.functions";

export const Route = createFileRoute("/_authenticated/game/$gameId")({
  component: GameScreen,
});

type Tab = "Activity" | "Players" | "Team" | "Powerups" | "Admin";
const TABS: Tab[] = ["Activity", "Players", "Team", "Powerups", "Admin"];

type GameRow = { id: string; name: string; code: string; status: string; host_id: string; current_round: number; total_rounds: number; round_ends_at: string | null };
type PlayerRow = { id: string; user_id: string; status: string; target_id: string | null; kills: number; team_id: string | null };
type ProfileLite = { id: string; username: string | null; photo_url: string | null; school: string | null };
type TeamRow = { id: string; name: string; color: string; created_by: string; max_members: number };

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
  const [locations, setLocations] = useState<Record<string, { lat: number; lng: number; speed?: number | null; battery?: number | null; updated_at?: string }>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const myPos = useLiveLocation(gameId, user?.id);

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

  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name, color, created_by, max_members").eq("game_id", gameId).order("created_at");
    setTeams((data as TeamRow[]) ?? []);
  };
  useEffect(() => { loadTeams(); /* eslint-disable-next-line */ }, [gameId]);

  useEffect(() => {
    const ch = supabase.channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` }, () => loadTeams())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [gameId]);

  // Load all player locations for this game + subscribe to live updates
  useEffect(() => {
    let active = true;
    const loadLocs = async () => {
      const { data } = await supabase
        .from("player_locations")
        .select("user_id, lat, lng, speed, battery, updated_at")
        .eq("game_id", gameId);
      if (!active) return;
      const map: Record<string, { lat: number; lng: number; speed?: number | null; battery?: number | null; updated_at?: string }> = {};
      (data ?? []).forEach((r: any) => { map[r.user_id] = { lat: r.lat, lng: r.lng, speed: r.speed, battery: r.battery, updated_at: r.updated_at }; });
      setLocations(map);
    };
    loadLocs();
    const ch = supabase.channel(`locs-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_locations", filter: `game_id=eq.${gameId}` }, (payload: any) => {
        const row = (payload.new ?? payload.old) as any;
        if (!row) return;
        setLocations((prev) => {
          const next = { ...prev };
          if (payload.eventType === "DELETE") delete next[row.user_id];
          else next[row.user_id] = { lat: row.lat, lng: row.lng, speed: row.speed, battery: row.battery, updated_at: row.updated_at };
          return next;
        });
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [gameId]);

  const targets = useMemo(() => {
    if (!me?.target_id) return [] as PlayerRow[];
    const direct = players.find((p) => p.user_id === me.target_id);
    return direct ? [direct] : [];
  }, [me, players]);

  const center = myPos ?? (user && locations[user.id]) ?? { lat: 25.768, lng: -80.135 };
  const markers = useMemo(() => {
    const out: { id: string; lat: number; lng: number; label?: string; photoUrl?: string | null; ringColor?: string }[] = [];
    const seen = new Set<string>();
    players.forEach((pl) => {
      const loc = pl.user_id === user?.id ? (myPos ?? locations[pl.user_id]) : locations[pl.user_id];
      if (!loc) return;
      const prof = profilesById[pl.user_id];
      const isMe = pl.user_id === user?.id;
      const isTarget = targets.some((t) => t.user_id === pl.user_id);
      seen.add(pl.user_id);
      out.push({
        id: pl.id,
        lat: loc.lat,
        lng: loc.lng,
        label: isMe ? `${prof?.username ?? "You"} (you)` : prof?.username ?? "Player",
        photoUrl: (isMe ? profile?.photo_url : null) ?? prof?.photo_url ?? null,
        ringColor: isMe ? "#ffffff" : isTarget ? "#ef4444" : "#3b82f6",
      });
    });
    // Always include me on the map when I have a position, even if my players row hasn't loaded yet
    if (user && myPos && !seen.has(user.id)) {
      out.push({
        id: `me-${user.id}`,
        lat: myPos.lat,
        lng: myPos.lng,
        label: `${profile?.username ?? "You"} (you)`,
        photoUrl: profile?.photo_url ?? null,
        ringColor: "#ffffff",
      });
    }
    return out;
  }, [myPos, user, profile, locations, players, profilesById, targets]);

  const isHost = game?.host_id === user?.id;

  const onShare = async () => {
    if (!game) return;
    const text = `Join my game "${game.name}" with code ${game.code}`;
    try {
      if ((navigator as any).share) await (navigator as any).share({ text, title: game.name });
      else { await navigator.clipboard.writeText(game.code); toast.success("Code copied"); }
    } catch {}
  };

  // Prompt new joiners to make or join a team
  const [teamPromptDismissed, setTeamPromptDismissed] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    const key = `team-prompt-dismissed:${gameId}:${user.id}`;
    if (sessionStorage.getItem(key)) setTeamPromptDismissed(true);
  }, [gameId, user?.id]);
  const showTeamPrompt = !!me && !me.team_id && !teamPromptDismissed;
  const dismissTeamPrompt = () => {
    if (user?.id) sessionStorage.setItem(`team-prompt-dismissed:${gameId}:${user.id}`, "1");
    setTeamPromptDismissed(true);
  };

  if (!game) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm">Loading game…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Map area */}
      <div className="relative w-full h-[52vh] min-h-[360px]">
        <GoogleMap markers={markers} center={center} className="absolute inset-0" onMarkerClick={(id) => setFocusId(id)} focusId={focusId} />

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
          <button onClick={() => navigate({ to: "/menu" })}
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

        {focusId && (() => {
          const marker = markers.find((m) => m.id === focusId);
          if (!marker) return null;
          const pl = players.find((p) => p.id === focusId) ?? (focusId.startsWith("me-") ? me : null);
          const uid = pl?.user_id ?? user?.id;
          const prof = uid ? profilesById[uid] : undefined;
          const isMe = uid === user?.id;
          const loc = isMe && myPos
            ? { lat: myPos.lat, lng: myPos.lng, speed: myPos.speed, battery: myPos.battery, updated_at: new Date().toISOString() }
            : (uid ? locations[uid] : undefined);
          if (!loc) return null;
          const ageSec = loc.updated_at ? (Date.now() - new Date(loc.updated_at).getTime()) / 1000 : Infinity;
          const isLive = ageSec < 60;
          return (
            <PlayerLocationCard
              name={prof?.username ?? (isMe ? "You" : "Player")}
              isMe={isMe}
              team={pl?.team_id ?? null}
              photoUrl={prof?.photo_url ?? null}
              lat={loc.lat}
              lng={loc.lng}
              speedMph={loc.speed ?? null}
              battery={isMe ? myPos?.battery ?? loc.battery ?? null : loc.battery ?? null}
              isLive={isLive}
              ageSec={ageSec}
              onClose={() => setFocusId(null)}
            />
          );
        })()}
      </div>

      {/* Sheet area */}
      <div className="flex-1 -mt-5 relative z-20 bg-surface rounded-t-3xl border-t border-border pt-2 pb-28">
        <div className="h-1 w-12 mx-auto bg-border rounded-full mb-3" />

        {/* Tabs row */}
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto overflow-y-visible scrollbar-hide">
          <Link to="/profile" className="shrink-0 p-1">
            <Avatar name={profile?.username} url={profile?.photo_url} size={40} ring="danger" />
          </Link>
          {TABS.map((t) => {
            const active = t === tab && t !== "Activity" && t !== "Players";
            const visible = t !== "Admin" || isHost;
            if (!visible) return null;
            return (
              <button
                key={t}
                onClick={() => {
                  if (t === "Activity") navigate({ to: "/feed" });
                  else if (t === "Players") navigate({ to: "/players/$gameId", params: { gameId } });
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
          </div>
        </div>

        {/* Tab body — swipe left/right to switch tabs */}
        <SwipeTabs
          tab={tab}
          setTab={setTab}
          tabs={TABS.filter((t) => t !== "Admin" || isHost)}
          className="px-4 mt-4"
        >
          {tab === "Activity" && (
            <ActivitySection players={players} profilesById={profilesById} meId={user?.id ?? null} meTargetId={me?.target_id ?? null} />
          )}
          {tab === "Players" && (
            <PlayersSection players={players} profilesById={profilesById} meId={user?.id ?? null} meTargetId={me?.target_id ?? null} teams={teams} gameId={gameId} myPlayerId={me?.id ?? null} myTeamId={me?.team_id ?? null} />
          )}
          {tab === "Team" && (
            <MyTeamSection gameId={gameId} meId={user?.id ?? null} myPlayerId={me?.id ?? null} myTeamId={me?.team_id ?? null} teams={teams} players={players} profilesById={profilesById} />
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

      {showTeamPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-6 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-foreground">Pick your squad</h2>
            <p className="text-sm text-muted-foreground mt-1">You just joined the game. Make a new team or jump into one that already exists.</p>
            <div className="mt-5 grid gap-3">
              <button
                onClick={() => { setTab("Team"); dismissTeamPrompt(); }}
                className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-3.5 rounded-2xl shadow-glow-primary"
              >
                Make a team
              </button>
              <button
                onClick={() => { setTab("Team"); dismissTeamPrompt(); }}
                className="w-full bg-card border border-border text-foreground font-display font-bold py-3.5 rounded-2xl"
              >
                Join a team
              </button>
              <button onClick={dismissTeamPrompt} className="text-xs text-muted-foreground mt-1">Skip for now</button>
            </div>
          </div>
        </div>
      )}
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

function ActivitySection({ players, profilesById, meId, meTargetId }: { players: PlayerRow[]; profilesById: Record<string, ProfileLite>; meId: string | null; meTargetId: string | null }) {
  const targets = useMemo(() => {
    if (!meTargetId) return [] as PlayerRow[];
    const t = players.find((p) => p.user_id === meTargetId);
    return t ? [t] : [];
  }, [players, meTargetId]);

  const bounties = useMemo(() => {
    if (!meId) return [] as PlayerRow[];
    return players.filter((p) => p.target_id === meId);
  }, [players, meId]);

  return (
    <div className="space-y-6">
      <Section title="Targets" subtitle="Eliminate these players." emptyText="No active target.">
        {targets.map((t) => (
          <PlayerRowCard key={t.id} player={t} profile={profilesById[t.user_id]} accent="#ef4444" badge="TARGET" />
        ))}
      </Section>

      <Section title="Bounties" subtitle="Open targets — anyone can eliminate them for a reward." emptyText="No active bounties right now.">
        {bounties.map((b) => (
          <PlayerRowCard key={b.id} player={b} profile={profilesById[b.user_id]} accent="#f59e0b" badge="BOUNTY" />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, emptyText, children }: { title: string; subtitle?: string; emptyText: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div>
      <h3 className="font-display font-extrabold text-lg">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      <div className="mt-3 space-y-2">
        {hasChildren ? children : (
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRowCard({ player, profile, accent, badge }: { player: PlayerRow; profile?: ProfileLite; accent: string; badge: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
      <div className="relative">
        <Avatar url={profile?.photo_url} name={profile?.username} size={44} />
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card" style={{ background: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">@{profile?.username ?? "player"}</p>
        <p className="text-xs text-muted-foreground truncate">{profile?.school ?? "—"} · {player.kills} kills</p>
      </div>
      <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full" style={{ background: `${accent}22`, color: accent }}>{badge}</span>
    </div>
  );
}

function PlayersSection({ players, profilesById, meId, meTargetId, teams, gameId, myPlayerId, myTeamId }: { players: PlayerRow[]; profilesById: Record<string, ProfileLite>; meId: string | null; meTargetId: string | null; teams: TeamRow[]; gameId: string; myPlayerId: string | null; myTeamId: string | null }) {
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

      {/* Create-a-team form */}
      <div className="mt-5">
        <TeamCreator gameId={gameId} meId={meId} myPlayerId={myPlayerId} myTeamId={myTeamId} teams={teams} />
      </div>

      {/* Groups */}
      <div className="mt-6 space-y-6">
        {grouped.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No players match.</p>}
        {grouped.map(([key, members]) => {
          const team = teams.find((t) => t.id === key);
          const label = team?.name ?? "Free agents";
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                {team && <span className="h-4 w-4 rounded-full border border-border" style={{ background: team.color }} />}
                <h3 className="font-display font-extrabold text-lg">{label}</h3>
                {team && <span className="text-xs text-muted-foreground">({members.length}/{team.max_members})</span>}
              </div>
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
          );
        })}
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

function PlayerLocationCard({ 
  name, isMe, team, photoUrl, lat, lng, speedMph, battery, isLive, ageSec, onClose,
}: {
  name: string; isMe: boolean; team: string | null; photoUrl: string | null;
  lat: number; lng: number; speedMph: number | null; battery: number | null;
  isLive: boolean; ageSec: number; onClose: () => void;
}) {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Round to ~0.5km so we don't reveal an exact pin, and so the cache hits as the user moves slightly.
    const rLat = Math.round(lat * 200) / 200;
    const rLng = Math.round(lng * 200) / 200;
    reverseGeocodeCity({ data: { lat: rLat, lng: rLng } })
      .then((r) => { if (!cancelled) setAddress(r.label); })
      .catch(() => { if (!cancelled) setAddress(`${lat.toFixed(2)}, ${lng.toFixed(2)}`); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  const isApple = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const directionsHref = isApple
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const ageLabel = ageSec < 60 ? "just now" : ageSec < 3600 ? `${Math.round(ageSec / 60)}m ago` : `${Math.round(ageSec / 3600)}h ago`;

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 bg-surface border border-border rounded-2xl shadow-xl p-4 text-foreground">
      <div className="flex items-start gap-3">
        <Avatar name={name} url={photoUrl} size={48} ring={isMe ? "primary" : "danger"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display font-bold truncate">{name}{isMe ? " (you)" : ""}</p>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isLive ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {isLive ? "● Live" : `Updated ${ageLabel}`}
            </span>

          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Team: <span className="text-foreground/80">{team ?? "—"}</span> · updated {ageLabel}
          </p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none px-1">×</button>
      </div>

      <p className="text-xs text-foreground/80 mt-3 line-clamp-2">{address ?? "Locating…"}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-card border border-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Speed</p>
          <p className="text-sm font-semibold">{speedMph != null ? `${speedMph.toFixed(1)} mph` : "—"}</p>
        </div>
        <div className="rounded-xl bg-card border border-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Battery</p>
          <p className="text-sm font-semibold">{battery != null ? `${Math.round(battery)}%` : "—"}</p>
        </div>
      </div>

      <a
        href={directionsHref}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block w-full text-center bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl active:scale-[0.98] transition"
      >
        Get directions
      </a>
    </div>
  );
}


