"use client";

import React, { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

import RoutingLayer from "./RoutingLayer";
import BinMarker from "./BinMarker";
import NavigationControls from "../ui/NavigationControls";
import EcoDashboard from "../ui/EcoDashboard";
import { LUPON_CENTER, getDistance } from "./MapAssets";

import "leaflet/dist/leaflet.css";

interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

const INITIAL_BINS: Bin[] = [
  { id: 1, name: "Bin 4", lat: 6.89095, lng: 126.02411, fillLevel: 94 },
  { id: 2, name: "Bin 5", lat: 6.88955, lng: 126.02508, fillLevel: 88 },
  { id: 3, name: "Bin 2", lat: 6.89003, lng: 126.02393, fillLevel: 78 },
  { id: 4, name: "Bin 1", lat: 6.89068, lng: 126.0235, fillLevel: 15 },
  { id: 5, name: "Bin 11", lat: 6.89066, lng: 126.02434, fillLevel: 82 },
  { id: 6, name: "Bin 19", lat: 6.89139, lng: 126.00532, fillLevel: 63 },
  { id: 7, name: "Bin 20", lat: 6.89018, lng: 126.00630, fillLevel: 46 },
];


export default function DriverMap() {
  const [bins, setBins] = useState<Bin[]>(INITIAL_BINS);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isNavMode, setIsNavMode] = useState(false);
  const [routingMode, setRoutingMode] = useState<"fastest" | "priority">("fastest");
  const [routeKey, setRouteKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  
  // Visibility States
  const [isDashboardVisible, setIsDashboardVisible] = useState(true); // Mobile Bottom Sheet
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);          // Web Sidebar

  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [topCandidates, setTopCandidates] = useState<number[]>([]);
  const [eta, setEta] = useState({ dist: "0 km", time: "0 min" });
  const [nextBinInfo, setNextBinInfo] = useState({ distance: "---", name: "---" });

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!driverPos) return;
    const active = bins.filter((b) => b.fillLevel > 50 || getDistance(driverPos, [b.lat, b.lng]) < 100);
    if (active.length > 0) {
      const sorted = active
        .map((b) => ({ ...b, d: getDistance(driverPos, [b.lat, b.lng]) }))
        .sort((a, b) => a.d - b.d);
      setTopCandidates(sorted.slice(0, 2).map((b) => b.id));
      const nextOne = selectedBinId ? sorted.find((b) => b.id === selectedBinId) || sorted[0] : sorted[0];
      setNextBinInfo({
        name: nextOne.name,
        distance: nextOne.d > 1000 ? `${(nextOne.d / 1000).toFixed(1)}km` : `${Math.round(nextOne.d)}m`,
      });
    }
  }, [driverPos, bins, selectedBinId]);

  const handleRouteUpdate = useCallback((summary: { distance: number; time: number }) => {
    setEta({
      dist: summary.distance > 0 ? `${(summary.distance / 1000).toFixed(1)} km` : "0 km",
      time: summary.time > 0 ? `${Math.round(summary.time / 60)} min` : "0 min",
    });
  }, []);

  const startLiveTracking = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => {
          setDriverPos([pos.coords.latitude, pos.coords.longitude]);
          if (pos.coords.heading !== null) setHeading(pos.coords.heading);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true },
      );
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { 
          height: 100% !important; 
          width: 100% !important;
          background: #f1f5f9 !important;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: none !important; 
          ${isNavMode ? `transform: rotate(${-heading}deg);` : ""} 
        }
        .leaflet-marker-icon { transition: transform 0.8s; ${isNavMode ? `transform: rotate(${heading}deg) !important;` : ""} }
        .leaflet-routing-container { display: none !important; }
      `}} />

      <NavigationControls
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        isNavMode={isNavMode}
        setIsNavMode={setIsNavMode}
        heading={heading}
      />

      {/* MAP AREA */}
      <div className="absolute inset-0 md:relative md:flex-1 h-full overflow-hidden order-1">
        <MapContainer
          center={LUPON_CENTER}
          zoom={18}
          maxZoom={22}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
            attribution="© Mapbox"
            maxZoom={22}
            maxNativeZoom={20}
          />
          {/* ... (Markers & RoutingLayer same as before) */}
          {driverPos && <Marker position={driverPos} icon={L.divIcon({ html: `<div style="transform: rotate(${heading}deg)" class="transition-transform duration-500"><div class="w-10 h-10 bg-blue-600 border-4 border-white rounded-full shadow-2xl flex items-center justify-center"><div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-white mb-1"></div></div></div>`, className: "" })} />}
          {bins.map((bin) => (<BinMarker key={bin.id} bin={bin} isEditMode={isEditMode} isCandidate={topCandidates.includes(bin.id)} isSelected={selectedBinId === bin.id} onSelect={() => setSelectedBinId(bin.id)} onCollect={(id) => { setBins((prev) => prev.map((b) => (b.id === id ? { ...b, fillLevel: 0 } : b))); if (selectedBinId === id) setSelectedBinId(null); }} onMove={(id, lat, lng) => setBins((prev) => prev.map((b) => (b.id === id ? { ...b, lat, lng } : b)))} />))}
          {driverPos && <RoutingLayer driverPos={driverPos} bins={bins} selectedBinId={selectedBinId} routeKey={routeKey} onRouteUpdate={handleRouteUpdate} mode={routingMode} />}
        </MapContainer>

        {/* WEB-ONLY TOGGLE BUTTON (Floating on Map) */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute top-1/2 right-4 z-[1002] -translate-y-1/2 w-8 h-12 bg-white border border-slate-200 shadow-xl rounded-xl items-center justify-center hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all group"
        >
          <span className={`transition-transform duration-500 font-black ${isSidebarOpen ? "rotate-0" : "rotate-180"}`}>
            {isSidebarOpen ? "❯" : "❮"}
          </span>
        </button>
      </div>

      {/* DASHBOARD / SIDEBAR WRAPPER */}
      <div 
        className={`fixed md:relative bottom-0 left-0 right-0 z-[1001] 
          transition-all duration-500 ease-in-out transform 
          ${isDashboardVisible ? "translate-y-0" : "translate-y-[calc(100%-48px)]"} 
          ${isSidebarOpen ? "md:w-[400px]" : "md:w-0"} 
          md:translate-y-0 md:h-full pointer-events-none md:pointer-events-auto order-2`}
      >
        <div className="pointer-events-auto h-full max-w-2xl mx-auto md:max-w-none 
                        bg-white/95 backdrop-blur-md
                        rounded-t-[3.5rem] md:rounded-none 
                        shadow-[0_-15px_40px_-10px_rgba(0,0,0,0.1)] md:shadow-[-10px_0_30px_rgba(0,0,0,0.05)] 
                        border-t md:border-t-0 md:border-l border-slate-100 flex flex-col overflow-hidden">
          
          {/* MOBILE DRAG HANDLE */}
          <button 
            className="w-full flex justify-center p-4 cursor-pointer group md:hidden" 
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
          >
            <div className={`w-12 h-1.5 rounded-full transition-all duration-300 
              ${isDashboardVisible ? "bg-slate-200 group-hover:bg-emerald-400" : "bg-emerald-500 w-16"}`} 
            />
          </button>

          <div className={`flex-1 transition-all duration-500 
            ${isDashboardVisible ? "opacity-100" : "opacity-0 md:opacity-100"} 
            ${!isSidebarOpen && "md:opacity-0"}
            overflow-y-auto overflow-x-hidden h-full`}>
            
            <EcoDashboard
              routingMode={routingMode}
              setRoutingMode={setRoutingMode}
              nextBin={nextBinInfo}
              eta={eta}
              targetCount={bins.filter((b) => b.fillLevel > 50).length}
              driverPos={driverPos}
              onStartTracking={startLiveTracking}
              onRefresh={() => {
                setRouteKey((k) => k + 1);
                setSelectedBinId(null);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}