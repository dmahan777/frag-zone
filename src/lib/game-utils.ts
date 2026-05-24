export function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function formatCountdown(target: string | Date | null): string {
  if (!target) return "—";
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function statusColor(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "active": return { bg: "bg-success/15 border-success/40", text: "text-success", label: "Active" };
    case "eliminated": return { bg: "bg-danger/15 border-danger/40", text: "text-danger", label: "Eliminated" };
    case "safe": return { bg: "bg-primary/15 border-primary/40", text: "text-primary", label: "Safe" };
    case "revived": return { bg: "bg-secondary/15 border-secondary/40", text: "text-secondary", label: "Revived" };
    default: return { bg: "bg-muted border-border", text: "text-muted-foreground", label: status };
  }
}
