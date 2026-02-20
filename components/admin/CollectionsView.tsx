"use client";

import { useState, useEffect } from "react";

export default function CollectionsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedBrgy, setSelectedBrgy] = useState<any | null>(null);

  const barangayCollections = [
    { 
      name: "San Jose", weight: 1200, status: "High", 
      topContributor: { name: "Juan Dela Cruz", amount: "45kg" },
      lastCollection: "Feb 14, 2026",
      truckId: "TRK-01"
    },
    { 
      name: "Santa Maria", weight: 850, status: "Normal", 
      topContributor: { name: "Maria Clara", amount: "32kg" },
      lastCollection: "Feb 13, 2026",
      truckId: "TRK-05"
    },
    { 
      name: "Sto. Niño", weight: 400, status: "Low", 
      topContributor: { name: "Pedro Penduko", amount: "12kg" },
      lastCollection: "Feb 14, 2026",
      truckId: "TRK-02"
    },
    { 
      name: "San Roque", weight: 920, status: "Normal", 
      topContributor: { name: "Elena Ramos", amount: "28kg" },
      lastCollection: "Feb 12, 2026",
      truckId: "TRK-09"
    },
  ];

  useEffect(() => {
    if (selectedBrgy) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedBrgy]);

  const statusRank: Record<string, number> = { "High": 3, "Normal": 2, "Low": 1 };

  const filteredBarangays = barangayCollections
    .filter(brgy => brgy.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "weight-high": return b.weight - a.weight;
        case "weight-low": return a.weight - b.weight;
        case "status-high": return statusRank[b.status] - statusRank[a.status];
        case "status-low": return statusRank[a.status] - statusRank[b.status];
        default: return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'High': return 'bg-red-500';
      case 'Normal': return 'bg-emerald-500';
      default: return 'bg-amber-500';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* --- UNIFIED FILTER BAR --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
          <input 
            type="text"
            placeholder="Search barangay..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl md:rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="relative min-w-[180px]">
          <select 
            className="w-full appearance-none px-4 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-2xl outline-none cursor-pointer hover:bg-slate-800 transition-all shadow-lg"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <option value="name-asc">A - Z Name</option>
            <option value="weight-high">Highest Weight</option>
            <option value="weight-low">Lowest Weight</option>
            <option value="status-high">Critical Status</option>
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none text-[8px]">▼</span>
        </div>
      </div>

      {/* --- COLLECTION GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredBarangays.map((brgy) => (
          <div 
            key={brgy.name} 
            onClick={() => setSelectedBrgy(brgy)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col group overflow-hidden transition-all hover:border-emerald-200 active:scale-[0.98] cursor-pointer"
          >
            <div className={`h-1.5 w-full ${getStatusColor(brgy.status)}`} />
            
            <div className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                  brgy.status === 'High' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {brgy.status} Volume
                </span>
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-tighter">{brgy.truckId}</span>
              </div>
              
              <h3 className="font-black text-slate-900 text-lg tracking-tight mb-1">
                Brgy. {brgy.name}
              </h3>
              
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-black text-slate-900 leading-none tracking-tighter">{brgy.weight}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">kg Collected</span>
              </div>

              <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden mb-4 p-0.5 border border-slate-100">
                <div 
                  className={`${getStatusColor(brgy.status)} h-full rounded-full transition-all duration-700`} 
                  style={{ width: `${Math.min((brgy.weight / 1500) * 100, 100)}%` }}
                />
              </div>
              
              <div className="mt-auto flex justify-between items-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Last Sync: {brgy.lastCollection}</p>
                <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] group-hover:bg-emerald-600 group-hover:text-white transition-colors">→</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- DETAIL BOTTOM SHEET --- */}
      {selectedBrgy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedBrgy(null)} />
          
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500">
            <div className={`h-1.5 w-full ${getStatusColor(selectedBrgy.status)}`} />
            
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Collection Insights</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Brgy. {selectedBrgy.name} Data</p>
                </div>
                <button onClick={() => setSelectedBrgy(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-colors">✕</button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Weight</p>
                    <p className="text-xl font-black text-slate-900 tracking-tighter">{selectedBrgy.weight}kg</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Truck</p>
                    <p className="text-xl font-black text-slate-900 tracking-tighter">{selectedBrgy.truckId}</p>
                  </div>
                </div>

                <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center relative overflow-hidden">
                   <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-5xl">🏆</div>
                   <div className="relative z-10">
                    <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Top Contributor</p>
                    <p className="text-sm font-black text-emerald-900 uppercase">{selectedBrgy.topContributor.name}</p>
                   </div>
                   <div className="text-right relative z-10">
                    <p className="text-lg font-black text-emerald-700 leading-none">{selectedBrgy.topContributor.amount}</p>
                    <p className="text-[8px] font-bold text-emerald-600 uppercase">Volume</p>
                   </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Recorded Collection</span>
                  <span className="text-xs font-bold text-slate-800">{selectedBrgy.lastCollection}</span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-50 transition-all active:scale-95">
                    Download Log
                  </button>
                  <button className="flex-[1.5] py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-95">
                    Dispatch Collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredBarangays.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-100">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No barangays found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}