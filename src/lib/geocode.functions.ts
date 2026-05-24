import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const reverseGeocodeCity = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !connKey) return { label: `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` };

    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?latlng=${data.lat},${data.lng}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": connKey,
      },
    });
    const json: any = await res.json();
    const results: any[] = json?.results ?? [];
    if (!results.length) return { label: `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` };

    // Find the most specific city-level component across all results
    let city: string | undefined;
    let region: string | undefined;
    let country: string | undefined;
    const cityPriority = ["locality", "postal_town", "sublocality", "neighborhood", "administrative_area_level_3"];
    outer: for (const type of cityPriority) {
      for (const r of results) {
        const c = (r.address_components ?? []).find((x: any) => x.types.includes(type));
        if (c) { city = c.long_name; break outer; }
      }
    }
    for (const r of results) {
      for (const c of r.address_components ?? []) {
        if (!region && c.types.includes("administrative_area_level_1")) region = c.short_name;
        if (!country && c.types.includes("country")) country = c.short_name;
      }
    }

    const parts = [city, region, country && country !== "US" ? country : null].filter(Boolean);
    return { label: parts.length ? parts.join(", ") : `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` };

  });
