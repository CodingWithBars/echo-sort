"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Essential CSS
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// --- LUPON POBLACION CENTER (TIGHT GRID) ---
const LUPON_CENTER: [number, number] = [6.9015, 125.9560];

const DUMMY_BINS = [
  { 
    id: 1, 
    name: "Bin 4", 
    lat: 6.890957117154686, 
    lng: 126.02411507732198, 
    fillLevel: 94 
  },
  { 
    id: 2, 
    name: "Bin 5", 
    lat: 6.8895558819998355, 
    lng: 126.025083502698, 
    fillLevel: 88 
  },
  { 
    id: 3, 
    name: "Bin 2", 
    lat: 6.890036067109011, 
    lng: 126.0239322048933, 
    fillLevel: 78 
  },
  { 
    id: 4, 
    name: "Bin 1", 
    lat: 6.890680405047107, 
    lng: 126.02350835313612, 
    fillLevel: 15 
  },
  { 
    id: 5, 
    name: "Bin 11", 
    lat: 6.890665867989403, 
    lng: 126.02434438869368, 
    fillLevel: 82 
  },
];

// --- DYNAMIC BIN ICON ---
const createBinIcon = (fillLevel: number) => {
  let color = "#10b981"; 
  if (fillLevel > 90) color = "#ef4444"; 
  else if (fillLevel > 70) color = "#f97316"; 
  else if (fillLevel > 40) color = "#f59e0b"; 

  return L.divIcon({
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <div style="position: absolute; top: -4px; right: -4px; background: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 1.5px solid ${color}; font-size: 8px; font-weight: 900; color: #334155;">${fillLevel}%</div>
      </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
};

// --- UPDATED ROUTING ENGINE WITH OPPORTUNITY LOGIC ---
function RoutingLayer({ driverPos, bins, routeKey }: { driverPos: [number, number], bins: any[], routeKey: number }) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !driverPos) return;

    const calculateRoute = async () => {
      // @ts-ignore
      await import("leaflet-routing-machine");

      // 1. IDENTIFY TARGETS
      // Priority A: Must pick up (> 70%)
      // Priority B: Opportunity pick up (> 50%)
      const mandatoryBins = bins.filter(b => b.fillLevel > 70);
      const opportunityBins = bins.filter(b => b.fillLevel > 50 && b.fillLevel <= 70);

      // 2. LOGIC: For this scale, we combine them and then find the shortest sequence
      // to ensure the driver isn't criss-crossing the town.
      let targets = [...mandatoryBins, ...opportunityBins];

      // 3. NEAREST-NEIGHBOR SORT (Simple Efficiency)
      // We sort the bins by distance from the driver's current position
      const sortedTargets = [];
      let currentLoc = { lat: driverPos[0], lng: driverPos[1] };
      let remaining = [...targets];

      while (remaining.length > 0) {
        remaining.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.lat - currentLoc.lat, 2) + Math.pow(a.lng - currentLoc.lng, 2));
          const distB = Math.sqrt(Math.pow(b.lat - currentLoc.lat, 2) + Math.pow(b.lng - currentLoc.lng, 2));
          return distA - distB;
        });
        const closest = remaining.shift()!;
        sortedTargets.push(closest);
        currentLoc = { lat: closest.lat, lng: closest.lng };
      }

      const waypoints = [
        L.latLng(driverPos[0], driverPos[1]),
        ...sortedTargets.map(b => L.latLng(b.lat, b.lng))
      ];

      if (routingControlRef.current) map.removeControl(routingControlRef.current);

      // @ts-ignore
      routingControlRef.current = L.Routing.control({
        waypoints: waypoints,
        lineOptions: { 
          styles: [{ color: '#10b981', weight: 6, opacity: 0.85 }],
          extendToWaypoints: true 
        },
        createMarker: () => null,
        addWaypoints: false,
        fitSelectedRoutes: true,
        show: false
      }).addTo(map);
    };

    calculateRoute();
    return () => { if (routingControlRef.current) map.removeControl(routingControlRef.current); };
  }, [map, driverPos, bins, routeKey]);

  return null;
}

export default function DriverMap() {
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [routeKey, setRouteKey] = useState(0);

  useEffect(() => { setIsClient(true); }, []);

  const findMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setDriverPos([pos.coords.latitude, pos.coords.longitude]),
        () => {
            alert("Using Lupon Center as fallback. Please enable GPS for real-time routing.");
            setDriverPos(LUPON_CENTER);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleRecalculate = () => {
    findMe();
    setRouteKey(prev => prev + 1);
  };

  if (!isClient) return <div className="w-full h-[500px] bg-slate-100 animate-pulse rounded-3xl" />;

  return (
    <div className="flex flex-col w-full -m-4 md:-m-6">
      <div className="relative w-full h-[75vh] md:h-[650px] overflow-hidden shadow-2xl bg-[#f8fafc] lg:rounded-[3.5rem]">
        <style dangerouslySetInnerHTML={{ __html: `.leaflet-container { height: 100% !important; }` }} />

        <MapContainer center={LUPON_CENTER} zoom={15} className="h-full w-full">
          <TileLayer 
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
          />

          {/* DRIVER POSITION */}
          {driverPos && (
            <Marker position={driverPos} icon={L.divIcon({ 
              html: '<div class="relative"><div class="absolute -inset-3 bg-blue-500/20 rounded-full animate-ping"></div><div class="w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div></div>',
              className: "" 
            })}>
              <Popup>Driver Location</Popup>
            </Marker>
          )}

          {/* BINS */}
          {DUMMY_BINS.map(bin => (
            <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={createBinIcon(bin.fillLevel)}>
              <Popup>
                <div className="p-1">
                    <b className="text-emerald-600 uppercase text-[10px] tracking-widest font-black">Lupon Node {bin.id}</b>
                    <p className="text-sm font-bold text-slate-800 my-1">{bin.name}</p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${bin.fillLevel}%` }}></div>
                        </div>
                        <span className="text-xs font-black">{bin.fillLevel}%</span>
                    </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {driverPos && <RoutingLayer driverPos={driverPos} bins={DUMMY_BINS} routeKey={routeKey} />}
        </MapContainer>

        {/* TOP STATUS OVERLAY */}
        <div className="absolute top-6 left-6 z-[1000] pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2.5rem] shadow-2xl border border-white/50 pointer-events-auto">
            <div className="flex items-center gap-3 mb-1">
                <div className={`w-2 h-2 rounded-full ${driverPos ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">System Status</p>
            </div>
            <p className="text-sm font-black text-slate-900">
                {driverPos ? "📍 Route Optimized" : "📡 Waiting for Driver"}
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="p-6 flex flex-col items-center bg-[#f8fafc]">
        {!driverPos ? (
          <button 
            onClick={findMe}
            className="w-full max-w-md py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <span>📡 Locate Driver & Sync Bins</span>
          </button>
        ) : (
          <button 
            onClick={handleRecalculate}
            className="w-full max-w-md py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <span>🔄 Recalculate Lupon Route</span>
          </button>
        )}
        
        <div className="mt-6 grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Bins</p>
                <p className="text-xl font-black text-slate-900">{DUMMY_BINS.length}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center shadow-sm">
                <p className="text-[9px] font-black text-orange-400 uppercase mb-1">Urgent</p>
                <p className="text-xl font-black text-orange-600">{DUMMY_BINS.filter(b => b.fillLevel > 70).length}</p>
            </div>
        </div>
      </div>
    </div>
  );
}