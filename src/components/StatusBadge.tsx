import { statusColor } from "@/lib/game-utils";

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const s = statusColor(status);
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  return (
    <span className={`${pad} inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wider ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.text.replace("text-", "bg-")}`} />
      {s.label}
    </span>
  );
}
