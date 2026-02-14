"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Essential CSS
import "leaflet/dist/leaflet.css";
// We will skip the routing machine CSS import for a second to see if that's the blocker
// import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const DUMMY_BINS = [
  { id: 1, name: "Brgy San Jose", lat: 14.5995, lng: 120.9842, fillLevel: 85 },
  { id: 2, name: "Brgy Sto. Niño", lat: 14.6010, lng: 120.9890, fillLevel: 30 },
];

export default function DriverMap() {
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setIsClient(true);
      // Basic Icon Fix
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    } catch (e) {
      setError(String(e));
    }
  }, []);

  if (error) return <div className="p-10 bg-red-50 text-red-500 rounded-3xl">Error: {error}</div>;

  if (!isClient) {
    return (
      <div className="w-full h-[600px] bg-slate-100 rounded-[3rem] flex flex-col items-center justify-center border-4 border-dashed border-slate-200">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Waking up Eco-Engine...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl bg-[#ebe7de]">
      {/* INJECTED CSS TO FORCE VISIBILITY */}
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { 
          height: 100% !important; 
          width: 100% !important; 
          z-index: 10;
        }
        .leaflet-tile-pane { filter: saturate(0.8) contrast(1.1); }
      `}} />

      <MapContainer 
        center={[14.5995, 120.9842]} 
        zoom={14} 
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ height: '600px', width: '100%' }} // Doubling down on height
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {DUMMY_BINS.map(bin => (
          <Marker key={bin.id} position={[bin.lat, bin.lng]}>
            <Popup>
               <div className="p-2 font-sans">
                  <p className="font-black text-emerald-600 uppercase text-[10px]">Bin Sensor</p>
                  <p className="font-bold text-slate-800">{bin.name}</p>
                  <p className="text-xs text-slate-500">Level: {bin.fillLevel}%</p>
               </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Manual Overlay to confirm code is running */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border border-emerald-100">
        <p className="text-[10px] font-black text-emerald-600 uppercase">Map Status: Online</p>
      </div>
    </div>
  );
}