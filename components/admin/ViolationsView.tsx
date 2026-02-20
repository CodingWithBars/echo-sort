"use client";

import { useState } from "react";

export default function ViolationsView() {
  const [filter, setFilter] = useState("all");

  const violations = [
    { 
      id: "V-9012", 
      citizen: "Juan Dela Cruz", 
      type: "Illegal Dumping", 
      location: "San Jose, Purok 4", 
      date: "Feb 20, 2026", 
      time: "02:15 PM", 
      status: "Urgent",
      evidence: "📸 View Photo"
    },
    { 
      id: "V-9013", 
      citizen: "Pedro Penduko", 
      type: "Improper Segregation", 
      location: "Santa Maria, Main St.", 
      date: "Feb 20, 2026", 
      time: "11:30 AM", 
      status: "Pending",
      evidence: "📸 View Photo"
    },
    { 
      id: "V-9014", 
      citizen: "Maria Makiling", 
      type: "Burning Waste", 
      location: "Sto. Niño, Riverside", 
      date: "Feb 19, 2026", 
      time: "04:50 PM", 
      status: "Resolved",
      evidence: "📸 View Photo"
    },
  ];

  const filtered = violations.filter(v => filter === "all" || v.status.toLowerCase() === filter);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* --- HEADER CONTROLS --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
          {["All", "Urgent", "Pending", "Resolved"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab.toLowerCase())}
              className={`px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === tab.toLowerCase()
                  ? "bg-red-500 text-white shadow-lg shadow-red-100"
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 px-6 py-4 bg-orange-50 border border-orange-100 rounded-2xl">
          <span className="animate-bounce">🔔</span>
          <p className="text-[10px] font-black text-orange-700 uppercase tracking-tight">
            3 New Reports requiring immediate review
          </p>
        </div>
      </div>

      {/* --- VIOLATIONS LIST --- */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((v) => (
          <div 
            key={v.id} 
            className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-center">
              
              {/* STATUS & ID SECTION */}
              <div className={`lg:w-48 p-8 flex flex-col justify-center items-center text-center border-b lg:border-b-0 lg:border-r border-slate-50 ${
                v.status === 'Urgent' ? 'bg-red-50/30' : v.status === 'Resolved' ? 'bg-emerald-50/30' : 'bg-slate-50/30'
              }`}>
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 ${
                  v.status === 'Urgent' ? 'bg-red-500 text-white' : 
                  v.status === 'Resolved' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
                }`}>
                  {v.status}
                </span>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{v.id}</p>
              </div>

              {/* MAIN INFO */}
              <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Violation Type</p>
                  <h4 className="text-lg font-black text-slate-900 tracking-tight">{v.type}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs">👤</span>
                    <span className="text-xs font-bold text-slate-600">{v.citizen}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location & Time</p>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-emerald-500">📍</span> {v.location}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                    {v.date} • {v.time}
                  </p>
                </div>

                <button className="flex items-center justify-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl group-hover:bg-white group-hover:border-emerald-200 transition-all">
                  <span className="text-xl">🖼️</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Evidence Photo</span>
                </button>
              </div>

              {/* ACTIONS */}
              <div className="p-8 bg-slate-50/50 flex lg:flex-col gap-3 justify-center border-t lg:border-t-0 lg:border-l border-slate-100">
                <button className="flex-1 lg:w-32 py-3 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                  Resolve
                </button>
                <button className="flex-1 lg:w-32 py-3 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- EMPTY STATE --- */}
      {filtered.length === 0 && (
        <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
          <span className="text-5xl block mb-4">✨</span>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">All Clear</h3>
          <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">No {filter} violations found in the system</p>
        </div>
      )}
    </div>
  );
}