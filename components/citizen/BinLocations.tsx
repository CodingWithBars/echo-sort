"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { LUPON_CENTER, getDistance } from "@/components/driver/MapAssets";
import BinMarker from "@/components/driver/BinMarker"; // Reuse your existing marker component
import "leaflet/dist/leaflet.css";

interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

const INITIAL_BINS: Bin[] = [
  { id: 1, name: "Public Bin - Plaza", lat: 6.89095, lng: 126.02411, fillLevel: 94 },
  { id: 2, name: "Public Bin - Market", lat: 6.88955, lng: 126.02508, fillLevel: 20 },
  { id: 3, name: "Community Bin 2", lat: 6.89003, lng: 126.02393, fillLevel: 78 },
  { id: 4, name: "Community Bin 1", lat: 6.89068, lng: 126.0235, fillLevel: 15 },
];

export default function BinLocations() {
  const [bins] = useState<Bin[]>(INITIAL_BINS);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Get user's current location to show "Nearest Bin"
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.log("Location denied")
      );
    }
  }, []);

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full w-full bg-white relative">
      <style dangerouslySetInnerHTML={{ __html: `.leaflet-container { height: 100%; width: 100%; }` }} />

      {/* --- FLOATING HEADER STATS --- */}
      <div className="absolute top-4 left-4 right-4 z-[1001] flex gap-2 overflow-x-auto pb-2 no-scrollbar pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm">📍</div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Nearby</p>
            <p className="text-sm font-bold text-slate-900">{bins.length} Collection Points</p>
          </div>
        </div>
        
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm">♻️</div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</p>
            <p className="text-sm font-bold text-slate-900">
              {bins.filter(b => b.fillLevel < 80).length} Available
            </p>
          </div>
        </div>
      </div>

      {/* --- THE MAP --- */}
      <div className="flex-1 w-full relative">
        <MapContainer
          center={LUPON_CENTER}
          zoom={17}
          zoomControl={false}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User Location Marker */}
          {userPos && (
            <Marker 
              position={userPos} 
              icon={L.divIcon({
                html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg ring-4 ring-blue-500/20 animate-pulse"></div>`,
                className: ""
              })}
            />
          )}

          {/* Render Bins using your existing BinMarker or a simplified one */}
          {bins.map((bin) => (
            <BinMarker
              key={bin.id}
              bin={bin}
              isEditMode={false} // Citizens cannot edit
              isSelected={selectedBin?.id === bin.id}
              onClick={() => setSelectedBin(bin)}
            />
          ))}
        </MapContainer>
      </div>

      {/* --- SELECTED BIN INFO PANEL (Citizen View) --- */}
      {selectedBin && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[1001] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedBin.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {userPos ? `${Math.round(getDistance(userPos, [selectedBin.lat, selectedBin.lng]))}m away from you` : "Collection Station"}
                </p>
              </div>
              <button 
                onClick={() => setSelectedBin(null)}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"
              >✕</button>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
              <div className="flex-1">
                <div className="flex justify-between mb-1 text-[10px] font-black uppercase tracking-tighter">
                  <span className={selectedBin.fillLevel > 80 ? "text-red-500" : "text-emerald-500"}>
                    {selectedBin.fillLevel > 80 ? "Almost Full" : "Ready for disposal"}
                  </span>
                  <span className="text-slate-400">{selectedBin.fillLevel}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${selectedBin.fillLevel > 80 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${selectedBin.fillLevel}%` }}
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedBin.lat},${selectedBin.lng}`)}
              className="w-full mt-4 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-lg shadow-slate-200"
            >
              Get Directions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}