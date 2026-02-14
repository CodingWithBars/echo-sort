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
      date: "2026-02-14", 
      status: "Pending",
      involvedCitizen: "Ricardo Cruz",
      description: "Mixed biodegradable with plastic recyclables. Second warning for this household.",
      brgyTopContributor: { name: "Juan Dela Cruz", amount: "45kg" }
    },
    { 
      id: "V-902", 
      barangay: "Santa Maria", 
      type: "Outside Collection Hours", 
      date: "2026-02-13", 
      status: "Resolved",
      involvedCitizen: "Liza Soberano",
      description: "Trash bins left out 4 hours after the truck passed. Resident informed of schedule.",
      brgyTopContributor: { name: "Maria Clara", amount: "32kg" }
    },
    { 
      id: "V-903", 
      barangay: "Sto. Niño", 
      type: "Illegal Dumping", 
      date: "2026-02-12", 
      status: "Under Review",
      involvedCitizen: "Unknown (CCTV Footage)",
      description: "Commercial waste dumped at a residential collection point. Identifying vehicle plate.",
      brgyTopContributor: { name: "Pedro Penduko", amount: "12kg" }
    },
  ];

  // Prevent scrolling when modal is open
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
      case 'Resolved': return 'bg-emerald-500';
      case 'Under Review': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* --- TOP CONTROLS --- */}
      <div className="flex flex-col xl:flex-row gap-4">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
          <input 
            type="text"
            placeholder="Search Barangay or Citizen..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all shadow-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 sm:flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          {["All", "Pending", "Under Review", "Resolved"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider ${
                filterStatus === status 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* --- VIOLATION GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredViolations.map((v) => (
          <div key={v.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group relative overflow-hidden transition-transform active:scale-[0.98]">
            <div className={`h-2 w-full ${getStatusColor(v.status)}`} />
            <div className="p-6 pt-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-slate-50 text-slate-600 text-[9px] font-black px-3 py-1 rounded-full uppercase border border-slate-100">{v.type}</span>
                <span className="text-[10px] text-slate-300 font-mono font-bold">{v.id}</span>
              </div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight mb-1">Brgy. {v.barangay}</h3>
              <p className="text-[10px] text-slate-400 font-bold mb-6 uppercase">Reported: {v.date}</p>
              
              <div className="mt-auto flex gap-2 pt-2">
                <button 
                  onClick={() => setSelectedViolation(v)}
                  className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all hover:bg-slate-800"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- MOBILE-FRIENDLY POPUP / BOTTOM SHEET --- */}
      {selectedViolation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedViolation(null)}
          />
          
          {/* Content Container */}
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500 ease-out">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden" />
            
            <div className={`h-2 w-full mt-4 sm:mt-0 ${getStatusColor(selectedViolation.status)}`} />
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Case Report</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedViolation.id} • {selectedViolation.date}</p>
                </div>
                <button 
                  onClick={() => setSelectedViolation(null)}
                  className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Barangay</p>
                    <p className="text-sm font-bold text-slate-800">{selectedViolation.barangay}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedViolation.status)}`} />
                      <p className="text-sm font-bold text-slate-800">{selectedViolation.status}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Involved Citizen</p>
                  <p className="text-sm font-bold text-slate-800 bg-red-50/50 px-4 py-3 rounded-xl border border-red-100/50">
                    {selectedViolation.involvedCitizen}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl italic">
                    "{selectedViolation.description}"
                  </p>
                </div>

                <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 relative overflow-hidden">
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 text-5xl">♻️</div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase mb-2">Barangay Analytics</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Top Contributor</p>
                      <p className="text-sm font-black text-emerald-900">{selectedViolation.brgyTopContributor.name}</p>
                    </div>
                    <span className="text-lg font-black text-emerald-600">{selectedViolation.brgyTopContributor.amount}</span>
                  </div>
                </div>

                <button 
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                  onClick={() => setSelectedViolation(null)}
                >
                  Mark as Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}