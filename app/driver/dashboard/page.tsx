"use client";

import { useState } from "react";
import dynamic from "next/dynamic"; // 1. Import dynamic
import CollectionHistory from "@/components/driver/CollectionHistory";
import TruckStatus from "@/components/driver/TruckStatus";
import ProfileView from "@/components/admin/ProfileView";

// 2. Load DriverMap dynamically to bypass SSR (Server Side Rendering)
const DriverMap = dynamic(() => import("@/components/driver/DriverMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-slate-100 rounded-[3.5rem] flex items-center justify-center border-4 border-white shadow-inner">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Waking Eco-Engine...</p>
      </div>
    </div>
  ),
});

export default function DriverDashboard() {
  const [activeTab, setActiveTab] = useState("map");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const menuItems = [
    { id: "map", label: "Live Route Map", icon: "🗺️" },
    { id: "history", label: "My Collections", icon: "🚛" },
    { id: "status", label: "Truck Health", icon: "🛠️" },
  ];

  // --- INTERNAL COMPONENT RENDERER ---
  const renderContent = () => {
    switch (activeTab) {
      case "map":
        return <DriverMap />;
      case "history":
        return <CollectionHistory />;
      case "status":
        return <TruckStatus />;
      case "profile":
        return <ProfileView />;
      default:
        return <DriverMap />;
    }
  };

  const currentLabel = menuItems.find((item) => item.id === activeTab)?.label || "Driver Portal";

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans relative">
      
      {/* --- SIDEBAR --- */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 text-white font-black text-xl">E</div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EcoRoute</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Driver Menu</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-200 group ${
                activeTab === item.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-bold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={`text-xl ${activeTab === item.id ? "brightness-200" : "grayscale opacity-70"}`}>{item.icon}</span>
              <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto">
          <button onClick={() => setShowLogoutModal(true)} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[2rem] bg-red-50 text-red-600 hover:bg-red-100 transition-all font-black text-xs uppercase tracking-widest border border-red-100">
            <span>Finish Shift</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN --- */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100">☰</button>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">On Duty</p>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{currentLabel}</h2>
            </div>
          </div>
          <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-3 p-1 pr-4 rounded-full border transition-all ${activeTab === "profile" ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100 hover:bg-slate-100"}`}>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-xl">🚛</div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-black text-slate-900 leading-none">Driver #4421</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Plate: ABC-1234</p>
            </div>
          </button>
        </header>

        <div className="p-6 lg:p-10 min-h-0 overflow-auto">
          {renderContent()}
        </div>
      </main>

      {/* --- LOGOUT MODAL --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowLogoutModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl">
            <div className="text-center">
              <span className="text-5xl block mb-4">🏠</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Finish Shift?</h2>
              <p className="text-sm text-slate-500 mb-8">This marks your route as completed and clocks you out.</p>
              <div className="space-y-3">
                <button onClick={() => (window.location.href = "/login")} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-100">Confirm & Logout</button>
                <button onClick={() => setShowLogoutModal(false)} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase">Stay on Route</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}