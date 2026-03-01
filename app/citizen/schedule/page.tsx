"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import nextDynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";

// Dynamic Views
const BinLocations = nextDynamic(() => import("@/components/citizen/BinLocations"), { 
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-slate-50 animate-pulse rounded-[3rem]" />
});

// Placeholder Components
const PickupSchedule = () => <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm animate-in slide-in-from-bottom-4 duration-500">🗓️ Collection Schedule for your Barangay...</div>;
const MyImpact = () => <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm animate-in slide-in-from-bottom-4 duration-500">🌱 Your Eco-Warrior Stats...</div>;
const ReportIssue = () => <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm animate-in slide-in-from-bottom-4 duration-500">📢 Report a Waste Concern...</div>;
const CitizenProfileView = ({ initialData }: any) => <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm">👤 Settings for {initialData?.full_name}...</div>;

export const dynamic = "force-dynamic";

interface CitizenProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role: string;
  citizen_details: {
    barangay: string;
    purok: string;
    municipality: string;
  };
}

export default function CitizenDashboard() {
  const [activeTab, setActiveTab] = useState("bins");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchFullProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select(`
            id, 
            full_name, 
            avatar_url, 
            role,
            citizen_details!inner (
              barangay,
              purok,
              municipality
            )
          `)
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfile(data as any);
        }
      } else {
        router.replace("/login");
      }
      setIsLoading(false);
    };

    fetchFullProfile();
  }, [supabase, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const menuItems = [
    { id: "bins", label: "Bin Locations", icon: "📍" },
    { id: "schedule", label: "Schedule", icon: "🗓️" },
    { id: "impact", label: "My Impact", icon: "🌱" },
    { id: "report", label: "Report Issue", icon: "📢" },
  ];

  const currentLabel = menuItems.find((item) => item.id === activeTab)?.label || "Community Portal";

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Syncing Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-emerald-100 border border-emerald-50">
              <span className="text-white font-black text-xl italic">E</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EcoRoute</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic opacity-70">Citizen Portal</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-300 group ${
                activeTab === item.id 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-bold" 
                  : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 shrink-0">
          <button onClick={() => setShowLogoutModal(true)} className="w-full py-4 rounded-[2rem] bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all font-black text-xs uppercase tracking-widest border border-slate-100">
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        
        {/* DASHBOARD HEADER */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100">☰</button>
            <div className="block">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-0.5">
                {profile?.citizen_details.barangay}, {profile?.citizen_details.municipality}
              </p>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight uppercase italic">{currentLabel}</h2>
            </div>
          </div>

          {/* DYNAMIC PROFILE BADGE */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-3 p-1.5 pr-1 md:pr-5 rounded-[1.8rem] border transition-all duration-500 group/badge ${
              activeTab === "profile" 
                ? "bg-slate-950 border-slate-900 shadow-xl" 
                : "bg-white border-slate-100 hover:border-emerald-200 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-2xl flex items-center justify-center overflow-hidden border relative transition-all duration-500 ${
              activeTab === "profile" ? "border-emerald-500/50 scale-105" : "border-slate-200"
            }`}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-600 flex items-center justify-center">
                  <span className="font-black text-white italic text-base">
                    {profile?.full_name?.charAt(0) || "C"}
                  </span>
                </div>
              )}
            </div>

            <div className="text-left hidden md:block">
              <p className={`text-[11px] font-black uppercase tracking-tight transition-colors duration-300 ${
                activeTab === "profile" ? "text-white" : "text-slate-900"
              }`}>
                {profile?.full_name || "Valued Citizen"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className={`text-[8px] font-bold uppercase tracking-[0.15em] ${
                  activeTab === "profile" ? "text-emerald-400/80" : "text-slate-400"
                }`}>
                  {profile?.citizen_details.purok} • Authorized
                </p>
              </div>
            </div>
          </button>
        </header>

        {/* VIEW RENDERER */}
        <div className={`flex-1 relative w-full h-full ${activeTab === "bins" ? "overflow-hidden" : "overflow-y-auto"}`}>
           {activeTab === "bins" ? (
             <div className="absolute inset-0 animate-in fade-in duration-700">
               <BinLocations />
             </div>
           ) : (
             <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">
                {activeTab === "schedule" && <PickupSchedule />}
                {activeTab === "impact" && <MyImpact />}
                {activeTab === "report" && <ReportIssue />}
                {activeTab === "profile" && <CitizenProfileView initialData={profile} />}
             </div>
           )}
        </div>
      </main>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isLoggingOut && setShowLogoutModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[3.5rem] p-10 shadow-2xl text-center">
            <span className="text-5xl block mb-6">♻️</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase italic">End Session?</h2>
            <p className="text-sm text-slate-500 mb-8 font-medium italic">Your contribution today helped make GenSan a little cleaner.</p>
            <div className="space-y-3">
              <button onClick={handleLogout} className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                Confirm & Logout
              </button>
              <button onClick={() => setShowLogoutModal(false)} className="w-full py-5 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase active:scale-95 transition-all">
                Stay Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}