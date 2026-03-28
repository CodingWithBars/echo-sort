"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import DriverMapDisplay from "./DriverMapDisplayGL";
import DriverSidebar from "./DriverSidebar";
import NavigationControls from "../ui/NavigationControls";
import type { StyleSpecification } from "maplibre-gl";

const supabase = createClient();

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// ─────────────────────────────────────────────────────────────────────────────
// MAP STYLE
//
// We deliberately do NOT fetch the Mapbox style JSON.
// Why: Mapbox style JSON contains proprietary top-level and source-level fields
// ("name", "metadata", "created", "owner", etc.) that MapLibre's strict
// validator rejects with "unknown property" — even after stripping the obvious
// top-level keys, the same fields appear nested inside `sources` objects.
//
// Solution: build a minimal MapLibre-valid StyleSpecification ourselves that
// pulls Mapbox's satellite-streets visual as pre-rendered raster tiles.
// Mapbox renders the full satellite + streets + labels server-side and
// delivers 512px tiles — we get the same visual with zero JSON parsing.
// ─────────────────────────────────────────────────────────────────────────────
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "mapbox-sat-streets": {
      type: "raster",
      tiles: [
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
      ],
      tileSize: 512,
      attribution:
        '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0f172a" },
    },
    {
      id: "satellite-streets",
      type: "raster",
      source: "mapbox-sat-streets",
    },
  ],
};

interface BinRow {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fill_level: number;
  battery_level: number;
}

interface CollectionLog {
  id: number;
  name: string;
  time: string;
}

export default function DriverMap() {
  // --- Data State ---
  const [bins, setBins]                   = useState<any[]>([]);
  const [history, setHistory]             = useState<CollectionLog[]>([]);
  const [driverPos, setDriverPos]         = useState<[number, number] | null>(null);
  const [heading, setHeading]             = useState(0);
  const [routeKey, setRouteKey]           = useState(0);
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [isTracking, setIsTracking]       = useState(false);
  const [geoWatchId, setGeoWatchId]       = useState<number | null>(null);
  const [eta, setEta]                     = useState({ dist: "0 km", time: "0 min" });

  // --- Settings State ---
  const [routingMode, setRoutingMode] = useState<"fastest" | "priority">("fastest");
  const [maxDetour, setMaxDetour]     = useState(300);
  const [useFence, setUseFence]       = useState(true);

  // --- UI Visibility ---
  const [isSidebarOpen, setIsSidebarOpen]           = useState(true);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);

  const fetchBins = useCallback(async () => {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) return console.error("Supabase Error:", error.message);
    if (data) {
      setBins(
        (data as BinRow[]).map((b) => ({
          id: b.id, name: b.name, lat: b.lat, lng: b.lng,
          fillLevel: b.fill_level, batteryLevel: b.battery_level,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchBins();
    const channel = supabase
      .channel("realtime-bins")
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, fetchBins)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBins]);

  const toggleTracking = () => {
    if (isTracking) {
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
      setIsTracking(false); setDriverPos(null); setGeoWatchId(null);
    } else {
      setIsTracking(true);
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setDriverPos([pos.coords.latitude, pos.coords.longitude]);
          if (pos.coords.heading !== null) setHeading(pos.coords.heading);
        },
        (err) => console.error("Geolocation error:", err),
        { enableHighAccuracy: true }
      );
      setGeoWatchId(id);
    }
  };

  const addToHistory = useCallback(
    (entry: CollectionLog) => setHistory((prev) => [entry, ...prev]),
    []
  );
  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 overflow-hidden relative">
      <NavigationControls
        isNavMode={isTracking}
        setIsNavMode={toggleTracking}
        heading={heading}
      />

      <DriverMapDisplay
        bins={bins}
        driverPos={driverPos}
        heading={heading}
        selectedBinId={selectedBinId}
        setSelectedBinId={setSelectedBinId}
        routeKey={routeKey}
        mode={routingMode}
        maxDetour={maxDetour}
        useFence={useFence}
        mapStyle={MAP_STYLE}
        onRouteUpdate={setEta}
        isTracking={isTracking}
      />

      <DriverSidebar
        bins={bins}
        eta={eta}
        history={history}
        isTracking={isTracking}
        onClearHistory={clearHistory}
        onStartTracking={toggleTracking}
        onStopTracking={toggleTracking}
        onRefresh={() => setRouteKey((k) => k + 1)}
        routingMode={routingMode}
        setRoutingMode={setRoutingMode}
        maxDetour={maxDetour}
        setMaxDetour={setMaxDetour}
        useFence={useFence}
        setUseFence={setUseFence}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isDashboardVisible={isDashboardVisible}
        setIsDashboardVisible={setIsDashboardVisible}
        onAddToHistory={addToHistory}
      />
    </div>
  );
}