"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

import RoutingLayer from "./RoutingLayer";
import BinMarker from "./BinMarker";
import { LUPON_CENTER, getDistance } from "./MapAssets";

import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// Initial data for Lupon nodes
const INITIAL_BINS = [
  { id: 1, name: "Bin 4", lat: 6.89095, lng: 126.02411, fillLevel: 94 },
  { id: 2, name: "Bin 5", lat: 6.88955, lng: 126.02508, fillLevel: 88 },
  { id: 3, name: "Bin 2", lat: 6.89003, lng: 126.02393, fillLevel: 78 },
  { id: 4, name: "Bin 1", lat: 6.89068, lng: 126.0235, fillLevel: 15 },
  { id: 5, name: "Bin 11", lat: 6.89066, lng: 126.02434, fillLevel: 82 },
];

// Component to handle map clicks for adding new bins
function MapClickHandler({ onMapClick, isEditMode }: { onMapClick: (lat: number, lng: number) => void, isEditMode: boolean }) {
  useMapEvents({
    click: (e) => {
      // Only add a bin if we clicked the map background, not a marker/popup
      if (isEditMode && (e.originalEvent.target as HTMLElement).classList.contains('leaflet-container')) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapRefresher({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.panTo(center, { animate: true });
  }, [center, map]);
  return null;
}

export default function DriverMap() {
  const [bins, setBins] = useState(INITIAL_BINS);
  const [isEditMode, setIsEditMode] = useState(false);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [routeKey, setRouteKey] = useState(0);
  const [eta, setEta] = useState({ dist: "0 km", time: "0 min" });
  const [nextBinInfo, setNextBinInfo] = useState({ distance: "---", name: "Calculating..." });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update "Next Target" in Dashboard based on proximity
  useEffect(() => {
    if (driverPos) {
      const activeBins = bins.filter((b) => b.fillLevel > 50);
      if (activeBins.length > 0) {
        const sorted = activeBins
          .map((b) => ({ ...b, dist: getDistance(driverPos, [b.lat, b.lng]) }))
          .sort((a, b) => a.dist - b.dist);
        
        const nearest = sorted[0];
        setNextBinInfo({
          name: nearest.name,
          distance: nearest.dist > 1000 
            ? `${(nearest.dist / 1000).toFixed(1)} km` 
            : `${Math.round(nearest.dist)} m`,
        });
      } else {
        setNextBinInfo({ name: "Clear", distance: "All Clean" });
      }
    }
  }, [driverPos, bins]);

  // --- NEW: HANDLE DRAGGING BINS ---
  const handleMoveBin = (id: number, lat: number, lng: number) => {
    setBins(prev => prev.map(b => b.id === id ? { ...b, lat, lng } : b));
    setRouteKey(prev => prev + 1); // Triggers re-route after move
  };

  // Handle adding a new bin on map click
  const handleAddNewBin = (lat: number, lng: number) => {
    const newId = bins.length > 0 ? Math.max(...bins.map(b => b.id)) + 1 : 1;
    const newBin = {
      id: newId,
      name: `Node ${newId}`,
      lat,
      lng,
      fillLevel: Math.floor(Math.random() * 60) + 40,
    };
    setBins(prev => [...prev, newBin]);
    setRouteKey(k => k + 1);
  };

  // Handle deleting or collecting a bin
  const handleBinAction = (id: number) => {
    if (isEditMode) {
      setBins(prev => prev.filter(b => b.id !== id));
    } else {
      setBins(prev => prev.map(b => b.id === id ? { ...b, fillLevel: 0 } : b));
    }
    setRouteKey(k => k + 1);
  };

  const handleRouteUpdate = (summary: { distance: number; time: number }) => {
    setEta({
      dist: summary.distance > 0 ? `${(summary.distance / 1000).toFixed(1)} km` : "Snap",
      time: summary.time > 0 ? `${Math.round(summary.time / 60)} min` : "--",
    });
  };

  const startLiveTracking = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setDriverPos([pos.coords.latitude, pos.coords.longitude]),
        (err) => { console.error(err); setDriverPos(LUPON_CENTER); },
        { enableHighAccuracy: true }
      );
    }
  };

  if (!isClient) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-tooltip.eco-label-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip-top.eco-label-tooltip::before { display: none !important; }
        .leaflet-container { height: 100%; width: 100%; z-index: 1; }
      `}} />

      {/* TOP FLOATING CONTROLS */}
      <div className="absolute top-6 left-6 right-6 z-[1000] flex justify-between items-start pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white pointer-events-auto">
            <h1 className="text-xl font-black text-emerald-600 tracking-tighter uppercase italic">EcoRoute</h1>
        </div>

        <button 
          onClick={() => setIsEditMode(!isEditMode)}
          className={`p-4 rounded-full shadow-2xl transition-all pointer-events-auto border-4 ${
            isEditMode ? 'bg-red-500 text-white border-red-200 rotate-90' : 'bg-white text-emerald-600 border-emerald-50'
          }`}
        >
          {isEditMode ? <span className="font-bold">✕</span> : <span className="text-xl">⚙️</span>}
        </button>
      </div>

      {isEditMode && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl animate-bounce">
          Drag Bins to Move / Click Map to Add
        </div>
      )}

      {/* MAP AREA */}
      <div className="relative flex-1">
        <MapContainer center={LUPON_CENTER} zoom={17} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <MapRefresher center={driverPos} />
          <MapClickHandler onMapClick={handleAddNewBin} isEditMode={isEditMode} />

          {driverPos && (
            <Marker position={driverPos} icon={L.divIcon({
              html: `<div class="w-6 h-6 bg-blue-600 border-4 border-white rounded-full shadow-2xl animate-pulse"></div>`,
              className: ""
            })} />
          )}

          {bins.map((bin) => (
            <BinMarker 
              key={bin.id} 
              bin={bin} 
              isEditMode={isEditMode} 
              onCollect={handleBinAction}
              onMove={handleMoveBin} // New Move Handler
            />
          ))}

          {driverPos && (
            <RoutingLayer 
              driverPos={driverPos} 
              bins={bins} 
              routeKey={routeKey} 
              onRouteUpdate={handleRouteUpdate} 
            />
          )}
        </MapContainer>
      </div>

      {/* ECO-DASHBOARD COCKPIT */}
      <div className="bg-white rounded-t-[3.5rem] p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] z-[1000] transition-transform duration-500">
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 flex flex-col justify-center">
              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Bin</span>
              <span className="block text-sm font-black text-slate-800 truncate">{nextBinInfo.name}</span>
              <span className="text-[10px] font-bold text-emerald-600">{nextBinInfo.distance}</span>
            </div>
            <div className="bg-emerald-600 p-4 rounded-[2rem] text-white shadow-xl shadow-emerald-100 text-center scale-110 flex flex-col justify-center border-4 border-emerald-500">
              <span className="block text-[8px] font-black opacity-60 uppercase tracking-widest mb-1">Trip Time</span>
              <span className="block text-xl font-black">{eta.time}</span>
              <span className="text-[10px] font-bold opacity-80">{eta.dist}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 flex flex-col justify-center">
              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Targets</span>
              <span className="block text-xl font-black text-slate-800">
                {bins.filter(b => b.fillLevel > 50).length}
              </span>
              <span className="text-[10px] font-bold text-slate-400">In Queue</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={startLiveTracking}
              className={`flex-1 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${
                driverPos ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-xl shadow-blue-200'
              }`}
            >
              {driverPos ? "📡 Tracking Active" : "🚀 Start Shift"}
            </button>
            <button 
              onClick={() => setRouteKey(k => k + 1)}
              className="px-8 py-5 rounded-[2rem] bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              🔄
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}