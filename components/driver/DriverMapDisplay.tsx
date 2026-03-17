"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-rotate";                          // ← ADD: map-rotation plugin
import BinMarker from "./BinMarker";
import RoutingLayer from "./RoutingLayer";
import { LUPON_CENTER } from "../map/MapAssets";
import { BinLabelToggleButton } from "./BinMarker";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverMapDisplayProps {
  bins: any[];
  driverPos: [number, number] | null;
  heading: number;
  selectedBinId: number | null;
  setSelectedBinId: (id: number) => void;
  routeKey: number;
  mode: "fastest" | "priority";
  maxDetour: number;
  useFence: boolean;
  mapStyle: string;
  onRouteUpdate: (stats: { dist: string; time: string }) => void;
  isTracking: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP CONTROLLER  — keeps camera on driver + rotates map to match heading
// ─────────────────────────────────────────────────────────────────────────────

function MapController({
  center,
  isTracking,
  heading,                                        // ← ADD
}: {
  center: [number, number];
  isTracking: boolean;
  heading: number;                                // ← ADD
}) {
  const map = useMap();

  useEffect(() => {
    if (isTracking && center)
      map.flyTo(center, map.getZoom(), { animate: true, duration: 1.5 });
  }, [center, isTracking, map]);

  // ← ADD: rotate map whenever heading changes (only while tracking)
  useEffect(() => {
    if (!isTracking) return;
    // leaflet-rotate exposes setBearing on the map instance
    (map as any).setBearing(heading);
  }, [heading, isTracking, map]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPASS BUTTON  — lets the driver reset north or lock/unlock rotation
// ─────────────────────────────────────────────────────────────────────────────

function CompassButton({
  heading,
  isTracking,
  onReset,
}: {
  heading: number;
  isTracking: boolean;
  onReset: () => void;
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
      {/* Compass needle — rotates opposite to map bearing so N always points up visually */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        style={{
          transform: `rotate(${-heading}deg)`,
          transition: "transform 0.4s ease",
        }}
      >
        {/* North (red) */}
        <polygon points="13,2 16,13 13,11 10,13" fill="#ef4444" />
        {/* South (gray) */}
        <polygon points="13,24 16,13 13,15 10,13" fill="#94a3b8" />
        {/* Center dot */}
        <circle cx="13" cy="13" r="2" fill="#1e293b" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STOP ORDER LEGEND  — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function StopOrderLegend({
  orderedBins,
  mode,
  onSelect,
  selectedBinId,
}: {
  orderedBins: any[];
  mode: "fastest" | "priority";
  onSelect: (id: number) => void;
  selectedBinId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (orderedBins.length === 0) return null;

  const accent = mode === "priority" ? "#f97316" : "#059669";
  const accentBg = mode === "priority" ? "rgba(249,115,22,.12)" : "rgba(5,150,105,.12)";

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
        minWidth: collapsed ? "auto" : 210,
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
            <path
              d="M3 11 C3 7 13 9 13 5"
              stroke={accent}
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: accent,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            {collapsed ? `${orderedBins.length} stops` : "A* Route Order"}
          </span>
        </div>
        <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>
          {collapsed ? "▼" : "▲"}
        </span>
      </div>

      {/* Stop list */}
      {!collapsed && (
        <ul style={{ margin: 0, padding: "6px 0 8px", listStyle: "none" }}>
          {orderedBins.map((bin: any, idx: number) => {
            const urgent = bin.fillLevel >= 80;
            const isSelected = bin.id === selectedBinId;
            const badgeBg = isSelected ? "#2563eb" : urgent ? "#dc2626" : accent;

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
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = `${accent}12`)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = isSelected
                    ? `${accent}18`
                    : "transparent")
                }
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: badgeBg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1e293b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {bin.name ?? `Bin ${bin.id}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: urgent ? "#dc2626" : "#64748b" }}>
                    {urgent ? "⚠ " : ""}
                    {bin.fillLevel}% full
                  </p>
                </div>
                {idx < orderedBins.length - 1 && (
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>›</span>
                )}
              </li>
            );
          })}
          <li
            style={{
              borderTop: `1px solid ${accent}22`,
              margin: "4px 14px 0",
              paddingTop: 6,
              fontSize: 10,
              color: "#64748b",
              fontWeight: 600,
              letterSpacing: ".04em",
            }}
          >
            {orderedBins.length} STOPS · {mode === "priority" ? "PRIORITY" : "FASTEST"} MODE
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

  // ← ADD: ref to call setBearing from the CompassButton (outside MapContainer)
  const [mapRef, setMapRef] = useState<L.Map | null>(null);

  const resetNorth = () => {
    if (mapRef) (mapRef as any).setBearing(0);
  };

  useEffect(() => {
    setOrderedBins([]);
  }, [routeKey, mode, driverPos]);

  return (
    <div className="absolute inset-0 md:relative md:flex-1 h-full order-1 overflow-hidden">
      <MapContainer
        center={LUPON_CENTER}
        zoom={18}
        maxZoom={22}
        zoomControl={false}
        className="h-full w-full"
        preferCanvas={true}
        rotate={true}                             // ← ADD: enable leaflet-rotate
        bearing={0}                               // ← ADD: initial bearing
        ref={setMapRef}                           // ← ADD: grab map instance
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
          <MapController
            center={driverPos}
            isTracking={isTracking}
            heading={heading}                     // ← ADD
          />
        )}

        {/* Driver marker */}
        {driverPos && (
          <Marker
            position={driverPos}
            icon={L.divIcon({
              // ← CHANGE: remove inline rotation from the arrow div — the MAP rotates now.
              //   The arrow always points "up" in map-space which equals the heading direction.
              html: `<div class="transition-transform duration-500">
                      <div class="w-10 h-10 bg-blue-600 border-4 border-white rounded-full shadow-2xl flex items-center justify-center">
                        <div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-white mb-1 shadow-sm"></div>
                      </div>
                    </div>`,
              className: "custom-div-icon",
            })}
          />
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

        {/* Routing */}
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
          />
        )}
        
      <BinLabelToggleButton />
      </MapContainer>

      {/* Stop order legend */}
      {driverPos && (
        <StopOrderLegend
          orderedBins={orderedBins}
          mode={mode}
          onSelect={setSelectedBinId}
          selectedBinId={selectedBinId}
        />
      )}

      {/* ← ADD: Compass reset button */}
      <CompassButton
        heading={isTracking ? heading : 0}
        isTracking={isTracking}
        onReset={resetNorth}
      />
    </div>
  );
}