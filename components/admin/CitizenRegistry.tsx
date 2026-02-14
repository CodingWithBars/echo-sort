"use client";

import { useState, useEffect } from "react";

export default function CitizenRegistry() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedCitizen, setSelectedCitizen] = useState<any | null>(null);

  const citizens = [
    {
      id: "C-101",
      name: "Juan Dela Cruz",
      barangay: "San Jose",
      violations: 0,
      joinedDate: "2025-05-12",
      email: "juan.dc@email.com",
    },
    {
      id: "C-102",
      name: "Elena Ramos",
      barangay: "Sto. Niño",
      violations: 2,
      joinedDate: "2025-08-20",
      email: "elena.r@email.com",
    },
    {
      id: "C-103",
      name: "Mateo Silva",
      barangay: "Santa Maria",
      violations: 1,
      joinedDate: "2026-01-05",
      email: "mateo.s@email.com",
    },
    {
      id: "C-104",
      name: "Ricardo Cruz",
      barangay: "San Jose",
      violations: 3,
      joinedDate: "2025-11-30",
      email: "rcruz@email.com",
    },
  ];

  useEffect(() => {
    if (selectedCitizen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedCitizen]);

  const filteredCitizens = citizens
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.barangay.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "violations-high":
          return b.violations - a.violations;
        case "violations-low":
          return a.violations - b.violations;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* --- UNIFIED SEARCH & FILTERS (Style copied from ViolationsView) --- */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Styled Search Bar */}
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            🔍
          </span>
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
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Sort By
            </span>
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
          <div
            key={citizen.id}
            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50"
          >
            <div
              className={`h-2 w-full ${citizen.violations > 2 ? "bg-red-500" : citizen.violations > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
            />

            <div className="p-6 pt-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-slate-50 text-slate-600 text-[9px] font-black px-3 py-1 rounded-full uppercase border border-slate-100">
                  {citizen.barangay}
                </span>
                <span className="text-[10px] text-slate-300 font-mono font-bold">
                  {citizen.id}
                </span>
              </div>

              <h3 className="font-black text-slate-900 text-xl tracking-tight mb-4 group-hover:text-emerald-600 transition-colors">
                {citizen.name}
              </h3>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                  Total Violations
                </span>
                <span
                  className={`text-sm font-black ${citizen.violations > 0 ? "text-red-500" : "text-emerald-500"}`}
                >
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
          {/* Backdrop with Fade-in */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500"
            onClick={() => setSelectedCitizen(null)}
          />

          {/* Modal Content with Bottom Slide-in for Mobile */}
          <div
            className={`
      relative w-full max-w-lg bg-white shadow-2xl overflow-hidden
      /* Mobile Styles: Slide from bottom */
      rounded-t-[3rem] animate-in slide-in-from-bottom-full duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
      /* Tablet/Desktop Styles: Zoom/Slide subtly */
      sm:rounded-[3rem] sm:slide-in-from-bottom-8 sm:zoom-in-95
    `}
          >
            {/* Visual Grabber for Mobile Bottom Sheet */}
            <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden mb-2" />

            {/* Decorative Status Bar */}
            <div
              className={`h-2 w-full ${selectedCitizen.violations > 0 ? "bg-red-500" : "bg-emerald-500"}`}
            />

            <div className="p-8 pt-6 sm:pt-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl shadow-inner border border-emerald-100/50">
                    👤
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight">
                      {selectedCitizen.name}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      Registry ID: {selectedCitizen.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCitizen(null)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-90"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                      Barangay
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedCitizen.barangay}
                    </p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                      Registry Date
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedCitizen.joinedDate}
                    </p>
                  </div>
                </div>

                {/* Contact Card */}
                <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex justify-between items-center group hover:bg-white transition-colors">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                      Email Address
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedCitizen.email}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                    ✉️
                  </div>
                </div>

                {/* Compliance Status Card */}
                <div
                  className={`
            p-6 rounded-[2.5rem] border relative overflow-hidden transition-all
            ${
              selectedCitizen.violations > 0
                ? "bg-red-50 border-red-100"
                : "bg-emerald-50 border-emerald-100 shadow-lg shadow-emerald-100/20"
            }
          `}
                >
                  <div className="absolute right-[-15px] top-[-15px] opacity-10 text-7xl rotate-12">
                    {selectedCitizen.violations > 0 ? "⚠️" : "🏆"}
                  </div>

                  <p
                    className={`text-[10px] font-black uppercase mb-3 tracking-[0.2em] ${selectedCitizen.violations > 0 ? "text-red-700" : "text-emerald-700"}`}
                  >
                    Compliance Performance
                  </p>

                  <div className="flex justify-between items-center">
                    <div>
                      <p
                        className={`text-lg font-black tracking-tight ${selectedCitizen.violations > 0 ? "text-red-900" : "text-emerald-900"}`}
                      >
                        {selectedCitizen.violations === 0
                          ? "Eco-Champion"
                          : `${selectedCitizen.violations} Violations Found`}
                      </p>
                      <p
                        className={`text-[10px] font-bold uppercase mt-1 ${selectedCitizen.violations > 0 ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {selectedCitizen.violations === 0
                          ? "Top 5% of residents"
                          : "Requires waste seg. training"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] tracking-[0.3em] uppercase shadow-xl shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-[0.98] mt-4"
                  onClick={() => setSelectedCitizen(null)}
                >
                  Back to Registry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
