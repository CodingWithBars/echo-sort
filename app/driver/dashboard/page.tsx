"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import CollectionHistory from "@/components/driver/CollectionHistory";
import TruckStatus from "@/components/driver/TruckStatus";
import DriverProfileView from "@/components/driver/DriverProfileView";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

// Type definition for the payload to fix the implicit 'any' error
interface DriverDetails {
  id: string;
  duty_status: string;
  license_number?: string;
  vehicle_plate_number?: string;
  assigned_route?: string;
  employment_status?: string;
}

const DriverMap = dynamic(() => import("@/components/driver/DriverMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center shadow-inner">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Waking Eco-Engine...
        </p>
      </div>
    </div>
  ),
});

export default function DriverDashboard() {
  const [activeTab, setActiveTab] = useState("map");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- DRIVER DATA STATES ---
  const [driverData, setDriverData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  // --- 1. FETCH INITIAL DRIVER DATA ---
  useEffect(() => {
    async function getDriverProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            avatar_url,
            driver_details!inner (
              id,
              license_number,
              vehicle_plate_number,
              assigned_route,
              duty_status,
              employment_status
            )
          `,
          )
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data.driver_details.employment_status !== "ACTIVE") {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }

        setDriverData(data);
      } catch (err) {
        console.error("Dashboard Error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    getDriverProfile();
  }, [supabase, router]);

  // --- 2. REALTIME SYNC FOR DUTY STATUS ---
  useEffect(() => {
    if (!driverData?.id) return;

    const channel = supabase
      .channel(`driver-status-${driverData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "driver_details",
          filter: `id=eq.${driverData.id}`,
        },
        (payload: RealtimePostgresUpdatePayload<DriverDetails>) => {
          // 🔥 FIXED: Explicitly typed 'payload' to avoid 'any' error
          const updatedRow = payload.new;
          
          setDriverData((prev: any) => ({
            ...prev,
            driver_details: {
              ...prev.driver_details,
              duty_status: updatedRow.duty_status,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverData?.id, supabase]);

  // --- LOGOUT LOGIC ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    { id: "map", label: "Live Route Map", icon: "🗺️" },
    { id: "history", label: "My Collections", icon: "🚛" },
    { id: "status", label: "Truck Health", icon: "🛠️" },
  ];

  const renderContent = () => {
    if (isLoading) return null;

    switch (activeTab) {
      case "map":
        return (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <DriverMap />
          </div>
        );
      case "history":
        return <CollectionHistory />;
      case "status":
        return <TruckStatus />;
      case "profile":
        return <DriverProfileView />;
      default:
        return <DriverMap />;
    }
  };

  const currentLabel =
    menuItems.find((item) => item.id === activeTab)?.label || "Driver Portal";

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Syncing Profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden">
      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.2rem] shadow-xl shadow-emerald-100 border border-emerald-50 overflow-hidden">
              <img
                src="/icons/icon-512x512.png"
                alt="EcoRoute Logo"
                className="h-full w-full object-cover p-3"
              />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              EcoRoute
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Driver Menu
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
              <span
                className={`text-xl ${activeTab === item.id ? "brightness-200" : "grayscale opacity-70"}`}
              >
                {item.icon}
              </span>
              <span className="text-sm font-black uppercase tracking-tight">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-6 shrink-0">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[2rem] bg-red-50 text-red-600 hover:bg-red-100 transition-all font-black text-xs uppercase tracking-widest border border-red-100"
          >
            <span>Finish Shift</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 active:scale-95 transition-transform"
            >
              ☰
            </button>
            <div>
              <p
                className={`text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 ${driverData?.driver_details?.duty_status === "ON-DUTY" ? "text-emerald-600" : "text-slate-400"}`}
              >
                {driverData?.driver_details?.duty_status || "OFF-DUTY"}
              </p>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                {currentLabel}
              </h2>
            </div>
          </div>

          {/* DRIVER PROFILE BUTTON */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-3 p-1 pr-4 rounded-full border transition-all ${
              activeTab === "profile"
                ? "bg-emerald-50 border-emerald-200 shadow-sm"
                : "bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200"
            }`}
          >
            <div className="relative group/nav-avatar">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-emerald-100 overflow-hidden border-2 border-white">
                {driverData?.avatar_url ? (
                  <img
                    src={driverData.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="italic">
                    {driverData?.full_name?.charAt(0) || "D"}
                  </span>
                )}
              </div>

              {/* Status Indicator Dot (Updates Realtime) */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors duration-500 ${
                  driverData?.driver_details?.duty_status === "ON-DUTY"
                    ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-slate-400"
                }`}
              />
            </div>

            <div className="text-left hidden sm:block">
              <p className="text-[10px] font-black text-slate-900 leading-none uppercase tracking-tighter italic">
                {driverData?.full_name}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                  {driverData?.driver_details?.vehicle_plate_number || "NO TRUCK"}
                </p>
                <div className="w-1 h-1 rounded-full bg-slate-200" />
                <p className="text-[8px] text-emerald-600 font-black uppercase tracking-wider">
                  {driverData?.driver_details?.assigned_route || "NO ROUTE"}
                </p>
              </div>
            </div>
          </button>
        </header>

        <div
          className={`flex-1 relative w-full h-full ${activeTab === "map" ? "overflow-hidden" : "overflow-y-auto p-6 lg:p-10"}`}
        >
          {renderContent()}
        </div>
      </main>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => !isLoggingOut && setShowLogoutModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl">
            <div className="text-center">
              <span className="text-5xl block mb-4">🏠</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                Finish Shift?
              </h2>
              <p className="text-sm text-slate-500 mb-8">
                This marks your route as completed and clocks you out.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isLoggingOut ? "Ending Shift..." : "Confirm & Logout"}
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all disabled:opacity-50"
                >
                  Stay on Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}