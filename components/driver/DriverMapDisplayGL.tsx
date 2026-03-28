"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import RoutingLayerGL from "./RoutingLayerGL";
import { LUPON_CENTER } from "../map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverMapDisplayGLProps {
  bins:             any[];
  driverPos:        [number, number] | null;
  heading:          number;
  selectedBinId:    number | null;
  setSelectedBinId: (id: number) => void;
  routeKey:         number;
  mode:             "fastest" | "priority";
  maxDetour:        number;
  useFence:         boolean;
  mapStyle:         StyleSpecification;
  onRouteUpdate:    (stats: { dist: string; time: string }) => void;
  isTracking:       boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// BIN FILL COLOR
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

function StopOrderLegend({
  orderedBins, mode, onSelect, selectedBinId,
}: {
  orderedBins: any[]; mode: "fastest" | "priority";
  onSelect: (id: number) => void; selectedBinId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (orderedBins.length === 0) return null;

  const accent    = mode === "priority" ? "#f97316" : "#059669";
  const accentBg  = mode === "priority" ? "rgba(249,115,22,.12)" : "rgba(5,150,105,.12)";
  const uturnCount = orderedBins.filter((b: any) => b.requiresUturn).length;

  return (
    <div style={{
      position: "absolute", top: 16, right: 16, zIndex: 1000,
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)",
      borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.18)",
      border: `1.5px solid ${accent}44`, minWidth: collapsed ? "auto" : 220,
      maxWidth: 240, overflow: "hidden", fontFamily: "sans-serif", transition: "min-width .2s",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px", borderBottom: collapsed ? "none" : `1px solid ${accent}33`,
        background: accentBg, cursor: "pointer", userSelect: "none",
      }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="3" cy="13" r="2" fill={accent} />
            <circle cx="13" cy="3" r="2" fill={accent} />
            <path d="M3 11 C3 7 13 9 13 5" stroke={accent} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: ".06em", textTransform: "uppercase" }}>
            {collapsed ? `${orderedBins.length} stops` : "A* Route Order"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!collapsed && uturnCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 20, padding: "1px 6px" }}>
              ↩ {uturnCount}
            </span>
          )}
          <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{collapsed ? "▼" : "▲"}</span>
        </div>
      </div>

      {!collapsed && (
        <ul style={{ margin: 0, padding: "6px 0 8px", listStyle: "none" }}>
          {orderedBins.map((bin: any, idx: number) => {
            const urgent  = bin.fillLevel >= 80;
            const isSel   = bin.id === selectedBinId;
            const isUt    = !!bin.requiresUturn;
            const badgeBg = isSel ? "#2563eb" : urgent ? "#dc2626" : accent;
            return (
              <li key={bin.id} onClick={() => onSelect(bin.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "5px 14px",
                cursor: "pointer", background: isSel ? `${accent}18` : "transparent",
                transition: "background .15s", borderLeft: isUt ? "3px solid #f59e0b" : "3px solid transparent",
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
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {bin.name ?? `Bin ${bin.id}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: urgent ? "#dc2626" : "#64748b" }}>
                    {urgent ? "⚠ " : ""}{bin.fillLevel}% full
                    {isUt && <span style={{ color: "#d97706", fontWeight: 700, marginLeft: 4 }}>· ↩ U-turn</span>}
                  </p>
                </div>
                {idx < orderedBins.length - 1 && <span style={{ fontSize: 10, color: "#94a3b8" }}>›</span>}
              </li>
            );
          })}
          <li style={{ borderTop: `1px solid ${accent}22`, margin: "4px 14px 0", paddingTop: 6, fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: ".04em" }}>
            {orderedBins.length} STOPS · {mode === "priority" ? "PRIORITY" : "FASTEST"} MODE
            {uturnCount > 0 && <span style={{ color: "#d97706", marginLeft: 6 }}>· {uturnCount} U-TURN{uturnCount > 1 ? "S" : ""}</span>}
          </li>
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPASS BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function CompassButton({ heading, onReset }: { heading: number; onReset: () => void }) {
  return (
    <button onClick={onReset} title="Reset to North" style={{
      position: "absolute", bottom: 100, right: 16, zIndex: 1000,
      width: 44, height: 44, borderRadius: "50%",
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)",
      border: "1.5px solid rgba(0,0,0,0.12)", boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
    }}>
      <svg width="26" height="26" viewBox="0 0 26 26"
        style={{ transform: `rotate(${-heading}deg)`, transition: "transform 0.4s ease" }}>
        <polygon points="13,2 16,13 13,11 10,13" fill="#ef4444" />
        <polygon points="13,24 16,13 13,15 10,13" fill="#94a3b8" />
        <circle cx="13" cy="13" r="2" fill="#1e293b" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BIN MARKER
// ─────────────────────────────────────────────────────────────────────────────

function BinMarkerGL({
  bin, isSelected, onClick, zoom,
}: { bin: any; isSelected: boolean; onClick: () => void; zoom: number }) {
  if (zoom < 14) return null;

  const color = fillColor(bin.fillLevel);
  const name  = bin.name?.length > 11 ? bin.name.substring(0, 10) + "…" : bin.name;
  const r     = 6;
  const circ  = 2 * Math.PI * r;
  const dash  = (bin.fillLevel / 100) * circ;

  return (
    <Marker longitude={bin.lng} latitude={bin.lat} anchor="bottom" onClick={onClick}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
        {zoom >= 16 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 8px", borderRadius: 8, marginBottom: 4,
            background: isSelected ? "#1e293b" : "rgba(255,255,255,0.95)",
            border: `1.5px solid ${isSelected ? "#475569" : "#e2e8f0"}`,
            boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.18)",
            fontFamily: "'DM Mono','Fira Code',monospace",
            transform: isSelected ? "scale(1.05)" : "scale(1)",
            transition: "all .2s", whiteSpace: "nowrap",
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
              <circle cx="9" cy="9" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: isSelected ? "#fff" : "#1e293b" }}>{name}</span>
            <span style={{ width: 1, height: 12, background: "#cbd5e1", opacity: 0.6 }} />
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
              background: color, color: bin.fillLevel >= 40 && bin.fillLevel < 70 ? "#1e293b" : "#fff",
            }}>
              {bin.fillLevel}%
            </span>
          </div>
        )}
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: color, border: `2px solid ${isSelected ? "#2563eb" : "#fff"}`,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(37,99,235,0.4), 0 2px 6px rgba(0,0,0,0.3)"
            : "0 2px 6px rgba(0,0,0,0.25)",
          transition: "all .2s", transform: isSelected ? "scale(1.3)" : "scale(1)",
        }} />
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER MARKER  (arrow always faces up — map rotates to heading)
// ─────────────────────────────────────────────────────────────────────────────

function DriverMarkerGL({ pos }: { pos: [number, number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "#2563eb", border: "4px solid #fff",
        boxShadow: "0 4px 16px rgba(37,99,235,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderBottom: "11px solid #fff",
          marginBottom: 2,
        }} />
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
        background: "#7c3aed", border: "2.5px solid #c4b5fd",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 1,
        boxShadow: "0 2px 10px rgba(0,0,0,.4)",
        fontSize: 9, fontWeight: 800, color: "#fff", fontFamily: "sans-serif",
      }}>
        <div style={{ fontSize: 14, lineHeight: 1 }}>⚑</div>
        <div>END</div>
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverMapDisplayGL({
  bins, driverPos, heading, selectedBinId, setSelectedBinId,
  routeKey, mode, maxDetour, useFence, mapStyle, onRouteUpdate, isTracking,
}: DriverMapDisplayGLProps) {
  const mapRef = useRef<MapRef>(null);

  // ── Gate: only render RoutingLayerGL once the style + GL context are ready.
  // Adding GeoJSON sources before onLoad silently fails in MapLibre — this was
  // the root cause of invisible route lines.
  const [mapLoaded, setMapLoaded] = useState(false);

  const [orderedBins,    setOrderedBins]    = useState<any[]>([]);
  const [routingPos,     setRoutingPos]     = useState<[number, number] | null>(null);
  const [destinationPos, setDestinationPos] = useState<[number, number] | null>(null);
  const [pickingDest,    setPickingDest]    = useState(false);
  const [zoom,           setZoom]           = useState(17);

  // Lock routing position at recalc time; never updated by live GPS drift
  useEffect(() => {
    if (driverPos) setRoutingPos(driverPos);
    setOrderedBins([]);
  }, [routeKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (driverPos && !routingPos) setRoutingPos(driverPos);
  }, [driverPos, routingPos]);

  // Follow driver + rotate map to heading while tracking
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverPos || !isTracking) return;
    map.easeTo({ center: [driverPos[1], driverPos[0]], bearing: heading, duration: 800, easing: t => t });
  }, [driverPos, heading, isTracking]);

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!pickingDest) return;
    setDestinationPos([e.lngLat.lat, e.lngLat.lng]);
    setPickingDest(false);
  }, [pickingDest]);

  const resetNorth = () => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });

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
        {driverPos && <DriverMarkerGL pos={driverPos} />}
        {destinationPos && <DestMarkerGL pos={destinationPos} />}

        {bins.map((bin: any) => (
          <BinMarkerGL
            key={bin.id} bin={bin}
            isSelected={selectedBinId === bin.id}
            onClick={() => setSelectedBinId(bin.id)}
            zoom={zoom}
          />
        ))}

        {/* Only mount RoutingLayerGL after map style fully loaded */}
        {mapLoaded && driverPos && (
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
      </Map>

      {/* Overlays */}
      {driverPos && (
        <StopOrderLegend
          orderedBins={orderedBins} mode={mode}
          onSelect={setSelectedBinId} selectedBinId={selectedBinId}
        />
      )}

      <div style={{ position: "absolute", bottom: 152, right: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={() => setPickingDest(p => !p)}
          title={pickingDest ? "Cancel" : "Set exit / destination"}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: pickingDest ? "#7c3aed" : "rgba(255,255,255,0.96)",
            backdropFilter: "blur(8px)",
            border: pickingDest ? "1.5px solid #c4b5fd" : "1.5px solid rgba(0,0,0,0.12)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.18)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: pickingDest ? "#fff" : "#374151", fontSize: 18, transition: "all .2s",
          }}
        >⚑</button>
        {destinationPos && !pickingDest && (
          <button
            onClick={() => setDestinationPos(null)}
            title="Clear exit point"
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)",
              border: "1.5px solid rgba(239,68,68,0.4)", boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#ef4444", fontSize: 14, fontWeight: 700, transition: "all .2s",
            }}
          >✕</button>
        )}
      </div>

      {pickingDest && (
        <div style={{
          position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "#7c3aed", color: "#fff",
          padding: "8px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          fontFamily: "sans-serif", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          Tap anywhere on the map to set exit point
        </div>
      )}

      <CompassButton heading={isTracking ? heading : 0} onReset={resetNorth} />

      <button
        onClick={() => { const m = mapRef.current; if (m) m.easeTo({ pitch: m.getPitch() > 0 ? 0 : 45, duration: 500 }); }}
        title="Toggle 3D pitch"
        style={{
          position: "absolute", bottom: 56, right: 16, zIndex: 1000,
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)",
          border: "1.5px solid rgba(0,0,0,0.12)", boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, transition: "all .2s",
        }}
      >⬟</button>
    </div>
  );
}