"use client";

// DriverMapDisplayGL.tsx — Google Maps-style driver navigation UI
//
// Design principles:
//   • Full-bleed map — zero chrome around edges
//   • ALL controls reachable from bottom with one thumb (bottom 120px zone)
//   • Next-stop card slides up above bottom bar during active route
//   • Stop list in swipeable bottom drawer — not a right-side panel
//   • Top bar is minimal + semi-transparent — auto-hides info
//   • Every button >= 52px touch target, no text < 13px while driving
//   • Right-side controls column (compass/3D/locate) — right thumb zone
//   • Safe colors: green = good, amber = medium, red = urgent/full

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import RoutingLayerGL from "./RoutingLayerGL";
import type { StyleSpecification } from "maplibre-gl";
import { LUPON_CENTER } from "../map/MapAssets";

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
  onRouteUpdate:    (stats: { dist: string; time: string }) => void;
  isTracking:       boolean;
  onToggleTracking?: () => void;
  onOpenDashboard:  () => void;
}

const FC = (n: number) =>
  n >= 90 ? "#ef4444" : n >= 70 ? "#f97316" : n >= 40 ? "#eab308" : "#22c55e";

const DIRECTIONS = ["N","NE","E","SE","S","SW","W","NW"];
const toCardinal = (deg: number) => DIRECTIONS[Math.round(deg / 45) % 8];

const CSS = `
  @keyframes driverPulse {
    0%   { transform: scale(0.85); opacity: 0.9; }
    100% { transform: scale(2.4);  opacity: 0;   }
  }
  @keyframes slideUp {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes drawerIn {
    from { transform: translateY(100%); }
    to   { transform: translateY(0);    }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) scale(0.92) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) scale(1)    translateY(0);   }
  }
  @keyframes nextIn {
    from { transform: translateY(10px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .dmgl-btn-press:active { transform: scale(0.93); }
  .dmgl-scroll::-webkit-scrollbar { display: none; }
  .dmgl-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  .dmgl-stop-row:active { background: rgba(26,115,232,0.1) !important; }
`;

// ── DRIVER MARKER ─────────────────────────────────────────────────────────────

function DriverMarkerGL({ pos }: { pos: [number, number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
      <div style={{ position: "relative", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          position: "absolute", width: 52, height: 52, borderRadius: "50%",
          background: "rgba(26,115,232,0.28)",
          animation: "driverPulse 2.2s ease-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 30, height: 30, borderRadius: "50%",
          background: "rgba(26,115,232,0.18)",
          border: "1.5px solid rgba(26,115,232,0.45)",
          pointerEvents: "none",
        }} />
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "linear-gradient(145deg,#4285f4,#1557b0)",
          border: "3.5px solid #ffffff",
          boxShadow: "0 3px 14px rgba(26,115,232,0.75), 0 0 0 1.5px rgba(26,115,232,0.3)",
          zIndex: 1, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderBottom: "7px solid rgba(255,255,255,0.9)",
            marginBottom: 2,
          }} />
        </div>
      </div>
    </Marker>
  );
}

// ── BIN MARKER ───────────────────────────────────────────────────────────────

function BinMarkerGL({ bin, stopNumber, isSelected, onClick, zoom }: {
  bin: any; stopNumber?: number; isSelected: boolean; onClick: () => void; zoom: number;
}) {
  if (zoom < 13) return null;
  const color  = FC(bin.fillLevel);
  const urgent = bin.fillLevel >= 80;
  const R = 10, circ = 2 * Math.PI * R;
  const dash = (bin.fillLevel / 100) * circ;

  return (
    <Marker longitude={bin.lng} latitude={bin.lat} anchor="bottom"
      onClick={e => { e.originalEvent.stopPropagation(); onClick(); }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
        {zoom >= 15 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px 6px 8px", borderRadius: 22, marginBottom: 5,
            background: isSelected ? "linear-gradient(135deg,#1a73e8,#0d5fc9)" : "rgba(10,14,26,0.93)",
            backdropFilter: "blur(12px)",
            border: `1.5px solid ${isSelected ? "rgba(255,255,255,0.35)" : urgent ? color + "55" : "rgba(255,255,255,0.12)"}`,
            boxShadow: isSelected ? "0 6px 20px rgba(26,115,232,0.5)" : urgent ? `0 4px 14px ${color}40` : "0 3px 10px rgba(0,0,0,0.55)",
            transform: isSelected ? "scale(1.06)" : "scale(1)",
            transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            whiteSpace: "nowrap", maxWidth: 180,
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
              <circle cx="13" cy="13" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5"/>
              <circle cx="13" cy="13" r={R} fill="none" stroke={color} strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "#fff" : "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90, fontFamily: "system-ui" }}>
              {bin.name ?? `Bin ${bin.id}`}
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: urgent ? color : "rgba(255,255,255,0.12)", color: urgent ? "#fff" : color, flexShrink: 0, fontFamily: "system-ui" }}>
              {bin.fillLevel}%
            </span>
          </div>
        )}
        <div style={{
          width: stopNumber ? 24 : 16, height: stopNumber ? 24 : 16, borderRadius: "50%",
          background: isSelected ? "linear-gradient(145deg,#4285f4,#1557b0)" : urgent ? color : "rgba(10,14,26,0.9)",
          border: `2.5px solid ${isSelected ? "#fff" : urgent ? "rgba(255,255,255,0.85)" : color}`,
          boxShadow: isSelected
            ? "0 0 0 3.5px rgba(26,115,232,0.45), 0 4px 10px rgba(0,0,0,0.5)"
            : `0 2px 7px rgba(0,0,0,0.45)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: isSelected ? "scale(1.3)" : "scale(1)",
          transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)", flexShrink: 0,
        }}>
          {stopNumber && <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : urgent ? "#fff" : "#f1f5f9", fontFamily: "system-ui", lineHeight: 1 }}>{stopNumber}</span>}
        </div>
        <div style={{ width: 2.5, height: 7, background: "rgba(0,0,0,0.35)", borderRadius: "0 0 2px 2px", marginTop: -1 }} />
      </div>
    </Marker>
  );
}

// ── DESTINATION MARKER ────────────────────────────────────────────────────────

function DestMarkerGL({ pos }: { pos: [number, number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="bottom">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ padding: "5px 13px", borderRadius: 12, marginBottom: 5, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(10px)", border: "1.5px solid #7c3aed", boxShadow: "0 4px 18px rgba(124,58,237,0.45)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", letterSpacing: "0.08em", fontFamily: "system-ui" }}>EXIT POINT</span>
        </div>
        <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
          <path d="M4 28V3" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
          <path d="M4 3 L20 8 L4 14 Z" fill="#7c3aed" opacity="0.9"/>
          <circle cx="4" cy="28" r="2" fill="#7c3aed" opacity="0.6"/>
        </svg>
      </div>
    </Marker>
  );
}

// ── TOP STATUS BAR ────────────────────────────────────────────────────────────

function TopBar({ isTracking }: { isTracking: boolean }) {
  return (
    <div style={{ position: "absolute", top: 110, right: 16, zIndex: 900, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
       <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.95)", borderRadius: 20, fontSize: 11, fontWeight: 800, color: isTracking ? "#10b981" : "#64748b", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", fontFamily: "system-ui", border: "1px solid rgba(0,0,0,0.05)" }}>{isTracking ? "GPS ON" : "GPS OFF"}</div>
    </div>
  );
}

// ── NEXT STOP CARD ────────────────────────────────────────────────────────────

function NextStopCard({ bin, stopNumber, totalStops, routeStats }: { bin: any; stopNumber: number; totalStops: number; routeStats: { dist: string; time: string } | null }) {
  const color  = FC(bin.fillLevel);
  const urgent = bin.fillLevel >= 80;
  return (
    <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 950, animation: "nextIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
      <div style={{ background: urgent ? "#ef4444" : "#1a73e8", borderRadius: 24, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        {/* Waze-style massive direction icon block */}
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18v-6a3 3 0 0 1 3-3h8M16 5l4 4-4 4"/></svg>
           <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, marginTop: 2, fontFamily: "system-ui" }}>STOP {stopNumber}</span>
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "system-ui", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {bin.name ?? `Bin #${bin.id}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "system-ui" }}>{bin.fillLevel}% FULL</span>
            {urgent && <span style={{ fontSize: 12, fontWeight: 900, background: "#fff", color: "#ef4444", padding: "3px 10px", borderRadius: 12, fontFamily: "system-ui" }}>URGENT</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAP CONTROLS COLUMN ───────────────────────────────────────────────────────

function MapControls({ heading, pitch, onResetNorth, onTogglePitch, onCenterDriver, hasDriver, onOpenDashboard, onShowStops, stopCount }: any) {
  const B = (extra?: any) => ({ width: 54, height: 54, borderRadius: 27, background: "#ffffff", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", ...extra });
  return (
    <div style={{ position: "absolute", right: 16, bottom: "calc(max(env(safe-area-inset-bottom, 20px), 20px) + 60px)", zIndex: 900, display: "flex", marginBottom: "10px", flexDirection: "column", gap: 14 }}>
      
      {/* Menu / Dashboard Modal Button */}
      <button onClick={onOpenDashboard} title="Settings" style={B({ background: "#10b981", border: "none", color: "white" })} className="dmgl-btn-press">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>

      {/* Stops Button */}
      <button onClick={onShowStops} title="Show Stops" style={B({ position: "relative", fontSize: 20 })} className="dmgl-btn-press">
        📋
        {stopCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "white", fontSize: 11, fontWeight: 900, padding: "2px 6px", borderRadius: 12, fontFamily: "system-ui" }}>{stopCount}</span>}
      </button>

      {hasDriver && (
        <button onClick={onCenterDriver} title="Center on me" style={B({ border: "1.5px solid #bfdbfe" })} className="dmgl-btn-press">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" fill="#4285f4"/>
            <circle cx="10" cy="10" r="7" stroke="#4285f4" strokeWidth="1.5" fill="none"/>
            <line x1="10" y1="1" x2="10" y2="4" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="10" y1="16" x2="10" y2="19" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="1" y1="10" x2="4" y2="10" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="10" x2="19" y2="10" stroke="#4285f4" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      
      <button onClick={onTogglePitch} title="Toggle 3D view" style={B({ background: pitch > 10 ? "#e0f2fe" : "#ffffff", border: pitch > 10 ? "1px solid #7dd3fc" : "1px solid rgba(0,0,0,0.05)" })} className="dmgl-btn-press">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
          <path d="M2 15 L10 5 L18 15" stroke={pitch > 10 ? "#4285f4" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 15 L10 9 L16 15" stroke={pitch > 10 ? "#4285f4" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
          <line x1="2" y1="15" x2="18" y2="15" stroke={pitch > 10 ? "#4285f4" : "#64748b"} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      <button onClick={onResetNorth} title="Reset North" style={B()} className="dmgl-btn-press">
        <svg width="30" height="30" viewBox="0 0 28 28" style={{ transform: `rotate(${-heading}deg)`, transition: "transform 0.4s ease" }}>
          <polygon points="14,3 17,14 14,12 11,14" fill="#ef4444"/>
          <polygon points="14,25 17,14 14,16 11,14" fill="#475569"/>
          <circle cx="14" cy="14" r="2.5" fill="#f1f5f9"/>
        </svg>
      </button>
    </div>
  );
}

// ── FLOATING ETA BADGE ────────────────────────────────────────────────────────

function FloatingETABadge({ routeStats, stopCount, onOpenDashboard }: any) {
  if (!routeStats) return null;
  return (
    <div onClick={onOpenDashboard} style={{ position: "absolute", bottom: "calc(max(env(safe-area-inset-bottom, 20px), 20px) + 60px)", left: 16, zIndex: 900, background: "#ffffff", padding: "8px 24px", marginBottom: "10px", borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", cursor: "pointer", border: "1px solid rgba(0,0,0,0.05)" }} className="dmgl-btn-press">
      <span style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", lineHeight: 1.1, fontFamily: "system-ui" }}>{routeStats.time}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#64748b", marginTop: 4, fontFamily: "system-ui" }}>{routeStats.dist} • {stopCount} stops</span>
    </div>
  );
}

// ── STOP LIST MODAL ───────────────────────────────────────────────────────────

function StopListDrawer({ orderedBins, mode, selectedBinId, onSelect, onClose }: { orderedBins: any[]; mode: "fastest" | "priority"; selectedBinId: number | null; onSelect: (id: number) => void; onClose: () => void }) {
  const uturnCount = orderedBins.filter((b: any) => b.requiresUturn).length;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.52)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "92%", maxWidth: 420, background: "#0a0e1a", borderRadius: "28px", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 10px 50px rgba(0,0,0,0.65)", animation: "toastIn 0.3s cubic-bezier(0.32,0.72,0,1)", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", fontFamily: "system-ui" }}>{orderedBins.length} Stops</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: "#64748b", fontFamily: "system-ui" }}>{mode === "priority" ? "Priority order" : "Fastest route"}</span>
              {uturnCount > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.25)", padding: "1px 7px", borderRadius: 20, fontFamily: "system-ui" }}>↩ {uturnCount} U-turn{uturnCount > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }} className="dmgl-btn-press">✕</button>
        </div>
        {/* Stops */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0 20px" }} className="dmgl-scroll">
          {orderedBins.map((bin: any, idx: number) => {
            const color = FC(bin.fillLevel);
            const isSel = bin.id === selectedBinId;
            const isUt  = !!bin.requiresUturn;
            const urg   = bin.fillLevel >= 80;
            return (
              <div key={bin.id} onClick={() => { onSelect(bin.id); onClose(); }} className="dmgl-stop-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", background: isSel ? "rgba(26,115,232,0.13)" : "transparent", borderLeft: `3.5px solid ${isUt ? "#fbbf24" : isSel ? "#1a73e8" : "transparent"}`, borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s", minHeight: 60 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: isSel ? "#1a73e8" : urg ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.06)", border: `2px solid ${isSel ? "#4285f4" : urg ? "#ef4444" : "rgba(255,255,255,0.14)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: isSel ? "#fff" : urg ? "#f87171" : "#94a3b8", fontFamily: "system-ui" }}>{idx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "system-ui" }}>{bin.name ?? `Bin ${bin.id}`}</span>
                    {isUt && <span style={{ fontSize: 9, color: "#fbbf24", fontWeight: 800, background: "rgba(251,191,36,0.13)", padding: "1px 6px", borderRadius: 8, fontFamily: "system-ui", flexShrink: 0 }}>↩ U-turn</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${bin.fillLevel}%`, height: "100%", background: `linear-gradient(90deg,${color}aa,${color})`, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0, fontFamily: "system-ui" }}>{bin.fillLevel}%</span>
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
    <div style={{ position: "absolute", top: 64, left: "50%", zIndex: 1000, transform: "translateX(-50%)", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", padding: "10px 22px", borderRadius: 22, fontSize: 13, fontWeight: 700, fontFamily: "system-ui", boxShadow: "0 6px 24px rgba(124,58,237,0.55)", whiteSpace: "nowrap", animation: "toastIn 0.25s ease", pointerEvents: "none", display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="3" fill="white" opacity="0.9"/>
        <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.2" fill="none" opacity="0.5"/>
      </svg>
      Tap map to set exit point
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function DriverMapDisplayGL({ bins, allBins, driverPos, heading, selectedBinId, setSelectedBinId, routeKey, mode, maxDetour, useFence, mapStyle, onRouteUpdate, isTracking, onOpenDashboard }: DriverMapDisplayGLProps) {
  const displayBins = allBins && allBins.length > 0 ? allBins : bins;
  const mapRef = useRef<MapRef>(null);
  const [orderedBins,    setOrderedBins]    = useState<any[]>([]);
  const [routingPos,     setRoutingPos]     = useState<[number, number] | null>(null);
  const [destinationPos, setDestinationPos] = useState<[number, number] | null>(null);
  const [pickingDest,    setPickingDest]    = useState(false);
  const [zoom,           setZoom]           = useState(17);
  const [pitch,          setPitch]          = useState(0);
  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [showDrawer,     setShowDrawer]     = useState(false);
  const [routeStats,     setRouteStats]     = useState<{ dist: string; time: string } | null>(null);

  const handleRouteUpdate = useCallback((stats: { dist: string; time: string }) => {
    setRouteStats(stats);
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
    mapRef.current.easeTo({ center: [driverPos[1], driverPos[0]], bearing: heading, duration: 600, easing: t => t });
  }, [driverPos, heading, isTracking, mapLoaded]);

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!pickingDest) return;
    setDestinationPos([e.lngLat.lat, e.lngLat.lng]);
    setPickingDest(false);
  }, [pickingDest]);

  const resetNorth   = () => { mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 }); setPitch(0); };
  const togglePitch  = () => { const p = mapRef.current?.getPitch() ?? 0; const next = p > 10 ? 0 : 45; mapRef.current?.easeTo({ pitch: next, duration: 500 }); setPitch(next); };
  const centerDriver = () => { if (!driverPos || !mapRef.current) return; mapRef.current.easeTo({ center: [driverPos[1], driverPos[0]], zoom: 17, bearing: heading, duration: 700 }); };

  const hasRoute   = orderedBins.length > 0;
  const nextBin    = orderedBins[0] ?? null;
  // const stopMap = new Map<number, number>();
  // orderedBins.forEach((b, i) => stopMap.set(b.id, i + 1));

  return (
    <div className="absolute inset-0 md:relative md:flex-1 h-full order-1 overflow-hidden">
      <style>{CSS}</style>
      <Map ref={mapRef} mapLib={maplibregl} mapStyle={mapStyle}
        initialViewState={{ longitude: LUPON_CENTER[1], latitude: LUPON_CENTER[0], zoom: 17, bearing: 0, pitch: 0 }}
        maxZoom={22} style={{ width: "100%", height: "100%" }}
        padding={{ top: 0, bottom: 120, left: 0, right: 0 }}
        dragRotate touchZoomRotate pitchWithRotate keyboard
        cursor={pickingDest ? "crosshair" : "grab"}
        onClick={onMapClick}
        onZoom={e  => setZoom(e.viewState.zoom)}
        onPitch={e => setPitch(e.viewState.pitch)}
        onLoad={() => setMapLoaded(true)}
      >
        {mapLoaded && (
          <>
            {driverPos      && <DriverMarkerGL pos={driverPos} />}
            {destinationPos && <DestMarkerGL  pos={destinationPos} />}
            {displayBins.map((bin: any) => (
              <BinMarkerGL key={bin.id} bin={bin} zoom={zoom}
                // stopNumber={stopMap.get(bin.id)}
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
          </>
        )}
      </Map>

      <TopBar isTracking={isTracking} />
      {nextBin && hasRoute && <NextStopCard bin={nextBin} stopNumber={1} totalStops={orderedBins.length} routeStats={routeStats} />}
      <MapControls heading={isTracking ? heading : 0} pitch={pitch} onResetNorth={resetNorth} onTogglePitch={togglePitch} onCenterDriver={centerDriver} hasDriver={!!driverPos} onOpenDashboard={onOpenDashboard} onShowStops={() => setShowDrawer(true)} stopCount={orderedBins.length} />
      <FloatingETABadge routeStats={routeStats} stopCount={orderedBins.length} onOpenDashboard={onOpenDashboard} />
      {pickingDest  && <PickingToast />}
      {showDrawer   && <StopListDrawer orderedBins={orderedBins} mode={mode} selectedBinId={selectedBinId} onSelect={setSelectedBinId} onClose={() => setShowDrawer(false)} />}
    </div>
  );
}