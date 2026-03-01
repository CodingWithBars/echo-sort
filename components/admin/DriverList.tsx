"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Toaster, toast } from "react-hot-toast";
import {
  // ... your other existing icons like Camera, ShieldCheck, etc.
  Search,
} from "lucide-react";
import {
  createDriverAccount,
  archiveDriverAccount,
  restoreDriverAccount,
} from "@/app/admin/drivers/actions";

// Sub-components
import DriverSheet from "@/app/admin/drivers/components/DriverSheet";
import AddDriverModal from "@/app/admin/drivers/components/AddDriverModal";

export default function DriversList() {
  const supabase = createClient();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "REMOVED">("ACTIVE");

  // Fetch all drivers once on mount
  useEffect(() => {
    fetchDrivers();
  }, []);

  async function fetchDrivers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id, 
        email,
        full_name, 
        role,
        driver_details (
          license_number, 
          vehicle_plate_number, 
          employment_status,
          assigned_route,
          duty_status
        )
      `,
      )
      .eq("role", "DRIVER");

    if (error) {
      console.error("Supabase Error:", error);
      toast.error("Failed to load drivers");
      setLoading(false);
      return;
    }

    if (data) {
      const flattened = data.map((d: any) => {
        const details = d.driver_details;
        return {
          id: d.id,
          email: d.email || "No Email",
          full_name: d.full_name,
          license_number: details?.license_number || "N/A",
          truck_plate: details?.vehicle_plate_number || "N/A",
          status: details?.employment_status || "ACTIVE",
          duty_status: details?.duty_status || "OFF-DUTY",
          assigned_route: details?.assigned_route || "Unassigned",
          efficiency_score: 100,
        };
      });

      setDrivers(flattened);
    }

    setLoading(false);
  }

  const handleRemoveDriver = async (id: string) => {
    setLoading(true);
    const result = await archiveDriverAccount(id);
    if (result.success) {
      toast.success("Driver moved to archives", { icon: "📁" });
      setSelectedDriver(null);
      await fetchDrivers(); // Refresh the master list
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleRestoreDriver = async (id: string) => {
    setLoading(true);
    const result = await restoreDriverAccount(id);
    if (result.success) {
      toast.success("Driver restored to active fleet", { icon: "♻️" });
      setSelectedDriver(null);
      await fetchDrivers(); // Refresh the master list
    } else {
      toast.error(result.error || "Restoration failed");
    }
    setLoading(false);
  };

  const handleAddDriver = async (driverData: any) => {
    setLoading(true);
    const result = await createDriverAccount(driverData);
    if (result?.success) {
      toast.success("Driver Account Activated", {
        style: {
          background: "#065f46",
          color: "#ecfdf5",
          borderRadius: "24px",
          fontWeight: "900",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        },
      });
      setShowAddModal(false);
      await fetchDrivers();
    } else {
      toast.error(result?.error || "Creation failed");
    }
    setLoading(false);
  };

  // Filter based on BOTH the active tab and the search term
  const filteredDrivers = drivers.filter((d) => {
    const matchesTab = d.status === activeTab;
    const matchesSearch =
      (d.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.truck_plate || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <Toaster position="top-center" />

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
          Fleet Management
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg"
        >
          + Add Driver
        </button>
      </div>

      {/* --- UNIFIED FLEET SEARCH & NAVIGATION --- */}
      <div className="flex flex-col lg:flex-row gap-3 bg-white p-3 rounded-[2.5rem] border-2 border-slate-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] items-stretch">
        {/* SEARCH BLOCK - Massive Rounded Style */}
        <div className="relative flex-1 group h-14 md:h-16">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            <Search size={18} strokeWidth={3} />
          </div>
          <input
            type="text"
            placeholder="Search driver or plate number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-full pl-14 pr-6 bg-slate-50 border-2 border-transparent rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 ring-emerald-500/5 transition-all placeholder:text-slate-300"
          />
        </div>

        {/* TAB SWITCHER BLOCK - Aligned to Search Height */}
        <div className="flex bg-slate-100 p-1.5 rounded-[2rem] shadow-inner items-stretch">
          <button
            onClick={() => setActiveTab("ACTIVE")}
            className={`px-8 md:px-10 rounded-[1.6rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2 ${
              activeTab === "ACTIVE"
                ? "bg-white text-emerald-600 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${activeTab === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
            />
            <span>Active Fleet</span>
          </button>

          <button
            onClick={() => setActiveTab("REMOVED")}
            className={`px-8 md:px-10 rounded-[1.6rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2 ${
              activeTab === "REMOVED"
                ? "bg-white text-red-500 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${activeTab === "REMOVED" ? "bg-red-500 animate-pulse" : "bg-slate-300"}`}
            />
            <span>Archived</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDrivers.map((driver) => (
          <div
            key={driver.id}
            onClick={() => setSelectedDriver(driver)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col group overflow-hidden transition-all hover:border-emerald-200 active:scale-[0.98] cursor-pointer"
          >
            <div
              className={`h-1.5 w-full ${activeTab === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"}`}
            />
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                  {/* Employment Status Badge */}
                  <span
                    className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase w-fit ${
                      activeTab === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-500"
                    }`}
                  >
                    {driver.status}
                  </span>

                  {/* Duty Status Indicator - Only shows for Active Drivers */}
                  {activeTab === "ACTIVE" && (
                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                      <div
                        className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
                          driver.duty_status === "ON-DUTY"
                            ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                            : "bg-slate-300"
                        }`}
                      />
                      <span
                        className={`text-[7px] font-black uppercase tracking-wider ${
                          driver.duty_status === "ON-DUTY"
                            ? "text-emerald-700"
                            : "text-slate-400"
                        }`}
                      >
                        {driver.duty_status || "OFF-DUTY"}
                      </span>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase">
                  {driver.truck_plate}
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-lg group-hover:text-emerald-600 transition-colors">
                {driver.full_name}
              </h3>
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl mt-4">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase block">
                    Efficiency
                  </span>
                  <span className="text-xl font-black text-slate-900">
                    {driver.efficiency_score}%
                  </span>
                </div>
                <div className="text-lg">🚚</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AddDriverModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddDriver}
        loading={loading}
      />

      <DriverSheet
        selectedDriver={selectedDriver}
        setSelectedDriver={setSelectedDriver}
        onRemove={handleRemoveDriver}
        onRestore={handleRestoreDriver}
        loading={loading}
      />
    </div>
  );
}
