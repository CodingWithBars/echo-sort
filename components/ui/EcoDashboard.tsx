"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { BinLabelToggleButton } from "../driver/BinMarker"; // ← ADD

const supabase = createClient();

// --- Types ---
interface CollectionLog {
  id: number;
  name: string;
  time: string;
}

interface DriverDetails {
  id: string;
  duty_status: string;
  [key: string]: any;
}

interface DashboardProps {
  bins: any[];
  history: CollectionLog[];
  eta: { dist: string; time: string };
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onRefresh: () => void;
  onClearHistory?: () => void;
  routingMode: "fastest" | "priority";
  setRoutingMode: (m: "fastest" | "priority") => void;
  maxDetour: number;
  setMaxDetour: (v: number) => void;
  useFence: boolean;
  setUseFence: (v: boolean) => void;
  mapStyle: "satellite-streets-v12" | "navigation-night-v1" | "outdoors-v12";
  setMapStyle: (s: "satellite-streets-v12" | "navigation-night-v1" | "outdoors-v12") => void;
}

export default function EcoDashboard(props: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { bins, eta, history, isTracking, onRefresh, routingMode, mapStyle } = props;

  // --- 1. Realtime Sync Logic ---
  useEffect(() => {
    const syncStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('dashboard-status-sync')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'driver_details',
            filter: `id=eq.${user.id}`
          },
          (payload: RealtimePostgresUpdatePayload<DriverDetails>) => {
            const isNowOnDuty = payload.new.duty_status === "ON-DUTY";
            if (isNowOnDuty && !isTracking) props.onStartTracking();
            if (!isNowOnDuty && isTracking) props.onStopTracking();
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    syncStatus();
  }, [isTracking, props]);

  // --- 2. Database Toggle Logic ---
  const handleToggleTracking = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSyncing(true);
    const nextStatus = isTracking ? "OFF-DUTY" : "ON-DUTY";

    const { error } = await supabase
      .from("driver_details")
      .update({ duty_status: nextStatus })
      .eq("id", user.id);

    if (!error) {
      if (nextStatus === "ON-DUTY") props.onStartTracking();
      else props.onStopTracking();
    } else {
      console.error("Failed to update status:", error.message);
    }
    setIsSyncing(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const activeStops = bins.filter(b => b.fillLevel >= 40).length;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar">

        {/* Top Controls */}
        <ModeSelector
          mode={routingMode}
          setMode={props.setRoutingMode}
          useFence={props.useFence}
          setUseFence={props.setUseFence}
        />

        {/* Big Route Card */}
        <RouteSummary eta={eta} mode={routingMode} />

        {/* Detour Config */}
        <DetourSlider value={props.maxDetour} onChange={props.setMaxDetour} />

        {/* Status Cards */}
        <div className="space-y-3 mb-6">
          <StatCard
            label="Active Stops"
            value={activeStops.toString()}
            sub="Bins > 40%"
            color="text-emerald-600"
            icon="🗑️"
          />
        </div>

        {/* Log Section */}
        <CollectionHistory history={history} onClear={props.onClearHistory} />

        {/* Visual Settings */}
        <StylePicker current={mapStyle} setStyle={props.setMapStyle} />
      </div>

      {/* Persistent Action Footer */}
      <div className="p-5 border-t border-slate-100 bg-white/90 backdrop-blur-md pb-8">
        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">

          {/* ── Tracking + Recalculate (unchanged) ── */}
          <button
            onClick={handleToggleTracking}
            disabled={isSyncing}
            className={`w-full py-4 rounded-[1.8rem] font-black text-xs uppercase transition-all active:scale-95 border-[3px] flex items-center justify-center gap-2 ${
              isTracking
                ? "bg-red-50 text-red-600 border-red-100 shadow-inner"
                : "bg-blue-600 text-white shadow-xl shadow-blue-100 border-blue-500"
            }`}
          >
            {isSyncing && <span className="animate-spin">⏳</span>}
            {isTracking ? "🛑 Stop Tracking" : "🚀 Launch Tracking"}
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-full py-3 rounded-[1.8rem] font-black text-[10px] uppercase flex justify-center items-center gap-2 border transition-all ${
              isRefreshing
                ? "bg-slate-50 text-slate-400 border-slate-100"
                : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
            }`}
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            {isRefreshing ? "Optimizing..." : "Recalculate Path"}
          </button>

          {/* ── ADD: Marker label toggle ── */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-[1.8rem] px-5 py-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              🗺️ Marker Labels
            </span>
            <BinLabelToggleButton />
          </div>

        </div>
      </div>
    </div>
  );
}

// --- Sub-Components (unchanged) ---

function ModeSelector({ mode, setMode, useFence, setUseFence }: any) {
  return (
    <div className="flex justify-between items-center mb-6 gap-2">
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setMode("fastest")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mode === "fastest" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"}`}
        >
          🍃 Fast
        </button>
        <button
          onClick={() => setMode("priority")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mode === "priority" ? "bg-white text-orange-500 shadow-sm" : "text-slate-400"}`}
        >
          ⚠️ Priority
        </button>
      </div>
      <button
        onClick={() => setUseFence(!useFence)}
        className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${useFence ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-slate-50 border-slate-200 text-slate-400"}`}
      >
        {useFence ? "🛡️ Fenced" : "🌍 Global"}
      </button>
    </div>
  );
}

function RouteSummary({ eta, mode }: any) {
  return (
    <div className={`p-8 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-100 text-center border-[4px] transition-all mb-6 ${mode === "priority" ? "bg-orange-500 border-orange-400" : "bg-emerald-600 border-emerald-500"}`}>
      <span className="block text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Total Trip</span>
      <span className="block text-4xl font-black">{eta.dist}</span>
      <div className="h-[1px] bg-white/20 w-12 mx-auto my-3" />
      <span className="text-sm font-bold bg-white/10 px-4 py-1 rounded-full backdrop-blur-sm">⏱️ {eta.time}</span>
    </div>
  );
}

function DetourSlider({ value, onChange }: any) {
  return (
    <div className="mb-6 bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Detour Range</span>
        <span className="text-[10px] font-black text-emerald-600 bg-white px-3 py-1 rounded-full border border-emerald-50">+{value}m</span>
      </div>
      <input
        type="range" min="50" max="800" step="50"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

function CollectionHistory({ history, onClear }: any) {
  if (history.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3 px-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Stops</span>
        {onClear && (
          <button onClick={onClear} className="text-[9px] font-black text-red-400 uppercase hover:underline">Clear</button>
        )}
      </div>
      <div className="space-y-2">
        {history.slice(0, 3).map((log: any, i: number) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
            <span className="text-[11px] font-black text-slate-700">🚛 {log.name}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{log.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StylePicker({ current, setStyle }: any) {
  const styles = [
    { id: "satellite-streets-v12", label: "Satellite", icon: "🛰️" },
    { id: "navigation-night-v1",   label: "Night",     icon: "🌙" },
    { id: "outdoors-v12",          label: "Terrain",   icon: "🏔️" },
  ];
  return (
    <div className="mb-4">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Map View</span>
      <div className="grid grid-cols-3 gap-3">
        {styles.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id as any)}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${current === s.id ? "bg-blue-50 border-blue-400 shadow-md scale-105" : "bg-white border-slate-100 opacity-60 hover:opacity-100"}`}
          >
            <span className="text-xl">{s.icon}</span>
            <span className="text-[9px] font-black uppercase">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100 flex justify-between items-center">
      <div>
        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">{icon} {label}</span>
        <span className="block text-xl font-black text-slate-800 tracking-tight">{value}</span>
      </div>
      <div className="text-right">
        <span className={`text-[10px] font-black uppercase ${color}`}>{sub}</span>
      </div>
    </div>
  );
}