"use client";

import { useState, useEffect } from "react";

// 1. Define the Prop interface so TypeScript recognizes onEditProfile
interface CitizenRegistryProps {
  onEditProfile: (citizen: any) => void;
}

export default function CitizenRegistry({ onEditProfile }: CitizenRegistryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBrgy, setFilterBrgy] = useState("All");
  const [selectedCitizen, setSelectedCitizen] = useState<any | null>(null);

  const citizens = [
    {
      id: "C-101",
      name: "Juan Dela Cruz",
      barangay: "San Jose",
      violations: 0,
      joined: "May 2025",
      email: "juan.dc@email.com",
    },
    {
      id: "C-102",
      name: "Elena Ramos",
      barangay: "Sto. Niño",
      violations: 2,
      joined: "Aug 2025",
      email: "elena.r@email.com",
    },
    {
      id: "C-103",
      name: "Mateo Silva",
      barangay: "Santa Maria",
      violations: 1,
      joined: "Jan 2026",
      email: "mateo.s@email.com",
    },
    {
      id: "C-104",
      name: "Ricardo Cruz",
      barangay: "San Jose",
      violations: 3,
      joined: "Nov 2025",
      email: "rcruz@email.com",
    },
  ];

  useEffect(() => {
    if (selectedCitizen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedCitizen]);

  const filtered = citizens.filter(
    (c) =>
      (filterBrgy === "All" || c.barangay === filterBrgy) &&
      (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* --- FILTER BAR --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search citizen or ID..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl md:rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative min-w-[160px]">
          <select
            value={filterBrgy}
            onChange={(e) => setFilterBrgy(e.target.value)}
            className="w-full appearance-none px-4 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-2xl outline-none cursor-pointer hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <option value="All">All Barangays</option>
            <option value="San Jose">San Jose</option>
            <option value="Santa Maria">Santa Maria</option>
            <option value="Sto. Niño">Sto. Niño</option>
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none text-[8px]">
            ▼
          </span>
        </div>
      </div>

      {/* --- REGISTRY TABLE --- */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/30">
                <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resident</th>
                <th className="hidden md:table-cell px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Barangay</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance</th>
                <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((citizen) => (
                <tr key={citizen.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 md:px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs border border-white shadow-sm">👤</div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-tight">{citizen.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{citizen.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <span className="text-xs font-bold text-slate-600">Brgy. {citizen.barangay}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${citizen.violations > 2 ? "bg-red-500" : citizen.violations > 0 ? "bg-amber-500" : "bg-emerald-500"} animate-pulse`} />
                      <span className={`text-[10px] font-black ${citizen.violations > 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {citizen.violations} {citizen.violations === 1 ? "Violation" : "Violations"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 md:px-8 py-4 text-right">
                    <button
                      onClick={() => setSelectedCitizen(citizen)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-lg md:rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL --- */}
      {selectedCitizen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedCitizen(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500 ease-out">
            <div className={`h-1.5 w-full ${selectedCitizen.violations > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center text-2xl border border-slate-100">👤</div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">{selectedCitizen.name}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedCitizen.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCitizen(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all active:scale-90">✕</button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Barangay</p>
                    <p className="text-xs font-bold text-slate-800">{selectedCitizen.barangay}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Join Date</p>
                    <p className="text-xs font-bold text-slate-800">{selectedCitizen.joined}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Email Address</p>
                    <p className="text-xs font-bold text-slate-800">{selectedCitizen.email}</p>
                  </div>
                  <span className="text-lg opacity-40">✉️</span>
                </div>

                <div className={`p-5 rounded-xl border ${selectedCitizen.violations > 0 ? "bg-red-50/50 border-red-100" : "bg-emerald-50/50 border-emerald-100"}`}>
                  <p className={`text-[10px] font-black uppercase mb-1 tracking-widest ${selectedCitizen.violations > 0 ? "text-red-700" : "text-emerald-700"}`}>Compliance Summary</p>
                  <p className={`text-sm font-black tracking-tight ${selectedCitizen.violations > 0 ? "text-red-900" : "text-emerald-900"}`}>
                    {selectedCitizen.violations === 0 ? "✓ Registered Eco-Champion" : `⚠️ ${selectedCitizen.violations} Violations Tracked`}
                  </p>
                </div>

                {/* --- CONNECTED ACTION BUTTONS --- */}
                <div className="flex gap-3 pt-2">
                  <button
                    className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-50 transition-all active:scale-95"
                    onClick={() => {
                      onEditProfile(selectedCitizen); // 2. Trigger the navigation prop
                      setSelectedCitizen(null);        // 3. Close the modal
                    }}
                  >
                    Edit Profile
                  </button>
                  <button className="flex-[1.5] py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-95">
                    Contact Citizen
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