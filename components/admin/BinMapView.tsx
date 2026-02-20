"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import AdminBinMarker from "./AdminBinMarker"; 
import { LUPON_CENTER } from "@/components/map/MapAssets";
import "leaflet/dist/leaflet.css";

interface Bin { id: number; name: string; lat: number; lng: number; fillLevel: number; }

function MapClickHandler({ onMapDoubleClick }: { onMapDoubleClick: (latlng: L.LatLng) => void }) {
  useMapEvents({ dblclick(e) { onMapDoubleClick(e.latlng); } });
  return null;
}

export default function BinMapView() {
  const [bins, setBins] = useState<Bin[]>([]); // Initialize with your data
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"navigation-night-v1" | "satellite-streets-v12" | "outdoors-v12">("satellite-streets-v12");
  
  const mapRef = useRef<L.Map | null>(null);

  const styles: { id: typeof mapStyle; label: string; icon: string }[] = [
    { id: "satellite-streets-v12", label: "Satellite", icon: "🛰️" },
    { id: "navigation-night-v1", label: "Night", icon: "🌙" },
    { id: "outdoors-v12", label: "Terrain", icon: "🏔️" },
  ];

  useEffect(() => { setIsMounted(true); }, []);

  const handleRecenter = () => {
    mapRef.current?.flyTo(LUPON_CENTER, 17, { duration: 1.5 });
  };

  if (!isMounted) return null;

  return (
    <div className="h-full w-full relative bg-slate-900 overflow-hidden">
      {/* Remove Leaflet attribution for a cleaner Admin look */}
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { height: 100% !important; width: 100% !important; z-index: 1; }
        .leaflet-control-attribution { display: none !important; }
      ` }} />

      <MapContainer
        center={LUPON_CENTER}
        zoom={17}
        doubleClickZoom={false}
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          key={mapStyle}
          url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
        />
        
        <MapClickHandler onMapDoubleClick={(latlng) => {
          const newBin = { id: Date.now(), name: `Station ${bins.length + 1}`, lat: latlng.lat, lng: latlng.lng, fillLevel: 0 };
          setBins(prev => [...prev, newBin]);
        }} />

        {bins.map((bin) => (
          <AdminBinMarker 
            key={bin.id} 
            bin={bin} 
            isSelected={selectedBinId === bin.id}
            onSelect={(b) => setSelectedBinId(b.id)}
            onMove={(id, lat, lng) => setBins(prev => prev.map(b => b.id === id ? {...b, lat, lng} : b))}
            onDelete={(id) => setBins(prev => prev.filter(b => b.id !== id))}
          />
        ))}
      </MapContainer>

      {/* --- FLOATING ACTION BUTTONS --- */}
      <div className="absolute bottom-8 right-8 z-[10] flex flex-col gap-3">
        <button 
          onClick={handleRecenter}
          className="w-12 h-12 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl flex items-center justify-center hover:bg-white transition-all active:scale-95"
        >
          📍
        </button>
        <button 
          onClick={() => setIsSheetOpen(!isSheetOpen)}
          className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-500 border-4 border-white ${isSheetOpen ? 'bg-slate-900 rotate-90' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        >
          <span className="text-xl">{isSheetOpen ? "✕" : "⚙️"}</span>
        </button>
      </div>

      {/* --- BOTTOM SHEET --- */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-[20] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="bg-white/95 backdrop-blur-2xl rounded-t-[3rem] border-t border-slate-200 p-10 shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
          <div className="max-w-5xl mx-auto">
            {/* Drag Handle */}
            <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mb-10" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Stats Section */}
              <div className="space-y-6">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Network Intelligence</h2>
                <div className="flex items-center gap-12">
                  <div className="space-y-1">
                    <p className="text-5xl font-black text-slate-900">{bins.length}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Deployed Stations</p>
                  </div>
                  <div className="w-px h-16 bg-slate-200" />
                  <div className="space-y-1">
                    <p className="text-5xl font-black text-red-600">{bins.filter(b => b.fillLevel > 90).length}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Critical Action</p>
                  </div>
                </div>
              </div>

              {/* Controls Section */}
              <div className="space-y-6">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Map Configuration</h2>
                <div className="grid grid-cols-3 gap-4">
                  {styles.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setMapStyle(s.id)}
                      className={`flex flex-col items-center gap-3 p-4 rounded-[2rem] border-2 transition-all ${mapStyle === s.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                      <span className="text-2xl">{s.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center text-slate-400">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                System Live: Double-click to deploy
              </p>
              <button 
                onClick={() => setIsSheetOpen(false)}
                className="text-[11px] font-black uppercase text-slate-900 hover:tracking-widest transition-all"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}