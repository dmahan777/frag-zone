import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Crosshair, Shield, Radar, Zap, Pill, Trophy, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/target")({
  component: TargetPage,
});

function TargetPage() {
  const { user, profile } = useAuth();
  const [player, setPlayer] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [targetPlayer, setTargetPlayer] = useState<any>(null);
  const [reporting, setReporting] = useState(false);

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
      setTarget(null);
      setTargetPlayer(null);
    }
  };
  useEffect(() => { load(); }, [user]);

  const reportFrag = async () => {
    if (!user || !player || !target || !game) return;
    setReporting(true);
    try {
      const { error } = await supabase.from("eliminations").insert({
        game_id: game.id,
        eliminator_id: user.id,
        eliminated_id: target.id,
        status: "pending",
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

  const activatePowerup = async (kind: "shield" | "radarPing" | "doublePoints") => {
    if (!player) return;
    const updates: any = { ...(player.power_ups ?? {}) };
    if (kind === "shield") {
      updates.shield = true;
      updates.shieldExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await supabase.from("players").update({ power_ups: updates, status: "safe" }).eq("id", player.id);
      await supabase.from("events").insert({ game_id: game.id, type: "powerup", created_by: player.user_id, message: `🛡 @${profile?.username} activated Shield` });
      toast.success("Shield active for 1 hour");
    } else {
      updates[kind] = true;
      await supabase.from("players").update({ power_ups: updates }).eq("id", player.id);
      const label = kind === "radarPing" ? "📡 Radar Ping" : "⚡ Double Points";
      await supabase.from("events").insert({ game_id: game.id, type: "powerup", created_by: player.user_id, message: `${label} — @${profile?.username}` });
      toast.success(`${kind} activated`);
    }
    load();
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

  return (
    <div className="px-5 pt-12">
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
            <MiniStat icon={<Shield className="h-3.5 w-3.5" />} label="Shield" value={targetPlayer?.power_ups?.shield ? "ON" : "OFF"} />
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

      <h3 className="mt-8 text-xs uppercase tracking-widest text-muted-foreground font-bold">Power-ups</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <PowerCard icon={<Shield className="h-5 w-5" />} name="Shield" desc="Safe for 1hr" color="primary" onUse={() => activatePowerup("shield")} active={player.power_ups?.shield} />
        <PowerCard icon={<Radar className="h-5 w-5" />} name="Radar Ping" desc="Reveal zones 30m" color="secondary" onUse={() => activatePowerup("radarPing")} active={player.power_ups?.radarPing} />
        <PowerCard icon={<Zap className="h-5 w-5" />} name="Double Points" desc="2x next kill" color="success" onUse={() => activatePowerup("doublePoints")} active={player.power_ups?.doublePoints} />
        <PowerCard icon={<Pill className="h-5 w-5" />} name="Revive" desc={`${player.power_ups?.reviveToken ?? 0} token(s)`} color="danger" onUse={() => toast.info("Use from admin panel")} active={false} />
      </div>

      <div className="mt-6 bg-gradient-to-br from-card to-secondary/10 border border-border rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-secondary font-bold">Daily challenge</p>
        <p className="mt-1 font-display font-bold">Get a frag before noon</p>
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full w-1/3 bg-gradient-to-r from-primary to-secondary" /></div>
        <p className="mt-2 text-xs text-muted-foreground">Reward: Shield · Resets in 12h</p>
      </div>
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

function PowerCard({ icon, name, desc, color, onUse, active }: { icon: React.ReactNode; name: string; desc: string; color: "primary" | "secondary" | "success" | "danger"; onUse: () => void; active: boolean }) {
  const cmap = {
    primary: "from-primary/20 to-primary/5 text-primary",
    secondary: "from-secondary/20 to-secondary/5 text-secondary",
    success: "from-success/20 to-success/5 text-success",
    danger: "from-danger/20 to-danger/5 text-danger",
  }[color];
  return (
    <button onClick={onUse} className={`text-left bg-gradient-to-br ${cmap} bg-card border ${active ? "border-primary" : "border-border"} rounded-2xl p-4 active:scale-[0.97] transition relative`}>
      {active && <span className="absolute top-2 right-2 text-[9px] font-bold uppercase text-primary">ON</span>}
      {icon}
      <p className="mt-2 font-display font-bold text-sm">{name}</p>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
    </button>
  );
}
