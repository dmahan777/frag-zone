import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Crosshair, Trophy, Flame, Coins, Sparkles, Users, Store, Check, Lock } from "lucide-react";
import {
  POWERUPS, type PowerupType, type PowerupConfig, mergeConfig,
  activatePowerup, purchasePowerup, isActive, remaining, findMeta,
} from "@/lib/powerups";

export const Route = createFileRoute("/_authenticated/target")({
  component: TargetPage,
});

type Tab = "personal" | "team" | "store";

function TargetPage() {
  const { user, profile } = useAuth();
  const [player, setPlayer] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [targetPlayer, setTargetPlayer] = useState<any>(null);
  const [teammates, setTeammates] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [reporting, setReporting] = useState(false);
  const [tab, setTab] = useState<Tab>("personal");
  const [now, setNow] = useState(Date.now());

  // Tick for countdowns
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("players").select("*").eq("user_id", user.id).order("joined_at", { ascending: false }).limit(1).maybeSingle();
    if (!p) return;
    setPlayer(p);
    const { data: g } = await supabase.from("games").select("*").eq("id", p.game_id).maybeSingle();
    setGame(g);
    if (p.target_id) {
      const { data: tp } = await supabase.from("profiles").select("*").eq("id", p.target_id).maybeSingle();
      setTarget(tp);
      const { data: tpl } = await supabase.from("players").select("*").eq("game_id", p.game_id).eq("user_id", p.target_id).maybeSingle();
      setTargetPlayer(tpl);
    } else {
      setTarget(null); setTargetPlayer(null);
    }
    const { data: all } = await supabase.from("players").select("*").eq("game_id", p.game_id);
    setAllPlayers(all ?? []);
    if (p.team_id) {
      setTeammates((all ?? []).filter((x: any) => x.team_id === p.team_id && x.user_id !== user.id));
    } else setTeammates([]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!player?.game_id) return;
    const ch = supabase.channel(`target-${player.game_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${player.game_id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [player?.game_id]);

  const cfg: PowerupConfig = useMemo(() => mergeConfig(game?.powerup_config), [game?.powerup_config]);

  const reportFrag = async () => {
    if (!user || !player || !target || !game) return;
    setReporting(true);
    try {
      const { error } = await supabase.from("eliminations").insert({
        game_id: game.id, eliminator_id: user.id, eliminated_id: target.id, status: "pending",
      });
      if (error) throw error;
      await supabase.from("events").insert({
        game_id: game.id, type: "elimination", created_by: user.id,
        message: `@${profile?.username} reported @${target.username} — awaiting admin confirmation`,
      });
      toast.success("Frag reported. Admin will confirm.");
    } catch (err) { toast.error((err as Error).message); }
    finally { setReporting(false); }
  };

  const onActivate = async (type: PowerupType) => {
    if (!player || !user || !profile) return;
    try {
      let extra: any = undefined;
      if (type === "revive") {
        const dead = allPlayers.filter(x => x.status === "eliminated");
        if (!dead.length) throw new Error("No eliminated players to revive");
        const pick = prompt(`Revive whom? Enter user_id from this list:\n${dead.map(d => d.user_id.slice(0, 8)).join(", ")}`);
        if (!pick) return;
        const match = dead.find(d => d.user_id.startsWith(pick));
        if (!match) throw new Error("Player not found");
        extra = { targetId: match.user_id };
      }
      if (type === "bounty") {
        const tid = prompt("Bounty target user_id (first 8 chars):");
        if (!tid) return;
        const match = allPlayers.find(d => d.user_id.startsWith(tid));
        if (!match) throw new Error("Player not found");
        const amt = parseInt(prompt("Bounty points to put on their head:") ?? "0", 10);
        if (!Number.isFinite(amt) || amt <= 0) throw new Error("Invalid amount");
        if (amt > player.points) throw new Error("Not enough points");
        extra = { targetId: match.user_id, bountyPoints: amt };
        // Deduct bounty points immediately
        await supabase.from("players").update({ points: player.points - amt } as never).eq("id", player.id);
      }
      if (type === "decoy") {
        const zone = prompt("Fake zone name (shown to other players):", "North Campus");
        if (!zone) return;
        extra = { fakeZone: zone };
      }
      await activatePowerup({
        playerId: player.id, userId: user.id, gameId: game.id, teamId: player.team_id,
        type, inventory: player.powerup_inventory ?? {}, active: player.powerup_active ?? {},
        username: profile.username ?? "player", extra,
      });
      toast.success(`${findMeta(type).name} activated`);
      load();
    } catch (err) { toast.error((err as Error).message); }
  };

  const onBuy = async (type: PowerupType) => {
    if (!player) return;
    try {
      const c = cfg[type];
      if (!c.enabled) throw new Error("Disabled by host");
      await purchasePowerup({
        playerId: player.id, type, cost: c.cost,
        currentPoints: player.points ?? 0,
        currentInventory: player.powerup_inventory ?? {},
      });
      toast.success(`Purchased ${findMeta(type).name}`);
      load();
    } catch (err) { toast.error((err as Error).message); }
  };

  if (!player) {
    return (
      <div className="px-5 pt-16 text-center">
        <Crosshair className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="mt-4 font-display text-lg">No active game</p>
        <p className="text-sm text-muted-foreground">Join a lobby from the Home tab.</p>
      </div>
    );
  }

  const inv = (player.powerup_inventory ?? {}) as Record<string, number>;
  const active = (player.powerup_active ?? {}) as Record<string, any>;
  const isTeamCaptain = teammates.length === 0 ? !!player.team_id : true; // simplified — any team member can activate; tighten if you add captain
  const personal = POWERUPS.filter(p => p.scope === "personal");
  const team = POWERUPS.filter(p => p.scope === "team");

  return (
    <div className="px-5 pt-12 pb-8">
      <h1 className="font-display text-3xl font-extrabold">Your Target</h1>
      <p className="text-sm text-muted-foreground mt-1">Hunt them down before they get you.</p>

      {target ? (
        <div className="mt-6 bg-card border border-border rounded-3xl p-5 animate-float-in">
          <div className="flex items-center gap-4">
            <Avatar name={target.username} url={target.photo_url} size={72} ring="danger" />
            <div className="flex-1">
              <p className="font-display text-xl font-bold">@{target.username}</p>
              {target.school && <p className="text-xs text-muted-foreground">{target.school}</p>}
              <div className="mt-2"><StatusBadge status={targetPlayer?.status ?? "active"} size="sm" /></div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} label="Kills" value={targetPlayer?.kills ?? 0} />
            <MiniStat icon={<Flame className="h-3.5 w-3.5" />} label="Days" value={targetPlayer?.survival_days ?? 0} />
            <MiniStat icon={<Coins className="h-3.5 w-3.5" />} label="Points" value={targetPlayer?.points ?? 0} />
          </div>
          <button
            disabled={reporting || targetPlayer?.status === "safe"}
            onClick={reportFrag}
            className="mt-5 w-full bg-gradient-to-r from-danger to-secondary text-foreground font-display font-extrabold py-4 rounded-2xl shadow-glow-danger active:scale-[0.98] transition disabled:opacity-40 uppercase tracking-wider"
          >
            {targetPlayer?.status === "safe" ? "Target is safe" : reporting ? "..." : "💥 Report Frag"}
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-card border border-border rounded-3xl p-6 text-center">
          <Crosshair className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 font-display font-bold">No target assigned</p>
          <p className="text-xs text-muted-foreground mt-1">Wait for the host to start the round.</p>
        </div>
      )}

      {/* Points header */}
      <div className="mt-6 bg-gradient-to-r from-secondary/15 to-primary/10 border border-border rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-secondary font-bold">Your points</p>
          <p className="font-display text-3xl font-extrabold flex items-center gap-1.5"><Coins className="h-5 w-5 text-secondary" />{player.points ?? 0}</p>
        </div>
        <p className="text-[11px] text-muted-foreground text-right max-w-[40%]">
          Earn <span className="font-bold text-foreground">{game?.points_per_elimination ?? 100}</span> per confirmed elimination.
        </p>
      </div>

      {/* Power-ups tabs */}
      <h3 className="mt-6 text-xs uppercase tracking-widest text-muted-foreground font-bold">Power-ups</h3>
      <div className="mt-2 bg-card border border-border rounded-xl p-1 grid grid-cols-3 gap-1">
        {([
          { k: "personal", label: "Personal", icon: <Sparkles className="h-3.5 w-3.5" /> },
          { k: "team", label: "Team", icon: <Users className="h-3.5 w-3.5" /> },
          { k: "store", label: "Store", icon: <Store className="h-3.5 w-3.5" /> },
        ] as { k: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${tab === t.k ? "bg-primary text-primary-foreground shadow-glow-primary" : "text-muted-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "personal" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {personal.map(p => (
            <PowerCard key={p.type} meta={p} cfg={cfg[p.type]} count={inv[p.type] ?? 0}
              active={isActive(active, p.type)} remainingMs={remaining(active, p.type)} now={now}
              mode="activate" onClick={() => onActivate(p.type)} />
          ))}
        </div>
      )}

      {tab === "team" && (
        <div className="mt-3">
          {!player.team_id ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">Join a team to use team power-ups</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {team.map(p => (
                <PowerCard key={p.type} meta={p} cfg={cfg[p.type]} count={inv[p.type] ?? 0}
                  active={isActive(active, p.type)} remainingMs={remaining(active, p.type)} now={now}
                  mode="activate" onClick={() => onActivate(p.type)} />
              ))}
            </div>
          )}
          {isTeamCaptain ? null : <p className="mt-2 text-[11px] text-muted-foreground">Team captains can activate team power-ups.</p>}
        </div>
      )}

      {tab === "store" && (
        <div className="mt-3 space-y-2">
          {POWERUPS.map(p => {
            const c = cfg[p.type];
            const owned = (inv[p.type] ?? 0) >= 1;
            const canAfford = (player.points ?? 0) >= c.cost;
            return (
              <div key={p.type} className={`bg-card border ${!c.enabled ? "border-border opacity-60" : "border-border"} rounded-2xl p-3 flex items-center gap-3`}>
                <div className="h-11 w-11 rounded-xl bg-primary/15 text-xl flex items-center justify-center">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display font-bold leading-tight">{p.name} <span className="text-[10px] uppercase text-muted-foreground ml-1">{p.scope}</span></p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.short}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold flex items-center gap-1 justify-end"><Coins className="h-3.5 w-3.5 text-secondary" />{c.cost}</p>
                  <button
                    disabled={!c.enabled || owned || !canAfford}
                    onClick={() => onBuy(p.type)}
                    className="mt-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-gradient-to-r from-primary to-secondary text-primary-foreground disabled:opacity-40 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
                  >
                    {!c.enabled ? "Off" : owned ? "Owned" : canAfford ? "Buy" : "Locked"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-background/40 rounded-xl p-2 border border-border text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}<span className="text-[10px] uppercase">{label}</span></div>
      <p className="font-display font-bold mt-0.5">{value}</p>
    </div>
  );
}

function fmtRemaining(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

function PowerCard({
  meta, cfg, count, active, remainingMs, now, mode, onClick,
}: {
  meta: typeof POWERUPS[number]; cfg: { enabled: boolean; cost: number };
  count: number; active: boolean; remainingMs: number; now: number;
  mode: "activate"; onClick: () => void;
}) {
  void now;
  const disabled = !cfg.enabled || count <= 0 || active;
  return (
    <button onClick={onClick} disabled={disabled}
      className={`text-left bg-card border ${active ? "border-primary shadow-glow-primary" : "border-border"} rounded-2xl p-3 active:scale-[0.97] transition relative disabled:opacity-50`}>
      {!cfg.enabled && <Lock className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground" />}
      {active && <span className="absolute top-2 right-2 text-[9px] font-bold uppercase text-primary flex items-center gap-1"><Check className="h-3 w-3" />ON</span>}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{meta.emoji}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-muted rounded">x{count}</span>
      </div>
      <p className="mt-1.5 font-display font-bold text-sm leading-tight">{meta.name}</p>
      <p className="text-[10px] text-muted-foreground line-clamp-2">{meta.short}</p>
      {active && remainingMs > 0 && Number.isFinite(remainingMs) && (
        <p className="text-[10px] mt-1 font-bold text-primary">{fmtRemaining(remainingMs)} left</p>
      )}
    </button>
  );
}
