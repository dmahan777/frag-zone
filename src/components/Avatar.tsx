import { initials } from "@/lib/game-utils";

export function Avatar({ name, url, size = 40, ring }: { name?: string | null; url?: string | null; size?: number; ring?: "primary" | "danger" | "success" | "none" }) {
  const ringCls = {
    primary: "ring-2 ring-primary/70 ring-offset-2 ring-offset-background",
    danger: "ring-2 ring-danger/70 ring-offset-2 ring-offset-background",
    success: "ring-2 ring-success/70 ring-offset-2 ring-offset-background",
    none: "",
  }[ring ?? "none"];
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`rounded-full bg-gradient-to-br from-secondary/40 to-primary/30 border border-border flex items-center justify-center font-bold font-display text-foreground overflow-hidden ${ringCls}`}
    >
      {url ? (
        <img src={url} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
