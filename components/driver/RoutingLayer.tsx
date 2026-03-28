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
  // Optional exit/destination point appended as the final mandatory stop
  destinationPos?: [number, number] | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// PASS-THROUGH DETECTION
//
// Returns true if node K lies "on the way" from node A to node B — meaning
// skipping K to visit B first would force the truck to physically pass K,
// then backtrack to collect it.
//
// Method: project K onto the A→B line segment. If K is within PASS_THRESHOLD
// metres of the segment AND its projection falls between A and B (not past
// either end), it is considered on-path.
// ─────────────────────────────────────────────────────────────────────────────

const PASS_THRESHOLD_M  = 40;   // metres — how close to the line counts as "on path"
const PASSTHROUGH_COST  = 600;  // equivalent metres penalty for skipping an on-path bin

function pointToSegmentDist(
  p:  [number, number],   // lat,lng of point
  a:  [number, number],   // lat,lng of segment start
  b:  [number, number],   // lat,lng of segment end
): number {
  // Convert to simple XY plane (good enough for short urban distances)
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

  // Parameter t: 0=at A, 1=at B
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));

  const nearX = ax + t * dx;
  const nearY = ay + t * dy;

  // Only count as pass-through if projection is strictly between A and B
  // (t in [0.05, 0.95]) — not at the endpoints themselves
  if (t < 0.05 || t > 0.95) return Infinity;

  return Math.hypot(px - nearX, py - nearY);
}

function buildHeadingAwareMatrix(
  nodes:         [number, number][],
  driverHeading: number,
  destIdx:       number = -1   // destination node index (-1 if none)
): number[][] {
  const n    = nodes.length;
  const base = buildDistMatrix(nodes);
  const mat  = base.map(r => [...r]);

  // ── Driver → bin edges: use real GPS heading ─────────────────────────
  for (let j = 1; j < n; j++) {
    if (j === destIdx) continue;
    mat[0][j] = base[0][j] + uturnPenalty(nodes[0], nodes[j], driverHeading);
  }

  // ── Bin → bin edges ───────────────────────────────────────────────────
  for (let i = 1; i < n; i++) {
    if (i === destIdx) continue;
    const arrivalAtI = bearing(nodes[0], nodes[i]);

    for (let j = 1; j < n; j++) {
      if (i === j || j === destIdx) continue;

      // Base cost: distance + U-turn penalty using arrival heading at i
      let cost = base[i][j] + uturnPenalty(nodes[i], nodes[j], arrivalAtI);

      // Pass-through penalty: scan all OTHER bins k. If k lies on the
      // i→j path, visiting j before k means the truck passes k and must
      // backtrack — add a large penalty so A* avoids this.
      for (let k = 1; k < n; k++) {
        if (k === i || k === j || k === destIdx) continue;
        const d = pointToSegmentDist(nodes[k], nodes[i], nodes[j]);
        if (d < PASS_THRESHOLD_M) {
          cost += PASSTHROUGH_COST;
          break; // one pass-through is enough to penalise the edge
        }
      }

      mat[i][j] = cost;
    }
  }

  // ── Destination edges: no U-turn penalty, no pass-through ────────────
  // The destination is always the last stop — penalising its approach
  // would distort the ordering of the bins before it.
  if (destIdx > 0) {
    for (let i = 0; i < n; i++) {
      if (i === destIdx) continue;
      mat[i][destIdx] = base[i][destIdx]; // raw distance only
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
      ">HQ</div>`,
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// A* TSP WITH FIXED DESTINATION  — destIdx is always visited last
//
// Works by treating destIdx as a forced terminal: the solver only considers
// a state "complete" when ALL bins have been visited AND the last move is
// to destIdx. This guarantees the exit point is always the final stop
// regardless of where it sits geographically.
// ─────────────────────────────────────────────────────────────────────────────

function astarTSPWithDestination(
  nodes:   [number, number][],
  dist:    number[][],
  destIdx: number
): number[] {
  const n = nodes.length;
  if (n <= 1) return [0];

  // With destination: must visit all bin nodes (1..destIdx-1) then destIdx
  if (n > A_STAR_LIMIT + 1) {
    // Greedy fallback with pinned destination
    const binIndices = Array.from({ length: destIdx - 1 }, (_, i) => i + 1);
    const path = nearestNeighborSubset(dist, binIndices);
    path.push(destIdx);
    return path;
  }

  const binIndices  = Array.from({ length: destIdx - 1 }, (_, i) => i + 1);
  const allBinsMask = binIndices.reduce((m, i) => m | (1 << i), 1); // bit 0=driver
  const destBit     = 1 << destIdx;
  const allVisited  = allBinsMask | destBit;

  const gCost: Map<string, number> = new Map();
  const pathAt: Map<string, number[]> = new Map();
  const startKey = `0,${1}`;
  gCost.set(startKey, 0);
  pathAt.set(startKey, [0]);

  interface Entry { node: number; mask: number; g: number; f: number; }
  const open: Entry[] = [{
    node: 0, mask: 1, g: 0,
    f: admissibleH(0, 1, dist, n),
  }];

  while (open.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[minIdx].f) minIdx = i;
    const curr = open.splice(minIdx, 1)[0];
    const key  = `${curr.node},${curr.mask}`;

    if (curr.mask === allVisited) {
      return pathAt.get(key) ?? [0, ...binIndices, destIdx];
    }

    const g = gCost.get(key) ?? Infinity;
    if (curr.g > g) continue;

    // All bins visited — only move allowed is to destination
    const allBinsVisited = (curr.mask & allBinsMask) === allBinsMask;

    const candidates = allBinsVisited
      ? [destIdx]
      : binIndices.filter((i) => !(curr.mask & (1 << i)));

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

// Greedy nearest-neighbor over a subset of indices (for fallback with destination)
function nearestNeighborSubset(dist: number[][], subset: number[]): number[] {
  const visited = new Set<number>([0]);
  const path    = [0];
  const remaining = new Set(subset);
  while (remaining.size > 0) {
    const last = path[path.length - 1];
    let best = Infinity, bestNode = -1;
    for (const j of remaining) {
      if (!visited.has(j) && dist[last][j] < best) {
        best = dist[last][j]; bestNode = j;
      }
    }
    if (bestNode === -1) break;
    visited.add(bestNode);
    remaining.delete(bestNode);
    path.push(bestNode);
  }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT COLOR  — red on first leg, fades to route color by the last stop
// ─────────────────────────────────────────────────────────────────────────────

function segmentColor(
  segIndex:  number,
  totalSegs: number,
  mode:      "fastest" | "priority"
): string {
  if (totalSegs === 0) return mode === "priority" ? "#f97316" : "#059669";

  const endH = mode === "priority" ? 25 : 152;
  const endS = mode === "priority" ? 95 : 69;
  const endL = mode === "priority" ? 53 : 35;

  const startH = 4, startS = 90, startL = 58;
  const t = totalSegs === 1 ? 0 : segIndex / (totalSegs - 1);

  const h = Math.round(startH + (endH - startH) * t);
  const s = Math.round(startS + (endS - startS) * t);
  const l = Math.round(startL + (endL - startL) * t);

  return `hsl(${h},${s}%,${l}%)`;
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
  heading       = 0,
  routingPos,
  destinationPos,
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
    // Append destination as the final mandatory node if set.
    // A* will always end here because it is the last index and the cost
    // matrix is built with it included — the solver visits every node.
    const hasDestination = !!destinationPos;
    const allNodes: [number, number][] = [
      stablePos!,
      ...binCoords,
      ...(hasDestination ? [destinationPos!] : []),
    ];
    // Index of destination in allNodes (last node)
    const destNodeIdx = hasDestination ? allNodes.length - 1 : -1;

    // ── HEADING-AWARE COST MATRIX ─────────────────────────────────────────
    // Uses the driver's real GPS heading to penalise U-turns in A*
    const dist = buildHeadingAwareMatrix(allNodes, heading, destNodeIdx);

    console.info(
      `[A* TSP] Solving: 1 depot + ${targets.length} bins, mode=${mode}, heading=${heading.toFixed(0)}°, routeKey=${routeKey}`
    );
    const orderedIndices = hasDestination
      ? astarTSPWithDestination(allNodes, dist, destNodeIdx)
      : astarTSP(allNodes, dist);
    console.info(`[A* TSP] Order: ${orderedIndices.join(" → ")}`);

    // orderedTargets excludes the driver (idx 0) and destination (last idx if set)
    const orderedTargets = orderedIndices
      .filter((i) => i !== 0 && i !== destNodeIdx)
      .map((i) => targets[i - 1]);

    // ── CLASSIFY U-TURNS ──────────────────────────────────────────────────
    const routeWaypoints: [number, number][] = [
      stablePos!,
      ...orderedTargets.map((t: any) => [t.lat, t.lng] as [number, number]),
      ...(hasDestination ? [destinationPos!] : []),
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

    // Destination marker
    if (hasDestination) {
      L.marker(destinationPos!, {
        icon: L.divIcon({
          className: "",
          iconSize:  [36, 36],
          iconAnchor:[18, 36],
          html: `<div style="
            width:36px;height:36px;border-radius:8px 8px 2px 2px;
            background:#7c3aed;border:2.5px solid #c4b5fd;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,.4);
            font-size:9px;font-weight:800;color:#fff;
            font-family:sans-serif;letter-spacing:.04em;flex-direction:column;gap:1px;
          "><div style="font-size:14px;line-height:1;">⚑</div><div>END</div></div>`,
        }),
        zIndexOffset: 1200,
      })
        .bindTooltip("Destination / exit point", {
          direction: "top", offset: [0, -8], opacity: 0.92,
        })
        .addTo(group);
    }

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

    // ── FETCH ROAD GEOMETRY ───────────────────────────────────────────────
    //
    // Truck-road strategy:
    //
    //   SNAP_RADIUS (350 m): Mapbox snaps each waypoint to the nearest drivable
    //   road within this radius. A large radius is the primary tool for avoiding
    //   narrow residential roads — Mapbox picks the closest road it can reach,
    //   so when the GPS point is in a narrow alley, a 350 m radius forces it to
    //   find and snap to the main road further away instead.
    //
    //   BEARING HINTS: For the driver's start point we pass the GPS heading as a
    //   bearing hint. This tells Mapbox "the truck is already facing this direction"
    //   so it routes forward along that road rather than reversing into a side
    //   street. Angle=45 means ±45° tolerance around the heading.
    //
    //   exclude=ferry,unpaved: removes ferries and unpaved/dirt tracks entirely.
    //   Unpaved is the key addition — barangay dirt paths that appear drivable
    //   in satellite view are excluded so Mapbox must use paved main roads.
    //
    //   continue_straight=true on U-turn legs: forces Mapbox to stay on the
    //   current road and find a proper turning point (roundabout / intersection)
    //   rather than cutting through a side street.
    //
    //   Fallback chain: SNAP_RADIUS → smaller radius → no radius
    //   If Mapbox can't find a road at the large radius it means the bin really
    //   is on a narrow road — we relax progressively so we always get a route.

    const SNAP_RADIUS     = 500;  // metres — primary main-road bias: forces snap to main roads
    const SNAP_RADIUS_MID = 150;  // metres — fallback if 500m snap fails
    const BEARING_TOL     = 45;   // degrees — allows turns at intersections, prevents parallel narrow road snap

    const profile =
      mode === "priority" ? "mapbox/driving" : "mapbox/driving-traffic";

    const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    const totalLegs   = routeWaypoints.length - 1;
    const uturnLegSet = new Set<number>();
    uturnStops.forEach((stopNum) => { uturnLegSet.add(stopNum - 1); });

    // Build Mapbox Directions URL for a single leg (two waypoints).
    //
    // How we keep the truck on main roads:
    //
    //  1. radiuses=N;N  — snaps each waypoint to the nearest drivable road
    //     within N metres. A large radius (500 m) means Mapbox must reach
    //     further from the GPS pin and will land on a main road instead of
    //     the nearest residential alley.
    //
    //  2. bearings=H,45;0,180  — on the first leg, tells Mapbox the truck is
    //     already facing heading H (±45°). It will snap to roads going in
    //     roughly that direction, preventing a snap to a parallel side street
    //     going the wrong way.
    //
    //  3. exclude=ferry,motorway  — no ferries; motorways are excluded because
    //     barangay garbage trucks operate on local roads, not national highways.
    //     NOTE: Mapbox does NOT support exclude=residential or exclude=unpaved —
    //     those values are silently ignored. Road class filtering must come from
    //     the snap radius strategy.
    //
    //  4. continue_straight=true on U-turn legs — forces Mapbox to continue
    //     on the current road to a proper turning point instead of cutting
    //     through a side street.
    //
    //  5. walking=false (via annotations) is not supported — but the driving
    //     profile already excludes footways, steps, and cycleways natively.
    //
    //  6. Fallback chain: 500m → 150m → no radius. If the bin is genuinely
    //     on a small road (no main road within 500m) we relax progressively
    //     so the route always renders.

    const buildUrl = (
      from:        [number, number],
      to:          [number, number],
      isUturnLeg:  boolean,
      snapRadius:  number | null,
      fromBearing: number | null
    ): string => {
      const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;

      // ── RADIUS STRATEGY ────────────────────────────────────────────────
      // Origin: large radius forces snap past nearby narrow roads to main road.
      // Destination: small precise radius snaps to the actual bin location.
      const originRadius = snapRadius ?? 500;
      const destRadius   = 30;
      const radParam = snapRadius !== null
        ? `&radiuses=${originRadius};${destRadius}`
        : "";

      // ── BEARING STRATEGY ───────────────────────────────────────────────
      // Only constrain the ORIGIN waypoint bearing, not the destination.
      // Constraining both was causing the wrong-road loops — Mapbox was
      // forced to arrive at the bin from the bearing direction even when
      // that meant looping around on the wrong road.
      //
      // Origin bearing hint: tells Mapbox which road the truck is already on.
      // Tolerance 45°: generous enough to allow turns at intersections but
      // tight enough to prevent snapping to a parallel narrow road.
      // Destination: 0,180 = any direction allowed at arrival.
      const bearParam = (snapRadius !== null && fromBearing !== null)
        ? `&bearings=${Math.round(fromBearing) % 360},${BEARING_TOL};0,180`
        : "";

      // approaches=curb: right-hand traffic (Philippines drives on the right)
      const appParam = `&approaches=curb;curb`;

      // annotations: step-level data for road class logging
      const annoParam = `&annotations=duration,distance`;

      // continue_straight:
      //   true  on U-turn legs — force Mapbox to stay on current road and
      //          find a proper turning point, avoiding narrow side streets.
      //   false on normal legs — allow Mapbox to make standard turns at
      //          intersections. This is critical: forcing straight on normal
      //          legs causes wrong-road loops when the correct route requires
      //          a turn (e.g. green path issue, blue loop issue).
      const straightParam = isUturnLeg
        ? `&continue_straight=true`
        : `&continue_straight=false`;

      return (
        `https://api.mapbox.com/directions/v5/${profile}/${coords}` +
        `?geometries=geojson&overview=full&steps=true` +
        `&exclude=ferry` +
        radParam +
        bearParam +
        appParam +
        annoParam +
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

      // Try with large snap → mid snap → no snap (always returns something)
      const tryFetch = (radius: number | null) =>
        fetch(buildUrl(from, to, isUturnLeg, radius, fromBearing), { signal })
          .then((r) => r.json());

      return tryFetch(SNAP_RADIUS)
        .then((d: any) => {
          if (d.routes?.[0]) return d;
          console.warn(`[RoutingLayer] Leg ${s}: 500m snap failed (${d.code}), trying 150m`);
          return tryFetch(SNAP_RADIUS_MID);
        })
        .then((d: any) => {
          if (d.routes?.[0]) return d;
          console.warn(`[RoutingLayer] Leg ${s}: 150m snap failed, falling back to no snap`);
          return tryFetch(null);
        })
        .then((d: any) => {
          const route = d.routes?.[0];

          // Log any narrow road usage for debugging
          if (route?.legs) {
            const narrowTypes = ["residential","living_street","service","track","path","footway"];
            route.legs.forEach((leg: any) => {
              (leg.steps ?? []).forEach((step: any) => {
                const ref = (step.name ?? "").toLowerCase();
                if (narrowTypes.some((t) => step.road_class === t || ref.includes(t))) {
                  console.warn(`[RoutingLayer] Narrow road detected on leg ${s}: "${step.name}" (${step.road_class})`);
                }
              });
            });
          }

          return {
            coords: (route?.geometry?.coordinates ?? []).map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            ) as [number, number][],
            dist:     route?.distance ?? 0,
            duration: route?.duration ?? 0,
            isUturnLeg,
            segIndex: s,
          };
        });
    };

    // Every leg gets a bearing hint computed from straight-line from→to direction.
    // Leg 0 uses the real GPS heading for accuracy; subsequent legs use the
    // geometric bearing between waypoints as a good approximation of the
    // road direction the truck will be travelling.
    const legPromises = Array.from({ length: totalLegs }, (_, s) => {
      const from       = routeWaypoints[s];
      const to         = routeWaypoints[s + 1];
      const isUturnLeg = uturnLegSet.has(s);
      // Leg 0: use real GPS heading. All other legs: straight-line bearing
      // from the departure waypoint toward the next stop.
      const legBearing = s === 0 ? heading : bearing(from, to);
      return fetchLeg(from, to, isUturnLeg, legBearing, s);
    });

    Promise.all(legPromises)
      .then((legs) => {
        if (legs.some((l) => l.coords.length < 2)) {
          console.warn("[RoutingLayer] One or more legs returned no geometry.");
        }

        const segGroup = L.layerGroup().addTo(map);
        let   allCoords: [number, number][] = [];
        let   totalDist = 0, totalDuration = 0;

        // Non-U-turn legs: use gradient color scheme (red → mode color)
        // Count non-uturn legs so gradient spans only them
        const normalLegCount = legs.filter((l) => !l.isUturnLeg).length;
        let   normalLegIdx   = 0;

        legs.forEach((leg) => {
          if (leg.coords.length < 2) return;

          totalDist     += leg.dist;
          totalDuration += leg.duration;

          // Merge into full coordinate array for fitBounds
          allCoords = allCoords.length === 0
            ? leg.coords
            : [...allCoords, ...leg.coords.slice(1)];

          let color: string;
          let weight     = 5;
          let opacity    = 0.9;
          let dashArray: string | undefined;

          if (leg.isUturnLeg) {
            // ── U-TURN LEG — yellow, dashed, slightly thicker ────────────
            color     = "#eab308";   // yellow-500
            weight    = 5;
            opacity   = 0.95;
            dashArray = "10, 6";     // long dash = "follow this road back"
          } else {
            // ── NORMAL LEG — gradient red → mode color ───────────────────
            color    = segmentColor(normalLegIdx, normalLegCount, mode);
            weight   = normalLegIdx === 0 ? 6 : 5;
            opacity  = normalLegIdx === 0 ? 1.0 : 0.85;
            dashArray = mode === "priority" && normalLegIdx > 0 ? "1, 10" : undefined;
            normalLegIdx++;
          }

          // Glow halo
          L.polyline(leg.coords, {
            color,
            weight:  weight + 7,
            opacity: leg.isUturnLeg ? 0.18 : 0.12,
            lineJoin:"round",
          }).addTo(segGroup);

          // Solid line
          L.polyline(leg.coords, {
            color,
            weight,
            opacity,
            lineJoin:  "round",
            lineCap:   "round",
            dashArray,
          }).addTo(segGroup);
        });

        // Invisible full-route polyline just for fitBounds
        glowLayerRef.current = L.polyline(allCoords, {
          color: "transparent", weight: 0, opacity: 0,
        }).addTo(map);
        pathLayerRef.current = glowLayerRef.current;

        sequenceGroupRef.current?.addLayer(segGroup);

        group.eachLayer((layer) => {
          if (layer instanceof L.Marker) layer.setZIndexOffset(1100);
        });

        onRouteUpdateRef.current({
          dist: `${(totalDist / 1000).toFixed(1)} km`,
          time: `${Math.round(totalDuration / 60)} min`,
        });

        if (pathLayerRef.current) {
          map.fitBounds(pathLayerRef.current.getBounds(), {
            padding: [80, 80],
            animate: true,
            duration: 1.5,
          });
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError")
          console.error("[RoutingLayer] Mapbox error:", err);
      });

    return () => { abortRef.current?.abort(); };

  }, [map, stablePos, bins, selectedBinId, routeKey, mode, useFence, maxDetour, heading, destinationPos]);

  return <ProximityToast toast={toast} />;
}