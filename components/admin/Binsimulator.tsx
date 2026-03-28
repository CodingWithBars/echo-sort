"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { LUPON_CENTER } from "@/components/map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM (copied from RoutingLayer — pure math, no Leaflet rendering)
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_SIDE_M   = 80;
const PENALTY_UTURN_M  = 250;
const PASS_THRESHOLD_M = 40;
const PASSTHROUGH_COST = 600;
const A_STAR_LIMIT     = 12;

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
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

function pointToSegmentDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const toXY = (ll: [number, number]) => [ll[1] * Math.cos((ll[0] * Math.PI) / 180) * 111_320, ll[0] * 110_540];
  const [px, py] = toXY(p); const [ax, ay] = toXY(a); const [bx, by] = toXY(b);
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  if (t < 0.05 || t > 0.95) return Infinity;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function buildHeadingAwareMatrix(nodes: [number, number][], driverHeading: number, destIdx = -1): number[][] {
  const n = nodes.length;
  const base = buildDistMatrix(nodes);
  const mat = base.map(r => [...r]);
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
        if (pointToSegmentDist(nodes[k], nodes[i], nodes[j]) < PASS_THRESHOLD_M) { cost += PASSTHROUGH_COST; break; }
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

function mstCost(indices: number[], dist: number[][]): number {
  if (indices.length <= 1) return 0;
  const inMST = new Set<number>([indices[0]]);
  let total = 0;
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
  const n = dist.length; const visited = new Set([0]); const path = [0];
  while (visited.size < n) {
    const last = path[path.length - 1];
    let best = Infinity, bestNode = -1;
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
  const pathAt = new Map<string, number[]>();
  pathAt.set("0,1", [0]);
  interface Entry { node: number; mask: number; g: number; f: number; }
  const open: Entry[] = [{ node: 0, mask: 1, g: 0, f: admissibleH(0, 1, dist, n) }];
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
        const prev = pathAt.get(`${curr.node},${curr.mask}`) ?? [0];
        pathAt.set(`${next},${newMask}`, [...prev, next]);
        open.push({ node: next, mask: newMask, g: newG, f: newG + admissibleH(next, newMask, dist, n) });
      }
    }
  }
  return nearestNeighbor(dist);
}

function segmentColor(segIndex: number, totalSegs: number): string {
  if (totalSegs === 0) return "#059669";
  const t = totalSegs === 1 ? 0 : segIndex / (totalSegs - 1);
  const h = Math.round(4 + (152 - 4) * t);
  const s = Math.round(90 + (69 - 90) * t);
  const l = Math.round(58 + (35 - 58) * t);
  return `hsl(${h},${s}%,${l}%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SimBin {
  id:        number;
  lat:       number;
  lng:       number;
  fillLevel: number; // admin sets this in simulation
}

interface SimResult {
  orderedBins:  SimBin[];
  totalDist:    number;   // metres
  totalTime:    number;   // seconds (Mapbox)
  legCoords:    [number, number][][]; // road geometry per leg
}

interface BinSimulatorProps {
  mapStyle: "satellite-streets-v12" | "navigation-night-v1" | "outdoors-v12";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP INTERACTION HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

function SimMapHandlers({
  mode,
  onAddBin,
  onSetOrigin,
  onSetDestination,
}: {
  mode:             "bin" | "origin" | "destination" | "none";
  onAddBin:         (lat: number, lng: number) => void;
  onSetOrigin:      (lat: number, lng: number) => void;
  onSetDestination: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (mode === "bin")         onAddBin(e.latlng.lat, e.latlng.lng);
      if (mode === "origin")      onSetOrigin(e.latlng.lat, e.latlng.lng);
      if (mode === "destination") onSetDestination(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

const makeSimBinIcon = (idx: number, fillLevel: number, orderNum: number | null) => {
  const urgent = fillLevel >= 80;
  const bg     = urgent ? "#dc2626" : fillLevel >= 40 ? "#f59e0b" : "#059669";
  const label  = orderNum !== null
    ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:800;font-family:sans-serif;white-space:nowrap;">→${orderNum}</div>`
    : "";
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="position:relative;">
      ${label}
      <div style="width:32px;height:32px;border-radius:50%;background:${bg};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:11px;font-weight:800;color:#fff;font-family:sans-serif;">${fillLevel}%</div>
    </div>`,
  });
};

const ORIGIN_ICON = L.divIcon({
  className: "", iconSize: [36, 36], iconAnchor: [18, 18],
  html: `<div style="width:36px;height:36px;border-radius:6px;background:#d97706;border:2.5px solid #fcd34d;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:10px;font-weight:800;color:#fff;font-family:sans-serif;">HQ</div>`,
});

const DEST_ICON = L.divIcon({
  className: "", iconSize: [36, 36], iconAnchor: [18, 36],
  html: `<div style="width:36px;height:36px;border-radius:8px 8px 2px 2px;background:#7c3aed;border:2.5px solid #c4b5fd;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:9px;font-weight:800;color:#fff;font-family:sans-serif;"><div style="font-size:14px;line-height:1;">⚑</div><div>END</div></div>`,
});

// ─────────────────────────────────────────────────────────────────────────────
// FIT BOUNDS HELPER
// ─────────────────────────────────────────────────────────────────────────────

function FitBoundsOnResult({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map(c => L.latLng(c[0], c[1])));
    map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 1.2 });
  }, [coords, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BinSimulator({ mapStyle }: BinSimulatorProps) {
  const [simBins, setSimBins]               = useState<SimBin[]>([]);
  const [originPos, setOriginPos]           = useState<[number, number] | null>(null);
  const [destPos, setDestPos]               = useState<[number, number] | null>(null);
  const [clickMode, setClickMode]           = useState<"bin" | "origin" | "destination" | "none">("none");
  const [simHeading, setSimHeading]         = useState(0);
  const [simFill, setSimFill]               = useState(50);
  const [result, setResult]                 = useState<SimResult | null>(null);
  const [running, setRunning]               = useState(false);
  const [statusMsg, setStatusMsg]           = useState("");
  const nextIdRef                           = useRef(1);
  const abortRef                            = useRef<AbortController | null>(null);

  const addSimBin = useCallback((lat: number, lng: number) => {
    setSimBins(prev => [...prev, { id: nextIdRef.current++, lat, lng, fillLevel: simFill }]);
  }, [simFill]);

  const removeSimBin = useCallback((id: number) => {
    setSimBins(prev => prev.filter(b => b.id !== id));
    setResult(null);
  }, []);

  const updateFill = useCallback((id: number, fill: number) => {
    setSimBins(prev => prev.map(b => b.id === id ? { ...b, fillLevel: fill } : b));
    setResult(null);
  }, []);

  const clearAll = () => {
    setSimBins([]); setOriginPos(null); setDestPos(null);
    setResult(null); setStatusMsg("");
    abortRef.current?.abort();
  };

  // ── RUN SIMULATION ────────────────────────────────────────────────────────
  const runSimulation = async () => {
    if (!originPos || simBins.length === 0) {
      setStatusMsg("Set an origin and at least one bin first.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setRunning(true);
    setResult(null);
    setStatusMsg("Running A* optimizer…");

    // Only include bins at or above fill threshold (same as driver mode)
    const activeBins = simBins.filter(b => b.fillLevel >= 40);
    if (activeBins.length === 0) {
      setStatusMsg("No bins at ≥40% fill. Lower threshold or increase fill levels.");
      setRunning(false);
      return;
    }

    // Build node list
    const binCoords: [number, number][] = activeBins.map(b => [b.lat, b.lng]);
    const hasDestination = !!destPos;
    const allNodes: [number, number][] = [
      originPos,
      ...binCoords,
      ...(hasDestination ? [destPos!] : []),
    ];
    const destNodeIdx = hasDestination ? allNodes.length - 1 : -1;

    // Run A*
    const dist  = buildHeadingAwareMatrix(allNodes, simHeading, destNodeIdx);
    const order = astarTSP(allNodes, dist);
    const orderedBins = order.filter(i => i !== 0 && i !== destNodeIdx).map(i => activeBins[i - 1]);

    setStatusMsg(`A* solved: ${orderedBins.length} stops. Fetching road geometry…`);

    // Waypoints for Mapbox
    const waypoints: [number, number][] = [
      originPos,
      ...orderedBins.map(b => [b.lat, b.lng] as [number, number]),
      ...(hasDestination ? [destPos!] : []),
    ];

    const TOKEN   = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const profile = "mapbox/driving-traffic";

    // Fetch each leg
    const legPromises = waypoints.slice(0, -1).map((from, s) => {
      const to            = waypoints[s + 1];
      const legBear       = s === 0 ? simHeading : bearing(from, to);
      const coords        = `${from[1]},${from[0]};${to[1]},${to[0]}`;
      const url = `https://api.mapbox.com/directions/v5/${profile}/${coords}` +
        `?geometries=geojson&overview=full` +
        `&radiuses=500;30` +
        `&bearings=${Math.round(legBear) % 360},45;0,180` +
        `&approaches=curb;curb` +
        `&exclude=ferry` +
        `&continue_straight=false` +
        `&access_token=${TOKEN}`;
      return fetch(url, { signal })
        .then(r => r.json())
        .then((d: any) => ({
          coords: (d.routes?.[0]?.geometry?.coordinates ?? []).map(
            (c: [number, number]) => [c[1], c[0]] as [number, number]
          ) as [number, number][],
          dist:     d.routes?.[0]?.distance ?? 0,
          duration: d.routes?.[0]?.duration ?? 0,
        }));
    });

    try {
      const legs = await Promise.all(legPromises);
      const totalDist = legs.reduce((s, l) => s + l.dist, 0);
      const totalTime = legs.reduce((s, l) => s + l.duration, 0);
      setResult({ orderedBins, totalDist, totalTime, legCoords: legs.map(l => l.coords) });
      setStatusMsg(`Done — ${(totalDist / 1000).toFixed(1)} km · ${Math.round(totalTime / 60)} min`);
    } catch (err: any) {
      if (err.name !== "AbortError") setStatusMsg("Route fetch failed. Check Mapbox token.");
    } finally {
      setRunning(false);
    }
  };

  // All route coords flattened for fitBounds
  const allRouteCoords: [number, number][] = result
    ? result.legCoords.flat()
    : [];

  const modeLabel: Record<typeof clickMode, string> = {
    bin:         `Tap map to place bin (fill: ${simFill}%)`,
    origin:      "Tap map to set origin / HQ",
    destination: "Tap map to set exit point",
    none:        "",
  };

  return (
    <div className="h-full w-full flex flex-col relative">

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 flex-wrap justify-center px-2">

        {/* Mode buttons */}
        {(["origin", "bin", "destination"] as const).map(m => {
          const labels = { origin: "📍 Set HQ", bin: "🗑 Add Bin", destination: "⚑ Set Exit" };
          const active = clickMode === m;
          return (
            <button
              key={m}
              onClick={() => setClickMode(active ? "none" : m)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border-2 ${
                active
                  ? "bg-violet-600 border-violet-500 text-white shadow-lg scale-105"
                  : "bg-white/90 border-white text-slate-700 shadow backdrop-blur-sm hover:bg-white"
              }`}
            >
              {labels[m]}
            </button>
          );
        })}

        {/* Fill level for new bins */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border-2 border-white rounded-xl px-3 py-1.5 shadow">
          <span className="text-[9px] font-black text-slate-400 uppercase">Fill</span>
          <input
            type="range" min="0" max="100" step="5" value={simFill}
            onChange={e => setSimFill(+e.target.value)}
            className="w-20 accent-amber-500"
          />
          <span className="text-[10px] font-black text-amber-600 min-w-[28px]">{simFill}%</span>
        </div>

        {/* Heading for origin */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border-2 border-white rounded-xl px-3 py-1.5 shadow">
          <span className="text-[9px] font-black text-slate-400 uppercase">Heading</span>
          <input
            type="range" min="0" max="359" step="5" value={simHeading}
            onChange={e => { setSimHeading(+e.target.value); setResult(null); }}
            className="w-20 accent-blue-500"
          />
          <span className="text-[10px] font-black text-blue-600 min-w-[32px]">{simHeading}°</span>
        </div>

        {/* Run */}
        <button
          onClick={runSimulation}
          disabled={running || !originPos || simBins.length === 0}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-emerald-500 text-white border-2 border-emerald-400 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-600 active:scale-95 transition-all"
        >
          {running ? "⏳ Running…" : "▶ Run A*"}
        </button>

        {/* Clear */}
        <button
          onClick={clearAll}
          className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-red-50 text-red-500 border-2 border-red-100 shadow hover:bg-red-100 active:scale-95 transition-all"
        >
          ✕ Clear
        </button>
      </div>

      {/* ── CLICK MODE HINT ──────────────────────────────────────────────── */}
      {clickMode !== "none" && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[500] bg-violet-600 text-white text-[11px] font-black uppercase tracking-wide px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {modeLabel[clickMode]}
        </div>
      )}

      {/* ── STATUS / RESULT BAR ──────────────────────────────────────────── */}
      {statusMsg && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/95 text-emerald-400 text-[10px] font-black uppercase tracking-wide px-5 py-2.5 rounded-full shadow-xl backdrop-blur-sm pointer-events-none whitespace-nowrap">
          {statusMsg}
        </div>
      )}

      {/* ── RESULT LEGEND ────────────────────────────────────────────────── */}
      {result && result.orderedBins.length > 0 && (
        <div className="absolute top-20 right-4 z-[500] bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-100 overflow-hidden" style={{ maxWidth: 210 }}>
          <div className="bg-emerald-50 px-4 py-2.5 border-b border-slate-100">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">A* Route Order</span>
          </div>
          <ul className="py-1">
            {result.orderedBins.map((bin, idx) => (
              <li key={bin.id} className="flex items-center gap-3 px-4 py-1.5">
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: segmentColor(idx, result.orderedBins.length - 1),
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0,
                }}>{idx + 1}</div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-800">Sim Bin #{bin.id}</p>
                  <p className="text-[9px] text-slate-400">{bin.fillLevel}% full</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t border-slate-100 text-[9px] font-bold text-slate-400 uppercase">
            {(result.totalDist / 1000).toFixed(1)} km · {Math.round(result.totalTime / 60)} min
          </div>
        </div>
      )}

      {/* ── MAP ──────────────────────────────────────────────────────────── */}
      <MapContainer
        center={LUPON_CENTER}
        zoom={17}
        maxZoom={22}
        doubleClickZoom={false}
        className="flex-1 w-full"
        style={{ cursor: clickMode !== "none" ? "crosshair" : "grab" }}
      >
        <TileLayer
          key={mapStyle}
          url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
          maxZoom={22}
          maxNativeZoom={18}
          tileSize={512}
          zoomOffset={-1}
        />

        <SimMapHandlers
          mode={clickMode}
          onAddBin={(lat, lng) => { addSimBin(lat, lng); setResult(null); }}
          onSetOrigin={(lat, lng) => { setOriginPos([lat, lng]); setClickMode("none"); setResult(null); }}
          onSetDestination={(lat, lng) => { setDestPos([lat, lng]); setClickMode("none"); setResult(null); }}
        />

        {/* Origin marker */}
        {originPos && <Marker position={originPos} icon={ORIGIN_ICON} />}

        {/* Destination marker */}
        {destPos && <Marker position={destPos} icon={DEST_ICON} />}

        {/* Sim bin markers */}
        {simBins.map((bin, idx) => {
          const orderNum = result?.orderedBins.findIndex(b => b.id === bin.id);
          return (
            <Marker
              key={bin.id}
              position={[bin.lat, bin.lng]}
              icon={makeSimBinIcon(idx, bin.fillLevel, orderNum !== undefined && orderNum >= 0 ? orderNum + 1 : null)}
              eventHandlers={{ click: () => removeSimBin(bin.id) }}
            />
          );
        })}

        {/* Route polylines — colored per leg */}
        {result?.legCoords.map((coords, s) => {
          if (coords.length < 2) return null;
          const color = segmentColor(s, result.legCoords.length - 1);
          return [
            <Polyline key={`glow-${s}`} positions={coords} pathOptions={{ color, weight: 14, opacity: 0.12 }} />,
            <Polyline key={`line-${s}`} positions={coords} pathOptions={{ color, weight: s === 0 ? 6 : 5, opacity: s === 0 ? 1 : 0.85 }} />,
          ];
        })}

        {/* Dashed preview connector (before running) */}
        {!result && originPos && simBins.length > 0 && (
          <Polyline
            positions={[originPos, ...simBins.map(b => [b.lat, b.lng] as [number, number]), ...(destPos ? [destPos] : [])]}
            pathOptions={{ color: "#94a3b8", weight: 1.5, opacity: 0.4, dashArray: "6 6" }}
          />
        )}

        {allRouteCoords.length > 1 && <FitBoundsOnResult coords={allRouteCoords} />}
      </MapContainer>

      {/* ── BIN LIST (bottom strip) ─────────────────────────────────────── */}
      {simBins.length > 0 && (
        <div className="absolute bottom-12 left-4 z-[500] flex gap-2 flex-wrap max-w-[60vw]">
          {simBins.map(bin => (
            <div key={bin.id} className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-100 shadow px-2 py-1">
              <span className="text-[9px] font-black text-slate-500">#{bin.id}</span>
              <input
                type="range" min="0" max="100" step="5"
                value={bin.fillLevel}
                onChange={e => updateFill(bin.id, +e.target.value)}
                className="w-16 accent-amber-500"
              />
              <span className={`text-[9px] font-black min-w-[24px] ${bin.fillLevel >= 80 ? "text-red-500" : bin.fillLevel >= 40 ? "text-amber-500" : "text-slate-400"}`}>
                {bin.fillLevel}%
              </span>
              <button onClick={() => removeSimBin(bin.id)} className="text-[9px] text-red-400 hover:text-red-600 font-black">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}