"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createClient } from "@/utils/supabase/client";
import { LUPON_CENTER } from "@/components/map/MapAssets";
import { MapPin, Navigation, Calendar, Info, Layers } from "lucide-react";

const supabase = createClient();
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const MAP_STYLE: any = {
  version: 8,
  sources: {
    "mapbox-sat-streets": {
      type: "raster",
      tiles: [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`],
      tileSize: 512,
      attribution: '© Mapbox © OpenStreetMap',
    },
  },
  layers: [
    { id: "background",        type: "background", paint: { "background-color": "#0f172a" } },
    { id: "satellite-streets", type: "raster",     source: "mapbox-sat-streets" },
  ],
};

function fillColor(level: number): string {
  if (level >= 90) return "#ef4444";
  if (level >= 70) return "#f97316";
  if (level >= 40) return "#eab308";
  return "#22c55e";
}

export default function BinLocations() {
  const mapRef = useRef<MapRef>(null);
  const [bins, setBins] = useState<any[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedBin, setSelectedBin] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchBins = async () => {
      const { data } = await supabase.from("bins").select("*");
      if (data) setBins(data);
    };
    fetchBins();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.log("Location denied")
      );
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#0f172a] relative overflow-hidden font-sans">
      <style>{`
        .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl-bottom-left { display: none !important; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.5); opacity: 0; } }
      `}</style>

      {/* --- FLOATING HEADER STATS --- */}
      <div className="absolute top-4 left-4 right-4 z-[10] flex gap-3 overflow-x-auto pb-4 no-scrollbar">
        <div className="bg-slate-900/80 backdrop-blur-xl px-5 py-3 rounded-[1.5rem] border border-white/10 shadow-2xl flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
            <MapPin size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Nearby</p>
            <p className="text-sm font-black text-white">{bins.length} Locations</p>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl px-5 py-3 rounded-[1.5rem] border border-white/10 shadow-2xl flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Status</p>
            <p className="text-sm font-black text-white">
              {bins.filter(b => b.fill_level < 80).length} Available
            </p>
          </div>
        </div>
      </div>

      {/* --- THE MAP --- */}
      <div className="flex-1 w-full relative">
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          initialViewState={{
            longitude: LUPON_CENTER[1],
            latitude: LUPON_CENTER[0],
            zoom: 17,
          }}
          style={{ width: "100%", height: "100%" }}
        >
          {userPos && (
            <Marker longitude={userPos[1]} latitude={userPos[0]} anchor="center">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute w-full h-full bg-blue-500 rounded-full animate-[pulse_2s_infinite]" />
                <div className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg z-10" />
              </div>
            </Marker>
          )}

          {bins.map((bin) => (
            <Marker
              key={bin.id}
              longitude={bin.lng}
              latitude={bin.lat}
              anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedBin(bin); }}
            >
              <div className="cursor-pointer group flex flex-col items-center">
                <div className={`p-2 rounded-2xl border-2 transition-all duration-300 ${selectedBin?.id === bin.id ? "bg-slate-900 border-blue-500 scale-110 shadow-2xl" : "bg-white border-transparent shadow-lg"}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: fillColor(bin.fill_level) }} />
                    <span className={`text-[10px] font-black ${selectedBin?.id === bin.id ? "text-white" : "text-slate-900"}`}>{bin.fill_level}%</span>
                  </div>
                </div>
                <div className={`w-0.5 h-2 mt-0.5 transition-colors ${selectedBin?.id === bin.id ? "bg-blue-500" : "bg-white"}`} />
              </div>
            </Marker>
          ))}
        </Map>
      </div>

      {/* --- SELECTED BIN INFO PANEL --- */}
      {selectedBin && (
        <div className="absolute bottom-6 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-7 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight italic uppercase">{selectedBin.name}</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Collection Station
                </p>
              </div>
              <button 
                onClick={() => setSelectedBin(null)}
                className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 transition-colors border border-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 mb-6">
              <div className="flex justify-between mb-2 items-end">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Fill Level</span>
                <span className="text-xl font-black italic text-white">{selectedBin.fill_level}%</span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-1000 rounded-full"
                  style={{ width: `${selectedBin.fill_level}%`, background: fillColor(selectedBin.fill_level) }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedBin.lat},${selectedBin.lng}`)}
                className="flex-1 py-5 bg-white text-slate-900 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl flex items-center justify-center gap-3"
              >
                <Navigation size={18} />
                Get Directions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}