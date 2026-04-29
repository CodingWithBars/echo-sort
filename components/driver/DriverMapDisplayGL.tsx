"use client";

// DriverMapDisplayGL.tsx — Google Maps-style driver navigation UI
//
// Layout layers (bottom → top):
//   z-800  TopBar (gradient fade, pointer-events:none)
//   z-800  NextStopCard (above BottomBar, right:72 clears FAB column)
//   z-810  RightFAB column — compass · 3D · locate
//   z-820  BottomBar — stop-list | exit-flag | START/RECALCULATE
//   z-900  PickingToast
//   z-950  StopListDrawer
//
// The bypass record button lives in EcoDashboard (desktop sidebar footer)
// and in DriverSidebar (mobile drag-handle FAB). This file has no bypass button.
// bypassRouteFC prop is still accepted to render the purple route overlay on map.

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef, MapLayerMouseEvent, Source, Layer } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import RoutingLayerGL from "./RoutingLayerGL";
import type { StyleSpecification } from "maplibre-gl";
import { LUPON_CENTER } from "../map/MapAssets";

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface DriverMapDisplayGLProps {
  bins:             any[];
  allBins?:         any[];
  driverPos:        [number, number] | null;
  heading:          number;
  selectedBinId:    number | null;
  setSelectedBinId: (id: number) => void;
  routeKey:         number;
  mode:             "fastest" | "priority";
  maxDetour:        number;
  useFence:         boolean;
  mapStyle:         StyleSpecification | string;
  onRouteUpdate:    (stats: { dist: string; time: string; uturnCount?: number }) => void;
  isTracking:       boolean;
  /** Optional: GeoJSON of driver's recorded bypass route — renders as purple overlay */
  bypassRouteFC?:   GeoJSON.FeatureCollection<GeoJSON.LineString> | null;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

const FC = (n: number) =>
  n >= 90 ? "#ef4444" : n >= 70 ? "#f97316" : n >= 40 ? "#eab308" : "#22c55e";

const DIRS = ["N","NE","E","SE","S","SW","W","NW"];
const toCardinal = (d: number) => DIRS[Math.round(d / 45) % 8];

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes driverPulse {
    0%   { transform:scale(0.85); opacity:0.9; }
    100% { transform:scale(2.4);  opacity:0;   }
  }
  @keyframes slideUp {
    from { transform:translateY(10px); opacity:0; }
    to   { transform:translateY(0);    opacity:1; }
  }
  @keyframes drawerIn {
    from { transform:translateY(100%); }
    to   { transform:translateY(0);    }
  }
  @keyframes toastPop {
    from { opacity:0; transform:translateX(-50%) scale(0.92) translateY(8px); }
    to   { opacity:1; transform:translateX(-50%) scale(1)    translateY(0);   }
  }
  @keyframes nextIn {
    from { transform:translateY(8px); opacity:0; }
    to   { transform:translateY(0);   opacity:1; }
  }
  .btn-tap:active { transform:scale(0.92); }
  .dmgl-scroll::-webkit-scrollbar { display:none; }
  .dmgl-scroll { -ms-overflow-style:none; scrollbar-width:none; }
  .stop-row:active { background:rgba(26,115,232,0.12) !important; }
`;

// ── DRIVER MARKER ─────────────────────────────────────────────────────────────

function DriverMarker({ pos }: { pos: [number,number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
      <div style={{ position:"relative", width:52, height:52, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ position:"absolute", width:52, height:52, borderRadius:"50%", background:"rgba(26,115,232,0.28)", animation:"driverPulse 2.2s ease-out infinite", pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:30, height:30, borderRadius:"50%", background:"rgba(26,115,232,0.18)", border:"1.5px solid rgba(26,115,232,0.45)", pointerEvents:"none" }} />
        <div style={{ width:22, height:22, borderRadius:"50%", background:"linear-gradient(145deg,#4285f4,#1557b0)", border:"3.5px solid #fff", boxShadow:"0 3px 14px rgba(26,115,232,0.75)", zIndex:1, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:0, height:0, borderLeft:"4px solid transparent", borderRight:"4px solid transparent", borderBottom:"7px solid rgba(255,255,255,0.9)", marginBottom:2 }} />
        </div>
      </div>
    </Marker>
  );
}

// ── BIN MARKER ────────────────────────────────────────────────────────────────

function BinMarker({ bin, isSelected, onClick, zoom }: {
  bin:any; isSelected:boolean; onClick:()=>void; zoom:number;
}) {
  if (zoom < 13) return null;
  const color = FC(bin.fillLevel);
  const urgent = bin.fillLevel >= 80;
  const R = 10, circ = 2 * Math.PI * R;
  const dash = (bin.fillLevel / 100) * circ;

  return (
    <Marker longitude={bin.lng} latitude={bin.lat} anchor="bottom"
      onClick={e => { e.originalEvent.stopPropagation(); onClick(); }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer", userSelect:"none" }}>
        {zoom >= 15 && (
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 9px 5px 7px", borderRadius:20, marginBottom:4, background: isSelected ? "linear-gradient(135deg,#1a73e8,#0d5fc9)" : "rgba(10,14,26,0.92)", backdropFilter:"blur(10px)", border:`1.5px solid ${isSelected ? "rgba(255,255,255,0.3)" : urgent ? color+"55" : "rgba(255,255,255,0.1)"}`, boxShadow: isSelected ? "0 4px 16px rgba(26,115,232,0.5)" : urgent ? `0 3px 10px ${color}40` : "0 2px 8px rgba(0,0,0,0.5)", transform: isSelected ? "scale(1.05)" : "scale(1)", transition:"all 0.18s cubic-bezier(0.34,1.56,0.64,1)", whiteSpace:"nowrap", maxWidth:170 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink:0, transform:"rotate(-90deg)" }}>
              <circle cx="11" cy="11" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5"/>
              <circle cx="11" cy="11" r={R} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:11, fontWeight:600, color: isSelected ? "#fff" : "#f1f5f9", overflow:"hidden", textOverflow:"ellipsis", maxWidth:80 }}>
              {bin.name ?? `Bin ${bin.id}`}
            </span>
            <span style={{ fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:20, background: urgent ? color : "rgba(255,255,255,0.1)", color: urgent ? "#fff" : color, flexShrink:0 }}>
              {bin.fillLevel}%
            </span>
          </div>
        )}
        <div style={{ width:16, height:16, borderRadius:"50%", background: isSelected ? "linear-gradient(145deg,#4285f4,#1557b0)" : urgent ? color : "rgba(10,14,26,0.9)", border:`2.5px solid ${isSelected ? "#fff" : urgent ? "rgba(255,255,255,0.85)" : color}`, boxShadow: isSelected ? "0 0 0 3px rgba(26,115,232,0.4)" : "0 2px 6px rgba(0,0,0,0.4)", transform: isSelected ? "scale(1.3)" : "scale(1)", transition:"all 0.18s cubic-bezier(0.34,1.56,0.64,1)", flexShrink:0 }} />
        <div style={{ width:2, height:6, background:"rgba(0,0,0,0.3)", borderRadius:"0 0 2px 2px", marginTop:-1 }} />
      </div>
    </Marker>
  );
}

// ── EXIT MARKER ───────────────────────────────────────────────────────────────

function ExitMarker({ pos }: { pos:[number,number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="bottom">
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ padding:"4px 11px", borderRadius:10, marginBottom:4, background:"rgba(10,14,26,0.95)", backdropFilter:"blur(10px)", border:"1.5px solid #7c3aed", boxShadow:"0 4px 14px rgba(124,58,237,0.4)" }}>
          <span style={{ fontSize:10, fontWeight:800, color:"#c4b5fd", letterSpacing:"0.08em" }}>EXIT</span>
        </div>
        <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
          <path d="M3 24V3" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 3 L16 7 L3 12 Z" fill="#7c3aed" opacity="0.9"/>
          <circle cx="3" cy="24" r="2" fill="#7c3aed" opacity="0.5"/>
        </svg>
      </div>
    </Marker>
  );
}

// ── TOP BAR ───────────────────────────────────────────────────────────────────

function TopBar({ isTracking, heading, stopCount, hasRoute }: {
  isTracking:boolean; heading:number; stopCount:number; hasRoute:boolean;
}) {
  return (
    <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:800, padding:"12px 12px 28px", background:"linear-gradient(180deg,rgba(0,0,0,0.55) 0%,transparent 100%)", pointerEvents:"none" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", background: isTracking ? "rgba(0,200,83,0.18)" : "rgba(100,116,139,0.22)", border:`1px solid ${isTracking ? "rgba(0,200,83,0.4)" : "rgba(100,116,139,0.3)"}`, borderRadius:20, backdropFilter:"blur(10px)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background: isTracking ? "#00e676" : "#64748b", boxShadow: isTracking ? "0 0 6px #00e676" : "none" }} />
          <span style={{ fontSize:10, fontWeight:700, color: isTracking ? "#69f0ae" : "#94a3b8", letterSpacing:"0.06em" }}>{isTracking ? "GPS ON" : "GPS OFF"}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, backdropFilter:"blur(10px)" }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <polygon points="4.5,0 5.5,4.5 4.5,3.5 3.5,4.5" fill="#ef4444"/>
            <polygon points="4.5,9 5.5,4.5 4.5,5.5 3.5,4.5" fill="#475569"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:700, color:"#cbd5e1" }}>{Math.round(heading)}° {toCardinal(heading)}</span>
        </div>
        {hasRoute && stopCount > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", background:"rgba(26,115,232,0.2)", border:"1px solid rgba(66,133,244,0.35)", borderRadius:20, backdropFilter:"blur(10px)" }}>
            <span style={{ fontSize:10, fontWeight:800, color:"#80b4ff" }}>{stopCount} STOPS</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── NEXT STOP CARD ────────────────────────────────────────────────────────────

function NextStopCard({ bin, stopNumber, totalStops, routeStats }: {
  bin:any; stopNumber:number; totalStops:number; routeStats:{dist:string;time:string}|null;
}) {
  const color = FC(bin.fillLevel);
  const urgent = bin.fillLevel >= 90;
  const R = 8, circ = 2*Math.PI*R, dash = (bin.fillLevel/100)*circ;
  return (
    <div style={{ position:"absolute", bottom:94, left:12, right:72, zIndex:800, animation:"nextIn 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>
      <div style={{ background:"rgba(10,14,26,0.97)", backdropFilter:"blur(20px)", borderRadius:18, border:`1.5px solid ${urgent ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.09)"}`, boxShadow: urgent ? "0 6px 24px rgba(0,0,0,0.5),0 0 0 2px rgba(239,68,68,0.15)" : "0 6px 24px rgba(0,0,0,0.5)", padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:14, flexShrink:0, background: urgent ? "rgba(239,68,68,0.12)" : "rgba(26,115,232,0.12)", border:`2px solid ${urgent ? "#ef4444" : "#1a73e8"}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:18, fontWeight:900, color: urgent ? "#f87171" : "#4285f4", lineHeight:1 }}>{stopNumber}</span>
          <span style={{ fontSize:8, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>of {totalStops}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
            {urgent && <span style={{ fontSize:8, fontWeight:800, background:"#ef4444", color:"#fff", padding:"1px 5px", borderRadius:20, flexShrink:0 }}>URGENT</span>}
            <span style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bin.name ?? `Bin #${bin.id}`}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink:0, transform:"rotate(-90deg)" }}>
              <circle cx="9" cy="9" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
              <circle cx="9" cy="9" r={R} fill="none" stroke={color} strokeWidth="2" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
            </svg>
            <div style={{ flex:1, height:4, background:"rgba(255,255,255,0.08)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:`${bin.fillLevel}%`, height:"100%", background:`linear-gradient(90deg,${color}bb,${color})`, borderRadius:2 }} />
            </div>
            <span style={{ fontSize:14, fontWeight:800, color, flexShrink:0 }}>{bin.fillLevel}%</span>
          </div>
        </div>
        {routeStats && (
          <div style={{ flexShrink:0, textAlign:"right", padding:"5px 9px", background:"rgba(255,255,255,0.05)", borderRadius:10 }}>
            <div style={{ fontSize:15, fontWeight:900, color:"#f1f5f9", lineHeight:1 }}>{routeStats.dist}</div>
            <div style={{ fontSize:10, color:"#64748b", fontWeight:600, marginTop:2 }}>{routeStats.time}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RIGHT FAB COLUMN ──────────────────────────────────────────────────────────
// Compass · 3D tilt · Locate — no bypass button here.

function RightFAB({ heading, pitch, onResetNorth, onTogglePitch, onCenterDriver, hasDriver }: {
  heading:number; pitch:number;
  onResetNorth:()=>void; onTogglePitch:()=>void; onCenterDriver:()=>void;
  hasDriver:boolean;
}) {
  const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
    width:48, height:48, borderRadius:14,
    background:"rgba(10,14,26,0.92)", backdropFilter:"blur(12px)",
    border:"1.5px solid rgba(255,255,255,0.1)",
    boxShadow:"0 2px 10px rgba(0,0,0,0.45)",
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    transition:"all 0.15s", flexShrink:0,
    ...extra,
  });

  return (
    <div style={{ position:"absolute", right:12, bottom:94, zIndex:810, display:"flex", flexDirection:"column", gap:9 }}>

      {/* Compass */}
      <button onClick={onResetNorth} title="Reset North" style={btn()} className="btn-tap">
        <svg width="26" height="26" viewBox="0 0 26 26" style={{ transform:`rotate(${-heading}deg)`, transition:"transform 0.4s ease" }}>
          <polygon points="13,3 16,13 13,11 10,13" fill="#ef4444"/>
          <polygon points="13,23 16,13 13,15 10,13" fill="#475569"/>
          <circle cx="13" cy="13" r="2.5" fill="#f1f5f9"/>
        </svg>
      </button>

      {/* 3D tilt */}
      <button onClick={onTogglePitch} title="Toggle 3D" style={btn({ background: pitch > 10 ? "rgba(26,115,232,0.2)" : "rgba(10,14,26,0.92)", border: pitch > 10 ? "1.5px solid rgba(26,115,232,0.4)" : "1.5px solid rgba(255,255,255,0.1)" })} className="btn-tap">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M1 14 L9 4 L17 14" stroke={pitch > 10 ? "#4285f4" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 14 L9 8 L15 14" stroke={pitch > 10 ? "#4285f4" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
          <line x1="1" y1="14" x2="17" y2="14" stroke={pitch > 10 ? "#4285f4" : "#64748b"} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Locate driver */}
      {hasDriver && (
        <button onClick={onCenterDriver} title="Center on me" style={btn({ border:"1.5px solid rgba(26,115,232,0.3)" })} className="btn-tap">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3.5" fill="#4285f4"/>
            <circle cx="9" cy="9" r="6.5" stroke="#4285f4" strokeWidth="1.5" fill="none"/>
            <line x1="9" y1="1" x2="9" y2="4" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="9" y1="14" x2="9" y2="17" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="1" y1="9" x2="4" y2="9" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="14" y1="9" x2="17" y2="9" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── BOTTOM ACTION BAR ─────────────────────────────────────────────────────────

function BottomBar({
  stopCount, hasRoute, mode, routeStats,
  onShowStops, onRunRoute, onSetExit, onClearExit,
  isPickingDest, hasExit,
}: {
  stopCount:number; hasRoute:boolean; mode:"fastest"|"priority";
  routeStats:{dist:string;time:string}|null;
  onShowStops:()=>void; onRunRoute:()=>void;
  onSetExit:()=>void; onClearExit:()=>void;
  isPickingDest:boolean; hasExit:boolean;
}) {
  return (
    <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:820, background:"rgba(10,14,26,0.97)", backdropFilter:"blur(22px)", borderTop:"1px solid rgba(255,255,255,0.07)", padding:"10px 12px calc(max(env(safe-area-inset-bottom,0px),10px) + 10px)", boxShadow:"0 -4px 24px rgba(0,0,0,0.4)" }}>
      {hasRoute && routeStats && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px", background:"rgba(26,115,232,0.1)", border:"1px solid rgba(26,115,232,0.2)", borderRadius:10, marginBottom:9, animation:"slideUp 0.18s ease" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="2.5" cy="12.5" r="2" fill="#4285f4" opacity="0.7"/>
            <circle cx="12.5" cy="2.5" r="2" fill="#4285f4"/>
            <path d="M2.5 10.5 C2.5 6 12.5 9 12.5 4.5" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
          <span style={{ fontSize:15, fontWeight:900, color:"#f1f5f9" }}>{routeStats.dist}</span>
          <span style={{ fontSize:12, color:"#475569" }}>·</span>
          <span style={{ fontSize:13, fontWeight:600, color:"#94a3b8" }}>{routeStats.time}</span>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background: mode === "priority" ? "#f97316" : "#22c55e" }} />
            <span style={{ fontSize:9, fontWeight:800, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em" }}>{mode === "priority" ? "Priority" : "Fastest"}</span>
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:9, alignItems:"center" }}>
        {/* Stop list */}
        <button onClick={onShowStops} disabled={stopCount === 0}
          style={{ height:52, minWidth:52, borderRadius:14, flexShrink:0, background: stopCount > 0 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)", border:`1.5px solid ${stopCount > 0 ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)"}`, color: stopCount > 0 ? "#f1f5f9" : "#334155", display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"0 13px", cursor: stopCount > 0 ? "pointer" : "not-allowed", transition:"all 0.15s" }}
          className="btn-tap">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="4" width="14" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="8" width="10" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor"/>
          </svg>
          {stopCount > 0 && <span style={{ fontSize:15, fontWeight:900, minWidth:18, textAlign:"center" }}>{stopCount}</span>}
        </button>
        {/* Exit flag */}
        <button onClick={isPickingDest ? onClearExit : onSetExit}
          style={{ height:52, width:52, borderRadius:14, flexShrink:0, background: isPickingDest ? "rgba(124,58,237,0.28)" : hasExit ? "rgba(124,58,237,0.14)" : "rgba(255,255,255,0.05)", border:`1.5px solid ${isPickingDest ? "rgba(167,139,250,0.6)" : hasExit ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.09)"}`, color: isPickingDest ? "#c4b5fd" : hasExit ? "#a78bfa" : "#475569", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.15s" }}
          className="btn-tap">
          {isPickingDest ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2 L14 14M14 2 L2 14" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 16V3M4 3 L15 7 L4 12 Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        {/* Primary CTA */}
        <button onClick={onRunRoute}
          style={{ flex:1, height:52, borderRadius:14, background: hasRoute ? "linear-gradient(135deg,#1a73e8,#0d5fc9)" : "linear-gradient(135deg,#00c853,#00a846)", border:"none", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow: hasRoute ? "0 3px 14px rgba(26,115,232,0.4)" : "0 3px 14px rgba(0,200,83,0.4)", transition:"all 0.15s", letterSpacing:"0.04em" }}
          className="btn-tap">
          {hasRoute ? (
            <><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 8 A6 6 0 1 1 8 2" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/><polyline points="11,0 8,3 11,6" fill="white" stroke="white" strokeWidth="1.5"/></svg>RECALCULATE</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="3,2 14,8 3,14" fill="white"/></svg>START ROUTE</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── STOP LIST DRAWER ──────────────────────────────────────────────────────────

function StopDrawer({ orderedBins, mode, selectedBinId, onSelect, onClose }: {
  orderedBins:any[]; mode:"fastest"|"priority"; selectedBinId:number|null;
  onSelect:(id:number)=>void; onClose:()=>void;
}) {
  const uturnCount = orderedBins.filter((b:any) => b.requiresUturn).length;
  return (
    <div style={{ position:"absolute", inset:0, zIndex:950, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(3px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position:"absolute", bottom:0, left:0, right:0, background:"#0a0e1a", borderRadius:"20px 20px 0 0", border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 -8px 40px rgba(0,0,0,0.6)", animation:"drawerIn 0.3s cubic-bezier(0.32,0.72,0,1)", maxHeight:"76vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, background:"rgba(255,255,255,0.18)", borderRadius:2 }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 18px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <span style={{ fontSize:16, fontWeight:800, color:"#f1f5f9" }}>{orderedBins.length} Stops</span>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:2 }}>
              <span style={{ fontSize:11, color:"#64748b" }}>{mode === "priority" ? "Priority order" : "Fastest route"}</span>
              {uturnCount > 0 && <span style={{ fontSize:9, fontWeight:800, color:"#fbbf24", background:"rgba(251,191,36,0.13)", border:"1px solid rgba(251,191,36,0.22)", padding:"1px 6px", borderRadius:20 }}>↩ {uturnCount} U-turn{uturnCount > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.07)", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:17 }} className="btn-tap">✕</button>
        </div>
        <div className="dmgl-scroll" style={{ overflowY:"auto", flex:1, padding:"4px 0 24px" }}>
          {orderedBins.map((bin:any, idx:number) => {
            const color = FC(bin.fillLevel);
            const isSel = bin.id === selectedBinId;
            const isUt = !!bin.requiresUturn;
            const urg = bin.fillLevel >= 80;
            return (
              <div key={bin.id} onClick={() => { onSelect(bin.id); onClose(); }} className="stop-row"
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 18px", background: isSel ? "rgba(26,115,232,0.12)" : "transparent", borderLeft:`3px solid ${isUt ? "#fbbf24" : isSel ? "#1a73e8" : "transparent"}`, borderBottom:"1px solid rgba(255,255,255,0.04)", cursor:"pointer", transition:"background 0.1s", minHeight:58 }}>
                <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, background: isSel ? "#1a73e8" : urg ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)", border:`2px solid ${isSel ? "#4285f4" : urg ? "#ef4444" : "rgba(255,255,255,0.12)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color: isSel ? "#fff" : urg ? "#f87171" : "#94a3b8" }}>{idx+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:600, color:"#f1f5f9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bin.name ?? `Bin ${bin.id}`}</span>
                    {isUt && <span style={{ fontSize:9, color:"#fbbf24", fontWeight:800, background:"rgba(251,191,36,0.12)", padding:"1px 5px", borderRadius:7, flexShrink:0 }}>↩ U-turn</span>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${bin.fillLevel}%`, height:"100%", background:`linear-gradient(90deg,${color}99,${color})`, borderRadius:2 }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color, flexShrink:0 }}>{bin.fillLevel}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PICKING TOAST ─────────────────────────────────────────────────────────────

function PickingToast() {
  return (
    <div style={{ position:"absolute", top:60, left:"50%", zIndex:900, transform:"translateX(-50%)", background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", padding:"9px 20px", borderRadius:20, fontSize:12, fontWeight:700, boxShadow:"0 5px 20px rgba(124,58,237,0.5)", whiteSpace:"nowrap", animation:"toastPop 0.22s ease", pointerEvents:"none", display:"flex", alignItems:"center", gap:7 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="2.5" fill="white" opacity="0.9"/>
        <circle cx="6" cy="6" r="5" stroke="white" strokeWidth="1" fill="none" opacity="0.45"/>
      </svg>
      Tap map to set exit point
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function DriverMapDisplayGL({
  bins, allBins, driverPos, heading, selectedBinId, setSelectedBinId,
  routeKey, mode, maxDetour, useFence, mapStyle, onRouteUpdate, isTracking,
  bypassRouteFC,
}: DriverMapDisplayGLProps) {
  const displayBins = allBins && allBins.length > 0 ? allBins : bins;
  const mapRef = useRef<MapRef>(null);

  const [orderedBins,    setOrderedBins]    = useState<any[]>([]);
  const [routingPos,     setRoutingPos]     = useState<[number,number]|null>(null);
  const [destinationPos, setDestinationPos] = useState<[number,number]|null>(null);
  const [pickingDest,    setPickingDest]    = useState(false);
  const [zoom,           setZoom]           = useState(17);
  const [pitch,          setPitch]          = useState(0);
  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [showDrawer,     setShowDrawer]     = useState(false);
  const [routeStats,     setRouteStats]     = useState<{dist:string;time:string}|null>(null);

  const handleRouteUpdate = useCallback((stats:{dist:string;time:string;uturnCount?:number}) => {
    setRouteStats({ dist:stats.dist, time:stats.time });
    onRouteUpdate(stats);
  }, [onRouteUpdate]);

  useEffect(() => {
    if (driverPos) setRoutingPos(driverPos);
    setOrderedBins([]);
    setRouteStats(null);
  }, [routeKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (driverPos && !routingPos) setRoutingPos(driverPos);
  }, [driverPos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || !driverPos || !isTracking || !mapLoaded) return;
    mapRef.current.easeTo({ center:[driverPos[1],driverPos[0]], bearing:heading, duration:600, easing:t=>t });
  }, [driverPos, heading, isTracking, mapLoaded]);

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!pickingDest) return;
    setDestinationPos([e.lngLat.lat, e.lngLat.lng]);
    setPickingDest(false);
  }, [pickingDest]);

  const resetNorth   = () => { mapRef.current?.easeTo({bearing:0,pitch:0,duration:500}); setPitch(0); };
  const togglePitch  = () => { const p = mapRef.current?.getPitch() ?? 0; const next = p > 10 ? 0 : 45; mapRef.current?.easeTo({pitch:next,duration:500}); setPitch(next); };
  const centerDriver = () => { if (!driverPos || !mapRef.current) return; mapRef.current.easeTo({center:[driverPos[1],driverPos[0]],zoom:17,bearing:heading,duration:700}); };

  const hasRoute = orderedBins.length > 0;
  const nextBin  = orderedBins[0] ?? null;

  return (
    <div
      className="absolute inset-0 md:relative md:flex-1 h-full order-1 overflow-hidden"
      style={{ isolation:"isolate" }}
    >
      <style>{CSS}</style>

      <Map
        ref={mapRef} mapLib={maplibregl} mapStyle={mapStyle}
        initialViewState={{ longitude:LUPON_CENTER[1], latitude:LUPON_CENTER[0], zoom:17, bearing:0, pitch:0 }}
        maxZoom={22} style={{ width:"100%", height:"100%" }}
        dragRotate touchZoomRotate pitchWithRotate keyboard
        cursor={pickingDest ? "crosshair" : "grab"}
        onClick={onMapClick}
        onZoom={e  => setZoom(e.viewState.zoom)}
        onPitch={e => setPitch(e.viewState.pitch)}
        onLoad={() => setMapLoaded(true)}
      >
        {mapLoaded && (
          <>
            {driverPos      && <DriverMarker pos={driverPos} />}
            {destinationPos && <ExitMarker   pos={destinationPos} />}
            {displayBins.map((bin:any) => (
              <BinMarker key={bin.id} bin={bin} zoom={zoom}
                isSelected={selectedBinId === bin.id}
                onClick={() => setSelectedBinId(bin.id)}
              />
            ))}
            {driverPos && (
              <RoutingLayerGL
                key={`route-${routeKey}-${mode}`}
                driverPos={driverPos} bins={bins} selectedBinId={selectedBinId}
                routeKey={routeKey} mode={mode} maxDetour={maxDetour}
                useFence={useFence} onRouteUpdate={handleRouteUpdate}
                onOrderUpdate={setOrderedBins} heading={heading}
                routingPos={routingPos} destinationPos={destinationPos}
              />
            )}
            {/* Bypass route purple overlay */}
            {bypassRouteFC && (
              <>
                <Source id="bypass-glow" type="geojson" data={bypassRouteFC}>
                  <Layer id="bypass-glow-layer" type="line"
                    paint={{ "line-color":"#7c3aed", "line-width":12, "line-opacity":0.16, "line-blur":7 }}
                    layout={{ "line-join":"round", "line-cap":"round" }}
                  />
                </Source>
                <Source id="bypass-line" type="geojson" data={bypassRouteFC}>
                  <Layer id="bypass-line-layer" type="line"
                    paint={{ "line-color":"#a78bfa", "line-width":3.5, "line-opacity":0.88, "line-dasharray":[6,4] }}
                    layout={{ "line-join":"round", "line-cap":"round" }}
                  />
                </Source>
              </>
            )}
          </>
        )}
      </Map>

      <TopBar isTracking={isTracking} heading={heading} stopCount={orderedBins.length} hasRoute={hasRoute} />

      {nextBin && hasRoute && (
        <NextStopCard bin={nextBin} stopNumber={1} totalStops={orderedBins.length} routeStats={routeStats} />
      )}

      <RightFAB
        heading={isTracking ? heading : 0}
        pitch={pitch}
        onResetNorth={resetNorth}
        onTogglePitch={togglePitch}
        onCenterDriver={centerDriver}
        hasDriver={!!driverPos}
      />

      <BottomBar
        stopCount={orderedBins.length} hasRoute={hasRoute} mode={mode} routeStats={routeStats}
        onShowStops={() => setShowDrawer(true)}
        onRunRoute={() => window.dispatchEvent(new CustomEvent("ecosort:runRoute"))}
        onSetExit={() => setPickingDest(true)}
        onClearExit={() => { setDestinationPos(null); setPickingDest(false); }}
        isPickingDest={pickingDest} hasExit={!!destinationPos}
      />

      {pickingDest && <PickingToast />}

      {showDrawer && (
        <StopDrawer
          orderedBins={orderedBins} mode={mode} selectedBinId={selectedBinId}
          onSelect={setSelectedBinId} onClose={() => setShowDrawer(false)}
        />
      )}
    </div>
  );
}