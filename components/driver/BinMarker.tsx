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
  isCandidate?: boolean; 
  isSelected?: boolean;  
  onSelect?: () => void; 
  onClick?: () => void; // Added to fix the TypeScript 'Property onClick does not exist' error
  onCollect?: (id: number) => void;
  onMove?: (id: number, lat: number, lng: number) => void;
}

export default function BinMarker({ 
  bin, 
  isEditMode, 
  isCandidate, 
  isSelected, 
  onSelect, 
  onClick, // Destructured onClick
  onCollect, 
  onMove 
}: BinMarkerProps) {
  const markerRef = useRef<any>(null);

  // Determine which selection handler to use (supports both prop names)
  const handleSelection = onSelect || onClick;

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
        // If not editing, clicking a candidate bin selects it for the math engine
        if (!isEditMode && isCandidate) {
          handleSelection?.();
        }
      }
    }),
    [bin.id, onMove, handleSelection, isEditMode, isCandidate]
  );

  const isCritical = bin.fillLevel > 90;
  const isHighPriority = bin.fillLevel > 70;

  return (
    <Marker
      position={[bin.lat, bin.lng]}
      // PASSING isSelected to our new MapAssets function
      icon={createBinIcon(bin.fillLevel, isSelected)}
      draggable={isEditMode}
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Tooltip 
        permanent 
        direction="top" 
        offset={[0, -25]} 
        className="eco-label-tooltip"
      >
        <div className="flex flex-col items-center">
          {/* Candidate Pulse - Visual Hint for the Driver */}
          {isCandidate && !isEditMode && (
            <div className={`absolute -inset-3 rounded-full blur-lg animate-pulse ${
              isSelected ? 'bg-blue-400/40' : 'bg-emerald-400/30'
            }`} />
          )}

          <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-[12px] shadow-xl border transition-all duration-500 ${
            isSelected 
              ? 'bg-blue-600 border-blue-400 scale-110 z-[1002]' 
              : isEditMode 
              ? 'bg-white border-emerald-400 border-2' 
              : isCritical 
              ? 'bg-red-50 border-red-200 animate-pulse' 
              : 'bg-white/90 border-slate-100 backdrop-blur-sm'
          }`}>
            <span className={`font-black text-[10px] uppercase tracking-tight ${
              isSelected ? 'text-white' : 'text-slate-800'
            }`}>
              {isSelected ? "🎯 " : ""}{bin.name}
            </span>
            
            <div className={`w-[1px] h-3 ${isSelected ? 'bg-blue-300' : 'bg-slate-200'}`} />
            
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
          
          {/* Action Callout */}
          {isCandidate && !isSelected && !isEditMode && (
            <span className="text-[7px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full mt-1.5 shadow-sm border border-emerald-200 uppercase tracking-widest">
              Tap to route
            </span>
          )}
        </div>
      </Tooltip>

      <Popup className="eco-popup">
        <div className="p-3 text-center min-w-[150px]">
          <h3 className="text-sm font-black text-slate-800 mb-0.5 uppercase tracking-tight">{bin.name}</h3>
          <p className="text-[10px] font-bold text-slate-400 mb-4 tracking-wide">CAPACITY: {bin.fillLevel}%</p>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCollect?.(bin.id);
            }}
            className={`w-full py-3 text-white text-[10px] font-black uppercase rounded-[1rem] transition-all shadow-lg active:scale-90 ${
              isEditMode ? 'bg-red-500 shadow-red-100' : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'
            }`}
          >
            {isEditMode ? 'Remove Station' : 'Confirm Collection'}
          </button>
        </div>
      </Popup>
    </Marker>
  );
}