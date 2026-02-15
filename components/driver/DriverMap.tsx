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
  { id: 5, name: "Bin 19", lat: 6.891392748599929, lng: 126.00532732142247, fillLevel: 63 },
  { id: 5, name: "Bin 20", lat: 6.890182185108943, lng: 126.00630546152834, fillLevel: 46 },
];

export default function DriverMap() {
  const [bins, setBins] = useState<Bin[]>(INITIAL_BINS);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isNavMode, setIsNavMode] = useState(false);
  const [routingMode, setRoutingMode] = useState<"fastest" | "priority">(
    "fastest",
  );
  const [routeKey, setRouteKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // New states for manual selection
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [topCandidates, setTopCandidates] = useState<number[]>([]);

  const [eta, setEta] = useState({ dist: "0 km", time: "0 min" });
  const [nextBinInfo, setNextBinInfo] = useState({
    distance: "---",
    name: "---",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate Top 2 Nearest Bins for the Driver to choose from
  useEffect(() => {
    if (!driverPos) return;

    const active = bins.filter(
      (b) => b.fillLevel > 50 || getDistance(driverPos, [b.lat, b.lng]) < 100,
    );

    if (active.length > 0) {
      const sorted = active
        .map((b) => ({ ...b, d: getDistance(driverPos, [b.lat, b.lng]) }))
        .sort((a, b) => a.d - b.d);

      // Store IDs of the two closest bins
      setTopCandidates(sorted.slice(0, 2).map((b) => b.id));

      // Use selectedBin if driver clicked one, otherwise use the closest
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
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .leaflet-container { 
          height: 100% !important; width: 100% !important;
          background: #f1f5f9 !important;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          ${isNavMode ? `transform: rotate(${-heading}deg);` : ""} 
        }
        .leaflet-marker-icon { transition: transform 0.8s; ${isNavMode ? `transform: rotate(${heading}deg) !important;` : ""} }
        .leaflet-routing-container { display: none !important; }
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

      <div className="flex-1 w-full relative h-full">
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

          {driverPos && (
            <Marker
              position={driverPos}
              icon={L.divIcon({
                html: `<div style="transform: rotate(${heading}deg)" class="transition-transform duration-500">
                      <div class="w-10 h-10 bg-blue-600 border-4 border-white rounded-full shadow-2xl flex items-center justify-center">
                        <div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-white mb-1"></div>
                      </div>
                    </div>`,
                className: "",
              })}
            />
          )}

          {bins.map((bin) => (
            <BinMarker
              key={bin.id}
              bin={bin}
              isEditMode={isEditMode}
              // Highlight if it's one of the top 2
              isCandidate={topCandidates.includes(bin.id)}
              isSelected={selectedBinId === bin.id}
              onSelect={() => setSelectedBinId(bin.id)}
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

          {driverPos && (
            <RoutingLayer
              driverPos={driverPos}
              bins={bins}
              selectedBinId={selectedBinId}
              routeKey={routeKey}
              onRouteUpdate={handleRouteUpdate}
              mode={routingMode}
            />
          )}
        </MapContainer>
      </div>

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
  );
}
