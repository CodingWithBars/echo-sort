"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search,
  ChevronDown,
  Download,
  Truck,
  Trophy,
  X,
  BarChart3,
  History,
  ArrowRight,
} from "lucide-react";

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
      <div className="h-96 flex items-center justify-center animate-pulse text-emerald-600 font-black italic uppercase tracking-[0.2em] text-[10px]">
        Syncing Fleet Intelligence...
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* --- DETACHED NAV BAR (FLEET NAVIGATION STYLE) --- */}
      <div className="flex flex-row gap-3 items-stretch w-full">
        {/* SEARCH BLOCK - Full height maintained on mobile */}
        <div className="relative flex-1 group min-w-0 rounded-2xl shadow-sm">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-all duration-300">
            <Search size={18} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            placeholder="SEARCH SECTOR NODES..."
            className="w-full h-full pl-14 pr-6 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] outline-none focus:border-emerald-500 focus:ring-4 ring-emerald-500/5 transition-all shadow-sm placeholder:text-slate-300"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* SORT BLOCK - Matching the tactile button style */}
        <div className="relative min-w-[260px] h-14 md:h-16 lg:h-14 group">
          <select
            className="w-full h-full appearance-none px-8 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl outline-none cursor-pointer hover:bg-slate-800 transition-all duration-300 border-b-4 border-slate-700 active:border-b-0 active:translate-y-[2px] shadow-sm"
            onChange={(e) => setSortBy(e.target.value)}
            value={sortBy}
          >
            <option value="weight-high text-slate-900">
              SORT: HIGHEST VOLUME
            </option>
            <option value="weight-low">SORT: LOWEST VOLUME</option>
            <option value="status-high">SORT: CRITICAL STATUS</option>
            <option value="name-asc">SORT: ALPHABETICAL</option>
          </select>

          {/* CUSTOM ICON CONTAINER */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            <ChevronDown
              className="text-emerald-400 group-hover:translate-y-0.5 transition-transform duration-300"
              size={18}
              strokeWidth={3}
            />
          </div>

          {/* DECORATIVE LEFT ACCENT */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-6 bg-white/10" />
        </div>
      </div>

      {/* --- GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBarangays.map((brgy) => (
          <div
            key={brgy.name}
            onClick={() => setSelectedBrgy(brgy)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:border-emerald-300 active:scale-[0.98] cursor-pointer group"
          >
            <div className={`h-1.5 w-full ${getStatusColor(brgy.status)}`} />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`text-[8px] font-black px-2 py-1 rounded border uppercase tracking-widest ${
                    brgy.status === "High"
                      ? "border-red-100 text-red-600 bg-red-50"
                      : "border-emerald-100 text-emerald-600 bg-emerald-50"
                  }`}
                >
                  {brgy.status} Priority
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                  {brgy.count} LOGS
                </span>
              </div>

              <h3 className="font-black text-slate-900 text-xl tracking-tighter italic uppercase mb-1">
                {brgy.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-black text-slate-900 tracking-tighter">
                  {brgy.weight.toLocaleString()}
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase">
                  KG
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden mb-5">
                <div
                  className={`${getStatusColor(brgy.status)} h-full transition-all duration-1000`}
                  style={{
                    width: `${Math.min((brgy.weight / 2000) * 100, 100)}%`,
                  }}
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  SYNCED: {brgy.lastCollection}
                </p>
                <ArrowRight
                  size={16}
                  className="text-slate-300 group-hover:text-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- DETAIL MODAL (MATCHING NEW STYLE) --- */}
      {selectedBrgy && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setSelectedBrgy(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6">
            <div
              className={`h-1.5 w-full ${getStatusColor(selectedBrgy.status)}`}
            />
            <div className="p-8 md:p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">
                    Sector: {selectedBrgy.name}
                  </h2>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                    Operational Intelligence Report
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBrgy(null)}
                  className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Cumulative Net
                  </p>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">
                    {selectedBrgy.weight}kg
                  </p>
                </div>
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Total Logs
                  </p>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">
                    {selectedBrgy.count}
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-xl text-white relative overflow-hidden mb-8 group">
                <Trophy
                  className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:rotate-12 transition-transform duration-700"
                  size={100}
                />
                <div className="relative z-10">
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                    Sector Benchmark
                  </p>
                  <p className="text-xl font-black uppercase italic tracking-tighter">
                    Optimal Collection Tier
                  </p>
                </div>
              </div>

              {/* ACTION TRAY (Side-by-Side Grid for Mobile Fix) */}
              <div className="grid grid-cols-2 gap-3">
                <button className="h-14 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Download size={14} /> Report
                </button>
                <button className="h-14 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95">
                  Generate Insights
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredBarangays.length === 0 && (
        <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-100">
          <Truck className="mx-auto mb-4 text-slate-200" size={40} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-[9px]">
            No data nodes detected in this sector
          </p>
        </div>
      )}
    </div>
  );
}
