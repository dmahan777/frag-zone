import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { LogOut, Settings, Share2, Trophy, Flame, Calendar, Skull } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const share = async () => {
    const text = `Join me on Frag! Track our gel-ball game live → frag.app`;
    if (navigator.share) {
      try { await navigator.share({ title: "Frag", text, url: window.location.origin }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <div className="px-5 pt-12">
      <div className="flex flex-col items-center text-center">
        <Avatar name={profile?.username} url={profile?.photo_url} size={104} ring="primary" />
        <h1 className="mt-4 font-display text-3xl font-extrabold">@{profile?.username}</h1>
        {profile?.school && <p className="text-sm text-muted-foreground">{profile.school}</p>}
        <div className="mt-3"><StatusBadge status="active" /></div>
      </div>

      {/* Badges */}
      <div className="mt-6 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
        {["🔥 On Fire", "💀 Veteran", "⚡ Clutch", "👻 Ghost"].map((b) => (
          <div key={b} className="shrink-0 bg-card border border-border rounded-full px-3 py-1.5 text-xs font-semibold">{b}</div>
        ))}
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatCard icon={<Skull className="h-4 w-4 text-danger" />} label="Eliminations" value={profile?.stats.kills ?? 0} />
        <StatCard icon={<Flame className="h-4 w-4 text-primary" />} label="Streak" value={profile?.stats.currentStreak ?? 0} />
        <StatCard icon={<Calendar className="h-4 w-4 text-success" />} label="Days survived" value={profile?.stats.totalSurvivalDays ?? 0} />
        <StatCard icon={<Trophy className="h-4 w-4 text-secondary" />} label="Games won" value={profile?.stats.gamesWon ?? 0} />
      </div>

      <div className="mt-6 space-y-2">
        <button onClick={share} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition">
          <Share2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">Invite friends</span>
        </button>
        <button onClick={() => navigate({ to: "/settings" as any })} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Settings</span>
        </button>
        <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="w-full bg-card border border-danger/30 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition text-danger">
          <LogOut className="h-5 w-5" />
          <span className="font-semibold">Sign out</span>
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="mt-1 font-display font-extrabold text-2xl">{value}</p>
    </div>
  );
}
