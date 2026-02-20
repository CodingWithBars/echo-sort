"use client";

import React, { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import RoutingLayer from "./RoutingLayer";
import BinMarker from "./BinMarker";
import NavigationControls from "../ui/NavigationControls";
import EcoDashboard from "../ui/EcoDashboard";
import { LUPON_CENTER, getDistance } from "../map/MapAssets";
import "leaflet/dist/leaflet.css";

interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

interface CollectionLog {
  id: number;
  name: string;
  time: string;
}

const INITIAL_BINS: Bin[] = [
  { id: 1, name: "Bin 4", lat: 6.89095, lng: 126.02411, fillLevel: 94 },
  { id: 2, name: "Bin 5", lat: 6.88955, lng: 126.02508, fillLevel: 88 },
  { id: 3, name: "Bin 2", lat: 6.89003, lng: 126.02393, fillLevel: 78 },
  { id: 4, name: "Bin 1", lat: 6.89068, lng: 126.0235, fillLevel: 15 },
  { id: 5, name: "Bin 11", lat: 6.89066, lng: 126.02434, fillLevel: 82 },
  { id: 6, name: "Bin 19", lat: 6.89139, lng: 126.00532, fillLevel: 63 },
  { id: 7, name: "Bin 20", lat: 6.89018, lng: 126.0063, fillLevel: 46 },
];

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

export default function DriverMap() {
  const [bins, setBins] = useState<Bin[]>(INITIAL_BINS);
  const [history, setHistory] = useState<CollectionLog[]>([]);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isNavMode, setIsNavMode] = useState(false);
  const [routingMode, setRoutingMode] = useState<"fastest" | "priority">(
    "fastest",
  );
  const [maxDetour, setMaxDetour] = useState(300);
  const [routeKey, setRouteKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [topCandidates, setTopCandidates] = useState<number[]>([]);
  const [eta, setEta] = useState({ dist: "0 km", time: "0 min" });
  const [nextBinInfo, setNextBinInfo] = useState({
    distance: "---",
    name: "---",
  });
  const [useFence, setUseFence] = useState(true);
  const [mapStyle, setMapStyle] = useState<
    "navigation-night-v1" | "satellite-streets-v12" | "outdoors-v12"
  >("satellite-streets-v12");
  const [isTracking, setIsTracking] = useState(false);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- FEATURE: Spawn new bins ---
  const handleMapDoubleClick = (latlng: L.LatLng) => {
    const newBin: Bin = {
      id: Date.now(),
      name: `New Station ${bins.length + 1}`,
      lat: latlng.lat,
      lng: latlng.lng,
      fillLevel: Math.floor(Math.random() * 60) + 40,
    };
    setBins((prev) => [...prev, newBin]);
  };

  // --- FEATURE: Proximity Auto-Collection ---
  useEffect(() => {
    if (!driverPos) return;
    setBins((prevBins) => {
      let collectedAny = false;
      const updatedBins = prevBins.map((bin) => {
        if (bin.fillLevel > 0) {
          const dist = getDistance(driverPos, [bin.lat, bin.lng]);
          if (dist < 30) {
            collectedAny = true;
            setHistory((prevH) =>
              [
                {
                  id: bin.id,
                  name: bin.name,
                  time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
                ...prevH,
              ].slice(0, 10),
            );

            if (window.navigator.vibrate)
              window.navigator.vibrate([100, 50, 100]);
            return { ...bin, fillLevel: 0 };
          }
        }
        return bin;
      });
      return collectedAny ? updatedBins : prevBins;
    });
  }, [driverPos]);

  useEffect(() => {
    if (!driverPos) return;
    const active = bins.filter(
      (b) => b.fillLevel >= 40 || b.id === selectedBinId,
    );
    if (active.length > 0) {
      const sorted = active
        .map((b) => ({ ...b, d: getDistance(driverPos, [b.lat, b.lng]) }))
        .sort((a, b) => a.d - b.d);
      setTopCandidates(sorted.slice(0, 3).map((b) => b.id));
      const nextOne = selectedBinId
        ? sorted.find((b) => b.id === selectedBinId) || sorted[0]
        : sorted[0];
      setNextBinInfo({
        name: nextOne.name,
        distance:
          nextOne.d > 1000
            ? `${(nextOne.d / 1000).toFixed(1)}km`
            : `${Math.round(nextOne.d)}m`,
      });
    }
  }, [driverPos, bins, selectedBinId]);

  const handleRouteUpdate = useCallback(
    (summary: { distance: number; time: number }) => {
      setEta({
        dist:
          summary.distance > 0
            ? `${(summary.distance / 1000).toFixed(1)} km`
            : "0 km",
        time:
          summary.time > 0 ? `${Math.round(summary.time / 60)} min` : "0 min",
      });
    },
    [],
  );

  const startLiveTracking = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setIsTracking(true);
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setDriverPos([pos.coords.latitude, pos.coords.longitude]);
          if (pos.coords.heading !== null) setHeading(pos.coords.heading);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true },
      );
      setGeoWatchId(id);
    }
  };

  const stopLiveTracking = () => {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
    setIsTracking(false);
    setDriverPos(null); // Optional: Clear driver marker when stopping
  };

  const handleRefresh = async () => {
    setRouteKey((prev) => prev + 1);
    // Add any logic to refetch bin data from your backend here
    return new Promise((resolve) => setTimeout(resolve, 800)); // Sync with dashboard animation
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 overflow-hidden relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .leaflet-container { height: 100% !important; width: 100% !important; background: #0f172a !important; }
        .leaflet-marker-icon { transition: transform 0.8s; ${isNavMode ? `transform: rotate(${heading}deg) !important;` : ""} }
      `,
        }}
      />

      <NavigationControls
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        isNavMode={isNavMode}
        setIsNavMode={setIsNavMode}
        heading={heading}
      />

      <div className="absolute inset-0 md:relative md:flex-1 h-full overflow-hidden order-1">
        <MapContainer
          center={LUPON_CENTER}
          zoom={18}
          maxZoom={22}
          zoomControl={false}
          doubleClickZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            key={mapStyle} // Key forces a re-render when style changes
            url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
            maxZoom={22}
            maxNativeZoom={mapStyle === "satellite-streets-v12" ? 18 : 20}
          />
          <MapClickHandler onMapDoubleClick={handleMapDoubleClick} />

          {driverPos && (
            <Marker
              position={driverPos}
              icon={L.divIcon({
                html: `<div style="transform: rotate(${heading}deg)" class="transition-transform duration-500"><div class="w-10 h-10 bg-blue-600 border-4 border-white rounded-full shadow-2xl flex items-center justify-center"><div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-white mb-1"></div></div></div>`,
                className: "",
              })}
            />
          )}

          {bins.map((bin) => (
            <BinMarker
              key={bin.id}
              bin={bin}
              isEditMode={isEditMode}
              isCandidate={topCandidates.includes(bin.id)}
              isSelected={selectedBinId === bin.id}
              onClick={() => setSelectedBinId(bin.id)}
              onCollect={(id) => {
                setBins((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, fillLevel: 0 } : b)),
                );
                if (selectedBinId === id) setSelectedBinId(null);
              }}
              onMove={(id, lat, lng) =>
                setBins((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, lat, lng } : b)),
                )
              }
            />
          ))}

          <RoutingLayer
            driverPos={driverPos}
            bins={bins}
            selectedBinId={selectedBinId}
            routeKey={routeKey}
            onRouteUpdate={handleRouteUpdate}
            mode={routingMode}
            maxDetour={maxDetour}
            useFence={useFence}
          />
        </MapContainer>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute top-1/2 right-4 z-[1002] -translate-y-1/2 w-8 h-12 bg-white border border-slate-200 shadow-xl rounded-xl items-center justify-center transition-all hover:bg-slate-50 active:scale-95"
        >
          <span
            className={`transition-transform duration-300 ${isSidebarOpen ? "" : "rotate-180"}`}
          >
            ❯
          </span>
        </button>
      </div>

      {/* DASHBOARD / SIDEBAR WRAPPER (Restored Logic) */}
      <div
        className={`fixed md:relative bottom-0 left-0 right-0 z-[1001] 
        transition-all duration-700 cubic-bezier(0.32, 0.72, 0, 1)
        ${isDashboardVisible ? "h-[85vh]" : "h-[80px]"} 
        ${isSidebarOpen ? "md:w-[400px]" : "md:w-0"} 
        md:h-full pointer-events-none md:pointer-events-auto order-2`}
      >
        <div
          className="pointer-events-auto h-full bg-white/95 backdrop-blur-xl
          rounded-t-[2.5rem] md:rounded-none 
          shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.15)] md:shadow-[-10px_0_30px_rgba(0,0,0,0.05)] 
          border-t border-slate-200/50 flex flex-col overflow-hidden"
        >
          {/* Mobile Drag Handle */}
          <div
            className="w-full flex flex-col items-center pt-3 pb-2 cursor-pointer md:hidden"
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
          >
            <div
              className={`w-12 h-1.5 rounded-full transition-all duration-500 ${isDashboardVisible ? "bg-slate-300" : "bg-emerald-500 w-16 animate-pulse"}`}
            />
            {!isDashboardVisible && (
              <div className="mt-2 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {nextBinInfo.name} • {nextBinInfo.distance}
                </span>
              </div>
            )}
          </div>

          {/* Dashboard Content */}
          <div
            className={`flex-1 transition-opacity duration-300 
            ${isDashboardVisible ? "opacity-100" : "opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto"} 
            ${!isSidebarOpen && "md:opacity-0"}`}
          >
            <EcoDashboard
              routingMode={routingMode}
              setRoutingMode={setRoutingMode}
              maxDetour={maxDetour}
              setMaxDetour={setMaxDetour}
              useFence={useFence}
              setUseFence={setUseFence}
              nextBin={nextBinInfo}
              eta={eta}
              targetCount={bins.filter((b) => b.fillLevel >= 40).length}
              driverPos={driverPos}
              // NEW PROPS
              isTracking={isTracking}
              onStartTracking={startLiveTracking}
              onStopTracking={stopLiveTracking}
              onRefresh={handleRefresh}
              // LOGS & STYLES
              history={history}
              onClearHistory={() => setHistory([])}
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
