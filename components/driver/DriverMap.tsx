"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Essential CSS
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// --- LEAFLET ASSET FIX ---
// This prevents the map from crashing if Leaflet can't find its default markers
if (typeof window !== "undefined") {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

const LUPON_CENTER: [number, number] = [6.8906, 126.0241];

const DUMMY_BINS = [
  { id: 1, name: "Bin 4", lat: 6.890957117154686, lng: 126.02411507732198, fillLevel: 94 },
  { id: 2, name: "Bin 5", lat: 6.8895558819998355, lng: 126.025083502698, fillLevel: 88 },
  { id: 3, name: "Bin 2", lat: 6.890036067109011, lng: 126.0239322048933, fillLevel: 78 },
  { id: 4, name: "Bin 1", lat: 6.890680405047107, lng: 126.02350835313612, fillLevel: 15 },
  { id: 5, name: "Bin 11", lat: 6.890665867989403, lng: 126.02434438869368, fillLevel: 82 },
];

const createBinIcon = (fillLevel: number) => {
  let color = "#10b981"; 
  if (fillLevel > 90) color = "#ef4444"; 
  else if (fillLevel > 70) color = "#f97316"; 
  else if (fillLevel > 40) color = "#f59e0b"; 

  return L.divIcon({
    html: `
      <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="width: 30px; height: 30px; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.2));">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <div style="position: absolute; top: -2px; right: -2px; background: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 2px solid ${color}; font-size: 8px; font-weight: 900; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${fillLevel}%</div>
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

    const calculateRoute = async () => {
      // @ts-ignore
      await import("leaflet-routing-machine");

      const mandatory = bins.filter(b => b.fillLevel > 70);
      const opportunity = bins.filter(b => b.fillLevel > 50 && b.fillLevel <= 70);
      let targets = [...mandatory, ...opportunity];

      const sortedTargets = [];
      let currentLoc = { lat: driverPos[0], lng: driverPos[1] };
      let remaining = [...targets];

      while (remaining.length > 0) {
        remaining.sort((a, b) => {
          const distA = Math.hypot(a.lat - currentLoc.lat, a.lng - currentLoc.lng);
          const distB = Math.hypot(b.lat - currentLoc.lat, b.lng - currentLoc.lng);
          return distA - distB;
        });
        const closest = remaining.shift()!;
        sortedTargets.push(closest);
        currentLoc = { lat: closest.lat, lng: closest.lng };
      }

      const waypoints = [L.latLng(driverPos[0], driverPos[1]), ...sortedTargets.map(b => L.latLng(b.lat, b.lng))];
      
      if (routingControlRef.current) map.removeControl(routingControlRef.current);

      // @ts-ignore
      routingControlRef.current = L.Routing.control({
        waypoints,
        lineOptions: { styles: [{ color: '#10b981', weight: 6, opacity: 0.85 }], extendToWaypoints: true },
        createMarker: () => null,
        addWaypoints: false,
        fitSelectedRoutes: false,
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
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => { 
    setIsClient(true); 
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [watchId]);

  const startLiveTracking = () => {
    if ("geolocation" in navigator) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      const id = navigator.geolocation.watchPosition(
        (pos) => setDriverPos([pos.coords.latitude, pos.coords.longitude]),
        (err) => {
          console.error(err);
          setDriverPos(LUPON_CENTER);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
      setWatchId(id);
    }
  };

  if (!isClient) return <div className="w-full h-screen bg-emerald-50 animate-pulse" />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* GLOBAL LEAFLET HEIGHT FIX */}
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { height: 100% !important; width: 100% !important; z-index: 1; }
        .eco-popup .leaflet-popup-content-wrapper { border-radius: 1.5rem; padding: 5px; }
      `}} />
      
      <div className="relative flex-1 w-full overflow-hidden">
        {/* MAP WRAPPER */}
        <div className="absolute inset-0 md:m-6 md:rounded-[3.5rem] overflow-hidden shadow-2xl border-white md:border-8 bg-slate-200">
          <MapContainer center={LUPON_CENTER} zoom={17} scrollWheelZoom={true} className="h-full w-full">
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
                  <div className="p-1">
                    <p className="text-[10px] font-black text-emerald-600 uppercase">Lupon Node {bin.id}</p>
                    <p className="text-sm font-bold text-slate-800">{bin.name}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {driverPos && <RoutingLayer driverPos={driverPos} bins={DUMMY_BINS} routeKey={routeKey} />}
          </MapContainer>

          {/* OVERLAY: LIVE STATUS */}
          <div className="absolute top-6 left-6 right-6 z-[1000] pointer-events-none flex justify-between items-start">
            <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-full shadow-lg border border-white/50 pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${driverPos ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                  {driverPos ? "📍 Live Tracking" : "📡 Waiting for GPS"}
                </p>
              </div>
            </div>

            {driverPos && (
                <button 
                  onClick={() => setRouteKey(k => k + 1)}
                  className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-white/50 pointer-events-auto active:scale-90 transition-transform"
                >
                  🔄
                </button>
            )}
          </div>
        </div>
      </div>

      {/* CONTROL CENTER */}
      <div className="relative z-[1001] bg-white px-8 pt-10 pb-12 rounded-t-[4rem] shadow-[0_-25px_50px_rgba(0,0,0,0.1)] md:static md:rounded-none md:shadow-none">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">EcoRoute</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Poblacion Master Driver</p>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-black text-emerald-500 uppercase mb-1">Task Load</span>
              <div className="flex gap-1 justify-end">
                {DUMMY_BINS.filter(b => b.fillLevel > 70).map((_, i) => (
                  <div key={i} className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={driverPos ? () => setRouteKey(k => k + 1) : startLiveTracking}
            className={`w-full py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.25em] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-2xl ${
              driverPos 
              ? 'bg-emerald-600 text-white shadow-emerald-200' 
              : 'bg-blue-600 text-white shadow-blue-200'
            }`}
          >
            {driverPos ? <span>🔄 Refresh Logic</span> : <span>📡 Start Live Session</span>}
          </button>
        </div>
      </div>
    </div>
  );
}