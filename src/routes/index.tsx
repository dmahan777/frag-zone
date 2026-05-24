import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/components/MobileShell";
import { Crosshair } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!user) navigate({ to: "/login" });
      else if (!profile?.onboarded) navigate({ to: "/onboarding" });
      else navigate({ to: "/home" });
    }, 1200);
    return () => clearTimeout(t);
  }, [user, profile, loading, navigate]);

  return (
    <MobileShell>
      <div className="min-h-screen bg-grid flex flex-col items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl animate-pulse" />
          <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary animate-pulse-ring">
            <Crosshair className="h-12 w-12 text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="mt-8 text-6xl font-display font-extrabold tracking-tight text-glow-primary">FRAG</h1>
        <p className="mt-2 text-sm uppercase tracking-[0.4em] text-muted-foreground">Last player standing</p>
      </div>
    </MobileShell>
  );
}
