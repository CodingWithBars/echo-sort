"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "../map/MapAssets";

export default function RoutingLayer({
  driverPos, bins, selectedBinId, onRouteUpdate,
  routeKey = 0, mode = "fastest", useFence = true
}: any) {
  const map = useMap();
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!map || !driverPos || bins.length === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // 1. Filter logic: Urgent bins or selected one
    let targets = bins.filter((b: any) => b.fillLevel >= 40 || b.id === selectedBinId);
    
    if (useFence) {
      targets = targets.filter((b: any) => getDistance(driverPos, [b.lat, b.lng]) < 2500);
    }

    if (targets.length === 0) {
      if (pathLayerRef.current) map.removeLayer(pathLayerRef.current);
      return;
    }

    // 2. Prepare Coordinates (Mapbox uses [lng, lat])
    // We put driverPos first and use source=first in the API
    const coords = [driverPos, ...targets.map((t: any) => [t.lat, t.lng])]
      .map(p => `${p[1]},${p[0]}`).join(";");

    // 3. Set 'approaches' to curb for all target waypoints (except the start)
    const approaches = ["unrestricted", ...targets.map(() => "curb")].join(";");

    // 4. Optimization API Call
    // profile: driving-traffic accounts for 2026 real-time congestion
    const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coords}?source=first&roundtrip=false&approaches=${approaches}&geometries=geojson&overview=full&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

    fetch(url, { signal: abortRef.current.signal })
      .then(res => res.json())
      .then(data => {
        if (!data.trips?.[0]) return;
        
        const trip = data.trips[0];
        const coordinates = trip.geometry.coordinates.map((c: any) => [c[1], c[0]]);

        // 5. Draw the Emerald/Orange route
        if (pathLayerRef.current) map.removeLayer(pathLayerRef.current);
        pathLayerRef.current = L.polyline(coordinates, {
          color: mode === "priority" ? "#f97316" : "#10b981", 
          weight: 7, // Thicker for truck visibility
          opacity: 0.8,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        // 6. Push stats back to the EcoDashboard
        onRouteUpdate({
          dist: `${(trip.distance / 1000).toFixed(1)} km`,
          time: `${Math.round(trip.duration / 60)} min`
        });

        // 7. Auto-focus the map on the new route
        map.fitBounds(pathLayerRef.current.getBounds(), { padding: [50, 50] });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error("Mapbox Opt Error:", err);
      });

    return () => abortRef.current?.abort();
  }, [map, driverPos, bins, selectedBinId, routeKey, mode, useFence]);

  return null;
}