"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Views
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // --- LOGOUT LOGIC ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login"); 
      router.refresh(); 
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

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

  const currentLabel = menuItems.find(item => item.id === activeTab)?.label || "Dashboard";

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden">
      
      {/* --- MOBILE SIDEBAR OVERLAY --- */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR (Updated to Match Driver/Citizen Style) --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${
          isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-emerald-100 border border-emerald-50">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              EcoRoute
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            System Admin
          </p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-200 group ${
                activeTab === item.id
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-bold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={`text-xl ${activeTab === item.id ? "brightness-200" : "grayscale opacity-70"}`}>
                {item.icon}
              </span>
              <span className="text-sm font-black uppercase tracking-tight">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-6 shrink-0 border-t border-slate-50">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[2rem] bg-red-50 text-red-600 hover:bg-red-100 transition-all font-black text-xs uppercase tracking-widest border border-red-100"
          >
            <span>Exit Portal</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        
        {/* HEADER */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 active:scale-95 transition-transform"
            >
              ☰
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-0.5">
                Admin Control
              </p>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                {currentLabel}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-3 p-1 pr-4 rounded-full border transition-all ${
              activeTab === "profile" 
              ? "bg-emerald-50 border-emerald-200" 
              : "bg-slate-50 border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg overflow-hidden">
              👤
            </div>
            <div className="text-left hidden md:block">
              <p className="text-[10px] font-black text-slate-900 leading-none">System Master</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Super Admin</p>
            </div>
          </button>
        </header>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mb-8">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {currentLabel}
            </h3>
          </div>
          {renderContent()}
        </div>
      </main>

      {/* --- LOGOUT MODAL (Driver Style) --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => !isLoggingOut && setShowLogoutModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <span className="text-5xl block mb-4">🚪</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                End Admin Session?
              </h2>
              <p className="text-sm text-slate-500 mb-8">
                You will need to re-authenticate to access the management portal.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isLoggingOut ? "Closing..." : "Confirm & Logout"}
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all disabled:opacity-50"
                >
                  Stay Logged In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}