import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ScrollText, Users, Timer, Skull, Map as MapIcon, Save, Trash2, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/$gameId")({
  component: GameSettingsPage,
});

type Game = {
  id: string; name: string; code: string; host_id: string; status: string; mode: string;
  current_round: number; total_rounds: number;
  rules: string;
  purge_enabled: boolean;
  purge_interval_minutes: number;
  map_center_lat: number | null;
  map_center_lng: number | null;
  map_radius_m: number | null;
};
type PlayerRow = { id: string; user_id: string; status: string; team_id: string | null };
type TeamRow = { id: string; name: string; color: string; max_members: number; created_by: string };
type ProfileLite = { id: string; username: string | null; photo_url: string | null };

function GameSettingsPage() {
  const { gameId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [busy, setBusy] = useState(false);

  // Editable state
  const [rules, setRules] = useState("");
  const [totalRounds, setTotalRounds] = useState(1);
  const [purgeEnabled, setPurgeEnabled] = useState(false);
  const [purgeMinutes, setPurgeMinutes] = useState(60);
  const [mapLat, setMapLat] = useState<string>("");
  const [mapLng, setMapLng] = useState<string>("");
  const [mapRadius, setMapRadius] = useState<string>("");

  const load = async () => {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (g) {
      const gg = g as Game;
      setGame(gg);
      setRules(gg.rules ?? "");
      setTotalRounds(gg.total_rounds ?? 1);
      setPurgeEnabled(!!gg.purge_enabled);
      setPurgeMinutes(gg.purge_interval_minutes ?? 60);
      setMapLat(gg.map_center_lat != null ? String(gg.map_center_lat) : "");
      setMapLng(gg.map_center_lng != null ? String(gg.map_center_lng) : "");
      setMapRadius(gg.map_radius_m != null ? String(gg.map_radius_m) : "");
    }
    const { data: ps } = await supabase.from("players").select("id, user_id, status, team_id").eq("game_id", gameId);
    const arr = (ps as PlayerRow[]) ?? [];
    setPlayers(arr);
    const { data: ts } = await supabase.from("teams").select("id, name, color, max_members, created_by").eq("game_id", gameId);
    setTeams((ts as TeamRow[]) ?? []);
    if (arr.length) {
      const ids = Array.from(new Set(arr.map((p) => p.user_id)));
      const { data: pr } = await supabase.from("profiles").select("id, username, photo_url").in("id", ids);
      const map: Record<string, ProfileLite> = {};
      (pr as ProfileLite[] | null)?.forEach((p) => { map[p.id] = p; });
      setProfiles(map);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [gameId]);

  useEffect(() => {
    const ch = supabase.channel(`settings-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [gameId]);

  if (!game) {
    return <div className="px-5 pt-16 text-center text-muted-foreground">Loading…</div>;
  }
  const isHost = game.host_id === user?.id;
  if (!isHost) {
    return (
      <div className="px-5 pt-16 text-center">
        <p className="font-display text-lg">Host only</p>
        <p className="text-sm text-muted-foreground mt-1">Only the host can edit game settings.</p>
        <Link to="/game/$gameId" params={{ gameId }} className="inline-block mt-4 text-primary text-sm font-semibold">← Back to game</Link>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    const patch: Record<string, unknown> = {
      rules: rules.trim().slice(0, 4000),
      total_rounds: Math.max(1, Math.min(99, Math.round(totalRounds))),
      purge_enabled: purgeEnabled,
      purge_interval_minutes: Math.max(5, Math.min(1440, Math.round(purgeMinutes))),
      map_center_lat: mapLat ? Number(mapLat) : null,
      map_center_lng: mapLng ? Number(mapLng) : null,
      map_radius_m: mapRadius ? Math.max(50, Math.round(Number(mapRadius))) : null,
    };
    const { error } = await supabase.from("games").update(patch).eq("id", game.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  const kickPlayer = async (p: PlayerRow) => {
    if (!confirm(`Remove @${profiles[p.user_id]?.username ?? "player"} from the game?`)) return;
    const { error } = await supabase.from("players").delete().eq("id", p.id);
    if (error) toast.error(error.message); else toast.success("Removed");
  };

  const deleteTeam = async (t: TeamRow) => {
    if (!confirm(`Delete team "${t.name}"? Members will be unassigned.`)) return;
    await supabase.from("players").update({ team_id: null }).eq("game_id", gameId).eq("team_id", t.id);
    const { error } = await supabase.from("teams").delete().eq("id", t.id);
    if (error) toast.error(error.message); else toast.success("Team deleted");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapLat(pos.coords.latitude.toFixed(6));
        setMapLng(pos.coords.longitude.toFixed(6));
      },
      () => toast.error("Couldn't get location"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border/60">
        <button onClick={() => navigate({ to: "/game/$gameId", params: { gameId } })} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1"><Crown className="h-3 w-3" /> Host settings</p>
          <h1 className="font-display text-xl font-extrabold truncate">{game.name}</h1>
        </div>
        <button disabled={busy} onClick={save} className="px-4 h-10 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
          <Save className="h-4 w-4" /> Save
        </button>
      </div>

      {/* Game rules */}
      <Section icon={<ScrollText className="h-4 w-4" />} title="Game rules" subtitle="Type any rules your players should follow.">
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="e.g. No tagging in class. Bathrooms are safe zones. Eliminations need a clear photo proof."
          className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted-foreground mt-1 text-right">{rules.length}/4000</p>
      </Section>

      {/* Players & teams */}
      <Section icon={<Users className="h-4 w-4" />} title="Players & teams" subtitle={`${players.length} players · ${teams.length} teams`}>
        {teams.length > 0 && (
          <div className="space-y-2 mb-4">
            {teams.map((t) => {
              const count = players.filter((p) => p.team_id === t.id).length;
              return (
                <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  <span className="h-6 w-6 rounded-full border border-border shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{count} / {t.max_members} members</p>
                  </div>
                  <button onClick={() => deleteTeam(t)} className="h-8 w-8 rounded-lg bg-danger/10 border border-danger/30 text-danger flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-2">
          {players.map((p) => {
            const prof = profiles[p.user_id];
            const team = teams.find((t) => t.id === p.team_id);
            return (
              <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">@{prof?.username ?? "player"} {p.user_id === game.host_id && <Crown className="inline h-3 w-3 text-secondary ml-1" />}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    {team && <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: team.color }} />}
                    {team?.name ?? "No team"} · {p.status}
                  </p>
                </div>
                {p.user_id !== game.host_id && (
                  <button onClick={() => kickPlayer(p)} className="h-8 w-8 rounded-lg bg-danger/10 border border-danger/30 text-danger flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Round settings */}
      <Section icon={<Timer className="h-4 w-4" />} title="Round settings" subtitle="How many rounds the game runs for.">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total rounds</p>
          <span className="text-2xl font-display font-extrabold tabular-nums">{totalRounds}</span>
        </div>
        <input
          type="range" min={1} max={20} step={1}
          value={totalRounds}
          onChange={(e) => setTotalRounds(parseInt(e.target.value))}
          className="w-full mt-2 accent-primary"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Currently on round {game.current_round || 0}.</p>
      </Section>

      {/* Purge settings */}
      <Section icon={<Skull className="h-4 w-4" />} title="Purge settings" subtitle="Time-window where everyone is fair game.">
        <label className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-3">
          <span className="text-sm font-semibold">Enable purge</span>
          <input type="checkbox" checked={purgeEnabled} onChange={(e) => setPurgeEnabled(e.target.checked)} className="h-5 w-9 accent-primary" />
        </label>
        <div className={`mt-3 ${purgeEnabled ? "" : "opacity-50 pointer-events-none"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Purge every</p>
            <span className="text-sm font-bold tabular-nums">{purgeMinutes} min</span>
          </div>
          <input
            type="range" min={5} max={240} step={5}
            value={purgeMinutes}
            onChange={(e) => setPurgeMinutes(parseInt(e.target.value))}
            className="w-full mt-1 accent-primary"
          />
        </div>
      </Section>

      {/* Map settings */}
      <Section icon={<MapIcon className="h-4 w-4" />} title="Map settings" subtitle="Where the game is played and how big the play area is.">
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Center lat" value={mapLat} onChange={setMapLat} placeholder="25.7617" />
          <LabeledInput label="Center lng" value={mapLng} onChange={setMapLng} placeholder="-80.1918" />
        </div>
        <LabeledInput className="mt-2" label="Play radius (m)" value={mapRadius} onChange={setMapRadius} placeholder="2000" />
        <button onClick={useMyLocation} className="mt-3 w-full bg-card border border-border rounded-xl py-2.5 text-sm font-semibold">
          Use my current location
        </button>
      </Section>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="px-5 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">{icon}</span>
        <div>
          <h2 className="font-display text-base font-extrabold leading-none">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-4">{children}</div>
    </section>
  );
}

function LabeledInput({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="mt-1 w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
    </label>
  );
}
