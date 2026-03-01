"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// --- TYPES ---
interface Citizen {
  id: string;
  name: string;
  barangay: string;
  email: string | null;
  violations: number;
  created_at: string;
  purok?: string;
  is_archived: boolean;
}

interface CitizenRegistryProps {
  onEditProfile: (citizen: Citizen) => void;
}

export default function CitizenRegistry({
  onEditProfile,
}: CitizenRegistryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBrgy, setFilterBrgy] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [citizenToArchive, setCitizenToArchive] = useState<Citizen | null>(null);
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCitizens = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(`
          id, 
          full_name, 
          email, 
          role, 
          is_archived,
          updated_at,
          citizen_details!citizen_details_id_fkey (
            barangay,
            purok
          )
        `)
      .eq("role", "CITIZEN")
      .eq("is_archived", showArchived)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("❌ Supabase Query Error:", error.code, error.message);
    } else if (data) {
      const flattenedData = data.map((profile: any) => {
        const details = Array.isArray(profile.citizen_details)
          ? profile.citizen_details[0]
          : profile.citizen_details;

        return {
          id: profile.id,
          name: profile.full_name || "Unknown Resident",
          email: profile.email,
          barangay: details?.barangay && details.barangay !== "Unassigned"
              ? details.barangay
              : "Unassigned",
          purok: details?.purok || "N/A",
          violations: 0,
          created_at: profile.updated_at,
          is_archived: profile.is_archived,
        };
      });
      setCitizens(flattenedData);
    }
    setIsLoading(false);
  }, [showArchived]);

  // --- DYNAMIC FILTER LOGIC ---
  const uniqueBarangays = useMemo(() => {
    const list = Array.from(new Set(citizens.map((c) => c.barangay)))
      .filter((b) => b !== "Unassigned")
      .sort();
    return list;
  }, [citizens]);

  // --- ARCHIVE/RESTORE LOGIC ---
  const handleArchiveToggle = async () => {
    if (!citizenToArchive) return;
    
    const { error } = await supabase
      .from("profiles")
      .update({ is_archived: !citizenToArchive.is_archived })
      .eq("id", citizenToArchive.id);

    if (error) {
      alert(`Failed to update resident status.`);
    } else {
      setCitizens((prev) => prev.filter((c) => c.id !== citizenToArchive.id));
      setCitizenToArchive(null);
      setSelectedCitizen(null);
    }
  };

  useEffect(() => {
    fetchCitizens();
  }, [fetchCitizens]);

  const filtered = citizens.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrgy = filterBrgy === "All" || c.barangay === filterBrgy;
    return matchesSearch && matchesBrgy;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* --- FILTER BAR --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search resident..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500/20 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterBrgy}
            onChange={(e) => setFilterBrgy(e.target.value)}
            className="appearance-none px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl outline-none cursor-pointer hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <option value="All">All Barangays</option>
            {uniqueBarangays.map((brgy) => (
              <option key={brgy} value={brgy}>{brgy}</option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              showArchived
                ? "bg-amber-100 text-amber-600 border border-amber-200"
                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            {showArchived ? "📁 View Active" : "📂 View Archives"}
          </button>
        </div>
      </div>

      {/* --- REGISTRY GRID --- */}
      <div className="w-full">
        {isLoading ? (
          <div className="bg-white rounded-[2.5rem] py-20 text-center space-y-4 border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Syncing Registry...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((citizen) => (
              <div
                key={citizen.id}
                className="group relative bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
              >
                {/* Card Content (Existing) */}
                <div className="flex justify-between items-start mb-4">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${citizen.is_archived ? "bg-slate-100" : "bg-emerald-50 border border-emerald-100"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${citizen.is_archived ? "bg-slate-400" : "bg-emerald-500"}`} />
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${citizen.is_archived ? "text-slate-500" : "text-emerald-700"}`}>
                      {citizen.is_archived ? "Archived" : "Active Resident"}
                    </span>
                  </div>
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">ID-{citizen.id.slice(0, 8)}</p>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">{citizen.name}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">{citizen.email || "No email provided"}</p>
                </div>

                <div className={`p-4 rounded-2xl mb-6 transition-colors ${citizen.barangay === "Unassigned" ? "bg-amber-50 border border-amber-100" : "bg-slate-50 border border-transparent"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{citizen.barangay === "Unassigned" ? "❓" : "📍"}</span>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Assigned Area</p>
                      <p className={`text-xs font-black ${citizen.barangay === "Unassigned" ? "text-amber-700" : "text-slate-700"}`}>
                        {citizen.barangay === "Unassigned" ? "Pending Location Update" : `Brgy. ${citizen.barangay}`}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCitizen(citizen)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95"
                >
                  Manage Profile
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- DETAILS MODAL --- */}
      {selectedCitizen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedCitizen(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`h-1.5 w-full ${selectedCitizen.is_archived ? "bg-slate-400" : "bg-emerald-500"}`} />
            <div className="p-8">
              <div className="flex justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedCitizen.name}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Resident Profile</p>
                </div>
                <button onClick={() => setSelectedCitizen(null)} className="text-slate-400 hover:text-slate-900">✕</button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Barangay</p>
                    <p className="text-xs font-bold text-slate-800">{selectedCitizen.barangay}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Purok</p>
                    <p className="text-xs font-bold text-slate-800">{selectedCitizen.purok}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  {!selectedCitizen.is_archived && (
                    <button
                      className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] uppercase hover:bg-slate-50"
                      onClick={() => {
                        onEditProfile(selectedCitizen);
                        setSelectedCitizen(null);
                      }}
                    >
                      Edit Profile
                    </button>
                  )}
                  <button
                    onClick={() => setCitizenToArchive(selectedCitizen)}
                    className={`flex-1 py-4 border rounded-xl font-black text-[10px] uppercase transition-all ${
                      selectedCitizen.is_archived
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white"
                        : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white"
                    }`}
                  >
                    {selectedCitizen.is_archived ? "Restore Resident" : "Archive Resident"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM ARCHIVE CONFIRMATION MODAL (EcoRoute Style) --- */}
      {citizenToArchive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setCitizenToArchive(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl ${citizenToArchive.is_archived ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {citizenToArchive.is_archived ? "♻️" : "📁"}
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">
              {citizenToArchive.is_archived ? "Restore Resident?" : "Archive Resident?"}
            </h3>
            <p className="text-xs font-bold text-slate-400 mb-8 leading-relaxed px-4">
              {citizenToArchive.is_archived 
                ? `Are you sure you want to restore ${citizenToArchive.name} to the active registry?`
                : `This will move ${citizenToArchive.name} to the archives. They can be restored later.`}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleArchiveToggle}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  citizenToArchive.is_archived 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                    : "bg-slate-900 text-white hover:bg-red-600"
                }`}
              >
                Confirm {citizenToArchive.is_archived ? "Restore" : "Archive"}
              </button>
              <button
                onClick={() => setCitizenToArchive(null)}
                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}