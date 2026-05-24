import { Link, useLocation } from "@tanstack/react-router";
import { Home, Map, Crosshair, Trophy, User } from "lucide-react";

type Tab = { to: string; label: string; icon: typeof Home; center?: boolean };
const tabs: Tab[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/map", label: "Map", icon: Map },
  { to: "/target", label: "Target", icon: Crosshair, center: true },
  { to: "/leaderboard", label: "Board", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 pointer-events-none">
      <div className="pointer-events-auto bg-surface/95 backdrop-blur-xl border-t border-border px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="flex items-end justify-around">
          {tabs.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            if (t.center) {
              return (
                <Link key={t.to} to={t.to} className="flex flex-col items-center -mt-7">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all
                    ${active
                      ? "bg-gradient-to-br from-primary to-secondary shadow-glow-primary scale-105"
                      : "bg-gradient-to-br from-primary to-secondary shadow-glow-primary"}`}>
                    <Icon className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] mt-1 font-medium text-muted-foreground">{t.label}</span>
                </Link>
              );
            }
            return (
              <Link key={t.to} to={t.to} className="flex flex-col items-center gap-1 py-2 px-3 min-w-[60px]">
                <Icon className={`h-5 w-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
