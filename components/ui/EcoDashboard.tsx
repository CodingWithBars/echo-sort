"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { BinLabelToggleButton } from "../driver/BinMarker";

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
}

export default function EcoDashboard(props: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing]       = useState(false);
  const { bins, eta, history, isTracking, onRefresh, routingMode } = props;

  // --- Realtime Sync Logic ---
  useEffect(() => {
    const syncStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("dashboard-status-sync")
        .on(
          "postgres_changes",
          {
            event:  "UPDATE",
            schema: "public",
            table:  "driver_details",
            filter: `id=eq.${user.id}`,
          },
          (payload: RealtimePostgresUpdatePayload<DriverDetails>) => {
            const isNowOnDuty = payload.new.duty_status === "ON-DUTY";
            if (isNowOnDuty && !isTracking)  props.onStartTracking();
            if (!isNowOnDuty && isTracking)  props.onStopTracking();
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    syncStatus();
  }, [isTracking, props]);

  // --- Database Toggle Logic ---
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
      else                          props.onStopTracking();
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
      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">

        {/* Mode + Fence Toggle */}
        <ModeSelector
          mode={routingMode}
          setMode={props.setRoutingMode}
          useFence={props.useFence}
          setUseFence={props.setUseFence}
        />

        {/* Route Summary Card */}
        <RouteSummary eta={eta} mode={routingMode} />

        {/* Detour Slider */}
        <DetourSlider value={props.maxDetour} onChange={props.setMaxDetour} />

        {/* Stat Cards */}
        <div className="space-y-3 mb-6">
          <StatCard
            label="Active Stops"
            value={activeStops.toString()}
            sub="Bins > 40%"
            color="text-emerald-600"
            icon="🗑️"
          />
        </div>

        {/* Collection Log */}
        <CollectionHistory history={history} onClear={props.onClearHistory} />
      </div>

      {/* Persistent Action Footer */}
      <div className="p-5 border-t border-slate-100 bg-white pb-8">
        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">

          {/* Tracking toggle */}
          <button
            onClick={handleToggleTracking}
            disabled={isSyncing}
            className={`w-full py-4 rounded-[20px] font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
              isTracking
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-blue-600 text-white shadow-lg shadow-blue-200"
            }`}
          >
            {isSyncing && <span className="animate-spin">⏳</span>}
            {isTracking ? "🛑 Stop Route & Go Offline" : "🚀 Launch Route & Go Online"}
          </button>

          {/* Recalculate */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-full py-4 rounded-[20px] font-black text-sm uppercase flex justify-center items-center gap-2 transition-all ${
              isRefreshing
                ? "bg-slate-100 text-slate-400"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }`}
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            {isRefreshing ? "Optimizing Route..." : "Force Recalculate Path"}
          </button>

          {/* Marker label toggle */}
          <div className="flex items-center justify-between bg-slate-50 rounded-[20px] px-6 py-4 mt-2">
            <span className="text-sm font-black text-slate-700">
              🗺️ Show Marker Labels
            </span>
            <BinLabelToggleButton />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ModeSelector({ mode, setMode, useFence, setUseFence }: any) {
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Routing Strategy</span>
        <div className="flex bg-slate-100 p-1.5 rounded-[20px] w-full">
          <button
            onClick={() => setMode("fastest")}
            className={`flex-1 py-3 rounded-[16px] text-sm font-black transition-all ${mode === "fastest" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:bg-slate-200/50"}`}
          >
            🍃 Fastest Route
          </button>
          <button
            onClick={() => setMode("priority")}
            className={`flex-1 py-3 rounded-[16px] text-sm font-black transition-all ${mode === "priority" ? "bg-white text-orange-500 shadow-sm" : "text-slate-500 hover:bg-slate-200/50"}`}
          >
            ⚠️ High Priority
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-[24px] border border-slate-100">
        <div>
           <span className="block text-sm font-black text-slate-800">Geofence Lock</span>
           <span className="block text-xs font-bold text-slate-400">Keep route inside boundary</span>
        </div>
        <button
          onClick={() => setUseFence(!useFence)}
          className={`w-14 h-8 rounded-full flex items-center transition-all px-1 ${useFence ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${useFence ? "translate-x-6" : "translate-x-0"}`} />
        </button>
      </div>
    </div>
  );
}

function RouteSummary({ eta, mode }: any) {
  return (
    <div className={`p-6 rounded-[24px] text-white shadow-lg text-center transition-all mb-8 ${mode === "priority" ? "bg-gradient-to-br from-orange-400 to-orange-500" : "bg-gradient-to-br from-emerald-400 to-emerald-500"}`}>
      <span className="block text-xs font-black opacity-80 uppercase tracking-widest mb-2">Trip Overview</span>
      <div className="flex justify-center items-baseline gap-3">
         <span className="text-4xl font-black">{eta.time}</span>
      </div>
      <div className="inline-block mt-3 bg-white/20 px-5 py-1.5 rounded-full backdrop-blur-sm text-sm font-bold">🚗 {eta.dist}</div>
    </div>
  );
}

function DetourSlider({ value, onChange }: any) {
  return (
    <div className="mb-8 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
      <div className="flex justify-between items-center mb-5">
        <span className="text-sm font-black text-slate-800">Max Detour</span>
        <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">+{value}m</span>
      </div>
      <input
        type="range" min="50" max="800" step="50"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

function CollectionHistory({ history, onClear }: any) {
  if (history.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4 ml-2">
        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Recent Stops</span>
        {onClear && (
          <button onClick={onClear} className="text-xs font-black text-slate-400 hover:text-red-500 transition-colors mr-2">
            CLEAR
          </button>
        )}
      </div>
      <div className="space-y-3">
        {history.slice(0, 3).map((log: any, i: number) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 p-4 rounded-[20px] border border-slate-100">
            <span className="text-sm font-black text-slate-700">🚛 {log.name}</span>
            <span className="text-xs font-bold text-slate-400">{log.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-slate-50 p-5 rounded-[24px] border border-slate-100 flex justify-between items-center">
      <div>
        <span className="block text-xs font-black text-slate-500 mb-1">{icon} {label}</span>
        <span className="block text-2xl font-black text-slate-800">{value}</span>
      </div>
      <div className="text-right">
        <span className={`text-xs font-black uppercase ${color}`}>{sub}</span>
      </div>
    </div>
  );
}