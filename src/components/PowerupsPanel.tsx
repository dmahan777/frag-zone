import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, Sparkles, Users, Store, Check, Lock } from "lucide-react";
import {
  POWERUPS, type PowerupType, type PowerupConfig, mergeConfig,
  activatePowerup, purchasePowerup, isActive, remaining, findMeta, isInZone,
} from "@/lib/powerups";

type Tab = "personal" | "team" | "store";

type Props = {
  gameId: string;
  userId: string;
  username: string | null;
};

export function PowerupsPanel({ gameId, userId, username }: Props) {
  const [player, setPlayer] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("personal");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const load = async () => {
    const { data: p } = await supabase.from("players").select("*").eq("game_id", gameId).eq("user_id", userId).maybeSingle();
    setPlayer(p);
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    setGame(g);
    const { data: all } = await supabase.from("players").select("*").eq("game_id", gameId);
    setAllPlayers(all ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [gameId, userId]);

  useEffect(() => {
    const ch = supabase.channel(`pup-${gameId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [gameId, userId]);

  const cfg: PowerupConfig = useMemo(() => mergeConfig(game?.powerup_config), [game?.powerup_config]);

  const onActivate = async (type: PowerupType) => {
    if (!player) return;
    try {
      let extra: any = undefined;
      if (type === "revive") {
        const dead = allPlayers.filter(x => x.status === "eliminated");
        if (!dead.length) throw new Error("No eliminated players to revive");
        const pick = prompt(`Revive whom? Enter user_id prefix:\n${dead.map(d => d.user_id.slice(0, 8)).join(", ")}`);
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
        if (amt > (player.points ?? 0)) throw new Error("Not enough points");
        extra = { targetId: match.user_id, bountyPoints: amt };
        await supabase.from("players").update({ points: player.points - amt } as never).eq("id", player.id);
      }
      if (type === "decoy") {
        const zone = prompt("Fake zone name (shown to other players):", "North Campus");
        if (!zone) return;
        extra = { fakeZone: zone };
      }
      await activatePowerup({
        playerId: player.id, userId, gameId, teamId: player.team_id,
        type, inventory: player.powerup_inventory ?? {}, active: player.powerup_active ?? {},
        username: username ?? "player", extra,
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
      if (c.zoneEnabled && c.zone) {
        const { data: loc } = await supabase.from("player_locations").select("lat,lng").eq("game_id", gameId).eq("user_id", userId).maybeSingle();
        if (!loc) throw new Error("Enable location to buy this powerup");
        if (!isInZone(c.zone, loc.lat, loc.lng)) throw new Error(`You must be inside the ${findMeta(type).name} zone to buy this`);
      }
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
    return <p className="text-sm text-muted-foreground text-center py-6">Loading power-ups…</p>;
  }

  const inv = (player.powerup_inventory ?? {}) as Record<string, number>;
  const active = (player.powerup_active ?? {}) as Record<string, any>;
  const personal = POWERUPS.filter(p => p.scope === "personal");
  const team = POWERUPS.filter(p => p.scope === "team");

  return (
    <div>
      <div className="bg-gradient-to-r from-secondary/15 to-primary/10 border border-border rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-secondary font-bold">Your points</p>
          <p className="font-display text-3xl font-extrabold flex items-center gap-1.5"><Coins className="h-5 w-5 text-secondary" />{player.points ?? 0}</p>
        </div>
        <p className="text-[11px] text-muted-foreground text-right max-w-[40%]">
          Earn <span className="font-bold text-foreground">{game?.points_per_elimination ?? 100}</span> per confirmed elimination.
        </p>
      </div>

      <div className="mt-4 bg-card border border-border rounded-xl p-1 grid grid-cols-3 gap-1">
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
              onClick={() => onActivate(p.type)} />
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
                  onClick={() => onActivate(p.type)} />
              ))}
            </div>
          )}
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
  meta, cfg, count, active, remainingMs, now, onClick,
}: {
  meta: typeof POWERUPS[number]; cfg: { enabled: boolean; cost: number };
  count: number; active: boolean; remainingMs: number; now: number;
  onClick: () => void;
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
