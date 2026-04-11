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
  Settings, Flag, Navigation, Info, Building2,
} from "lucide-react";

const supabase  = createClient();
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// ─────────────────────────────────────────────────────────────────────────────
// MAP STYLE
// ─────────────────────────────────────────────────────────────────────────────

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "mapbox-sat": {
      type: "raster",
      tiles: [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`],
      tileSize: 512,
      attribution: "© Mapbox © OpenStreetMap",
    },
  },
  layers: [
    { id: "bg",  type: "background", paint: { "background-color": "#0f172a" } },
    { id: "sat", type: "raster",     source: "mapbox-sat" },
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
  pct >= 90 ? "#ef4444" : pct >= 70 ? "#f97316" : pct >= 40 ? "#eab308" : "#22c55e";

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
  geojson:       GeoJSON.Feature<GeoJSON.LineString> | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE SUMMARY PANEL
// ─────────────────────────────────────────────────────────────────────────────

function RouteSummaryPanel({ route, bins, adminProfile, onSave, onDiscard, saving }: {
  route:        SimRoute;
  bins:         PendingBin[];
  adminProfile: AdminProfile | null;
  onSave:       () => void;
  onDiscard:    () => void;
  saving:       boolean;
}) {
  const orderedBins = route.binOrder
    .map(id => bins.find(b => b.tempId === id))
    .filter(Boolean) as PendingBin[];

  const totalCap = orderedBins.reduce((s, b) => s + b.capacity_l, 0);
  const vt = VEHICLE_TYPES.find(t => t.value === route.vehicleType);

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
      const { data: bins } = await supabase
        .from("bins")
        .select("id,device_id,name,lat,lng,fill_level,battery_level");

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

    setSimRoute({
      binOrder:      orderedIds,
      orderedCoords: orderedBinCoords,
      distKm, durationMin, fuelL,
      vehicleType:   defaultVehicle,
      geojson,
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

    // 1. Insert bins
    const binInserts = pendingBins.map((b, i) => ({
      device_id:     `SIM-${muni}-${timestamp}-${i}`,
      name:          b.name || `Bin ${i + 1} (${BIN_TYPES.find(t => t.value === b.bin_type)?.label ?? b.bin_type})`,
      lat:           b.lat,
      lng:           b.lng,
      fill_level:    b.fill_level,
      battery_level: 100,
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
        route: { distKm: simRoute.distKm, durationMin: simRoute.durationMin, fuelL: simRoute.fuelL, vehicleType: simRoute.vehicleType, binOrder: simRoute.binOrder },
        startPos, exitPos,
      },
    });

    // 4. Reload existing bins (scoped)
    const { data: freshBins } = await supabase.from("bins").select("id,device_id,name,lat,lng,fill_level,battery_level");
    const allFresh: ExistingBin[] = freshBins ?? [];
    const { areaLat, areaLng } = adminProfile ?? {};
    const scoped = (areaLat && areaLng)
      ? allFresh.filter(b => haversine([areaLat, areaLng], [b.lat, b.lng]) <= 15_000)
      : allFresh;
    setExistingBins(scoped);

    setPendingBins([]); setSimRoute(null); setStartPos(null); setExitPos(null);
    setSaveOk(true); setTimeout(() => setSaveOk(false), 4500);
    setSaving(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const hasScope = adminProfile?.municipality || adminProfile?.barangay;

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", minHeight:600, borderRadius:20, overflow:"hidden", fontFamily:"sans-serif" }}>

      {/* ── MAP ── */}
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: 126.3, latitude: 7.45, zoom: 13 }}
        maxZoom={21}
        style={{ width:"100%", height:"100%" }}
        cursor={placeMode ? "crosshair" : "grab"}
        onClick={onMapClick}
        onZoom={e => setZoom(e.viewState.zoom)}
        onLoad={() => setMapLoaded(true)}
      >
        {/* Simulated route line */}
        {mapLoaded && simRoute?.geojson && (
          <Source id="sim-route" type="geojson" data={simRoute.geojson}>
            <Layer id="sim-route-glow" type="line"
              paint={{ "line-color":"#059669", "line-width":14, "line-opacity":0.12, "line-blur":6 }}
              layout={{ "line-join":"round", "line-cap":"round" }} />
            <Layer id="sim-route-line" type="line"
              paint={{ "line-color":"#059669", "line-width":4, "line-opacity":0.95 }}
              layout={{ "line-join":"round", "line-cap":"round" }} />
          </Source>
        )}

        {/* Existing bins */}
        {showExisting && existingBins.map(bin =>
          zoom >= 13 && (
            <Marker key={bin.id} longitude={bin.lng} latitude={bin.lat} anchor="center">
              <div style={{ width:11, height:11, borderRadius:"50%", background: FILL_COLOR(bin.fill_level), border:"2px solid rgba(255,255,255,.8)", boxShadow:"0 1px 4px rgba(0,0,0,.3)", cursor:"default" }} title={`${bin.name} — ${bin.fill_level}%`} />
            </Marker>
          )
        )}

        {/* Start / HQ marker */}
        {startPos && (
          <Marker longitude={startPos[1]} latitude={startPos[0]} anchor="bottom">
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ background:"#b45309", border:"3px solid #fcd34d", borderRadius:"10px 10px 3px 3px", padding:"6px 10px", display:"flex", flexDirection:"column", alignItems:"center", boxShadow:"0 4px 14px rgba(180,83,9,.5)" }}>
                <span style={{ fontSize:15 }}>🏢</span>
                <span style={{ fontSize:8, fontWeight:900, color:"#fff", letterSpacing:".05em" }}>HQ / START</span>
              </div>
              <div style={{ width:2, height:8, background:"#b45309" }} />
            </div>
          </Marker>
        )}

        {/* Exit / disposal site marker */}
        {exitPos && (
          <Marker longitude={exitPos[1]} latitude={exitPos[0]} anchor="bottom">
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ background:"#7c3aed", border:"3px solid #c4b5fd", borderRadius:"10px 10px 3px 3px", padding:"6px 10px", display:"flex", flexDirection:"column", alignItems:"center", boxShadow:"0 4px 14px rgba(124,58,237,.5)" }}>
                <span style={{ fontSize:15 }}>⚑</span>
                <span style={{ fontSize:8, fontWeight:900, color:"#fff", letterSpacing:".05em" }}>EXIT / DUMP</span>
              </div>
              <div style={{ width:2, height:8, background:"#7c3aed" }} />
            </div>
          </Marker>
        )}

        {/* Pending bins */}
        {pendingBins.map(bin => {
          const bt = BIN_TYPES.find(t => t.value === bin.bin_type);
          return (
            <Marker key={bin.tempId} longitude={bin.lng} latitude={bin.lat} anchor="bottom"
              draggable
              onDragEnd={e => updateBin(bin.tempId, { lat: e.lngLat.lat, lng: e.lngLat.lng })}
            >
              <div onClick={() => setSelectedBin(bin)} style={{ display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer" }}>
                {zoom >= 14 && (
                  <div style={{ background:"#0f172a", color:"#fff", padding:"3px 9px", borderRadius:20, fontSize:10, fontWeight:800, marginBottom:4, boxShadow:"0 2px 8px rgba(0,0,0,.4)", whiteSpace:"nowrap", border:"1.5px solid rgba(255,255,255,.12)", display:"flex", alignItems:"center", gap:4 }}>
                    {bt?.icon}
                    <span>{bin.name || "Unnamed"}</span>
                    {bin.routeOrder && (
                      <span style={{ background:"#059669", borderRadius:10, padding:"1px 5px", fontSize:9 }}>#{bin.routeOrder}</span>
                    )}
                  </div>
                )}
                <div style={{ width:26, height:26, borderRadius:"50%", background:"#059669", border:"3px solid #fff", boxShadow:"0 2px 10px rgba(5,150,105,.5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
                  {bt?.icon ?? "🗑️"}
                </div>
                <div style={{ width:2, height:8, background:"#059669", opacity:.6 }} />
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* ── TOP TOOLBAR ── */}
      <div style={{
        position:"absolute", top:14, left:"50%", transform:"translateX(-50%)",
        zIndex:1100, display:"flex", gap:7, alignItems:"center",
        background:"rgba(255,255,255,.97)", backdropFilter:"blur(10px)",
        borderRadius:17, padding:"7px 11px",
        boxShadow:"0 4px 24px rgba(0,0,0,.18)", border:"1.5px solid rgba(255,255,255,.8)",
        flexWrap:"wrap", justifyContent:"center",
      }}>

        {/* Jurisdiction badge */}
        {hasScope && (
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 11px", borderRadius:11, background:"#f0fdf4", border:"1.5px solid #bbf7d0" }}>
            <Building2 size={11} color="#059669" />
            <span style={{ fontSize:10, fontWeight:800, color:"#059669" }}>
              {[adminProfile?.barangay, adminProfile?.municipality].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {!hasScope && (
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 11px", borderRadius:11, background:"#fef3c7", border:"1.5px solid #fde68a" }}>
            <AlertTriangle size={11} color="#d97706" />
            <span style={{ fontSize:10, fontWeight:700, color:"#d97706" }}>No jurisdiction set — update your profile</span>
          </div>
        )}

        <div style={{ width:1, height:22, background:"#e2e8f0" }} />

        {/* Place bin */}
        <button onClick={() => setPlaceMode(m => m === "bin" ? null : "bin")} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 13px", borderRadius:11, background: placeMode === "bin" ? "#059669":"#f8fafc", border:`1.5px solid ${placeMode === "bin" ? "#059669":"#e2e8f0"}`, color: placeMode === "bin" ? "#fff":"#334155", fontWeight:800, fontSize:11, cursor:"pointer", textTransform:"uppercase", letterSpacing:".05em", transition:"all .13s" }}>
          <Plus size={12} /> {placeMode === "bin" ? "Click map…" : "Drop Bin"}
        </button>

        {/* Set Start */}
        <button onClick={() => setPlaceMode(m => m === "start" ? null : "start")} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 13px", borderRadius:11, background: placeMode === "start" ? "#b45309" : startPos ? "#fef3c7":"#f8fafc", border:`1.5px solid ${placeMode === "start" ? "#b45309" : startPos ? "#fde68a":"#e2e8f0"}`, color: placeMode === "start" ? "#fff" : startPos ? "#b45309":"#334155", fontWeight:800, fontSize:11, cursor:"pointer", textTransform:"uppercase", letterSpacing:".05em", transition:"all .13s" }}>
          <Navigation size={12} /> {placeMode === "start" ? "Click map…" : startPos ? "HQ Set ✓" : "Set HQ"}
        </button>

        {/* Set Exit */}
        <button onClick={() => setPlaceMode(m => m === "exit" ? null : "exit")} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 13px", borderRadius:11, background: placeMode === "exit" ? "#7c3aed" : exitPos ? "#f5f3ff":"#f8fafc", border:`1.5px solid ${placeMode === "exit" ? "#7c3aed" : exitPos ? "#c4b5fd":"#e2e8f0"}`, color: placeMode === "exit" ? "#fff" : exitPos ? "#7c3aed":"#334155", fontWeight:800, fontSize:11, cursor:"pointer", textTransform:"uppercase", letterSpacing:".05em", transition:"all .13s" }}>
          <Flag size={12} /> {placeMode === "exit" ? "Click map…" : exitPos ? "Exit Set ✓" : "Set Exit"}
        </button>

        <div style={{ width:1, height:22, background:"#e2e8f0" }} />

        {/* Default vehicle */}
        <select value={defaultVehicle} onChange={e => setDefaultVehicle(e.target.value)} style={{ padding:"7px 10px", borderRadius:11, border:"1.5px solid #e2e8f0", fontSize:11, fontWeight:700, color:"#334155", background:"#f8fafc", cursor:"pointer", outline:"none" }}>
          {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.icon} {v.label}</option>)}
        </select>

        <div style={{ width:1, height:22, background:"#e2e8f0" }} />

        {/* Simulate */}
        <button onClick={simulateRoute} disabled={pendingBins.length === 0 || simming} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 13px", borderRadius:11, background: pendingBins.length === 0 ? "#f1f5f9":"#2563eb", border:"none", color: pendingBins.length === 0 ? "#94a3b8":"#fff", fontWeight:800, fontSize:11, cursor: pendingBins.length === 0 ? "not-allowed":"pointer", textTransform:"uppercase", letterSpacing:".05em", transition:"all .13s" }}>
          <Route size={12} /> {simming ? "Calculating A*…" : `Simulate (${pendingBins.length})`}
        </button>

        {/* Toggle existing */}
        <button onClick={() => setShowExisting(p => !p)} title={showExisting ? "Hide existing bins":"Show existing bins"} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 11px", borderRadius:11, background:"transparent", border:"1.5px solid #e2e8f0", color:"#64748b", cursor:"pointer", fontSize:11, fontWeight:700 }}>
          {showExisting ? <Eye size={12} /> : <EyeOff size={12} />} {existingBins.length}
        </button>

        {/* Discard all */}
        {pendingBins.length > 0 && (
          <button onClick={discardAll} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 11px", borderRadius:11, background:"#fef2f2", border:"1.5px solid #fecaca", color:"#dc2626", cursor:"pointer", fontSize:11, fontWeight:700 }}>
            <X size={12} /> Discard
          </button>
        )}
      </div>

      {/* ── CLICK HINT ── */}
      {placeMode && (
        <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", zIndex:1100, background: placeMode === "start" ? "#b45309" : placeMode === "exit" ? "#7c3aed" : "#059669", color:"#fff", padding:"7px 18px", borderRadius:20, fontSize:11, fontWeight:700, pointerEvents:"none", boxShadow:`0 2px 12px rgba(0,0,0,.3)` }}>
          {placeMode === "bin" && "📍 Click to place a bin — drag to reposition"}
          {placeMode === "start" && "🏢 Click to set HQ / truck start position"}
          {placeMode === "exit" && "⚑ Click to set disposal site / exit point"}
        </div>
      )}

      {/* ── PENDING BINS LIST ── */}
      {pendingBins.length > 0 && !simRoute && (
        <div style={{ position:"absolute", top:14, right:14, zIndex:1100, width:210, background:"rgba(255,255,255,.97)", backdropFilter:"blur(10px)", borderRadius:17, boxShadow:"0 4px 24px rgba(0,0,0,.15)", border:"1.5px solid rgba(255,255,255,.8)", overflow:"hidden" }}>
          <div style={{ padding:"11px 13px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:".08em" }}>Pending ({pendingBins.length})</p>
            <p style={{ margin:0, fontSize:9, color:"#94a3b8" }}>Drag to move</p>
          </div>
          <div style={{ maxHeight:260, overflowY:"auto" }}>
            {pendingBins.map((bin, idx) => {
              const bt = BIN_TYPES.find(t => t.value === bin.bin_type);
              return (
                <div key={bin.tempId} onClick={() => setSelectedBin(bin)} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 13px", cursor:"pointer", borderBottom:"1px solid #f8fafc", background: selectedBin?.tempId === bin.tempId ? "#f0fdf4":"transparent", transition:"background .1s" }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", background:"#f0fdf4", border:"1.5px solid #bbf7d0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>{bt?.icon ?? "🗑️"}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bin.name || `Bin ${idx + 1}`}</p>
                    <p style={{ margin:0, fontSize:9, color:"#94a3b8" }}>{bt?.label} · {bin.capacity_l}L</p>
                  </div>
                  <Settings size={11} style={{ color:"#94a3b8", flexShrink:0 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEGEND ── */}
      <div style={{ position:"absolute", bottom: simRoute ? 240 : 14, left:14, zIndex:1100, background:"rgba(255,255,255,.95)", backdropFilter:"blur(8px)", borderRadius:13, padding:"9px 13px", boxShadow:"0 2px 12px rgba(0,0,0,.1)", fontSize:10 }}>
        <p style={{ margin:"0 0 5px", fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:".07em" }}>Legend</p>
        {[
          { color:"#22c55e", label:"Low fill (< 40%)" },
          { color:"#eab308", label:"Moderate (40–70%)" },
          { color:"#f97316", label:"High (70–90%)" },
          { color:"#ef4444", label:"Critical (> 90%)" },
          { color:"#059669", label:"New bin (pending save)", border:true },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
            <div style={{ width:9, height:9, borderRadius:"50%", background:l.color, border: l.border ? "2px solid #fff":undefined, flexShrink:0 }} />
            <span style={{ color:"#475569", fontWeight:600 }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ fontSize:12 }}>🏢</span><span style={{ color:"#475569", fontWeight:600 }}>HQ / Start</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:12 }}>⚑</span><span style={{ color:"#475569", fontWeight:600 }}>Exit / Disposal</span>
        </div>
      </div>

      {/* ── SUCCESS TOAST ── */}
      {saveOk && (
        <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)", zIndex:1500, background:"#059669", color:"#fff", padding:"11px 22px", borderRadius:18, fontWeight:800, fontSize:13, boxShadow:"0 4px 20px rgba(5,150,105,.4)", display:"flex", alignItems:"center", gap:8 }}>
          <CheckCircle2 size={15} /> Bins + route saved! Visible to drivers and citizens in your jurisdiction.
        </div>
      )}

      {/* ── BIN CONFIG MODAL ── */}
      {selectedBin && (
        <BinConfigModal
          bin={selectedBin}
          onUpdate={(id, p) => { updateBin(id, p); setSelectedBin(null); }}
          onRemove={removeBin}
          onClose={() => setSelectedBin(null)}
        />
      )}

      {/* ── ROUTE SUMMARY PANEL ── */}
      {simRoute && (
        <RouteSummaryPanel
          route={simRoute}
          bins={pendingBins}
          adminProfile={adminProfile}
          onSave={saveBins}
          onDiscard={discardAll}
          saving={saving}
        />
      )}
    </div>
  );
}