"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import AdminBinMarker from "./AdminBinMarker";
import { LUPON_CENTER } from "@/components/map/MapAssets";
import "leaflet/dist/leaflet.css";

interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

function MapClickHandler({
  onMapDoubleClick,
}: {
  onMapDoubleClick: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    dblclick(e) {
      onMapDoubleClick(e.latlng);
    },
  });
  return null;
}

export default function BinMapView() {
  const [bins, setBins] = useState<Bin[]>([]); // Initialize with your data
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<
    "navigation-night-v1" | "satellite-streets-v12" | "outdoors-v12"
  >("satellite-streets-v12");

  const mapRef = useRef<L.Map | null>(null);

  const styles: { id: typeof mapStyle; label: string; icon: string }[] = [
    { id: "satellite-streets-v12", label: "Satellite", icon: "🛰️" },
    { id: "navigation-night-v1", label: "Night", icon: "🌙" },
    { id: "outdoors-v12", label: "Terrain", icon: "🏔️" },
  ];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRecenter = () => {
    mapRef.current?.flyTo(LUPON_CENTER, 17, { duration: 1.5 });
  };

  if (!isMounted) return null;

  return (
    <div className="h-full w-full relative bg-slate-900 overflow-hidden">
      {/* Remove Leaflet attribution for a cleaner Admin look */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .leaflet-container { height: 100% !important; width: 100% !important; z-index: 1; }
        .leaflet-control-attribution { display: none !important; }
      `,
        }}
      />

      <MapContainer
        center={LUPON_CENTER}
        zoom={18}
        maxZoom={22}
        doubleClickZoom={false}
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          key={mapStyle}
          url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
          maxZoom={22}
          maxNativeZoom={mapStyle === "satellite-streets-v12" ? 18 : 20}
        />

        <MapClickHandler
          onMapDoubleClick={(latlng) => {
            const newBin = {
              id: Date.now(),
              name: `Station ${bins.length + 1}`,
              lat: latlng.lat,
              lng: latlng.lng,
              fillLevel: 0,
            };
            setBins((prev) => [...prev, newBin]);
          }}
        />

        {bins.map((bin) => (
          <AdminBinMarker
            key={bin.id}
            bin={bin}
            isSelected={selectedBinId === bin.id}
            onSelect={(b) => setSelectedBinId(b.id)}
            onMove={(id, lat, lng) =>
              setBins((prev) =>
                prev.map((b) => (b.id === id ? { ...b, lat, lng } : b)),
              )
            }
            onDelete={(id) =>
              setBins((prev) => prev.filter((b) => b.id !== id))
            }
          />
        ))}
      </MapContainer>

      {/* --- FLOATING ACTION BUTTONS --- */}
      <div
        className={`absolute bottom-8 right-8 z-[10] flex flex-col items-end gap-3 transition-all duration-500 ${
          isSheetOpen
            ? "opacity-0 pointer-events-none scale-90 translate-y-10"
            : "opacity-100 scale-100 translate-y-0"
        }`}
      >
        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          className="group relative w-12 h-12 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl flex items-center justify-center hover:bg-white transition-all active:scale-95"
        >
          <span className="text-lg">📍</span>
          {/* Tooltip */}
          <span className="absolute right-14 px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Recenter Map
          </span>
        </button>

        {/* Settings Toggle */}
        <button
          onClick={() => setIsSheetOpen(true)}
          className="group relative w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 border-4 border-white bg-emerald-500 hover:bg-emerald-600 active:scale-90"
        >
          <span className="text-xl group-hover:rotate-90 transition-transform duration-500">
            ⚙️
          </span>

          {/* Sliding Label */}
          <span className="absolute right-16 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap shadow-xl border border-emerald-400">
            Map Settings
          </span>
        </button>
      </div>

      {/* --- FLOATING MINI-SHEET --- */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-[20] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] 
    ${isSheetOpen ? "translate-y-0 p-4 md:p-8" : "translate-y-full"}`}
      >
        {/* Added max-w-4xl for desktop but kept it compact for mobile */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-4xl mx-auto overflow-hidden">
          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
              {/* Stats Section: Made more compact */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Live Status
                </h2>
                <div className="flex items-center gap-8">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 leading-none">
                      {bins.length}
                    </p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                      Stations
                    </p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-red-600 leading-none">
                      {bins.filter((b) => b.fillLevel > 90).length}
                    </p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                      Critical
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls Section: Scaled down buttons */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Map Style
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {styles.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setMapStyle(s.id)}
                      className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border-2 transition-all ${
                        mapStyle === s.id
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-[8px] font-black uppercase tracking-tight">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer: Hidden on small mobile to save space, or kept very minimal */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
              <p className="text-[8px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Double-click map to deploy
              </p>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="text-[9px] font-black uppercase text-slate-900"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
