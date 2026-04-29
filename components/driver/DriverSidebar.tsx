"use client";

import EcoDashboard from "../ui/EcoDashboard";

interface DriverSidebarProps {
  bins: any[];
  eta: { dist: string; time: string };
  history: any[];
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onRefresh: () => void;
  onClearHistory: () => void;
  onAddToHistory?: (entry: { id: number; name: string; time: string }) => void;
  routingMode: "fastest" | "priority";
  setRoutingMode: (m: "fastest" | "priority") => void;
  maxDetour: number;
  setMaxDetour: (v: number) => void;
  useFence: boolean;
  setUseFence: (v: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isDashboardVisible: boolean;
  setIsDashboardVisible: (v: boolean) => void;
  /** BYPASS ROUTE — forwarded to EcoDashboard footer button */
  onBypassRecord?: () => void;
}

export default function DriverSidebar({
  bins,
  eta,
  history,
  isTracking,
  onStartTracking,
  onStopTracking,
  onRefresh,
  onClearHistory,
  onAddToHistory,
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
  onBypassRecord,
}: DriverSidebarProps) {
  return (
    <>
      {/* ── Desktop sidebar toggle tab ──────────────────────────────────────── */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`hidden md:flex fixed top-1/2 -translate-y-1/2 z-[1005]
          bg-white border border-slate-200 border-r-0 shadow-[-6px_0_20px_rgba(0,0,0,0.1)]
          w-10 h-28 items-center justify-center rounded-l-[1.5rem] transition-all duration-700
          hover:bg-emerald-50 group
          ${isSidebarOpen ? "right-[400px]" : "right-0"}`}
      >
        <div className="flex flex-col items-center gap-2">
          <span className={`text-sm transition-transform duration-700 ${isSidebarOpen ? "rotate-0 text-slate-300" : "rotate-180 text-emerald-600 font-black"}`}>
            ▶
          </span>
          {!isSidebarOpen && (
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 [writing-mode:vertical-lr] py-2">
              EcoRoute
            </span>
          )}
        </div>
      </button>

      {/* ── Sidebar / bottom-sheet container ───────────────────────────────── */}
      <div
        className={`fixed md:relative z-[1001] transition-all duration-700
          bottom-0 right-0 left-0 md:left-auto
          ${isDashboardVisible ? "h-[80vh]" : "h-[70px]"}
          ${isSidebarOpen ? "translate-x-0 md:w-[400px]" : "translate-x-full md:translate-x-0 md:w-0"}
          md:h-full order-2`}
      >
        <div className={`
          h-full bg-white/95 backdrop-blur-xl shadow-2xl border-slate-200 flex flex-col overflow-hidden transition-all duration-500
          border-t md:border-t-0 md:border-l
          ${isDashboardVisible ? "rounded-t-[2.5rem]" : "rounded-t-none"}
          md:rounded-none
          ${!isSidebarOpen ? "md:opacity-0 pointer-events-none" : "opacity-100"}
        `}>

          {/* ── Mobile drag handle area ───────────────────────────────────────
              On mobile the handle row also contains the bypass FAB so it is
              always visible at the top edge of the sheet, above the content.
              On desktop (md+) the bypass button lives inside EcoDashboard footer.
          ──────────────────────────────────────────────────────────────────── */}
          <div
            className="w-full pt-3 pb-2 flex items-center justify-between px-5 cursor-pointer md:hidden"
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
          >
            {/* Left spacer keeps handle centred */}
            <div className="w-10" />

            {/* Drag handle pill */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />

            {/* ── BYPASS FAB — mobile only, always above sheet ─────────────
                Sits inside the drag-handle row so it is part of the sheet
                header and never hidden by content below.
                Tapping it does NOT collapse the sheet (stopPropagation).
            ──────────────────────────────────────────────────────────────── */}
            {isTracking && onBypassRecord ? (
              <button
                onClick={e => { e.stopPropagation(); onBypassRecord(); }}
                className="w-10 h-10 rounded-2xl bg-purple-100 border-2 border-purple-300 text-purple-700 flex items-center justify-center active:scale-95 transition-all"
                title="Record bypass route"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2 L9 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M9 8 L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M9 8 L14 16" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2"/>
                  <circle cx="9" cy="8" r="2" fill="currentColor"/>
                </svg>
              </button>
            ) : (
              /* Placeholder keeps handle centred when button is absent */
              <div className="w-10" />
            )}
          </div>

          {/* ── Dashboard content ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar md:pb-24">
            <EcoDashboard
              bins={bins}
              eta={eta}
              history={history}
              isTracking={isTracking}
              onStartTracking={onStartTracking}
              onStopTracking={onStopTracking}
              onRefresh={onRefresh}
              onClearHistory={onClearHistory}
              routingMode={routingMode}
              setRoutingMode={setRoutingMode}
              maxDetour={maxDetour}
              setMaxDetour={setMaxDetour}
              useFence={useFence}
              setUseFence={setUseFence}
              onBypassRecord={onBypassRecord}
            />
          </div>
        </div>
      </div>
    </>
  );
}