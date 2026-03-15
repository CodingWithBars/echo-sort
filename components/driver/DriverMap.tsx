"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import DriverMapDisplay from "./DriverMapDisplay";
import DriverSidebar from "./DriverSidebar";
import NavigationControls from "../ui/NavigationControls";
import "leaflet/dist/leaflet.css";

const supabase = createClient();

interface BinRow {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fill_level: number;
  battery_level: number;
}

// FIX #3: Typed history entry so it can be populated properly
interface CollectionLog {
  id: number;
  name: string;
  time: string;
}

export default function DriverMap() {
  // --- Data State ---
  const [bins, setBins] = useState<any[]>([]);

  // FIX #3: history is now populated via addToHistory, not just cleared
  const [history, setHistory] = useState<CollectionLog[]>([]);

  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0);
  const [routeKey, setRouteKey] = useState(0);
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [eta, setEta] = useState({ dist: "0 km", time: "0 min" });

  // --- Settings State ---
  const [routingMode, setRoutingMode] = useState<"fastest" | "priority">("fastest");
  const [maxDetour, setMaxDetour] = useState(300);
  const [useFence, setUseFence] = useState(true);
  const [mapStyle, setMapStyle] = useState("satellite-streets-v12" as any);

  // --- UI Visibility States ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);

  const fetchBins = useCallback(async () => {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) return console.error("Supabase Error:", error.message);

    if (data) {
      const rows = data as BinRow[];
      setBins(
        rows.map((b) => ({
          id: b.id,
          name: b.name,
          lat: b.lat,
          lng: b.lng,
          fillLevel: b.fill_level,
          batteryLevel: b.battery_level,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchBins();
    const channel = supabase
      .channel("realtime-bins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bins" },
        fetchBins
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBins]);

  const toggleTracking = () => {
    if (isTracking) {
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
      setIsTracking(false);
      setDriverPos(null);
      setGeoWatchId(null);
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

  // FIX #3: Exposed so child components (e.g. DriverCollectionNode) can log entries
  const addToHistory = useCallback((entry: CollectionLog) => {
    setHistory((prev) => [entry, ...prev]);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 overflow-hidden relative">
      <NavigationControls
        isNavMode={isTracking}
        setIsNavMode={toggleTracking}
        heading={heading}
      />

      {/* FIX #1: isTracking is now correctly passed to DriverMapDisplay */}
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
        mapStyle={mapStyle}
        onRouteUpdate={setEta}
        isTracking={isTracking}
      />

      {/* FIX #2: onClearHistory is now passed so DriverSidebar can forward it */}
      <DriverSidebar
        // 1. Data Props
        bins={bins}
        eta={eta}
        history={history}
        isTracking={isTracking}
        onClearHistory={clearHistory}

        // 2. Action Props
        onStartTracking={toggleTracking}
        onStopTracking={toggleTracking}
        onRefresh={() => setRouteKey((k) => k + 1)}

        // 3. Settings Props
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        routingMode={routingMode}
        setRoutingMode={setRoutingMode}
        maxDetour={maxDetour}
        setMaxDetour={setMaxDetour}
        useFence={useFence}
        setUseFence={setUseFence}

        // 4. UI Visibility Props
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isDashboardVisible={isDashboardVisible}
        setIsDashboardVisible={setIsDashboardVisible}

        // FIX #3: expose addToHistory for collection logging
        onAddToHistory={addToHistory}
      />
    </div>
  );
}