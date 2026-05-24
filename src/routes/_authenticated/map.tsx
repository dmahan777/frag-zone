import { createFileRoute } from "@tanstack/react-router";
import { Map as MapIcon, Shield, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <div className="px-5 pt-12">
      <h1 className="font-display text-3xl font-extrabold">Battlefield</h1>
      <p className="text-sm text-muted-foreground mt-1">Live zones & safe areas</p>

      <div className="mt-6 relative aspect-square rounded-3xl bg-card border border-border overflow-hidden bg-grid">
        {/* stylized "map" placeholder while geolocation/leaflet isn't wired */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-primary/10" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <MapIcon className="h-12 w-12 text-primary" />
          <p className="mt-3 font-display font-bold text-lg">Map coming online</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">Dark Leaflet tiles, zone dots, and safe-zone radii will appear here when geolocation is enabled.</p>
        </div>
        {/* decorative pulses */}
        <div className="absolute top-1/3 left-1/4 h-3 w-3 rounded-full bg-primary animate-pulse-ring" />
        <div className="absolute bottom-1/3 right-1/4 h-3 w-3 rounded-full bg-danger animate-pulse-ring" />
        <div className="absolute top-1/2 right-1/3 h-3 w-3 rounded-full bg-success" />
      </div>

      <div className="mt-5 space-y-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-success" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Nearest safe zone</p>
            <p className="text-xs text-muted-foreground">No active safe zones yet</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Radio className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Legend</p>
            <p className="text-xs text-muted-foreground">Cyan = you · Pink = target · Red = threats · Green = safe</p>
          </div>
        </div>
      </div>
    </div>
  );
}
