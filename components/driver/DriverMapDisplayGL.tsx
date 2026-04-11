"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import RoutingLayerGL from "./RoutingLayerGL";
import type { StyleSpecification } from "maplibre-gl";
import { LUPON_CENTER } from "../map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverMapDisplayGLProps {
  bins:             any[];   // routing targets (scheduled bins during travel order)
  allBins?:         any[];   // all DB bins for display markers (optional)
  driverPos:        [number, number] | null;
  heading:          number;
  selectedBinId:    number | null;
  setSelectedBinId: (id: number) => void;
  routeKey:         number;
  mode:             "fastest" | "priority";
  maxDetour:        number;
  useFence:         boolean;
  mapStyle:         StyleSpecification | string;   // always a URL string — no object sanitization needed
  onRouteUpdate:    (stats: { dist: string; time: string }) => void;
  isTracking:       boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fillColor(level: number): string {
  if (level >= 90) return "#ef4444";
  if (level >= 70) return "#f97316";
  if (level >= 40) return "#eab308";
  return "#22c55e";
}

// ─────────────────────────────────────────────────────────────────────────────
// STOP ORDER LEGEND
// ─────────────────────────────────────────────────────────────────────────────

function StopOrderLegend({ orderedBins, mode, onSelect, selectedBinId }: {
  orderedBins: any[]; mode: "fastest" | "priority";
  onSelect: (id: number) => void; selectedBinId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (orderedBins.length === 0) return null;

  const accent      = mode === "priority" ? "#f97316" : "#059669";
  const accentBg    = mode === "priority" ? "rgba(249,115,22,.1)" : "rgba(5,150,105,.1)";
  const uturnCount  = orderedBins.filter((b: any) => b.requiresUturn).length;

  return (
    <div style={{
      position: "absolute", top: 16, right: 16, zIndex: 1000,
      background: "rgba(15,23,42,0.92)", backdropFilter: "blur(12px)",
      borderRadius: 16, boxShadow: "0 4px 32px rgba(0,0,0,.5)",
      border: `1.5px solid ${accent}55`,
      minWidth: collapsed ? "auto" : 230, maxWidth: 250,
      overflow: "hidden", fontFamily: "sans-serif",
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px 8px", cursor: "pointer", userSelect: "none",
          borderBottom: collapsed ? "none" : `1px solid ${accent}33`,
          background: accentBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="3" cy="13" r="2" fill={accent}/>
            <circle cx="13" cy="3" r="2" fill={accent}/>
            <path d="M3 11 C3 7 13 9 13 5" stroke={accent} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: ".08em", textTransform: "uppercase" }}>
            {collapsed ? `${orderedBins.length} stops` : "A* Route Order"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!collapsed && uturnCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,.15)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 20, padding: "1px 6px" }}>
              ↩ {uturnCount}
            </span>
          )}
          <span style={{ fontSize: 11, color: accent }}>{collapsed ? "▼" : "▲"}</span>
        </div>
      </div>

      {/* Stops list */}
      {!collapsed && (
        <ul style={{ margin: 0, padding: "6px 0 8px", listStyle: "none" }}>
          {orderedBins.map((bin: any, idx: number) => {
            const urgent   = bin.fillLevel >= 80;
            const isSel    = bin.id === selectedBinId;
            const isUt     = !!bin.requiresUturn;
            const badgeBg  = isSel ? "#3b82f6" : urgent ? "#ef4444" : accent;
            return (
              <li key={bin.id} onClick={() => onSelect(bin.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "5px 14px",
                cursor: "pointer",
                background: isSel ? `${accent}20` : "transparent",
                transition: "background .15s",
                borderLeft: isUt ? "3px solid #f59e0b" : "3px solid transparent",
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: badgeBg,
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  boxShadow: isUt ? "0 0 0 2px #f59e0b" : "none",
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {bin.name ?? `Bin ${bin.id}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: urgent ? "#f87171" : "#94a3b8" }}>
                    {urgent ? "⚠ " : ""}{bin.fillLevel}%
                    {isUt && <span style={{ color: "#fbbf24", marginLeft: 4 }}>· ↩ U-turn</span>}
                  </p>
                </div>
              </li>
            );
          })}
          <li style={{ borderTop: "1px solid rgba(255,255,255,.08)", margin: "4px 14px 0", paddingTop: 6, fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
            {orderedBins.length} stops · {mode === "priority" ? "Priority" : "Fastest"}
            {uturnCount > 0 && <span style={{ color: "#fbbf24", marginLeft: 6 }}>· {uturnCount} U-turn{uturnCount > 1 ? "s" : ""}</span>}
          </li>
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPASS
// ─────────────────────────────────────────────────────────────────────────────

function CompassButton({ heading, onReset }: { heading: number; onReset: () => void }) {
  return (
    <button onClick={onReset} title="Reset North" style={{
      position: "absolute", bottom: 204, right: 16, zIndex: 1000,
      width: 44, height: 44, borderRadius: "50%",
      background: "rgba(15,23,42,0.9)", backdropFilter: "blur(8px)",
      border: "1.5px solid rgba(255,255,255,.15)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="26" height="26" viewBox="0 0 26 26"
        style={{ transform: `rotate(${-heading}deg)`, transition: "transform 0.4s ease" }}>
        <polygon points="13,2 16,13 13,11 10,13" fill="#ef4444"/>
        <polygon points="13,24 16,13 13,15 10,13" fill="#94a3b8"/>
        <circle cx="13" cy="13" r="2" fill="#f1f5f9"/>
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BIN MARKER
// ─────────────────────────────────────────────────────────────────────────────

function BinMarkerGL({ bin, isSelected, onClick, zoom }: {
  bin: any; isSelected: boolean; onClick: () => void; zoom: number;
}) {
  if (zoom < 14) return null;
  const color = fillColor(bin.fillLevel);
  const name  = bin.name?.length > 12 ? bin.name.substring(0, 11) + "…" : (bin.name ?? "");
  const r = 6, circ = 2 * Math.PI * r;
  const dash = (bin.fillLevel / 100) * circ;

  return (
    <Marker longitude={bin.lng} latitude={bin.lat} anchor="bottom" onClick={e => { e.originalEvent.stopPropagation(); onClick(); }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
        {zoom >= 16 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 8px", borderRadius: 8, marginBottom: 4,
            background: isSelected ? "#0f172a" : "rgba(15,23,42,0.88)",
            border: `1.5px solid ${isSelected ? "#3b82f6" : "rgba(255,255,255,.18)"}`,
            boxShadow: isSelected ? `0 4px 20px ${color}55` : "0 2px 10px rgba(0,0,0,.4)",
            backdropFilter: "blur(8px)",
            transform: isSelected ? "scale(1.06)" : "scale(1)",
            transition: "all .2s", whiteSpace: "nowrap",
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
              <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="2.5"/>
              <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#f1f5f9" }}>{name}</span>
            <span style={{ width: 1, height: 12, background: "rgba(255,255,255,.2)" }}/>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 20, background: color, color: "#fff" }}>
              {bin.fillLevel}%
            </span>
          </div>
        )}
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: color,
          border: `2.5px solid ${isSelected ? "#3b82f6" : "rgba(255,255,255,.9)"}`,
          boxShadow: isSelected
            ? `0 0 0 3px rgba(59,130,246,.5), 0 2px 8px rgba(0,0,0,.5)`
            : "0 2px 6px rgba(0,0,0,.4)",
          transform: isSelected ? "scale(1.4)" : "scale(1)", transition: "all .2s",
        }}/>
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER MARKER — pulsing blue dot
// ─────────────────────────────────────────────────────────────────────────────

function DriverMarkerGL({ pos }: { pos: [number, number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
      <div style={{ position: "relative", width: 40, height: 40 }}>
        {/* Pulse ring */}
        <div style={{
          position: "absolute", inset: -8, borderRadius: "50%",
          background: "rgba(37,99,235,.25)",
          animation: "pulse 2s ease-out infinite",
        }}/>
        <style>{`@keyframes pulse{0%{transform:scale(.8);opacity:.8}100%{transform:scale(1.6);opacity:0}}`}</style>
        {/* Main dot */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg,#3b82f6,#2563eb)",
          border: "3px solid #fff",
          boxShadow: "0 4px 20px rgba(37,99,235,.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Arrow pointing up — map rotates to heading */}
          <div style={{
            width: 0, height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderBottom: "12px solid #fff",
            marginBottom: 2,
          }}/>
        </div>
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESTINATION MARKER
// ─────────────────────────────────────────────────────────────────────────────

function DestMarkerGL({ pos }: { pos: [number, number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="bottom">
      <div style={{
        width: 36, height: 36, borderRadius: "8px 8px 2px 2px",
        background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
        border: "2px solid #c4b5fd",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 1,
        boxShadow: "0 4px 16px rgba(124,58,237,.5)",
        fontSize: 9, fontWeight: 800, color: "#fff", fontFamily: "sans-serif",
      }}>
        <div style={{ fontSize: 14, lineHeight: 1 }}>⚑</div>
        <div style={{ letterSpacing: ".05em" }}>END</div>
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverMapDisplayGL({
  bins, allBins, driverPos, heading, selectedBinId, setSelectedBinId,
  routeKey, mode, maxDetour, useFence, mapStyle, onRouteUpdate, isTracking,
}: DriverMapDisplayGLProps) {
  // Use allBins for display markers if provided, otherwise fall back to routing bins
  const displayBins = allBins && allBins.length > 0 ? allBins : bins;
  const mapRef = useRef<MapRef>(null);

  const [orderedBins,    setOrderedBins]    = useState<any[]>([]);
  const [routingPos,     setRoutingPos]     = useState<[number, number] | null>(null);
  const [destinationPos, setDestinationPos] = useState<[number, number] | null>(null);
  const [pickingDest,    setPickingDest]    = useState(false);
  const [zoom,           setZoom]           = useState(17);
  const [mapLoaded,      setMapLoaded]      = useState(false);

  // ── Lock routing position ─────────────────────────────────────────────────
  // routingPos is the snapped start-point for A* — only reset on explicit
  // routeKey change (new route/mode). GPS going null (tracking stopped) should
  // NOT null out routingPos, otherwise A* re-fires when tracking restarts.
  useEffect(() => {
    if (driverPos) setRoutingPos(driverPos);
    setOrderedBins([]);
  }, [routeKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only set initial position — never overwrite once set (prevents re-trigger on restart)
  useEffect(() => {
    if (driverPos && !routingPos) setRoutingPos(driverPos);
  }, [driverPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Follow driver ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !driverPos || !isTracking || !mapLoaded) return;
    mapRef.current.easeTo({
      center: [driverPos[1], driverPos[0]],
      bearing: heading,
      duration: 600,
      easing: t => t,
    });
  }, [driverPos, heading, isTracking, mapLoaded]);

  // ── Destination pick ──────────────────────────────────────────────────────
  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!pickingDest) return;
    setDestinationPos([e.lngLat.lat, e.lngLat.lng]);
    setPickingDest(false);
  }, [pickingDest]);

  const resetNorth = () => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  const togglePitch = () => {
    const p = mapRef.current?.getPitch() ?? 0;
    mapRef.current?.easeTo({ pitch: p > 0 ? 0 : 45, duration: 500 });
  };

  return (
    <div className="absolute inset-0 md:relative md:flex-1 h-full order-1 overflow-hidden">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={mapStyle}
        initialViewState={{
          longitude: LUPON_CENTER[1],
          latitude:  LUPON_CENTER[0],
          zoom: 17, bearing: 0, pitch: 0,
        }}
        maxZoom={22}
        style={{ width: "100%", height: "100%" }}
        dragRotate={true}
        touchZoomRotate={true}
        pitchWithRotate={true}
        keyboard={true}
        cursor={pickingDest ? "crosshair" : "grab"}
        onClick={onMapClick}
        onZoom={e => setZoom(e.viewState.zoom)}
        onLoad={() => setMapLoaded(true)}
      >
        {/* Only render children after map is loaded */}
        {mapLoaded && (
          <>
            {driverPos && <DriverMarkerGL pos={driverPos} />}
            {destinationPos && <DestMarkerGL pos={destinationPos} />}

            {displayBins.map((bin: any) => (
              <BinMarkerGL
                key={bin.id} bin={bin} zoom={zoom}
                isSelected={selectedBinId === bin.id}
                onClick={() => setSelectedBinId(bin.id)}
              />
            ))}

            {/* RoutingLayerGL renders GeoJSON sources + layers inside the map */}
            {driverPos && (
              <RoutingLayerGL
                key={`route-${routeKey}-${mode}`}
                driverPos={driverPos}
                bins={bins}
                selectedBinId={selectedBinId}
                routeKey={routeKey}
                mode={mode}
                maxDetour={maxDetour}
                useFence={useFence}
                onRouteUpdate={onRouteUpdate}
                onOrderUpdate={setOrderedBins}
                heading={heading}
                routingPos={routingPos}
                destinationPos={destinationPos}
              />
            )}
          </>
        )}
      </Map>

      {/* ── DOM OVERLAYS ─────────────────────────────────────────────────── */}

      {driverPos && (
        <StopOrderLegend
          orderedBins={orderedBins} mode={mode}
          onSelect={setSelectedBinId} selectedBinId={selectedBinId}
        />
      )}

      {/* Destination controls */}
      <div style={{ position: "absolute", bottom: 152, right: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => setPickingDest(p => !p)}
          title={pickingDest ? "Cancel" : "Set exit point"}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: pickingDest ? "#7c3aed" : "rgba(15,23,42,0.9)",
            backdropFilter: "blur(8px)",
            border: pickingDest ? "1.5px solid #c4b5fd" : "1.5px solid rgba(255,255,255,.18)",
            boxShadow: pickingDest ? "0 4px 16px rgba(124,58,237,.5)" : "0 2px 12px rgba(0,0,0,.4)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 18, transition: "all .2s",
          }}
        >⚑</button>

        {destinationPos && !pickingDest && (
          <button
            onClick={() => setDestinationPos(null)}
            title="Clear exit"
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(15,23,42,0.9)", backdropFilter: "blur(8px)",
              border: "1.5px solid rgba(239,68,68,.5)",
              boxShadow: "0 2px 12px rgba(0,0,0,.4)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#ef4444", fontSize: 16, fontWeight: 700, transition: "all .2s",
            }}
          >✕</button>
        )}
      </div>

      {/* Pitch toggle */}
      <button onClick={togglePitch} title="Toggle 3D" style={{
        position: "absolute", bottom: 100, right: 16, zIndex: 1000,
        width: 44, height: 44, borderRadius: "50%",
        background: "rgba(15,23,42,0.9)", backdropFilter: "blur(8px)",
        border: "1.5px solid rgba(255,255,255,.18)", boxShadow: "0 2px 12px rgba(0,0,0,.4)",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#94a3b8", fontSize: 18, transition: "all .2s",
      }}>⬟</button>

      <CompassButton heading={isTracking ? heading : 0} onReset={resetNorth} />

      {/* Destination pick hint */}
      {pickingDest && (
        <div style={{
          position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "#7c3aed", color: "#fff",
          padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          fontFamily: "sans-serif", boxShadow: "0 4px 20px rgba(124,58,237,.4)",
          pointerEvents: "none", whiteSpace: "nowrap",
          animation: "toastIn .2s ease",
        }}>
          <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          Tap the map to set your exit point
        </div>
      )}
    </div>
  );
}