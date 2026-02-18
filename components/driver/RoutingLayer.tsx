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
    const MIN_FILL_THRESHOLD = 40;

    // =========================================================
    // 1. RADIUS FILTER
    let nearbyBins = bins.filter((b) => {
      if (!useFence) return true;
      const d = getDistance(driverPos, [b.lat, b.lng]);
      return d <= GLOBAL_MAX_RANGE || b.id === selectedBinId;
    });

    // =========================================================
    // 2. CLUSTER
    nearbyBins = clusterBins(nearbyBins, clusterRadius);

    // =========================================================
    // 3. THRESHOLD FILTER (NEW LOGIC)
    nearbyBins = nearbyBins.filter(
      (b) => b.fillLevel >= MIN_FILL_THRESHOLD
    );

    if (!nearbyBins.length) {
      clearPath();
      onRouteUpdate({ distance: 0, time: 0 });
      return;
    }

    // =========================================================
    // 🧠 SERVICE-FIRST ROUTE BUILDER
    // =========================================================

    let currentPos = driverPos;
    const route: [number, number][] = [driverPos];
    const remaining = [...nearbyBins];

    let accumulatedDistance = 0;

    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const candidatePos: [number, number] = [candidate.lat, candidate.lng];

        const d = getDistance(currentPos, candidatePos);

        // ---------- EARLY DETOUR PRUNING ----------
        if (
          accumulatedDistance > 0 &&
          d / accumulatedDistance > maxDetour
        ) {
          continue;
        }

        const score = serviceScore(
          currentPos,
          candidatePos,
          candidate.fillLevel,
          route,
          remaining,
          i
        );

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;

      const chosen = remaining.splice(bestIdx, 1)[0];
      const chosenPos: [number, number] = [chosen.lat, chosen.lng];

      accumulatedDistance += getDistance(currentPos, chosenPos);
      route.push(chosenPos);
      currentPos = chosenPos;
    }

    if (dumpSite) route.push(dumpSite);

    const finalRoute = snapToRoad ? route : route;
    const safeRoute = finalRoute.slice(0, 25);

    fetchRoute(safeRoute);

    return () => abortRef.current?.abort();

    // =========================================================
    // ROUTE FETCH
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
    // 🧠 SERVICE-FIRST COST FUNCTION
    function serviceScore(
      from: [number, number],
      to: [number, number],
      fill: number,
      route: [number, number][],
      all: any[],
      index: number
    ) {
      const distance = getDistance(from, to);

      // α Distance
      const distanceCost = distance * 1.0;

      // δ Fill priority
      const fillReward = fill * 25;

      // γ Cluster reward (service density)
      let cluster = 0;
      for (let j = 0; j < all.length; j++) {
        if (j === index) continue;
        if (getDistance(to, [all[j].lat, all[j].lng]) < 120) cluster++;
      }
      const clusterReward = cluster * 200;

      // ε Soft U-turn penalty (angle-based, never prohibitive)
      let turnPenalty = 0;
      if (route.length >= 2) {
        const p1 = route[route.length - 2];
        const p2 = route[route.length - 1];

        const v1 = [p2[0] - p1[0], p2[1] - p1[1]];
        const v2 = [to[0] - p2[0], to[1] - p2[1]];

        const dot = v1[0] * v2[0] + v1[1] * v2[1];
        const mag1 = Math.hypot(v1[0], v1[1]);
        const mag2 = Math.hypot(v2[0], v2[1]);

        if (mag1 && mag2) {
          const angle = Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI;
          turnPenalty = angle * 4; // soft, U-turn allowed
        }
      }

      // Backtracking penalty (centroid-based)
      let centroidLat = 0;
      let centroidLng = 0;
      all.forEach((b) => {
        centroidLat += b.lat;
        centroidLng += b.lng;
      });
      centroidLat /= all.length;
      centroidLng /= all.length;

      const backtrackPenalty =
        getDistance(to, [centroidLat, centroidLng]) * 0.3;

      return (
        distanceCost +
        backtrackPenalty +
        turnPenalty -
        clusterReward -
        fillReward
      );
    }

    // =========================================================
    // HELPERS
    function clusterBins(list: any[], radius: number) {
      const clustered: any[] = [];

      list.forEach((bin) => {
        const existing = clustered.find(
          (c) => getDistance([c.lat, c.lng], [bin.lat, bin.lng]) <= radius
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