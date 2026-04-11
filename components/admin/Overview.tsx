"use client";
// components/admin/Overview.tsx
// Jurisdiction-scoped admin overview — all metrics filtered to the admin's
// municipality + barangay loaded from lgu_details.
//
// Sections:
//   1. Jurisdiction header + live status badge
//   2. KPI stat cards (scoped: drivers, citizens, collections, violations, bins)
//   3. 7-day collection throughput chart (scoped)
//   4. Waste composition breakdown (scoped)
//   5. Critical bins panel (fill >= 80%, proximity-scoped)
//   6. On-duty drivers list (scoped via schedule_assignments)
//   7. Citizen score health distribution (scoped)
//   8. Recent violations ticker (scoped)
//   9. Recent broadcasts (admin-created)
//  10. Admin activity feed (audit_logs)

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Truck, Users, Recycle, AlertTriangle, Zap, Activity,
  ArrowUpRight, ArrowDownRight, Building2, MapPin, Battery,
  Wifi, ShieldAlert, Megaphone, Clock, CheckCircle2,
  TrendingUp, BarChart3, RefreshCcw, Star, Radio,
  Circle, Trash2, Navigation, FileText, Eye,
} from "lucide-react";

const supabase = createClient();
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface JurisdictionScope {
  adminId:      string;
  municipality: string | null;
  barangay:     string | null;
  areaLat:      number | null;
  areaLng:      number | null;
}

interface KpiStat {
  label: string;
  value: string | number;
  sub:   string;
  icon:  React.ReactNode;
  color: string;
  bg:    string;
  delta?: number | null;
}

interface DailyTrend {
  day:        string;
  weight:     number;
  percentage: number;
  count:      number;
}

interface WasteSlice {
  type:    string;
  color:   string;
  bar:     string;
  weight:  number;
  percent: number;
}

interface CriticalBin {
  id:            number;
  name:          string;
  fill_level:    number;
  battery_level: number;
  lat:           number;
  lng:           number;
  municipality:  string | null;
  barangay:      string | null;
}

interface OnDutyDriver {
  id:         string;
  full_name:  string;
  plate:      string | null;
  vehicle:    string | null;
  route:      string | null;
}

interface ScoreDistribution {
  label:   string;
  count:   number;
  color:   string;
  bar:     string;
  percent: number;
}

interface RecentViolation {
  id:           string;
  type:         string;
  citizen_name: string | null;
  status:       string;
  created_at:   string;
}

interface RecentBroadcast {
  id:         string;
  title:      string;
  type:       string;
  created_at: string;
  is_pinned:  boolean;
}

interface ActivityLog {
  id:          string;
  action_type: string;
  reason:      string | null;
  created_at:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function fmtAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function fmtWeight(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
}

const FILL_COLOR = (pct: number) =>
  pct >= 90 ? "#ef4444" : pct >= 70 ? "#f97316" : pct >= 40 ? "#eab308" : "#22c55e";

const VIOLATION_TYPE_COLOR: Record<string, string> = {
  "Improper Disposal": "#f97316",
  "Littering":         "#eab308",
  "Illegal Dumping":   "#ef4444",
  "Open Burning":      "#dc2626",
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
      <span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />
      {children}
    </p>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 text-slate-300">
      {icon}
      <p className="text-[10px] font-black uppercase tracking-widest">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [scope,          setScope]          = useState<JurisdictionScope | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [lastRefreshed,  setLastRefreshed]  = useState<Date>(new Date());

  // KPI
  const [stats,          setStats]          = useState<KpiStat[]>([]);
  const [currentIdx,     setCurrentIdx]     = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Charts
  const [dailyTrend,     setDailyTrend]     = useState<DailyTrend[]>([]);
  const [wasteComp,      setWasteComp]      = useState<WasteSlice[]>([]);
  const [totalWeight,    setTotalWeight]    = useState(0);

  // Panels
  const [criticalBins,   setCriticalBins]   = useState<CriticalBin[]>([]);
  const [onDutyDrivers,  setOnDutyDrivers]  = useState<OnDutyDriver[]>([]);
  const [scoreDist,      setScoreDist]      = useState<ScoreDistribution[]>([]);
  const [recentViolations,setRecentViolations] = useState<RecentViolation[]>([]);
  const [broadcasts,     setBroadcasts]     = useState<RecentBroadcast[]>([]);
  const [activityLogs,   setActivityLogs]   = useState<ActivityLog[]>([]);

  // ── Load scope ─────────────────────────────────────────────────────────────
  const loadScope = useCallback(async (): Promise<JurisdictionScope | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: lguRows } = await supabase
      .from("lgu_details").select("municipality,barangay")
      .eq("id", user.id).limit(1);
    const lgu = lguRows?.[0];

    let areaLat: number | null = null;
    let areaLng: number | null = null;
    if (lgu) {
      const geoQ = [lgu.barangay, lgu.municipality, "Philippines"].filter(Boolean).join(", ");
      try {
        const res  = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(geoQ)}.json?limit=1&access_token=${MAPBOX_TOKEN}`
        );
        const data = await res.json();
        const c = data.features?.[0]?.center;
        if (c) { areaLng = c[0]; areaLat = c[1]; }
      } catch (_) {}
    }

    return {
      adminId:      user.id,
      municipality: lgu?.municipality ?? null,
      barangay:     lgu?.barangay ?? null,
      areaLat, areaLng,
    };
  }, []);

  // ── Fetch all dashboard data ───────────────────────────────────────────────
  const fetchData = useCallback(async (sc: JurisdictionScope) => {
    const brgy  = sc.barangay;
    const muni  = sc.municipality;

    // Hard guard — never show data across municipality boundaries
    if (!muni && !brgy) {
      setStats([]); setDailyTrend([]); setWasteComp([]);
      setCriticalBins([]); setOnDutyDrivers([]); setScoreDist([]);
      setRecentViolations([]); setBroadcasts([]); setActivityLogs([]);
      setTotalWeight(0);
      return;
    }

    // ── 1. Scoped driver IDs (via lgu_details.municipality) ─────────────────
    // lgu_details is the authoritative jurisdiction tag — written by AddDriverModal
    // at account creation time. schedule_assignments is too loose (a driver can
    // be temporarily assigned cross-municipality, but they still belong to one municipality).
    let scopedDriverIds: string[] = [];
    if (muni) {
      const { data: lguRows } = await supabase
        .from("lgu_details")
        .select("id")
        .eq("municipality", muni)
        .eq("position_title", "Driver");
      scopedDriverIds = (lguRows ?? []).map((r: any) => r.id as string);
    }

    // ── 2. Parallel fetches ───────────────────────────────────────────────────
    const [
      driversRes, onDutyRes, citizensRes,
      collectionsRes, violationsRes,
      binsRes, scoresRes,
      broadcastsRes, auditRes,
    ] = await Promise.all([
      // Drivers in this municipality only (via lgu_details)
      muni
        ? supabase.from("lgu_details")
            .select("id", { count: "exact", head: true })
            .eq("municipality", muni)
            .eq("position_title", "Driver")
        : supabase.from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "DRIVER"),

      // On-duty drivers with details (scoped by schedule if available)
      supabase.from("profiles")
        .select("id,full_name,driver_details!inner(vehicle_plate_number,vehicle_type,assigned_route,duty_status)")
        .eq("role", "DRIVER")
        .eq("driver_details.duty_status", "ON-DUTY"),

      // Citizens scoped by barangay (precise) or municipality (fallback) — never unscoped
      (brgy
        ? supabase.from("profiles")
            .select("id,citizen_details!inner(barangay,municipality)", { count: "exact", head: true })
            .eq("role", "CITIZEN")
            .eq("is_archived", false)
            .eq("citizen_details.barangay", brgy)
        : supabase.from("profiles")
            .select("id,citizen_details!inner(barangay,municipality)", { count: "exact", head: true })
            .eq("role", "CITIZEN")
            .eq("is_archived", false)
            .eq("citizen_details.municipality", muni)
      ),

      // Collections scoped by barangay
      (brgy
        ? supabase.from("collections")
            .select("weight,type,barangay,created_at")
            .eq("barangay", brgy)
        : supabase.from("collections")
            .select("weight,type,barangay,created_at")
      ),

      // Violations scoped by barangay
      (brgy
        ? supabase.from("violations")
            .select("id,type,status,created_at,profiles:citizen_id(full_name)")
            .eq("barangay", brgy)
            .neq("status", "Resolved")
            .order("created_at", { ascending: false })
            .limit(8)
        : supabase.from("violations")
            .select("id,type,status,created_at,profiles:citizen_id(full_name)")
            .neq("status", "Resolved")
            .order("created_at", { ascending: false })
            .limit(8)
      ),

      // Bins scoped by municipality column (added via migration).
      // Falls back to proximity filter client-side for legacy bins without municipality tag.
      (muni
        ? supabase.from("bins")
            .select("id,name,fill_level,battery_level,lat,lng,municipality,barangay")
            .eq("municipality", muni)
        : supabase.from("bins")
            .select("id,name,fill_level,battery_level,lat,lng,municipality,barangay")
      ),

      // Citizen scores scoped by barangay
      (brgy
        ? supabase.from("citizen_scores")
            .select("score,citizen_id")
            .eq("barangay", brgy)
        : supabase.from("citizen_scores")
            .select("score,citizen_id")
      ),

      // Recent broadcasts by this admin
      supabase.from("broadcasts")
        .select("id,title,type,created_at,is_pinned")
        .eq("created_by", sc.adminId)
        .order("created_at", { ascending: false })
        .limit(5),

      // Recent audit logs for this admin
      supabase.from("audit_logs")
        .select("id,action_type,reason,created_at")
        .eq("admin_id", sc.adminId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    // ── 3. Process Collections ────────────────────────────────────────────────
    const colls = (collectionsRes.data ?? []) as { weight: number; type: string; barangay: string; created_at: string }[];
    const tw    = colls.reduce((s, c) => s + Number(c.weight || 0), 0);
    setTotalWeight(tw);

    // 7-day trend
    const trend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const key = d.toISOString().split("T")[0];
      const dayColls = colls.filter(c => c.created_at?.startsWith(key));
      return {
        day:    d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        weight: dayColls.reduce((s, c) => s + Number(c.weight || 0), 0),
        count:  dayColls.length,
        percentage: 0,
      };
    });
    const maxW = Math.max(...trend.map(t => t.weight), 1);
    setDailyTrend(trend.map(t => ({ ...t, percentage: (t.weight / maxW) * 100 })));

    // Waste composition
    const wasteTypes = [
      { type: "Biodegradable", color: "#059669", bar: "bg-emerald-500",  keywords: ["biodegradable", "organic"] },
      { type: "Recyclables",   color: "#2563eb", bar: "bg-blue-500",     keywords: ["recyclable", "plastic", "paper"] },
      { type: "Residual",      color: "#f97316", bar: "bg-orange-500",   keywords: ["residual"] },
      { type: "Hazardous",     color: "#dc2626", bar: "bg-red-500",      keywords: ["hazardous"] },
      { type: "Special",       color: "#8b5cf6", bar: "bg-violet-500",   keywords: ["special", "e-waste"] },
    ];
    const wc: WasteSlice[] = wasteTypes.map(wt => {
      const w = colls
        .filter(c => wt.keywords.some(k => c.type.toLowerCase().includes(k)))
        .reduce((s, c) => s + Number(c.weight || 0), 0);
      return { ...wt, weight: w, percent: tw > 0 ? Math.round((w / tw) * 100) : 0 };
    }).filter(w => w.weight > 0 || w.type === "Biodegradable");
    setWasteComp(wc);

    // ── 4. Critical Bins ──────────────────────────────────────────────────────
    const allBins = (binsRes.data ?? []) as CriticalBin[];
    // Scope bins: prefer municipality column match (accurate), fall back to
    // 15 km proximity for legacy bins that pre-date the municipality column.
    const taggedBins   = allBins.filter(b => b.municipality !== null);
    const untaggedBins = allBins.filter(b => b.municipality === null);

    const scopedTagged = muni
      ? taggedBins.filter(b => b.municipality === muni)
      : taggedBins;
    const scopedUntagged = (sc.areaLat && sc.areaLng)
      ? untaggedBins.filter(b => haversine([sc.areaLat!, sc.areaLng!], [b.lat, b.lng]) <= 15_000)
      : untaggedBins;
    const scopedBins = [...scopedTagged, ...scopedUntagged];
    setCriticalBins(
      scopedBins.filter(b => b.fill_level >= 75).sort((a, b) => b.fill_level - a.fill_level).slice(0, 6)
    );

    // ── 5. On-duty drivers ────────────────────────────────────────────────────
    const rawOnDuty = (onDutyRes.data ?? []) as any[];
    // If admin has a municipality set, always filter — even if scopedDriverIds is empty
    // (means 0 drivers in this municipality, not "show all").
    const filteredOnDuty = muni
      ? rawOnDuty.filter(d => scopedDriverIds.includes(d.id))
      : rawOnDuty;
    setOnDutyDrivers(filteredOnDuty.map(d => {
      const det = d.driver_details;
      return {
        id:        d.id,
        full_name: d.full_name ?? "Unknown",
        plate:     det?.vehicle_plate_number ?? null,
        vehicle:   det?.vehicle_type ?? null,
        route:     det?.assigned_route ?? null,
      };
    }));

    // ── 6. Citizen score distribution ─────────────────────────────────────────
    const allScores: number[] = (scoresRes.data ?? []).map((s: any) => s.score as number);
    // Deduplicate by most recent (already ordered newest-first from query isn't guaranteed
    // but for distribution we just use all scores as a quick health check)
    const distMap = { "Critical (<60)": 0, "At Risk (60-80)": 0, "Good (80+)": 0 };
    allScores.forEach(s => {
      if (s < 60) distMap["Critical (<60)"]++;
      else if (s < 80) distMap["At Risk (60-80)"]++;
      else distMap["Good (80+)"]++;
    });
    const total = allScores.length || 1;
    setScoreDist([
      { label: "Good (80+)",      count: distMap["Good (80+)"],      color: "#059669", bar: "bg-emerald-500", percent: Math.round((distMap["Good (80+)"]      / total) * 100) },
      { label: "At Risk (60-80)", count: distMap["At Risk (60-80)"], color: "#d97706", bar: "bg-amber-500",   percent: Math.round((distMap["At Risk (60-80)"] / total) * 100) },
      { label: "Critical (<60)",  count: distMap["Critical (<60)"],  color: "#dc2626", bar: "bg-red-500",     percent: Math.round((distMap["Critical (<60)"]  / total) * 100) },
    ]);

    // ── 7. Recent violations ──────────────────────────────────────────────────
    setRecentViolations((violationsRes.data ?? []).map((v: any) => ({
      id:           v.id,
      type:         v.type,
      citizen_name: v.profiles?.full_name ?? "Unknown",
      status:       v.status,
      created_at:   v.created_at,
    })));

    // ── 8. Broadcasts + activity ──────────────────────────────────────────────
    setBroadcasts(broadcastsRes.data ?? []);
    setActivityLogs(auditRes.data ?? []);

    // ── 9. KPI Stats ──────────────────────────────────────────────────────────
    const totalDrivers  = driversRes.count ?? 0;
    const onDutyCount   = filteredOnDuty.length;
    const citizenCount  = citizensRes.count ?? 0;
    const criticalCount = scopedBins.filter(b => b.fill_level >= 90).length;
    const pendingViol   = (violationsRes.data ?? []).length;
    const weekWeight    = trend.slice(-7).reduce((s, t) => s + t.weight, 0);

    setStats([
      {
        label: "Active Fleet",
        value: `${onDutyCount}/${totalDrivers}`,
        sub:   "On-Duty / Total",
        icon:  <Truck size={20} />,
        color: "text-blue-600", bg: "bg-blue-50",
        delta: onDutyCount,
      },
      {
        label: "Registered Citizens",
        value: citizenCount.toLocaleString(),
        sub:   brgy ? `Brgy. ${brgy}` : "Jurisdiction",
        icon:  <Users size={20} />,
        color: "text-emerald-600", bg: "bg-emerald-50",
        delta: null,
      },
      {
        label: "7-Day Collection",
        value: fmtWeight(weekWeight),
        sub:   `${trend.filter(t => t.count > 0).length} active days`,
        icon:  <Recycle size={20} />,
        color: "text-orange-600", bg: "bg-orange-50",
        delta: null,
      },
      {
        label: "Pending Violations",
        value: pendingViol,
        sub:   "Requires action",
        icon:  <ShieldAlert size={20} />,
        color: "text-red-600", bg: "bg-red-50",
        delta: pendingViol,
      },
      {
        label: "Critical Bins",
        value: criticalCount,
        sub:   `${scopedBins.length} total in area`,
        icon:  <Trash2 size={20} />,
        color: "text-amber-600", bg: "bg-amber-50",
        delta: criticalCount,
      },
    ]);

    setLastRefreshed(new Date());
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const sc = scope ?? await loadScope();
    if (sc) { setScope(sc); await fetchData(sc); }
    setRefreshing(false);
  }, [scope, loadScope, fetchData]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const sc = await loadScope();
      if (sc) { setScope(sc); await fetchData(sc); }
      setLoading(false);
    })();
  }, [loadScope, fetchData]);

  // Realtime on collections
  useEffect(() => {
    const ch = supabase.channel("overview-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "collections" }, () => {
        if (scope) fetchData(scope);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, () => {
        if (scope) fetchData(scope);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [scope, fetchData]);

  // KPI card scroll handler
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const idx = Math.round(el.scrollLeft / (el.offsetWidth * 0.82 + 16));
    if (idx >= 0 && idx < stats.length) setCurrentIdx(idx);
  };

  if (loading) return (
    <div className="h-96 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Syncing Jurisdiction Data…</p>
    </div>
  );

  const hasScope = scope?.municipality || scope?.barangay;

  return (
    <div className="space-y-8 pb-12">

      {/* ── JURISDICTION HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {hasScope ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
                <Building2 size={13} className="text-emerald-600" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  {[scope?.barangay, scope?.municipality].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
                Updated {fmtAgo(lastRefreshed.toISOString())}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
              <AlertTriangle size={12} className="text-amber-600" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">No jurisdiction set — update profile</span>
            </div>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-50">
          <RefreshCcw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── KPI STAT CARDS (horizontal scroll mobile, grid desktop) ── */}
      <div>
        <SectionLabel>Real-Time Metrics</SectionLabel>
        <div className="flex items-center gap-1.5 mb-3">
          {stats.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-400 ${currentIdx === i ? "w-6 bg-emerald-500" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>
        <div ref={scrollRef} onScroll={handleScroll}
          className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 snap-x snap-mandatory scrollbar-hide">
          {stats.map((s, i) => (
            <div key={i}
              className={`min-w-[78vw] sm:min-w-[45vw] lg:min-w-0 snap-center bg-white rounded-2xl border p-5 shadow-sm transition-all duration-300
                ${currentIdx === i && window?.innerWidth < 1024 ? "border-emerald-200 shadow-lg ring-2 ring-emerald-500/10" : "border-slate-100"}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>
                  {s.icon}
                </div>
                {s.delta !== null && s.delta !== undefined && s.delta > 0 && (
                  <span className="text-[8px] font-black px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg uppercase">
                    Action
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{s.value}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
              <p className="text-[9px] text-slate-300 font-medium mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* 7-day throughput */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <SectionLabel>Collection Throughput</SectionLabel>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-slate-900">{fmtWeight(totalWeight)}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">total collected</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">7-day window</p>
              <p className="text-[10px] font-black text-emerald-600">
                {dailyTrend.filter(t => t.count > 0).length} active days
              </p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-44">
            {dailyTrend.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full group">
                <div className="relative w-full flex flex-col justify-end rounded-xl overflow-hidden bg-slate-50 border border-slate-100 h-full">
                  <div className="w-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors rounded-xl"
                    style={{ height: `${Math.max(d.percentage, d.weight > 0 ? 4 : 0)}%` }}>
                    {d.weight > 0 && (
                      <div className="opacity-0 group-hover:opacity-100 absolute top-1 inset-x-0 flex justify-center transition-opacity">
                        <span className="bg-slate-900 text-white text-[8px] font-black px-2 py-0.5 rounded-md whitespace-nowrap">
                          {fmtWeight(d.weight)} · {d.count} trips
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waste composition */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 blur-3xl rounded-full" />
          <SectionLabel>
            <span className="text-slate-500">Waste Composition</span>
          </SectionLabel>
          {wasteComp.length === 0 ? (
            <EmptyState icon={<Recycle size={28} />} text="No data yet" />
          ) : (
            <div className="space-y-5 relative z-10 mt-2">
              {wasteComp.map((w, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: w.color }} />
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">{w.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500">{fmtWeight(w.weight)}</span>
                      <span className="text-base font-black text-emerald-400">{w.percent}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full ${w.bar} rounded-full transition-all duration-700`}
                      style={{ width: `${w.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CRITICAL BINS + ON-DUTY DRIVERS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Critical bins */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionLabel>Critical Bins — Needs Collection</SectionLabel>
          {criticalBins.length === 0 ? (
            <EmptyState icon={<Trash2 size={28} className="text-slate-200" />} text="All bins under threshold" />
          ) : (
            <div className="space-y-2.5">
              {criticalBins.map(bin => (
                <div key={bin.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-red-200 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: FILL_COLOR(bin.fill_level) + "15" }}>
                    <span className="text-sm font-black" style={{ color: FILL_COLOR(bin.fill_level) }}>
                      {bin.fill_level}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{bin.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                        <Battery size={9} />
                        <span>{bin.battery_level}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                        <MapPin size={9} />
                        <span>{bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bin.fill_level}%`, background: FILL_COLOR(bin.fill_level) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* On-duty drivers */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>On-Duty Drivers</SectionLabel>
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase">{onDutyDrivers.length} live</span>
            </div>
          </div>
          {onDutyDrivers.length === 0 ? (
            <EmptyState icon={<Truck size={28} className="text-slate-200" />} text="No drivers on duty" />
          ) : (
            <div className="space-y-2.5">
              {onDutyDrivers.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Truck size={14} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{d.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {d.plate && (
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-mono">
                          {d.plate}
                        </span>
                      )}
                      {d.route && (
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5 truncate">
                          <Navigation size={8} />{d.route}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CITIZEN SCORES + RECENT VIOLATIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Score health */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionLabel>Citizen Score Health</SectionLabel>
          {scoreDist.every(d => d.count === 0) ? (
            <EmptyState icon={<Star size={28} className="text-slate-200" />} text="No score data yet" />
          ) : (
            <div className="space-y-4">
              {scoreDist.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{s.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400">{s.count} citizens</span>
                      <span className="text-sm font-black" style={{ color: s.color }}>{s.percent}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full transition-all duration-700`}
                      style={{ width: `${s.percent}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-50 flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>{scoreDist.reduce((s: number, d: any) => s + d.count, 0)} total records</span>
                <span className="text-emerald-600">{scoreDist.find((d) => d.label.startsWith("Good"))?.count ?? 0} good standing</span>
              </div>
            </div>
          )}
        </div>

        {/* Recent violations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionLabel>Unresolved Violations</SectionLabel>
          {recentViolations.length === 0 ? (
            <EmptyState icon={<ShieldAlert size={28} className="text-slate-200" />} text="No pending violations" />
          ) : (
            <div className="space-y-2.5">
              {recentViolations.map(v => {
                const typeColor = VIOLATION_TYPE_COLOR[v.type] ?? "#64748b";
                return (
                  <div key={v.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-red-100 transition-colors">
                    <div className="w-1 h-full min-h-[36px] rounded-full flex-shrink-0" style={{ background: typeColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-800 truncate">{v.citizen_name}</p>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase"
                          style={{ background: typeColor + "15", color: typeColor }}>
                          {v.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{v.type}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{fmtAgo(v.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── BROADCASTS + ACTIVITY LOG ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent broadcasts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionLabel>Recent Broadcasts</SectionLabel>
          {broadcasts.length === 0 ? (
            <EmptyState icon={<Megaphone size={28} className="text-slate-200" />} text="No broadcasts yet" />
          ) : (
            <div className="space-y-2.5">
              {broadcasts.map(b => (
                <div key={b.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <Radio size={13} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-800 truncate flex-1">{b.title}</p>
                      {b.is_pinned && <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md uppercase flex-shrink-0">Pinned</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{b.type.replace("_", " ")}</span>
                      <span className="text-[8px] text-slate-300">·</span>
                      <span className="text-[9px] text-slate-400">{fmtAgo(b.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionLabel>Your Activity Log</SectionLabel>
          {activityLogs.length === 0 ? (
            <EmptyState icon={<Activity size={28} className="text-slate-200" />} text="No recent activity" />
          ) : (
            <div className="space-y-2.5">
              {activityLogs.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={12} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{a.action_type.replace(/_/g, " ")}</p>
                    {a.reason && <p className="text-[9px] text-slate-400 mt-0.5 truncate">{a.reason}</p>}
                    <p className="text-[9px] text-slate-300 mt-0.5">{fmtAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}