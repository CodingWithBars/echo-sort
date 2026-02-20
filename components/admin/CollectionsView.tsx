"use client";

import { useState } from "react";

export default function CollectionsView() {
  const [filterBrgy, setFilterBrgy] = useState("all");

  const collections = [
    { id: "COL-8821", barangay: "San Jose", weight: 420, type: "Biodegradable", driver: "Ricardo Dalisay", time: "08:30 AM", status: "Completed" },
    { id: "COL-8822", barangay: "Santa Maria", weight: 310, type: "Recyclables", driver: "Maria Clara", time: "09:15 AM", status: "Completed" },
    { id: "COL-8823", barangay: "Sto. Niño", weight: 550, type: "Residual", driver: "Juan Luna", time: "10:05 AM", status: "In Progress" },
    { id: "COL-8824", barangay: "San Roque", weight: 280, type: "Biodegradable", driver: "Andres Bonifacio", time: "10:45 AM", status: "Completed" },
    { id: "COL-8825", barangay: "San Jose", weight: 190, type: "Recyclables", driver: "Ricardo Dalisay", time: "11:20 AM", status: "Completed" },
  ];

  const summary = [
    { label: "Daily Weight", value: "1.75T", icon: "⚖️", color: "text-emerald-600" },
    { label: "Active Trucks", value: "8/12", icon: "🚛", color: "text-blue-600" },
    { label: "Completed Trips", value: "24", icon: "✅", color: "text-purple-600" },
  ];

  const filtered = collections.filter(c => filterBrgy === "all" || c.barangay === filterBrgy);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* --- QUICK SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summary.map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shadow-inner">
              {item.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
              <p className={`text-2xl font-black ${item.color} tracking-tight`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* --- COLLECTION LOGS --- */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Collection Logs</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily Records • February 20, 2026</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {["All", "San Jose", "Santa Maria", "Sto. Niño"].map((b) => (
              <button
                key={b}
                onClick={() => setFilterBrgy(b.toLowerCase())}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                  filterBrgy === b.toLowerCase() 
                  ? "bg-white text-emerald-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Barangay & Type</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight (kg)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((log) => (
                <tr key={log.id} className="group hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-10 rounded-full ${
                        log.type === 'Biodegradable' ? 'bg-emerald-400' : 
                        log.type === 'Recyclables' ? 'bg-blue-400' : 'bg-orange-400'
                      }`} />
                      <div>
                        <p className="text-sm font-black text-slate-900">Brgy. {log.barangay}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{log.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-lg font-black text-slate-800 tracking-tighter">{log.weight}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">KG</span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-600">{log.driver}</p>
                    <p className="text-[9px] font-black text-slate-300 uppercase">{log.id}</p>
                  </td>
                  <td className="px-6 py-5 text-xs font-mono font-bold text-slate-500">
                    {log.time}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      log.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-8 border-t border-slate-50 flex justify-center">
          <button className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] hover:tracking-[0.3em] transition-all">
            Download Full Daily Report (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}