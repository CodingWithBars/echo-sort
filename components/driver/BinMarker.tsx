"use client";
import { useState, useEffect } from "react";
import { Marker, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";

// ─── Shared toggle state ──────────────────────────────────────────────────────
type Listener = (v: boolean) => void;
const listeners = new Set<Listener>();
let _compact = false;

function useCompactMode(): [boolean, () => void] {
  const [compact, setCompact] = useState(_compact);

  useEffect(() => {
    const handler: Listener = (v) => setCompact(v);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const toggle = () => {
    _compact = !_compact;
    listeners.forEach((fn) => fn(_compact));
  };

  return [compact, toggle];
}

// ─── Invisible anchor — tooltip is the only visual ───────────────────────────
const GHOST_ICON = L.divIcon({
  html:       "",
  className:  "",
  iconSize:   [0, 0],
  iconAnchor: [0, 0],
});

// ─── Fill level color config ──────────────────────────────────────────────────
const getFillColor = (level: number) => {
  if (level >= 90) return { bg: "bg-red-500",    text: "text-white" };
  if (level >= 70) return { bg: "bg-orange-400", text: "text-white" };
  if (level >= 40) return { bg: "bg-yellow-400", text: "text-slate-800" };
  return              { bg: "bg-emerald-500", text: "text-white" };
};

// ─── Battery icon ─────────────────────────────────────────────────────────────
const BatteryIcon = ({ level }: { level: number }) => {
  const color = level > 60 ? "#22c55e" : level > 30 ? "#f59e0b" : "#ef4444";
  const bars  = Math.round((level / 100) * 3);
  return (
    <span title={`Battery: ${level}%`} style={{ display: "inline-flex", alignItems: "center" }}>
      <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
        <rect x="0.5" y="0.5" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1" />
        <rect x="11.5" y="2.5" width="2" height="3" rx="0.5" fill="currentColor" />
        {bars >= 1 && <rect x="1.5" y="1.5" width="2.5" height="5" rx="0.5" fill={color} />}
        {bars >= 2 && <rect x="4.5" y="1.5" width="2.5" height="5" rx="0.5" fill={color} />}
        {bars >= 3 && <rect x="7.5" y="1.5" width="2.5" height="5" rx="0.5" fill={color} />}
      </svg>
    </span>
  );
};

// ─── Fill arc indicator ───────────────────────────────────────────────────────
const FillArc = ({ level }: { level: number }) => {
  const color =
    level >= 90 ? "#ef4444" : level >= 70 ? "#f97316" : level >= 40 ? "#eab308" : "#22c55e";
  const r    = 6;
  const circ = 2 * Math.PI * r;
  const dash = (level / 100) * circ;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
      <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
};

// ─── Full label ───────────────────────────────────────────────────────────────
const BinLabel = ({ bin, isSelected, zoom }: { bin: any; isSelected: boolean; zoom: number }) => {
  const fill        = getFillColor(bin.fillLevel);
  const displayName = bin.name.length > 12 ? `${bin.name.substring(0, 11)}…` : bin.name;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-md
        transition-all duration-300 select-none
        ${isSelected
          ? "bg-slate-800 border-slate-600 text-white scale-105"
          : "bg-white/95 border-slate-200 text-slate-700"
        }`}
      style={{
        backdropFilter: "blur(6px)",
        boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.18)",
        fontFamily: "'DM Mono','Fira Code',monospace",
        minWidth: "max-content",
      }}
    >
      <FillArc level={bin.fillLevel} />
      <span className={`text-[10px] font-semibold tracking-tight ${isSelected ? "text-white" : "text-slate-800"}`}>
        {displayName}
      </span>
      <span className="w-px h-3 bg-slate-300 opacity-60" />
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${fill.bg} ${fill.text}`}>
        {bin.fillLevel}%
      </span>
      {zoom >= 18 && (
        <span className={isSelected ? "text-slate-300" : "text-slate-500"}>
          <BatteryIcon level={bin.batteryLevel ?? 100} />
        </span>
      )}
    </div>
  );
};

// ─── Compact number-only badge ────────────────────────────────────────────────
const BinNumberBadge = ({ bin, isSelected }: { bin: any; isSelected: boolean }) => {
  const fill = getFillColor(bin.fillLevel);
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 shadow-md select-none
        transition-all duration-300
        ${isSelected ? "border-blue-500 scale-110" : "border-white"}
        ${fill.bg} ${fill.text}`}
      style={{
        width: 28,
        height: 28,
        fontFamily: "'DM Mono','Fira Code',monospace",
        fontSize: 9,
        fontWeight: 800,
        boxShadow: isSelected
          ? "0 0 0 3px rgba(59,130,246,0.4), 0 2px 8px rgba(0,0,0,0.25)"
          : "0 2px 6px rgba(0,0,0,0.22)",
        backdropFilter: "blur(4px)",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      {bin.fillLevel}%
    </div>
  );
};

// ─── Toggle button ────────────────────────────────────────────────────────────
export function BinLabelToggleButton() {
  const [compact, toggle] = useCompactMode();

  return (
    <button
      onClick={toggle}
      title={compact ? "Show full labels" : "Show numbers only"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 12px",
        height: 36,
        borderRadius: 10,
        border: `1.5px solid ${compact ? "#334155" : "rgba(0,0,0,0.12)"}`,
        background: compact ? "#1e293b" : "rgba(255,255,255,0.96)",
        color: compact ? "#f1f5f9" : "#334155",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'DM Mono','Fira Code',monospace",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        backdropFilter: "blur(8px)",
        transition: "all .2s",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        {compact ? (
          <>
            <rect x="1" y="2.5" width="13" height="3" rx="1.5" fill="currentColor" opacity=".85"/>
            <rect x="1" y="7"   width="9"  height="3" rx="1.5" fill="currentColor" opacity=".5"/>
            <circle cx="12.5" cy="8.5" r="2.5" fill="#22c55e"/>
          </>
        ) : (
          <>
            <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" opacity=".7"/>
            <text x="7.5" y="10.5" textAnchor="middle" fontSize="6" fontWeight="800"
              fill="currentColor" fontFamily="monospace">N</text>
          </>
        )}
      </svg>
      {compact ? "Full Labels" : "Numbers Only"}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BinMarker({ bin, isSelected, onClick }: any) {
  const [zoom, setZoom] = useState(18);
  const [compact]       = useCompactMode();

  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  const showLabel = zoom >= 14;

  return (
    <Marker
      position={[bin.lat, bin.lng]}
      icon={GHOST_ICON}
      eventHandlers={{ click: onClick }}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      {showLabel && (
        <Tooltip
          permanent
          direction="top"
          offset={[0, 0]}
          opacity={1}
          className="eco-bin-tooltip"
          interactive={false}
        >
          {compact
            ? <BinNumberBadge bin={bin} isSelected={isSelected} />
            : <BinLabel bin={bin} isSelected={isSelected} zoom={zoom} />
          }
        </Tooltip>
      )}
    </Marker>
  );
}