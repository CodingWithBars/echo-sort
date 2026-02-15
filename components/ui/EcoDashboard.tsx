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
    <div className="bg-white rounded-t-[3.5rem] p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] z-[1000]">
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

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Next Bin" value={nextBin.name} sub={nextBin.distance} color="text-emerald-600" />
          <div className={`p-4 rounded-[2rem] text-white shadow-xl text-center scale-110 flex flex-col justify-center border-4 transition-all duration-500 ${routingMode === "priority" ? "bg-orange-500 border-orange-400" : "bg-emerald-600 border-emerald-500"}`}>
            <span className="block text-[8px] font-black opacity-60 uppercase mb-1">Trip</span>
            <span className="block text-xl font-black">{eta.time}</span>
            <span className="text-[10px] font-bold opacity-80">{eta.dist}</span>
          </div>
          <StatCard label="Targets" value={targetCount.toString()} sub="In Queue" color="text-slate-400" />
        </div>

        <div className="flex gap-4">
          <button onClick={onStartTracking} className={`flex-1 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${driverPos ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-xl shadow-blue-200'}`}>
            {driverPos ? "📡 Active" : "🚀 Start"}
          </button>
          <button onClick={onRefresh} className="px-8 py-5 rounded-[2rem] bg-emerald-600 text-white shadow-xl active:scale-95 transition-all">🔄</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: any) {
  return (
    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 flex flex-col justify-center overflow-hidden">
      <span className="block text-[8px] font-black text-slate-400 uppercase mb-1">{label}</span>
      <span className="block text-sm font-black text-slate-800 truncate">{value}</span>
      <span className={`text-[10px] font-bold ${color}`}>{sub}</span>
    </div>
  );
}