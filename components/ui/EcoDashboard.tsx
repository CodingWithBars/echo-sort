"use client";

interface DashboardProps {
  routingMode: 'fastest' | 'priority';
  setRoutingMode: (m: 'fastest' | 'priority') => void;
  maxDetour: number;
  setMaxDetour: (v: number) => void;
  nextBin: { name: string, distance: string };
  eta: { dist: string, time: string };
  targetCount: number;
  driverPos: any;
  onStartTracking: () => void;
  onRefresh: () => void;
}

export default function EcoDashboard({ 
  routingMode, setRoutingMode, maxDetour, setMaxDetour, nextBin, eta, targetCount, driverPos, onStartTracking, onRefresh 
}: DashboardProps) {
  return (
    <div className="p-5 md:p-8 flex flex-col h-full">
      <div className="hidden md:block mb-8">
        <h1 className="text-2xl font-black text-slate-800 tracking-tighter italic">ECO<span className="text-emerald-500">ROUTE</span></h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fleet Logic v2.0</p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl mb-6 max-w-[240px]">
        <button onClick={() => setRoutingMode("fastest")} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${routingMode === "fastest" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"}`}>🍃 Efficient</button>
        <button onClick={() => setRoutingMode("priority")} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${routingMode === "priority" ? "bg-white text-orange-500 shadow-sm" : "text-slate-400"}`}>⚠️ Urgent</button>
      </div>

      {/* DETOUR SLIDER - Algorithm Control */}
      <div className="mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase">Detour Range</span>
          <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded border">+{maxDetour}m</span>
        </div>
        <input 
          type="range" min="0" max="1500" step="50" 
          value={maxDetour} 
          onChange={(e) => setMaxDetour(parseInt(e.target.value))}
          className="w-full h-1.5 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Adjusts how far we detour for {'>'}40% bins</p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        <StatCard label="Next Station" value={nextBin.name} sub={nextBin.distance} color="text-emerald-600" icon="📍" />
        <div className={`p-6 rounded-[2rem] text-white shadow-lg text-center border-[3px] transition-all duration-500 ${routingMode === "priority" ? "bg-orange-500 border-orange-400" : "bg-emerald-600 border-emerald-500"}`}>
          <span className="block text-[10px] font-black opacity-80 uppercase mb-1">Total Route distance</span>
          <span className="block text-3xl font-black">{eta.dist}</span>
          <hr className="opacity-20 my-2" />
          <span className="text-sm font-bold">⏱️ EST. {eta.time}</span>
        </div>
        <StatCard label="Active Stops" value={targetCount.toString()} sub="Total Bins" color="text-slate-400" icon="🗑️" />
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <button onClick={onStartTracking} className={`w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest transition-all ${driverPos ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-lg'}`}>
          {driverPos ? "📡 System Active" : "🚀 Launch Tracking"}
        </button>
        <button onClick={onRefresh} className="w-full py-4 rounded-[1.8rem] bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-[10px] uppercase flex justify-center items-center gap-2">
          <span>🔄</span> Recalculate Path
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 flex justify-between items-center">
      <div>
        <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">{icon} {label}</span>
        <span className="block text-lg font-black text-slate-800">{value}</span>
      </div>
      <span className={`text-xs font-black ${color}`}>{sub}</span>
    </div>
  );
}