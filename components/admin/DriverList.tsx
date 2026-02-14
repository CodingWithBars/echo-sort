"use client";

import { useState, useEffect } from "react";

export default function DriversList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

  const drivers = [
    { id: "D-001", name: "Ricardo Dalisay", truck: "ABC-123", status: "On Route", efficiency: 94, phone: "+63 917 123 4567", license: "B01-22-00045" },
    { id: "D-002", name: "Maria Clara", truck: "XYZ-789", status: "Idle", efficiency: 88, phone: "+63 918 999 8888", license: "A12-21-09876" },
    { id: "D-003", name: "Juan Luna", truck: "LMN-456", status: "On Route", efficiency: 91, phone: "+63 915 555 1212", license: "C09-24-11223" },
    { id: "D-004", name: "Andres Bonifacio", truck: "MNO-321", status: "Maintenance", efficiency: 82, phone: "+63 908 444 3322", license: "D04-23-44556" },
  ];

  useEffect(() => {
    if (selectedDriver) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedDriver]);

  const filteredDrivers = drivers
    .filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.truck.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "eff-high": return b.efficiency - a.efficiency;
        case "eff-low": return a.efficiency - b.efficiency;
        default: return 0;
      }
    });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'On Route': return 'bg-blue-500 text-blue-500';
      case 'Idle': return 'bg-amber-500 text-amber-500';
      default: return 'bg-slate-400 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* --- UNIFIED SEARCH & FILTERS --- */}
      <div className="flex flex-col xl:flex-row gap-4">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
          <input 
            type="text"
            placeholder="Search driver or plate number..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all shadow-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="px-3">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter By</span>
          </div>
          <select 
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <optgroup label="Alphabetical">
              <option value="name-asc">Name: A - Z</option>
              <option value="name-desc">Name: Z - A</option>
            </optgroup>
            <optgroup label="Performance">
              <option value="eff-high">Highest Efficiency</option>
              <option value="eff-low">Lowest Efficiency</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* --- DRIVER GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-right-4 duration-500">
        {filteredDrivers.map((driver) => (
          <div key={driver.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
            {/* Status Indicator Bar */}
            <div className={`h-2 w-full ${getStatusStyle(driver.status).split(' ')[0]}`} />
            
            <div className="p-6 pt-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${driver.status === 'On Route' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                  {driver.status}
                </span>
                <span className="text-[10px] text-slate-300 font-mono font-bold">{driver.truck}</span>
              </div>
              
              <h3 className="font-black text-slate-900 text-xl tracking-tight mb-4 group-hover:text-emerald-600 transition-colors">
                {driver.name}
              </h3>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Fleet Efficiency</span>
                  <span className="text-lg font-black text-emerald-600 leading-none">{driver.efficiency}%</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl shadow-sm">
                  🚚
                </div>
              </div>
              
              <button 
                onClick={() => setSelectedDriver(driver)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[9px] font-black tracking-[0.2em] uppercase transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-100"
              >
                Driver Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* --- DRIVER PROFILE MODAL --- */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedDriver(null)}
          />
          
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500 ease-out">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden" />
            <div className={`h-2 w-full mt-4 sm:mt-0 ${getStatusStyle(selectedDriver.status).split(' ')[0]}`} />
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl shadow-inner border border-emerald-100">🪪</div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{selectedDriver.name}</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedDriver.id} • Driver</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDriver(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Truck Plate</p>
                    <p className="text-sm font-bold text-slate-800 font-mono uppercase">{selectedDriver.truck}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Performance</p>
                    <p className="text-sm font-black text-emerald-600">{selectedDriver.efficiency}% Efficiency</p>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Contact Number</p>
                    <p className="text-sm font-bold text-slate-800 tracking-tight">{selectedDriver.phone}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">📞</div>
                </div>

                <div className="p-5 bg-slate-900 rounded-[2rem] relative overflow-hidden text-white shadow-xl shadow-slate-200">
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 text-5xl">📋</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.15em]">Official Credentials</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">License Number</p>
                  <p className="text-sm font-mono font-black tracking-widest">{selectedDriver.license}</p>
                </div>

                <button 
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                  onClick={() => setSelectedDriver(null)}
                >
                  Contact Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}