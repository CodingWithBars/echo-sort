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
    /* Reduced padding from p-8 to p-5 and height via smaller rounded corners */
    <div className="bg-white/90 backdrop-blur-md rounded-t-[2.5rem] p-5 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] z-[1000] border-t border-white">
      <div className="max-w-md mx-auto">
        
        {/* MODE TOGGLE - Slimmer height */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4 max-w-[240px] mx-auto">
          <button onClick={() => setRoutingMode("fastest")} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${routingMode === "fastest" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"}`}>
            🍃 Fast
          </button>
          <button onClick={() => setRoutingMode("priority")} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${routingMode === "priority" ? "bg-white text-orange-500 shadow-sm" : "text-slate-400"}`}>
            ⚠️ Risk
          </button>
        </div>

        {/* STATS GRID - Reduced gaps and vertical padding */}
        <div className="grid grid-cols-3 gap-3 mb-5 items-center">
          
          <StatCard 
            label="Next" 
            value={nextBin.name} 
            sub={nextBin.distance} 
            color="text-emerald-600" 
            icon="📍"
          />

          {/* CENTER TRIP CARD - Scaled down from 110% to 105% and reduced padding */}
          <div className={`p-3 rounded-[2rem] text-white shadow-xl text-center scale-105 flex flex-col justify-center border-[3px] transition-all duration-500 ${routingMode === "priority" ? "bg-orange-500 border-orange-400 shadow-orange-100" : "bg-emerald-600 border-emerald-500 shadow-emerald-100"}`}>
            <span className="block text-[8px] font-black opacity-80 uppercase mb-0.5">Route</span>
            <span className="block text-xl font-black leading-none">{eta.dist}</span>
            <hr className="opacity-20 my-1" />
            <span className="text-[10px] font-bold">⏱️ {eta.time}</span>
          </div>

          <StatCard 
            label="Bins" 
            value={targetCount.toString()} 
            sub="Left" 
            color="text-slate-400" 
            icon="🗑️"
          />
        </div>

        {/* ACTION BUTTONS - Reduced py-5 to py-3.5 and smaller text */}
        <div className="flex gap-3">
          <button onClick={onStartTracking} className={`flex-1 py-3.5 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${driverPos ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-50'}`}>
            {driverPos ? "📡 Active" : "🚀 Start"}
          </button>
          
          <button 
            onClick={onRefresh} 
            className="group px-6 py-3.5 rounded-[1.8rem] bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm active:scale-90 transition-all"
          >
            <span className="group-hover:rotate-180 transition-transform duration-500 block text-sm">🔄</span>
          </button>
        </div>

        {/* FOOTER - Tighter margin */}
        <p className="text-center mt-4 text-[8px] font-black uppercase tracking-widest text-slate-300">
          Dijkstra Optimized
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    /* Slimmed down padding and rounded corners */
    <div className="bg-slate-50/50 p-2.5 rounded-[1.5rem] border border-slate-100 flex flex-col justify-center items-center text-center overflow-hidden">
      <span className="block text-[7px] font-black text-slate-400 uppercase mb-1">{icon} {label}</span>
      <span className="block text-[11px] font-black text-slate-800 truncate w-full">{value}</span>
      <span className={`text-[9px] font-black mt-0.5 ${color}`}>{sub}</span>
    </div>
  );
}