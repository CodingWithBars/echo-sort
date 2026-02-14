"use client";

import { useState, useEffect } from "react";

export default function CitizenRegistry() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedCitizen, setSelectedCitizen] = useState<any | null>(null);

  const citizens = [
    { id: "C-101", name: "Juan Dela Cruz", barangay: "San Jose", violations: 0, joinedDate: "2025-05-12", email: "juan.dc@email.com" },
    { id: "C-102", name: "Elena Ramos", barangay: "Sto. Niño", violations: 2, joinedDate: "2025-08-20", email: "elena.r@email.com" },
    { id: "C-103", name: "Mateo Silva", barangay: "Santa Maria", violations: 1, joinedDate: "2026-01-05", email: "mateo.s@email.com" },
    { id: "C-104", name: "Ricardo Cruz", barangay: "San Jose", violations: 3, joinedDate: "2025-11-30", email: "rcruz@email.com" },
  ];

  useEffect(() => {
    if (selectedCitizen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedCitizen]);

  const filteredCitizens = citizens
    .filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.barangay.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "violations-high": return b.violations - a.violations;
        case "violations-low": return a.violations - b.violations;
        default: return 0;
      }
    });

  return (
    <div className="space-y-6">
      
      {/* --- UNIFIED SEARCH & FILTERS (Style copied from ViolationsView) --- */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Styled Search Bar */}
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
          <input 
            type="text"
            placeholder="Search citizen or barangay..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all shadow-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Styled Sorting Controls */}
        <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="px-3">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</span>
          </div>
          <select 
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <optgroup label="Alphabetical" className="font-sans font-bold">
              <option value="name-asc">Name: A - Z</option>
              <option value="name-desc">Name: Z - A</option>
            </optgroup>
            <optgroup label="Record Status" className="font-sans font-bold">
              <option value="violations-high">Most Violations</option>
              <option value="violations-low">Fewest Violations</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* --- CITIZEN GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
        {filteredCitizens.map((citizen) => (
          <div key={citizen.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className={`h-2 w-full ${citizen.violations > 2 ? 'bg-red-500' : citizen.violations > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            
            <div className="p-6 pt-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-slate-50 text-slate-600 text-[9px] font-black px-3 py-1 rounded-full uppercase border border-slate-100">
                  {citizen.barangay}
                </span>
                <span className="text-[10px] text-slate-300 font-mono font-bold">{citizen.id}</span>
              </div>
              
              <h3 className="font-black text-slate-900 text-xl tracking-tight mb-4 group-hover:text-emerald-600 transition-colors">
                {citizen.name}
              </h3>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Total Violations</span>
                <span className={`text-sm font-black ${citizen.violations > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {citizen.violations}
                </span>
              </div>
              
              <button 
                onClick={() => setSelectedCitizen(citizen)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[9px] font-black tracking-[0.2em] uppercase transition-all hover:bg-slate-800 active:scale-95"
              >
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* --- PROFILE MODAL / BOTTOM SHEET --- */}
      {selectedCitizen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedCitizen(null)}
          />
          
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500 ease-out">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden" />
            <div className={`h-2 w-full mt-4 sm:mt-0 ${selectedCitizen.violations > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl shadow-inner">👤</div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{selectedCitizen.name}</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedCitizen.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCitizen(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Barangay</p>
                    <p className="text-sm font-bold text-slate-800">{selectedCitizen.barangay}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Registry Date</p>
                    <p className="text-sm font-bold text-slate-800">{selectedCitizen.joinedDate}</p>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Contact Details</p>
                    <p className="text-sm font-bold text-slate-800">{selectedCitizen.email}</p>
                  </div>
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">✉️</div>
                </div>

                <div className={`p-5 rounded-[2rem] border relative overflow-hidden ${selectedCitizen.violations > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 text-5xl">{selectedCitizen.violations > 0 ? '⚠️' : '✅'}</div>
                  <p className={`text-[10px] font-black uppercase mb-3 tracking-[0.15em] ${selectedCitizen.violations > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    Waste Compliance Record
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className={`text-sm font-black uppercase ${selectedCitizen.violations > 0 ? 'text-red-900' : 'text-emerald-900'}`}>
                        {selectedCitizen.violations === 0 ? 'Good Standing' : `${selectedCitizen.violations} Violations Tracked`}
                      </p>
                      <p className={`text-[10px] font-bold uppercase tracking-tight ${selectedCitizen.violations > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {selectedCitizen.violations === 0 ? 'Elite Recycler Award' : 'Needs Schedule Orientation'}
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                  onClick={() => setSelectedCitizen(null)}
                >
                  Close Registry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}