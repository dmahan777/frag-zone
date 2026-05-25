import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ScrollText, Users, Timer, Skull, Save, Crown, ChevronRight, Zap, Play, Flag, Trash2, Zap as Bolt } from "lucide-react";
import { assignTargetsForGame } from "@/lib/assign-targets";

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
  random_purge_length_minutes: number;
  purge_length_minutes: number;
  purge_length_hours: number;
  daily_purge_enabled: boolean;
  daily_purge_time: string | null;
  daily_purge_day_of_week: number | null;
  powerup_shield: boolean;
  powerup_radar_ping: boolean;
  powerup_double_points: boolean;
  powerup_revive_token: boolean;
  powerup_map_spawn: boolean;
  powerup_spawn_radius_m: number;
  powerup_spawn_frequency: string;
  powerup_spawn_count: number;
  round_starts_at: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type SectionKey = "rules" | "players" | "round" | "purge" | "powerups";

function GameSettingsPage() {
  const { gameId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<SectionKey | null>(null);
  const [showStartRound, setShowStartRound] = useState(false);
  const [startDay, setStartDay] = useState<number>(new Date().getDay());
  const [startTime, setStartTime] = useState<string>("18:00");

  const [rules, setRules] = useState("");
  const [totalRounds, setTotalRounds] = useState(1);
  const [unlimitedRounds, setUnlimitedRounds] = useState(false);
  const [roundLengthDays, setRoundLengthDays] = useState(1);

  const [maxTeams, setMaxTeams] = useState(8);
  const [openRegistration, setOpenRegistration] = useState(true);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);

  const [eliminationApproval, setEliminationApproval] = useState(true);
  const [inheritTargets, setInheritTargets] = useState(true);
  const [fullTeamElimination, setFullTeamElimination] = useState(false);

  const [purgeEnabled, setPurgeEnabled] = useState(false);
  const [purgeLengthHours, setPurgeLengthHours] = useState(1);
  const [randomPurge, setRandomPurge] = useState(false);
  const [randomPurgeFrequency, setRandomPurgeFrequency] = useState<"daily" | "weekly">("daily");
  const [randomPurgeLengthMinutes, setRandomPurgeLengthMinutes] = useState(30);
  const [dailyPurgeEnabled, setDailyPurgeEnabled] = useState(false);
  const [dailyPurgeTime, setDailyPurgeTime] = useState<string>("20:00");
  const [dailyPurgeDay, setDailyPurgeDay] = useState<number>(1);

  const [puShield, setPuShield] = useState(true);
  const [puRadar, setPuRadar] = useState(true);
  const [puDouble, setPuDouble] = useState(true);
  const [puRevive, setPuRevive] = useState(false);
  const [puMapSpawn, setPuMapSpawn] = useState(false);
  const [puSpawnRadius, setPuSpawnRadius] = useState(500);
  const [puSpawnFreq, setPuSpawnFreq] = useState<"daily" | "weekly">("daily");
  const [puSpawnCount, setPuSpawnCount] = useState(3);

  const load = async () => {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (!g) return;
    const gg = g as unknown as Game;
    setGame(gg);
    setRules(gg.rules ?? "");
    setTotalRounds(gg.total_rounds ?? 1);
    setUnlimitedRounds(!!gg.unlimited_rounds);
    setRoundLengthDays(gg.round_length_days ?? 1);
    setMaxTeams(gg.max_teams ?? 8);
    setOpenRegistration(gg.open_registration ?? true);
    setPlayersPerTeam(gg.players_per_team ?? 4);
    setEliminationApproval(gg.elimination_approval ?? true);
    setInheritTargets(gg.inherit_targets ?? true);
    setFullTeamElimination(gg.full_team_elimination ?? false);
    setPurgeEnabled(!!gg.purge_enabled);
    setPurgeLengthHours(gg.purge_length_hours ?? 1);
    setRandomPurge(!!gg.random_purge);
    setRandomPurgeFrequency((gg.random_purge_frequency as "daily" | "weekly") ?? "daily");
    setRandomPurgeLengthMinutes(gg.random_purge_length_minutes ?? 30);
    setDailyPurgeEnabled(!!gg.daily_purge_enabled);
    setDailyPurgeTime((gg.daily_purge_time ?? "20:00:00").slice(0, 5));
    setDailyPurgeDay(gg.daily_purge_day_of_week ?? 1);
    setPuShield(gg.powerup_shield ?? true);
    setPuRadar(gg.powerup_radar_ping ?? true);
    setPuDouble(gg.powerup_double_points ?? true);
    setPuRevive(gg.powerup_revive_token ?? false);
    setPuMapSpawn(!!gg.powerup_map_spawn);
    setPuSpawnRadius(gg.powerup_spawn_radius_m ?? 500);
    setPuSpawnFreq((gg.powerup_spawn_frequency as "daily" | "weekly") ?? "daily");
    setPuSpawnCount(gg.powerup_spawn_count ?? 3);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [gameId]);

  useEffect(() => {
    const ch = supabase.channel(`settings-${gameId}`)
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
      unlimited_rounds: unlimitedRounds,
      total_rounds: Math.max(1, Math.min(99, Math.round(totalRounds))),
      round_length_days: Math.max(1, Math.min(14, Math.round(roundLengthDays))),
      max_teams: Math.max(1, Math.min(64, Math.round(maxTeams))),
      open_registration: openRegistration,
      players_per_team: Math.max(1, Math.min(32, Math.round(playersPerTeam))),
      elimination_approval: eliminationApproval,
      inherit_targets: inheritTargets,
      full_team_elimination: fullTeamElimination,
      purge_enabled: purgeEnabled,
      purge_length_hours: Math.max(1, Math.min(24, Math.round(purgeLengthHours))),
      random_purge: randomPurge,
      random_purge_frequency: randomPurgeFrequency,
      random_purge_length_minutes: Math.max(1, Math.min(240, Math.round(randomPurgeLengthMinutes))),
      daily_purge_enabled: dailyPurgeEnabled,
      daily_purge_time: dailyPurgeEnabled ? `${dailyPurgeTime}:00` : null,
      daily_purge_day_of_week: dailyPurgeEnabled ? dailyPurgeDay : null,
      powerup_shield: puShield,
      powerup_radar_ping: puRadar,
      powerup_double_points: puDouble,
      powerup_revive_token: puRevive,
      powerup_map_spawn: puMapSpawn,
      powerup_spawn_radius_m: Math.max(50, Math.min(20000, Math.round(puSpawnRadius))),
      powerup_spawn_frequency: puSpawnFreq,
      powerup_spawn_count: Math.max(1, Math.min(50, Math.round(puSpawnCount))),
    };
    const { error } = await supabase.from("games").update(payload as never).eq("id", game.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  const scheduleStartRound = async () => {
    // Next occurrence of startDay at startTime
    const now = new Date();
    const target = new Date(now);
    const dayDiff = (startDay - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + dayDiff);
    const [hh, mm] = startTime.split(":").map(Number);
    target.setHours(hh, mm, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);

    const { error } = await supabase
      .from("games")
      .update({ round_starts_at: target.toISOString(), status: "scheduled" } as never)
      .eq("id", game.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Round starts ${DAYS[startDay]} at ${startTime}`);
    setShowStartRound(false);
  };

  const endGame = async () => {
    if (!confirm("End the game for everyone? This can't be undone.")) return;
    const { error } = await supabase.from("games").update({ status: "ended" } as never).eq("id", game.id);
    if (error) toast.error(error.message); else { toast.success("Game ended"); navigate({ to: "/home" }); }
  };

  const deleteGame = async () => {
    if (!confirm(`Delete "${game.name}" permanently? This wipes players, teams, clips, and history. This can't be undone.`)) return;
    if (!confirm("Are you absolutely sure? This is permanent.")) return;
    setBusy(true);
    await supabase.from("eliminations").delete().eq("game_id", game.id);
    await supabase.from("events").delete().eq("game_id", game.id);
    await supabase.from("messages").delete().eq("game_id", game.id);
    await supabase.from("player_locations").delete().eq("game_id", game.id);
    await supabase.from("clips").delete().eq("game_id", game.id);
    await supabase.from("players").delete().eq("game_id", game.id);
    await supabase.from("teams").delete().eq("game_id", game.id);
    const { error } = await supabase.from("games").delete().eq("id", game.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Game deleted");
    navigate({ to: "/menu" });
  };

  const sections: { key: SectionKey; title: string; subtitle: string; icon: React.ReactNode }[] = [
    { key: "rules", title: "Game rules", subtitle: "Your custom rules players follow", icon: <ScrollText className="h-4 w-4" /> },
    { key: "players", title: "Players & teams", subtitle: "Team size, number of teams, registration", icon: <Users className="h-4 w-4" /> },
    { key: "round", title: "Round settings", subtitle: "Rounds, length, eliminations", icon: <Timer className="h-4 w-4" /> },
    { key: "purge", title: "Purge settings", subtitle: "Random and scheduled purges", icon: <Skull className="h-4 w-4" /> },
    { key: "powerups", title: "Powerups", subtitle: "Pick which powerups are in play", icon: <Zap className="h-4 w-4" /> },
  ];

  const onBack = () => {
    if (section) setSection(null);
    else navigate({ to: "/game/$gameId", params: { gameId } });
  };

  const activeTitle = sections.find((s) => s.key === section)?.title;

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border/60">
        <button onClick={onBack} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1"><Crown className="h-3 w-3" /> Host settings</p>
          <h1 className="font-display text-xl font-extrabold truncate">{activeTitle ?? game.name}</h1>
        </div>
        {section && (
          <button disabled={busy} onClick={save} className="px-4 h-10 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Save className="h-4 w-4" /> Save
          </button>
        )}
      </div>

      {!section && (
        <>
          <div className="px-5 mt-4 space-y-2">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className="w-full flex items-center gap-3 bg-surface border border-border rounded-2xl p-4 text-left hover:border-primary/60 transition"
              >
                <span className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base font-extrabold leading-none">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{s.subtitle}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* Game actions */}
          <div className="px-5 mt-6 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Game actions</p>
            {game.round_starts_at && (
              <p className="text-[11px] text-primary mb-1">
                Scheduled for {new Date(game.round_starts_at).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={() => setShowStartRound(true)}
              className="w-full flex items-center gap-3 bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-2xl p-4 text-left shadow-glow-primary"
            >
              <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Play className="h-4 w-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-extrabold leading-none">Start round</p>
                <p className="text-[11px] opacity-80 mt-1">Pick a day and time the next round kicks off.</p>
              </div>
            </button>
            <button
              onClick={endGame}
              className="w-full flex items-center gap-3 bg-card border border-danger/40 text-danger rounded-2xl p-4 text-left"
            >
              <span className="h-10 w-10 rounded-full bg-danger/15 flex items-center justify-center shrink-0"><Flag className="h-4 w-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-extrabold leading-none">End game</p>
                <p className="text-[11px] opacity-80 mt-1">Stop the game for everyone.</p>
              </div>
            </button>
            <button
              disabled={busy}
              onClick={deleteGame}
              className="w-full flex items-center gap-3 bg-danger/10 border border-danger text-danger rounded-2xl p-4 text-left disabled:opacity-50"
            >
              <span className="h-10 w-10 rounded-full bg-danger/20 flex items-center justify-center shrink-0"><Trash2 className="h-4 w-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-extrabold leading-none">Delete game</p>
                <p className="text-[11px] opacity-80 mt-1">Permanently remove this game and all its data.</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Start round modal */}
      {showStartRound && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Play className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-extrabold">Start round</h2>
            </div>
            <p className="text-sm font-semibold mb-2">Day</p>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setStartDay(i)}
                  className={`rounded-lg py-1.5 text-[11px] font-bold border ${startDay === i ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-3 mb-4">
              <span className="text-sm font-semibold">Time</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowStartRound(false)} className="flex-1 bg-card border border-border rounded-xl py-3 text-sm font-bold">Cancel</button>
              <button onClick={scheduleStartRound} className="flex-1 bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-xl py-3 text-sm font-bold">Schedule</button>
            </div>
          </div>
        </div>
      )}

      {section === "rules" && (
        <Panel>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={10}
            maxLength={4000}
            placeholder="e.g. No tagging in class. Bathrooms are safe zones. Eliminations need a clear photo proof."
            className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted-foreground mt-1 text-right">{rules.length}/4000</p>
        </Panel>
      )}

      {section === "players" && (
        <Panel>
          <Toggle label="Open registration" hint="Allow new players to join with the game code." checked={openRegistration} onChange={setOpenRegistration} />
          <SliderRow className="mt-3" label="Number of teams" value={maxTeams} min={1} max={32} onChange={setMaxTeams} suffix="teams" />
          <SliderRow className="mt-3" label="Team size" value={playersPerTeam} min={1} max={16} onChange={setPlayersPerTeam} suffix="players" />
        </Panel>
      )}

      {section === "round" && (
        <Panel>
          <Toggle label="Unlimited rounds" hint="Game keeps going until you end it manually." checked={unlimitedRounds} onChange={setUnlimitedRounds} />
          {!unlimitedRounds && (
            <SliderRow className="mt-3" label="Total rounds" value={totalRounds} min={1} max={20} onChange={setTotalRounds} suffix="rounds" />
          )}
          <SliderRow className="mt-3" label="Round length" value={roundLengthDays} min={1} max={14} onChange={setRoundLengthDays} suffix={roundLengthDays === 1 ? "day" : "days"} />
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
        </Panel>
      )}

      {section === "purge" && (
        <Panel>
          <Toggle label="Enable purge" hint="Turn purges on for this game." checked={purgeEnabled} onChange={setPurgeEnabled} />

          <div className={`mt-3 space-y-2 ${purgeEnabled ? "" : "opacity-50 pointer-events-none"}`}>
            <Toggle
              label="Random purge"
              hint="A purge kicks off at a random time."
              checked={randomPurge}
              onChange={setRandomPurge}
            />
            {randomPurge && (
              <div className="bg-card border border-border rounded-xl px-3 py-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold mb-2">Random purge happens</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["daily", "weekly"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setRandomPurgeFrequency(f)}
                        className={`rounded-lg py-2 text-sm font-semibold border ${randomPurgeFrequency === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
                      >
                        Once a {f === "daily" ? "day" : "week"}
                      </button>
                    ))}
                  </div>
                </div>
                <SliderRow label="Random purge length" value={randomPurgeLengthMinutes} min={5} max={240} step={5} onChange={setRandomPurgeLengthMinutes} suffix="min" />
              </div>
            )}

            <Toggle
              label="Scheduled purge"
              hint="A purge happens on a specific day and time each week."
              checked={dailyPurgeEnabled}
              onChange={setDailyPurgeEnabled}
            />
            {dailyPurgeEnabled && (
              <div className="bg-card border border-border rounded-xl px-3 py-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold mb-2">Day</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DAYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDailyPurgeDay(i)}
                        className={`rounded-lg py-1.5 text-[11px] font-bold border ${dailyPurgeDay === i ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
                      >
                        {d.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Start time</span>
                  <input
                    type="time"
                    value={dailyPurgeTime}
                    onChange={(e) => setDailyPurgeTime(e.target.value)}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
                <SliderRow label="Scheduled purge length" value={purgeLengthHours} min={1} max={24} onChange={setPurgeLengthHours} suffix={purgeLengthHours === 1 ? "hour" : "hours"} />
                <p className="text-[11px] text-muted-foreground">
                  Runs from {dailyPurgeTime} to {addHours(dailyPurgeTime, purgeLengthHours)}.
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {section === "powerups" && (
        <Panel>
          <p className="text-[11px] text-muted-foreground mb-3">Pick which powerups players can earn and use this game.</p>
          <div className="space-y-2">
            <Toggle label="Shield" hint="Blocks one elimination attempt." checked={puShield} onChange={setPuShield} />
            <Toggle label="Radar ping" hint="Reveals nearby players for a few seconds." checked={puRadar} onChange={setPuRadar} />
            <Toggle label="Double points" hint="Next elimination is worth 2x." checked={puDouble} onChange={setPuDouble} />
            <Toggle label="Revive token" hint="Lets an eliminated player come back in." checked={puRevive} onChange={setPuRevive} />
            <Toggle label="Random map spawn" hint="Powerups appear at random spots on the map for players to grab." checked={puMapSpawn} onChange={setPuMapSpawn} />
          </div>

          {puMapSpawn && (
            <div className="mt-4 bg-card border border-border rounded-xl p-3 space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Map spawn rules</p>
              <SliderRow
                label="Spawn area radius"
                value={puSpawnRadius}
                min={50}
                max={5000}
                step={50}
                onChange={setPuSpawnRadius}
                suffix="m"
              />
              <div>
                <p className="text-sm text-muted-foreground mb-1.5">How often</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["daily", "weekly"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setPuSpawnFreq(f)}
                      className={`h-10 rounded-xl text-sm font-semibold border ${puSpawnFreq === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"}`}
                    >
                      {f === "daily" ? "Each day" : "Each week"}
                    </button>
                  ))}
                </div>
              </div>
              <SliderRow
                label={`Powerups per ${puSpawnFreq === "daily" ? "day" : "week"}`}
                value={puSpawnCount}
                min={1}
                max={25}
                onChange={setPuSpawnCount}
              />
              <p className="text-[11px] text-muted-foreground">
                {puSpawnCount} powerup{puSpawnCount === 1 ? "" : "s"} will randomly spawn within {puSpawnRadius}m {puSpawnFreq === "daily" ? "each day" : "each week"}.
              </p>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function addHours(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  const end = (h + hours) % 24;
  return `${String(end).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-5 mt-4">
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
