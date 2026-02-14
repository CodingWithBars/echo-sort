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
      lastCollection: "2026-02-14",
      truckId: "TRK-01"
    },
    { 
      name: "Santa Maria", weight: 850, status: "Normal", 
      topContributor: { name: "Maria Clara", amount: "32kg" },
      lastCollection: "2026-02-13",
      truckId: "TRK-05"
    },
    { 
      name: "Sto. Niño", weight: 400, status: "Low", 
      topContributor: { name: "Pedro Penduko", amount: "12kg" },
      lastCollection: "2026-02-14",
      truckId: "TRK-02"
    },
    { 
      name: "San Roque", weight: 920, status: "Normal", 
      topContributor: { name: "Elena Ramos", amount: "28kg" },
      lastCollection: "2026-02-12",
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
    <div className="space-y-6">
      
      {/* --- UNIFIED SEARCH & FILTERS (Violations Design Style) --- */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
          <input 
            type="text"
            placeholder="Search barangay..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all shadow-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Sorting Controls */}
        <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="px-3">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter By</span>
          </div>
          <select 
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <optgroup label="Alphabetical" className="font-sans font-bold">
              <option value="name-asc">Name (A - Z)</option>
              <option value="name-desc">Name (Z - A)</option>
            </optgroup>
            <optgroup label="Collection Weight" className="font-sans font-bold">
              <option value="weight-high">Weight: Highest</option>
              <option value="weight-low">Weight: Lowest</option>
            </optgroup>
            <optgroup label="Volume Status" className="font-sans font-bold">
              <option value="status-high">Status: High to Low</option>
              <option value="status-low">Status: Low to High</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* --- COLLECTION GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
        {filteredBarangays.map((brgy) => (
          <div key={brgy.name} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className={`h-2 w-full ${getStatusColor(brgy.status)}`} />
            
            <div className="p-6 pt-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-slate-50 text-slate-600 text-[9px] font-black px-3 py-1 rounded-full uppercase border border-slate-100">
                  {brgy.status} Volume
                </span>
                <span className="text-[10px] text-slate-300 font-mono font-bold">{brgy.truckId}</span>
              </div>
              
              <h3 className="font-black text-slate-900 text-xl tracking-tight mb-1 group-hover:text-emerald-600 transition-colors">
                Brgy. {brgy.name}
              </h3>
              
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-2xl font-black text-slate-900 leading-none">{brgy.weight}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">kg</span>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6 p-0.5 shadow-inner">
                <div 
                  className={`${getStatusColor(brgy.status)} h-full rounded-full transition-all duration-1000 ease-out`} 
                  style={{ width: `${Math.min((brgy.weight / 1500) * 100, 100)}%` }}
                />
              </div>
              
              <button 
                onClick={() => setSelectedBrgy(brgy)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[9px] font-black tracking-[0.2em] uppercase transition-all hover:bg-slate-800 active:scale-95"
              >
                View Analytics
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* --- MODAL / BOTTOM SHEET --- */}
      {selectedBrgy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedBrgy(null)}
          />
          
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500 ease-out">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden" />
            <div className={`h-2 w-full mt-4 sm:mt-0 ${getStatusColor(selectedBrgy.status)}`} />
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Collection Analytics</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Brgy. {selectedBrgy.name}</p>
                </div>
                <button onClick={() => setSelectedBrgy(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Current Weight</p>
                    <p className="text-xl font-black text-slate-900">{selectedBrgy.weight}kg</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Truck ID</p>
                    <p className="text-xl font-black text-slate-900">{selectedBrgy.truckId}</p>
                  </div>
                </div>

                <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 relative overflow-hidden">
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 text-5xl text-emerald-600">🏆</div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase mb-3 tracking-[0.15em]">Brgy. Top Contributor</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm font-black text-emerald-900 uppercase">{selectedBrgy.topContributor.name}</p>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">Highest Volume Participation</p>
                    </div>
                    <span className="text-xl font-black text-emerald-700 leading-none">{selectedBrgy.topContributor.amount}</span>
                  </div>
                </div>

                <div className="space-y-3">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Recent Activity</p>
                   <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                     <span className="text-xs font-bold text-slate-500 tracking-tight">Last Collection Log:</span>
                     <span className="text-xs font-black text-slate-800 uppercase">{selectedBrgy.lastCollection}</span>
                   </div>
                </div>

                <button 
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                  onClick={() => setSelectedBrgy(null)}
                >
                  Close Analytics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredBarangays.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 animate-in fade-in duration-500">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Barangays Match Search</p>
        </div>
      )}
    </div>
  );
}