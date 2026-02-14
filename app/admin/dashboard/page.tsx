"use client";

import { useState } from "react";
// Import your components
import Overview from "@/components/admin/Overview";
import DriversList from "@/components/admin/DriverList";
import CitizenRegistry from "@/components/admin/CitizenRegistry";
import CollectionsView from "@/components/admin/CollectionsView"; 
import ViolationsView from "@/components/admin/ViolationsView"; 

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "drivers", label: "Driver Fleet", icon: "🚚" },
    { id: "citizens", label: "Citizen Registry", icon: "👥" },
    { id: "collections", label: "Collections", icon: "♻️" },
    { id: "violations", label: "Violations", icon: "⚠️" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <Overview />;
      case "drivers": return <DriversList />;
      case "citizens": return <CitizenRegistry />;
      case "collections": return <CollectionsView />;
      case "violations": return <ViolationsView />;
      default: return <Overview />;
    }
  };

  // Helper to find label for the current tab
  const currentLabel = menuItems.find(item => item.id === activeTab)?.label || "Dashboard";

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans relative">
      
      {/* --- LIGHT SIDEBAR --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EcoRoute</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-2">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Main Menu</p>
          {menuItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                activeTab === item.id 
                ? "bg-emerald-50 text-emerald-700 font-bold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={`text-xl ${activeTab === item.id ? "grayscale-0" : "grayscale opacity-70 group-hover:grayscale-0"}`}>
                {item.icon}
              </span> 
              {item.label}
              {activeTab === item.id && (
                <div className="ml-auto w-1.5 h-1.5 bg-emerald-600 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100">
          <button 
            onClick={() => window.location.href = '/login'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-semibold"
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Responsive Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {isSidebarOpen ? "✕" : "☰"}
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Administrator</p>
              <h2 className="text-lg font-bold text-slate-900 leading-none">{currentLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-900">System Admin</p>
                <p className="text-xs text-emerald-600 font-medium">Active Session</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                👤
             </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-6 lg:p-10">
          {/* Section Title Header */}
          <div className="mb-8">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{currentLabel}</h3>
            <div className="flex items-center gap-2 mt-2">
               <span className="text-xs text-slate-400 font-medium">Dashboard</span>
               <span className="text-slate-300">/</span>
               <span className="text-xs text-emerald-600 font-bold">{currentLabel}</span>
            </div>
          </div>

          <div className="w-full">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden" />}
    </div>
  );
}