"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Essential CSS
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// --- LEAFLET ASSET FIX ---
if (typeof window !== "undefined") {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

// --- CONSTANTS & HELPERS ---
const LUPON_CENTER: [number, number] = [6.8906, 126.0241];

const DUMMY_BINS = [
  { id: 1, name: "Bin 4", lat: 6.89095, lng: 126.02411, fillLevel: 94 },
  { id: 2, name: "Bin 5", lat: 6.88955, lng: 126.02508, fillLevel: 88 },
  { id: 3, name: "Bin 2", lat: 6.89003, lng: 126.02393, fillLevel: 78 },
  { id: 4, name: "Bin 1", lat: 6.89068, lng: 126.02350, fillLevel: 15 },
  { id: 5, name: "Bin 11", lat: 6.89066, lng: 126.02434, fillLevel: 82 },
];

const getDistance = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const φ1 = (p1[0] * Math.PI) / 180;
  const φ2 = (p2[0] * Math.PI) / 180;
  const Δφ = ((p2[0] - p1[0]) * Math.PI) / 180;
  const Δλ = ((p2[1] - p1[1]) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const createBinIcon = (fillLevel: number) => {
  let color = "#10b981"; 
  if (fillLevel > 90) color = "#ef4444"; 
  else if (fillLevel > 70) color = "#f97316"; 
  else if (fillLevel > 40) color = "#f59e0b"; 

  return L.divIcon({
    html: `<div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" fill="${color}" style="width: 30px; height: 30px; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.2));">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <div style="position: absolute; top: -2px; right: -2px; background: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 2px solid ${color}; font-size: 8px; font-weight: 900; color: #1e293b;">${fillLevel}%</div>
      </div>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
};

function MapRefresher({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.panTo(center, { animate: true });
  }, [center, map]);
  return null;
}

function RoutingLayer({ driverPos, bins, routeKey }: { driverPos: [number, number], bins: any[], routeKey: number }) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !driverPos) return;

    const updateRoute = async () => {
      try {
        // 1. Ensure the module is loaded
        // @ts-ignore
        await import("leaflet-routing-machine");
        
        const LeafletAny = L as any;

        // 2. Safety Cleanup: Always remove old routes first
        if (routingControlRef.current) {
          map.removeControl(routingControlRef.current);
          routingControlRef.current = null;
        }

        const targets = bins.filter(b => b.fillLevel > 50);
        if (targets.length === 0) return;

        // 3. Sorting logic (Nearest Neighbor)
        const sorted = [];
        let currentLoc = { lat: driverPos[0], lng: driverPos[1] };
        let pool = [...targets];

        while (pool.length > 0) {
          pool.sort((a, b) => 
            Math.hypot(a.lat - currentLoc.lat, a.lng - currentLoc.lng) - 
            Math.hypot(b.lat - currentLoc.lat, b.lng - currentLoc.lng)
          );
          const next = pool.shift()!;
          sorted.push(next);
          currentLoc = { lat: next.lat, lng: next.lng };
        }

        // 4. Create Waypoints
        const waypoints = [
          L.latLng(driverPos[0], driverPos[1]), 
          ...sorted.map(b => L.latLng(b.lat, b.lng))
        ];

        // 5. Build the Route - Check both the namespace and the control function
        if (LeafletAny.Routing && typeof LeafletAny.Routing.control === 'function') {
          routingControlRef.current = LeafletAny.Routing.control({
            waypoints,
            router: LeafletAny.Routing.osrmv1({ 
              serviceUrl: 'https://router.project-osrm.org/route/v1',
              profile: 'driving' // Explicitly set profile
            }),
            lineOptions: { 
              styles: [{ color: '#10b981', weight: 6, opacity: 0.8 }], // Emerald color
              extendToWaypoints: true,
              missingRouteTolerance: 0
            },
            showAlternatives: false,
            addWaypoints: false,
            fitSelectedRoutes: true, // Set to true to verify path is being drawn
            show: false,
            createMarker: () => null // Hide extra markers
          }).addTo(map);
          
          console.log("EcoRoute: Path calculated successfully.");
        }
      } catch (err) {
        console.error("Routing Error:", err);
      }
    };

    updateRoute();
    
    return () => { 
      if (routingControlRef.current && map) {
        map.removeControl(routingControlRef.current);
      }
    };
  }, [map, driverPos, bins, routeKey]);

  return null;
}

export default function DriverMap() {
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [routeKey, setRouteKey] = useState(0);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [nextBinInfo, setNextBinInfo] = useState({ distance: "---", name: "None", isClose: false });

  useEffect(() => {
    setIsClient(true);
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [watchId]);

  useEffect(() => {
    if (driverPos) {
      const activeBins = DUMMY_BINS.filter(b => b.fillLevel > 50);
      if (activeBins.length > 0) {
        const sortedWithDist = activeBins.map(b => ({
          ...b,
          dist: getDistance(driverPos, [b.lat, b.lng])
        })).sort((a, b) => a.dist - b.dist);

        const nearest = sortedWithDist[0];
        const distStr = nearest.dist > 1000 ? `${(nearest.dist / 1000).toFixed(1)} km` : `${Math.round(nearest.dist)} m`;
        
        setNextBinInfo({
          distance: distStr,
          name: nearest.name,
          isClose: nearest.dist < 30
        });
      } else {
        setNextBinInfo({ distance: "0m", name: "Done", isClose: false });
      }
    }
  }, [driverPos]);

  const startLiveTracking = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      const id = navigator.geolocation.watchPosition(
        (pos) => setDriverPos([pos.coords.latitude, pos.coords.longitude]),
        (err) => { console.error("GPS Error", err); setDriverPos(LUPON_CENTER); },
        { enableHighAccuracy: true, timeout: 15000 }
      );
      setWatchId(id);
    }
  };

  if (!isClient) return <div className="w-full h-screen bg-emerald-50 animate-pulse" />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { height: 100% !important; width: 100% !important; z-index: 1; background: #cbd5e1; }
        .eco-popup .leaflet-popup-content-wrapper { border-radius: 1.5rem; padding: 5px; border: 4px solid #10b981; }
      `}} />
      
      <div className="relative flex-1 w-full overflow-hidden">
        <div className="absolute inset-0 md:m-6 md:rounded-[3.5rem] overflow-hidden shadow-2xl border-white md:border-8 bg-slate-200">
          <MapContainer center={LUPON_CENTER} zoom={17} className="h-full w-full">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapRefresher center={driverPos} />
            
            {driverPos && (
              <Marker position={driverPos} icon={L.divIcon({ 
                html: '<div class="relative"><div class="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping"></div><div class="w-6 h-6 bg-blue-600 border-4 border-white rounded-full shadow-xl"></div></div>',
                className: "" 
              })}/>
            )}

            {DUMMY_BINS.map(bin => (
              <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={createBinIcon(bin.fillLevel)}>
                <Popup className="eco-popup">
                  <div className="p-1 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase">Lupon Node {bin.id}</p>
                    <p className="text-sm font-bold text-slate-800">{bin.name}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {driverPos && <RoutingLayer driverPos={driverPos} bins={DUMMY_BINS} routeKey={routeKey} />}
          </MapContainer>

          <div className="absolute top-6 left-6 z-[1000]">
            <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-full shadow-lg border border-white/50">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${driverPos ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                  {driverPos ? "📍 Navigation Active" : "📡 GPS Pending"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-[1001] bg-white px-8 pt-10 pb-12 rounded-t-[4rem] shadow-[0_-25px_50px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">EcoRoute</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Driver Cockpit</p>
            </div>
            
            <div className="flex gap-2 justify-end">
                <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 text-center flex-1 min-w-[100px]">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{nextBinInfo.name}</p>
                   <p className={`text-lg font-black leading-none ${nextBinInfo.isClose ? 'text-red-500 animate-bounce' : 'text-emerald-600'}`}>
                     {nextBinInfo.distance}
                   </p>
                </div>
                <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 text-center w-16">
                   <p className="text-[9px] font-black text-emerald-600 uppercase">Bins</p>
                   <p className="text-lg font-black text-emerald-700 leading-none">{DUMMY_BINS.filter(b => b.fillLevel > 50).length}</p>
                </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={startLiveTracking}
              className={`flex-1 py-6 rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl ${
                driverPos ? 'bg-slate-50 text-slate-300 border border-slate-200' : 'bg-blue-600 text-white shadow-blue-200'
              }`}
              disabled={!!driverPos}
            >
              {driverPos ? "📡 Active" : "📡 Start"}
            </button>
            <button 
              onClick={() => setRouteKey(k => k + 1)}
              className="flex-1 py-6 rounded-[2.2rem] bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-emerald-200 shadow-xl"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}