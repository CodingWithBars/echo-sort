"use client";

import EcoDashboard from "../ui/EcoDashboard";

interface DriverSidebarProps {
  // Data
  bins: any[];
  eta: { dist: string; time: string };
  history: any[];
  isTracking: boolean;

  // Actions
  onStartTracking: () => void;
  onStopTracking: () => void;
  onRefresh: () => void;

  // FIX #2: onClearHistory is now declared so it can be forwarded
  onClearHistory: () => void;

  // FIX #3: onAddToHistory forwarded to EcoDashboard / children that log collections
  onAddToHistory?: (entry: { id: number; name: string; time: string }) => void;

  // ADD THESE TWO LINES:
  mapStyle?: any; 
  setMapStyle?: (s: any) => void;


  routingMode: "fastest" | "priority";
  setRoutingMode: (m: "fastest" | "priority") => void;
  maxDetour: number;
  setMaxDetour: (v: number) => void;
  useFence: boolean;
  setUseFence: (v: boolean) => void;

  // UI visibility
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isDashboardVisible: boolean;
  setIsDashboardVisible: (v: boolean) => void;
}

export default function DriverSidebar({
  bins,
  eta,
  history,
  isTracking,
  onStartTracking,
  onStopTracking,
  onRefresh,
  onClearHistory,    // FIX #2: now destructured
  onAddToHistory,    // FIX #3: now destructured
  // mapStyle,
  // setMapStyle,
  routingMode,
  setRoutingMode,
  maxDetour,
  setMaxDetour,
  useFence,
  setUseFence,
  isSidebarOpen,
  setIsSidebarOpen,
  isDashboardVisible,
  setIsDashboardVisible,
}: DriverSidebarProps) {
  return (
    <>
      {/* 1. BROWSER/DESKTOP TOGGLE */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`hidden md:flex fixed top-1/2 -translate-y-1/2 z-[1005] 
          bg-white border border-slate-200 border-r-0 shadow-[-6px_0_20px_rgba(0,0,0,0.1)] 
          w-10 h-28 items-center justify-center rounded-l-[1.5rem] transition-all duration-700 
          hover:bg-emerald-50 group
          ${isSidebarOpen ? "right-[400px]" : "right-0"}`}
      >
        <div className="flex flex-col items-center gap-2">
          <span
            className={`text-sm transition-transform duration-700 ${
              isSidebarOpen
                ? "rotate-0 text-slate-300"
                : "rotate-180 text-emerald-600 font-black"
            }`}
          >
            ▶
          </span>
          {!isSidebarOpen && (
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 [writing-mode:vertical-lr] py-2">
              EcoRoute
            </span>
          )}
        </div>
      </button>

      {/* 2. SIDEBAR CONTAINER */}
      <div
        className={`fixed md:relative z-[1005] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        bottom-0 right-0 left-0 md:left-auto h-[85vh] md:h-full
        ${isDashboardVisible ? "translate-y-0" : "translate-y-full md:translate-y-0"} 
        ${
          isSidebarOpen
            ? "md:translate-x-0 md:w-[400px]"
            : "md:translate-x-full md:w-0"
        } 
        order-2`}
      >
        <div
          className={`
          h-full bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.15)] md:shadow-2xl border-slate-200 flex flex-col overflow-hidden transition-all duration-500
          rounded-t-[32px] md:rounded-none md:border-l
          ${!isDashboardVisible ? "pointer-events-none md:pointer-events-auto" : ""}
          ${!isSidebarOpen ? "md:opacity-0 md:pointer-events-none" : "opacity-100"}
        `}
        >
          {/* MOBILE-ONLY CLOSE HANDLE */}
          <div
            className="w-full pt-5 pb-3 flex flex-col items-center cursor-pointer md:hidden relative bg-white z-10"
            onClick={() => setIsDashboardVisible(false)}
          >
            <div className="w-16 h-1.5 bg-slate-200 rounded-full mb-3" />
            <span className="text-sm font-black text-slate-800 tracking-tight">Settings & Overview</span>
            <button className="absolute right-6 top-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">✕</button>
          </div>

          {/* DASHBOARD CONTENT AREA */}
          <div className="flex-1 overflow-y-auto custom-scrollbar md:pb-24">
            <EcoDashboard
              bins={bins}
              eta={eta}
              history={history}
              isTracking={isTracking}
              onStartTracking={onStartTracking}
              onStopTracking={onStopTracking}
              onRefresh={onRefresh}
              // FIX #2: forwarded through to EcoDashboard
              onClearHistory={onClearHistory}
              // mapStyle={mapStyle}
              // setMapStyle={setMapStyle}
              routingMode={routingMode}
              setRoutingMode={setRoutingMode}
              maxDetour={maxDetour}
              setMaxDetour={setMaxDetour}
              useFence={useFence}
              setUseFence={setUseFence}
            />
          </div>
        </div>
      </div>
    </>
  );
}