import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { requestLocationOnce } from "@/lib/location";
import { Crosshair, Mail, Lock, MapPin, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowLocation, setAllowLocation] = useState(true);
  const [allowNotifications, setAllowNotifications] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    navigate({ to: profile?.onboarded ? "/home" : "/onboarding" });
  }, [user, profile, authLoading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!allowLocation) {
          toast.error("Location sharing is required to create an account.");
          setLoading(false);
          return;
        }
        await requestLocationOnce();
        // Notifications are optional
        if (allowNotifications && typeof Notification !== "undefined" && Notification.permission === "default") {
          try { await Notification.requestPermission(); } catch {}
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created!");
          navigate({ to: "/onboarding" });
        } else {
          toast.success("Account created! Check your email to verify it, then sign in.");
          setMode("signin");
        }
      } else {

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isSignin = mode === "signin";

  return (
    <MobileShell>
      <div className="relative min-h-screen flex flex-col overflow-hidden bg-background">
        {/* Background FX */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-secondary/15 blur-[150px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col min-h-screen px-8 pt-14 pb-8">
          {/* Header / Logo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-primary/40 blur-lg animate-pulse" />
              <div className="relative h-14 w-14 rounded-xl bg-card border border-primary/50 flex items-center justify-center shadow-[inset_0_0_12px_hsl(var(--primary)/0.25)]">
                <Crosshair className="h-6 w-6 text-primary" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-display font-extrabold uppercase tracking-tighter leading-none text-foreground">
                FRAG
              </h1>
              <p className="text-[10px] mt-1 uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                Drop in. Stay alive.
              </p>
            </div>
          </div>

          {/* Welcome */}
          <div className="mt-20">
            <h2 className="text-4xl font-display font-bold tracking-tight text-foreground">
              {isSignin ? "Welcome back" : "Join the game"}
            </h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {isSignin
                ? "Enter your credentials to re-enter the arena."
                : "Create your operator profile to drop in."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="mt-10 space-y-4">
            <div className="space-y-1.5">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Identity
              </label>
              <div className="relative group">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-card/40 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/60 outline-none backdrop-blur-sm transition-all focus:bg-card/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Access Key
              </label>
              <div className="relative group">
                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60 group-focus-within:text-secondary transition-colors" />
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="w-full bg-card/40 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/60 outline-none backdrop-blur-sm transition-all focus:bg-card/80 focus:border-secondary/50 focus:ring-1 focus:ring-secondary/20"
                />
              </div>
            </div>

            {isSignin ? null : (
              <div className="space-y-2 pt-2">
                <PermissionToggle
                  icon={<MapPin className="h-4 w-4" />}
                  title="Share location"
                  subtitle="Required — used so other players can find you on the map."
                  required
                  checked={allowLocation}
                  onChange={setAllowLocation}
                />
                <PermissionToggle
                  icon={<Bell className="h-4 w-4" />}
                  title="Push notifications"
                  subtitle="Optional — alerts for targets, eliminations, and game updates."
                  checked={allowNotifications}
                  onChange={setAllowNotifications}
                />
              </div>
            )}


            <button
              type="submit"
              disabled={loading}
              className="relative w-full group mt-6 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary via-primary/70 to-secondary opacity-60 blur transition duration-300 group-hover:opacity-100" />
              <div className="relative flex items-center justify-center w-full bg-background py-4 rounded-2xl">
                <span className="font-display font-bold text-lg uppercase tracking-wider text-foreground">
                  {loading ? "..." : isSignin ? "Sign In" : "Create Account"}
                </span>
              </div>
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-8 flex flex-col items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setMode(isSignin ? "signup" : "signin")}
              className="text-muted-foreground"
            >
              {isSignin ? "New recruit? " : "Already have an account? "}
              <span className="text-primary font-bold underline-offset-4 hover:text-primary/80 transition-colors">
                {isSignin ? "Create account" : "Sign in"}
              </span>
            </button>
          </div>

          {/* Legal footer */}
          <div className="mt-auto pt-10">
            <p className="text-[10px] text-center leading-relaxed font-medium uppercase tracking-wider text-muted-foreground/60 px-4">
              By continuing, you agree to play fair.
              <br />
              No real weapons. Gel/water only. Secure channel activated.
            </p>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function PermissionToggle({
  icon, title, subtitle, checked, onChange, required,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(required ? true : !checked)}
      className="w-full flex items-center gap-3 bg-card/40 border border-border rounded-2xl p-3 text-left active:scale-[0.99] transition"
    >
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${checked ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          {required && <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">REQUIRED</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className={`h-6 w-10 rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-muted"}`}>
        <div className={`h-5 w-5 rounded-full bg-background transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
    </button>
  );
}
