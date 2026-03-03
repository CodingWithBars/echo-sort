"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Toaster, toast } from "react-hot-toast";
import {
  Search,
  Plus,
  Truck,
  MapPin,
  TrendingUp,
  UserX,
  ArrowRight,
  Loader2,
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

  // Fetch all drivers once on mount (Functions unchanged)
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
          efficiency_score: 100, // Placeholder as per original
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
      toast.success("Driver moved to archives");
      setSelectedDriver(null);
      await fetchDrivers();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleRestoreDriver = async (id: string) => {
    setLoading(true);
    const result = await restoreDriverAccount(id);
    if (result.success) {
      toast.success("Driver restored to active fleet");
      setSelectedDriver(null);
      await fetchDrivers();
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

  const filteredDrivers = drivers.filter((d) => {
    const matchesTab = d.status === activeTab;
    const matchesSearch =
      (d.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.truck_plate || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Toaster position="top-center" />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">
              Fleet Control
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} />
          Add New Operator
        </button>
      </div>

      {/* --- DETACHED FLEET NAVIGATION & SEARCH --- */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch">
        {/* SEARCH BLOCK - Now independently responsive */}
        <div className="relative flex-1 group min-w-0 rounded-2xl shadow-sm ">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-all duration-300">
            <Search size={18} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            placeholder="Search fleet database..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-14 pr-6 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold uppercase tracking-widest outline-none focus:border-emerald-500 focus:ring-4 ring-emerald-500/5 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* TAB SWITCHER BLOCK - Detached to maintain height and scale */}
        <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm shrink-0 items-stretch h-14 md:h-16 lg:h-14">
          <button
            onClick={() => setActiveTab("ACTIVE")}
            className={`flex-1 lg:flex-none px-6 md:px-10 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-3 ${
              activeTab === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <div className="relative flex items-center justify-center">
              {activeTab === "ACTIVE" && (
                <div className="absolute w-3 h-3 rounded-full bg-emerald-500 opacity-20 animate-ping" />
              )}
              <div
                className={`w-2 h-2 rounded-full ${activeTab === "ACTIVE" ? "bg-emerald-500" : "bg-slate-300"}`}
              />
            </div>
            <span className="whitespace-nowrap">Active Fleet</span>
          </button>

          <button
            onClick={() => setActiveTab("REMOVED")}
            className={`flex-1 lg:flex-none px-6 md:px-10 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-3 ${
              activeTab === "REMOVED"
                ? "bg-red-50 text-red-700 border border-red-100 shadow-sm"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <div className="relative flex items-center justify-center">
              {activeTab === "REMOVED" && (
                <div className="absolute w-3 h-3 rounded-full bg-red-500 opacity-20 animate-ping" />
              )}
              <div
                className={`w-2 h-2 rounded-full ${activeTab === "REMOVED" ? "bg-red-500" : "bg-slate-300"}`}
              />
            </div>
            <span className="whitespace-nowrap">Archives</span>
          </button>
        </div>
      </div>

      {/* DRIVER GRID */}
      {loading && drivers.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 w-full bg-white rounded-3xl border border-slate-100 animate-pulse p-6 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-4 w-1/4 bg-slate-100 rounded-full" />
                <div className="h-6 w-3/4 bg-slate-100 rounded-full" />
              </div>
              <div className="h-12 w-full bg-slate-50 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : filteredDrivers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrivers.map((driver) => (
            <div
              key={driver.id}
              onClick={() => setSelectedDriver(driver)}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col group overflow-hidden transition-all hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/50 cursor-pointer relative"
            >
              {/* Dynamic Status Accent */}
              <div
                className={`h-1.5 w-full ${activeTab === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"}`}
              />

              <div className="p-6">
                <div className="flex justify-between items-start mb-5">
                  <div className="space-y-1.5">
                    <span
                      className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border ${
                        activeTab === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-red-50 text-red-500 border-red-100"
                      }`}
                    >
                      {driver.status}
                    </span>

                    {activeTab === "ACTIVE" && (
                      <div className="flex items-center gap-2 ml-1">
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${driver.duty_status === "ON-DUTY" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
                        />
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wider ${driver.duty_status === "ON-DUTY" ? "text-emerald-700" : "text-slate-400"}`}
                        >
                          {driver.duty_status}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[9px] font-black tracking-widest font-mono">
                    {driver.truck_plate}
                  </div>
                </div>

                <h3 className="font-black text-slate-900 text-xl tracking-tight mb-4 group-hover:text-emerald-600 transition-colors">
                  {driver.full_name}
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight truncate">
                      {driver.assigned_route}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-emerald-50/30 group-hover:border-emerald-100 transition-all">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-600" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Efficiency
                        </span>
                      </div>
                      <span className="text-lg font-black text-slate-900">
                        {driver.efficiency_score}%
                      </span>
                    </div>
                    {/* Efficiency Bar UX Improvement */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${driver.efficiency_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* View Action Overlay */}
              <div className="absolute right-4 bottom-20 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                <div className="p-2 bg-emerald-600 text-white rounded-full shadow-lg">
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State UX Improvement */
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
            <UserX size={40} />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase">
            No Operators Found
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      )}

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
