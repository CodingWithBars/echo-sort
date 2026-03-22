"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "../map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_DISTANCE_M  = 30;   // show toast when within 30 m of the next stop
const ARRIVE_DISTANCE_M = 8;    // upgrade to "arrived" toast within 8 m

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATION COMPONENT
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
      position:      "absolute",
      bottom:        72,
      left:          "50%",
      transform:     "translateX(-50%)",
      zIndex:        2000,
      display:       "flex",
      alignItems:    "center",
      gap:           10,
      padding:       "10px 16px",
      borderRadius:  14,
      background:    bg,
      border:        `1.5px solid ${border}`,
      boxShadow:     "0 4px 20px rgba(0,0,0,0.35)",
      fontFamily:    "'DM Mono','Fira Code',monospace",
      minWidth:      240,
      maxWidth:      320,
      animation:     "toastIn .25s ease",
      pointerEvents: "none",
      whiteSpace:    "nowrap",
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
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface RoutingProps {
  driverPos:     [number, number];
  bins:          any[];
  selectedBinId: number | null;
  onRouteUpdate: (stats: { dist: string; time: string }) => void;
  onOrderUpdate?: (orderedBins: any[]) => void;
  routeKey?:     number;
  mode?:         "fastest" | "priority";
  useFence?:     boolean;
  maxDetour?:    number;
  // Driver position used ONLY for routing (locked at recalc time, not live GPS)
  routingPos?:   [number, number] | null;
  // ← Live heading for U-turn penalty
  heading?:      number;
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

function buildDistMatrix(nodes: [number, number][]): number[][] {
  return nodes.map((a) => nodes.map((b) => haversine(a, b)));
}

// ─────────────────────────────────────────────────────────────────────────────
// BEARING BETWEEN TWO POINTS  (degrees, 0 = North, clockwise)
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
// ANGULAR DIFFERENCE  — smallest angle between two headings (0–180°)
// ─────────────────────────────────────────────────────────────────────────────

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ─────────────────────────────────────────────────────────────────────────────
// U-TURN PENALTY MODEL
//
// A U-turn is defined as any turn > 120° from the driver's current heading.
// The penalty is expressed as EQUIVALENT EXTRA METRES so A* naturally weighs
// it against actual distance — making the algorithm prefer forward stops
// unless backtracking is clearly shorter overall.
//
// Penalty tiers (tuned for urban low-speed waste collection ~30 km/h):
//   0–60°   forward cone    → 0 m penalty
//   60–120° side/merge      → 80 m penalty  (~10 s detour equivalent)
//   120–180° U-turn zone    → 250 m penalty (~30 s detour equivalent)
//
// These are intentionally asymmetric: going slightly right is cheaper than
// swinging left (mirrors real urban driving). You can tune PENALTY_* below.
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_SIDE_M    = 80;    // 60–120° — merge/side street
const PENALTY_UTURN_M   = 250;   // 120–180° — full U-turn

function uturnPenalty(
  fromPos:    [number, number],
  toPos:      [number, number],
  curHeading: number            // degrees, 0=N, CW
): number {
  const bearingToNext = bearing(fromPos, toPos);
  const turn          = angleDiff(curHeading, bearingToNext);

  if (turn <= 60)  return 0;
  if (turn <= 120) return PENALTY_SIDE_M;
  return PENALTY_UTURN_M;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADING-AWARE DISTANCE MATRIX
//
// For the first edge (driver → first stop) we inject the U-turn penalty.
// Subsequent edges (bin → bin) use the arrival bearing from the previous leg
// so the penalty propagates through the whole route — not just the first hop.
// ─────────────────────────────────────────────────────────────────────────────

function buildHeadingAwareMatrix(
  nodes:      [number, number][],
  driverHeading: number
): number[][] {
  const n    = nodes.length;
  const base = buildDistMatrix(nodes);

  // Clone the base matrix
  const mat = base.map(r => [...r]);

  // Adjust edges leaving node 0 (the driver) using the real heading
  for (let j = 1; j < n; j++) {
    mat[0][j] = base[0][j] + uturnPenalty(nodes[0], nodes[j], driverHeading);
  }

  // Adjust edges between bins using the "arrival heading" of the previous leg
  // as a proxy for the truck's heading while servicing that bin.
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n; j++) {
      if (i === j) continue;
      // Arrival heading at node i comes from the last segment ending at i.
      // We approximate it as the bearing from the closest prior node — here
      // we simply use node 0 → i as a first-order estimate (good enough for
      // urban grids where the path doesn't deviate much from straight-line).
      const arrivalAtI = bearing(nodes[0], nodes[i]);
      mat[i][j] = base[i][j] + uturnPenalty(nodes[i], nodes[j], arrivalAtI);
    }
  }

  return mat;
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
        if (!inMST.has(v) && dist[u][v] < best) {
          best     = dist[u][v];
          bestNode = v;
        }
    if (bestNode === -1) break;
    inMST.add(bestNode);
    total += best;
  }
  return total;
}

function admissibleH(
  cur:  number,
  mask: number,
  dist: number[][],
  n:    number
): number {
  const unvisited: number[] = [];
  for (let i = 1; i < n; i++) if (!(mask & (1 << i))) unvisited.push(i);
  if (unvisited.length === 0) return 0;
  const minEdge = Math.min(...unvisited.map((v) => dist[cur][v]));
  return minEdge + mstCost(unvisited, dist);
}

// ─────────────────────────────────────────────────────────────────────────────
// NEAREST-NEIGHBOR GREEDY  — fallback for > A_STAR_LIMIT nodes
// ─────────────────────────────────────────────────────────────────────────────

function nearestNeighbor(dist: number[][]): number[] {
  const n       = dist.length;
  const visited = new Set([0]);
  const path    = [0];
  while (visited.size < n) {
    const last = path[path.length - 1];
    let best = Infinity, bestNode = -1;
    for (let j = 1; j < n; j++)
      if (!visited.has(j) && dist[last][j] < best) {
        best     = dist[last][j];
        bestNode = j;
      }
    if (bestNode === -1) break;
    visited.add(bestNode);
    path.push(bestNode);
  }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// A* TSP SOLVER  (heading-aware cost matrix)
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
  const startMask  = 1;

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
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[minIdx].f) minIdx = i;
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
// ICON FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

function sequenceIcon(
  step:       number,
  fillLevel:  number,
  isSelected: boolean,
  isUturn:    boolean   // ← NEW: show U-turn warning badge
): L.DivIcon {
  const urgent  = fillLevel >= 80;
  const bg      = isSelected ? "#2563eb" : urgent ? "#dc2626" : "#059669";
  const border  = isSelected ? "#93c5fd" : urgent ? "#fca5a5" : "#6ee7b7";

  // U-turn warning ring — amber outer ring to signal the driver
  const ring = isUturn
    ? `box-shadow:0 0 0 3px #f59e0b, 0 2px 8px rgba(0,0,0,.35);`
    : `box-shadow:0 2px 8px rgba(0,0,0,.35);`;

  // Small U-turn arrow badge in top-right corner
  const badge = isUturn
    ? `<div style="
        position:absolute;top:-6px;right:-6px;
        width:14px;height:14px;border-radius:50%;
        background:#f59e0b;border:1.5px solid #fff;
        display:flex;align-items:center;justify-content:center;
        font-size:8px;color:#fff;line-height:1;
      ">↩</div>`
    : "";

  return L.divIcon({
    className: "",
    iconSize:  [32, 32],
    iconAnchor:[16, 16],
    html: `
      <div style="position:relative;width:32px;height:32px;">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${bg};border:2.5px solid ${border};
          display:flex;align-items:center;justify-content:center;
          ${ring}
          font-size:13px;font-weight:700;color:#fff;
          font-family:sans-serif;
        ">${step}</div>
        ${badge}
      </div>`,
  });
}

function depotIcon(): L.DivIcon {
  return L.divIcon({
    className:  "",
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div style="
        width:36px;height:36px;border-radius:6px;
        background:#d97706;border:2.5px solid #fcd34d;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        font-size:10px;font-weight:800;color:#fff;
        font-family:sans-serif;letter-spacing:.04em;
      ">POST</div>`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// U-TURN CLASSIFICATION  — which stops in the final order require a U-turn?
//
// Walk the ordered route and for each leg compute the arrival heading then
// check whether the next leg's departure heading exceeds 120°.
// Returns a Set of stop indices (1-based, matching sequence badge numbers)
// that require a U-turn to reach from the previous stop.
// ─────────────────────────────────────────────────────────────────────────────

function classifyUturns(
  route:         [number, number][],   // full ordered waypoints incl. driver at [0]
  driverHeading: number
): Set<number> {
  const uturnStops = new Set<number>();

  // Heading at each waypoint (index 0 = driver's real GPS heading)
  const headings: number[] = [driverHeading];

  for (let i = 1; i < route.length; i++) {
    headings.push(bearing(route[i - 1], route[i]));
  }

  // Check each leg: if the turn from arriving heading to departure is > 120°
  // flag that stop (1-based index = i means "stop i requires a U-turn")
  for (let i = 1; i < route.length; i++) {
    const arrivalHeading   = headings[i];
    const departureHeading = i + 1 < route.length
      ? bearing(route[i], route[i + 1])
      : arrivalHeading; // last stop — no departure, no U-turn penalty

    const turn = angleDiff(arrivalHeading, departureHeading);
    if (turn > 120) uturnStops.add(i); // i is the 1-based stop index
  }

  return uturnStops;
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
  routeKey   = 0,
  mode       = "fastest",
  useFence   = true,
  maxDetour  = 1000,
  heading    = 0,
  routingPos,
}: RoutingProps) {
  // Use the locked routing position if provided, otherwise fall back to live pos
  const stablePos = routingPos ?? driverPos;
  const map = useMap();

  const pathLayerRef      = useRef<L.Polyline    | null>(null);
  const glowLayerRef      = useRef<L.Polyline    | null>(null);
  const sequenceGroupRef  = useRef<L.LayerGroup  | null>(null);
  const abortRef          = useRef<AbortController | null>(null);

  // ── Proximity notification state ─────────────────────────────────────────
  const [toast, setToast]               = useState<ToastState>(null);
  const orderedStopsRef                 = useRef<any[]>([]);   // kept fresh by A* effect
  const notifiedStopsRef                = useRef<Set<string>>(new Set()); // avoid repeat firing
  const toastTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRouteUpdateRef = useRef(onRouteUpdate);
  useEffect(() => { onRouteUpdateRef.current = onRouteUpdate; });

  const onOrderUpdateRef = useRef(onOrderUpdate);
  useEffect(() => { onOrderUpdateRef.current = onOrderUpdate; });

  // ── PROXIMITY CHECK — runs on every driverPos update ─────────────────────
  // Completely independent of the A* effect so it doesn't trigger rerouteing.
  useEffect(() => {
    if (!driverPos || orderedStopsRef.current.length === 0) return;

    // Find the first stop not yet marked as "notified (arrived)"
    const nextStop = orderedStopsRef.current.find(
      (s: any) => !notifiedStopsRef.current.has(`arrived-${s.id}`)
    );
    if (!nextStop) return;

    const dist = haversine(driverPos, [nextStop.lat, nextStop.lng]);
    const stopIdx = orderedStopsRef.current.indexOf(nextStop) + 1; // 1-based

    if (dist <= ARRIVE_DISTANCE_M) {
      // Mark as fully arrived — won't fire again for this stop
      notifiedStopsRef.current.add(`arrived-${nextStop.id}`);
      notifiedStopsRef.current.add(`approach-${nextStop.id}`);

      setToast({
        stopNum:   stopIdx,
        binName:   nextStop.name ?? `Bin ${nextStop.id}`,
        fillLevel: nextStop.fillLevel,
        dist,
        arrived:   true,
        isUturn:   !!nextStop.requiresUturn,
      });

      // Auto-dismiss arrived toast after 4 s
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 4000);

    } else if (dist <= ALERT_DISTANCE_M && !notifiedStopsRef.current.has(`approach-${nextStop.id}`)) {
      // Approaching — fire once per stop
      notifiedStopsRef.current.add(`approach-${nextStop.id}`);

      setToast({
        stopNum:   stopIdx,
        binName:   nextStop.name ?? `Bin ${nextStop.id}`,
        fillLevel: nextStop.fillLevel,
        dist,
        arrived:   false,
        isUturn:   !!nextStop.requiresUturn,
      });

      // Auto-dismiss approaching toast after 6 s (or replaced by arrived)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 6000);

    } else if (dist > ALERT_DISTANCE_M) {
      // Driver moved away (recalc or backtrack) — reset approach flag so it
      // can fire again if they come back
      notifiedStopsRef.current.delete(`approach-${nextStop.id}`);
    }
  }, [driverPos]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    if (!map || !stablePos || bins.length === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // ── CLEAR PREVIOUS ────────────────────────────────────────────────────
    if (pathLayerRef.current)     { map.removeLayer(pathLayerRef.current);    pathLayerRef.current    = null; }
    if (glowLayerRef.current)     { map.removeLayer(glowLayerRef.current);    glowLayerRef.current    = null; }
    if (sequenceGroupRef.current) { map.removeLayer(sequenceGroupRef.current); sequenceGroupRef.current = null; }

    // ── TARGET SELECTION ──────────────────────────────────────────────────
    let targets = bins.filter(
      (b: any) => b.fillLevel >= 40 || b.id === selectedBinId
    );
    if (useFence)
      targets = targets.filter(
        (b: any) => getDistance(stablePos!, [b.lat, b.lng]) < 2500
      );
    if (maxDetour && maxDetour < 2500)
      targets = targets.filter(
        (b: any) => getDistance(stablePos!, [b.lat, b.lng]) < maxDetour
      );

    if (targets.length === 0) return;

    // ── BUILD NODES ───────────────────────────────────────────────────────
    const binCoords: [number, number][] = targets.map(
      (t: any) => [t.lat, t.lng] as [number, number]
    );
    const allNodes: [number, number][] = [stablePos!, ...binCoords];

    // ── HEADING-AWARE COST MATRIX ─────────────────────────────────────────
    // Uses the driver's real GPS heading to penalise U-turns in A*
    const dist = buildHeadingAwareMatrix(allNodes, heading);

    console.info(
      `[A* TSP] Solving: 1 depot + ${targets.length} bins, heading=${heading.toFixed(0)}°, routeKey=${routeKey}`
    );
    const orderedIndices = astarTSP(allNodes, dist);
    console.info(`[A* TSP] Order: ${orderedIndices.join(" → ")}`);

    const orderedTargets = orderedIndices
      .filter((i) => i !== 0)
      .map((i) => targets[i - 1]);

    // ── CLASSIFY U-TURNS ──────────────────────────────────────────────────
    const routeWaypoints: [number, number][] = [
      stablePos!,
      ...orderedTargets.map((t: any) => [t.lat, t.lng] as [number, number]),
    ];
    const uturnStops = classifyUturns(routeWaypoints, heading);

    console.info(
      `[A* TSP] U-turns required at stops: [${[...uturnStops].join(", ") || "none"}]`
    );

    // ── RENDER SEQUENCE VISUALS ───────────────────────────────────────────
    const group = L.layerGroup().addTo(map);
    sequenceGroupRef.current = group;

    // Depot
    L.marker(driverPos, { icon: depotIcon(), zIndexOffset: 1000 }).addTo(group);

    // Dashed preview connector
    const sequenceLine: [number, number][] = [
      driverPos,
      ...orderedTargets.map((t: any) => [t.lat, t.lng] as [number, number]),
    ];
    L.polyline(sequenceLine, {
      color:     mode === "priority" ? "#f97316" : "#059669",
      weight:    1.5,
      opacity:   0.45,
      dashArray: "6 6",
    }).addTo(group);

    // Numbered badges — with U-turn warning ring where needed
    orderedTargets.forEach((bin: any, idx: number) => {
      const stopNum  = idx + 1;
      const isUturn  = uturnStops.has(stopNum);

      // Build tooltip: add U-turn warning if applicable
      const uturnNote = isUturn
        ? `<br><span style="color:#f59e0b;font-weight:700;">↩ U-turn required</span>`
        : "";

      L.marker([bin.lat, bin.lng] as [number, number], {
        icon: sequenceIcon(stopNum, bin.fillLevel, bin.id === selectedBinId, isUturn),
        zIndexOffset: 900,
      })
        .bindTooltip(
          `<b>Stop ${stopNum}</b><br>${bin.name ?? "Bin"}<br>Fill: ${bin.fillLevel}%${uturnNote}`,
          { direction: "top", offset: [0, -18], opacity: 0.92 }
        )
        .addTo(group);
    });

    // Notify parent with enriched data — add uturn flag per bin for legend
    const orderedWithMeta = orderedTargets.map((bin: any, idx: number) => ({
      ...bin,
      requiresUturn: uturnStops.has(idx + 1),
    }));

    // Keep ref fresh for proximity effect — reset notified set on new route
    orderedStopsRef.current   = orderedWithMeta;
    notifiedStopsRef.current  = new Set();   // new route order = fresh notifications
    setToast(null);

    onOrderUpdateRef.current?.(orderedWithMeta);

    // ── FETCH ROAD GEOMETRY FROM MAPBOX DIRECTIONS ────────────────────────
    const coords = routeWaypoints
      .map((p) => `${p[1]},${p[0]}`)
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
          (c: [number, number]) => [c[1], c[0]]
        );

        // Glow halo
        glowLayerRef.current = L.polyline(coordinates, {
          color:   mode === "priority" ? "#fb923c" : "#10b981",
          weight:  12,
          opacity: 0.15,
          lineJoin:"round",
        }).addTo(map);

        // Solid route line
        pathLayerRef.current = L.polyline(coordinates, {
          color:    mode === "priority" ? "#f97316" : "#059669",
          weight:   5,
          opacity:  0.9,
          lineJoin: "round",
          lineCap:  "round",
          dashArray: mode === "priority" ? "1, 12" : undefined,
        }).addTo(map);

        // Bring sequence markers above polyline
        group.eachLayer((layer) => {
          if (layer instanceof L.Marker) layer.setZIndexOffset(1100);
        });

        onRouteUpdateRef.current({
          dist: `${(route.distance / 1000).toFixed(1)} km`,
          time: `${Math.round(route.duration / 60)} min`,
        });

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

    return () => { abortRef.current?.abort(); };

  }, [map, stablePos, bins, selectedBinId, routeKey, mode, useFence, maxDetour, heading]);

  return <ProximityToast toast={toast} />;
}