// Power-up catalog & helpers (client-side activation logic).
// Storage shape on players:
//   points: int
//   powerup_inventory: { [type]: number }  // count owned
//   powerup_active:    { [type]: { expiresAt?: string, ... } }
// Game config on games.powerup_config:
//   { [type]: { enabled: boolean, cost: number, scope: "personal" | "team" } }

import { supabase } from "@/integrations/supabase/client";

export type PowerupType =
  | "revive"
  | "immunity"
  | "ghostMode"
  | "decoy"
  | "bounty"
  | "selfPurge"
  | "uav"
  | "teamShield";

export type PowerupScope = "personal" | "team";

export type PowerupMeta = {
  type: PowerupType;
  name: string;
  emoji: string;
  scope: PowerupScope;
  short: string;
  durationMs: number | null; // null = instant / no duration; otherwise default duration
  defaultCost: number;
};

export const POWERUPS: PowerupMeta[] = [
  { type: "revive",     name: "Revive",      emoji: "🔄", scope: "personal", short: "Bring an eliminated player back",         durationMs: null,                       defaultCost: 500 },
  { type: "immunity",   name: "Immunity",    emoji: "🛡️", scope: "personal", short: "Untouchable for a set time",              durationMs: 60 * 60 * 1000,             defaultCost: 400 },
  { type: "ghostMode",  name: "Ghost Mode",  emoji: "👻", scope: "personal", short: "Hidden from the map for a set time",      durationMs: 2 * 60 * 60 * 1000,         defaultCost: 350 },
  { type: "decoy",      name: "Decoy",       emoji: "🪤", scope: "personal", short: "Fake your zone on others' maps",          durationMs: 2 * 60 * 60 * 1000,         defaultCost: 300 },
  { type: "bounty",     name: "Bounty",      emoji: "💰", scope: "personal", short: "Put points on a player's head",           durationMs: null,                       defaultCost: 200 },
  { type: "selfPurge",  name: "Self Purge",  emoji: "☠️", scope: "personal", short: "Open season on you — and you on everyone",durationMs: 60 * 60 * 1000,             defaultCost: 600 },
  { type: "uav",        name: "UAV",         emoji: "📡", scope: "team",     short: "Reveal enemy zones to your team",         durationMs: 15 * 60 * 1000,             defaultCost: 500 },
  { type: "teamShield", name: "Team Shield", emoji: "🛡️", scope: "team",     short: "Whole team immune",                       durationMs: 30 * 60 * 1000,             defaultCost: 700 },
];

export type PurchaseZone = { north: number; south: number; east: number; west: number };
export type PowerupConfigEntry = {
  enabled: boolean;
  cost: number;
  scope: PowerupScope;
  /** Override duration in minutes. If undefined, falls back to meta.durationMs. */
  durationMinutes?: number;
  zoneEnabled?: boolean;
  zones?: PurchaseZone[];
  /** @deprecated single-zone legacy field; migrated to zones[] */
  zone?: PurchaseZone | null;
};
export type PowerupConfig = Record<PowerupType, PowerupConfigEntry>;

export const defaultPowerupConfig = (): PowerupConfig => {
  const out = {} as PowerupConfig;
  for (const p of POWERUPS) out[p.type] = { enabled: true, cost: p.defaultCost, scope: p.scope, zoneEnabled: false, zones: [] };
  return out;
};

export const mergeConfig = (raw: any): PowerupConfig => {
  const d = defaultPowerupConfig();
  if (!raw || typeof raw !== "object") return d;
  for (const p of POWERUPS) {
    const c = raw[p.type];
    if (c && typeof c === "object") {
      const zones: PurchaseZone[] = Array.isArray(c.zones)
        ? c.zones.filter((z: any) => z && typeof z === "object")
        : c.zone && typeof c.zone === "object" ? [c.zone] : [];
      d[p.type] = {
        enabled: c.enabled !== false,
        cost: Number.isFinite(c.cost) ? Math.max(0, Math.round(c.cost)) : p.defaultCost,
        scope: p.scope,
        durationMinutes: Number.isFinite(c.durationMinutes) ? Math.max(1, Math.round(c.durationMinutes)) : undefined,
        zoneEnabled: !!c.zoneEnabled,
        zones,
      };
    }
  }
  return d;
};

const pointInZone = (z: PurchaseZone, lat: number, lng: number) =>
  lat <= z.north && lat >= z.south && lng <= z.east && lng >= z.west;

// Returns true if lat/lng is inside ANY zone, or if no zones supplied.
export const isInAnyZone = (zones: PurchaseZone[] | null | undefined, lat: number, lng: number): boolean => {
  if (!zones || zones.length === 0) return true;
  return zones.some((z) => pointInZone(z, lat, lng));
};

// Backward-compat single-zone helper.
export const isInZone = (zone: PurchaseZone | null | undefined, lat: number, lng: number): boolean => {
  if (!zone) return true;
  return pointInZone(zone, lat, lng);
};

// Returns ms remaining or 0 if expired/not active
export const remaining = (active: any, type: PowerupType): number => {
  const entry = active?.[type];
  if (!entry?.active) return 0;
  if (!entry.expiresAt) return Infinity;
  return Math.max(0, new Date(entry.expiresAt).getTime() - Date.now());
};

export const isActive = (active: any, type: PowerupType): boolean => remaining(active, type) > 0;

export function findMeta(type: PowerupType): PowerupMeta {
  return POWERUPS.find((p) => p.type === type)!;
}

// ----- Activation -----

type ActivateOpts = {
  playerId: string;
  userId: string;
  gameId: string;
  teamId: string | null;
  type: PowerupType;
  inventory: Record<string, number>;
  active: Record<string, any>;
  username: string;
  extra?: { targetId?: string; bountyPoints?: number; fakeZone?: string };
  /** Optional configured duration override in ms. Falls back to meta.durationMs. */
  durationMsOverride?: number | null;
};

export async function activatePowerup(opts: ActivateOpts) {
  const { playerId, userId, gameId, teamId, type, inventory, active, username, extra, durationMsOverride } = opts;
  const meta = findMeta(type);
  const durationMs = (typeof durationMsOverride === "number" && durationMsOverride > 0)
    ? durationMsOverride
    : meta.durationMs;

  if ((inventory[type] ?? 0) <= 0) throw new Error("You don't own that power-up");
  if (isActive(active, type)) throw new Error("Already active");
  if (type === "selfPurge" && isActive(active, "bounty")) throw new Error("Cancel your active Bounty first");
  if (type === "bounty" && isActive(active, "selfPurge")) throw new Error("Cancel Self Purge first");

  const now = Date.now();
  const newActive = { ...active };
  const newInv = { ...inventory, [type]: (inventory[type] ?? 0) - 1 };

  let feedMsg = `${meta.emoji} @${username} activated ${meta.name}`;
  let extraPlayerPatch: Record<string, any> = {};

  switch (type) {
    case "immunity":
      newActive.immunity = { active: true, expiresAt: new Date(now + durationMs!).toISOString() };
      extraPlayerPatch.status = "safe";
      break;
    case "ghostMode":
      newActive.ghostMode = { active: true, expiresAt: new Date(now + durationMs!).toISOString() };
      break;
    case "decoy":
      newActive.decoy = {
        active: true,
        expiresAt: new Date(now + durationMs!).toISOString(),
        fakeZone: extra?.fakeZone ?? "Unknown Zone",
      };
      break;
    case "bounty":
      if (!extra?.targetId || !extra?.bountyPoints) throw new Error("Pick a target and amount");
      newActive.bounty = { active: true, targetId: extra.targetId, pointsReward: extra.bountyPoints };
      feedMsg = `💰 @${username} placed a ${extra.bountyPoints}pt bounty`;
      break;
    case "selfPurge":
      newActive.selfPurge = { active: true, expiresAt: new Date(now + durationMs!).toISOString() };
      feedMsg = `☠️ PURGE — @${username} is open season!`;
      break;
    case "uav":
      newActive.uav = { active: true, expiresAt: new Date(now + durationMs!).toISOString(), activatedBy: userId };
      // Propagate to all teammates
      if (teamId) {
        await supabase.from("players").update({
          powerup_active: { uav: newActive.uav },
        } as never).eq("game_id", gameId).eq("team_id", teamId);
      }
      feedMsg = `📡 @${username}'s team activated UAV`;
      break;
    case "teamShield":
      if (!teamId) throw new Error("You need a team");
      newActive.teamShield = { active: true, expiresAt: new Date(now + durationMs!).toISOString(), teamId };
      // Mark all teammates safe
      await supabase.from("players").update({ status: "safe" } as never)
        .eq("game_id", gameId).eq("team_id", teamId);
      feedMsg = `🛡️ Team Shield up — @${username}`;
      break;
    case "revive":
      if (!extra?.targetId) throw new Error("Pick a player to revive");
      await supabase.from("players").update({ status: "active" } as never)
        .eq("game_id", gameId).eq("user_id", extra.targetId);
      feedMsg = `🔄 @${username} revived a player`;
      break;
  }

  const { error } = await supabase.from("players").update({
    powerup_inventory: newInv,
    powerup_active: newActive,
    ...extraPlayerPatch,
  } as never).eq("id", playerId);
  if (error) throw error;

  await supabase.from("events").insert({
    game_id: gameId, type: "powerup", created_by: userId, message: feedMsg,
  });
}

export async function purchasePowerup(opts: {
  playerId: string;
  type: PowerupType;
  cost: number;
  currentPoints: number;
  currentInventory: Record<string, number>;
}) {
  const { playerId, type, cost, currentPoints, currentInventory } = opts;
  if ((currentInventory[type] ?? 0) >= 1) throw new Error("You already own one");
  if (currentPoints < cost) throw new Error("Not enough points");
  const newInv = { ...currentInventory, [type]: (currentInventory[type] ?? 0) + 1 };
  const { error } = await supabase.from("players").update({
    points: currentPoints - cost,
    powerup_inventory: newInv,
  } as never).eq("id", playerId);
  if (error) throw error;
}
