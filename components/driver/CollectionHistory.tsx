"use client";

import React, { useState } from "react";

export default function CollectionHistory() {
  const [barangays, setBarangays] = useState([
    { id: 1, name: "Barangay San Jose", time: "08:15 AM", status: "completed" },
    { id: 2, name: "Barangay Sto. Niño", time: "09:45 AM", status: "completed" },
    { id: 3, name: "Barangay Santa Maria", time: "Pending", status: "pending" },
    { id: 4, name: "Barangay San Pedro", time: "Pending", status: "pending" },
    { id: 5, name: "Barangay Maligaya", time: "Pending", status: "pending" },
  ]);

  const toggleStatus = (id: number) => {
    setBarangays(prev => prev.map(b => {
      if (b.id === id) {
        const isPending = b.status === "pending";
        return {
          ...b,
          status: isPending ? "completed" : "pending",
          time: isPending ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Pending"
        };
      }
      return b;
    }));
  };

  const completedCount = barangays.filter(b => b.status === "completed").length;
  const progressPercentage = (completedCount / barangays.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* --- PROGRESS SUMMARY CARD --- */}
      <div className="bg-emerald-600 rounded-[3rem] p-10 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] text-[10rem] opacity-10 rotate-12 pointer-events-none">🚛</div>
        
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Current Route Progress</p>
          <div className="flex items-end gap-4 mb-6">
            <h3 className="text-6xl font-black tracking-tighter">{completedCount}</h3>
            <p className="text-xl font-bold opacity-60 mb-2">/ {barangays.length} Barangays</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-1000 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-emerald-100">
            {progressPercentage === 100 ? "Route Completed! Return to Depot." : "Finish all zones to complete shift"}
          </p>
        </div>
      </div>

      {/* --- CHECKLIST SECTION --- */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 mb-2">Route Checklist</h4>
        
        {barangays.map((barangay) => (
          <div 
            key={barangay.id}
            onClick={() => toggleStatus(barangay.id)}
            className={`
              group cursor-pointer p-6 rounded-[2.5rem] border transition-all duration-300 flex items-center justify-between
              ${barangay.status === "completed" 
                ? "bg-white border-emerald-100 shadow-sm opacity-70" 
                : "bg-white border-slate-100 shadow-md hover:border-emerald-300 hover:scale-[1.02] active:scale-95"}
            `}
          >
            <div className="flex items-center gap-6">
              {/* Custom Checkbox */}
              <div className={`
                w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-500
                ${barangay.status === "completed" 
                  ? "bg-emerald-500 text-white rotate-[360deg]" 
                  : "bg-slate-50 text-slate-300 group-hover:bg-emerald-50"}
              `}>
                {barangay.status === "completed" ? "✓" : "○"}
              </div>

              <div>
                <h5 className={`text-lg font-black tracking-tight transition-colors ${barangay.status === "completed" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {barangay.name}
                </h5>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${barangay.status === "completed" ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {barangay.status === "completed" ? `Collected at ${barangay.time}` : "Awaiting Collection"}
                  </p>
                </div>
              </div>
            </div>

            <div className={`text-2xl transition-opacity ${barangay.status === "completed" ? "opacity-100" : "opacity-0 group-hover:opacity-30"}`}>
              🚛
            </div>
          </div>
        ))}
      </div>

      {/* --- FOOTER ACTION --- */}
      {progressPercentage === 100 && (
        <button 
          className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl animate-in zoom-in-95"
          onClick={() => alert("Route Data Synced with Central Office")}
        >
          Submit Final Route Report
        </button>
      )}
    </div>
  );
}