"use client";

interface DashboardProps {
  routingMode: 'fastest' | 'priority';
  setRoutingMode: (m: 'fastest' | 'priority') => void;
  nextBin: { name: string, distance: string };
  eta: { dist: string, time: string };
  targetCount: number;
  driverPos: any;
  onStartTracking: () => void;
  onRefresh: () => void;
}

export default function EcoDashboard({ 
  routingMode, setRoutingMode, nextBin, eta, targetCount, driverPos, onStartTracking, onRefresh 
}: DashboardProps) {
  return (
    /* WEB: square corners, p-8, border-l (if used as sidebar)
       MOBILE: rounded-t-[2.5rem], p-5, fixed bottom
    */
    <div className="bg-white/95 backdrop-blur-md shadow-[0_-15px_40px_rgba(0,0,0,0.08)] z-[1000] border-t md:border-t-0 md:border-l border-white h-full
                    md:rounded-none p-5 md:p-8">
      
      {/* Container adapts width: max-md on mobile, full width on web sidebar */}
      <div className="max-w-md mx-au to md:max-w-none md:flex md:flex-col md:h-full md:justify-between">
        
        <div>
          {/* HEADER SECTION (Web only) */}
          <div className="hidden md:block mb-8">
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter italic">ECO<span className="text-emerald-500">ROUTE</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Route Management v1.0</p>
          </div>

          {/* MODE TOGGLE - Stays centered on mobile, moves left on web */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 max-w-[240px] mx-auto md:mx-0">
            <button onClick={() => setRoutingMode("fastest")} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${routingMode === "fastest" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"}`}>
              🍃 Fast
            </button>
            <button onClick={() => setRoutingMode("priority")} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${routingMode === "priority" ? "bg-white text-orange-500 shadow-sm" : "text-slate-400"}`}>
              ⚠️ Risk
            </button>
          </div>

          {/* STATS GRID - Changes from 3-cols (mobile) to vertical stack or 1-col (web) */}
          <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-5 mb-8 items-center">
            
            <StatCard 
              label="Next Destination" 
              value={nextBin.name} 
              sub={nextBin.distance} 
              color="text-emerald-600" 
              icon="📍"
            />

            {/* CENTER TRIP CARD - Optimized for both scales */}
            <div className={`p-4 md:p-6 rounded-[2rem] text-white shadow-xl text-center scale-105 md:scale-100 flex flex-col justify-center border-[3px] transition-all duration-500 ${routingMode === "priority" ? "bg-orange-500 border-orange-400 shadow-orange-100" : "bg-emerald-600 border-emerald-500 shadow-emerald-100"}`}>
              <span className="block text-[8px] md:text-[10px] font-black opacity-80 uppercase mb-1">Estimated Route</span>
              <span className="block text-xl md:text-3xl font-black leading-none">{eta.dist}</span>
              <hr className="opacity-20 my-2" />
              <span className="text-[10px] md:text-sm font-bold">⏱️ {eta.time}</span>
            </div>

            <StatCard 
              label="Target Bins" 
              value={targetCount.toString()} 
              sub="Remaining" 
              color="text-slate-400" 
              icon="🗑️"
            />
          </div>
        </div>

        {/* ACTION BUTTONS - Visible always, stacks vertically on Web */}
        <div className="flex md:flex-col gap-3">
          <button onClick={onStartTracking} className={`flex-1 py-4 md:py-5 rounded-[1.8rem] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all active:scale-95 ${driverPos ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-50'}`}>
            {driverPos ? "📡 System Active" : "🚀 Start Live Route"}
          </button>
          
          <button 
            onClick={onRefresh} 
            className="group px-6 md:w-full py-4 md:py-5 rounded-[1.8rem] bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm active:scale-90 transition-all flex justify-center items-center gap-2"
          >
            <span className="group-hover:rotate-180 transition-transform duration-500 block text-sm">🔄</span>
            <span className="hidden md:inline text-[10px] font-black uppercase">Refresh Nodes</span>
          </button>
        </div>

        {/* FOOTER */}
        <p className="text-center mt-6 text-[8px] font-black uppercase tracking-widest text-slate-300">
          Dijkstra Optimized • Lupon Area
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-slate-50/50 p-3 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:justify-between justify-center items-center text-center md:text-left overflow-hidden">
      <div className="flex flex-col items-center md:items-start">
        <span className="block text-[7px] md:text-[9px] font-black text-slate-400 uppercase mb-1">{icon} {label}</span>
        <span className="block text-[11px] md:text-lg font-black text-slate-800 truncate w-full">{value}</span>
      </div>
      <span className={`text-[9px] md:text-xs font-black mt-0.5 md:mt-0 ${color}`}>{sub}</span>
    </div>
  );
}