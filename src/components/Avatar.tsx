import { initials } from "@/lib/game-utils";

export function Avatar({ name, url, size = 40, ring, ringColor }: { name?: string | null; url?: string | null; size?: number; ring?: "primary" | "danger" | "success" | "none"; ringColor?: string | null }) {
  const ringCls = {
    primary: "ring-2 ring-primary/70 ring-offset-2 ring-offset-background",
    danger: "ring-2 ring-danger/70 ring-offset-2 ring-offset-background",
    success: "ring-2 ring-success/70 ring-offset-2 ring-offset-background",
    none: "",
  }[ring ?? "none"];

  const useCustom = !!ringColor;
  const style: React.CSSProperties = { width: size, height: size, fontSize: size * 0.4 };
  if (useCustom) {
    // emulate ring-2 + ring-offset-2 with box-shadow so we can use an arbitrary color
    style.boxShadow = `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${ringColor}`;
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-gradient-to-br from-secondary/40 to-primary/30 border border-border flex items-center justify-center font-bold font-display text-foreground overflow-hidden ${useCustom ? "" : ringCls}`}
    >
      {url ? (
        <img src={url} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
