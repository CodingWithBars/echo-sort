"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer, TileLayer, Marker, Polyline, Circle,
  useMapEvents, useMap,
} from "react-leaflet";
import L from "leaflet";
import { LUPON_CENTER } from "@/components/map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN   = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
const PROFILE = "mapbox/driving-traffic";

/** How many households one residential bin serves */
const CAP_RESIDENTIAL = 10;
/** How many industrial/commercial units one bin serves */
const CAP_INDUSTRIAL  = 5;
const CAP_COMMERCIAL  = 5;

/** Max metres to snap a candidate point to the nearest drivable road */
const SNAP_RADIUS_M = 100;

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING / A* ALGORITHM  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_SIDE_M   = 80;
const PENALTY_UTURN_M  = 250;
const PASS_THRESHOLD_M = 40;
const PASSTHROUGH_COST = 600;
const A_STAR_LIMIT     = 14;

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000, r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function buildDistMatrix(nodes: [number, number][]): number[][] {
  return nodes.map(a => nodes.map(b => haversine(a, b)));
}

function bearing(from: [number, number], to: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLon = r(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(r(to[0]));
  const x = Math.cos(r(from[0])) * Math.sin(r(to[0])) - Math.sin(r(from[0])) * Math.cos(r(to[0])) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function uturnPenalty(fromPos: [number, number], toPos: [number, number], curHeading: number): number {
  const turn = angleDiff(curHeading, bearing(fromPos, toPos));
  if (turn <= 60) return 0;
  if (turn <= 120) return PENALTY_SIDE_M;
  return PENALTY_UTURN_M;
}

function isUturn(fromPos: [number, number], toPos: [number, number], curHeading: number): boolean {
  return angleDiff(curHeading, bearing(fromPos, toPos)) > 120;
}

function pointToSegmentDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const toXY = (ll: [number, number]) => [ll[1] * Math.cos((ll[0] * Math.PI) / 180) * 111_320, ll[0] * 110_540];
  const [px, py] = toXY(p), [ax, ay] = toXY(a), [bx, by] = toXY(b);
  const dx = bx - ax, dy = by - ay, lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  if (t < 0.05 || t > 0.95) return Infinity;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function buildHeadingAwareMatrix(nodes: [number, number][], driverHeading: number, destIdx = -1): number[][] {
  const n = nodes.length, base = buildDistMatrix(nodes), mat = base.map(r => [...r]);
  for (let j = 1; j < n; j++) {
    if (j === destIdx) continue;
    mat[0][j] = base[0][j] + uturnPenalty(nodes[0], nodes[j], driverHeading);
  }
  for (let i = 1; i < n; i++) {
    if (i === destIdx) continue;
    const arrAtI = bearing(nodes[0], nodes[i]);
    for (let j = 1; j < n; j++) {
      if (i === j || j === destIdx) continue;
      let cost = base[i][j] + uturnPenalty(nodes[i], nodes[j], arrAtI);
      for (let k = 1; k < n; k++) {
        if (k === i || k === j || k === destIdx) continue;
        if (pointToSegmentDist(nodes[k], nodes[i], nodes[j]) < PASS_THRESHOLD_M) { cost += PASSTHROUGH_COST; break; }
      }
      mat[i][j] = cost;
    }
  }
  if (destIdx > 0) for (let i = 0; i < n; i++) if (i !== destIdx) mat[i][destIdx] = base[i][destIdx];
  return mat;
}

function mstCost(indices: number[], dist: number[][]): number {
  if (indices.length <= 1) return 0;
  const inMST = new Set([indices[0]]); let total = 0;
  while (inMST.size < indices.length) {
    let best = Infinity, bestNode = -1;
    for (const u of inMST) for (const v of indices) if (!inMST.has(v) && dist[u][v] < best) { best = dist[u][v]; bestNode = v; }
    if (bestNode === -1) break;
    inMST.add(bestNode); total += best;
  }
  return total;
}

function admissibleH(cur: number, mask: number, dist: number[][], n: number): number {
  const unvisited: number[] = [];
  for (let i = 1; i < n; i++) if (!(mask & (1 << i))) unvisited.push(i);
  if (unvisited.length === 0) return 0;
  return Math.min(...unvisited.map(v => dist[cur][v])) + mstCost(unvisited, dist);
}

function nearestNeighbor(dist: number[][]): number[] {
  const n = dist.length, visited = new Set([0]), path = [0];
  while (visited.size < n) {
    const last = path[path.length - 1]; let best = Infinity, bestNode = -1;
    for (let j = 1; j < n; j++) if (!visited.has(j) && dist[last][j] < best) { best = dist[last][j]; bestNode = j; }
    if (bestNode === -1) break;
    visited.add(bestNode); path.push(bestNode);
  }
  return path;
}

function astarTSP(nodes: [number, number][], dist: number[][]): number[] {
  const n = nodes.length;
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];
  if (n > A_STAR_LIMIT) return nearestNeighbor(dist);
  const allVisited = (1 << n) - 1;
  const gCost: number[][] = Array.from({ length: n }, () => new Array<number>(1 << n).fill(Infinity));
  gCost[0][1] = 0;
  const pathAt = new Map<string, number[]>([["0,1", [0]]]);
  interface E { node: number; mask: number; g: number; f: number; }
  const open: E[] = [{ node: 0, mask: 1, g: 0, f: admissibleH(0, 1, dist, n) }];
  while (open.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[minIdx].f) minIdx = i;
    const curr = open.splice(minIdx, 1)[0];
    if (curr.mask === allVisited) return pathAt.get(`${curr.node},${curr.mask}`) ?? nearestNeighbor(dist);
    if (curr.g > gCost[curr.node][curr.mask]) continue;
    for (let next = 1; next < n; next++) {
      if (curr.mask & (1 << next)) continue;
      const newMask = curr.mask | (1 << next);
      const newG = curr.g + dist[curr.node][next];
      if (newG < gCost[next][newMask]) {
        gCost[next][newMask] = newG;
        pathAt.set(`${next},${newMask}`, [...(pathAt.get(`${curr.node},${curr.mask}`) ?? [0]), next]);
        open.push({ node: next, mask: newMask, g: newG, f: newG + admissibleH(next, newMask, dist, n) });
      }
    }
  }
  return nearestNeighbor(dist);
}

function countUturns(nodes: [number, number][], headingAtStart: number): number {
  if (nodes.length < 2) return 0;
  let count = 0, cur = headingAtStart;
  for (let i = 0; i < nodes.length - 1; i++) {
    if (isUturn(nodes[i], nodes[i + 1], cur)) count++;
    cur = bearing(nodes[i], nodes[i + 1]);
  }
  return count;
}

function segmentColor(s: number, total: number): string {
  const t = total === 1 ? 0 : s / (total - 1);
  return `hsl(${Math.round(4 + 148 * t)},${Math.round(90 - 21 * t)}%,${Math.round(58 - 23 * t)}%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPBOX ROAD-SNAP & ZONE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/** Snap a coordinate to the nearest drivable road using Mapbox Directions */
async function snapToRoad(lat: number, lng: number, signal?: AbortSignal): Promise<[number, number]> {
  try {
    // tiny offset so Mapbox Directions gives us a valid 2-point route to extract road position
    const off = 0.00006;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lng},${lat};${lng + off},${lat + off}`
      + `?geometries=geojson&overview=full&radiuses=${SNAP_RADIUS_M};${SNAP_RADIUS_M}&access_token=${TOKEN}`;
    const data = await fetch(url, { signal }).then(r => r.json());
    const c = data.routes?.[0]?.geometry?.coordinates?.[0];
    if (c) return [c[1], c[0]];
  } catch (_) {}
  return [lat, lng];
}

type ZoneType = "residential" | "industrial" | "commercial";

/** Infer zone type from Mapbox reverse geocoding */
async function inferZoneType(lat: number, lng: number, signal?: AbortSignal): Promise<ZoneType> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`
      + `?types=poi,address&limit=5&access_token=${TOKEN}`;
    const data = await fetch(url, { signal }).then(r => r.json());
    const text = JSON.stringify(data.features ?? []).toLowerCase();
    if (/industrial|warehouse|factory|manufactur|storage/.test(text)) return "industrial";
    if (/commercial|shop|store|market|mall|office|restaurant|hotel|business|retail/.test(text)) return "commercial";
  } catch (_) {}
  return "residential";
}

// ─────────────────────────────────────────────────────────────────────────────
// HOUSEHOLD GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function genHouseholds(center: [number, number], radiusM: number, spacingM: number): [number, number][] {
  const result: [number, number][] = [];
  const latStep = spacingM / 111_320;
  const lngStep = spacingM / (111_320 * Math.cos((center[0] * Math.PI) / 180));
  const steps   = Math.ceil(radiusM / spacingM);
  for (let di = -steps; di <= steps; di++) {
    for (let dj = -steps; dj <= steps; dj++) {
      const p: [number, number] = [center[0] + di * latStep, center[1] + dj * lngStep];
      if (haversine(center, p) <= radiusM) result.push(p);
    }
  }
  return result;
}

/**
 * Build candidate bin positions on roads using a grid, then snap each to the nearest drivable road.
 * Returns deduplicated snapped positions with assigned zone types.
 */
async function buildRoadBinCandidates(
  center: [number, number],
  radiusM: number,
  gridSpacingM: number,
  signal: AbortSignal,
  onProgress: (s: string) => void,
): Promise<RoadBinCandidate[]> {
  const latStep = gridSpacingM / 111_320;
  const lngStep = gridSpacingM / (111_320 * Math.cos((center[0] * Math.PI) / 180));
  const steps   = Math.ceil(radiusM / gridSpacingM);

  const raw: [number, number][] = [];
  for (let di = -steps; di <= steps; di++) {
    for (let dj = -steps; dj <= steps; dj++) {
      const p: [number, number] = [center[0] + di * latStep, center[1] + dj * lngStep];
      if (haversine(center, p) <= radiusM) raw.push(p);
    }
  }

  onProgress(`Snapping ${raw.length} grid points to roads…`);

  // Snap in small batches
  const snapped: [number, number][] = [];
  const BATCH = 4;
  for (let i = 0; i < raw.length; i += BATCH) {
    if (signal.aborted) return [];
    const batch = raw.slice(i, i + BATCH);
    const res   = await Promise.all(batch.map(([la, lo]) => snapToRoad(la, lo, signal)));
    snapped.push(...res);
    if (i % (BATCH * 4) === 0) onProgress(`Road-snapping ${i + BATCH}/${raw.length}…`);
  }

  // Deduplicate (merge points within 12 m)
  const deduped: [number, number][] = [];
  for (const p of snapped) {
    if (!deduped.some(d => haversine(d, p) < 12)) deduped.push(p);
  }

  onProgress(`${deduped.length} unique road positions. Detecting zones…`);

  // Zone detection (batched 5 at a time)
  const candidates: RoadBinCandidate[] = [];
  for (let i = 0; i < deduped.length; i++) {
    if (signal.aborted) return [];
    const zone = await inferZoneType(deduped[i][0], deduped[i][1], signal);
    const cap  = zone === "residential" ? CAP_RESIDENTIAL : zone === "industrial" ? CAP_INDUSTRIAL : CAP_COMMERCIAL;
    candidates.push({ pos: deduped[i], zone, capacity: cap, servesUnits: 0 });
    if (i % 5 === 0) onProgress(`Zone detection ${i + 1}/${deduped.length}…`);
  }
  return candidates;
}

/** Greedy assignment of households to nearest bin with remaining capacity */
function assignHouseholds(households: [number, number][], bins: RoadBinCandidate[]): RoadBinCandidate[] {
  const b = bins.map(x => ({ ...x, servesUnits: 0 }));
  for (const h of households) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < b.length; i++) {
      const d = haversine(h, b[i].pos);
      if (d < bestD && b[i].servesUnits < b[i].capacity) { bestD = d; best = i; }
    }
    if (best >= 0) b[best].servesUnits++;
  }
  return b;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface RoadBinCandidate {
  pos:         [number, number];
  zone:        ZoneType;
  capacity:    number;
  servesUnits: number;
}

interface SimBin {
  id:        number;
  lat:       number;
  lng:       number;
  fillLevel: number;
  zone:      ZoneType;
  snapped:   boolean;
}

interface SimResult {
  orderedBins: SimBin[];
  totalDist:   number;
  totalTime:   number;
  legCoords:   [number, number][][];
  uturnCount:  number;
}

interface ScenarioResult {
  label:        string;
  bins:         RoadBinCandidate[];
  orderedRoute: [number, number][];
  totalDist:    number;
  totalTime:    number;
  uturnCount:   number;
  legCoords:    [number, number][][];
  coveragePct:  number;
  score:        number;
}

interface BinSimulatorProps {
  mapStyle: "satellite-streets-v12" | "navigation-night-v1" | "outdoors-v12";
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE META
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_COLOR: Record<ZoneType, string> = {
  residential: "#10b981",
  industrial:  "#f59e0b",
  commercial:  "#8b5cf6",
};
const ZONE_ICON: Record<ZoneType, string> = {
  residential: "🏠",
  industrial:  "🏭",
  commercial:  "🏬",
};
const ZONE_CAP: Record<ZoneType, number> = {
  residential: CAP_RESIDENTIAL,
  industrial:  CAP_INDUSTRIAL,
  commercial:  CAP_COMMERCIAL,
};

const SC_COLORS = ["#22d3ee", "#fb923c", "#a78bfa", "#34d399", "#fb7185", "#fbbf24"];

// ─────────────────────────────────────────────────────────────────────────────
// LEAFLET ICONS
// ─────────────────────────────────────────────────────────────────────────────

const makeSimBinIcon = (bin: SimBin, orderNum: number | null) => {
  const urgent = bin.fillLevel >= 80;
  const bg = urgent ? "#ef4444" : bin.fillLevel >= 40 ? "#f59e0b" : ZONE_COLOR[bin.zone];
  const badge = orderNum !== null
    ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#0f172a;color:#22d3ee;border-radius:8px;padding:1px 5px;font-size:9px;font-weight:900;font-family:monospace;white-space:nowrap;border:1px solid #22d3ee40;">→${orderNum}</div>`
    : "";
  const snapRing = bin.snapped
    ? "border:3px solid #22d3ee;box-shadow:0 0 0 1px #22d3ee40,0 4px 12px rgba(0,0,0,0.5);"
    : "border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);";
  return L.divIcon({
    className: "",
    iconSize:  [36, 36],
    iconAnchor:[18, 18],
    html: `<div style="position:relative;">
      ${badge}
      <div style="width:36px;height:36px;border-radius:50%;background:${bg};${snapRing}display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff;font-family:monospace;">${bin.fillLevel}%</div>
      <div style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);font-size:11px;line-height:1;">${ZONE_ICON[bin.zone]}</div>
    </div>`,
  });
};

const makeRoadBinIcon = (rb: RoadBinCandidate, orderNum: number | null, color: string) => {
  const fill = rb.capacity > 0 ? Math.round((rb.servesUnits / rb.capacity) * 100) : 0;
  const badge = orderNum !== null
    ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#0f172a;color:${color};border-radius:8px;padding:1px 5px;font-size:9px;font-weight:900;font-family:monospace;white-space:nowrap;border:1px solid ${color}60;">→${orderNum}</div>`
    : "";
  return L.divIcon({
    className: "",
    iconSize:  [40, 40],
    iconAnchor:[20, 20],
    html: `<div style="position:relative;">
      ${badge}
      <div style="width:40px;height:40px;border-radius:10px;background:${color};border:3px solid rgba(255,255,255,0.2);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.5);gap:1px;">
        <div style="font-size:13px;line-height:1;">${ZONE_ICON[rb.zone]}</div>
        <div style="font-size:8px;font-weight:900;color:#fff;font-family:monospace;opacity:0.95;">${rb.servesUnits}/${rb.capacity}</div>
      </div>
      <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};"></div>
    </div>`,
  });
};

const makeHouseholdDot = (covered: boolean) => L.divIcon({
  className: "",
  iconSize:  [8, 8],
  iconAnchor:[4, 4],
  html: `<div style="width:8px;height:8px;border-radius:50%;background:${covered ? "#34d399" : "#f87171"};border:1.5px solid ${covered ? "#059669" : "#dc2626"};opacity:0.85;"></div>`,
});

const ORIGIN_ICON = L.divIcon({
  className: "",
  iconSize:  [42, 42],
  iconAnchor:[21, 21],
  html: `<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#b45309,#f59e0b);border:3px solid #fcd34d;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;font-family:monospace;box-shadow:0 4px 14px rgba(217,119,6,.45),0 0 0 1px #fcd34d30;letter-spacing:-0.5px;">HQ</div>`,
});

const DEST_ICON = L.divIcon({
  className: "",
  iconSize:  [42, 42],
  iconAnchor:[21, 42],
  html: `<div style="width:42px;height:42px;border-radius:12px 12px 4px 4px;background:linear-gradient(135deg,#6d28d9,#a855f7);border:3px solid #c4b5fd;display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 4px 14px rgba(124,58,237,.45);"><div style="font-size:18px;line-height:1;">⚑</div><div style="font-size:8px;font-weight:900;color:#fff;font-family:monospace;">END</div></div>`,
});

// ─────────────────────────────────────────────────────────────────────────────
// MAP CLICK HANDLER
// ─────────────────────────────────────────────────────────────────────────────

type ClickMode = "bin" | "origin" | "destination" | "radius" | "none";

function SimMapHandlers({
  mode, onAddBin, onSetOrigin, onSetDestination, onSetCenter,
}: {
  mode:             ClickMode;
  onAddBin:         (lat: number, lng: number) => void;
  onSetOrigin:      (lat: number, lng: number) => void;
  onSetDestination: (lat: number, lng: number) => void;
  onSetCenter:      (lat: number, lng: number) => void;
}) {
  useMapEvents({ click(e) {
    const { lat, lng } = e.latlng;
    if (mode === "bin")         onAddBin(lat, lng);
    if (mode === "origin")      onSetOrigin(lat, lng);
    if (mode === "destination") onSetDestination(lat, lng);
    if (mode === "radius")      onSetCenter(lat, lng);
  }});
  return null;
}

function FitBoundsOnResult({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.fitBounds(L.latLngBounds(coords.map(c => L.latLng(c[0], c[1]))), { padding: [70, 70], animate: true, duration: 1.1 });
  }, [coords, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BinSimulator({ mapStyle }: BinSimulatorProps) {

  // ── Shared state ───────────────────────────────────────────────────────────
  const [originPos, setOriginPos]   = useState<[number, number] | null>(null);
  const [destPos, setDestPos]       = useState<[number, number] | null>(null);
  const [clickMode, setClickMode]   = useState<ClickMode>("none");
  const [simHeading, setSimHeading] = useState(0);
  const [statusMsg, setStatusMsg]   = useState("");
  const [panelTab, setPanelTab]     = useState<"manual" | "radius">("manual");
  const abortRef                    = useRef<AbortController | null>(null);
  const nextId                      = useRef(1);

  // ── Manual mode state ──────────────────────────────────────────────────────
  const [simBins, setSimBins]     = useState<SimBin[]>([]);
  const [simFill, setSimFill]     = useState(75);
  const [simZone, setSimZone]     = useState<ZoneType>("residential");
  const [result, setResult]       = useState<SimResult | null>(null);
  const [running, setRunning]     = useState(false);

  // ── Radius test state ──────────────────────────────────────────────────────
  const [radiusCenter, setRadiusCenter]       = useState<[number, number] | null>(null);
  const [radiusM, setRadiusM]                 = useState(300);
  const [hhSpacing, setHhSpacing]             = useState(25);
  const [zoneFilter, setZoneFilter]           = useState<ZoneType>("residential");
  const [households, setHouseholds]           = useState<[number, number][]>([]);
  const [coveredHH, setCoveredHH]             = useState<boolean[]>([]);
  const [showHH, setShowHH]                   = useState(true);
  const [previewBins, setPreviewBins]         = useState<RoadBinCandidate[]>([]);
  const [scenarios, setScenarios]             = useState<ScenarioResult[]>([]);
  const [selectedSc, setSelectedSc]           = useState(-1);
  const [testRunning, setTestRunning]         = useState(false);

  const activeSc = selectedSc >= 0 ? scenarios[selectedSc] : null;

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR ALL
  // ─────────────────────────────────────────────────────────────────────────

  const clearAll = () => {
    abortRef.current?.abort();
    setSimBins([]); setOriginPos(null); setDestPos(null);
    setResult(null); setStatusMsg(""); setScenarios([]);
    setSelectedSc(-1); setHouseholds([]); setRadiusCenter(null);
    setPreviewBins([]); setCoveredHH([]); setClickMode("none");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL: place bin with road-snap + zone detection
  // ─────────────────────────────────────────────────────────────────────────

  const addSimBin = useCallback(async (lat: number, lng: number) => {
    setStatusMsg("📡 Snapping to road…");
    const [sLat, sLng] = await snapToRoad(lat, lng);
    const zone         = await inferZoneType(sLat, sLng);
    setSimBins(prev => [...prev, {
      id: nextId.current++, lat: sLat, lng: sLng,
      fillLevel: simFill, zone, snapped: true,
    }]);
    setResult(null);
    setStatusMsg(`✓ Bin on road · ${zone} zone · cap ${ZONE_CAP[zone]} units/bin`);
  }, [simFill]);

  const removeSimBin = useCallback((id: number) => {
    setSimBins(p => p.filter(b => b.id !== id)); setResult(null);
  }, []);

  const updateBinFill = useCallback((id: number, v: number) => {
    setSimBins(p => p.map(b => b.id === id ? { ...b, fillLevel: v } : b)); setResult(null);
  }, []);

  const updateBinZone = useCallback((id: number, z: ZoneType) => {
    setSimBins(p => p.map(b => b.id === id ? { ...b, zone: z } : b)); setResult(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL: run A*
  // ─────────────────────────────────────────────────────────────────────────

  const runSimulation = async () => {
    if (!originPos || simBins.length === 0) { setStatusMsg("Set HQ + at least one bin."); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setRunning(true); setResult(null); setStatusMsg("Running A*…");

    const active = simBins.filter(b => b.fillLevel >= 40);
    if (!active.length) { setStatusMsg("No bins at ≥40%."); setRunning(false); return; }

    const binCoords: [number, number][] = active.map(b => [b.lat, b.lng]);
    const hasD  = !!destPos;
    const nodes: [number, number][] = [originPos, ...binCoords, ...(hasD ? [destPos!] : [])];
    const dIdx  = hasD ? nodes.length - 1 : -1;
    const dist  = buildHeadingAwareMatrix(nodes, simHeading, dIdx);
    const order = astarTSP(nodes, dist);
    const orderedBins = order.filter(i => i !== 0 && i !== dIdx).map(i => active[i - 1]);

    const routeNodes: [number, number][] = [originPos, ...orderedBins.map(b => [b.lat, b.lng] as [number, number])];
    const uturnCount = countUturns(routeNodes, simHeading);
    setStatusMsg(`A* done · ${orderedBins.length} stops · 🔄 ${uturnCount} U-turns · fetching roads…`);

    const wps: [number, number][] = [originPos, ...orderedBins.map(b => [b.lat, b.lng] as [number, number]), ...(hasD ? [destPos!] : [])];
    const legPromises = wps.slice(0, -1).map((from, s) => {
      const to = wps[s + 1], lb = s === 0 ? simHeading : bearing(from, to);
      const url = `https://api.mapbox.com/directions/v5/${PROFILE}/${from[1]},${from[0]};${to[1]},${to[0]}`
        + `?geometries=geojson&overview=full&radiuses=500;80&bearings=${Math.round(lb) % 360},45;0,180`
        + `&approaches=curb;curb&exclude=ferry&continue_straight=false&access_token=${TOKEN}`;
      return fetch(url, { signal }).then(r => r.json()).then((d: any) => ({
        coords:   (d.routes?.[0]?.geometry?.coordinates ?? []).map(([lo, la]: number[]) => [la, lo] as [number, number]),
        dist:     d.routes?.[0]?.distance ?? 0,
        duration: d.routes?.[0]?.duration ?? 0,
      }));
    });

    try {
      const legs = await Promise.all(legPromises);
      const totalDist = legs.reduce((s, l) => s + l.dist, 0);
      const totalTime = legs.reduce((s, l) => s + l.duration, 0);
      setResult({ orderedBins, totalDist, totalTime, legCoords: legs.map(l => l.coords), uturnCount });
      setStatusMsg(`✓ ${(totalDist / 1000).toFixed(2)} km · ${Math.round(totalTime / 60)} min · 🔄 ${uturnCount} U-turns`);
    } catch (err: any) {
      if (err.name !== "AbortError") setStatusMsg("Route fetch failed.");
    } finally { setRunning(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RADIUS: generate households
  // ─────────────────────────────────────────────────────────────────────────

  const generateHouseholds = () => {
    if (!radiusCenter) { setStatusMsg("Set a service area center first."); return; }
    const hh = genHouseholds(radiusCenter, radiusM, hhSpacing);
    setHouseholds(hh); setCoveredHH(new Array(hh.length).fill(false));
    setScenarios([]); setSelectedSc(-1); setPreviewBins([]);
    setStatusMsg(`Generated ${hh.length} households in ${radiusM}m radius.`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RADIUS: run road-snapped multi-scenario test
  // ─────────────────────────────────────────────────────────────────────────

  const runRadiusTest = async () => {
    if (!originPos)          { setStatusMsg("Set HQ first."); return; }
    if (!radiusCenter)       { setStatusMsg("Set service area center first."); return; }
    if (!households.length)  { setStatusMsg("Generate households first."); return; }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTestRunning(true); setScenarios([]); setSelectedSc(-1); setPreviewBins([]);

    // Grid spacing for bin candidates ~= coverage radius
    const cap       = ZONE_CAP[zoneFilter];
    const gridStep  = Math.max(40, Math.round(radiusM / Math.ceil(Math.sqrt(households.length / cap))));

    // 1. Road-snap candidate bins
    const rawCandidates = await buildRoadBinCandidates(
      radiusCenter, radiusM, gridStep, signal, setStatusMsg
    );
    if (signal.aborted || !rawCandidates.length) { setTestRunning(false); setStatusMsg("No road positions found."); return; }

    // 2. Assign households
    const assigned = assignHouseholds(households, rawCandidates);
    setPreviewBins(assigned);

    // Update coverage dots
    const covRadius = gridStep * 1.8;
    setCoveredHH(households.map(h => assigned.some(b => haversine(h, b.pos) <= covRadius && b.servesUnits > 0)));

    // 3. Build scenarios from different bin subsets
    const active  = assigned.filter(b => b.servesUnits > 0);

    // Scenario C: merge bins within 25m
    const merged: RoadBinCandidate[] = [];
    const used = new Set<number>();
    for (let i = 0; i < active.length; i++) {
      if (used.has(i)) continue;
      const cluster = [active[i]];
      for (let j = i + 1; j < active.length; j++) {
        if (!used.has(j) && haversine(active[i].pos, active[j].pos) < 25) { cluster.push(active[j]); used.add(j); }
      }
      used.add(i);
      merged.push({
        pos: [
          cluster.reduce((s, b) => s + b.pos[0], 0) / cluster.length,
          cluster.reduce((s, b) => s + b.pos[1], 0) / cluster.length,
        ],
        zone:        active[i].zone,
        capacity:    cluster.reduce((s, b) => s + b.capacity, 0),
        servesUnits: cluster.reduce((s, b) => s + b.servesUnits, 0),
      });
    }

    const strategies: { label: string; bins: RoadBinCandidate[] }[] = [
      { label: "All Road Bins",    bins: assigned },
      { label: "Active Bins Only", bins: active },
      { label: "Merged Clusters",  bins: merged },
    ];

    const results: ScenarioResult[] = [];

    for (const { label, bins } of strategies) {
      if (!bins.length) continue;
      setStatusMsg(`A* testing "${label}" (${bins.length} bins)…`);

      const hasD  = !!destPos;
      const bCoords = bins.map(b => b.pos);
      const nodes: [number, number][] = [originPos, ...bCoords, ...(hasD ? [destPos!] : [])];
      const dIdx  = hasD ? nodes.length - 1 : -1;
      const dist  = buildHeadingAwareMatrix(nodes, simHeading, dIdx);
      const order = astarTSP(nodes, dist);

      const routeIdx      = order.filter(i => i !== 0 && i !== dIdx);
      const orderedRoute  = routeIdx.map(i => bins[i - 1].pos);
      const routeNodes: [number, number][] = [originPos, ...orderedRoute, ...(hasD && destPos ? [destPos] : [])];
      const uturnCount    = countUturns(routeNodes, simHeading);

      const covRadiusLocal = gridStep * 1.8;
      const covered        = households.filter(h => bins.some(b => haversine(h, b.pos) <= covRadiusLocal)).length;
      const coveragePct    = Math.round((covered / households.length) * 100);

      // Fetch road geometry
      let totalDist = 0, totalTime = 0;
      const legCoords: [number, number][][] = [];
      for (let s = 0; s < routeNodes.length - 1; s++) {
        if (signal.aborted) { setTestRunning(false); return; }
        const from = routeNodes[s], to = routeNodes[s + 1];
        const lb   = s === 0 ? simHeading : bearing(from, to);
        const url  = `https://api.mapbox.com/directions/v5/${PROFILE}/${from[1]},${from[0]};${to[1]},${to[0]}`
          + `?geometries=geojson&overview=full&radiuses=500;80&bearings=${Math.round(lb) % 360},45;0,180`
          + `&approaches=curb;curb&exclude=ferry&continue_straight=false&access_token=${TOKEN}`;
        try {
          const d = await fetch(url, { signal }).then(r => r.json());
          legCoords.push((d.routes?.[0]?.geometry?.coordinates ?? []).map(([lo, la]: number[]) => [la, lo] as [number, number]));
          totalDist += d.routes?.[0]?.distance ?? 0;
          totalTime += d.routes?.[0]?.duration ?? 0;
        } catch { legCoords.push([]); }
      }

      const score = (totalDist / 1000) * 0.4 + (totalTime / 60) * 0.3 + uturnCount * 50 * 0.2 - coveragePct * 0.5;
      results.push({ label, bins, orderedRoute, totalDist, totalTime, uturnCount, legCoords, coveragePct, score });
    }

    results.sort((a, b) => a.score - b.score);
    setScenarios(results);
    setSelectedSc(0);
    setTestRunning(false);
    setStatusMsg(`✓ ${results.length} scenarios · Best: "${results[0]?.label}" · 🔄 ${results[0]?.uturnCount} U-turns`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Apply scenario bins to manual mode
  // ─────────────────────────────────────────────────────────────────────────

  const applyScenario = (si: number) => {
    const sc = scenarios[si];
    if (!sc) return;
    setSimBins(prev => [
      ...prev,
      ...sc.bins.map(rb => ({
        id: nextId.current++, lat: rb.pos[0], lng: rb.pos[1],
        fillLevel: 80, zone: rb.zone, snapped: true,
      })),
    ]);
    setPanelTab("manual");
    setStatusMsg(`Applied ${sc.bins.length} road-snapped bins from "${sc.label}".`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const allRouteCoords = result ? result.legCoords.flat() : [];

  const modeHint: Record<ClickMode, string> = {
    bin:         `Tap → road-snap bin (${simZone} · cap ${ZONE_CAP[simZone]})`,
    origin:      "Tap to set HQ / truck origin",
    destination: "Tap to set exit / end point",
    radius:      "Tap to set service area center",
    none:        "",
  };

  return (
    <div className="h-full w-full flex flex-col relative">

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-1.5 flex-wrap justify-center px-2 max-w-[98vw]">

        {/* Tab switcher */}
        <div className="flex bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          {(["manual", "radius"] as const).map(tab => (
            <button key={tab} onClick={() => setPanelTab(tab)}
              className={`px-3.5 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                panelTab === tab
                  ? tab === "manual" ? "bg-cyan-600 text-white" : "bg-violet-700 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              {tab === "manual" ? "📋 Manual" : "🔬 Road Test"}
            </button>
          ))}
        </div>

        {/* ─ MANUAL controls ─ */}
        {panelTab === "manual" && (<>
          {(["origin", "bin", "destination"] as ClickMode[]).map(m => {
            const lbl = { origin: "📍 HQ", bin: "🗑 Bin", destination: "⚑ Exit" }[m as string] ?? m;
            const on  = clickMode === m;
            return (
              <button key={m} onClick={() => setClickMode(on ? "none" : m as ClickMode)}
                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all ${
                  on ? "bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-600/30 scale-105"
                     : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-cyan-700"
                }`}>{lbl}</button>
            );
          })}

          {/* Zone picker */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 backdrop-blur-sm border border-slate-800 rounded-xl px-1.5 py-1.5 shadow">
            {(["residential", "industrial", "commercial"] as ZoneType[]).map(z => (
              <button key={z} onClick={() => setSimZone(z)} title={`${z} (cap ${ZONE_CAP[z]})`}
                className={`px-2 py-1 rounded-lg text-[10px] transition-all font-black ${simZone === z ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                style={{ background: simZone === z ? ZONE_COLOR[z] : "transparent" }}>
                {ZONE_ICON[z]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow">
            <span className="text-[8px] font-black text-slate-500 uppercase">Fill</span>
            <input type="range" min="0" max="100" step="5" value={simFill}
              onChange={e => setSimFill(+e.target.value)} className="w-16 accent-amber-400" />
            <span className="text-[9px] font-black text-amber-400 min-w-[24px]">{simFill}%</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow">
            <span className="text-[8px] font-black text-slate-500 uppercase">Hdg</span>
            <input type="range" min="0" max="359" step="5" value={simHeading}
              onChange={e => { setSimHeading(+e.target.value); setResult(null); }} className="w-14 accent-cyan-400" />
            <span className="text-[9px] font-black text-cyan-400 min-w-[26px]">{simHeading}°</span>
          </div>

          <button onClick={runSimulation} disabled={running || !originPos || !simBins.length}
            className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500 active:scale-95 transition-all">
            {running ? "⏳…" : "▶ Run A*"}
          </button>
        </>)}

        {/* ─ RADIUS TEST controls ─ */}
        {panelTab === "radius" && (<>
          {[
            { m: "radius" as ClickMode, lbl: "🎯 Center" },
            { m: "origin" as ClickMode, lbl: "📍 HQ"     },
            { m: "destination" as ClickMode, lbl: "⚑ Exit" },
          ].map(({ m, lbl }) => (
            <button key={m} onClick={() => setClickMode(clickMode === m ? "none" : m)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all ${
                clickMode === m
                  ? "bg-violet-700 border-violet-400 text-white shadow-lg scale-105"
                  : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-violet-600"
              }`}>{lbl}</button>
          ))}

          {/* Zone filter */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 border border-slate-800 rounded-xl px-1.5 py-1.5 shadow">
            <span className="text-[8px] font-black text-slate-500 uppercase mr-1">Zone</span>
            {(["residential", "industrial", "commercial"] as ZoneType[]).map(z => (
              <button key={z} onClick={() => setZoneFilter(z)} title={`${z} · ${ZONE_CAP[z]} units/bin`}
                className={`px-2 py-1 rounded-lg text-[10px] transition-all font-black ${zoneFilter === z ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                style={{ background: zoneFilter === z ? ZONE_COLOR[z] : "transparent" }}>
                {ZONE_ICON[z]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow">
            <span className="text-[8px] font-black text-slate-500 uppercase">Radius</span>
            <input type="range" min="50" max="800" step="25" value={radiusM}
              onChange={e => setRadiusM(+e.target.value)} className="w-16 accent-violet-400" />
            <span className="text-[9px] font-black text-violet-400 min-w-[32px]">{radiusM}m</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow">
            <span className="text-[8px] font-black text-slate-500 uppercase">HH</span>
            <input type="range" min="10" max="80" step="5" value={hhSpacing}
              onChange={e => setHhSpacing(+e.target.value)} className="w-12 accent-blue-400" />
            <span className="text-[9px] font-black text-blue-400 min-w-[24px]">{hhSpacing}m</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow">
            <span className="text-[8px] font-black text-slate-500 uppercase">Hdg</span>
            <input type="range" min="0" max="359" step="5" value={simHeading}
              onChange={e => setSimHeading(+e.target.value)} className="w-12 accent-cyan-400" />
            <span className="text-[9px] font-black text-cyan-400 min-w-[26px]">{simHeading}°</span>
          </div>

          <button onClick={generateHouseholds} disabled={!radiusCenter}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-700 text-white border border-blue-600 shadow disabled:opacity-40 hover:bg-blue-600 active:scale-95 transition-all">
            🏠 Gen
          </button>

          <button onClick={runRadiusTest} disabled={testRunning || !originPos || !households.length}
            className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide bg-violet-700 text-white border border-violet-500 shadow-lg shadow-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-600 active:scale-95 transition-all">
            {testRunning ? "⏳…" : "🔬 Road Test"}
          </button>
        </>)}

        <button onClick={clearAll}
          className="px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-slate-950/80 text-red-400 border border-red-900/50 shadow hover:border-red-500 active:scale-95 transition-all">
          ✕ Clear
        </button>
      </div>

      {/* ── CLICK HINT ──────────────────────────────────────────────────── */}
      {clickMode !== "none" && (
        <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-[500] bg-cyan-700 text-white text-[10px] font-black uppercase tracking-wide px-4 py-2 rounded-full shadow-xl pointer-events-none border border-cyan-500/40">
          {modeHint[clickMode]}
        </div>
      )}

      {/* ── STATUS ──────────────────────────────────────────────────────── */}
      {statusMsg && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] bg-slate-950/95 text-cyan-300 text-[10px] font-black uppercase tracking-wide px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-sm pointer-events-none whitespace-nowrap border border-slate-800">
          {statusMsg}
        </div>
      )}

      {/* ── MANUAL RESULT PANEL ─────────────────────────────────────────── */}
      {panelTab === "manual" && result && result.orderedBins.length > 0 && (
        <div className="absolute top-[4.5rem] right-4 z-[500] bg-slate-950/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden" style={{ maxWidth: 240 }}>
          <div className="bg-gradient-to-r from-cyan-700 to-emerald-700 px-4 py-2.5">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Road-Snapped Route</span>
          </div>
          <ul className="py-1 max-h-52 overflow-y-auto">
            {result.orderedBins.map((bin, idx) => (
              <li key={bin.id} className="flex items-center gap-2.5 px-3 py-1.5">
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: segmentColor(idx, result.orderedBins.length - 1), color: "#fff", fontSize: 10, fontWeight: 900, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{idx + 1}</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-200">#{bin.id} {ZONE_ICON[bin.zone]}</p>
                  <p className="text-[8px] text-slate-500 capitalize">{bin.zone} · {bin.fillLevel}% · cap {ZONE_CAP[bin.zone]}{bin.snapped ? " · 📡" : ""}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t border-slate-800 space-y-0.5">
            <p className="text-[9px] font-bold text-slate-400">{(result.totalDist / 1000).toFixed(2)} km · {Math.round(result.totalTime / 60)} min</p>
            <p className={`text-[9px] font-black ${result.uturnCount === 0 ? "text-emerald-400" : result.uturnCount <= 2 ? "text-amber-400" : "text-red-400"}`}>
              🔄 {result.uturnCount} U-turn{result.uturnCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── RADIUS SCENARIO PANEL ───────────────────────────────────────── */}
      {panelTab === "radius" && scenarios.length > 0 && (
        <div className="absolute top-[4.5rem] right-4 z-[500] bg-slate-950/97 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden" style={{ maxWidth: 295 }}>
          <div className="bg-gradient-to-r from-violet-800 to-purple-700 px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Road-Snapped Scenarios</span>
            <span className="text-[8px] font-black text-violet-200 bg-violet-900/50 px-2 py-0.5 rounded-full">{scenarios.length} tested</span>
          </div>

          {/* Capacity legend */}
          <div className="px-4 py-2 border-b border-slate-800 flex gap-4">
            {(["residential", "industrial", "commercial"] as ZoneType[]).map(z => (
              <div key={z} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ZONE_COLOR[z] }} />
                <span className="text-[8px] font-black text-slate-400">{ZONE_ICON[z]} ×{ZONE_CAP[z]}</span>
              </div>
            ))}
          </div>

          {/* HH toggle */}
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase">Households</span>
            <button onClick={() => setShowHH(v => !v)}
              className={`w-10 h-5 rounded-full relative transition-all ${showHH ? "bg-cyan-600" : "bg-slate-700"}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${showHH ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {scenarios.map((sc, idx) => (
              <div key={idx} onClick={() => setSelectedSc(idx)}
                className={`px-4 py-3 border-b border-slate-800/50 cursor-pointer transition-all ${
                  selectedSc === idx ? "bg-violet-950/50 border-l-4 border-l-violet-500" : "hover:bg-slate-900/50"
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: SC_COLORS[idx % SC_COLORS.length] }} />
                  <span className="text-[10px] font-black text-slate-200">{sc.label}</span>
                  {idx === 0 && <span className="ml-auto text-[7px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">BEST</span>}
                </div>

                <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 mb-1">
                  {[
                    ["Distance",  `${(sc.totalDist / 1000).toFixed(2)} km`,  "text-cyan-400"],
                    ["Time",      `${Math.round(sc.totalTime / 60)} min`,     "text-blue-400"],
                    ["U-Turns",   `🔄 ${sc.uturnCount}`,  sc.uturnCount === 0 ? "text-emerald-400" : sc.uturnCount <= 2 ? "text-amber-400" : "text-red-400"],
                    ["Coverage",  `${sc.coveragePct}%`,   sc.coveragePct >= 90 ? "text-emerald-400" : sc.coveragePct >= 70 ? "text-amber-400" : "text-red-400"],
                    ["Bins",      `${sc.bins.length}`,    "text-slate-300"],
                    ["Score ↓",   `${sc.score.toFixed(0)}`, idx === 0 ? "text-emerald-400" : "text-slate-500"],
                  ].map(([lbl, val, cls]) => (
                    <div key={lbl as string}>
                      <p className="text-[7px] font-bold text-slate-600 uppercase">{lbl}</p>
                      <p className={`text-[10px] font-black ${cls}`}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Zone breakdown */}
                <div className="flex gap-2 mt-1">
                  {(["residential", "industrial", "commercial"] as ZoneType[]).map(z => {
                    const cnt = sc.bins.filter(b => b.zone === z).length;
                    return cnt > 0 ? (
                      <span key={z} className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: ZONE_COLOR[z] + "30", color: ZONE_COLOR[z] }}>
                        {ZONE_ICON[z]} {cnt}
                      </span>
                    ) : null;
                  })}
                </div>

                {selectedSc === idx && (
                  <button onClick={e => { e.stopPropagation(); applyScenario(idx); }}
                    className="mt-2.5 w-full py-1.5 rounded-lg bg-violet-700 text-white text-[9px] font-black uppercase tracking-wide hover:bg-violet-600 transition-all border border-violet-500">
                    ✓ Apply to Manual Mode
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 py-2 bg-slate-900/80 border-t border-slate-800">
            <p className="text-[7px] text-slate-600 leading-relaxed">
              All bins road-snapped via Mapbox Directions · Zone auto-detected via reverse geocode<br/>
              Score = dist×0.4 + time×0.3 + uturns×10 − coverage×0.5
            </p>
          </div>
        </div>
      )}

      {/* ── MAP ─────────────────────────────────────────────────────────── */}
      <MapContainer
        center={LUPON_CENTER} zoom={17} maxZoom={22}
        doubleClickZoom={false} className="flex-1 w-full"
        style={{ cursor: clickMode !== "none" ? "crosshair" : "grab" }}
      >
        <TileLayer
          key={mapStyle}
          url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${TOKEN}`}
          maxZoom={22} maxNativeZoom={18} tileSize={512} zoomOffset={-1}
        />

        <SimMapHandlers
          mode={clickMode}
          onAddBin={addSimBin}
          onSetOrigin={(lat, lng)  => { setOriginPos([lat, lng]); setClickMode("none"); setResult(null); }}
          onSetDestination={(lat, lng) => { setDestPos([lat, lng]); setClickMode("none"); setResult(null); }}
          onSetCenter={(lat, lng)  => { setRadiusCenter([lat, lng]); setClickMode("none"); setScenarios([]); setHouseholds([]); setPreviewBins([]); }}
        />

        {/* Service area circle */}
        {panelTab === "radius" && radiusCenter && (
          <Circle center={radiusCenter} radius={radiusM}
            pathOptions={{ color: "#7c3aed", fillColor: "#7c3aed", fillOpacity: 0.05, weight: 2, dashArray: "8 5" }} />
        )}

        {/* Households colored by coverage */}
        {panelTab === "radius" && showHH && households.map((h, i) => (
          <Marker key={`hh-${i}`} position={h} icon={makeHouseholdDot(coveredHH[i] ?? false)} />
        ))}

        {/* HQ + Destination */}
        {originPos && <Marker position={originPos} icon={ORIGIN_ICON} />}
        {destPos    && <Marker position={destPos}   icon={DEST_ICON} />}

        {/* ── MANUAL: bins ── */}
        {panelTab === "manual" && simBins.map(bin => {
          const on = result?.orderedBins.findIndex(b => b.id === bin.id) ?? -1;
          return (
            <Marker key={bin.id} position={[bin.lat, bin.lng]}
              icon={makeSimBinIcon(bin, on >= 0 ? on + 1 : null)}
              eventHandlers={{ click: () => removeSimBin(bin.id) }} />
          );
        })}

        {/* ── MANUAL: route polylines ── */}
        {panelTab === "manual" && result?.legCoords.map((coords, s) =>
          coords.length >= 2 ? [
            <Polyline key={`g${s}`} positions={coords} pathOptions={{ color: segmentColor(s, result.legCoords.length - 1), weight: 18, opacity: 0.09 }} />,
            <Polyline key={`l${s}`} positions={coords} pathOptions={{ color: segmentColor(s, result.legCoords.length - 1), weight: 5, opacity: 0.95 }} />,
          ] : null
        )}

        {/* ── MANUAL: dashed preview ── */}
        {panelTab === "manual" && !result && originPos && simBins.length > 0 && (
          <Polyline
            positions={[originPos, ...simBins.map(b => [b.lat, b.lng] as [number, number]), ...(destPos ? [destPos] : [])]}
            pathOptions={{ color: "#475569", weight: 1.5, opacity: 0.5, dashArray: "6 6" }} />
        )}

        {/* ── RADIUS: preview bins (before scenario selected) ── */}
        {panelTab === "radius" && !activeSc && previewBins.map((rb, i) => (
          <Marker key={`pb-${i}`} position={rb.pos}
            icon={makeRoadBinIcon(rb, null, ZONE_COLOR[rb.zone])} />
        ))}

        {/* ── RADIUS: scenario routes ── */}
        {panelTab === "radius" && activeSc && (<>
          {/* Faded non-selected routes */}
          {scenarios.map((sc, si) =>
            si !== selectedSc
              ? sc.legCoords.map((coords, li) =>
                  coords.length >= 2
                    ? <Polyline key={`sc${si}l${li}`} positions={coords}
                        pathOptions={{ color: SC_COLORS[si % SC_COLORS.length], weight: 2, opacity: 0.15, dashArray: "5 5" }} />
                    : null
                )
              : null
          )}

          {/* Active scenario glow + line */}
          {activeSc.legCoords.map((coords, li) =>
            coords.length >= 2 ? [
              <Polyline key={`sg${li}`} positions={coords} pathOptions={{ color: SC_COLORS[selectedSc % SC_COLORS.length], weight: 20, opacity: 0.1 }} />,
              <Polyline key={`sl${li}`} positions={coords} pathOptions={{ color: SC_COLORS[selectedSc % SC_COLORS.length], weight: 5, opacity: 1 }} />,
            ] : null
          )}

          {/* Active scenario bins */}
          {activeSc.bins.map((rb, bi) => (
            <Marker key={`sb-${bi}`} position={rb.pos}
              icon={makeRoadBinIcon(rb, bi + 1, SC_COLORS[selectedSc % SC_COLORS.length])} />
          ))}
        </>)}

        {allRouteCoords.length > 1 && <FitBoundsOnResult coords={allRouteCoords} />}
      </MapContainer>

      {/* ── MANUAL BIN STRIP ────────────────────────────────────────────── */}
      {panelTab === "manual" && simBins.length > 0 && (
        <div className="absolute bottom-12 left-4 z-[500] flex gap-1.5 flex-wrap max-w-[70vw]">
          {simBins.map(bin => (
            <div key={bin.id}
              className="flex items-center gap-1.5 bg-slate-950/92 backdrop-blur-sm rounded-xl border border-slate-800 shadow-xl px-2 py-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ZONE_COLOR[bin.zone] }} />
              <span className="text-[8px] font-mono font-black text-slate-500">#{bin.id}</span>
              <input type="range" min="0" max="100" step="5" value={bin.fillLevel}
                onChange={e => updateBinFill(bin.id, +e.target.value)} className="w-12 accent-amber-400" />
              <span className={`text-[8px] font-black min-w-[22px] ${bin.fillLevel >= 80 ? "text-red-400" : bin.fillLevel >= 40 ? "text-amber-400" : "text-slate-500"}`}>
                {bin.fillLevel}%
              </span>
              {(["residential", "industrial", "commercial"] as ZoneType[]).map(z => (
                <button key={z} onClick={() => updateBinZone(bin.id, z)} title={z}
                  className={`text-[10px] transition-all ${bin.zone === z ? "opacity-100" : "opacity-25 hover:opacity-60"}`}>
                  {ZONE_ICON[z]}
                </button>
              ))}
              {bin.snapped && <span className="text-[7px] text-cyan-500" title="Road-snapped">📡</span>}
              <button onClick={() => removeSimBin(bin.id)} className="text-[8px] text-red-500 hover:text-red-400 font-black ml-0.5">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── RADIUS STATS BADGE ──────────────────────────────────────────── */}
      {panelTab === "radius" && households.length > 0 && (
        <div className="absolute bottom-12 left-4 z-[500]">
          <div className="bg-slate-950/92 backdrop-blur-sm text-[8px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full shadow-xl border border-slate-800 flex gap-3">
            <span className="text-blue-400">🏠 {households.length} HH</span>
            <span className="text-violet-400">🗑 {activeSc ? activeSc.bins.length : previewBins.length} bins</span>
            <span className="text-cyan-400">📍 {radiusM}m</span>
            <span style={{ color: ZONE_COLOR[zoneFilter] }}>{ZONE_ICON[zoneFilter]} ×{ZONE_CAP[zoneFilter]}/bin</span>
            {activeSc && <span className={activeSc.coveragePct >= 90 ? "text-emerald-400" : "text-amber-400"}>✓ {activeSc.coveragePct}% coverage</span>}
          </div>
        </div>
      )}
    </div>
  );
}