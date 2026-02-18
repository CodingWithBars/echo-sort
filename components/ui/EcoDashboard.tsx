"use client";

import React, { useState } from "react";

interface CollectionLog {
  id: number;
  name: string;
  time: string;
}

interface DashboardProps {
  routingMode: "fastest" | "priority";
  setRoutingMode: (m: "fastest" | "priority") => void;
  maxDetour: number;
  setMaxDetour: (v: number) => void;
  useFence: boolean;
  setUseFence: (v: boolean) => void;

  // ⭐ NEW PROP
  currentBin?: { name: string; distance: string };

  nextBin: { name: string; distance: string };
  eta: { dist: string; time: string };
  targetCount: number;
  driverPos: any;

  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onRefresh: () => void;

  history?: CollectionLog[];
  onClearHistory?: () => void;

  mapStyle: "satellite-streets-v12" | "navigation-night-v1" | "outdoors-v12";
  setMapStyle: (
    s: "satellite-streets-v12" | "navigation-night-v1" | "outdoors-v12",
  ) => void;
}

export default function EcoDashboard({
  routingMode,
  setRoutingMode,
  maxDetour,
  setMaxDetour,
  useFence,
  setUseFence,

  currentBin, // ⭐ NEW

  nextBin,
  eta,
  targetCount,
  driverPos,
  isTracking,
  onStartTracking,
  onStopTracking,
  onRefresh,
  history = [],
  onClearHistory,
  mapStyle,
  setMapStyle,
}: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const styles: { id: typeof mapStyle; label: string; icon: string }[] = [
    { id: "satellite-streets-v12", label: "Satellite", icon: "🛰️" },
    { id: "navigation-night-v1", label: "Night", icon: "🌙" },
    { id: "outdoors-v12", label: "Terrain", icon: "🏔️" },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="flex flex-col h-[85vh] md:h-screen bg-white">
      <div className="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar">
        {/* MODE + FENCE */}
        <div className="flex justify-between items-center mb-6 gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setRoutingMode("fastest")}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                routingMode === "fastest"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-400"
              }`}
            >
              🍃 Efficient
            </button>
            <button
              onClick={() => setRoutingMode("priority")}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                routingMode === "priority"
                  ? "bg-white text-orange-500 shadow-sm"
                  : "text-slate-400"
              }`}
            >
              ⚠️ Urgent
            </button>
          </div>

          <button
            onClick={() => setUseFence(!useFence)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
              useFence
                ? "bg-blue-50 border-blue-200 text-blue-600"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            {useFence ? "🛡️ Fence: ON" : "🌍 Global"}
          </button>
        </div>

        {/* ROUTE SUMMARY */}
        <div
          className={`p-6 rounded-[2rem] text-white shadow-lg text-center border-[3px] transition-all duration-500 ${
            routingMode === "priority"
              ? "bg-orange-500 border-orange-400"
              : "bg-emerald-600 border-emerald-500"
          }`}
        >
          <span className="block text-[10px] font-black opacity-80 uppercase mb-1">
            Total Route distance
          </span>
          <span className="block text-3xl font-black">{eta.dist}</span>
          <hr className="opacity-20 my-2" />
          <span className="text-sm font-bold">⏱️ EST. {eta.time}</span>
        </div>

        {/* DETOUR */}
        <div className="mt-3 mb-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase">
              Detour Range
            </span>
            <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded border">
              +{maxDetour}m
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="800"
            step="50"
            value={maxDetour}
            onChange={(e) => setMaxDetour(parseInt(e.target.value))}
            className="w-full h-1.5 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase">
            Filters bins by trip effort
          </p>
        </div>

        {/* ⭐ CURRENT BIN CARD */}
        {currentBin && (
          <StatCard
            label="Current Station"
            value={currentBin.name}
            sub={currentBin.distance}
            color="text-blue-600"
            icon="🚚"
          />
        )}

        {/* NEXT BIN */}
        <StatCard
          label="Next Station"
          value={nextBin.name}
          sub={nextBin.distance}
          color="text-emerald-600"
          icon="📍"
        />

        <StatCard
          label="Active Stops"
          value={targetCount.toString()}
          sub="Total Bins"
          color="text-slate-400"
          icon="🗑️"
        />

        {/* RECENT COLLECTIONS LOG */}
        {history.length > 0 && (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Recent Collections
              </span>
              <button
                onClick={onClearHistory}
                className="text-[8px] font-black text-red-400 uppercase hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {history.map((log, i) => (
                <div
                  key={`${log.id}-${i}`}
                  className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-xl shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs">✅</span>
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">
                      {log.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">
                    {log.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAP STYLE PICKER */}
        <div className="mb-3 mt-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">
            Map Appearance
          </span>
          <div className="grid grid-cols-3 gap-2">
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => setMapStyle(s.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-300 ${
                  mapStyle === s.id
                    ? "bg-blue-50 border-blue-400 shadow-sm scale-[1.02]"
                    : "bg-slate-50 border-slate-100 opacity-60 hover:opacity-100"
                }`}
              >
                <span className="text-lg">{s.icon}</span>
                <span
                  className={`text-[8px] font-black uppercase ${
                    mapStyle === s.id ? "text-blue-600" : "text-slate-500"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="p-5 pt-4 border-t border-slate-100 bg-white/90 backdrop-blur-md pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-24">
        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
          <button
            onClick={isTracking ? onStopTracking : onStartTracking}
            className={`w-full py-4 md:py-5 rounded-[1.8rem] font-black text-xs uppercase transition-all active:scale-95 border ${
              isTracking
                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-sm"
                : "bg-blue-600 text-white shadow-lg shadow-blue-200 border-blue-500 hover:bg-blue-700"
            }`}
          >
            {isTracking ? "🛑 Stop Tracking" : "🚀 Launch Tracking"}
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-full py-3 md:py-4 rounded-[1.8rem] font-black text-[10px] uppercase flex justify-center items-center gap-2 transition-all active:scale-95 ${
              isRefreshing
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-wait"
                : "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 shadow-sm"
            }`}
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            {isRefreshing ? "Optimizing Path..." : "Recalculate Path"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-slate-50 mt-2 mb-1 p-4 rounded-[1.5rem] border border-slate-100 flex justify-between items-center">
      <div>
        <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">
          {icon} {label}
        </span>
        <span className="block text-lg font-black text-slate-800">{value}</span>
      </div>
      <span className={`text-xs font-black ${color}`}>{sub}</span>
    </div>
  );
}
