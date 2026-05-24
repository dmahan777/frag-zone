import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ScrollText, Users, Timer, Skull, Save, Trash2, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/$gameId")({
  component: GameSettingsPage,
});

type Game = {
  id: string; name: string; code: string; host_id: string; status: string; mode: string;
  current_round: number; total_rounds: number;
  rules: string;
  purge_enabled: boolean;
  max_teams: number;
  open_registration: boolean;
  players_per_team: number;
  elimination_approval: boolean;
  inherit_targets: boolean;
  full_team_elimination: boolean;
  unlimited_rounds: boolean;
  round_length_days: number;
  random_purge: boolean;
  random_purge_frequency: string;
  purge_length_minutes: number;
  daily_purge_enabled: boolean;
  daily_purge_time: string | null;
  daily_purge_day_of_week: number | null;
};
type PlayerRow = { id: string; user_id: string; status: string; team_id: string | null };
type TeamRow = { id: string; name: string; color: string; max_members: number; created_by: string };
type ProfileLite = { id: string; username: string | null; photo_url: string | null };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const [unlimitedRounds, setUnlimitedRounds] = useState(false);
  const [roundLengthDays, setRoundLengthDays] = useState(1);

  // Players & teams
  const [maxTeams, setMaxTeams] = useState(8);
  const [openRegistration, setOpenRegistration] = useState(true);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);

  // Round
  const [eliminationApproval, setEliminationApproval] = useState(true);
  const [inheritTargets, setInheritTargets] = useState(true);
  const [fullTeamElimination, setFullTeamElimination] = useState(false);

  // Purge
  const [purgeEnabled, setPurgeEnabled] = useState(false);
  const [purgeLengthMinutes, setPurgeLengthMinutes] = useState(30);
  const [randomPurge, setRandomPurge] = useState(false);
  const [randomPurgeFrequency, setRandomPurgeFrequency] = useState<"daily" | "weekly">("daily");
  const [dailyPurgeEnabled, setDailyPurgeEnabled] = useState(false);
  const [dailyPurgeTime, setDailyPurgeTime] = useState<string>("20:00");
  const [dailyPurgeDay, setDailyPurgeDay] = useState<number>(1);

  const load = async () => {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (g) {
      const gg = g as unknown as Game;
      setGame(gg);
      setRules(gg.rules ?? "");
      setTotalRounds(gg.total_rounds ?? 1);
      setMaxTeams(gg.max_teams ?? 8);
      setOpenRegistration(gg.open_registration ?? true);
      setPlayersPerTeam(gg.players_per_team ?? 4);
      setEliminationApproval(gg.elimination_approval ?? true);
      setInheritTargets(gg.inherit_targets ?? true);
      setFullTeamElimination(gg.full_team_elimination ?? false);
      setPurgeEnabled(!!gg.purge_enabled);
      setPurgeMinutes(gg.purge_interval_minutes ?? 60);
      setRandomPurge(!!gg.random_purge);
      setDailyPurgeEnabled(!!gg.daily_purge_enabled);
      setDailyPurgeTime((gg.daily_purge_time ?? "20:00:00").slice(0, 5));
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
    const payload: Partial<Game> = {
      rules: rules.trim().slice(0, 4000),
      total_rounds: Math.max(1, Math.min(99, Math.round(totalRounds))),
      max_teams: Math.max(1, Math.min(64, Math.round(maxTeams))),
      open_registration: openRegistration,
      players_per_team: Math.max(1, Math.min(32, Math.round(playersPerTeam))),
      elimination_approval: eliminationApproval,
      inherit_targets: inheritTargets,
      full_team_elimination: fullTeamElimination,
      purge_enabled: purgeEnabled,
      purge_interval_minutes: Math.max(5, Math.min(1440, Math.round(purgeMinutes))),
      random_purge: randomPurge,
      daily_purge_enabled: dailyPurgeEnabled,
      daily_purge_time: dailyPurgeEnabled ? `${dailyPurgeTime}:00` : null,
    };
    const { error } = await supabase.from("games").update(payload as never).eq("id", game.id);
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
        <Toggle label="Open registration" hint="Allow new players to join with the game code." checked={openRegistration} onChange={setOpenRegistration} />

        <SliderRow className="mt-3" label="Max teams" value={maxTeams} min={1} max={32} onChange={setMaxTeams} suffix="teams" />
        <SliderRow className="mt-3" label="Players per team" value={playersPerTeam} min={1} max={16} onChange={setPlayersPerTeam} suffix="players" />

        {teams.length > 0 && (
          <div className="space-y-2 mt-4">
            {teams.map((t) => {
              const count = players.filter((p) => p.team_id === t.id).length;
              return (
                <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  <span className="h-6 w-6 rounded-full border border-border shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{count} / {playersPerTeam} members</p>
                  </div>
                  <button onClick={() => deleteTeam(t)} className="h-8 w-8 rounded-lg bg-danger/10 border border-danger/30 text-danger flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-2 mt-2">
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
      <Section icon={<Timer className="h-4 w-4" />} title="Round settings" subtitle="Rules for how eliminations and rounds flow.">
        <SliderRow label="Total rounds" value={totalRounds} min={1} max={20} onChange={setTotalRounds} suffix="rounds" />
        <p className="text-[11px] text-muted-foreground mt-1">Currently on round {game.current_round || 0}.</p>

        <div className="mt-4 space-y-2">
          <Toggle label="Elimination approval" hint="Host must approve each elimination before it counts." checked={eliminationApproval} onChange={setEliminationApproval} />
          <Toggle label="Inherit targets" hint="When you eliminate someone, you inherit their target." checked={inheritTargets} onChange={setInheritTargets} />
          <Toggle
            label="Full team elimination"
            hint="A whole team has to be eliminated in one round. If even one survives, the rest come back in (and may earn a bonus)."
            checked={fullTeamElimination}
            onChange={setFullTeamElimination}
          />
        </div>
      </Section>

      {/* Purge settings */}
      <Section icon={<Skull className="h-4 w-4" />} title="Purge settings" subtitle="Time-windows where everyone is fair game.">
        <Toggle label="Enable purge" hint="Turn purges on for this game." checked={purgeEnabled} onChange={setPurgeEnabled} />

        <div className={`mt-3 ${purgeEnabled ? "" : "opacity-50 pointer-events-none"}`}>
          <SliderRow label="Purge every" value={purgeMinutes} min={5} max={240} step={5} onChange={setPurgeMinutes} suffix="min" />

          <div className="mt-4 space-y-2">
            <Toggle
              label="Random purge"
              hint="A purge can also kick off at a random time during a round."
              checked={randomPurge}
              onChange={setRandomPurge}
            />
            <Toggle
              label="Daily purge"
              hint="A purge happens every day at the same time."
              checked={dailyPurgeEnabled}
              onChange={setDailyPurgeEnabled}
            />
            {dailyPurgeEnabled && (
              <label className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-3">
                <span className="text-sm font-semibold">Daily purge time</span>
                <input
                  type="time"
                  value={dailyPurgeTime}
                  onChange={(e) => setDailyPurgeTime(e.target.value)}
                  className="bg-background border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                />
              </label>
            )}
          </div>
        </div>
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

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-3 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-9 accent-primary shrink-0" />
    </label>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, suffix, className }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-sm font-bold tabular-nums">{value}{suffix ? ` ${suffix}` : ""}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full mt-1 accent-primary"
      />
    </div>
  );
}
