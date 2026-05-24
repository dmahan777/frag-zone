import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const AVATAR_NAMES = ["Ghost", "Reaper", "Nova", "Viper", "Echo", "Blaze", "Frost", "Riot"];

function Onboarding() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [school, setSchool] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(AVATAR_NAMES[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && profile?.onboarded) navigate({ to: "/home" });
  }, [user, profile, loading, navigate]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (username.length < 3) return toast.error("Username must be 3+ characters");
    setSaving(true);
    try {
      const photo_url = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=00E5FF,4D8FFF,FF5FA0`;
      const { error } = await supabase.from("profiles").update({
        username: username.trim(),
        display_name: username.trim(),
        school: school.trim() || null,
        photo_url,
        onboarded: true,
      }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("You're in. Let's play.");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell>
      <div className="min-h-screen px-6 pt-12 pb-10 bg-grid">
        <p className="text-xs uppercase tracking-widest text-primary">Step 1 of 1</p>
        <h1 className="text-3xl font-display font-bold mt-2">Set up your operator</h1>
        <p className="text-sm text-muted-foreground mt-2">Pick a callsign and avatar. You can change later.</p>

        <form onSubmit={save} className="mt-8 space-y-5">
          <div className="flex flex-col items-center gap-3">
            <Avatar name={avatarSeed} url={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=00E5FF,4D8FFF,FF5FA0`} size={96} ring="primary" />
            <div className="grid grid-cols-4 gap-2 w-full">
              {AVATAR_NAMES.map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setAvatarSeed(n)}
                  className={`p-1.5 rounded-xl border transition ${avatarSeed === n ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                >
                  <img src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(n)}&backgroundColor=00E5FF,4D8FFF,FF5FA0`} alt={n} className="w-full aspect-square rounded-lg" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Callsign / Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ghostfire"
              maxLength={20}
              className="mt-1 w-full bg-card border border-border rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary focus:shadow-glow-primary transition"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">School / Team (optional)</label>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. Lincoln High"
              maxLength={40}
              className="mt-1 w-full bg-card border border-border rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary focus:shadow-glow-primary transition"
            />
          </div>

          <button
            disabled={saving}
            className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-4 rounded-2xl shadow-glow-primary active:scale-[0.98] transition disabled:opacity-50"
          >
            {saving ? "..." : "Enter the Arena"}
          </button>
        </form>
      </div>
    </MobileShell>
  );
}
