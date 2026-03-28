"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet-rotate";          // must come after L import, before MapContainer mounts
import BinMarker from "./BinMarker";
import RoutingLayer from "./RoutingLayer";
import { LUPON_CENTER } from "../map/MapAssets";


// Destination marker icon (purple flag) — defined outside component for stability
const DEST_ICON = L.divIcon({
  className:  "",
  iconSize:   [36, 36],
  iconAnchor: [18, 36],
  html: `<div style="
    width:36px;height:36px;border-radius:8px 8px 2px 2px;
    background:#7c3aed;border:2.5px solid #c4b5fd;
    display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px;
    box-shadow:0 2px 10px rgba(0,0,0,.4);
    font-size:9px;font-weight:800;color:#fff;font-family:sans-serif;letter-spacing:.04em;
  "><div style="font-size:14px;line-height:1;">⚑</div><div>END</div></div>`,
});

// Safe wrapper — no-ops gracefully if leaflet-rotate didn't patch the instance
function setBearing(map: L.Map, deg: number) {
  if (typeof (map as any).setBearing === "function") {
    (map as any).setBearing(deg);
  }
}

// Enable right-click-drag to rotate (desktop equivalent of two-finger rotate)
function enableMouseRotate(map: L.Map) {
  const el = map.getContainer();
  let startX = 0;
  let startBearing = 0;
  let rotating = false;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 2) return;   // right-click only
    e.preventDefault();
    rotating    = true;
    startX      = e.clientX;
    startBearing = typeof (map as any).getBearing === "function"
      ? (map as any).getBearing()
      : 0;
    el.style.cursor = "grabbing";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!rotating) return;
    const delta = (e.clientX - startX) * 0.5;  // 0.5° per pixel — feel free to tune
    setBearing(map, startBearing + delta);
  };

  const onMouseUp = () => {
    rotating = false;
    el.style.cursor = "";
  };

  const onContextMenu = (e: Event) => e.preventDefault(); // suppress right-click menu

  el.addEventListener("mousedown",   onMouseDown);
  el.addEventListener("mousemove",   onMouseMove);
  el.addEventListener("mouseup",     onMouseUp);
  el.addEventListener("mouseleave",  onMouseUp);
  el.addEventListener("contextmenu", onContextMenu);

  // Return cleanup
  return () => {
    el.removeEventListener("mousedown",   onMouseDown);
    el.removeEventListener("mousemove",   onMouseMove);
    el.removeEventListener("mouseup",     onMouseUp);
    el.removeEventListener("mouseleave",  onMouseUp);
    el.removeEventListener("contextmenu", onContextMenu);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverMapDisplayProps {
  bins:            any[];
  driverPos:       [number, number] | null;
  heading:         number;
  selectedBinId:   number | null;
  setSelectedBinId:(id: number) => void;
  routeKey:        number;
  mode:            "fastest" | "priority";
  maxDetour:       number;
  useFence:        boolean;
  mapStyle:        string;
  onRouteUpdate:   (stats: { dist: string; time: string }) => void;
  isTracking:      boolean;
}


// ─────────────────────────────────────────────────────────────────────────────
// DESTINATION PICKER  — activates on-map tap/click to set exit point
// ─────────────────────────────────────────────────────────────────────────────

function DestinationPicker({
  active,
  onPick,
}: {
  active:  boolean;
  onPick:  (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP CONTROLLER — follows driver + rotates map to heading
// ─────────────────────────────────────────────────────────────────────────────

function MapController({
  center,
  isTracking,
  heading,
}: {
  center:     [number, number];
  isTracking: boolean;
  heading:    number;
}) {
  const map = useMap();

  useEffect(() => {
    if (isTracking && center)
      map.flyTo(center, map.getZoom(), { animate: true, duration: 1.5 });
  }, [center, isTracking, map]);

  useEffect(() => {
    if (!isTracking) return;
    setBearing(map, heading);
  }, [heading, isTracking, map]);

  // Enable right-click-drag rotation on desktop (always active, independent of tracking)
  useEffect(() => {
    return enableMouseRotate(map);
  }, [map]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPASS BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function CompassButton({
  heading,
  isTracking,
  onReset,
}: {
  heading:    number;
  isTracking: boolean;
  onReset:    () => void;
}) {
  return (
    <button
      onClick={onReset}
      title="Reset to North"
      style={{
        position: "absolute",
        bottom: 100,
        right: 16,
        zIndex: 1000,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        border: "1.5px solid rgba(0,0,0,0.12)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        transition: "box-shadow .2s",
      }}
    >
      <svg
        width="26" height="26" viewBox="0 0 26 26"
        style={{ transform: `rotate(${-heading}deg)`, transition: "transform 0.4s ease" }}
      >
        <polygon points="13,2 16,13 13,11 10,13" fill="#ef4444" />
        <polygon points="13,24 16,13 13,15 10,13" fill="#94a3b8" />
        <circle cx="13" cy="13" r="2" fill="#1e293b" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STOP ORDER LEGEND  — now shows U-turn warnings per stop
// ─────────────────────────────────────────────────────────────────────────────

function StopOrderLegend({
  orderedBins,
  mode,
  onSelect,
  selectedBinId,
}: {
  orderedBins:   any[];
  mode:          "fastest" | "priority";
  onSelect:      (id: number) => void;
  selectedBinId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (orderedBins.length === 0) return null;

  const accent   = mode === "priority" ? "#f97316" : "#059669";
  const accentBg = mode === "priority" ? "rgba(249,115,22,.12)" : "rgba(5,150,105,.12)";

  const uturnCount = orderedBins.filter((b: any) => b.requiresUturn).length;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 1000,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,.18)",
        border: `1.5px solid ${accent}44`,
        minWidth: collapsed ? "auto" : 220,
        maxWidth: 240,
        overflow: "hidden",
        fontFamily: "sans-serif",
        transition: "min-width .2s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px 8px",
          borderBottom: collapsed ? "none" : `1px solid ${accent}33`,
          background: accentBg,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
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
        {/* U-turn count pill in header */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!collapsed && uturnCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: "#d97706",
              background: "#fef3c7", border: "1px solid #fde68a",
              borderRadius: 20, padding: "1px 6px",
            }}>
              ↩ {uturnCount}
            </span>
          )}
          <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>
            {collapsed ? "▼" : "▲"}
          </span>
        </div>
      </div>

      {/* Stop list */}
      {!collapsed && (
        <ul style={{ margin: 0, padding: "6px 0 8px", listStyle: "none" }}>
          {orderedBins.map((bin: any, idx: number) => {
            const urgent     = bin.fillLevel >= 80;
            const isSelected = bin.id === selectedBinId;
            const isUturn    = !!bin.requiresUturn;
            const badgeBg    = isSelected ? "#2563eb" : urgent ? "#dc2626" : accent;

            return (
              <li
                key={bin.id}
                onClick={() => onSelect(bin.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 14px",
                  cursor: "pointer",
                  background: isSelected ? `${accent}18` : "transparent",
                  transition: "background .15s",
                  borderLeft: isUturn ? "3px solid #f59e0b" : "3px solid transparent",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = `${accent}12`)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = isSelected ? `${accent}18` : "transparent")
                }
              >
                {/* Step badge */}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: badgeBg, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  // Amber ring for U-turn stops
                  boxShadow: isUturn ? "0 0 0 2px #f59e0b" : "none",
                }}>
                  {idx + 1}
                </div>

                {/* Name + fill */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 12, fontWeight: 600, color: "#1e293b",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {bin.name ?? `Bin ${bin.id}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: urgent ? "#dc2626" : "#64748b" }}>
                    {urgent ? "⚠ " : ""}{bin.fillLevel}% full
                    {/* U-turn label inline */}
                    {isUturn && (
                      <span style={{ color: "#d97706", fontWeight: 700, marginLeft: 4 }}>
                        · ↩ U-turn
                      </span>
                    )}
                  </p>
                </div>

                {idx < orderedBins.length - 1 && (
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>›</span>
                )}
              </li>
            );
          })}

          {/* Footer */}
          <li style={{
            borderTop: `1px solid ${accent}22`,
            margin: "4px 14px 0",
            paddingTop: 6,
            fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: ".04em",
          }}>
            {orderedBins.length} STOPS · {mode === "priority" ? "PRIORITY" : "FASTEST"} MODE
            {uturnCount > 0 && (
              <span style={{ color: "#d97706", marginLeft: 6 }}>
                · {uturnCount} U-TURN{uturnCount > 1 ? "S" : ""}
              </span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverMapDisplay({
  bins,
  driverPos,
  heading,
  selectedBinId,
  setSelectedBinId,
  routeKey,
  mode,
  maxDetour,
  useFence,
  mapStyle,
  onRouteUpdate,
  isTracking,
}: DriverMapDisplayProps) {
  const [orderedBins, setOrderedBins] = useState<any[]>([]);
  const [mapRef, setMapRef]           = useState<L.Map | null>(null);
  // Locked position used for routing — only updates on routeKey change, not every GPS tick
  const [routingPos, setRoutingPos]   = useState<[number, number] | null>(null);
  // Driver-set exit/destination point
  const [destinationPos, setDestinationPos] = useState<[number, number] | null>(null);
  const [pickingDest, setPickingDest]       = useState(false);

  const resetNorth = () => {
    if (mapRef) setBearing(mapRef, 0);
  };

  // Lock the routing position when recalculate is pressed or mode changes.
  // driverPos is intentionally excluded — we do NOT want GPS drift to re-lock.
  useEffect(() => {
    if (driverPos) setRoutingPos(driverPos);
    setOrderedBins([]);
  }, [routeKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // On first fix after tracking starts, lock initial routing position
  useEffect(() => {
    if (driverPos && !routingPos) setRoutingPos(driverPos);
  }, [driverPos, routingPos]);

  return (
    <div className="absolute inset-0 md:relative md:flex-1 h-full order-1 overflow-hidden">
      <MapContainer
        center={LUPON_CENTER}
        zoom={18}
        maxZoom={22}
        zoomControl={false}
        className="h-full w-full"
        preferCanvas={true}
        rotate={true}
        bearing={0}
        touchRotate={true}
        touchGestures={true}
        rotateControl={false}
        ref={setMapRef}
      >
        <TileLayer
          key={mapStyle}
          url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
          maxZoom={22}
          maxNativeZoom={18}
          tileSize={512}
          zoomOffset={-1}
        />

        {driverPos && (
          <MapController center={driverPos} isTracking={isTracking} heading={heading} />
        )}

        {/* Driver marker — arrow always points "up" since map rotates */}
        {driverPos && (
          <Marker
            position={driverPos}
            icon={L.divIcon({
              html: `<div class="transition-transform duration-500">
                      <div class="w-10 h-10 bg-blue-600 border-4 border-white rounded-full shadow-2xl flex items-center justify-center">
                        <div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-white mb-1 shadow-sm"></div>
                      </div>
                    </div>`,
              className: "custom-div-icon",
            })}
          />
        )}

        {/* Destination picker click handler */}
        <DestinationPicker
          active={pickingDest}
          onPick={(pos) => {
            setDestinationPos(pos);
            setPickingDest(false);
          }}
        />

        {/* Destination marker */}
        {destinationPos && (
          <Marker position={destinationPos} icon={DEST_ICON} zIndexOffset={1200} />
        )}

        {/* Bin markers */}
        {bins.map((bin: any) => (
          <BinMarker
            key={bin.id}
            bin={bin}
            isSelected={selectedBinId === bin.id}
            onClick={() => setSelectedBinId(bin.id)}
          />
        ))}

        {/* RoutingLayer — now receives heading for U-turn-aware A* */}
        {driverPos && (
          <RoutingLayer
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
            routingPos={routingPos}        // ← locked pos, only updates on recalculate
            destinationPos={destinationPos}
          />
        )}
      </MapContainer>

      {/* Overlays */}
      {driverPos && (
        <StopOrderLegend
          orderedBins={orderedBins}
          mode={mode}
          onSelect={setSelectedBinId}
          selectedBinId={selectedBinId}
        />
      )}

      {/* Destination control — set / clear exit point */}
      <div style={{
        position:   "absolute",
        bottom:     152,
        right:      16,
        zIndex:     1000,
        display:    "flex",
        flexDirection: "column",
        gap:        6,
      }}>
        {/* Set destination button */}
        <button
          onClick={() => setPickingDest((p) => !p)}
          title={pickingDest ? "Cancel — tap map to set exit" : "Set exit / destination"}
          style={{
            width:          44,
            height:         44,
            borderRadius:   "50%",
            background:     pickingDest ? "#7c3aed" : "rgba(255,255,255,0.96)",
            backdropFilter: "blur(8px)",
            border:         pickingDest ? "1.5px solid #c4b5fd" : "1.5px solid rgba(0,0,0,0.12)",
            boxShadow:      "0 2px 12px rgba(0,0,0,0.18)",
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        0,
            color:          pickingDest ? "#fff" : "#374151",
            fontSize:       18,
            transition:     "all .2s",
          }}
        >
          ⚑
        </button>

        {/* Clear destination button — only shown when a destination is set */}
        {destinationPos && !pickingDest && (
          <button
            onClick={() => setDestinationPos(null)}
            title="Clear exit point"
            style={{
              width:          44,
              height:         44,
              borderRadius:   "50%",
              background:     "rgba(255,255,255,0.96)",
              backdropFilter: "blur(8px)",
              border:         "1.5px solid rgba(239,68,68,0.4)",
              boxShadow:      "0 2px 12px rgba(0,0,0,0.18)",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              padding:        0,
              color:          "#ef4444",
              fontSize:       14,
              fontWeight:     700,
              fontFamily:     "sans-serif",
              transition:     "all .2s",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Picking mode hint banner */}
      {pickingDest && (
        <div style={{
          position:      "absolute",
          top:           70,
          left:          "50%",
          transform:     "translateX(-50%)",
          zIndex:        1000,
          background:    "#7c3aed",
          color:         "#fff",
          padding:       "8px 18px",
          borderRadius:  20,
          fontSize:      12,
          fontWeight:    700,
          fontFamily:    "sans-serif",
          boxShadow:     "0 2px 12px rgba(0,0,0,0.25)",
          pointerEvents: "none",
          whiteSpace:    "nowrap",
        }}>
          Tap anywhere on the map to set exit point
        </div>
      )}

      <CompassButton
        heading={isTracking ? heading : 0}
        isTracking={isTracking}
        onReset={resetNorth}
      />
    </div>
  );
}