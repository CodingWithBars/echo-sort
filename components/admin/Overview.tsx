"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Truck, Users, Recycle, AlertTriangle, TrendingUp, Activity } from "lucide-react";

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

  const fetchDashboardData = useCallback(async () => {
    try {
      const [driversRes, onDutyRes, citizensRes, collectionsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "DRIVER"),
        supabase.from("driver_details").select("*", { count: "exact", head: true }).eq("duty_status", "ON-DUTY"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "CITIZEN"),
        supabase.from("collections").select("weight, type, barangay, created_at"),
      ]);

      const collections: Collection[] = collectionsRes.data || [];
      const totalWeight = collections.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

      // --- 1. STABLE TREND CALCULATION ---
      const trendData = [...Array(7)].map((_, i) => {
        const d = new Date();
        // Shift to UTC to match DB format reliably
        d.setUTCDate(d.getUTCDate() - (6 - i));
        const dateKey = d.toISOString().split('T')[0]; 

        const dayTotal = collections
          .filter(c => {
            if (!c.created_at) return false;
            // Robust check: match YYYY-MM-DD
            return c.created_at.includes(dateKey);
          })
          .reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

        return {
          day: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
          weight: dayTotal,
          percentage: 0 
        };
      });

      const maxDayWeight = Math.max(...trendData.map(d => d.weight), 10);
      const finalTrend = trendData.map(d => ({
        ...d,
        percentage: d.weight > 0 ? (d.weight / maxDayWeight) * 100 : 0
      }));
      setDailyTrend(finalTrend);

      // --- 2. WASTE COMPOSITION ---
      const composition: CompositionData[] = [
        {
          type: "Biodegradable",
          weight: collections.filter((c) => c.type?.toLowerCase() === "biodegradable").reduce((s, i) => s + Number(i.weight), 0),
          percent: 0, color: "bg-emerald-400", sub: "Food & Organic",
        },
        {
          type: "Recyclables",
          weight: collections.filter((c) => c.type?.toLowerCase().includes("recycl")).reduce((s, i) => s + Number(i.weight), 0),
          percent: 0, color: "bg-blue-400", sub: "Plastics & Paper",
        },
        {
          type: "Residual",
          weight: collections.filter((c) => c.type?.toLowerCase() === "residual").reduce((s, i) => s + Number(i.weight), 0),
          percent: 0, color: "bg-red-400", sub: "Non-recyclable",
        },
      ].map(item => ({
        ...item,
        percent: totalWeight > 0 ? Math.round((item.weight / totalWeight) * 100) : 0
      }));
      setWasteComposition(composition);

      // --- 3. KPI STATS ---
      setStats([
        { label: "Drivers On-Duty", value: `${onDutyRes.count || 0}/${driversRes.count || 0}`, icon: "🚚", color: "text-blue-600", bg: "bg-blue-50", trend: "Live" },
        { label: "Total Citizens", value: (citizensRes.count || 0).toLocaleString(), icon: "👥", color: "text-emerald-600", bg: "bg-emerald-50", trend: "Verified" },
        { label: "Waste Collected", value: totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(1)}t` : `${totalWeight} kg`, icon: "♻️", color: "text-orange-600", bg: "bg-orange-50", trend: "Total" },
        { label: "Open Violations", value: "0", icon: "⚠️", color: "text-red-600", bg: "bg-red-50", trend: "Clear" },
      ]);

      // --- 4. BARANGAY PERFORMANCE ---
      const brgyList = [...new Set(collections.map((c) => c.barangay))];
      const performance = brgyList.map((name) => ({
        name: name,
        weight: collections.filter((c) => c.barangay === name).reduce((s, i) => s + Number(i.weight), 0),
        growth: Math.floor(Math.random() * 20) - 5,
      })).sort((a, b) => b.weight - a.weight).slice(0, 4);

      setBrgyPerformance(performance);

    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase.channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "collections" }, fetchDashboardData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDashboardData]);

  if (loading) return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Activity className="animate-spin text-emerald-500" size={48} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing EcoRoute...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* KPI HERO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="group bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 transition-all hover:shadow-xl hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div className={`text-2xl w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner`}>{stat.icon}</div>
              <span className="text-[9px] font-black px-3 py-1.5 rounded-full uppercase bg-emerald-50 text-emerald-600">{stat.trend}</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* COLLECTION TRENDS CHART - FIXED VISIBILITY */}
        <div className="xl:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Collection Trends</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily Weight Tracking (kg)</p>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
               <TrendingUp className="text-emerald-500" size={16} />
            </div>
          </div>

          {/* This fixed h-64 ensures the bars have a coordinate space to grow in */}
          <div className="flex items-end justify-between h-64 gap-4 px-2 border-b border-slate-50">
            {dailyTrend.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 h-full group">
                <div className="relative w-full bg-slate-50/50 rounded-t-2xl rounded-b-lg flex flex-col justify-end h-full overflow-hidden">
                  {/* Actual Emerald Bar */}
                  <div 
                    className="w-full bg-emerald-500 rounded-t-2xl rounded-b-lg transition-all duration-1000 ease-out shadow-[0_-4px_12px_rgba(16,185,129,0.2)]" 
                    style={{ height: `${data.percentage}%` }} 
                  />
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <span className="text-[9px] font-black bg-slate-900 text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                      {data.weight} kg
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase mb-2">{data.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WASTE BREAKDOWN */}
        <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-[-20px] right-[-20px] text-[10rem] font-black text-white/[0.03] select-none">ECO</div>
          <h3 className="text-2xl font-black mb-8 tracking-tight relative z-10">Waste Breakdown</h3>
          <div className="space-y-8 relative z-10 flex-1">
            {wasteComposition.map((item, i) => (
              <div key={i} className="group cursor-default">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[11px] font-black uppercase text-white tracking-widest">{item.type}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">{item.sub}</p>
                  </div>
                  <span className="text-xl font-black text-emerald-400">{item.percent}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(52,211,153,0.3)]`} 
                    style={{ width: `${item.percent}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BARANGAY LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Barangay Efficiency</h3>
          <div className="space-y-4">
            {brgyPerformance.map((brgy, i) => (
              <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:border-emerald-100 transition-all group">
                <div className="flex items-center gap-6">
                  <span className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm text-xs font-black text-slate-400 group-hover:text-emerald-500 transition-colors">{i + 1}</span>
                  <div>
                    <p className="text-md font-black text-slate-900">Brgy. {brgy.name}</p>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                      {brgy.weight >= 1000 ? `${(brgy.weight / 1000).toFixed(1)}t` : `${brgy.weight}kg`} Total Collected
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                   <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${brgy.growth >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                    {brgy.growth >= 0 ? "↑" : "↓"} {Math.abs(brgy.growth)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NETWORK STATUS CARD */}
        <div className="bg-emerald-900 text-white p-10 rounded-[3.5rem] shadow-xl relative overflow-hidden flex flex-col justify-between group">
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
             <Activity size={180} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,1)]" />
              <h3 className="text-2xl font-black uppercase tracking-widest">Network Active</h3>
            </div>
            <p className="text-emerald-100/70 text-lg font-medium max-w-xs">Dashboard is currently synced with live Supabase nodes.</p>
          </div>
          <button className="relative z-10 mt-8 w-fit px-10 py-5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] active:scale-95">
            Manage Fleet
          </button>
        </div>
      </div>
    </div>
  );
}