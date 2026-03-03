"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import nextDynamic from "next/dynamic";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Truck, 
  Users, 
  Recycle, 
  AlertTriangle, 
  LogOut, 
  Menu,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

// Views
import Overview from "@/components/admin/Overview";
import DriversList from "@/components/admin/DriverList";
import CitizenRegistry from "@/components/admin/CitizenRegistry";
import CollectionsView from "@/components/admin/CollectionsView";
import ViolationsView from "@/components/admin/ViolationsView";
import ProfileView from "@/components/admin/ProfileView";

const DynamicBinMap = nextDynamic(
  () => import("@/components/admin/BinMapView"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-full bg-slate-50 animate-pulse rounded-3xl m-6 border border-slate-100" />
    ),
  },
);

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedCitizenData, setSelectedCitizenData] = useState<any | null>(null);

  // --- AUTH STATE ---
  const [adminProfile, setAdminProfile] = useState<{
    full_name: string;
    role: string;
    avatar_url?: string | null;
  } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // --- FETCH REAL ADMIN DETAILS (Functions Unchanged) ---
  useEffect(() => {
    const fetchAdminDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, avatar_url")
          .eq("id", user.id)
          .single();

        if (profile) setAdminProfile(profile);
      } else {
        router.replace("/login");
      }
    };
    fetchAdminDetails();
  }, [supabase, router]);

  // --- LOGOUT LOGIC (Functions Unchanged) ---
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

  const handleEditCitizenProfile = (citizen: any) => {
    setSelectedCitizenData(citizen);
    setActiveTab("profile");
  };

  // Updated Menu Items with Lucide Icons
  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "map", label: "Bin Map", icon: MapIcon },
    { id: "drivers", label: "Driver Fleet", icon: Truck },
    { id: "citizens", label: "Citizen Registry", icon: Users },
    { id: "collections", label: "Collections", icon: Recycle },
    { id: "violations", label: "Violations", icon: AlertTriangle },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <div className="p-6 lg:p-8"><Overview /></div>;
      case "map": return <div className="p-6 h-full"><DynamicBinMap /></div>;
      case "drivers": return <div className="p-6 lg:p-8"><DriversList /></div>;
      case "citizens": return <div className="p-6 lg:p-8 w-full"><CitizenRegistry onEditProfile={handleEditCitizenProfile} /></div>;
      case "collections": return <div className="p-6 lg:p-8"><CollectionsView /></div>;
      case "violations": return <div className="p-6 lg:p-8"><ViolationsView /></div>;
      case "profile": return (
        <div className="p-6 lg:p-8 w-full">
          <ProfileView
            key={selectedCitizenData?.id || "admin"}
            initialData={selectedCitizenData}
            onClearContext={() => {
              setSelectedCitizenData(null);
              if (selectedCitizenData) setActiveTab("citizens");
            }}
          />
        </div>
      );
      default: return <Overview />;
    }
  };

  const currentLabel = menuItems.find((item) => item.id === activeTab)?.label || "Dashboard";

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden text-slate-900">
      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 border border-emerald-500/20">
              <Recycle className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              EcoRoute
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto custom-scrollbar">
          <p className="px-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
            Management Portal
          </p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
                }`}
              >
                <div className="flex items-center gap-4">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}>
                    {item.label}
                  </span>
                </div>
                {isActive && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
              </button>
            );
          })}
        </nav>

        <div className="p-6 shrink-0">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-[10px] uppercase tracking-widest border border-slate-100 hover:border-red-100 group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-slate-50/50">
        {/* HEADER */}
        <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-all"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em]">
                  System Live
                </p>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight uppercase">
                {currentLabel}
              </h2>
            </div>
          </div>

          {/* DYNAMIC PROFILE BADGE */}
          <button
            onClick={() => {
              setSelectedCitizenData(null);
              setActiveTab("profile");
            }}
            className={`flex items-center gap-3 p-1.5 pr-4 rounded-xl border transition-all duration-300 group/badge ${
              activeTab === "profile"
                ? "bg-slate-900 border-slate-800 shadow-lg shadow-slate-200"
                : "bg-white border-slate-200 hover:border-emerald-200 hover:shadow-sm"
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden border transition-all ${
                activeTab === "profile" ? "border-emerald-500/50" : "border-slate-100"
              }`}
            >
              {adminProfile?.avatar_url ? (
                <img src={adminProfile.avatar_url} alt="Admin" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-600 flex items-center justify-center">
                  <span className="font-black text-white text-sm uppercase">
                    {adminProfile?.full_name?.charAt(0) || "A"}
                  </span>
                </div>
              )}
            </div>

            <div className="text-left hidden md:block">
              <p className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${
                  activeTab === "profile" ? "text-white" : "text-slate-900"
                }`}
              >
                {adminProfile?.full_name || "System Admin"}
              </p>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={10} className={activeTab === "profile" ? "text-emerald-400" : "text-emerald-600"} />
                <p className={`text-[9px] font-bold uppercase tracking-widest ${
                    activeTab === "profile" ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {adminProfile?.role || "Administrator"}
                </p>
              </div>
            </div>
          </button>
        </header>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          {renderContent()}
        </div>
      </main>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <LogOut size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                End Session?
              </h2>
              <p className="text-xs font-medium text-slate-500 mb-8 leading-relaxed">
                You are about to exit the management portal. All active administrative controls will be locked.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoggingOut ? "Closing Session..." : "Confirm & Logout"}
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Stay Active
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}