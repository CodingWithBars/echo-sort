"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RoutingLayerGL
//
// MapLibre GL port of RoutingLayer.tsx.
// ALL algorithm logic, proximity detection, URL building strategy, snap radius
// fallback chain, bearing hints, console logging, U-turn classification and
// pass-through detection are 100% identical to the Leaflet version.
//
// Only the rendering layer changes:
//   L.Polyline          → <Source> + <Layer> (GeoJSON)
//   L.Marker divIcon    → <Marker> with React DOM children
//   L.layerGroup        → React state (declarative, no imperative layer mgmt)
//   map.fitBounds()     → same API, MapLibre LngLatBounds format
//   useMap() leaflet    → useMap() from react-map-gl/maplibre
//
// Route visibility fix: all Source/Layer IDs are prefixed with a unique
// `calcId` that increments on every recalculation — prevents "source already
// exists" MapLibre errors when the route updates mid-session.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Source, Layer, Marker, useMap } from "react-map-gl/maplibre";
import { getDistance } from "../map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY THRESHOLDS  (identical to RoutingLayer)
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_DISTANCE_M  = 30;   // show toast when within 30 m of the next stop
const ARRIVE_DISTANCE_M = 8;    // upgrade to "arrived" toast within 8 m

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATION  (identical to RoutingLayer — pure React DOM)
// ─────────────────────────────────────────────────────────────────────────────

type ToastState = {
  stopNum:   number;
  binName:   string;
  fillLevel: number;
  dist:      number;
  arrived:   boolean;
  isUturn:   boolean;
} | null;

function ProximityToast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  const bg     = toast.arrived ? "#059669" : "#1e40af";
  const border = toast.arrived ? "#34d399" : "#60a5fa";
  const tagBg  = toast.fillLevel >= 90 ? "#dc2626"
               : toast.fillLevel >= 70 ? "#ea580c"
               : toast.fillLevel >= 40 ? "#ca8a04" : "#16a34a";

  return (
    <div style={{
      position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)",
      zIndex: 2000, display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", borderRadius: 14, background: bg,
      border: `1.5px solid ${border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      fontFamily: "'DM Mono','Fira Code',monospace", minWidth: 240, maxWidth: 320,
      animation: "toastIn .25s ease", pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: 18, color: "#fff",
      }}>
        {toast.arrived ? "✓" : "⬆"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 2 }}>
          {toast.arrived ? `Stop ${toast.stopNum} — arrived` : `Stop ${toast.stopNum} — approaching`}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis" }}>
          {toast.binName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: tagBg, padding: "1px 7px", borderRadius: 20 }}>
            {toast.fillLevel}% full
          </span>
          {!toast.arrived && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}>
              {Math.round(toast.dist)} m away
            </span>
          )}
          {toast.isUturn && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fcd34d" }}>
              ↩ U-turn ahead
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCE MARKER  (replaces L.divIcon sequenceIcon)
// ─────────────────────────────────────────────────────────────────────────────

function SequenceMarkerGL({
  bin, stopNum, isSelected, isUturn,
}: { bin: any; stopNum: number; isSelected: boolean; isUturn: boolean }) {
  const urgent  = bin.fillLevel >= 80;
  const bg      = isSelected ? "#2563eb" : urgent ? "#dc2626" : "#059669";
  const border  = isSelected ? "#93c5fd" : urgent ? "#fca5a5" : "#6ee7b7";

  return (
    <Marker longitude={bin.lng} latitude={bin.lat} anchor="center">
      <div style={{ position: "relative", width: 32, height: 32 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: bg,
          border: `2.5px solid ${border}`,
          boxShadow: isUturn
            ? "0 0 0 3px #f59e0b, 0 2px 8px rgba(0,0,0,.35)"
            : "0 2px 8px rgba(0,0,0,.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "sans-serif",
        }}>
          {stopNum}
        </div>
        {isUturn && (
          <div style={{
            position: "absolute", top: -6, right: -6,
            width: 14, height: 14, borderRadius: "50%",
            background: "#f59e0b", border: "1.5px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "#fff", lineHeight: 1,
          }}>↩</div>
        )}
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface RoutingProps {
  driverPos:       [number, number];
  bins:            any[];
  selectedBinId:   number | null;
  onRouteUpdate:   (stats: { dist: string; time: string }) => void;
  onOrderUpdate?:  (orderedBins: any[]) => void;
  routeKey?:       number;
  mode?:           "fastest" | "priority";
  useFence?:       boolean;
  maxDetour?:      number;
  routingPos?:     [number, number] | null;
  heading?:        number;
  destinationPos?: [number, number] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE DISTANCE  (metres)  — identical to RoutingLayer
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

function buildDistMatrix(nodes: [number, number][]): number[][] {
  return nodes.map(a => nodes.map(b => haversine(a, b)));
}

// ─────────────────────────────────────────────────────────────────────────────
// BEARING  (degrees, 0=North, clockwise)  — identical
// ─────────────────────────────────────────────────────────────────────────────

function bearing(from: [number, number], to: [number, number]): number {
  const r    = (d: number) => (d * Math.PI) / 180;
  const dLon = r(to[1] - from[1]);
  const y    = Math.sin(dLon) * Math.cos(r(to[0]));
  const x    = Math.cos(r(from[0])) * Math.sin(r(to[0]))
             - Math.sin(r(from[0])) * Math.cos(r(to[0])) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANGULAR DIFFERENCE  — identical
// ─────────────────────────────────────────────────────────────────────────────

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ─────────────────────────────────────────────────────────────────────────────
// U-TURN PENALTY MODEL  — identical
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_SIDE_M  = 80;
const PENALTY_UTURN_M = 250;

function uturnPenalty(
  fromPos:    [number, number],
  toPos:      [number, number],
  curHeading: number
): number {
  const turn = angleDiff(curHeading, bearing(fromPos, toPos));
  if (turn <= 60)  return 0;
  if (turn <= 120) return PENALTY_SIDE_M;
  return PENALTY_UTURN_M;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASS-THROUGH DETECTION  — identical
// ─────────────────────────────────────────────────────────────────────────────

const PASS_THRESHOLD_M = 40;
const PASSTHROUGH_COST = 600;

function pointToSegmentDist(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const toXY = (ll: [number, number]) => [
    ll[1] * Math.cos((ll[0] * Math.PI) / 180) * 111_320,
    ll[0] * 110_540,
  ];
  const [px, py] = toXY(p);
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);

  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  if (t < 0.05 || t > 0.95) return Infinity;

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADING-AWARE DISTANCE MATRIX  — identical
// ─────────────────────────────────────────────────────────────────────────────

function buildHeadingAwareMatrix(
  nodes:         [number, number][],
  driverHeading: number,
  destIdx:       number = -1
): number[][] {
  const n    = nodes.length;
  const base = buildDistMatrix(nodes);
  const mat  = base.map(r => [...r]);

  for (let j = 1; j < n; j++) {
    if (j === destIdx) continue;
    mat[0][j] = base[0][j] + uturnPenalty(nodes[0], nodes[j], driverHeading);
  }

  for (let i = 1; i < n; i++) {
    if (i === destIdx) continue;
    const arrivalAtI = bearing(nodes[0], nodes[i]);
    for (let j = 1; j < n; j++) {
      if (i === j || j === destIdx) continue;
      let cost = base[i][j] + uturnPenalty(nodes[i], nodes[j], arrivalAtI);
      for (let k = 1; k < n; k++) {
        if (k === i || k === j || k === destIdx) continue;
        if (pointToSegmentDist(nodes[k], nodes[i], nodes[j]) < PASS_THRESHOLD_M) {
          cost += PASSTHROUGH_COST;
          break;
        }
      }
      mat[i][j] = cost;
    }
  }

  if (destIdx > 0) {
    for (let i = 0; i < n; i++) {
      if (i !== destIdx) mat[i][destIdx] = base[i][destIdx];
    }
  }

  return mat;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIM'S MST  — identical
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
  return Math.min(...unvisited.map(v => dist[cur][v])) + mstCost(unvisited, dist);
}

// ─────────────────────────────────────────────────────────────────────────────
// NEAREST-NEIGHBOR FALLBACK  — identical
// ─────────────────────────────────────────────────────────────────────────────

function nearestNeighbor(dist: number[][]): number[] {
  const n       = dist.length;
  const visited = new Set([0]);
  const path    = [0];
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
// A* TSP  — identical
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
  const gCost: number[][] = Array.from({ length: n }, () =>
    new Array<number>(1 << n).fill(Infinity)
  );
  gCost[0][1] = 0;

  const pathAt = new Map<string, number[]>();
  pathAt.set("0,1", [0]);

  interface Entry { node: number; mask: number; g: number; f: number; }
  const open: Entry[] = [{ node: 0, mask: 1, g: 0, f: admissibleH(0, 1, dist, n) }];

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
      const newG    = curr.g + dist[curr.node][next];
      if (newG < gCost[next][newMask]) {
        gCost[next][newMask] = newG;
        const h    = admissibleH(next, newMask, dist, n);
        const prev = pathAt.get(`${curr.node},${curr.mask}`) ?? [0];
        pathAt.set(`${next},${newMask}`, [...prev, next]);
        open.push({ node: next, mask: newMask, g: newG, f: newG + h });
      }
    }
  }
  return nearestNeighbor(dist);
}

// ─────────────────────────────────────────────────────────────────────────────
// A* TSP WITH FIXED DESTINATION  — identical
// ─────────────────────────────────────────────────────────────────────────────

function astarTSPWithDestination(
  nodes:   [number, number][],
  dist:    number[][],
  destIdx: number
): number[] {
  const n = nodes.length;
  if (n <= 1) return [0];

  const binIndices = Array.from({ length: destIdx - 1 }, (_, i) => i + 1);
  if (n > A_STAR_LIMIT + 1) {
    const path = nearestNeighborSubset(dist, binIndices);
    path.push(destIdx);
    return path;
  }

  const allBinsMask = binIndices.reduce((m, i) => m | (1 << i), 1);
  const allVisited  = allBinsMask | (1 << destIdx);

  const gCost  = new Map<string, number>();
  const pathAt = new Map<string, number[]>();
  gCost.set("0,1", 0);
  pathAt.set("0,1", [0]);

  interface Entry { node: number; mask: number; g: number; f: number; }
  const open: Entry[] = [{ node: 0, mask: 1, g: 0, f: admissibleH(0, 1, dist, n) }];

  while (open.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[minIdx].f) minIdx = i;
    const curr = open.splice(minIdx, 1)[0];
    const key  = `${curr.node},${curr.mask}`;

    if (curr.mask === allVisited) return pathAt.get(key) ?? [0, ...binIndices, destIdx];
    if (curr.g > (gCost.get(key) ?? Infinity)) continue;

    const allBinsVisited = (curr.mask & allBinsMask) === allBinsMask;
    const candidates = allBinsVisited
      ? [destIdx]
      : binIndices.filter(i => !(curr.mask & (1 << i)));

    for (const next of candidates) {
      const newMask = curr.mask | (1 << next);
      const newG    = curr.g + dist[curr.node][next];
      const nKey    = `${next},${newMask}`;
      if (newG < (gCost.get(nKey) ?? Infinity)) {
        gCost.set(nKey, newG);
        const h    = allBinsVisited ? 0 : admissibleH(next, newMask, dist, n);
        const prev = pathAt.get(key) ?? [0];
        pathAt.set(nKey, [...prev, next]);
        open.push({ node: next, mask: newMask, g: newG, f: newG + h });
      }
    }
  }
  return [0, ...binIndices, destIdx];
}

function nearestNeighborSubset(dist: number[][], subset: number[]): number[] {
  const visited   = new Set<number>([0]);
  const path      = [0];
  const remaining = new Set(subset);
  while (remaining.size > 0) {
    const last = path[path.length - 1];
    let best = Infinity, bestNode = -1;
    for (const j of remaining)
      if (!visited.has(j) && dist[last][j] < best) { best = dist[last][j]; bestNode = j; }
    if (bestNode === -1) break;
    visited.add(bestNode); remaining.delete(bestNode); path.push(bestNode);
  }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// U-TURN CLASSIFICATION  — identical
// ─────────────────────────────────────────────────────────────────────────────

function classifyUturns(
  route:         [number, number][],
  driverHeading: number
): Set<number> {
  const uturnStops = new Set<number>();
  const headings: number[] = [driverHeading];
  for (let i = 1; i < route.length; i++)
    headings.push(bearing(route[i - 1], route[i]));

  for (let i = 1; i < route.length; i++) {
    const arrivalHeading   = headings[i];
    const departureHeading = i + 1 < route.length
      ? bearing(route[i], route[i + 1])
      : arrivalHeading;
    if (angleDiff(arrivalHeading, departureHeading) > 120) uturnStops.add(i);
  }
  return uturnStops;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT COLOR  — identical
// ─────────────────────────────────────────────────────────────────────────────

function segmentColor(
  segIndex:  number,
  totalSegs: number,
  mode:      "fastest" | "priority"
): string {
  if (totalSegs === 0) return mode === "priority" ? "#f97316" : "#059669";
  const endH = mode === "priority" ? 25  : 152;
  const endS = mode === "priority" ? 95  : 69;
  const endL = mode === "priority" ? 53  : 35;
  const t = totalSegs === 1 ? 0 : segIndex / (totalSegs - 1);
  return `hsl(${Math.round(4 + (endH - 4) * t)},${Math.round(90 + (endS - 90) * t)}%,${Math.round(58 + (endL - 58) * t)}%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoJSON HELPER  (internal [lat,lng] → MapLibre [lng,lat])
// ─────────────────────────────────────────────────────────────────────────────

function toGeoJSON(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords.map(c => [c[1], c[0]]) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RoutingLayerGL({
  driverPos,
  bins,
  selectedBinId,
  onRouteUpdate,
  onOrderUpdate,
  routeKey      = 0,
  mode          = "fastest",
  useFence      = true,
  maxDetour     = 1000,
  heading       = 0,
  routingPos,
  destinationPos,
}: RoutingProps) {
  const { current: map } = useMap();

  const stablePos = routingPos ?? driverPos;
  const abortRef  = useRef<AbortController | null>(null);

  // Unique prefix per recalculation — prevents "source already exists" in MapLibre
  const calcIdRef = useRef(0);
  const [calcId, setCalcId] = useState(0);

  // ── Render state  ─────────────────────────────────────────────────────────
  const [legData, setLegData] = useState<{
    coords:     [number, number][];
    color:      string;
    lineWidth:  number;
    lineOpacity:number;
    dashArray?: number[];
    isUturnLeg: boolean;
    segIndex:   number;
  }[]>([]);

  const [sequenceMarkers, setSequenceMarkers] = useState<{
    bin: any; stopNum: number; isSelected: boolean; isUturn: boolean;
  }[]>([]);

  const [previewLine, setPreviewLine] = useState<[number, number][] | null>(null);

  // ── Proximity toast state  ────────────────────────────────────────────────
  const [toast, setToast]     = useState<ToastState>(null);
  const orderedStopsRef       = useRef<any[]>([]);
  const notifiedStopsRef      = useRef<Set<string>>(new Set());
  const toastTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRouteUpdateRef = useRef(onRouteUpdate);
  useEffect(() => { onRouteUpdateRef.current = onRouteUpdate; });
  const onOrderUpdateRef = useRef(onOrderUpdate);
  useEffect(() => { onOrderUpdateRef.current = onOrderUpdate; });

  // ── PROXIMITY CHECK — runs on every driverPos update  ────────────────────
  // Completely independent of the A* effect so it doesn't retrigger rerouting.
  useEffect(() => {
    if (!driverPos || orderedStopsRef.current.length === 0) return;

    const nextStop = orderedStopsRef.current.find(
      (s: any) => !notifiedStopsRef.current.has(`arrived-${s.id}`)
    );
    if (!nextStop) return;

    const dist    = haversine(driverPos, [nextStop.lat, nextStop.lng]);
    const stopIdx = orderedStopsRef.current.indexOf(nextStop) + 1;

    if (dist <= ARRIVE_DISTANCE_M) {
      notifiedStopsRef.current.add(`arrived-${nextStop.id}`);
      notifiedStopsRef.current.add(`approach-${nextStop.id}`);
      setToast({ stopNum: stopIdx, binName: nextStop.name ?? `Bin ${nextStop.id}`, fillLevel: nextStop.fillLevel, dist, arrived: true, isUturn: !!nextStop.requiresUturn });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    } else if (dist <= ALERT_DISTANCE_M && !notifiedStopsRef.current.has(`approach-${nextStop.id}`)) {
      notifiedStopsRef.current.add(`approach-${nextStop.id}`);
      setToast({ stopNum: stopIdx, binName: nextStop.name ?? `Bin ${nextStop.id}`, fillLevel: nextStop.fillLevel, dist, arrived: false, isUturn: !!nextStop.requiresUturn });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    } else if (dist > ALERT_DISTANCE_M) {
      notifiedStopsRef.current.delete(`approach-${nextStop.id}`);
    }
  }, [driverPos]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── MAIN A* + DIRECTIONS FETCH EFFECT  ───────────────────────────────────
  useEffect(() => {
    if (!map || !stablePos || bins.length === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const thisCalcId = ++calcIdRef.current;
    setCalcId(thisCalcId);
    setLegData([]); setSequenceMarkers([]); setPreviewLine(null);

    // ── Target selection  ─────────────────────────────────────────────────
    let targets = bins.filter((b: any) => b.fillLevel >= 40 || b.id === selectedBinId);
    if (useFence)
      targets = targets.filter((b: any) => getDistance(stablePos!, [b.lat, b.lng]) < 2500);
    if (maxDetour && maxDetour < 2500)
      targets = targets.filter((b: any) => getDistance(stablePos!, [b.lat, b.lng]) < maxDetour);
    if (targets.length === 0) return;

    // ── Build nodes  ──────────────────────────────────────────────────────
    const binCoords: [number, number][] = targets.map((t: any) => [t.lat, t.lng] as [number, number]);
    const hasDestination = !!destinationPos;
    const allNodes: [number, number][] = [
      stablePos!,
      ...binCoords,
      ...(hasDestination ? [destinationPos!] : []),
    ];
    const destNodeIdx = hasDestination ? allNodes.length - 1 : -1;

    // ── Heading-aware cost matrix + A*  ───────────────────────────────────
    const dist = buildHeadingAwareMatrix(allNodes, heading, destNodeIdx);

    console.info(
      `[A* TSP] Solving: 1 depot + ${targets.length} bins, mode=${mode}, heading=${heading.toFixed(0)}°, routeKey=${routeKey}`
    );
    const orderedIndices = hasDestination
      ? astarTSPWithDestination(allNodes, dist, destNodeIdx)
      : astarTSP(allNodes, dist);
    console.info(`[A* TSP] Order: ${orderedIndices.join(" → ")}`);

    const orderedTargets = orderedIndices
      .filter(i => i !== 0 && i !== destNodeIdx)
      .map(i => targets[i - 1]);

    // ── Route waypoints + U-turn classification  ──────────────────────────
    const routeWaypoints: [number, number][] = [
      stablePos!,
      ...orderedTargets.map((t: any) => [t.lat, t.lng] as [number, number]),
      ...(hasDestination ? [destinationPos!] : []),
    ];
    const uturnStops  = classifyUturns(routeWaypoints, heading);
    const totalLegs   = routeWaypoints.length - 1;
    const uturnLegSet = new Set<number>();
    uturnStops.forEach(s => uturnLegSet.add(s - 1));

    console.info(`[A* TSP] U-turns required at stops: [${[...uturnStops].join(", ") || "none"}]`);

    // Show dashed preview immediately while road geometry loads
    setPreviewLine(routeWaypoints);

    // Numbered badges appear immediately
    setSequenceMarkers(
      orderedTargets.map((bin: any, idx: number) => ({
        bin,
        stopNum:    idx + 1,
        isSelected: bin.id === selectedBinId,
        isUturn:    uturnStops.has(idx + 1),
      }))
    );

    const orderedWithMeta = orderedTargets.map((bin: any, idx: number) => ({
      ...bin, requiresUturn: uturnStops.has(idx + 1),
    }));

    orderedStopsRef.current  = orderedWithMeta;
    notifiedStopsRef.current = new Set();
    setToast(null);
    onOrderUpdateRef.current?.(orderedWithMeta);

    // ── Fetch road geometry (Mapbox Directions API)  ──────────────────────
    //
    // Strategy mirrors RoutingLayer.tsx exactly:
    //   SNAP_RADIUS 500m  — primary main-road bias
    //   SNAP_RADIUS_MID   — fallback if 500m snap fails
    //   bearing hints     — prevent wrong-road snap on departure
    //   continue_straight — true on U-turn legs only
    //   Fallback chain    — 500m → 150m → no radius

    const SNAP_RADIUS     = 500;
    const SNAP_RADIUS_MID = 150;
    const BEARING_TOL     = 45;
    const profile = mode === "priority" ? "mapbox/driving" : "mapbox/driving-traffic";
    const TOKEN   = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    const buildUrl = (
      from:        [number, number],
      to:          [number, number],
      isUturnLeg:  boolean,
      snapRadius:  number | null,
      fromBearing: number | null
    ): string => {
      const coords       = `${from[1]},${from[0]};${to[1]},${to[0]}`;
      const originRadius = snapRadius ?? 500;
      const destRadius   = 30;
      const radParam     = snapRadius !== null
        ? `&radiuses=${originRadius};${destRadius}`
        : "";
      // Origin bearing hint only — do NOT constrain destination arrival bearing
      const bearParam = (snapRadius !== null && fromBearing !== null)
        ? `&bearings=${Math.round(fromBearing) % 360},${BEARING_TOL};0,180`
        : "";
      const straightParam = isUturnLeg
        ? `&continue_straight=true`
        : `&continue_straight=false`;

      return (
        `https://api.mapbox.com/directions/v5/${profile}/${coords}` +
        `?geometries=geojson&overview=full&steps=true` +
        `&exclude=ferry` +
        radParam + bearParam +
        `&approaches=curb;curb` +
        `&annotations=duration,distance` +
        straightParam +
        `&access_token=${TOKEN}`
      );
    };

    const fetchLeg = (
      from:        [number, number],
      to:          [number, number],
      isUturnLeg:  boolean,
      fromBearing: number | null,
      s:           number
    ): Promise<{ coords: [number,number][]; dist: number; duration: number; isUturnLeg: boolean; segIndex: number }> => {
      const tryFetch = (radius: number | null) =>
        fetch(buildUrl(from, to, isUturnLeg, radius, fromBearing), { signal })
          .then(r => r.json());

      return tryFetch(SNAP_RADIUS)
        .then((d: any) => {
          if (d.routes?.[0]) return d;
          console.warn(`[RoutingLayerGL] Leg ${s}: 500m snap failed (${d.code}), trying 150m`);
          return tryFetch(SNAP_RADIUS_MID);
        })
        .then((d: any) => {
          if (d.routes?.[0]) return d;
          console.warn(`[RoutingLayerGL] Leg ${s}: 150m snap failed, no-snap fallback`);
          return tryFetch(null);
        })
        .then((d: any) => {
          const route = d.routes?.[0];

          if (route?.legs) {
            const narrowTypes = ["residential","living_street","service","track","path","footway"];
            route.legs.forEach((leg: any) => {
              (leg.steps ?? []).forEach((step: any) => {
                const ref = (step.name ?? "").toLowerCase();
                if (narrowTypes.some(t => step.road_class === t || ref.includes(t))) {
                  console.warn(`[RoutingLayerGL] Narrow road on leg ${s}: "${step.name}" (${step.road_class})`);
                }
              });
            });
          }

          return {
            coords: (route?.geometry?.coordinates ?? [])
              .map((c: [number, number]) => [c[1], c[0]] as [number, number]) as [number, number][],
            dist:       route?.distance ?? 0,
            duration:   route?.duration ?? 0,
            isUturnLeg,
            segIndex:   s,
          };
        });
    };

    // Leg 0: real GPS heading. Subsequent legs: straight-line bearing
    const legPromises = Array.from({ length: totalLegs }, (_, s) => {
      const from       = routeWaypoints[s];
      const to         = routeWaypoints[s + 1];
      const isUturnLeg = uturnLegSet.has(s);
      const legBearing = s === 0 ? heading : bearing(from, to);
      return fetchLeg(from, to, isUturnLeg, legBearing, s);
    });

    Promise.all(legPromises)
      .then(legs => {
        if (thisCalcId !== calcIdRef.current) return; // stale result — discard

        if (legs.some(l => l.coords.length < 2))
          console.warn("[RoutingLayerGL] One or more legs returned no geometry.");

        let totalDist = 0, totalDuration = 0;
        const normalLegCount = legs.filter(l => !l.isUturnLeg).length;
        let normalLegIdx = 0;

        const newLegs = legs.map(leg => {
          totalDist     += leg.dist;
          totalDuration += leg.duration;

          let color:      string;
          let lineWidth:  number;
          let lineOpacity: number;
          let dashArray:  number[] | undefined;

          if (leg.isUturnLeg) {
            // U-turn leg — yellow, dashed, "follow this road back"
            color       = "#eab308";
            lineWidth   = 5;
            lineOpacity = 0.95;
            dashArray   = [10, 6];
          } else {
            // Normal leg — gradient red → mode color
            color       = segmentColor(normalLegIdx, normalLegCount, mode);
            lineWidth   = normalLegIdx === 0 ? 6 : 5;
            lineOpacity = normalLegIdx === 0 ? 1.0 : 0.85;
            dashArray   = mode === "priority" && normalLegIdx > 0 ? [1, 10] : undefined;
            normalLegIdx++;
          }

          return { coords: leg.coords, color, lineWidth, lineOpacity, dashArray, isUturnLeg: leg.isUturnLeg, segIndex: leg.segIndex };
        });

        setLegData(newLegs);
        setPreviewLine(null); // road geometry ready — hide the straight-line preview

        onRouteUpdateRef.current({
          dist: `${(totalDist / 1000).toFixed(1)} km`,
          time: `${Math.round(totalDuration / 60)} min`,
        });

        // Fit map to full route bounds
        if (map && legs.length > 0) {
          const allCoords = legs.flatMap(l => l.coords);
          if (allCoords.length > 1) {
            const lngs = allCoords.map(c => c[1]);
            const lats = allCoords.map(c => c[0]);
            // MapLibre fitBounds: [[minLng, minLat], [maxLng, maxLat]]
            map.fitBounds(
              [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
              { padding: 80, duration: 1500 }
            );
          }
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") console.error("[RoutingLayerGL] Mapbox error:", err);
      });

    return () => { abortRef.current?.abort(); };

  }, [map, stablePos, bins, selectedBinId, routeKey, mode, useFence, maxDetour, heading, destinationPos]);

  // ── RENDER  ───────────────────────────────────────────────────────────────

  const p = `r${calcId}`; // unique prefix prevents duplicate source IDs in MapLibre

  return (
    <>
      {/* ── DASHED PREVIEW  (immediate, replaced by road geometry once loaded) ── */}
      {previewLine && previewLine.length > 1 && (
        <Source key={`${p}-prev`} id={`${p}-prev`} type="geojson" data={toGeoJSON(previewLine)}>
          <Layer
            id={`${p}-prev-line`}
            type="line"
            paint={{
              "line-color":     mode === "priority" ? "#f97316" : "#059669",
              "line-width":     1.5,
              "line-opacity":   0.45,
              "line-dasharray": [6, 6],
            }}
            layout={{ "line-join": "round", "line-cap": "round" }}
          />
        </Source>
      )}

      {/* ── ROAD GEOMETRY LEGS  ── */}
      {legData.map((leg, i) => {
        if (leg.coords.length < 2) return null;
        return (
          <Source key={`${p}-leg-${i}`} id={`${p}-leg-${i}`} type="geojson" data={toGeoJSON(leg.coords)}>
            {/* Glow halo */}
            <Layer
              id={`${p}-glow-${i}`}
              type="line"
              paint={{
                "line-color":   leg.color,
                "line-width":   leg.lineWidth + 7,
                "line-opacity": leg.isUturnLeg ? 0.18 : 0.12,
                "line-blur":    4,
              }}
            />
            {/* Solid line */}
            <Layer
              id={`${p}-line-${i}`}
              type="line"
              paint={{
                "line-color":   leg.color,
                "line-width":   leg.lineWidth,
                "line-opacity": leg.lineOpacity,
                ...(leg.dashArray ? { "line-dasharray": leg.dashArray } : {}),
              }}
              layout={{ "line-join": "round", "line-cap": "round" }}
            />
          </Source>
        );
      })}

      {/* ── NUMBERED SEQUENCE BADGES  ── */}
      {sequenceMarkers.map(m => (
        <SequenceMarkerGL
          key={m.bin.id}
          bin={m.bin}
          stopNum={m.stopNum}
          isSelected={m.isSelected}
          isUturn={m.isUturn}
        />
      ))}

      {/* ── PROXIMITY TOAST  ── */}
      <ProximityToast toast={toast} />
    </>
  );
}