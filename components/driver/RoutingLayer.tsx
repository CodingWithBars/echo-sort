"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "./MapAssets";

interface RoutingLayerProps {
  driverPos: [number, number] | null;
  bins: any[];
  selectedBinId: number | null;
  routeKey: number;
  onRouteUpdate: (summary: { distance: number; time: number }) => void;
  mode: "fastest" | "priority";
  maxDetour: number;
  useFence: boolean;

  dumpSite?: [number, number] | null;
  snapToRoad?: boolean;
  clusterRadius?: number;
  minMoveBeforeReroute?: number;
}

export default function RoutingLayer(props: RoutingLayerProps) {
  const {
    driverPos,
    bins,
    selectedBinId,
    routeKey,
    onRouteUpdate,
    mode,
    maxDetour,
    useFence,
    dumpSite,
    snapToRoad = true,
    clusterRadius = 35,
    minMoveBeforeReroute = 8,
  } = props;

  const map = useMap();
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastDriverPos = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!map || !driverPos || bins.length === 0) return;

    if (lastDriverPos.current) {
      const moved = getDistance(lastDriverPos.current, driverPos);
      if (moved < minMoveBeforeReroute && routeKey === 0) return;
    }
    lastDriverPos.current = driverPos;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const GLOBAL_MAX_RANGE = 2500;

    // --- 1. RADIUS FILTER ---
    let nearbyBins = bins.filter((b) => {
      if (!useFence) return true;
      const d = getDistance(driverPos, [b.lat, b.lng]);
      return d <= GLOBAL_MAX_RANGE || b.id === selectedBinId;
    });

    if (!nearbyBins.length) return clearPath();

    // --- 2. CLUSTER BINS ---
    nearbyBins = clusterBins(nearbyBins, clusterRadius);

    // --- 3. TIERING ---
    let urgent = nearbyBins.filter(
      (b) => b.fillLevel >= 70 || b.id === selectedBinId,
    );
    let optional = nearbyBins.filter(
      (b) =>
        b.fillLevel >= 40 &&
        b.fillLevel < 70 &&
        b.id !== selectedBinId &&
        b.fillLevel > 0,
    );

    if (!urgent.length && !optional.length) {
      clearPath();
      onRouteUpdate({ distance: 0, time: 0 });
      return;
    }

    if (!urgent.length) urgent = [...optional];

    // =========================================================
    // 🔥 4. BUILD ROUTE ORDER WITH LOOK-AHEAD
    // =========================================================

    let currentPos = driverPos;
    const route: [number, number][] = [driverPos];
    const visited = new Set<number>();

    while (urgent.length > 0) {

      // ⭐ LOOK-AHEAD SELECTION
      let bestIdx = 0;
      let bestScore = Infinity;

      for (let i = 0; i < urgent.length; i++) {
        const candidate = urgent[i];

        const candidatePos: [number, number] = [
          candidate.lat,
          candidate.lng,
        ];

        // simulate going to this bin first
        const simulatedStops: [number, number][] = [
          currentPos,
          candidatePos,
          ...urgent
            .filter((_, j) => j !== i)
            .map((b) => [b.lat, b.lng] as [number, number]),
        ];

        const score = approximateRouteCost(simulatedStops);

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      const target = urgent.splice(bestIdx, 1)[0];
      const targetPos: [number, number] = [target.lat, target.lng];

      // --- OPTIONAL INSERTION (UNCHANGED LOGIC) ---
      const candidates = optional.filter((o) => !visited.has(o.id));
      const valid: any[] = [];

      const baseDist = getDistance(currentPos, targetPos);

      candidates.forEach((opt) => {
        const d1 = getDistance(currentPos, [opt.lat, opt.lng]);
        const d2 = getDistance([opt.lat, opt.lng], targetPos);
        const deviation = d1 + d2 - baseDist;
        if (deviation <= maxDetour) valid.push(opt);
      });

      valid.sort(
        (a, b) =>
          getDistance(currentPos, [a.lat, a.lng]) -
          getDistance(currentPos, [b.lat, b.lng]),
      );

      valid.forEach((v) => {
        route.push([v.lat, v.lng]);
        visited.add(v.id);
        optional = optional.filter((o) => o.id !== v.id);
        currentPos = [v.lat, v.lng];
      });

      route.push(targetPos);
      visited.add(target.id);
      currentPos = targetPos;
    }

    // --- 5. RETURN TO DUMP SITE ---
    if (dumpSite) route.push(dumpSite);

    // --- 6. SNAP DRIVER TO ROAD ---
    const finalRoute = snapToRoad ? snapFirstPoint(route) : route;

    // --- 7. MAPBOX LIMIT ---
    const safeRoute = finalRoute.slice(0, 25);

    fetchRoute(safeRoute);

    return () => abortRef.current?.abort();

    // =========================================================
    // ROUTE FETCH (UNCHANGED)
    async function fetchRoute(points: [number, number][]) {
      const coords = points.map((p) => `${p[1]},${p[0]}`).join(";");

      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}` +
        `?geometries=geojson&overview=full&access_token=` +
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

      try {
        const res = await fetch(url, { signal: abortRef.current?.signal });
        const data = await res.json();

        if (!data.routes?.length) {
          clearPath();
          return;
        }

        const r = data.routes[0];
        const coordsLL = r.geometry.coordinates.map((c: any) => [c[1], c[0]]);

        clearPath();

        pathLayerRef.current = L.polyline(coordsLL, {
          color: mode === "priority" ? "#f97316" : "#10b981",
          weight: 6,
          opacity: 0.85,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);

        onRouteUpdate({ distance: r.distance, time: r.duration });
      } catch (err: any) {
        if (err.name !== "AbortError") console.error(err);
      }
    }

    function clearPath() {
      if (pathLayerRef.current) {
        map.removeLayer(pathLayerRef.current);
        pathLayerRef.current = null;
      }
    }

    // =========================================================
    // HELPERS (YOURS + 1 NEW)

    function clusterBins(list: any[], radius: number) {
      const clustered: any[] = [];

      list.forEach((bin) => {
        const existing = clustered.find(
          (c) => getDistance([c.lat, c.lng], [bin.lat, bin.lng]) <= radius,
        );

        if (existing) {
          existing.lat = (existing.lat + bin.lat) / 2;
          existing.lng = (existing.lng + bin.lng) / 2;
          existing.fillLevel = Math.max(existing.fillLevel, bin.fillLevel);
        } else {
          clustered.push({ ...bin });
        }
      });

      return clustered;
    }

    function snapFirstPoint(points: [number, number][]) {
      return points;
    }

    // ⭐ NEW — FAST APPROX LOOK-AHEAD COST
    function approximateRouteCost(points: [number, number][]) {
      let total = 0;
      for (let i = 0; i < points.length - 1; i++) {
        total += getDistance(points[i], points[i + 1]);
      }
      return total;
    }
  }, [
    map,
    driverPos,
    bins.length,
    selectedBinId,
    routeKey,
    mode,
    maxDetour,
    useFence,
    dumpSite,
  ]);

  return null;
}
