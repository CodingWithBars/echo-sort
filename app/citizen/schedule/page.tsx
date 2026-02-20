"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";

// Placeholder components - You'll create these similar to your admin/driver components
const BinLocations = dynamic(() => import("@/components/citizen/BinLocations"), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-3xl" />
});
const PickupSchedule = () => <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm"> Pickup Schedule Coming Soon...</div>;
const MyImpact = () => <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm"> Your Eco-Impact Stats...</div>;
const ReportIssue = () => <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm"> Report a Waste Issue...</div>;
const ProfileView = () => <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm"> Citizen Profile Settings...</div>;

export default function CitizenDashboard() {
  const [activeTab, setActiveTab] = useState("bins");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login"); // Crucial: replace to prevent back-button loops
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    { id: "bins", label: "Bin Locations", icon: "📍" },
    { id: "schedule", label: "Pickup Schedule", icon: "🗓️" },
    { id: "impact", label: "My Impact", icon: "🌱" },
    { id: "report", label: "Report Issue", icon: "📢" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "bins": return <div className="absolute inset-0"><BinLocations /></div>;
      case "schedule": return <PickupSchedule />;
      case "impact": return <MyImpact />;
      case "report": return <ReportIssue />;
      case "profile": return <ProfileView />;
      default: return <BinLocations />;
    }
  };

  const currentLabel = menuItems.find((item) => item.id === activeTab)?.label || "Citizen Portal";

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden">
      
      {/* SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="p-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EcoRoute</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Community Menu</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-200 ${
                activeTab === item.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-bold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <button onClick={() => setShowLogoutModal(true)} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[2rem] bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-black text-xs uppercase tracking-widest border border-slate-100">
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100">☰</button>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-0.5">Eco-Citizen</p>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{currentLabel}</h2>
            </div>
          </div>

          <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-3 p-1 pr-4 rounded-full border transition-all ${activeTab === "profile" ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg">👤</div>
            <div className="text-left hidden sm:block">
              <p className="text-[10px] font-black text-slate-900 leading-none">My Account</p>
              <p className="text-[8px] text-emerald-600 font-bold uppercase mt-1">Level 5 Contributor</p>
            </div>
          </button>
        </header>

        <div className={`flex-1 relative w-full h-full ${activeTab === "bins" ? "overflow-hidden" : "overflow-y-auto p-6 lg:p-10"}`}>
          {renderContent()}
        </div>
      </main>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isLoggingOut && setShowLogoutModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl">
            <div className="text-center">
              <span className="text-5xl block mb-4">🍃</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">See you later!</h2>
              <p className="text-sm text-slate-500 mb-8">Ready to sign out of your community portal?</p>
              <div className="space-y-3">
                <button onClick={handleLogout} disabled={isLoggingOut} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                  {isLoggingOut ? "Signing Out..." : "Confirm Sign Out"}
                </button>
                <button onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}