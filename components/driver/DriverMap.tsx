"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

import RoutingLayer from "./RoutingLayer";
import BinMarker from "./BinMarker";
import { LUPON_CENTER, getDistance } from "./MapAssets";

import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const INITIAL_BINS = [
  { id: 1, name: "Bin 4", lat: 6.89095, lng: 126.02411, fillLevel: 94 },
  { id: 2, name: "Bin 5", lat: 6.88955, lng: 126.02508, fillLevel: 88 },
  { id: 3, name: "Bin 2", lat: 6.89003, lng: 126.02393, fillLevel: 78 },
  { id: 4, name: "Bin 1", lat: 6.89068, lng: 126.0235, fillLevel: 15 },
  { id: 5, name: "Bin 11", lat: 6.89066, lng: 126.02434, fillLevel: 82 },
];

function MapRefresher({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.panTo(center, { animate: true });
  }, [center, map]);
  return null;
}

export default function DriverMap() {
  const [bins, setBins] = useState(INITIAL_BINS);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [routeKey, setRouteKey] = useState(0);
  const [eta, setEta] = useState({ dist: "0 km", time: "0 min" });
  const [nextBinInfo, setNextBinInfo] = useState({ distance: "---", name: "None" });

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined") {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    }
  }, []);

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
          distance: nearest.dist > 1000 ? `${(nearest.dist / 1000).toFixed(1)} km` : `${Math.round(nearest.dist)} m`,
        });
      }
    }
  }, [driverPos, bins]);

  const handleRouteUpdate = (summary: { distance: number; time: number }) => {
    setEta({
      dist: summary.distance > 0 ? `${(summary.distance / 1000).toFixed(1)} km` : "Direct Path",
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

  if (!isClient) return <div className="w-full h-screen bg-emerald-50 animate-pulse" />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { height: 100% !important; width: 100% !important; z-index: 1; }
        .leaflet-routing-container { display: none !important; }
        
        /* Emerald road-snapped line */
        path.leaflet-interactive {
          stroke: #10b981 !important;
          stroke-width: 8px !important;
          stroke-linecap: round !important;
          stroke-linejoin: round !important;
          filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.4));
        }
        .leaflet-bottom.leaflet-left { bottom: 130px !important; }
      `}} />

      <div className="relative flex-1 w-full">
        <div className="absolute inset-0 md:m-6 md:rounded-[3.5rem] overflow-hidden shadow-2xl border-white md:border-8">
          <MapContainer center={LUPON_CENTER} zoom={17} className="h-full w-full">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapRefresher center={driverPos} />

            {driverPos && (
              <Marker position={driverPos} icon={L.divIcon({
                  html: '<div class="w-6 h-6 bg-blue-600 border-4 border-white rounded-full shadow-xl"></div>',
                  className: "",
              })} />
            )}

            {bins.map((bin) => (
              <BinMarker key={bin.id} bin={bin} onCollect={(id) => {
                  setBins((prev) => prev.map((b) => (b.id === id ? { ...b, fillLevel: 0 } : b)));
                  setRouteKey((k) => k + 1);
              }} />
            ))}

            {driverPos && (
              <RoutingLayer driverPos={driverPos} bins={bins} routeKey={routeKey} onRouteUpdate={handleRouteUpdate} />
            )}
          </MapContainer>
        </div>
      </div>

      {/* DASHBOARD */}
      <div className="relative z-[1001] bg-white px-8 pt-10 pb-12 rounded-t-[4rem] shadow-2xl">
        <div className="max-w-md mx-auto space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase">Target</p>
              <p className="text-sm font-black text-slate-800 truncate">{nextBinInfo.name}</p>
              <p className="text-xs font-bold text-emerald-600">{nextBinInfo.distance}</p>
            </div>
            <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-lg text-center">
              <p className="text-[9px] font-black opacity-60 uppercase">Route</p>
              <p className="text-xl font-black leading-none">{eta.time}</p>
              <p className="text-[10px] font-bold mt-1">{eta.dist}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase">Alerts</p>
              <p className="text-xl font-black text-slate-800">{bins.filter(b => b.fillLevel > 75).length}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={startLiveTracking} className={`flex-1 py-6 rounded-[2.2rem] font-black text-xs uppercase ${driverPos ? "bg-slate-100 text-slate-400" : "bg-blue-600 text-white shadow-xl"}`}>
              {driverPos ? "📡 Active" : "🚀 Start"}
            </button>
            <button onClick={() => setRouteKey(k => k + 1)} className="flex-1 py-6 rounded-[2.2rem] bg-emerald-600 text-white font-black text-xs uppercase shadow-xl">
              🔄 Re-Route
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}