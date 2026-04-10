"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/citizen/CitizenBinMap.tsx
// MapLibre GL — satellite-streets style (same as DriverMapDisplayGL)
// Citizen view: bin fill levels + GPS user dot + nearest-bin panel
// No routing, no driver marker, no destination picker
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/utils/supabase/client";
import { LUPON_CENTER } from "@/components/map/MapAssets";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// MAP STYLE — free CARTO Positron (works with MapLibre GL JS, no API key)
// MapLibre cannot load Mapbox v2 style URLs without a Mapbox GL JS license.
// ─────────────────────────────────────────────────────────────────────────────

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fillColor(level: number): string {
  if (level >= 90) return "#ef4444";
  if (level >= 70) return "#f97316";
  if (level >= 40) return "#eab308";
  return "#22c55e";
}

function fillLabel(level: number): string {
  if (level >= 90) return "Critical";
  if (level >= 70) return "High";
  if (level >= 40) return "Medium";
  return "Available";
}

function batteryColor(level: number): string {
  if (level <= 15) return "#ef4444";
  if (level <= 35) return "#f97316";
  return "#22c55e";
}

// Haversine distance in metres between two [lat, lng] points
function distanceM(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aa =
    sinLat * sinLat +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

const timeAgo = (iso: string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────────
// BIN MARKER  — exact same design as DriverMapDisplayGL.BinMarkerGL
// ─────────────────────────────────────────────────────────────────────────────

function BinMarkerGL({
  bin,
  isSelected,
  onClick,
  zoom,
}: {
  bin: any;
  isSelected: boolean;
  onClick: () => void;
  zoom: number;
}) {
  if (zoom < 14) return null;

  const color = fillColor(bin.fill_level);
  const name  = (bin.name ?? "Bin").length > 11
    ? bin.name.substring(0, 10) + "…"
    : (bin.name ?? "Bin");
  const r    = 6;
  const circ = 2 * Math.PI * r;
  const dash = (bin.fill_level / 100) * circ;

  return (
    <Marker
      longitude={bin.lng}
      latitude={bin.lat}
      anchor="bottom"
      onClick={e => { e.originalEvent.stopPropagation(); onClick(); }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Label card — shows at zoom ≥ 16, exactly as driver map */}
        {zoom >= 16 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              borderRadius: 8,
              marginBottom: 4,
              background: isSelected ? "#1e293b" : "rgba(255,255,255,0.95)",
              border: `1.5px solid ${isSelected ? "#475569" : "#e2e8f0"}`,
              boxShadow: isSelected
                ? "0 4px 16px rgba(0,0,0,0.35)"
                : "0 2px 8px rgba(0,0,0,0.18)",
              fontFamily: "'DM Mono','Fira Code',monospace",
              transform: isSelected ? "scale(1.05)" : "scale(1)",
              transition: "all .2s",
              whiteSpace: "nowrap",
            }}
          >
            {/* SVG fill ring — identical to driver map */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
            >
              <circle
                cx="9" cy="9" r={r}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="2.5"
              />
              <circle
                cx="9" cy="9" r={r}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
              />
            </svg>

            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: isSelected ? "#fff" : "#1e293b",
              }}
            >
              {name}
            </span>

            <span
              style={{
                width: 1,
                height: 12,
                background: "#cbd5e1",
                opacity: 0.6,
              }}
            />

            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 20,
                background: color,
                color:
                  bin.fill_level >= 40 && bin.fill_level < 70
                    ? "#1e293b"
                    : "#fff",
              }}
            >
              {bin.fill_level}%
            </span>
          </div>
        )}

        {/* Dot — identical size/shadow/selection ring */}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: color,
            border: `2px solid ${isSelected ? "#2563eb" : "#fff"}`,
            boxShadow: isSelected
              ? "0 0 0 3px rgba(37,99,235,0.4), 0 2px 6px rgba(0,0,0,0.3)"
              : "0 2px 6px rgba(0,0,0,0.25)",
            transition: "all .2s",
            transform: isSelected ? "scale(1.3)" : "scale(1)",
          }}
        />
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER LOCATION MARKER  — pulsing blue dot (citizen GPS)
// ─────────────────────────────────────────────────────────────────────────────

function UserMarker({ pos }: { pos: [number, number] }) {
  return (
    <Marker longitude={pos[1]} latitude={pos[0]} anchor="center">
      <div style={{ position: "relative", width: 28, height: 28 }}>
        <style>{`
          @keyframes citizenPulse {
            0%   { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0;   }
          }
        `}</style>
        {/* Pulse ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "rgba(37,99,235,0.3)",
            animation: "citizenPulse 2s ease-out infinite",
          }}
        />
        {/* Core dot */}
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            border: "2.5px solid #fff",
            boxShadow: "0 2px 10px rgba(37,99,235,0.6)",
          }}
        />
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BIN DETAIL POPUP  — slides up from bottom when a bin is selected
// ─────────────────────────────────────────────────────────────────────────────

function BinPopup({
  bin,
  userPos,
  onClose,
}: {
  bin: any;
  userPos: [number, number] | null;
  onClose: () => void;
}) {
  const color = fillColor(bin.fill_level);
  const dist  = userPos
    ? distanceM(userPos, [bin.lat, bin.lng])
    : null;

  const circ = 2 * Math.PI * 32;
  const dash = (bin.fill_level / 100) * circ;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1001,
        width: "min(320px, calc(100vw - 32px))",
        background: "rgba(15,23,42,0.96)",
        backdropFilter: "blur(16px)",
        borderRadius: 20,
        border: `1.5px solid ${color}55`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`,
        fontFamily: "sans-serif",
        animation: "popupSlide .22s cubic-bezier(.4,0,.2,1) both",
      }}
    >
      <style>{`
        @keyframes popupSlide {
          from { opacity: 0; transform: translateX(-50%) translateY(14px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 18px 12px",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        {/* Fill ring */}
        <svg width={68} height={68} viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
          <circle cx="34" cy="34" r="32" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/>
          <circle
            cx="34" cy="34" r="32"
            fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dasharray .4s" }}
          />
          <text
            x="34" y="37"
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fill={color}
            fontFamily="Georgia,serif"
          >
            {bin.fill_level}%
          </text>
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#f1f5f9",
              marginBottom: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {bin.name}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 9px",
              borderRadius: 20,
              background: `${color}22`,
              color,
            }}
          >
            {fillLabel(bin.fill_level)}
          </div>
          {dist !== null && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 5 }}>
              📍 {fmtDist(dist)} from you
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.07)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Details */}
      <div style={{ padding: "12px 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Fill bar */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
              fontSize: 11,
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            <span>Fill Level</span>
            <span style={{ color }}>{bin.fill_level}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)" }}>
            <div
              style={{
                height: "100%",
                width: `${bin.fill_level}%`,
                borderRadius: 3,
                background: color,
                transition: "width .4s",
              }}
            />
          </div>
        </div>

        {/* Battery + last seen row */}
        <div style={{ display: "flex", gap: 10 }}>
          {/* Battery */}
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Battery
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 30,
                  height: 14,
                  borderRadius: 4,
                  border: `1.5px solid ${batteryColor(bin.battery_level)}44`,
                  padding: 2,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${bin.battery_level}%`,
                    borderRadius: 2,
                    background: batteryColor(bin.battery_level),
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: batteryColor(bin.battery_level),
                }}
              >
                {bin.battery_level}%
              </span>
            </div>
          </div>

          {/* Last seen */}
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Updated
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>
              {timeAgo(bin.last_seen)}
            </span>
          </div>
        </div>

        {/* Critical alert */}
        {bin.fill_level >= 90 && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(239,68,68,.12)",
              border: "1px solid rgba(239,68,68,.3)",
              fontSize: 12,
              fontWeight: 700,
              color: "#f87171",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🚨 This bin is at capacity — please use another nearby bin
          </div>
        )}

        {/* Directions button */}
        <button
          onClick={() => {
            const dest = `${bin.lat},${bin.lng}`;
            const origin = userPos ? `${userPos[0]},${userPos[1]}` : "";
            const url = origin
              ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`
              : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
            window.open(url, "_blank");
          }}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            background: color,
            border: "none",
            color: bin.fill_level >= 40 && bin.fill_level < 70 ? "#1e293b" : "#fff",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: ".04em",
            transition: "opacity .15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = ".85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          🧭 Get Directions
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEAREST BINS PANEL  — bottom-left card (collapsed by default on mobile)
// ─────────────────────────────────────────────────────────────────────────────

function NearestPanel({
  bins,
  userPos,
  onSelect,
}: {
  bins: any[];
  userPos: [number, number] | null;
  onSelect: (bin: any) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = userPos
    ? [...bins]
        .map(b => ({ ...b, _dist: distanceM(userPos, [b.lat, b.lng]) }))
        .sort((a, b) => a._dist - b._dist)
        .slice(0, 5)
    : bins.slice(0, 5);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 14,
        zIndex: 1000,
        background: "rgba(15,23,42,0.92)",
        backdropFilter: "blur(14px)",
        borderRadius: 14,
        border: "1.5px solid rgba(255,255,255,.09)",
        boxShadow: "0 4px 28px rgba(0,0,0,.45)",
        fontFamily: "sans-serif",
        minWidth: collapsed ? "auto" : 210,
        overflow: "hidden",
        transition: "min-width .2s",
      }}
    >
      {/* Header / toggle */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 13px 8px",
          cursor: "pointer",
          borderBottom: collapsed
            ? "none"
            : "1px solid rgba(255,255,255,.06)",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#94a3b8",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            {collapsed
              ? `${sorted.length} Nearby`
              : userPos
              ? "Nearest Bins"
              : "All Bins"}
          </span>
        </div>
        <span
          style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}
        >
          {collapsed ? "▲" : "▼"}
        </span>
      </div>

      {!collapsed && (
        <ul style={{ margin: 0, padding: "4px 0 8px", listStyle: "none" }}>
          {sorted.map((bin: any, i: number) => {
            const color = fillColor(bin.fill_level);
            return (
              <li
                key={bin.id}
                onClick={() => onSelect(bin)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 13px",
                  cursor: "pointer",
                  transition: "background .12s",
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.background = "rgba(255,255,255,.05)")
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Rank badge */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,.07)",
                    border: "1px solid rgba(255,255,255,.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#64748b",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>

                {/* Name + fill */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bin.name ?? `Bin ${bin.id}`}
                  </div>
                  <div
                    style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}
                  >
                    {bin._dist !== undefined ? fmtDist(bin._dist) + " · " : ""}
                    <span style={{ color }}>{bin.fill_level}%</span>
                  </div>
                </div>

                {/* Color dot */}
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${color}88`,
                  }}
                />
              </li>
            );
          })}

          {!userPos && (
            <li
              style={{
                padding: "4px 13px 2px",
                fontSize: 10,
                color: "#334155",
                fontStyle: "italic",
              }}
            >
              Allow location to sort by distance
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP LEGEND  — top-left floating card
// ─────────────────────────────────────────────────────────────────────────────

function MapLegend({ bins }: { bins: any[] }) {
  const rows = [
    { label: "Critical (≥90%)",  color: "#ef4444", count: bins.filter(b => b.fill_level >= 90).length },
    { label: "High (70–89%)",    color: "#f97316", count: bins.filter(b => b.fill_level >= 70 && b.fill_level < 90).length },
    { label: "Medium (40–69%)",  color: "#eab308", count: bins.filter(b => b.fill_level >= 40 && b.fill_level < 70).length },
    { label: "Available (<40%)", color: "#22c55e", count: bins.filter(b => b.fill_level < 40).length },
  ].filter(r => r.count > 0);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 14,
        zIndex: 1000,
        background: "rgba(15,23,42,0.88)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1.5px solid rgba(255,255,255,.08)",
        boxShadow: "0 4px 20px rgba(0,0,0,.4)",
        padding: "10px 13px",
        fontFamily: "sans-serif",
        minWidth: 152,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: "#475569",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {bins.length} Bins
      </div>
      {rows.map(r => (
        <div
          key={r.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 5,
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: r.color,
              boxShadow: `0 0 5px ${r.color}88`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>
            {r.label}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: r.color,
            }}
          >
            {r.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface CitizenBinMapProps {
  barangay: string;
}

export default function CitizenBinMap({ barangay }: CitizenBinMapProps) {
  const mapRef = useRef<MapRef>(null);

  const [bins,        setBins]        = useState<any[]>([]);
  const [selectedBin, setSelectedBin] = useState<any | null>(null);
  const [userPos,     setUserPos]     = useState<[number, number] | null>(null);
  const [mapLoaded,   setMapLoaded]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [zoom,        setZoom]        = useState(15);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // ── Fetch bins ──────────────────────────────────────────────────────────────
  const fetchBins = useCallback(async () => {
    const { data, error } = await supabase
      .from("bins")
      .select("id, device_id, name, lat, lng, fill_level, battery_level, last_seen")
      .order("fill_level", { ascending: false });

    if (!error && data) {
      setBins(data);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBins(); }, [fetchBins]);

  // ── Realtime fill-level updates ────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel("citizen-bins-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bins" },
        (payload: any) => {
          setBins(prev =>
            prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b)
          );
          setSelectedBin((sel: any) =>
            sel?.id === payload.new.id ? { ...sel, ...payload.new } : sel
          );
          setLastUpdated(new Date());
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── GPS watch — citizen location ───────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
      },
      err => {
        // Permission denied or unavailable — graceful fallback
        console.log("Geolocation:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // ── Fly to user position once GPS is acquired ──────────────────────────────
  useEffect(() => {
    if (!userPos || !mapLoaded || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [userPos[1], userPos[0]],
      zoom:   16,
      speed:  1.2,
    });
  }, [userPos, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only fly once on first GPS fix (mapLoaded is stable after load)

  const recenter = () => {
    const target = userPos ?? [LUPON_CENTER[0], LUPON_CENTER[1]];
    mapRef.current?.flyTo({
      center: [target[1], target[0]],
      zoom:   16,
      speed:  1.4,
    });
  };

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#0f172a",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 500,
            background: "rgba(15,23,42,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "3px solid rgba(34,197,94,.2)",
              borderTopColor: "#22c55e",
              animation: "spin 1s linear infinite",
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#22c55e",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
            }}
          >
            Loading bins…
          </span>
        </div>
      )}

      {/* Map */}
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        initialViewState={{
          longitude: LUPON_CENTER[1],
          latitude:  LUPON_CENTER[0],
          zoom: 15,
          bearing: 0,
          pitch: 0,
        }}
        maxZoom={22}
        minZoom={10}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}   // citizens don't need bearing rotation
        touchZoomRotate={true}
        pitchWithRotate={false}
        onClick={() => setSelectedBin(null)}
        onZoom={e => setZoom(e.viewState.zoom)}
        onLoad={() => setMapLoaded(true)}
      >
        {/* User GPS dot */}
        {userPos && <UserMarker pos={userPos} />}

        {/* Bin markers */}
        {bins.map(bin => (
          <BinMarkerGL
            key={bin.id}
            bin={bin}
            isSelected={selectedBin?.id === bin.id}
            zoom={zoom}
            onClick={() => setSelectedBin(bin)}
          />
        ))}
      </Map>

      {/* ── OVERLAYS ── */}

      {/* Top-left: legend */}
      {!loading && <MapLegend bins={bins} />}


      {/* Bottom-left: nearest bins (hidden when popup is open) */}
      {!selectedBin && !loading && bins.length > 0 && (
        <NearestPanel
          bins={bins}
          userPos={userPos}
          onSelect={bin => {
            setSelectedBin(bin);
            mapRef.current?.flyTo({
              center: [bin.lng, bin.lat],
              zoom: Math.max(zoom, 17),
              speed: 1.4,
            });
          }}
        />
      )}

      {/* Bottom center: bin detail popup */}
      {selectedBin && (
        <BinPopup
          bin={selectedBin}
          userPos={userPos}
          onClose={() => setSelectedBin(null)}
        />
      )}

      {/* Recenter button — bottom-right */}
      <button
        onClick={recenter}
        title={userPos ? "Go to my location" : "Recenter map"}
        style={{
          position: "absolute",
          bottom: 20,
          right: 14,
          zIndex: 1000,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(15,23,42,0.92)",
          backdropFilter: "blur(10px)",
          border: "1.5px solid rgba(255,255,255,.12)",
          boxShadow: "0 2px 14px rgba(0,0,0,.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          transition: "opacity .15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = ".75")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        {userPos ? "📍" : "🎯"}
      </button>

      {/* Status bar — bottom (hidden when popup open) */}
      {!selectedBin && (
        <div
          style={{
            position: "absolute",
            bottom: 72,
            right: 14,
            zIndex: 1000,
            background: "rgba(15,23,42,0.82)",
            backdropFilter: "blur(8px)",
            borderRadius: 20,
            padding: "4px 11px",
            border: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px #22c55e",
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
            {bins.length} bins · {timeStr}
          </span>
          {userPos && (
            <>
              <span style={{ color: "rgba(255,255,255,.1)" }}>|</span>
              <span style={{ fontSize: 11, color: "#3b82f6" }}>📍 GPS</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}