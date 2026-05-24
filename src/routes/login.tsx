import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Mail, Lock } from "lucide-react";
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

  useEffect(() => {
    if (authLoading || !user) return;
    navigate({ to: profile?.onboarded ? "/home" : "/onboarding" });
  }, [user, profile, authLoading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created! Setting you up...");
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

  return (
    <MobileShell>
      <div className="min-h-screen flex flex-col px-6 pt-16 pb-10 bg-grid">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary">
            <Crosshair className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold leading-none text-glow-primary">FRAG</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Drop in. Stay alive.</p>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-display font-bold">{mode === "signin" ? "Welcome back" : "Join the game"}</h2>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "signin" ? "Sign in to your Frag account." : "Create your operator profile."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:shadow-glow-primary transition"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:shadow-glow-primary transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-4 rounded-2xl shadow-glow-primary active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition"
        >
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <span className="text-primary font-semibold">{mode === "signin" ? "Create account" : "Sign in"}</span>
        </button>

        <p className="mt-auto text-[11px] text-center text-muted-foreground/70">
          By continuing, you agree to play fair. No real weapons. Gel/water only.
        </p>
      </div>
    </MobileShell>
  );
}
