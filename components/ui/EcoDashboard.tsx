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
    <div className="bg-white rounded-t-[3.5rem] p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] z-[1000] border-t border-slate-100">
      <div className="max-w-md mx-auto">
        
        {/* MODE TOGGLE */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
          <button onClick={() => setRoutingMode("fastest")} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${routingMode === "fastest" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"}`}>
            🍃 Fastest
          </button>
          <button onClick={() => setRoutingMode("priority")} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${routingMode === "priority" ? "bg-white text-orange-500 shadow-sm" : "text-slate-400"}`}>
            ⚠️ Priority
          </button>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-3 gap-4 mb-8 items-center">
          
          {/* NEXT BIN CARD */}
          <StatCard 
            label="Next Stop" 
            value={nextBin.name} 
            sub={nextBin.distance} 
            color="text-emerald-600" 
            icon="📍"
          />

          {/* CENTER TRIP CARD (Dijkstra/TSP Result) */}
          <div className={`p-5 rounded-[2.5rem] text-white shadow-2xl text-center scale-110 flex flex-col justify-center border-4 transition-all duration-500 ${routingMode === "priority" ? "bg-orange-500 border-orange-400 shadow-orange-200" : "bg-emerald-600 border-emerald-500 shadow-emerald-200"}`}>
            <span className="block text-[9px] font-black opacity-70 uppercase tracking-tighter mb-1">Total Route</span>
            <span className="block text-2xl font-black leading-none mb-1">{eta.dist}</span>
            <hr className="opacity-20 my-1" />
            <span className="text-[11px] font-bold tracking-tight">⏱️ {eta.time}</span>
          </div>

          {/* TARGETS/QUEUE CARD */}
          <StatCard 
            label="Total Bins" 
            value={targetCount.toString()} 
            sub="Remaining" 
            color="text-slate-400" 
            icon="🗑️"
          />
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-4">
          <button onClick={onStartTracking} className={`flex-1 py-5 rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 ${driverPos ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-blue-600 text-white shadow-xl shadow-blue-100'}`}>
            {driverPos ? "📡 Tracking Active" : "🚀 Start Route"}
          </button>
          
          <button 
            onClick={onRefresh} 
            className="group px-8 py-5 rounded-[2.2rem] bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm active:scale-90 transition-all"
          >
            <span className="group-hover:rotate-180 transition-transform duration-500 block">🔄</span>
          </button>
        </div>

        {/* DISTANCE FOOTER */}
        <p className="text-center mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
          Optimized by Dijkstra Algorithm
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 flex flex-col justify-center items-center text-center overflow-hidden">
      <span className="block text-[8px] font-black text-slate-400 uppercase mb-2">{icon} {label}</span>
      <span className="block text-sm font-black text-slate-800 truncate w-full">{value}</span>
      <span className={`text-[10px] font-black mt-1 ${color}`}>{sub}</span>
    </div>
  );
}