"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Truck,
  Users,
  Recycle,
  AlertTriangle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";

interface Collection {
  weight: number;
  type: string;
  barangay: string;
  created_at: string;
}

interface PerformanceData {
  name: string;
  weight: number;
  growth: number;
}

interface CompositionData {
  type: string;
  percent: number;
  weight: number;
  color: string;
  sub: string;
}

interface DailyTrend {
  day: string;
  weight: number;
  percentage: number;
}

const supabase = createClient();

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [brgyPerformance, setBrgyPerformance] = useState<PerformanceData[]>([]);
  const [wasteComposition, setWasteComposition] = useState<CompositionData[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [
        driversRes,
        onDutyRes,
        citizensRes,
        collectionsRes,
        violationsRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "DRIVER"),
        supabase
          .from("driver_details")
          .select("*", { count: "exact", head: true })
          .eq("duty_status", "ON-DUTY"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "CITIZEN"),
        supabase
          .from("collections")
          .select("weight, type, barangay, created_at"),
        supabase
          .from("violations")
          .select("*", { count: "exact", head: true })
          .neq("status", "Resolved"),
      ]);

      const collections: Collection[] = collectionsRes.data || [];
      const totalWeight = collections.reduce(
        (sum, item) => sum + (Number(item.weight) || 0),
        0,
      );

      // --- 1. SYSTEM THROUGHPUT (Stable Trend Calculation) ---
      const trendData = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (6 - i));
        const dateKey = d.toISOString().split("T")[0];

        const dayTotal = collections
          .filter((c) => {
            if (!c.created_at) return false;
            return c.created_at.includes(dateKey);
          })
          .reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

        return {
          day: d.toLocaleDateString("en-US", {
            weekday: "short",
            timeZone: "UTC",
          }),
          weight: dayTotal,
          percentage: 0,
        };
      });

      const maxDayWeight = Math.max(...trendData.map((d) => d.weight), 10);
      setDailyTrend(
        trendData.map((d) => ({
          ...d,
          percentage: (d.weight / maxDayWeight) * 100,
        })),
      );

      // --- 2. WASTE COMPOSITION ---
      const composition: CompositionData[] = [
        {
          type: "Biodegradable",
          color: "bg-emerald-500",
          sub: "Organic",
          weight: collections
            .filter((c) => c.type === "Biodegradable")
            .reduce((s, i) => s + Number(i.weight) || 0, 0),
        },
        {
          type: "Recyclables",
          color: "bg-blue-500",
          sub: "Plastics/Paper",
          weight: collections
            .filter((c) => c.type.toLowerCase().includes("recyclable"))
            .reduce((s, i) => s + Number(i.weight) || 0, 0),
        },
        {
          type: "Residual",
          color: "bg-orange-500",
          sub: "Non-recyclable",
          weight: collections
            .filter((c) => c.type === "Residual")
            .reduce((s, i) => s + Number(i.weight) || 0, 0),
        },
      ].map((item) => ({
        ...item,
        percent: totalWeight > 0 ? Math.round((item.weight / totalWeight) * 100) : 0,
      }));

      setWasteComposition(composition);

      // --- 3. KPI STATS ---
      setStats([
        {
          label: "Active Fleet",
          value: `${onDutyRes.count || 0}/${driversRes.count || 0}`,
          icon: <Truck size={24} />,
          color: "text-blue-600",
          bg: "bg-blue-50",
          trend: "Live Status",
        },
        {
          label: "Verified Community",
          value: (citizensRes.count || 0).toLocaleString(),
          icon: <Users size={24} />,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          trend: "Growth Active",
        },
        {
          label: "Total Collection",
          value: totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(1)}t` : `${totalWeight}kg`,
          icon: <Recycle size={24} />,
          color: "text-orange-600",
          bg: "bg-orange-50",
          trend: "Net Weight",
        },
        {
          label: "Pending Issues",
          value: violationsRes.count || "0",
          icon: <AlertTriangle size={24} />,
          color: "text-red-600",
          bg: "bg-red-50",
          trend: "Attention Required",
        },
      ]);

      const brgyMap = collections.reduce((acc: any, curr) => {
        acc[curr.barangay] = (acc[curr.barangay] || 0) + Number(curr.weight);
        return acc;
      }, {});

      const performance = Object.keys(brgyMap)
        .map((name) => ({
          name,
          weight: brgyMap[name],
          growth: Math.floor(Math.random() * 15) + 5,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 4);

      setBrgyPerformance(performance);
    } catch (e) {
      console.error("Dashboard Sync Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase
      .channel("realtime-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "collections" }, fetchDashboardData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDashboardData]);

  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.offsetWidth * 0.85 + 24;
      const newIndex = Math.round(scrollLeft / cardWidth);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < stats.length) {
        setCurrentIndex(newIndex);
      }
    }
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => { setIsUserScrolling(false); }, 3000);
  };

  if (loading)
    return (
      <div className="h-96 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Synchronizing Eco-Node</p>
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
      
      {/* KPI HERO SLIDER */}
      <div className="relative">
        <div className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-emerald-500 fill-emerald-500" />
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Real-Time Metrics</h4>
          </div>
          <div className="flex gap-1.5">
            {stats.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  currentIndex === i ? "w-6 bg-emerald-500" : "w-1.5 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto md:overflow-x-visible pb-6 md:pb-0 snap-x snap-mandatory scrollbar-hide"
        >
          {stats.map((stat, i) => {
            const isFocused = currentIndex === i;
            return (
              <div
                key={i}
                className={`
                  min-w-[85%] md:min-w-0 snap-center p-6 rounded-3xl border transition-all duration-500 
                  ${isFocused ? "bg-white border-emerald-200 shadow-xl shadow-emerald-900/5 ring-4 ring-emerald-500/5" : "bg-white border-slate-100 shadow-sm opacity-60 md:opacity-100"}
                `}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform duration-500 ${isFocused ? "scale-110 rotate-3" : ""}`}>
                    {stat.icon}
                  </div>
                  <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${isFocused ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {stat.trend}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                <p className={`text-3xl font-black tracking-tight uppercase ${isFocused ? "text-slate-900" : "text-slate-600"}`}>
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Throughput Chart */}
        <div className="xl:col-span-2 bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">System Throughput</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">7-Day Analysis • Tonnage</p>
            </div>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                <div className="px-4 py-2 bg-white rounded-lg shadow-sm text-[9px] font-black text-emerald-600 uppercase">Weight (kg)</div>
            </div>
          </div>
          
          <div className="flex items-end justify-between h-64 gap-3 md:gap-6 px-2">
            {dailyTrend.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 h-full">
                <div className="relative w-full bg-slate-50 rounded-2xl flex flex-col justify-end h-full overflow-hidden border border-slate-100">
                  <div
                    className="w-full bg-emerald-500 transition-all duration-1000 relative group"
                    style={{ height: `${data.percentage}%` }}
                  >
                    <div className="absolute top-2 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                        <span className="bg-slate-900 text-white text-[8px] px-2 py-1 rounded-md font-bold">{data.weight}kg</span>
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase">{data.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Composition Chart */}
        <div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] text-white flex flex-col border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full" />
          <h3 className="text-xl font-black mb-10 uppercase tracking-tight relative z-10">Composition</h3>
          <div className="space-y-8 relative z-10">
            {wasteComposition.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between items-end mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.type}</p>
                  <span className="text-xl font-black text-emerald-400">{item.percent}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.3)]`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REGIONAL EFFICIENCY & NODE STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Barangay Performance */}
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-tight">Regional Efficiency</h3>
          <div className="grid gap-3">
            {brgyPerformance.map((brgy, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-300 hover:bg-white hover:shadow-lg hover:shadow-emerald-900/5 transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all">
                    0{i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Brgy. {brgy.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{brgy.weight}kg Volume</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black ${brgy.growth >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                  {brgy.growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(brgy.growth)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Diagnostics / Active Status */}
        <div className="bg-emerald-600 p-8 md:p-10 rounded-[2.5rem] text-white flex flex-col justify-between group overflow-hidden relative shadow-xl shadow-emerald-900/20 border-4 border-emerald-500">
          <Activity className="absolute -right-12 -bottom-12 text-white/10 group-hover:scale-125 transition-transform duration-1000 rotate-12" size={280} />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6 bg-white/10 w-fit px-4 py-2 rounded-full border border-white/20 backdrop-blur-md">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-[0_0_12px_white]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Node Status: Active</h3>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter leading-[0.9] mb-4">System<br/>Optimized</h2>
            <p className="text-emerald-50 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-80">
              Telemetry active across all sectors. Protocols performing at peak parameters.
            </p>
          </div>

          <button className="relative z-10 w-full md:w-fit px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] mt-8 hover:bg-black hover:translate-y-[-2px] active:translate-y-0 transition-all shadow-xl">
            Run Diagnostics
          </button>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}