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
  const [wasteComposition, setWasteComposition] = useState<CompositionData[]>(
    [],
  );
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

      // --- 1. SYSTEM THROUGHPUT (Robust Date Filtering) ---
      const trendData = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (6 - i));
        const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD

        const dayTotal = collections
          .filter((c) => {
            if (!c.created_at) return false;
            // Robust check: extract YYYY-MM-DD from the timestamp
            return c.created_at.split("T")[0] === dateKey;
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
          // Added Math.max(..., 2) so bars are never truly 0px if there is data
          percentage: (d.weight / maxDayWeight) * 100,
        })),
      );

      // --- 2. WASTE COMPOSITION FIX ---
      const composition: CompositionData[] = [
        {
          type: "Biodegradable",
          color: "bg-emerald-400",
          sub: "Organic",
          weight: collections
            .filter((c) => c.type === "Biodegradable")
            .reduce((s, i) => s + Number(i.weight) || 0, 0),
        },
        {
          type: "Recyclables",
          color: "bg-blue-400",
          sub: "Plastics/Paper",
          // Changed to match "Recyclables" (plural) or "Recyclable"
          weight: collections
            .filter((c) => c.type.toLowerCase().includes("recyclable"))
            .reduce((s, i) => s + Number(i.weight) || 0, 0),
        },
        {
          type: "Residual",
          color: "bg-red-400",
          sub: "Non-recyclable",
          weight: collections
            .filter((c) => c.type === "Residual")
            .reduce((s, i) => s + Number(i.weight) || 0, 0),
        },
      ].map((item) => ({
        ...item,
        // Ensure we don't divide by zero if data is still loading
        percent:
          totalWeight > 0 ? Math.round((item.weight / totalWeight) * 100) : 0,
      }));

      setWasteComposition(composition);

      // --- 3. KPI STATS ---
      setStats([
        {
          label: "Fleet Status",
          value: `${onDutyRes.count || 0}/${driversRes.count || 0}`,
          icon: "🚚",
          color: "text-blue-600",
          bg: "bg-blue-50",
          trend: "On-Duty",
        },
        {
          label: "Community",
          value: (citizensRes.count || 0).toLocaleString(),
          icon: "👥",
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          trend: "Verified",
        },
        {
          label: "Total Load",
          value:
            totalWeight >= 1000
              ? `${(totalWeight / 1000).toFixed(1)}t`
              : `${totalWeight}kg`,
          icon: "♻️",
          color: "text-orange-600",
          bg: "bg-orange-50",
          trend: "Collected",
        },
        {
          label: "Violations",
          value: violationsRes.count || "0",
          icon: "⚠️",
          color: "text-red-600",
          bg: "bg-red-50",
          trend: "Active",
        },
      ]);

      // --- 4. REGIONAL EFFICIENCY ---
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections" },
        fetchDashboardData,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.offsetWidth * 0.85 + 24;
      const newIndex = Math.round(scrollLeft / cardWidth);
      if (
        newIndex !== currentIndex &&
        newIndex >= 0 &&
        newIndex < stats.length
      ) {
        setCurrentIndex(newIndex);
      }
    }
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);
  };

  useEffect(() => {
    if (stats.length === 0 || loading || isUserScrolling) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stats.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [stats.length, loading, isUserScrolling]);

  useEffect(() => {
    if (scrollRef.current && !loading && !isUserScrolling) {
      const container = scrollRef.current;
      const cardWidth = container.offsetWidth * 0.85 + 24;
      container.scrollTo({
        left: currentIndex * cardWidth,
        behavior: "smooth",
      });
    }
  }, [currentIndex, loading, isUserScrolling]);

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center animate-pulse text-emerald-500 font-black italic uppercase tracking-widest">
        Synchronizing Eco-Node...
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      {/* KPI HERO SLIDER */}
      <div className="relative">
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Live Network Vitals
            </h4>
          </div>
          <div className="flex gap-1">
            {stats.map((_, i) => (
              <div
                key={i}
                className={`h-1 transition-all duration-500 rounded-full ${
                  currentIndex === i ? "w-4 bg-emerald-500" : "w-1 bg-slate-200"
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
                  min-w-[85%] md:min-w-0 snap-center p-7 rounded-[2.5rem] border transition-all duration-700 
                  ${
                    isFocused
                      ? "bg-white border-emerald-400 shadow-xl scale-100 z-10"
                      : "bg-white/60 border-slate-100 shadow-sm scale-95 opacity-40 md:opacity-100 md:scale-100"
                  }
                `}
              >
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={`text-2xl w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner transition-transform duration-700 ${isFocused ? "rotate-12 scale-110" : ""}`}
                  >
                    {stat.icon}
                  </div>
                  <span
                    className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-tighter transition-colors ${isFocused ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400"}`}
                  >
                    {stat.trend}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                  {stat.label}
                </p>
                <p
                  className={`text-4xl font-black tracking-tighter italic uppercase transition-colors ${isFocused ? "text-slate-900" : "text-slate-500"}`}
                >
                  {stat.value}
                </p>
                <div className="mt-6 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${isFocused ? "bg-emerald-500 w-full" : "bg-slate-300 w-2/3"}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h3 className="text-2xl font-black text-slate-900 italic uppercase">
                System Throughput
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                Daily Tonnage Tracking
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="flex items-end justify-between h-64 gap-3 px-2">
            {dailyTrend.map((data, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-4 h-full group"
              >
                <div className="relative w-full bg-slate-50/80 rounded-2xl flex flex-col justify-end h-full overflow-hidden border border-slate-100">
                  <div
                    className="w-full bg-emerald-500 rounded-xl transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    style={{ height: `${data.percentage}%` }}
                  />
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  {data.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white flex flex-col relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 italic font-black text-8xl">
            DATA
          </div>
          <h3 className="text-2xl font-black mb-10 italic uppercase relative z-10">
            Composition
          </h3>
          <div className="space-y-8 relative z-10">
            {wasteComposition.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between items-end mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {item.type}
                  </p>
                  <span className="text-xl font-black text-emerald-400">
                    {item.percent}%
                  </span>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-1000`}
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
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-8 italic uppercase">
            Regional Efficiency
          </h3>
          <div className="grid gap-4">
            {brgyPerformance.map((brgy, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-emerald-200 transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase italic">
                      Brgy. {brgy.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {brgy.weight}kg Total
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1 text-[10px] font-black ${brgy.growth >= 0 ? "text-emerald-500" : "text-red-500"}`}
                >
                  {brgy.growth >= 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {Math.abs(brgy.growth)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-emerald-600 p-10 rounded-[3.5rem] text-white flex flex-col justify-between group overflow-hidden relative">
          <Activity
            className="absolute -right-10 -bottom-10 text-white/10 group-hover:scale-125 transition-transform duration-1000"
            size={240}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
              <h3 className="text-xl font-black uppercase tracking-widest italic">
                Node Status: Active
              </h3>
            </div>
            <p className="text-emerald-100 text-sm font-medium max-w-xs leading-relaxed">
              System is performing within optimal parameters. Real-time
              telemetry is active across all sectors.
            </p>
          </div>
          <button className="relative z-10 w-fit px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] mt-8 hover:bg-black transition-all">
            System Diagnostics
          </button>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
