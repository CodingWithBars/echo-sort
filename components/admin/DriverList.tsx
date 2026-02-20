"use client";

import { useState, useEffect } from "react";

export default function DriversList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

  const drivers = [
    {
      id: "D-001",
      name: "Ricardo Dalisay",
      truck: "ABC-123",
      status: "On Route",
      efficiency: 94,
      phone: "+63 917 123 4567",
      license: "B01-22-00045",
    },
    {
      id: "D-002",
      name: "Maria Clara",
      truck: "XYZ-789",
      status: "Idle",
      efficiency: 88,
      phone: "+63 918 999 8888",
      license: "A12-21-09876",
    },
    {
      id: "D-003",
      name: "Juan Luna",
      truck: "LMN-456",
      status: "On Route",
      efficiency: 91,
      phone: "+63 915 555 1212",
      license: "C09-24-11223",
    },
    {
      id: "D-004",
      name: "Andres Bonifacio",
      truck: "MNO-321",
      status: "Maintenance",
      efficiency: 82,
      phone: "+63 908 444 3322",
      license: "D04-23-44556",
    },
  ];

  useEffect(() => {
    if (selectedDriver) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedDriver]);

  const filteredDrivers = drivers
    .filter(
      (d) =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.truck.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "eff-high":
          return b.efficiency - a.efficiency;
        case "eff-low":
          return a.efficiency - b.efficiency;
        default:
          return 0;
      }
    });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "On Route":
        // Green background, White text
        return "bg-green-500 text-white";
      case "Idle":
        // Yellow background, Black text
        return "bg-yellow-400 text-black";
      default:
        // Default fallback
        return "bg-slate-400 text-white";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* --- UNIFIED FILTER BAR --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search driver or plate..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl md:rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative min-w-[180px]">
          <select
            className="w-full appearance-none px-4 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-2xl outline-none cursor-pointer hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <option value="name-asc">A - Z Name</option>
            <option value="name-desc">Z - A Name</option>
            <option value="eff-high">Best Performance</option>
            <option value="eff-low">Needs Review</option>
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none text-[8px]">
            ▼
          </span>
        </div>
      </div>

      {/* --- DRIVER GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredDrivers.map((driver) => (
          <div
            key={driver.id}
            onClick={() => setSelectedDriver(driver)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col group relative overflow-hidden transition-all hover:border-blue-200 active:scale-[0.98] cursor-pointer"
          >
            <div
              className={`h-1.5 w-full ${getStatusStyle(driver.status).split(" ")[0]}`}
            />

            <div className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider bg-opacity-10 ${getStatusStyle(driver.status)} bg-current`}
                >
                  {driver.status}
                </span>
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase">
                  {driver.truck}
                </span>
              </div>

              <h3 className="font-black text-slate-900 text-lg tracking-tight mb-4 group-hover:text-blue-600 transition-colors">
                {driver.name}
              </h3>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">
                    Efficiency Score
                  </span>
                  <span className="text-xl font-black text-slate-900 leading-none">
                    {driver.efficiency}%
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-lg shadow-sm">
                  🚚
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- DRIVER PROFILE BOTTOM SHEET --- */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedDriver(null)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500 ease-out">
            <div
              className={`h-1.5 w-full ${getStatusStyle(selectedDriver.status).split(" ")[0]}`}
            />

            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-inner">
                    🪪
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">
                      {selectedDriver.name}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {selectedDriver.id} • Operator
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                      Vehicle Plate
                    </p>
                    <p className="text-xs font-bold text-slate-800 font-mono">
                      {selectedDriver.truck}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                      Fleet Score
                    </p>
                    <p className="text-xs font-black text-emerald-600">
                      {selectedDriver.efficiency}% Performance
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center group">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                      Phone Connection
                    </p>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedDriver.phone}
                    </p>
                  </div>
                  <span className="text-lg">📞</span>
                </div>

                <div className="p-5 bg-slate-900 rounded-2xl relative overflow-hidden text-white">
                  <div className="absolute right-[-5px] top-[-5px] opacity-10 text-4xl">
                    📋
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">
                    Driver Credentials
                  </p>
                  <p className="text-xs font-mono font-black tracking-[0.2em]">
                    {selectedDriver.license}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-50 transition-all active:scale-95">
                    Assign Truck
                  </button>
                  <button className="flex-[1.5] py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-95">
                    Call Driver Now
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
