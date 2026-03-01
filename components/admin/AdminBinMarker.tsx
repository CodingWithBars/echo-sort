"use client";

import { useMemo, useRef } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { createBinIcon } from "../map/MapAssets";

interface Bin {
  id: number;
  device_id: string;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
  battery_level?: number;
}

interface AdminBinMarkerProps {
  bin: Bin;
  isSelected: boolean;
  onSelect: (bin: Bin) => void;
  onMove: (id: number, lat: number, lng: number) => void;
  onDelete: (bin: Bin) => void; // Changed id: number to bin: Bin for better context
}

export default function AdminBinMarker({
  bin,
  isSelected,
  onSelect,
  onDelete,
  onMove,
}: AdminBinMarkerProps) {
  const markerRef = useRef<any>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onMove?.(bin.id, lat, lng);
        }
      },
      click() {
        onSelect?.(bin);
      },
    }),
    [bin, onMove, onSelect],
  );

  const isCritical = bin.fillLevel > 90;
  const isHighPriority = bin.fillLevel > 70;

  return (
    <Marker
      position={[bin.lat, bin.lng]}
      // Pass 'true' for isMini to hide the internal percentage pill from the MapAsset
      icon={createBinIcon(bin.fillLevel, isSelected, bin.battery_level, true)}
      draggable={true}
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Tooltip
        permanent
        direction="top"
        offset={[0, -20]} // Back to a standard offset
        className="admin-label-tooltip"
      >
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-xl border-2 transition-all duration-300 ${
            isSelected
              ? "bg-slate-900 border-emerald-500 scale-110 z-[1001]"
              : "bg-white border-slate-100"
          }`}
        >
          {/* BIN NAME */}
          <span
            className={`font-black text-[10px] uppercase tracking-tight ${
              isSelected ? "text-white" : "text-slate-700"
            }`}
          >
            {bin.name}
          </span>

          {/* VERTICAL DIVIDER */}
          <div
            className={`w-[1px] h-3 ${isSelected ? "bg-white/20" : "bg-slate-200"}`}
          />

          {/* PERCENTAGE LEVEL */}
          <span
            className={`font-black text-[10px] ${
              isCritical
                ? "text-red-500"
                : isHighPriority
                  ? "text-orange-500"
                  : "text-emerald-500"
            }`}
          >
            {bin.fillLevel}%
          </span>

          {/* STATUS DOT */}
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isCritical
                ? "bg-red-500 animate-pulse"
                : isHighPriority
                  ? "bg-orange-500"
                  : "bg-emerald-500"
            }`}
          />
        </div>
      </Tooltip>

      <Popup className="admin-popup">
        <div className="p-2 text-center min-w-[160px]">
          <div className="mb-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">
              {bin.name}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {bin.fillLevel}% Full
            </p>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={() => console.log("Manual Refresh Triggered")}
              className="w-full py-2.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Ping Sensor
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                // REMOVED: window.confirm()
                // JUST CALL: onDelete which now opens your custom modal
                onDelete?.(bin);
              }}
              className="w-full py-2.5 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
            >
              Delete Station
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
