"use client";
import { useState } from "react";
import { Marker, Tooltip, useMapEvents } from "react-leaflet";
import { createBinIcon } from "../map/MapAssets";

export default function BinMarker({ bin, isSelected, onClick }: any) {
  const [zoom, setZoom] = useState(18);

  // Track zoom level to hide text/shrink icons
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  // Thresholds for a cleaner UI
  const showText = zoom >= 17; // Only show names when close
  const isMini = zoom < 15;    // Shrink icons when very far

  return (
    <Marker 
      position={[bin.lat, bin.lng]} 
      // Pass 'isMini' to your icon creator to return a smaller L.divIcon
      icon={createBinIcon(bin.fillLevel, isSelected, bin.batteryLevel, isMini)}
      eventHandlers={{ click: onClick }}
    >
      {/* Only render Tooltip if showText is true. 
        We use 'opacity' for a smoother transition than just removing it.
      */}
      {showText && (
        <Tooltip 
          permanent 
          direction="top" 
          offset={[0, -20]} 
          opacity={zoom >= 17 ? 1 : 0}
          className="eco-label-tooltip transition-opacity duration-300"
        >
          <div className={`
            px-2 py-0.5 rounded-[8px] border shadow-sm transition-all
            ${isSelected ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white/90 text-slate-700 border-slate-200'}
          `}>
            {/* Shortened name logic: Only show first 8 chars if it's too long */}
            <span className="text-[9px] font-bold whitespace-nowrap">
               {bin.name.length > 10 ? `${bin.name.substring(0, 8)}..` : bin.name} • {bin.fillLevel}%
            </span>
          </div>
        </Tooltip>
      )}
    </Marker>
  );
}