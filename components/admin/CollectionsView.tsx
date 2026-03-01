"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, ChevronDown, Download, Truck, Trophy, X } from "lucide-react";

const supabase = createClient();

interface CollectionRecord {
  barangay: string;
  weight: number;
  type: string;
  created_at: string;
}

interface BarangaySummary {
  name: string;
  weight: number;
  status: "High" | "Normal" | "Low";
  lastCollection: string;
  count: number;
}

export default function CollectionsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("weight-high");
  const [selectedBrgy, setSelectedBrgy] = useState<BarangaySummary | null>(
    null,
  );
  const [barangays, setBarangays] = useState<BarangaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("collections")
        .select("barangay, weight, type, created_at");

      if (error) throw error;

      const rawData: CollectionRecord[] = data || [];

      // --- GROUP DATA BY BARANGAY ---
      const grouped = rawData.reduce((acc: Record<string, any>, curr) => {
        if (!acc[curr.barangay]) {
          acc[curr.barangay] = {
            name: curr.barangay,
            weight: 0,
            count: 0,
            latest: curr.created_at,
          };
        }
        acc[curr.barangay].weight += Number(curr.weight);
        acc[curr.barangay].count += 1;
        if (new Date(curr.created_at) > new Date(acc[curr.barangay].latest)) {
          acc[curr.barangay].latest = curr.created_at;
        }
        return acc;
      }, {});

      // --- CALCULATE STATUS BASED ON VOLUME ---
      const formatted: BarangaySummary[] = Object.values(grouped).map(
        (b: any) => ({
          name: b.name,
          weight: b.weight,
          count: b.count,
          lastCollection: new Date(b.latest).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          status: b.weight > 1000 ? "High" : b.weight > 400 ? "Normal" : "Low",
        }),
      );

      setBarangays(formatted);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    document.body.style.overflow = selectedBrgy ? "hidden" : "unset";
  }, [selectedBrgy]);

  const statusRank: Record<string, number> = { High: 3, Normal: 2, Low: 1 };

  const filteredBarangays = barangays
    .filter((brgy) =>
      brgy.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "weight-high":
          return b.weight - a.weight;
        case "weight-low":
          return a.weight - b.weight;
        case "status-high":
          return statusRank[b.status] - statusRank[a.status];
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "High":
        return "bg-red-500";
      case "Normal":
        return "bg-emerald-500";
      default:
        return "bg-amber-500";
    }
  };

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center animate-pulse text-emerald-500 font-black italic uppercase tracking-widest">
        Scanning Collection Nodes...
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* --- UNIFIED FILTER BAR --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-[2.5rem] border border-slate-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] items-stretch">
        {/* SEARCH BLOCK */}
        <div className="relative flex-1 group h-14 md:h-16">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search barangay..."
            className="w-full h-full pl-14 pr-6 bg-slate-50 border border-transparent rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-300"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* SORT BLOCK */}
        <div className="relative min-w-[240px] h-14 md:h-16 group">
          <select
            className="w-full h-full appearance-none px-8 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-[1.8rem] outline-none cursor-pointer hover:bg-slate-800 hover:shadow-xl hover:shadow-emerald-900/10 transition-all duration-300"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <option value="name-asc">Sort: A - Z Name</option>
            <option value="weight-high">Sort: Highest Weight</option>
            <option value="weight-low">Sort: Lowest Weight</option>
            <option value="status-high">Sort: Critical Status</option>
          </select>

          {/* CUSTOM ICON CONTAINER */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
            <ChevronDown
              className="text-emerald-400 group-hover:translate-y-0.5 transition-transform duration-300"
              size={16}
              strokeWidth={3}
            />
          </div>

          {/* DECORATIVE LEFT ACCENT FOR SELECT */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-6 bg-white/10" />
        </div>
      </div>

      {/* --- COLLECTION GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBarangays.map((brgy) => (
          <div
            key={brgy.name}
            onClick={() => setSelectedBrgy(brgy)}
            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group overflow-hidden transition-all hover:border-emerald-200 active:scale-[0.98] cursor-pointer"
          >
            <div className={`h-2 w-full ${getStatusColor(brgy.status)}`} />
            <div className="p-8 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <span
                  className={`text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
                    brgy.status === "High"
                      ? "bg-red-50 text-red-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {brgy.status} Volume
                </span>
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-tighter">
                  {brgy.count} SESSIONS
                </span>
              </div>

              <h3 className="font-black text-slate-900 text-2xl tracking-tighter italic uppercase mb-2">
                {brgy.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-slate-900 leading-none tracking-tighter">
                  {brgy.weight.toLocaleString()}
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  kg Total
                </span>
              </div>

              {/* Progress Bar with fixed height to avoid collapsing */}
              <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden mb-6 p-0.5 border border-slate-100">
                <div
                  className={`${getStatusColor(brgy.status)} h-full rounded-full transition-all duration-1000`}
                  style={{
                    width: `${Math.min((brgy.weight / 2000) * 100, 100)}%`,
                  }}
                />
              </div>

              <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-50">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Updated {brgy.lastCollection}
                </p>
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                  →
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- DETAIL BOTTOM SHEET --- */}
      {selectedBrgy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setSelectedBrgy(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500">
            <div
              className={`h-2 w-full ${getStatusColor(selectedBrgy.status)}`}
            />
            <div className="p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">
                    Brgy. {selectedBrgy.name}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Regional Efficiency Data
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBrgy(null)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Cumulative Weight
                    </p>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">
                      {selectedBrgy.weight}kg
                    </p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Total Logs
                    </p>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">
                      {selectedBrgy.count}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-emerald-600 rounded-[2rem] text-white flex justify-between items-center relative overflow-hidden group">
                  <Trophy
                    className="absolute right-[-10px] bottom-[-10px] opacity-20 group-hover:rotate-12 transition-transform"
                    size={100}
                  />
                  <div className="relative z-10">
                    <p className="text-[9px] font-black text-emerald-100 uppercase tracking-widest mb-1">
                      Target Achievement
                    </p>
                    <p className="text-xl font-black uppercase italic tracking-tighter">
                      Optimal Sector
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button className="flex-1 py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-50 transition-all">
                    <Download className="inline-block mr-2" size={14} /> Report
                  </button>
                  <button className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-xl hover:bg-emerald-600 transition-all">
                    Generate Sector Insight
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredBarangays.length === 0 && (
        <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
          <Truck className="mx-auto mb-4 text-slate-200" size={48} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
            No collection data nodes found
          </p>
        </div>
      )}
    </div>
  );
}
