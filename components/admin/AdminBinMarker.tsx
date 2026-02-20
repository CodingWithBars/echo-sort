"use client";

import { useMemo, useRef } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { createBinIcon } from "../map/MapAssets";

// Standard interface for the Admin view
interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

interface AdminBinMarkerProps {
  bin: Bin;
  isSelected?: boolean;
  onSelect?: (bin: Bin) => void;
  onDelete?: (id: number) => void;
  onMove?: (id: number, lat: number, lng: number) => void;
}

export default function AdminBinMarker({ 
  bin, 
  isSelected, 
  onSelect, 
  onDelete, 
  onMove 
}: AdminBinMarkerProps) {
  const markerRef = useRef<any>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          // This allows admins to move the pin to a more accurate location
          onMove?.(bin.id, lat, lng);
        }
      },
      click() {
        onSelect?.(bin);
      }
    }),
    [bin, onMove, onSelect]
  );

  const isCritical = bin.fillLevel > 90;
  const isHighPriority = bin.fillLevel > 70;

  return (
    <Marker
      position={[bin.lat, bin.lng]}
      icon={createBinIcon(bin.fillLevel, isSelected)}
      draggable={true} // Admin always has power to move pins
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Tooltip 
        permanent 
        direction="top" 
        offset={[0, -20]} 
        className="admin-label-tooltip"
      >
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full shadow-lg border-2 transition-all duration-300 ${
          isSelected 
            ? 'bg-slate-900 border-emerald-500 scale-110 z-[1001]' 
            : 'bg-white border-slate-200'
        }`}>
          <span className={`font-black text-[9px] uppercase tracking-tighter ${
            isSelected ? 'text-white' : 'text-slate-700'
          }`}>
            {bin.name}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isCritical ? 'bg-red-500 animate-pulse' : 
            isHighPriority ? 'bg-orange-500' : 'bg-emerald-500'
          }`} />
        </div>
      </Tooltip>

      <Popup className="admin-popup">
        <div className="p-2 text-center min-w-[160px]">
          <div className="mb-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">{bin.name}</h3>
            <p className="text-[9px] font-bold text-slate-400">CAPACITY: {bin.fillLevel}% FULL</p>
          </div>

          <div className="space-y-1.5">
            <button 
              onClick={() => console.log("Manual Refresh Triggered")}
              className="w-full py-2 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
            >
              Ping Sensor
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if(confirm("Permanently remove this station from the network?")) {
                    onDelete?.(bin.id);
                }
              }}
              className="w-full py-2 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded-lg border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              Delete Station
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}