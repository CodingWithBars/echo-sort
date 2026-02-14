"use client";

import { useState } from "react";
import Overview from "@/components/admin/Overview";
import DriversList from "@/components/admin/DriverList";
import CitizenRegistry from "@/components/admin/CitizenRegistry";
import CollectionsView from "@/components/admin/CollectionsView"; 
import ViolationsView from "@/components/admin/ViolationsView"; 
import ProfileView from "@/components/admin/ProfileView";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
      case "profile": return <ProfileView />;
      default: return <Overview />;
    }
  };

  const currentLabel = activeTab === "profile" ? "Admin Profile" : (menuItems.find(item => item.id === activeTab)?.label || "Dashboard");

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans relative">
      
      {/* --- SIDEBAR --- */}
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
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100">
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-semibold"
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 text-slate-600">☰</button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Administrator</p>
              <h2 className="text-lg font-bold text-slate-900">{currentLabel}</h2>
            </div>
          </div>

          {/* AVATAR BUTTON */}
          <button 
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-3 p-1 pr-4 rounded-full transition-all ${activeTab === 'profile' ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 overflow-hidden">
               <span className="text-lg">👤</span>
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-black text-slate-900 leading-none mb-1">System Admin</p>
              <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter">View Profile</p>
            </div>
          </button>
        </header>

        <div className="p-6 lg:p-10">
          <div className="mb-8">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{currentLabel}</h3>
          </div>
          {renderContent()}
        </div>
      </main>

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowLogoutModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center text-3xl mb-6 mx-auto">👋</div>
            <h2 className="text-2xl font-black text-slate-900 text-center tracking-tight mb-2">End Session?</h2>
            <p className="text-slate-500 text-center text-sm font-medium mb-8">Are you sure you want to log out of the EcoRoute Admin portal?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.href = '/login'}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-600 transition-all active:scale-95"
              >
                Confirm Logout
              </button>
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Keep me logged in
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden" />}
    </div>
  );
}