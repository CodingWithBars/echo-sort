"use client";

import React from "react";

/**
 * TruckStatus Component
 * High-glanceability dashboard for vehicle vitals
 * Part of the EcoRoute Driver Portal
 */
export default function TruckStatus() {
  const stats = [
    { label: "Fuel Level", value: 78, unit: "%", icon: "⛽", color: "text-emerald-500" },
    { label: "Oil Life", value: 92, unit: "%", icon: "🛢️", color: "text-emerald-500" },
    { label: "Tire Pressure", value: 32, unit: "PSI", icon: "🎡", color: "text-blue-500" },
    { label: "Battery", value: 14.2, unit: "V", icon: "⚡", color: "text-amber-500" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* --- MAIN GAUGES GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center group hover:shadow-xl hover:shadow-slate-200/50 transition-all"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
              {stat.label}
            </p>
            
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Circular Progress SVG */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-slate-50"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={364.4}
                  strokeDashoffset={364.4 - (364.4 * (stat.label === "Battery" ? (stat.value / 16) : stat.value)) / 100}
                  className={`${stat.color} transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{stat.unit}</span>
              </div>
            </div>
            
            <div className="mt-6 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* --- MAINTENANCE & REPORTING SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Maintenance Schedule Card */}
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute right-[-20px] top-[-20px] text-[12rem] opacity-10 rotate-12 pointer-events-none">
            🛠️
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-black tracking-tight mb-2">Maintenance Schedule</h3>
            <p className="text-slate-400 text-sm font-medium mb-8 max-w-md">
              Your vehicle is in optimal condition. The next scheduled maintenance check is in 1,240 km.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Last Service</p>
                <p className="text-xs font-bold">Jan 15, 2026</p>
              </div>
              <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-[9px] font-black uppercase text-amber-400 mb-1">Brake Wear</p>
                <p className="text-xs font-bold">Good (85%)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown Reporting Card */}
        <div className="bg-white rounded-[3rem] p-8 border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center text-3xl mb-4 shadow-inner">
            🚨
          </div>
          <h4 className="text-lg font-black text-slate-900 tracking-tight">Issue Found?</h4>
          <p className="text-xs text-slate-400 font-medium mb-6 px-4">
            Instantly alert the maintenance team if you notice any vehicle issues.
          </p>
          <button 
            className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-100"
            onClick={() => alert("Maintenance team has been notified.")}
          >
            Report Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}