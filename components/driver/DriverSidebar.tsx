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
        className={`fixed md:relative z-[1001] transition-all cubic-bezier(0.4, 0, 0.2, 1) duration-700 
        bottom-0 right-0 left-0 md:left-auto
        ${isDashboardVisible ? "h-[80vh]" : "h-[70px]"} 
        ${
          isSidebarOpen
            ? "translate-x-0 md:w-[400px]"
            : "translate-x-full md:translate-x-0 md:w-0"
        } 
        md:h-full order-2`}
      >
        <div
          className={`
          h-full bg-white/95 backdrop-blur-xl shadow-2xl border-slate-200 flex flex-col overflow-hidden transition-all duration-500
          border-t md:border-t-0 md:border-l 
          ${isDashboardVisible ? "rounded-t-[2.5rem]" : "rounded-t-none"} 
          md:rounded-none
          ${!isSidebarOpen ? "md:opacity-0 pointer-events-none" : "opacity-100"}
        `}
        >
          {/* MOBILE-ONLY DRAG HANDLE */}
          <div
            className="w-full py-4 flex justify-center cursor-pointer md:hidden"
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
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