"use client";

export default function Overview() {
  const stats = [
    { label: "Active Drivers", value: "12", icon: "🚚", color: "text-blue-600", bg: "bg-blue-50", trend: "+2 today" },
    { label: "Total Citizens", value: "1,240", icon: "👥", color: "text-emerald-600", bg: "bg-emerald-50", trend: "+12% MoM" },
    { label: "Waste Collected", value: "4.2 Tons", icon: "♻️", color: "text-orange-600", bg: "bg-orange-50", trend: "-4% vs LW" },
    { label: "Open Violations", value: "18", icon: "⚠️", color: "text-red-600", bg: "bg-red-50", trend: "6 Urgent" },
  ];

  const barangayPerformance = [
    { name: "San Jose", weight: 1200, growth: 12 },
    { name: "Santa Maria", weight: 950, growth: 8 },
    { name: "Sto. Niño", weight: 820, growth: -3 },
    { name: "San Roque", weight: 740, growth: 5 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* --- KPI HERO GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 transition-transform hover:scale-[1.02]">
            <div className="flex justify-between items-start">
              <div className={`text-2xl p-4 rounded-2xl ${stat.bg} ${stat.color}`}>{stat.icon}</div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.trend.includes('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* --- ANALYTICS SECTION --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Weekly Collection Chart (Simulated Graph) */}
        <div className="xl:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Collection Trends</h3>
              <p className="text-xs font-bold text-slate-400 uppercase">Last 7 Days (Metric Tons)</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Success</span>
              </div>
            </div>
          </div>
          
          {/* Visualizing Data with CSS Grid/Flex for high performance */}
          <div className="flex items-end justify-between h-48 gap-2 px-2">
            {[45, 60, 35, 80, 55, 90, 70].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                <div 
                  className="w-full bg-emerald-500 rounded-t-xl transition-all duration-1000 ease-out group-hover:bg-slate-900 relative"
                  style={{ height: `${val}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {val/10}T
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Day {i+1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waste Composition Card */}
        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-[-20px] right-[-20px] text-8xl opacity-10">📊</div>
           <h3 className="text-xl font-black mb-6 tracking-tight">Waste Breakdown</h3>
           <div className="space-y-5">
             {[
               { type: "Biodegradable", percent: 65, color: "bg-emerald-400" },
               { type: "Recyclables", percent: 25, color: "bg-blue-400" },
               { type: "Residual", percent: 10, color: "bg-red-400" }
             ].map((item, i) => (
               <div key={i}>
                 <div className="flex justify-between text-[10px] font-black uppercase mb-2 tracking-widest">
                   <span className="text-slate-400">{item.type}</span>
                   <span>{item.percent}%</span>
                 </div>
                 <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                   <div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                 </div>
               </div>
             ))}
           </div>
           <button className="mt-8 w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all">
             Full Breakdown Report
           </button>
        </div>
      </div>

      {/* --- LEADERBOARD & SYSTEM STATUS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Barangay Performance */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Barangay Efficiency</h3>
          <div className="space-y-4">
            {barangayPerformance.map((brgy, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-black text-slate-300">#0{i+1}</span>
                  <div>
                    <p className="text-sm font-black text-slate-800">Brgy. {brgy.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{brgy.weight}kg Collected</p>
                  </div>
                </div>
                <span className={`text-xs font-black ${brgy.growth > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {brgy.growth > 0 ? '↑' : '↓'} {Math.abs(brgy.growth)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Message Card */}
        <div className="bg-emerald-900 text-white p-8 rounded-[3rem] shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 bottom-0 p-8 opacity-20 text-9xl">🌿</div>
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
              <h3 className="text-xl font-black tracking-tight uppercase">System Status: Optimal</h3>
            </div>
            <p className="text-emerald-100/80 text-sm leading-relaxed max-w-sm">
              All 12 trucks are currently broadcasting GPS signals. Waste treatment facilities at San Jose and Santa Maria report 40% remaining capacity.
            </p>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
             <div>
               <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Next Route Dispatch</p>
               <p className="text-sm font-bold">In 45 minutes</p>
             </div>
             <button className="px-6 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
               View Schedule
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}