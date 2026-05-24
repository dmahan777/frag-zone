import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/components/MobileShell";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname === "/menu";

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (!profile?.onboarded) navigate({ to: "/onboarding" });
  }, [user, profile, loading, navigate]);

  if (loading || !user || !profile?.onboarded) {
    return (
      <MobileShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className={`min-h-screen ${hideNav ? "" : "pb-28"}`}>
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
    </MobileShell>
  );
}
