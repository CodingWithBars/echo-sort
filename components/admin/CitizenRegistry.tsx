"use client";

import { useState, useEffect, useCallback } from "react";
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
  is_archived: boolean; // Added for archive toggle
}

interface CitizenDetail {
  id: string;
  barangay: string;
  purok: string;
}

interface CitizenRegistryProps {
  onEditProfile: (citizen: Citizen) => void;
}

export default function CitizenRegistry({
  onEditProfile,
}: CitizenRegistryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBrgy, setFilterBrgy] = useState("All");
  const [showArchived, setShowArchived] = useState(false); // Archive toggle state
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 1. DATA FETCHING ---
  const fetchCitizens = useCallback(async () => {
    setIsLoading(true);

    const [profilesRes, detailsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, updated_at, is_archived")
        .eq("role", "CITIZEN")
        .eq("is_archived", showArchived) // Toggle based on button
        .order("full_name", { ascending: true }),
      supabase
        .from("citizen_details")
        .select("id, barangay, purok")
    ]);

    // DEBUG: Check if citizen_details is returning anything
    console.log("Citizen Details Count:", detailsRes.data?.length);

    if (profilesRes.error || detailsRes.error) {
      console.error("❌ Error:", profilesRes.error?.message || detailsRes.error?.message);
    } else if (profilesRes.data) {
      const detailsMap = new Map<string, CitizenDetail>(
        (detailsRes.data as CitizenDetail[])?.map((detail) => [detail.id, detail])
      );

      const flattenedData = profilesRes.data.map((profile: any) => {
        const details = detailsMap.get(profile.id);
        return {
          id: profile.id,
          name: profile.full_name || "Unknown Resident",
          email: profile.email,
          barangay: details?.barangay || "Unassigned",
          purok: details?.purok || "N/A",
          violations: 0,
          created_at: profile.updated_at,
          is_archived: profile.is_archived
        };
      });

      setCitizens(flattenedData);
    }
    setIsLoading(false);
  }, [showArchived]);

  // --- 2. ARCHIVE/RESTORE LOGIC ---
  const handleArchiveToggle = async (citizen: Citizen) => {
    const action = citizen.is_archived ? "Restore" : "Archive";
    const confirmed = confirm(`${action} ${citizen.name}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("profiles")
      .update({ is_archived: !citizen.is_archived })
      .eq("id", citizen.id);

    if (error) {
      alert(`Failed to ${action.toLowerCase()} citizen.`);
    } else {
      setCitizens((prev) => prev.filter((c) => c.id !== citizen.id));
      setSelectedCitizen(null);
    }
  };

  // --- 3. EFFECTS ---
  useEffect(() => {
    fetchCitizens();
  }, [fetchCitizens]);

  const filtered = citizens.filter(
    (c) =>
      (filterBrgy === "All" || c.barangay === filterBrgy) &&
      (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toString().toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* --- FILTER BAR --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="relative flex-1 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search resident..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl md:rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500/20 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterBrgy}
            onChange={(e) => setFilterBrgy(e.target.value)}
            className="appearance-none px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-2xl outline-none cursor-pointer hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <option value="All">All Barangays</option>
            <option value="Ilangay">Ilangay</option>
            <option value="San Jose">San Jose</option>
            <option value="Unassigned">Unassigned</option>
          </select>

          {/* ARCHIVE TOGGLE BUTTON */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-6 py-3 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              showArchived 
                ? "bg-amber-100 text-amber-600 border border-amber-200" 
                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            {showArchived ? "📁 View Active" : "📂 View Archives"}
          </button>
        </div>
      </div>

      {/* --- REGISTRY TABLE --- */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Syncing Data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/30">
                  <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resident</th>
                  <th className="hidden md:table-cell px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((citizen) => (
                  <tr key={citizen.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 md:px-8 py-4">
                      <p className="text-sm font-black text-slate-900 leading-tight">{citizen.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">ID-{citizen.id.slice(0, 8)}</p>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-xs font-bold text-slate-600">
                      {citizen.barangay === "Unassigned" ? (
                        <span className="text-amber-500 underline decoration-dotted">Missing Details</span>
                      ) : (
                        `Brgy. ${citizen.barangay}`
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${citizen.is_archived ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                        <span className={`text-[10px] font-black uppercase ${citizen.is_archived ? 'text-slate-400' : 'text-emerald-500'}`}>
                          {citizen.is_archived ? "Archived" : "Active"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-4 text-right">
                      <button
                        onClick={() => setSelectedCitizen(citizen)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- DETAILS MODAL --- */}
      {selectedCitizen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedCitizen(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`h-1.5 w-full ${selectedCitizen.is_archived ? 'bg-slate-400' : 'bg-emerald-500'}`} />
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
                      className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] uppercase hover:bg-slate-50 transition-all"
                      onClick={() => { onEditProfile(selectedCitizen); setSelectedCitizen(null); }}
                    >
                      Edit Profile
                    </button>
                  )}
                  <button
                    onClick={() => handleArchiveToggle(selectedCitizen)}
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
    </div>
  );
}