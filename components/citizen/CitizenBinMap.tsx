"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/citizen/CitizenBinMap.tsx
// MapLibre GL view-only bin map for citizens
// Shows all bins for their barangay with fill level, battery, last seen
// Same visual style as DriverMapDisplayGL but NO routing, NO driver marker
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

// Lupon, Davao Oriental — same center as DriverMapDisplayGL
const MAP_CENTER: [number, number] = [7.1493, 126.0082];

const MAP_STYLES: Record<string, string> = {
  "Streets":   "https://api.maptiler.com/maps/streets-v2/style.json?key=get_your_key",
  "Satellite": "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  "Light":     "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

// Free tile fallback that works without API key
const DEFAULT_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

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
  return "Low";
}

function batteryColor(level: number): string {
  if (level <= 15) return "#ef4444";
  if (level <= 35) return "#f97316";
  return "#22c55e";
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

// ── BIN POPUP ─────────────────────────────────────────────────────────────────

function BinPopup({ bin, onClose }: { bin: any; onClose: () => void }) {
  const color = fillColor(bin.fill_level);
  const circ = 2 * Math.PI * 22;
  const dash = (bin.fill_level / 100) * circ;

  return (
    <div style={{
      position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, width: 280, background: "#fff",
      borderRadius: 16, border: `2px solid ${color}40`,
      boxShadow: `0 8px 40px rgba(0,0,0,.18), 0 0 0 1px ${color}20`,
      animation: "popupIn .2s ease both", fontFamily: "sans-serif",
    }}>
      <style>{`@keyframes popupIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid #f1f5f9`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* SVG ring */}
          <svg width={52} height={52} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={22} fill="none" stroke={`${color}25`} strokeWidth={4}/>
            <circle cx={26} cy={26} r={22} fill="none" stroke={color} strokeWidth={4}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}/>
            <text x="26" y="29" textAnchor="middle" fontSize="12" fontWeight="800" fill={color} fontFamily="Georgia,serif">
              {bin.fill_level}%
            </text>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{bin.name}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 2 }}>{fillLabel(bin.fill_level)} fill</div>
          </div>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#9ca3af" }}>×</button>
      </div>

      {/* Details */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Fill bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Fill Level</span>
            <span style={{ fontSize: 11, fontWeight: 800, color }}>{bin.fill_level}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9" }}>
            <div style={{ height: "100%", width: `${bin.fill_level}%`, borderRadius: 3, background: color, transition: "width .4s" }}/>
          </div>
        </div>

        {/* Battery */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>🔋 Battery</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 28, height: 12, borderRadius: 3, border: `1.5px solid ${batteryColor(bin.battery_level)}30`, padding: 1, position: "relative" }}>
              <div style={{ height: "100%", width: `${bin.battery_level}%`, borderRadius: 2, background: batteryColor(bin.battery_level) }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: batteryColor(bin.battery_level) }}>{bin.battery_level}%</span>
          </div>
        </div>

        {/* Last seen */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>⏱ Last updated</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{timeAgo(bin.last_seen)}</span>
        </div>

        {/* Device ID */}
        {bin.device_id && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>📡 Device</span>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>{bin.device_id}</span>
          </div>
        )}

        {/* Status badge */}
        {bin.fill_level >= 90 && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, fontWeight: 700, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
            🚨 This bin needs urgent collection
          </div>
        )}
      </div>
    </div>
  );
}

// ── BIN MARKER GL ─────────────────────────────────────────────────────────────

function BinMarkerGL({ bin, isSelected, onClick, zoom }: {
  bin: any; isSelected: boolean; onClick: () => void; zoom: number;
}) {
  // Below zoom 13 just show a colored dot
  const color = fillColor(bin.fill_level);
  const r = 6, circ = 2 * Math.PI * r;
  const dash = (bin.fill_level / 100) * circ;
  const name = bin.name?.length > 14 ? bin.name.substring(0, 13) + "…" : (bin.name ?? "Bin");

  return (
    <Marker
      longitude={bin.lng} latitude={bin.lat} anchor="bottom"
      onClick={e => { e.originalEvent.stopPropagation(); onClick(); }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
        {/* Label card — only at zoom ≥ 15 */}
        {zoom >= 15 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 8px", borderRadius: 8, marginBottom: 4,
            background: isSelected ? "#0f172a" : "rgba(255,255,255,0.96)",
            border: `1.5px solid ${isSelected ? color : "rgba(0,0,0,.1)"}`,
            boxShadow: isSelected ? `0 4px 20px ${color}55` : "0 2px 10px rgba(0,0,0,.15)",
            backdropFilter: "blur(8px)",
            transform: isSelected ? "scale(1.06)" : "scale(1)",
            transition: "all .2s", whiteSpace: "nowrap",
          }}>
            {/* Mini SVG fill ring */}
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
              <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(0,0,0,.1)" strokeWidth="2.5"/>
              <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2.5"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: isSelected ? "#f1f5f9" : "#1e293b" }}>{name}</span>
            <span style={{ width: 1, height: 10, background: "rgba(0,0,0,.15)" }}/>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 20, background: color, color: "#fff" }}>
              {bin.fill_level}%
            </span>
          </div>
        )}

        {/* Dot */}
        <div style={{
          width: zoom >= 15 ? 14 : zoom >= 13 ? 12 : 8,
          height: zoom >= 15 ? 14 : zoom >= 13 ? 12 : 8,
          borderRadius: "50%",
          background: color,
          border: `${isSelected ? 3 : 2}px solid ${isSelected ? "#3b82f6" : "rgba(255,255,255,.95)"}`,
          boxShadow: isSelected
            ? `0 0 0 3px rgba(59,130,246,.4), 0 2px 8px rgba(0,0,0,.4)`
            : "0 2px 6px rgba(0,0,0,.3)",
          transform: isSelected ? "scale(1.4)" : "scale(1)",
          transition: "all .2s",
        }}/>
      </div>
    </Marker>
  );
}

// ── LEGEND ────────────────────────────────────────────────────────────────────

function MapLegend({ bins }: { bins: any[] }) {
  const counts = {
    critical: bins.filter(b => b.fill_level >= 90).length,
    high:     bins.filter(b => b.fill_level >= 70 && b.fill_level < 90).length,
    medium:   bins.filter(b => b.fill_level >= 40 && b.fill_level < 70).length,
    low:      bins.filter(b => b.fill_level < 40).length,
  };

  return (
    <div style={{
      position: "absolute", top: 12, left: 12, zIndex: 1000,
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 4px 24px rgba(0,0,0,.12)",
      border: "1px solid rgba(0,0,0,.08)", fontFamily: "sans-serif",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#374151", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
        {bins.length} Bins
      </div>
      {[
        { label: "Critical", color: "#ef4444", count: counts.critical },
        { label: "High",     color: "#f97316", count: counts.high     },
        { label: "Medium",   color: "#eab308", count: counts.medium   },
        { label: "Low",      color: "#22c55e", count: counts.low      },
      ].filter(r => r.count > 0).map(r => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, flexShrink: 0 }}/>
          <span style={{ fontSize: 11, color: "#374151" }}>{r.label}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: r.color, marginLeft: "auto" }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

interface CitizenBinMapProps {
  barangay: string;
}

export default function CitizenBinMap({ barangay }: CitizenBinMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [bins,         setBins]         = useState<any[]>([]);
  const [selectedBin,  setSelectedBin]  = useState<any | null>(null);
  const [zoom,         setZoom]         = useState(15);
  const [mapLoaded,    setMapLoaded]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);

  const fetchBins = useCallback(async () => {
    // Fetch all bins — citizen can see all public bins
    // If barangay filtering is desired, add .eq("barangay", barangay) when that column exists
    const { data, error } = await supabase
      .from("bins")
      .select("id, device_id, name, lat, lng, fill_level, battery_level, last_seen")
      .order("fill_level", { ascending: false });

    if (!error && data) {
      setBins(data);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [barangay]);

  useEffect(() => { fetchBins(); }, [fetchBins]);

  // Realtime updates for bin fill levels
  useEffect(() => {
    const channel = supabase
      .channel("citizen-bins")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "bins",
      }, (payload: any) => {
        setBins(prev => prev.map(b =>
          b.id === payload.new.id ? { ...b, ...payload.new } : b
        ));
        setLastUpdated(new Date());
        // Update selected bin if it's the one that changed
        setSelectedBin((sel: any) =>
          sel && sel.id === payload.new.id ? { ...sel, ...payload.new } : sel
        );
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedBin(null);
  }, []);

  const recenter = () => {
    mapRef.current?.flyTo({
      center: [MAP_CENTER[1], MAP_CENTER[0]],
      zoom: 15, duration: 800,
    });
  };

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#f1f5f9" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .map-btn { transition: all .15s; }
        .map-btn:hover { transform: scale(1.05); }
      `}</style>

      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 500,
          background: "rgba(255,255,255,.9)", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #d1fae5", borderTopColor: "#059669", animation: "spin 1s linear infinite" }}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#047857", fontFamily: "sans-serif" }}>Loading bins…</span>
        </div>
      )}

      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={DEFAULT_STYLE as any}
        initialViewState={{
          longitude: MAP_CENTER[1],
          latitude: MAP_CENTER[0],
          zoom: 15, bearing: 0, pitch: 0,
        }}
        maxZoom={22}
        minZoom={10}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
        touchZoomRotate={true}
        onClick={handleMapClick}
        onZoom={e => setZoom(e.viewState.zoom)}
        onLoad={() => setMapLoaded(true)}
      >
        {mapLoaded && bins.map(bin => (
          <BinMarkerGL
            key={bin.id}
            bin={bin}
            isSelected={selectedBin?.id === bin.id}
            zoom={zoom}
            onClick={() => setSelectedBin(bin)}
          />
        ))}
      </Map>

      {/* Legend */}
      {!loading && <MapLegend bins={bins} />}

      {/* Top-right controls */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Recenter */}
        <button
          className="map-btn"
          onClick={recenter}
          title="Recenter map"
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,.96)", backdropFilter: "blur(8px)",
            border: "1.5px solid rgba(0,0,0,.1)",
            boxShadow: "0 2px 12px rgba(0,0,0,.15)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}
        >🎯</button>

        {/* Refresh */}
        <button
          className="map-btn"
          onClick={fetchBins}
          title="Refresh bins"
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,.96)", backdropFilter: "blur(8px)",
            border: "1.5px solid rgba(0,0,0,.1)",
            boxShadow: "0 2px 12px rgba(0,0,0,.15)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}
        >🔄</button>
      </div>

      {/* Bottom status bar */}
      <div style={{
        position: "absolute", bottom: 12, left: 12, zIndex: 1000,
        background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)",
        borderRadius: 20, padding: "5px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,.1)", border: "1px solid rgba(0,0,0,.06)",
        display: "flex", alignItems: "center", gap: 8, fontFamily: "sans-serif",
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "spin 0s", boxShadow: "0 0 0 2px rgba(34,197,94,.2)" }}/>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
          {bins.length} bins · updated {timeStr}
        </span>
      </div>

      {/* Bin popup */}
      {selectedBin && (
        <BinPopup bin={selectedBin} onClose={() => setSelectedBin(null)} />
      )}
    </div>
  );
}