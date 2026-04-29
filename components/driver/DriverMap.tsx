"use client";

// components/driver/DriverMap.tsx
// Wrapper that owns GPS tracking + bin data fetching.
// When `activeBins` is provided by a running travel order (via DriverDashboard),
// those bins override the live DB bins for routing so RoutingLayerGL targets
// the specific scheduled collection stops.
//
// BYPASS ROUTE: BypassRoutePanel is triggered by a callback that flows through
// DriverSidebar → EcoDashboard footer button (desktop) and the mobile drag-handle
// FAB. DriverMapDisplay no longer owns the bypass trigger.

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import DriverMapDisplay from "./DriverMapDisplayGL";
import DriverSidebar from "./DriverSidebar";
import BypassRoutePanel from "./Bypassroutepanel";
import type { StyleSpecification } from "maplibre-gl";

const supabase = createClient();
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "mapbox-sat-streets": {
      type: "raster",
      tiles: [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`],
      tileSize: 512,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "background",        type: "background", paint: { "background-color": "#0f172a" } },
    { id: "satellite-streets", type: "raster",     source: "mapbox-sat-streets" },
  ],
};

interface BinRow { id:number; name:string; lat:number; lng:number; fill_level:number; battery_level:number; }
interface CollectionLog { id:number; name:string; time:string; }

export interface RoutingBin {
  id: number | string;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
  batteryLevel: number;
  device_id?: string;
  collected?: boolean;
}

interface DriverMapProps {
  activeBins?:       RoutingBin[];
  hasActiveRoute?:   boolean;
  activeScheduleId?: string;
  vehicleType?:      string;
}

export default function DriverMap({
  activeBins = [],
  hasActiveRoute = false,
  activeScheduleId,
  vehicleType = "truck",
}: DriverMapProps) {
  const [dbBins,        setDbBins]        = useState<RoutingBin[]>([]);
  const [history,       setHistory]       = useState<CollectionLog[]>([]);
  const [driverPos,     setDriverPos]     = useState<[number, number] | null>(null);
  const [heading,       setHeading]       = useState(0);
  const [routeKey,      setRouteKey]      = useState(0);
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [isTracking,    setIsTracking]    = useState(false);
  const [geoWatchId,    setGeoWatchId]    = useState<number | null>(null);
  const [eta,           setEta]           = useState({ dist: "0 km", time: "0 min" });
  const [routingMode,   setRoutingMode]   = useState<"fastest" | "priority">("fastest");
  const [maxDetour,     setMaxDetour]     = useState(300);
  const [useFence,      setUseFence]      = useState(true);
  const [isSidebarOpen,      setIsSidebarOpen]      = useState(true);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);

  // ── Bypass route state ────────────────────────────────────────────────────
  const [userId,              setUserId]              = useState<string>("");
  const [bypassPanelOpen,     setBypassPanelOpen]     = useState(false);
  const [activeBypassRouteId, setActiveBypassRouteId] = useState<string | null>(null);
  const [algorithmUturnCount, setAlgorithmUturnCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ── Bin fetching ──────────────────────────────────────────────────────────

  const fetchBins = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let muni: string | null = null;
    if (user) {
      const { data: sched } = await supabase
        .from("schedule_assignments")
        .select("collection_schedules!inner(municipality)")
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .limit(1);
      muni = (sched as any)?.[0]?.collection_schedules?.municipality ?? null;
    }
    const q = supabase.from("bins").select("id,name,lat,lng,fill_level,battery_level,municipality,barangay");
    const { data } = muni ? await q.eq("municipality", muni) : await q;
    if (data) setDbBins((data as BinRow[]).map(b => ({
      id: b.id, name: b.name, lat: b.lat, lng: b.lng,
      fillLevel: b.fill_level, batteryLevel: b.battery_level,
    })));
  }, []);

  useEffect(() => {
    fetchBins();
    const ch = supabase.channel("realtime-bins")
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, fetchBins)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchBins]);

  // ── Route key trigger (new travel order) ─────────────────────────────────

  const prevActiveLenRef = useRef(0);
  useEffect(() => {
    const prev = prevActiveLenRef.current;
    prevActiveLenRef.current = activeBins.length;
    if (prev === 0 && activeBins.length > 0) {
      setRouteKey(k => k + 1);
      if (!isTracking) setIsTracking(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBins.length]);

  const routingBins = hasActiveRoute && activeBins.length > 0
    ? activeBins.filter(b => !b.collected)
    : dbBins;

  // ── GPS tracking ──────────────────────────────────────────────────────────

  const toggleTracking = () => {
    if (isTracking) {
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
      setIsTracking(false); setDriverPos(null); setGeoWatchId(null);
    } else {
      setIsTracking(true);
      const id = navigator.geolocation.watchPosition(
        pos => {
          setDriverPos([pos.coords.latitude, pos.coords.longitude]);
          if (pos.coords.heading !== null) setHeading(pos.coords.heading);
        },
        err => console.error("Geolocation error:", err),
        { enableHighAccuracy: true }
      );
      setGeoWatchId(id);
    }
  };

  const addToHistory = useCallback((e: CollectionLog) => setHistory(p => [e, ...p]), []);
  const clearHistory = useCallback(() => setHistory([]), []);

  // ── Route update — capture ETA + uturn count ──────────────────────────────

  const handleRouteUpdate = useCallback((stats: { dist: string; time: string; uturnCount?: number }) => {
    setEta({ dist: stats.dist, time: stats.time });
    if (stats.uturnCount !== undefined) setAlgorithmUturnCount(stats.uturnCount);
  }, []);

  // ── Bypass route callbacks ────────────────────────────────────────────────

  /**
   * Called by EcoDashboard footer button (desktop) and mobile drag-handle FAB.
   * Opens the BypassRoutePanel overlay.
   */
  const handleBypassRecord = useCallback(() => {
    setBypassPanelOpen(true);
  }, []);

  const handleBypassModeToggle = useCallback((enabled: boolean) => {
    setBypassPanelOpen(enabled);
    if (!enabled) setActiveBypassRouteId(null);
  }, []);

  const handleBypassRouteRecorded = useCallback((routeId: string) => {
    setActiveBypassRouteId(routeId);
    setBypassPanelOpen(false);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 overflow-hidden relative">

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <DriverMapDisplay
        bins={routingBins}
        allBins={dbBins}
        driverPos={driverPos}
        heading={heading}
        selectedBinId={selectedBinId}
        setSelectedBinId={setSelectedBinId}
        routeKey={routeKey}
        mode={routingMode}
        maxDetour={hasActiveRoute ? 99999 : maxDetour}
        useFence={hasActiveRoute ? false : useFence}
        mapStyle={MAP_STYLE}
        onRouteUpdate={handleRouteUpdate}
        isTracking={isTracking}
      />

      {/* ── Bypass Route Panel overlay ────────────────────────────────────── 
          Rendered only when the driver opens it via the button.
          isActive drives the recording/comparison UI inside the panel.
      ──────────────────────────────────────────────────────────────────── */}
      {userId && bypassPanelOpen && (
        <BypassRoutePanel
          isActive={isTracking}
          driverPos={driverPos}
          heading={heading}
          currentBin={
            routingBins.length > 0
              ? routingBins[0]
              : { id: 0, name: "Start", lat: driverPos?.[0] ?? 0, lng: driverPos?.[1] ?? 0, fillLevel: 0, batteryLevel: 100 }
          }
          nextBins={routingBins.slice(1)}
          algorithmRoute={{
            distance:   eta.dist,
            time:       eta.time,
            uturnCount: algorithmUturnCount,
          }}
          onBypassModeToggle={handleBypassModeToggle}
          onBypassRouteRecorded={handleBypassRouteRecorded}
          vehicleType={vehicleType}
          scheduleId={activeScheduleId}
          driverId={userId}
        />
      )}

      {/* ── Sidebar / bottom sheet ────────────────────────────────────────── */}
      <DriverSidebar
        bins={dbBins}
        eta={eta}
        history={history}
        isTracking={isTracking}
        onClearHistory={clearHistory}
        onStartTracking={toggleTracking}
        onStopTracking={toggleTracking}
        onRefresh={() => setRouteKey(k => k + 1)}
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
        onBypassRecord={isTracking ? handleBypassRecord : undefined}
      />
    </div>
  );
}