"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/admin/BinPlacementSimulator.tsx
//
// Bin placement & route simulation tool — Admin / LGU scope.
//
// Scope rules:
//   • Admin profile MUST have municipality + barangay (from lgu_details or
//     profiles.role = ADMIN with a municipality stored in lgu_details).
//   • Existing bins shown are filtered by municipality match in device_id prefix
//     (SIM-MUNICIPALITY-...) OR all bins within 15 km of the admin's area center.
//   • Saved bins are tagged with the admin's municipality in device_id.
//
// Workflow:
//   1. Drop bin markers on map (draggable to reposition)
//   2. Configure: name, bin type, vehicle type, capacity, fill level, notes
//   3. Set HQ / Start position (truck depot or barangay hall)
//   4. Set Exit / End position (optional — disposal site or return depot)
//   5. Simulate Route — A* TSP with heading-aware cost matrix,
//      real road geometry from Mapbox Directions API
//   6. Review route summary (distance, time, stop order, fuel estimate)
//   7. Save → writes bins to `bins` table + route to `collection_schedules`
//      Discard → clears session without DB writes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import Map, { Marker, Source, Layer, MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Plus, Trash2, Save, X, MapPin, Truck, Route,
  RotateCcw, CheckCircle2, AlertTriangle, Eye, EyeOff,
  Settings, Flag, Navigation, Info, Building2, Bell, Link2, ChevronRight
} from "lucide-react";

const supabase  = createClient();
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// ─────────────────────────────────────────────────────────────────────────────
// MAP STYLE
// ─────────────────────────────────────────────────────────────────────────────

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm": {
      type: "raster",
      tiles: [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`],
      tileSize: 512,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BIN_TYPES = [
  { value: "standard",   label: "Standard Bin",      icon: "🗑️", desc: "General household waste" },
  { value: "segregated", label: "Segregated Bin",    icon: "♻️", desc: "Biodegradable / Non-bio split" },
  { value: "hazardous",  label: "Hazardous Bin",     icon: "⚠️", desc: "Chemical / medical waste" },
  { value: "bulk",       label: "Bulk / Skip Bin",   icon: "📦", desc: "Large items, construction waste" },
  { value: "compost",    label: "Compost Bin",        icon: "🌿", desc: "Organic / garden waste" },
  { value: "e-waste",    label: "E-Waste Bin",        icon: "💻", desc: "Electronics, batteries" },
];

const VEHICLE_TYPES = [
  { value: "dump_truck",  label: "Dump Truck",         capacity: 8000,  icon: "🚛", avgSpeedKph: 35 },
  { value: "compactor",   label: "Compactor Truck",    capacity: 12000, icon: "🚚", avgSpeedKph: 30 },
  { value: "open_truck",  label: "Open Truck",         capacity: 5000,  icon: "🛻", avgSpeedKph: 40 },
  { value: "utility",     label: "Utility Vehicle",    capacity: 2000,  icon: "🚐", avgSpeedKph: 45 },
  { value: "motorcycle",  label: "Motorcycle w/ Cart", capacity: 200,   icon: "🏍️", avgSpeedKph: 40 },
  { value: "trike",       label: "Trike",              capacity: 500,   icon: "🛺", avgSpeedKph: 25 },
];

const CAPACITY_OPTIONS = [
  { value: 50,   label: "50 L  — Small (household)" },
  { value: 120,  label: "120 L — Medium (residential)" },
  { value: 240,  label: "240 L — Large (commercial)" },
  { value: 660,  label: "660 L — Wheelie Bin (communal)" },
  { value: 1100, label: "1,100 L — Skip Bin (bulk)" },
  { value: 3000, label: "3,000 L — Dumpster (industrial)" },
];

const FUEL_LPER100KM: Record<string, number> = {
  dump_truck: 30, compactor: 35, open_truck: 25,
  utility: 12, motorcycle: 4, trike: 6,
};

const FILL_COLOR = (pct: number) =>
  pct >= 90 ? "#ef4444" : pct >= 70 ? "#f97316" : pct >= 40 ? "#eab308" : "#1c4532";

const THEME = {
  primary: "#1c4532",
  primaryLight: "#e6f0eb",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  surface: "#ffffff",
  bg: "#f8fafc",
  routeColors: ["#ef4444", "#f97316", "#eab308", "#22c55e"]
};


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AdminProfile {
  id:           string;
  full_name:    string;
  role:         string;
  municipality: string | null;
  barangay:     string | null;
  /** Representative lat/lng of this admin's area — used for bin scoping */
  areaLat:      number | null;
  areaLng:      number | null;
}

interface ExistingBin {
  id:            number;
  device_id:     string;
  name:          string;
  lat:           number;
  lng:           number;
  fill_level:    number;
  battery_level: number;
  municipality:  string | null;
  barangay:      string | null;
}

interface PendingBin {
  tempId:        string;
  name:          string;
  lat:           number;
  lng:           number;
  bin_type:      string;
  vehicle_type:  string;
  capacity_l:    number;
  notes:         string;
  fill_level:    number;
  routeOrder?:   number;
}

interface SimRoute {
  binOrder:      string[];
  orderedCoords: [number, number][];
  distKm:        number;
  durationMin:   number;
  fuelL:         number;
  vehicleType:   string;
  geojson:       GeoJSON.FeatureCollection<GeoJSON.LineString> | null;
  hasStart:      boolean;
  hasExit:       boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING — A* TSP (heading-aware, identical to RoutingLayerGL)
// ─────────────────────────────────────────────────────────────────────────────

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
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

function uturnPenalty(from: [number, number], to: [number, number], heading: number): number {
  const turn = angleDiff(heading, bearing(from, to));
  if (turn <= 60)  return 0;
  if (turn <= 120) return 80;
  return 250;
}

function buildDistMatrix(nodes: [number, number][]): number[][] {
  return nodes.map(a => nodes.map(b => haversine(a, b)));
}

function buildHeadingAwareMatrix(
  nodes: [number, number][], startHeading: number, destIdx = -1
): number[][] {
  const n = nodes.length;
  const base = buildDistMatrix(nodes);
  const mat  = base.map(r => [...r]);
  for (let j = 1; j < n; j++) {
    if (j === destIdx) continue;
    mat[0][j] = base[0][j] + uturnPenalty(nodes[0], nodes[j], startHeading);
  }
  for (let i = 1; i < n; i++) {
    if (i === destIdx) continue;
    const arrHeading = bearing(nodes[0], nodes[i]);
    for (let j = 1; j < n; j++) {
      if (i === j || j === destIdx) continue;
      mat[i][j] = base[i][j] + uturnPenalty(nodes[i], nodes[j], arrHeading);
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
  const inMST = new Set([indices[0]]); let total = 0;
  while (inMST.size < indices.length) {
    let best = Infinity, bestNode = -1;
    for (const u of inMST)
      for (const v of indices)
        if (!inMST.has(v) && dist[u][v] < best) { best = dist[u][v]; bestNode = v; }
    if (bestNode < 0) break;
    inMST.add(bestNode); total += best;
  }
  return total;
}

function admissibleH(cur: number, mask: number, dist: number[][], n: number): number {
  const unvisited = Array.from({ length: n }, (_, i) => i + 1).filter(i => !(mask & (1 << i)));
  if (unvisited.length === 0) return 0;
  return Math.min(...unvisited.map(v => dist[cur][v])) + mstCost(unvisited, dist);
}

function nearestNeighbor(dist: number[][]): number[] {
  const n = dist.length; const visited = new Set([0]); const path = [0];
  while (visited.size < n) {
    const last = path[path.length - 1]; let best = Infinity, bestIdx = -1;
    for (let j = 1; j < n; j++)
      if (!visited.has(j) && dist[last][j] < best) { best = dist[last][j]; bestIdx = j; }
    if (bestIdx < 0) break;
    visited.add(bestIdx); path.push(bestIdx);
  }
  return path;
}

const A_STAR_LIMIT = 12;

function astarTSP(nodes: [number, number][], dist: number[][], destIdx = -1): number[] {
  const n = nodes.length;
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];

  const binIndices = Array.from({ length: destIdx > 0 ? destIdx - 1 : n - 1 }, (_, i) => i + 1);
  if (n > A_STAR_LIMIT) {
    const path = nearestNeighbor(dist);
    return path;
  }

  const allBinsMask = binIndices.reduce((m, i) => m | (1 << i), 1 as number);
  const allVisited  = destIdx > 0 ? allBinsMask | (1 << destIdx) : (1 << n) - 1;

  type AStarEntry = { node: number; mask: number; g: number; f: number };
  // Use plain objects instead of Map — avoids TSX angle-bracket parsing issues
  const gCost:  Record<string, number>   = { "0,1": 0 };
  const pathAt: Record<string, number[]> = { "0,1": [0] };
  const open: AStarEntry[] = [{ node: 0, mask: 1, g: 0, f: admissibleH(0, 1, dist, n) }];

  while (open.length > 0) {
    let mi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[mi].f) mi = i;
    const curr = open.splice(mi, 1)[0];
    const key  = `${curr.node},${curr.mask}`;

    if (curr.mask === allVisited) return pathAt[key] ?? nearestNeighbor(dist);
    if (curr.g > (gCost[key] ?? Infinity)) continue;

    const allBinsVisited = (curr.mask & allBinsMask) === allBinsMask;
    const candidates = destIdx > 0 && allBinsVisited
      ? [destIdx]
      : binIndices.filter(i => !(curr.mask & (1 << i)));

    for (const next of candidates) {
      const newMask = curr.mask | (1 << next);
      const newG    = curr.g + dist[curr.node][next];
      const nKey    = `${next},${newMask}`;
      if (newG < (gCost[nKey] ?? Infinity)) {
        gCost[nKey] = newG;
        const h    = (destIdx > 0 && allBinsVisited) ? 0 : admissibleH(next, newMask, dist, n);
        pathAt[nKey] = [...(pathAt[key] ?? [0]), next];
        open.push({ node: next, mask: newMask, g: newG, f: newG + h });
      }
    }
  }
  return nearestNeighbor(dist);
}

// ─────────────────────────────────────────────────────────────────────────────
// BIN CONFIG MODAL
// ─────────────────────────────────────────────────────────────────────────────

function BinConfigModal({ bin, onUpdate, onRemove, onClose }: {
  bin: PendingBin;
  onUpdate: (id: string, p: Partial<PendingBin>) => void;
  onRemove: (id: string) => void;
  onClose:  () => void;
}) {
  const [f, setF] = useState({ ...bin });
  const set = (k: keyof PendingBin, v: any) => setF(p => ({ ...p, [k]: v }));

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.6)", backdropFilter:"blur(5px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, width:"100%", maxWidth:460, boxShadow:"0 24px 80px rgba(0,0,0,.3)", overflow:"hidden", fontFamily:"sans-serif" }}>

        {/* Header */}
        <div style={{ background:"#0f172a", padding:"18px 22px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".1em", textTransform:"uppercase", margin:"0 0 3px" }}>Configure Bin</p>
            <p style={{ fontSize:13, fontWeight:700, color:"#94a3b8", margin:0 }}>
              {f.lat.toFixed(5)}, {f.lng.toFixed(5)}
            </p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.1)", border:"none", borderRadius:9, width:34, height:34, cursor:"pointer", color:"#94a3b8", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        <div style={{ padding:"18px 22px", display:"flex", flexDirection:"column", gap:14, maxHeight:"70vh", overflowY:"auto" }}>

          {/* Name */}
          <div>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:6 }}>Station Name</label>
            <input value={f.name} onChange={e => set("name", e.target.value)}
              placeholder="e.g. Purok 3 Frontage Bin"
              style={{ width:"100%", padding:"9px 11px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Bin Type */}
          <div>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:8 }}>Bin / Dumpster Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              {BIN_TYPES.map(t => (
                <button key={t.value} onClick={() => set("bin_type", t.value)} style={{
                  padding:"9px 11px", borderRadius:11, border:`2px solid ${f.bin_type === t.value ? "#059669":"#e2e8f0"}`,
                  background: f.bin_type === t.value ? "#f0fdf4" : "#fff",
                  cursor:"pointer", textAlign:"left", transition:"all .13s",
                }}>
                  <div style={{ fontSize:15, marginBottom:2 }}>{t.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color: f.bin_type === t.value ? "#059669":"#334155" }}>{t.label}</div>
                  <div style={{ fontSize:9, color:"#94a3b8", marginTop:1 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Type */}
          <div>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:8 }}>
              Compatible Vehicle
              <span style={{ marginLeft:5, fontSize:9, color:"#94a3b8", fontWeight:600 }}>affects driver assignment</span>
            </label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              {VEHICLE_TYPES.map(t => (
                <button key={t.value} onClick={() => set("vehicle_type", t.value)} style={{
                  padding:"9px 11px", borderRadius:11, border:`2px solid ${f.vehicle_type === t.value ? "#2563eb":"#e2e8f0"}`,
                  background: f.vehicle_type === t.value ? "#eff6ff" : "#fff",
                  cursor:"pointer", textAlign:"left", transition:"all .13s",
                }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:14 }}>{t.icon}</span>
                    <span style={{ fontSize:9, color:"#64748b", fontWeight:700 }}>{t.capacity >= 1000 ? (t.capacity/1000).toFixed(0)+"t" : t.capacity+"kg"}</span>
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color: f.vehicle_type === t.value ? "#2563eb":"#334155" }}>{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:8 }}>Bin Capacity</label>
            {CAPACITY_OPTIONS.map(c => (
              <button key={c.value} onClick={() => set("capacity_l", c.value)} style={{
                display:"block", width:"100%", padding:"8px 12px", borderRadius:9, marginBottom:5,
                border:`2px solid ${f.capacity_l === c.value ? "#7c3aed":"#e2e8f0"}`,
                background: f.capacity_l === c.value ? "#f5f3ff" : "#fff",
                cursor:"pointer", textAlign:"left", fontSize:12, fontWeight:600,
                color: f.capacity_l === c.value ? "#7c3aed":"#334155", transition:"all .13s",
              }}>{c.label}</button>
            ))}
          </div>

          {/* Fill level */}
          <div>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:8 }}>
              Initial Fill — <span style={{ color: FILL_COLOR(f.fill_level), fontWeight:900 }}>{f.fill_level}%</span>
            </label>
            <input type="range" min={0} max={100} value={f.fill_level}
              onChange={e => set("fill_level", Number(e.target.value))}
              style={{ width:"100%", accentColor: FILL_COLOR(f.fill_level) }} />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:6 }}>Placement Notes</label>
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)}
              placeholder="e.g. Near purok 3 entrance, accessible from main road..."
              rows={2}
              style={{ width:"100%", padding:"9px 11px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:12, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
          </div>
        </div>

        <div style={{ padding:"14px 22px", borderTop:"1px solid #f1f5f9", display:"flex", gap:9 }}>
          <button onClick={() => { onRemove(f.tempId); onClose(); }} style={{ padding:"10px 14px", borderRadius:11, background:"#fef2f2", border:"1.5px solid #fecaca", color:"#dc2626", fontWeight:800, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
            <Trash2 size={13} /> Remove
          </button>
          <button onClick={() => { onUpdate(f.tempId, f); onClose(); }} style={{ flex:1, padding:"10px 14px", borderRadius:11, background:"#059669", border:"none", color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            <CheckCircle2 size={13} /> Apply Config
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ROUTE SUMMARY PANEL ───────────────────────────────────────────────────────

function RouteSummaryPanel({ route, bins, adminProfile, onSave, onDiscard, saving, onToggle, isHidden }: {
  route:        SimRoute;
  bins:         PendingBin[];
  adminProfile: AdminProfile | null;
  onSave:       () => void;
  onDiscard:    () => void;
  saving:       boolean;
  onToggle:     () => void;
  isHidden:     boolean;
}) {
  const orderedBins = route.binOrder
    .map(id => bins.find(b => b.tempId === id))
    .filter(Boolean) as PendingBin[];

  const totalCap = orderedBins.reduce((s, b) => s + b.capacity_l, 0);
  const vt = VEHICLE_TYPES.find(t => t.value === route.vehicleType);

  if (isHidden) {
    return (
      <button onClick={onToggle} style={{
        position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)",
        zIndex:1200, padding:"12px 24px", borderRadius:25, background:THEME.primary,
        color:"#fff", border:"none", fontWeight:900, fontSize:14, cursor:"pointer",
        boxShadow:"0 10px 30px rgba(0,0,0,0.3)", display:"flex", alignItems:"center", gap:8
      }}>
        <Eye size={18} /> Show Simulation Results
      </button>
    );
  }

  return (
    <div style={{
      position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)",
      zIndex:1200, width:"min(580px, calc(100vw - 32px))",
      background:"#fff", borderRadius:22, boxShadow:"0 8px 40px rgba(0,0,0,.22)",
      fontFamily:"sans-serif", overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{ background:"#059669", padding:"13px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🗺️</span>
          <div>
            <p style={{ fontSize:9, fontWeight:800, color:"rgba(255,255,255,.65)", letterSpacing:".1em", textTransform:"uppercase", margin:0 }}>
              A* Optimized Route · {route.hasStart ? "HQ →" : ""} {orderedBins.length} stops {route.hasExit ? "→ Exit" : ""}
            </p>
            <p style={{ fontSize:14, fontWeight:800, color:"#fff", margin:0 }}>
              {route.distKm.toFixed(1)} km · ~{route.durationMin} min · ~{route.fuelL.toFixed(1)} L fuel {vt ? `(${vt.icon} ${vt.label})` : ""}
            </p>
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onToggle} style={{ background:"rgba(255,255,255,.2)", border:"none", borderRadius:8, color:"#fff", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <EyeOff size={16} />
          </button>
          <button onClick={onDiscard} style={{ background:"rgba(255,255,255,.2)", border:"none", borderRadius:8, color:"#fff", padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Discard
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:"1px solid #f1f5f9" }}>
        {[
          { label:"Stops",     value: orderedBins.length,           icon:"📍" },
          { label:"Distance",  value: `${route.distKm.toFixed(1)} km`, icon:"🛣️" },
          { label:"Est. Time", value: `${route.durationMin} min`,   icon:"⏱️" },
          { label:"Fuel Est.", value: `${route.fuelL.toFixed(1)} L`, icon:"⛽" },
        ].map(s => (
          <div key={s.label} style={{ padding:"11px 8px", textAlign:"center", borderRight:"1px solid #f1f5f9" }}>
            <div style={{ fontSize:15, marginBottom:2 }}>{s.icon}</div>
            <div style={{ fontSize:15, fontWeight:900, color:"#0f172a" }}>{s.value}</div>
            <div style={{ fontSize:9, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".05em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Jurisdiction badge */}
      {(adminProfile?.municipality || adminProfile?.barangay) && (
        <div style={{ padding:"7px 18px", background:"#f0fdf4", borderBottom:"1px solid #dcfce7", display:"flex", alignItems:"center", gap:8 }}>
          <Building2 size={12} color="#059669" />
          <span style={{ fontSize:11, color:"#059669", fontWeight:700 }}>
            Jurisdiction: {[adminProfile?.barangay, adminProfile?.municipality].filter(Boolean).join(", ")}
          </span>
        </div>
      )}

      {/* Stop list */}
      <div style={{ padding:"11px 18px", maxHeight:150, overflowY:"auto" }}>
        <p style={{ fontSize:9, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".1em", margin:"0 0 7px" }}>Stop Order</p>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {orderedBins.map((bin, idx) => {
            const bt = BIN_TYPES.find(t => t.value === bin.bin_type);
            const veh = VEHICLE_TYPES.find(t => t.value === bin.vehicle_type);
            return (
              <div key={bin.tempId} style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 10px", borderRadius:9, background:"#f8fafc" }}>
                <div style={{ width:21, height:21, borderRadius:"50%", background:"#059669", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, flexShrink:0 }}>{idx + 1}</div>
                <span style={{ fontSize:12 }}>{bt?.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:12, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bin.name || `Bin ${idx + 1}`}</p>
                  <p style={{ margin:0, fontSize:9, color:"#64748b" }}>{bt?.label} · {bin.capacity_l}L · {veh?.icon} {veh?.label} · {bin.fill_level}% fill</p>
                </div>
                <div style={{ width:28, height:4, borderRadius:3, background:"#e2e8f0", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${bin.fill_level}%`, background: FILL_COLOR(bin.fill_level) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Capacity warning */}
      {totalCap > 0 && vt && totalCap > vt.capacity && (
        <div style={{ padding:"7px 18px", background:"#fef2f2", borderTop:"1px solid #fecaca" }}>
          <p style={{ margin:0, fontSize:10, color:"#dc2626", fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
            <AlertTriangle size={11} /> Total bin capacity ({totalCap.toLocaleString()} L) exceeds vehicle capacity ({vt.capacity.toLocaleString()} kg). Consider splitting into multiple routes.
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:"13px 18px", display:"flex", gap:9, borderTop:"1px solid #f1f5f9" }}>
        <button onClick={onDiscard} style={{ flex:1, padding:"10px", borderRadius:11, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontWeight:800, fontSize:12, cursor:"pointer" }}>
          Discard & Re-place
        </button>
        <button onClick={onSave} disabled={saving} style={{ flex:2, padding:"10px", borderRadius:11, background: saving ? "#94a3b8" : "#059669", border:"none", color:"#fff", fontWeight:800, fontSize:12, cursor: saving ? "not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {saving
            ? <><RotateCcw size={13} style={{ animation:"spin .7s linear infinite" }} /> Saving…</>
            : <><Save size={13} /> Save Bins + Route to Database</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type PlaceMode = "bin" | "start" | "exit" | null;

export default function BinPlacementSimulator() {
  const mapRef               = useRef<MapRef>(null);
  const [mapLoaded,          setMapLoaded]          = useState(false);
  const [adminProfile,       setAdminProfile]       = useState<AdminProfile | null>(null);

  // Existing DB bins (scoped to admin municipality)
  const [existingBins,       setExistingBins]       = useState<ExistingBin[]>([]);
  const [showExisting,       setShowExisting]       = useState(true);

  // Session state
  const [pendingBins,        setPendingBins]        = useState<PendingBin[]>([]);
  const [selectedBin,        setSelectedBin]        = useState<PendingBin | null>(null);
  const [startPos,           setStartPos]           = useState<[number, number] | null>(null); // HQ / depot
  const [exitPos,            setExitPos]            = useState<[number, number] | null>(null); // disposal site
  const [placeMode,          setPlaceMode]          = useState<PlaceMode>(null);
  const [defaultVehicle,     setDefaultVehicle]     = useState("dump_truck");

  // Simulation
  const [simRoute,           setSimRoute]           = useState<SimRoute | null>(null);
  const [simming,            setSimming]            = useState(false);

  // Save
  const [saving,             setSaving]             = useState(false);
  const [saveOk,             setSaveOk]             = useState(false);

  const [zoom,               setZoom]               = useState(14);
  const [showMobileSidebar,  setShowMobileSidebar]  = useState(false);
  const [showRoutePanel,     setShowRoutePanel]     = useState(true);

  // ── Load admin profile ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .single();

      // Municipality + barangay — check lgu_details (safe: use limit(1))
      const { data: lguRows } = await supabase
        .from("lgu_details")
        .select("municipality,barangay")
        .eq("id", user.id)
        .limit(1);

      const lgu = lguRows?.[0];

      // Geocode municipality/barangay to get area center for bin scoping
      let areaLat: number | null = null;
      let areaLng: number | null = null;
      const geoQuery = [lgu?.barangay, lgu?.municipality, "Philippines"].filter(Boolean).join(", ");
      try {
        const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(geoQuery)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        const center = geoData.features?.[0]?.center;
        if (center) { areaLng = center[0]; areaLat = center[1]; }
      } catch (_) {}

      const ap: AdminProfile = {
        id:           user.id,
        full_name:    profile?.full_name ?? "Admin",
        role:         profile?.role ?? "ADMIN",
        municipality: lgu?.municipality ?? null,
        barangay:     lgu?.barangay ?? null,
        areaLat,
        areaLng,
      };
      setAdminProfile(ap);

      // Center map on admin area
      if (areaLat && areaLng && mapRef.current) {
        mapRef.current.flyTo({ center: [areaLng, areaLat], zoom: 14, duration: 1500 });
      }

      // Load existing bins — all bins, then scope client-side by proximity (15 km radius)
      // Bins table has no municipality column so we use spatial proximity.
      // Fetch bins scoped to admin's municipality (column-based, not proximity)
      const binQuery = supabase
        .from("bins")
        .select("id,device_id,name,lat,lng,fill_level,battery_level,municipality,barangay");
      const { data: bins } = ap.municipality
        ? await binQuery.eq("municipality", ap.municipality)
        : await binQuery;

      const allBins: ExistingBin[] = bins ?? [];
      // Scope: if admin has an area center, show bins within 15 km; else show all
      const scoped = (areaLat && areaLng)
        ? allBins.filter(b => haversine([areaLat!, areaLng!], [b.lat, b.lng]) <= 15_000)
        : allBins;

      setExistingBins(scoped);

      // Set default map center if no geocoded area
      if (!areaLat && !areaLng && mapRef.current) {
        if (allBins.length > 0) {
          const avgLat = allBins.reduce((s, b) => s + b.lat, 0) / allBins.length;
          const avgLng = allBins.reduce((s, b) => s + b.lng, 0) / allBins.length;
          mapRef.current.flyTo({ center: [avgLng, avgLat], zoom: 14, duration: 1500 });
        }
      }
    })();
  }, []);

  // ── Map click ─────────────────────────────────────────────────────────────
  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    const { lat, lng } = e.lngLat;
    if (placeMode === "start") {
      setStartPos([lat, lng]);
      setPlaceMode(null);
      setSimRoute(null);
    } else if (placeMode === "exit") {
      setExitPos([lat, lng]);
      setPlaceMode(null);
      setSimRoute(null);
    } else if (placeMode === "bin") {
      const nb: PendingBin = {
        tempId:       crypto.randomUUID(),
        name:         "",
        lat, lng,
        bin_type:     "standard",
        vehicle_type: defaultVehicle,
        capacity_l:   120,
        notes:        "",
        fill_level:   0,
      };
      setPendingBins(prev => [...prev, nb]);
      setSelectedBin(nb);
      setPlaceMode(null);
      setSimRoute(null);
    }
  }, [placeMode, defaultVehicle]);

  const updateBin = (id: string, p: Partial<PendingBin>) => {
    setPendingBins(prev => prev.map(b => b.tempId === id ? { ...b, ...p } : b));
    setSimRoute(null);
  };
  const removeBin = (id: string) => {
    setPendingBins(prev => prev.filter(b => b.tempId !== id));
    setSimRoute(null);
  };
  const discardAll = () => { setPendingBins([]); setSimRoute(null); setStartPos(null); setExitPos(null); };

  // ── Simulate Route ────────────────────────────────────────────────────────
  const simulateRoute = async () => {
    if (pendingBins.length === 0) return;
    setSimming(true);
    setSimRoute(null);
    setShowRoutePanel(true);

    const hasStart = !!startPos;
    const hasExit  = !!exitPos;
    const vt = VEHICLE_TYPES.find(t => t.value === defaultVehicle)!;

    // Build nodes: [start?, ...bins, exit?]
    const depotPos: [number, number] = startPos ?? [pendingBins[0].lat, pendingBins[0].lng];
    const binCoords: [number, number][] = pendingBins.map(b => [b.lat, b.lng]);
    const hasD = hasExit && !!exitPos;

    const allNodes: [number, number][] = [
      depotPos,
      ...binCoords,
      ...(hasD ? [exitPos!] : []),
    ];
    const destIdx = hasD ? allNodes.length - 1 : -1;

    // Heading from start position (default North if no start)
    const startHeading = 0;
    const dist = buildHeadingAwareMatrix(allNodes, startHeading, destIdx);
    const orderIndices = astarTSP(allNodes, dist, destIdx);

    const binIndices = orderIndices.filter(i => i !== 0 && i !== (hasD ? allNodes.length - 1 : -1));
    const orderedBinCoords = binIndices.map(i => binCoords[i - 1]);
    const orderedIds       = binIndices.map(i => pendingBins[i - 1].tempId);

    // Full route: depot → ordered bins → exit
    const routeWaypoints: [number, number][] = [
      depotPos,
      ...orderedBinCoords,
      ...(hasD ? [exitPos!] : []),
    ];

    // Fetch road geometry
    let geojson: GeoJSON.Feature<GeoJSON.LineString> | null = null;
    let routeDist    = 0;
    let routeDuration = 0;

    try {
      const wps = routeWaypoints.map(p => `${p[1]},${p[0]}`).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${wps}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const data = await (await fetch(url)).json();
      if (data.routes?.[0]) {
        routeDist     = data.routes[0].distance;
        routeDuration = data.routes[0].duration;
        geojson = { type:"Feature", properties:{}, geometry: data.routes[0].geometry };
      }
    } catch (_) {
      routeDist = routeWaypoints.reduce((s, p, i) =>
        i === 0 ? s : s + haversine(routeWaypoints[i - 1], p), 0);
      geojson = {
        type:"Feature", properties:{},
        geometry: { type:"LineString", coordinates: routeWaypoints.map(p => [p[1], p[0]]) },
      };
    }

    const distKm     = routeDist / 1000;
    const durationMin = Math.round(routeDuration / 60) || Math.round(distKm / (vt.avgSpeedKph / 60));
    const fuelLper100 = FUEL_LPER100KM[defaultVehicle] ?? 20;
    const fuelL      = (distKm / 100) * fuelLper100;

    // Label pending bins with route order
    setPendingBins(prev => prev.map(b => {
      const idx = orderedIds.indexOf(b.tempId);
      return { ...b, routeOrder: idx >= 0 ? idx + 1 : undefined };
    }));

    // Build multi-colored segments
    // Red -> Orange -> Yellow -> Green
    const segmentFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const fullCoords = geojson?.geometry.coordinates || [];
    
    if (fullCoords.length > 1) {
      const numSegments = routeWaypoints.length - 1;
      const legPoints = routeWaypoints.map(p => [p[1], p[0]]); // [lng, lat]
      
      // Find closest indices in fullCoords for each waypoint to split the line
      let lastIdx = 0;
      for (let i = 0; i < numSegments; i++) {
        const nextTarget = legPoints[i + 1];
        let bestIdx = lastIdx + 1;
        let minDist = Infinity;
        
        // Search ahead for the next waypoint in the coordinate stream
        for (let j = lastIdx + 1; j < fullCoords.length; j++) {
          const d = Math.sqrt((fullCoords[j][0] - nextTarget[0])**2 + (fullCoords[j][1] - nextTarget[1])**2);
          if (d < minDist) { minDist = d; bestIdx = j; }
          // Optimization: if we start getting further away, we likely found the closest point
          if (d > minDist && d > 0.001) break; 
        }

        const segmentCoords = fullCoords.slice(lastIdx, bestIdx + 1);
        if (segmentCoords.length > 1) {
          const colorIdx = Math.min(i, THEME.routeColors.length - 1);
          // Scale colors across segments if more segments than colors
          const scaledIdx = Math.floor((i / numSegments) * THEME.routeColors.length);
          const segmentColor = THEME.routeColors[Math.min(scaledIdx, THEME.routeColors.length - 1)];

          segmentFeatures.push({
            type: "Feature",
            properties: { color: segmentColor },
            geometry: { type: "LineString", coordinates: segmentCoords }
          });
        }
        lastIdx = bestIdx;
      }
    }

    setSimRoute({
      binOrder:      orderedIds,
      orderedCoords: orderedBinCoords,
      distKm, durationMin, fuelL,
      vehicleType:   defaultVehicle,
      geojson:       { type: "FeatureCollection", features: segmentFeatures },
      hasStart, hasExit,
    });

    // Fit map
    if (mapRef.current && routeWaypoints.length > 1) {
      const lngs = routeWaypoints.map(p => p[1]);
      const lats = routeWaypoints.map(p => p[0]);
      mapRef.current.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 120, duration: 1200 }
      );
    }

    setSimming(false);
  };

  // ── Save to DB ────────────────────────────────────────────────────────────
  const saveBins = async () => {
    if (!simRoute || pendingBins.length === 0) return;
    setSaving(true);

    const timestamp = Date.now();
    const muni = adminProfile?.municipality?.toUpperCase().replace(/\s/g, "") ?? "BIN";

    // 1. Insert bins — include municipality + barangay for jurisdiction scoping
    const binInserts = pendingBins.map((b, i) => ({
      device_id:    `SIM-${muni}-${timestamp}-${i}`,
      name:         b.name || `Bin ${i + 1} (${BIN_TYPES.find(t => t.value === b.bin_type)?.label ?? b.bin_type})`,
      lat:          b.lat,
      lng:          b.lng,
      fill_level:   b.fill_level,
      battery_level:100,
      municipality: adminProfile?.municipality ?? null,
      barangay:     adminProfile?.barangay     ?? null,
    }));

    const { data: savedBins, error: binErr } = await supabase.from("bins").insert(binInserts).select("id");
    if (binErr) { alert(`Bin save failed: ${binErr.message}`); setSaving(false); return; }

    // 2. Save route as a collection_schedule (for driver assignment + future reuse)
    const orderedBinIds = simRoute.binOrder
      .map(id => {
        const idx = pendingBins.findIndex(b => b.tempId === id);
        return savedBins?.[idx]?.id?.toString() ?? null;
      })
      .filter(Boolean) as string[];

    const vt = VEHICLE_TYPES.find(t => t.value === simRoute.vehicleType);
    const wasteTypes = [...new Set(pendingBins.map(b => {
      const bt = BIN_TYPES.find(t => t.value === b.bin_type);
      return bt?.label ?? "General";
    }))];

    await supabase.from("collection_schedules").insert({
      created_by:             adminProfile!.id,
      barangay:               adminProfile?.barangay ?? "Unknown",
      municipality:           adminProfile?.municipality ?? null,
      label:                  `Simulated Route — ${new Date().toLocaleDateString("en-PH")} (${muni})`,
      waste_types:            wasteTypes,
      is_active:              true,
      vehicle_type:           vt?.label ?? simRoute.vehicleType,
      collection_area:        adminProfile?.barangay ?? null,
      bin_ids:                orderedBinIds,
      estimated_distance_km:  Math.round(simRoute.distKm * 10) / 10,
      estimated_duration_min: simRoute.durationMin,
      notes:                  `Auto-generated from Bin Placement Simulator. Fuel est: ${simRoute.fuelL.toFixed(1)} L. Start: ${startPos ? `${startPos[0].toFixed(5)},${startPos[1].toFixed(5)}` : "none"}. Exit: ${exitPos ? `${exitPos[0].toFixed(5)},${exitPos[1].toFixed(5)}` : "none"}.`,
    });

    // 3. Audit log
    await supabase.from("audit_logs").insert({
      admin_id:    adminProfile!.id,
      action_type: "BIN_PLACEMENT_SAVE",
      target_id:   `SIM-${timestamp}`,
      reason:      `Saved ${binInserts.length} bins + route (${simRoute.distKm.toFixed(1)} km, ${simRoute.durationMin} min). Municipality: ${adminProfile?.municipality ?? "N/A"}, Barangay: ${adminProfile?.barangay ?? "N/A"}.`,
      metadata: {
        bins:  pendingBins.map(b => ({ name:b.name, lat:b.lat, lng:b.lng, bin_type:b.bin_type, vehicle_type:b.vehicle_type, capacity_l:b.capacity_l })),
      },
    });

    // 4. Reload existing bins scoped by municipality column
    const reloadQ = supabase.from("bins").select("id,device_id,name,lat,lng,fill_level,battery_level,municipality,barangay");
    const { data: freshBins } = adminProfile?.municipality
      ? await reloadQ.eq("municipality", adminProfile.municipality)
      : await reloadQ;
    setExistingBins(freshBins ?? []);

    setPendingBins([]); setSimRoute(null); setStartPos(null); setExitPos(null);
    setSaveOk(true); setTimeout(() => setSaveOk(false), 4500);
    setSaving(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const hasScope = !!(adminProfile?.municipality || adminProfile?.barangay);

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", position: "relative", background: THEME.bg, fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        input[type="checkbox"], input[type="radio"] { width: 18px; height: 18px; cursor: pointer; accent-color: ${THEME.primary}; }
        .btn-press:active { transform: scale(0.92); }
      `}</style>

      {/* ── LEFT SIDEBAR / MOBILE DRAWER ── */}
      <div 
        className={`${showMobileSidebar ? "flex" : "hidden"} lg:flex flex-col`}
        style={{ 
          width: 320, background: "#fff", borderRight: `1px solid ${THEME.border}`, 
          zIndex: 1400, overflowY: "auto",
          position: showMobileSidebar ? "absolute" : "relative",
          top: 0, bottom: 0, left: 0,
          boxShadow: showMobileSidebar ? "0 0 50px rgba(0,0,0,0.2)" : "none"
        }}
      >
        <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: THEME.text, margin: 0, letterSpacing: "-.02em" }}>Planner</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={discardAll} style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Reset</button>
              <button className="lg:hidden" onClick={() => setShowMobileSidebar(false)} style={{ fontSize: 13, fontWeight: 700, color: THEME.text, background: "none", border: "none", cursor: "pointer" }}>Close</button>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".1em" }}>Toolbox</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { id: "bin",   label: "Add Waste Station", icon: Plus, color: THEME.primary },
                { id: "start", label: "Set Collection HQ", icon: Navigation, color: "#b45309" },
                { id: "exit",  label: "Set Disposal Site", icon: Flag, color: "#7c3aed" }
              ].map(mode => (
                <button key={mode.id} onClick={() => setPlaceMode(placeMode === mode.id ? null : mode.id as PlaceMode)} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px", borderRadius: 14,
                  background: placeMode === mode.id ? `${mode.color}15` : "transparent",
                  border: `1.5px solid ${placeMode === mode.id ? mode.color : THEME.border}`,
                  cursor: "pointer", transition: "all 0.2s"
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: placeMode === mode.id ? mode.color : `${mode.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <mode.icon size={16} color={placeMode === mode.id ? "#fff" : mode.color} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: placeMode === mode.id ? mode.color : THEME.text }}>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".1em" }}>Vehicle Configuration</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {VEHICLE_TYPES.map(v => (
                <button key={v.value} onClick={() => setDefaultVehicle(v.value)} style={{
                  padding: "12px", borderRadius: 14, border: `1.5px solid ${defaultVehicle === v.value ? THEME.primary : THEME.border}`,
                  background: defaultVehicle === v.value ? THEME.primaryLight : "#fff",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", transition: "all 0.2s"
                }}>
                  <span style={{ fontSize: 20 }}>{v.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: defaultVehicle === v.value ? THEME.primary : THEME.textMuted }}>{v.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN MAP AREA ── */}
      <div style={{ flex: 1, position: "relative" }}>
        
        {/* MOBILE HEADER */}
        <div className="lg:hidden" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1200, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${THEME.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setShowMobileSidebar(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: THEME.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
              <Settings size={18} color={THEME.primary} />
            </button>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: THEME.textMuted, textTransform: "uppercase", margin: 0, letterSpacing: ".05em" }}>Planner</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: THEME.text, margin: 0 }}>{adminProfile?.barangay || "Settings"}</p>
            </div>
          </div>
          <div style={{ background: THEME.primary, color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 900 }}>
            {simming ? "SIMULATING..." : `${pendingBins.length} STATIONS`}
          </div>
        </div>

        {/* TOP ACTION PILL (Like PickingToast) */}
        {placeMode && (
          <div style={{ position:"absolute", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 1300, background: "linear-gradient(135deg, #1c4532, #064e3b)", color: "#fff", padding: "10px 22px", borderRadius: 25, fontSize: 13, fontWeight: 800, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", pointerEvents: "none", animation: "slideInUp 0.25s ease", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #fff", animation: "pulse 1.5s infinite" }} />
            {placeMode === "bin" ? "Tap map to place waste station" : placeMode === "start" ? "Set truck starting headquarters" : "Mark route disposal/exit point"}
          </div>
        )}

        {/* RIGHT SIDE CONTROLS (Compass, 3D, Recenter) */}
        <div style={{ position: "absolute", right: 16, bottom: "calc(max(env(safe-area-inset-bottom, 24px), 24px) + 80px)", zIndex: 1100, display: "flex", flexDirection: "column", gap: 14 }}>
          <button onClick={() => { mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 }); }} className="btn-press" style={{ width: 52, height: 52, borderRadius: 26, background: "#fff", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: `rotate(${-(mapRef.current?.getBearing() ?? 0)}deg)`, transition: "transform 0.4s ease" }}>
              <polygon points="14,3 17,14 14,12 11,14" fill="#ef4444"/>
              <polygon points="14,25 17,14 14,16 11,14" fill="#475569"/>
            </svg>
          </button>
          <button onClick={() => { const p = mapRef.current?.getPitch() ?? 0; mapRef.current?.easeTo({ pitch: p > 10 ? 0 : 45, duration: 500 }); }} className="btn-press" style={{ width: 52, height: 52, borderRadius: 26, background: "#fff", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: THEME.primary }}>3D</div>
          </button>
          <button onClick={() => { if(adminProfile?.areaLat) mapRef.current?.flyTo({ center: [adminProfile.areaLng!, adminProfile.areaLat!], zoom: 15 }); }} className="btn-press" style={{ width: 52, height: 52, borderRadius: 26, background: THEME.primary, border: "none", boxShadow: "0 8px 24px rgba(28,69,50,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Navigation size={22} color="#fff" />
          </button>
        </div>

        {/* MOBILE BOTTOM ACTION BAR */}
        <div className="lg:hidden" style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1200, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", padding: "16px 20px", borderTop: `1px solid ${THEME.border}`, display: "flex", gap: 10 }}>
          <button onClick={() => setPlaceMode(placeMode === "bin" ? null : "bin")} className="btn-press" style={{ flex: 1, height: 52, borderRadius: 16, background: placeMode === "bin" ? THEME.primary : THEME.primaryLight, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Plus size={20} color={placeMode === "bin" ? "#fff" : THEME.primary} />
            <span style={{ fontSize: 14, fontWeight: 800, color: placeMode === "bin" ? "#fff" : THEME.primary }}>Add Bin</span>
          </button>
          <button onClick={simulateRoute} disabled={pendingBins.length === 0 || simming} className="btn-press" style={{ flex: 2, height: 52, borderRadius: 16, background: simming ? THEME.textMuted : THEME.primary, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 20px rgba(28,69,50,0.3)" }}>
            {simming ? <RotateCcw size={20} color="#fff" className="animate-spin" /> : <Route size={20} color="#fff" />}
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{simming ? "Optimizing..." : "Simulate"}</span>
          </button>
          <button onClick={() => setPlaceMode(placeMode === "start" ? null : "start")} className="btn-press" style={{ width: 52, height: 52, borderRadius: 16, background: placeMode === "start" ? "#b45309" : "#fff", border: `1.5px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Navigation size={22} color={placeMode === "start" ? "#fff" : "#b45309"} />
          </button>
        </div>

        {/* MAP COMPONENT */}
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          initialViewState={{
            latitude:  adminProfile?.areaLat ?? 7.45,
            longitude: adminProfile?.areaLng ?? 126.3,
            zoom: 15,
          }}
          style={{ width: "100%", height: "100%" }}
          onClick={onMapClick}
          onLoad={() => setMapLoaded(true)}
          attributionControl={false}
          dragRotate touchZoomRotate pitchWithRotate
        >
          {/* Simulated route line (Multi-colored segments) */}
          {mapLoaded && simRoute?.geojson && (
            <Source id="sim-route" type="geojson" data={simRoute.geojson}>
              <Layer id="sim-route-line" type="line" paint={{ 
                "line-color": ["get", "color"], 
                "line-width": 6, 
                "line-opacity": 0.8 
              }} layout={{ "line-join": "round", "line-cap": "round" }} />
              <Layer id="sim-route-glow" type="line" paint={{ 
                "line-color": ["get", "color"], 
                "line-width": 14, 
                "line-opacity": 0.1, 
                "line-blur": 5 
              }} />
            </Source>
          )}

          {/* Existing bins from DB (Waze-style premium markers) */}
          {showExisting && existingBins.map(bin => {
            const color = FILL_COLOR(bin.fill_level);
            return (
              <Marker key={bin.id} latitude={bin.lat} longitude={bin.lng} anchor="center">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 20, background: "rgba(10,14,26,0.9)", backdropFilter: "blur(8px)", border: `1.5px solid ${color}55`, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", marginBottom: 4
                  }}>
                    <svg width="18" height="18" viewBox="0 0 20 20" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                      <circle cx="10" cy="10" r="7" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={`${(bin.fill_level/100)*44} 44`} strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: 10, fontWeight: 900, color: "#fff" }}>{bin.fill_level}%</span>
                  </div>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, border: "2.5px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
                </div>
              </Marker>
            );
          })}

          {/* Start / HQ marker */}
          {startPos && (
            <Marker latitude={startPos[0]} longitude={startPos[1]} anchor="bottom" draggable onDragEnd={e => setStartPos([e.lngLat.lat, e.lngLat.lng])}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ padding: "6px 14px", borderRadius: 12, background: "rgba(10,14,26,0.95)", border: "1.5px solid #b45309", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#fcd34d", letterSpacing: "0.05em" }}>START HQ</span>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#b45309", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff", boxShadow: "0 6px 16px rgba(0,0,0,0.2)" }}>
                  <Navigation size={20} color="#fff" />
                </div>
              </div>
            </Marker>
          )}

          {/* Exit / Disposal marker */}
          {/* Exit / Disposal marker */}
          {exitPos && (
            <Marker latitude={exitPos[0]} longitude={exitPos[1]} anchor="bottom" draggable onDragEnd={e => setExitPos([e.lngLat.lat, e.lngLat.lng])}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ padding: "6px 14px", borderRadius: 12, background: "rgba(10,14,26,0.95)", border: "1.5px solid #7c3aed", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#c4b5fd", letterSpacing: "0.05em" }}>DISPOSAL</span>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff", boxShadow: "0 6px 16px rgba(0,0,0,0.2)" }}>
                  <Flag size={20} color="#fff" />
                </div>
              </div>
            </Marker>
          )}

          {/* Pending bins */}
          {pendingBins.map((bin, idx) => {
            const bt = BIN_TYPES.find(t => t.value === bin.bin_type);
            const isSel = selectedBin?.tempId === bin.tempId;
            return (
              <Marker key={bin.tempId} latitude={bin.lat} longitude={bin.lng} anchor="bottom" draggable onDragEnd={e => updateBin(bin.tempId, { lat: e.lngLat.lat, lng: e.lngLat.lng })}>
                <div onClick={() => setSelectedBin(bin)} style={{
                  cursor: "move", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  transform: isSel ? "scale(1.2)" : "none", transition: "transform 0.2s"
                }}>
                  <div style={{
                    padding: "4px 8px", background: "#1c4532", color: "#fff", borderRadius: 8, fontSize: 9, fontWeight: 800,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.1)", marginBottom: 2
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", background: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.15)", border: `2.5px solid #1c4532`,
                  }}>
                    <span style={{ fontSize: 16 }}>{bt?.icon ?? "🗑️"}</span>
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* SUCCESS TOAST */}
      {saveOk && (
        <div style={{ position:"absolute", top:24, left:"50%", transform:"translateX(-50%)", zIndex:1500, background:THEME.primary, color:"#fff", padding:"12px 24px", borderRadius:12, fontWeight:700, fontSize:14, boxShadow:"0 10px 30px rgba(28,69,50,0.3)", display:"flex", alignItems:"center", gap:10, animation: "slideInUp .3s ease" }}>
          <CheckCircle2 size={18} /> Route saved successfully!
        </div>
      )}

      {/* MODALS */}
      {selectedBin && (
        <BinConfigModal
          bin={selectedBin}
          onUpdate={(id, p) => { updateBin(id, p); setSelectedBin(null); }}
          onRemove={removeBin}
          onClose={() => setSelectedBin(null)}
        />
      )}

      {simRoute && (
        <RouteSummaryPanel
          route={simRoute}
          bins={pendingBins}
          adminProfile={adminProfile}
          onSave={saveBins}
          onDiscard={discardAll}
          saving={saving}
          onToggle={() => setShowRoutePanel(!showRoutePanel)}
          isHidden={!showRoutePanel}
        />
      )}
    </div>
  );
}
