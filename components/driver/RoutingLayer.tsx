"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "../map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface RoutingProps {
  driverPos: [number, number];
  bins: any[];
  selectedBinId: number | null;
  onRouteUpdate: (stats: { dist: string; time: string }) => void;
  // Called after A* resolves — gives parent the ordered bin list for a legend
  onOrderUpdate?: (orderedBins: any[]) => void;
  routeKey?: number;
  mode?: "fastest" | "priority";
  useFence?: boolean;
  maxDetour?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE DISTANCE  (metres)
// ─────────────────────────────────────────────────────────────────────────────

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTANCE MATRIX
// ─────────────────────────────────────────────────────────────────────────────

function buildDistMatrix(nodes: [number, number][]): number[][] {
  return nodes.map((a) => nodes.map((b) => haversine(a, b)));
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIM'S MST COST  — admissible A* heuristic lower bound
// ─────────────────────────────────────────────────────────────────────────────

function mstCost(indices: number[], dist: number[][]): number {
  if (indices.length <= 1) return 0;
  const inMST = new Set<number>([indices[0]]);
  let total = 0;
  while (inMST.size < indices.length) {
    let best = Infinity, bestNode = -1;
    for (const u of inMST)
      for (const v of indices)
        if (!inMST.has(v) && dist[u][v] < best) { best = dist[u][v]; bestNode = v; }
    if (bestNode === -1) break;
    inMST.add(bestNode);
    total += best;
  }
  return total;
}

function admissibleH(cur: number, mask: number, dist: number[][], n: number): number {
  const unvisited: number[] = [];
  for (let i = 1; i < n; i++) if (!(mask & (1 << i))) unvisited.push(i);
  if (unvisited.length === 0) return 0;
  const minEdge = Math.min(...unvisited.map((v) => dist[cur][v]));
  return minEdge + mstCost(unvisited, dist);
}

// ─────────────────────────────────────────────────────────────────────────────
// NEAREST-NEIGHBOR GREEDY  — fallback for large sets
// ─────────────────────────────────────────────────────────────────────────────

function nearestNeighbor(dist: number[][]): number[] {
  const n = dist.length;
  const visited = new Set([0]);
  const path = [0];
  while (visited.size < n) {
    const last = path[path.length - 1];
    let best = Infinity, bestNode = -1;
    for (let j = 1; j < n; j++)
      if (!visited.has(j) && dist[last][j] < best) { best = dist[last][j]; bestNode = j; }
    if (bestNode === -1) break;
    visited.add(bestNode);
    path.push(bestNode);
  }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// A* TSP SOLVER
// State: (currentNode, visitedBitmask) — at most n × 2ⁿ states
// Heuristic: MST lower bound (admissible → globally optimal result)
// Falls back to nearest-neighbor for n > A_STAR_LIMIT
// ─────────────────────────────────────────────────────────────────────────────

const A_STAR_LIMIT = 12;

function astarTSP(nodes: [number, number][], dist: number[][]): number[] {
  const n = nodes.length;
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];
  if (n > A_STAR_LIMIT) {
    console.info(`[A* TSP] ${n} stops > limit ${A_STAR_LIMIT} → nearest-neighbor fallback`);
    return nearestNeighbor(dist);
  }

  const allVisited = (1 << n) - 1;
  const startMask = 1;

  const gCost: number[][] = Array.from({ length: n }, () =>
    new Array<number>(1 << n).fill(Infinity)
  );
  gCost[0][startMask] = 0;

  const pathAt = new Map<string, number[]>();
  pathAt.set(`0,${startMask}`, [0]);

  interface Entry { node: number; mask: number; g: number; f: number; }
  const open: Entry[] = [{
    node: 0, mask: startMask, g: 0,
    f: admissibleH(0, startMask, dist, n),
  }];

  while (open.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[minIdx].f) minIdx = i;
    const curr = open.splice(minIdx, 1)[0];

    if (curr.mask === allVisited)
      return pathAt.get(`${curr.node},${curr.mask}`) ?? nearestNeighbor(dist);

    if (curr.g > gCost[curr.node][curr.mask]) continue;

    for (let next = 1; next < n; next++) {
      if (curr.mask & (1 << next)) continue;
      const newMask = curr.mask | (1 << next);
      const newG = curr.g + dist[curr.node][next];
      if (newG < gCost[next][newMask]) {
        gCost[next][newMask] = newG;
        const h = admissibleH(next, newMask, dist, n);
        const prev = pathAt.get(`${curr.node},${curr.mask}`) ?? [0];
        pathAt.set(`${next},${newMask}`, [...prev, next]);
        open.push({ node: next, mask: newMask, g: newG, f: newG + h });
      }
    }
  }
  return nearestNeighbor(dist);
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

// Numbered sequence badge rendered on top of each bin marker
function sequenceIcon(step: number, fillLevel: number, isSelected: boolean): L.DivIcon {
  const urgent = fillLevel >= 80;
  const bg = isSelected
    ? "#2563eb"           // blue – selected
    : urgent
    ? "#dc2626"           // red  – critical fill
    : "#059669";          // green – normal

  const border = isSelected ? "#93c5fd" : urgent ? "#fca5a5" : "#6ee7b7";

  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:${bg};border:2.5px solid ${border};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        font-size:13px;font-weight:700;color:#fff;
        font-family:sans-serif;
      ">${step}</div>`,
  });
}

// Small depot icon for the driver's start position in the sequence layer
function depotIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div style="
        width:36px;height:36px;border-radius:6px;
        background:#d97706;border:2.5px solid #fcd34d;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        font-size:10px;font-weight:800;color:#fff;
        font-family:sans-serif;letter-spacing:.04em;
      ">HQ</div>`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING LAYER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RoutingLayer({
  driverPos,
  bins,
  selectedBinId,
  onRouteUpdate,
  onOrderUpdate,
  routeKey = 0,
  mode = "fastest",
  useFence = true,
  maxDetour = 1000,
}: RoutingProps) {
  const map = useMap();

  // Road geometry polylines
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const glowLayerRef = useRef<L.Polyline | null>(null);

  // A* visual layer group — sequence markers + dashed order line
  const sequenceGroupRef = useRef<L.LayerGroup | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Stable callback refs — never cause the effect to re-run
  const onRouteUpdateRef = useRef(onRouteUpdate);
  useEffect(() => { onRouteUpdateRef.current = onRouteUpdate; });

  const onOrderUpdateRef = useRef(onOrderUpdate);
  useEffect(() => { onOrderUpdateRef.current = onOrderUpdate; });

  useEffect(() => {
    // ── 1. GUARD & ABORT ──────────────────────────────────────────────────
    if (!map || !driverPos || bins.length === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // ── 2. CLEAR PREVIOUS VISUALS ─────────────────────────────────────────
    if (pathLayerRef.current)   { map.removeLayer(pathLayerRef.current);   pathLayerRef.current   = null; }
    if (glowLayerRef.current)   { map.removeLayer(glowLayerRef.current);   glowLayerRef.current   = null; }
    if (sequenceGroupRef.current) { map.removeLayer(sequenceGroupRef.current); sequenceGroupRef.current = null; }

    // ── 3. TARGET SELECTION ───────────────────────────────────────────────
    let targets = bins.filter(
      (b: any) => b.fillLevel >= 40 || b.id === selectedBinId
    );
    if (useFence)
      targets = targets.filter(
        (b: any) => getDistance(driverPos, [b.lat, b.lng]) < 2500
      );
    if (maxDetour && maxDetour < 2500)
      targets = targets.filter(
        (b: any) => getDistance(driverPos, [b.lat, b.lng]) < maxDetour
      );

    if (targets.length === 0) return;

    // ── 4. A* TSP — OPTIMAL STOP ORDER ───────────────────────────────────
    const binCoords: [number, number][] = targets.map(
      (t: any) => [t.lat, t.lng] as [number, number]
    );
    const allNodes: [number, number][] = [driverPos, ...binCoords];
    const dist = buildDistMatrix(allNodes);

    console.info(
      `[A* TSP] Solving: 1 depot + ${targets.length} bins = ${allNodes.length} nodes`
    );
    const orderedIndices = astarTSP(allNodes, dist);
    console.info(`[A* TSP] Order: ${orderedIndices.join(" → ")}`);

    // Map indices back to actual bin objects (index 0 = driver, skip it)
    const orderedTargets = orderedIndices
      .filter((i) => i !== 0)
      .map((i) => targets[i - 1]);

    // ── 5. RENDER A* SEQUENCE VISUALS ─────────────────────────────────────
    //
    // Shown immediately (before the Mapbox fetch completes) so the driver
    // can see the planned order as soon as A* finishes.
    //
    // Layers added to a LayerGroup so they can be cleared atomically.
    //
    const group = L.layerGroup().addTo(map);
    sequenceGroupRef.current = group;

    // 5a. Depot marker at driver position
    L.marker(driverPos, { icon: depotIcon(), zIndexOffset: 1000 }).addTo(group);

    // 5b. Thin dashed "as-the-crow-flies" connector showing A* visit order.
    //     Gives an instant visual of the sequence while road geometry loads.
    const sequenceLine: [number, number][] = [
      driverPos,
      ...orderedTargets.map((t: any) => [t.lat, t.lng] as [number, number]),
    ];
    L.polyline(sequenceLine, {
      color: mode === "priority" ? "#f97316" : "#059669",
      weight: 1.5,
      opacity: 0.45,
      dashArray: "6 6",
    }).addTo(group);

    // 5c. Numbered badge at each bin in visit order
    orderedTargets.forEach((bin: any, idx: number) => {
      L.marker([bin.lat, bin.lng] as [number, number], {
        icon: sequenceIcon(idx + 1, bin.fillLevel, bin.id === selectedBinId),
        zIndexOffset: 900,
      })
        .bindTooltip(
          `<b>Stop ${idx + 1}</b><br>${bin.name ?? "Bin"}<br>Fill: ${bin.fillLevel}%`,
          { direction: "top", offset: [0, -18], opacity: 0.92 }
        )
        .addTo(group);
    });

    // Notify parent of the resolved order (for sidebar legend etc.)
    onOrderUpdateRef.current?.(orderedTargets);

    // ── 6. FETCH ROAD GEOMETRY FROM MAPBOX DIRECTIONS ─────────────────────
    //
    // We pass the A*-ordered waypoints directly — Mapbox just snaps them to
    // roads and returns the geometry. No re-ordering happens server-side.
    //
    const waypointsOrdered = [
      driverPos,
      ...orderedTargets.map((t: any) => [t.lat, t.lng]),
    ];
    const coords = waypointsOrdered
      .map((p: any) => `${p[1]},${p[0]}`)  // [lat,lng] → "lng,lat" for Mapbox
      .join(";");

    const profile =
      mode === "priority" ? "mapbox/driving" : "mapbox/driving-traffic";

    const url =
      `https://api.mapbox.com/directions/v5/${profile}/${coords}` +
      `?geometries=geojson&overview=full&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

    fetch(url, { signal })
      .then((res) => res.json())
      .then((data: any) => {
        if (!data.routes?.[0]) {
          console.warn("[RoutingLayer] No route from Mapbox Directions.");
          return;
        }

        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]  // lng,lat → lat,lng for Leaflet
        );

        // ── 7. RENDER ROAD GEOMETRY ───────────────────────────────────────
        // Glow halo
        glowLayerRef.current = L.polyline(coordinates, {
          color: mode === "priority" ? "#fb923c" : "#10b981",
          weight: 12,
          opacity: 0.15,
          lineJoin: "round",
        }).addTo(map);

        // Solid route line — drawn on top of the dashed sequence preview
        pathLayerRef.current = L.polyline(coordinates, {
          color: mode === "priority" ? "#f97316" : "#059669",
          weight: 5,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round",
          dashArray: mode === "priority" ? "1, 12" : undefined,
        }).addTo(map);

        // Bring sequence markers to the front so they sit above the polyline
        group.eachLayer((layer) => {
          if (layer instanceof L.Marker) layer.setZIndexOffset(1100);
        });

        // ── 8. DASHBOARD SYNC ─────────────────────────────────────────────
        onRouteUpdateRef.current({
          dist: `${(route.distance / 1000).toFixed(1)} km`,
          time: `${Math.round(route.duration / 60)} min`,
        });

        // ── 9. FIT MAP TO ROUTE ───────────────────────────────────────────
        map.fitBounds(pathLayerRef.current.getBounds(), {
          padding: [80, 80],
          animate: true,
          duration: 1.5,
        });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError")
          console.error("[RoutingLayer] Mapbox error:", err);
      });

    return () => {
      abortRef.current?.abort();
    };

    // onRouteUpdate / onOrderUpdate intentionally omitted — kept fresh via refs
  }, [map, driverPos, bins, selectedBinId, routeKey, mode, useFence, maxDetour]);

  return null;
}