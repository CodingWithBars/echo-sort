"use client";

import { useMemo, useRef } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { createBinIcon } from "./MapAssets";

interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

interface BinMarkerProps {
  bin: Bin;
  isEditMode: boolean;
  onCollect?: (id: number) => void;
  onMove?: (id: number, lat: number, lng: number) => void; // <--- NEW PROP
}

export default function BinMarker({ bin, isEditMode, onCollect, onMove }: BinMarkerProps) {
  const markerRef = useRef<any>(null);

  // Memoize event handlers to prevent unnecessary re-renders
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onMove?.(bin.id, lat, lng);
        }
      },
    }),
    [bin.id, onMove]
  );

  const isCritical = bin.fillLevel > 90;
  const isHighPriority = bin.fillLevel > 70;

  return (
    <Marker
      position={[bin.lat, bin.lng]}
      icon={createBinIcon(bin.fillLevel)}
      draggable={isEditMode} // Only draggable when gear icon is active
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Tooltip 
        permanent 
        direction="top" 
        offset={[0, -20]} 
        className="eco-label-tooltip"
      >
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full shadow-lg border transition-all ${
          isEditMode ? 'cursor-move border-emerald-400 border-2' : ''
        } ${isCritical ? 'bg-red-50 border-red-100 animate-pulse' : 'bg-white border-slate-100'}`}>
          <span className="font-black text-[10px] uppercase tracking-tighter text-slate-700">
            {isEditMode ? "🖐️ " : ""}{bin.name}
          </span>
          <div className="w-[1px] h-3 bg-slate-200" />
          <span className={`font-black text-[10px] ${
            isCritical ? 'text-red-600' : isHighPriority ? 'text-orange-500' : 'text-emerald-600'
          }`}>
            {bin.fillLevel}%
          </span>
        </div>
      </Tooltip>

      <Popup className="eco-popup">
        <div className="p-2 text-center min-w-[130px]">
          <h3 className="text-base font-bold text-slate-800 mb-2">{bin.name}</h3>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCollect?.(bin.id);
            }}
            className={`w-full py-2.5 text-white text-[10px] font-black uppercase rounded-[1.2rem] transition-all shadow-md ${
              isEditMode ? 'bg-red-500' : 'bg-emerald-600'
            }`}
          >
            {isEditMode ? 'Remove Node' : 'Mark Collected'}
          </button>
        </div>
      </Popup>
    </Marker>
  );
}