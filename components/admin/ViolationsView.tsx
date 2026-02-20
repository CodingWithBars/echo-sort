"use client";

import { useState, useEffect } from "react";

export default function ViolationsView() {
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedViolation, setSelectedViolation] = useState<any | null>(null);

  const violations = [
    { 
      id: "V-901", 
      barangay: "San Jose", 
      type: "Improper Segregation", 
      date: "Feb 14, 2026", 
      status: "Pending",
      involvedCitizen: "Ricardo Cruz",
      description: "Mixed biodegradable with plastic recyclables. Second warning for this household.",
      brgyTopContributor: { name: "Juan Dela Cruz", amount: "45kg" }
    },
    { 
      id: "V-902", 
      barangay: "Santa Maria", 
      type: "Late Collection", 
      date: "Feb 13, 2026", 
      status: "Resolved",
      involvedCitizen: "Liza Soberano",
      description: "Trash bins left out 4 hours after the truck passed. Resident informed of schedule.",
      brgyTopContributor: { name: "Maria Clara", amount: "32kg" }
    },
    { 
      id: "V-903", 
      barangay: "Sto. Niño", 
      type: "Illegal Dumping", 
      date: "Feb 12, 2026", 
      status: "Under Review",
      involvedCitizen: "Unknown (CCTV Footage)",
      description: "Commercial waste dumped at a residential collection point. Identifying vehicle plate.",
      brgyTopContributor: { name: "Pedro Penduko", amount: "12kg" }
    },
  ];

  useEffect(() => {
    if (selectedViolation) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedViolation]);

  const filteredViolations = violations.filter(v => {
    const matchesStatus = filterStatus === "All" || v.status === filterStatus;
    const matchesSearch = v.barangay.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.involvedCitizen.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved': return 'bg-emerald-500 text-emerald-600';
      case 'Under Review': return 'bg-amber-500 text-amber-600';
      default: return 'bg-red-500 text-red-600';
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
            placeholder="Search barangay or citizen..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl md:rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl md:rounded-2xl overflow-x-auto scrollbar-hide">
          {["All", "Pending", "Resolved"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg md:rounded-xl text-[9px] font-black transition-all uppercase tracking-widest whitespace-nowrap ${
                filterStatus === status 
                  ? "bg-slate-900 text-white shadow-lg" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* --- VIOLATION GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredViolations.map((v) => (
          <div 
            key={v.id} 
            onClick={() => setSelectedViolation(v)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col group overflow-hidden transition-all hover:border-red-200 active:scale-[0.98] cursor-pointer"
          >
            <div className={`h-1.5 w-full ${getStatusColor(v.status).split(' ')[0]}`} />
            
            <div className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider bg-opacity-10 ${getStatusColor(v.status)} bg-current`}>
                  {v.status}
                </span>
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase">{v.id}</span>
              </div>
              
              <h3 className="font-black text-slate-900 text-lg tracking-tight mb-1">
                Brgy. {v.barangay}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">{v.type}</p>
              
              <div className="mt-auto flex justify-between items-center">
                <div>
                  <p className="text-[8px] font-black text-slate-300 uppercase">Reported By</p>
                  <p className="text-[10px] font-bold text-slate-700">{v.involvedCitizen}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs group-hover:bg-red-50 group-hover:text-red-600 transition-colors">⚠️</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- DETAIL BOTTOM SHEET --- */}
      {selectedViolation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedViolation(null)} />
          
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
            <div className={`h-1.5 w-full ${getStatusColor(selectedViolation.status).split(' ')[0]}`} />
            
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Incident Report</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedViolation.id} • {selectedViolation.date}</p>
                </div>
                <button onClick={() => setSelectedViolation(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-colors">✕</button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Barangay</p>
                    <p className="text-xs font-bold text-slate-800 uppercase">{selectedViolation.barangay}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Violation Type</p>
                    <p className="text-xs font-bold text-slate-800 uppercase">{selectedViolation.type}</p>
                  </div>
                </div>

                <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black text-red-700 uppercase mb-1">Primary Subject</p>
                    <p className="text-sm font-black text-red-900">{selectedViolation.involvedCitizen}</p>
                  </div>
                  <span className="text-lg">🆔</span>
                </div>

                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Incident Description</p>
                  <p className="text-xs text-slate-600 leading-relaxed italic">"{selectedViolation.description}"</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-50 transition-all active:scale-95">
                    Issue Warning
                  </button>
                  <button className="flex-[1.5] py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95">
                    Mark as Resolved
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}