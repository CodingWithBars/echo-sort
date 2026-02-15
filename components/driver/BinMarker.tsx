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
  isCandidate?: boolean; // NEW: Is it one of the top 2 closest?
  isSelected?: boolean;  // NEW: Has the driver manually clicked it?
  onSelect?: () => void; // NEW: Callback for manual selection
  onCollect?: (id: number) => void;
  onMove?: (id: number, lat: number, lng: number) => void;
}

export default function BinMarker({ 
  bin, 
  isEditMode, 
  isCandidate, 
  isSelected, 
  onSelect, 
  onCollect, 
  onMove 
}: BinMarkerProps) {
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
        // If driver clicks a bin that is a candidate, select it for routing
        if (!isEditMode && isCandidate) {
          onSelect?.();
        }
      }
    }),
    [bin.id, onMove, onSelect, isEditMode, isCandidate]
  );

  const isCritical = bin.fillLevel > 90;
  const isHighPriority = bin.fillLevel > 70;

  return (
    <Marker
      position={[bin.lat, bin.lng]}
      icon={createBinIcon(bin.fillLevel)}
      draggable={isEditMode}
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Tooltip 
        permanent 
        direction="top" 
        offset={[0, -20]} 
        className="eco-label-tooltip"
      >
        <div className={`flex flex-col items-center group`}>
          {/* VISUAL FEEDBACK: Candidate Highlight */}
          {isCandidate && !isEditMode && (
            <div className={`absolute -inset-2 rounded-full blur-md animate-pulse ${
              isSelected ? 'bg-blue-400 opacity-60' : 'bg-emerald-400 opacity-40'
            }`} />
          )}

          <div className={`relative flex items-center gap-2 px-3 py-1 rounded-full shadow-lg border transition-all duration-300 ${
            isSelected 
              ? 'bg-blue-600 border-blue-400 scale-110 z-[1002]' 
              : isEditMode 
              ? 'cursor-move border-emerald-400 border-2' 
              : isCritical 
              ? 'bg-red-50 border-red-100 animate-pulse' 
              : 'bg-white border-slate-100'
          }`}>
            <span className={`font-black text-[10px] uppercase tracking-tighter ${
              isSelected ? 'text-white' : 'text-slate-700'
            }`}>
              {isSelected ? "📍 " : isEditMode ? "🖐️ " : ""}{bin.name}
            </span>
            
            <div className={`w-[1px] h-3 ${isSelected ? 'bg-blue-400' : 'bg-slate-200'}`} />
            
            <span className={`font-black text-[10px] ${
              isSelected 
                ? 'text-white' 
                : isCritical 
                ? 'text-red-600' 
                : isHighPriority 
                ? 'text-orange-500' 
                : 'text-emerald-600'
            }`}>
              {bin.fillLevel}%
            </span>
          </div>
          
          {/* Driver Choice Label */}
          {isCandidate && !isSelected && !isEditMode && (
            <span className="text-[8px] font-bold text-emerald-700 bg-white/80 px-2 rounded-full mt-1 shadow-sm border border-emerald-100">
              TAP TO ROUTE
            </span>
          )}
        </div>
      </Tooltip>

      <Popup className="eco-popup">
        <div className="p-2 text-center min-w-[130px]">
          <h3 className="text-base font-bold text-slate-800 mb-1">{bin.name}</h3>
          <p className="text-[9px] text-slate-500 mb-3">Status: {bin.fillLevel}% Full</p>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCollect?.(bin.id);
            }}
            className={`w-full py-2.5 text-white text-[10px] font-black uppercase rounded-[1.2rem] transition-all shadow-md active:scale-95 ${
              isEditMode ? 'bg-red-500' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isEditMode ? 'Remove Node' : 'Mark Collected'}
          </button>
        </div>
      </Popup>
    </Marker>
  );
}