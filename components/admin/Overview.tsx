"use client";

import React from "react";

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* --- KPI HERO GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="group bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 transition-all hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1"
          >
            <div className="flex justify-between items-start">
              <div className={`text-2xl w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                {stat.icon}
              </div>
              <span className={`text-[9px] font-black px-3 py-1.5 rounded-full tracking-wider uppercase ${
                stat.trend.includes('+') 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : stat.trend.includes('-') 
                    ? 'bg-orange-50 text-orange-600' 
                    : 'bg-red-50 text-red-600'
              }`}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mb-1">{stat.label}</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* --- ANALYTICS SECTION --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Weekly Collection Chart */}
        <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Collection Trends</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily Metric Tons • Real-time Data</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">Live Network</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-end justify-between h-56 gap-3 px-2">
            {[45, 60, 35, 80, 55, 90, 70].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                <div 
                  className="w-full bg-slate-50 rounded-2xl transition-all duration-500 ease-out group-hover:bg-emerald-50 flex items-end overflow-hidden"
                  style={{ height: `100%` }}
                >
                  <div 
                    className="w-full bg-emerald-500/10 group-hover:bg-emerald-500 rounded-2xl transition-all duration-700 delay-100"
                    style={{ height: `${val}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Day {i+1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waste Composition Card */}
        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-[-20px] right-[-20px] text-[10rem] font-black text-white/[0.03] select-none">
            RE
          </div>
          <h3 className="text-2xl font-black mb-8 tracking-tight relative z-10">Waste Breakdown</h3>
          <div className="space-y-7 relative z-10 flex-1">
            {[
              { type: "Biodegradable", percent: 65, color: "bg-emerald-400", sub: "Food & Organic" },
              { type: "Recyclables", percent: 25, color: "bg-blue-400", sub: "Plastics & Paper" },
              { type: "Residual", percent: 10, color: "bg-red-400", sub: "Non-recyclable" }
            ].map((item, i) => (
              <div key={i} className="group cursor-default">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-white">{item.type}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{item.sub}</p>
                  </div>
                  <span className="text-lg font-black text-emerald-400">{item.percent}%</span>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-1000 group-hover:brightness-125`} 
                    style={{ width: `${item.percent}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
          <button className="mt-10 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-95">
            Analyze Full Report
          </button>
        </div>
      </div>

      {/* --- LEADERBOARD & SYSTEM STATUS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Barangay Performance */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Barangay Efficiency</h3>
            <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {barangayPerformance.map((brgy, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 group hover:bg-white hover:shadow-lg hover:shadow-slate-100 hover:border-emerald-100 transition-all">
                <div className="flex items-center gap-5">
                  <span className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-xs font-black text-slate-400 group-hover:text-emerald-500 transition-colors">
                    {i+1}
                  </span>
                  <div>
                    <p className="text-md font-black text-slate-900">Brgy. {brgy.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{brgy.weight.toLocaleString()}kg Collected</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-black px-3 py-1 rounded-lg ${brgy.growth > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {brgy.growth > 0 ? '↑' : '↓'} {Math.abs(brgy.growth)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Message Card */}
        <div className="bg-emerald-900 text-white p-10 rounded-[3rem] shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-[-40px] bottom-[-40px] p-8 opacity-10 text-[15rem] select-none rotate-12">🌿</div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
              <h3 className="text-2xl font-black tracking-tight uppercase tracking-tighter">Network: Operational</h3>
            </div>
            <p className="text-emerald-100/70 text-base leading-relaxed max-w-sm font-medium">
              All <span className="text-white font-black">12 trucks</span> are broadcasting active GPS signals. Facility storage at San Jose and Santa Maria are currently at <span className="text-emerald-400 font-black">40% capacity</span>.
            </p>
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-center relative z-10">
              <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">Next Dispatch Cycle</p>
                <p className="text-xl font-black text-white tracking-tight">T-Minus 45m</p>
              </div>
              <button className="px-8 py-4 bg-emerald-800 hover:bg-emerald-700 border border-emerald-700/50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95">
                Manage Fleet
              </button>
          </div>
        </div>

      </div>
    </div>
  );
}