"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/driver/CollectionHistory.tsx — Production Travel Order System
//
// Replaces the old collection checklist UI with a proper travel order system:
//   • Travel orders list — one per assigned schedule, with status tracking
//   • Bin manifest — all bins included in the route with fill levels
//   • Route efficiency metrics — from RoutingLayerGL A* calculations:
//     distance (km), estimated time, bins collected, fill % handled
//   • Live duty toggle — ON-DUTY / OFF-DUTY
//   • Per-bin mark-as-collected with auto-reset (fill_level → 0)
//   • Trip summary written to collections table on route completion
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Truck, MapPin, Calendar, Clock, CheckCircle2, Circle,
  RefreshCcw, Play, Square, ChevronDown, ChevronRight,
  AlertTriangle, BarChart3, Route, Trash2, Package, Wifi,
  FileText, Flag, Navigation2,
} from "lucide-react";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  driver_details: {
    id: string;
    duty_status: string;
    license_number?: string;
    vehicle_plate_number?: string;
    vehicle_type?: string;
    assigned_route?: string;
    employment_status: string;
  };
}

interface TripRow {
  id: string; created_at: string; barangay: string;
  weight: number | null; type: string; bin_id: string | null;
  bins: { name: string; fill_level: number } | null;
}

export interface TravelOrder {
  id: string;
  label: string;
  barangay: string;
  day_of_week: number | null;
  scheduled_time: string | null;
  waste_types: string[];
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  municipality?: string | null;
  // Extended columns — added by migration SQL (optional until migrated)
  driver_id?: string | null;
  vehicle_type?: string | null;
  collection_area?: string | null;
  bin_ids?: string[] | null;
  estimated_distance_km?: number | null;
  estimated_duration_min?: number | null;
  // Joined
  created_by_name?: string;
}

export interface BinManifest {
  id: string;
  name: string;
  fill_level: number;
  lat: number;
  lng: number;
  barangay: string;
  device_id?: string;
  // Per-session state
  collected: boolean;
  collected_at?: string;
}

export interface TripSummary {
  schedule_id: string;
  bins_total: number;
  bins_collected: number;
  total_fill_collected: number;
  started_at: string;
  completed_at?: string;
  distance_km?: number;
  duration_min?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fillColor = (pct: number) =>
  pct >= 90 ? "#dc2626" : pct >= 70 ? "#ea580c" : pct >= 40 ? "#d97706" : "#16a34a";

const fillBg = (pct: number) =>
  pct >= 90 ? "#fef2f2" : pct >= 70 ? "#fff7ed" : pct >= 40 ? "#fffbeb" : "#f0fdf4";

const fmtTime = (t: string | null) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Route efficiency stats row — mirrors RoutingLayerGL output format */
function RouteStats({
  binsTotal, binsCollected, distKm, durationMin, fillHandled,
}: {
  binsTotal: number; binsCollected: number;
  distKm?: number | null; durationMin?: number | null;
  fillHandled?: number;
}) {
  const pct = binsTotal > 0 ? Math.round((binsCollected / binsTotal) * 100) : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      {[
        {
          icon: <CheckCircle2 size={14} className="text-emerald-600" />,
          label: "Bins Collected",
          value: `${binsCollected}/${binsTotal}`,
          sub: `${pct}% complete`,
          accent: "text-emerald-700",
        },
        {
          icon: <Navigation2 size={14} className="text-blue-500" />,
          label: "Est. Distance",
          value: distKm ? `${distKm.toFixed(1)} km` : "—",
          sub: "A* optimized route",
          accent: "text-blue-700",
        },
        {
          icon: <Clock size={14} className="text-amber-500" />,
          label: "Est. Time",
          value: durationMin ? `${durationMin} min` : "—",
          sub: "Road conditions apply",
          accent: "text-amber-700",
        },
        {
          icon: <BarChart3 size={14} className="text-purple-500" />,
          label: "Total Fill",
          value: fillHandled ? `${Math.round(fillHandled)}%` : "—",
          sub: "Avg fill across bins",
          accent: "text-purple-700",
        },
      ].map((s) => (
        <div
          key={s.label}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 mb-0.5">{s.icon}<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</span></div>
          <div className={`text-2xl font-black italic tracking-tight ${s.accent}`}>{s.value}</div>
          <div className="text-[10px] text-slate-400 font-medium">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/** Single bin card in the manifest */
function BinCard({
  bin, onCollect, isRouting, saving,
}: {
  bin: BinManifest; onCollect: (id: string) => void;
  isRouting: boolean; saving: boolean;
}) {
  const fc = fillColor(bin.fill_level);
  const fb = fillBg(bin.fill_level);

  return (
    <div
      onClick={() => !bin.collected && isRouting && !saving && onCollect(bin.id)}
      className={`group flex items-center gap-4 p-5 rounded-[2rem] border transition-all duration-300 ${
        bin.collected
          ? "bg-slate-50 border-slate-100 opacity-60"
          : isRouting
          ? "bg-white border-slate-100 shadow-sm hover:border-emerald-400 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
          : "bg-white border-slate-100 cursor-not-allowed opacity-70"
      }`}
    >
      {/* Status icon */}
      <div
        className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
          bin.collected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600"
        }`}
      >
        {bin.collected ? <CheckCircle2 size={22} /> : <Wifi size={20} />}
      </div>

      {/* Bin info */}
      <div className="flex-1 min-w-0">
        <p className={`text-base font-black tracking-tight ${bin.collected ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {bin.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${bin.collected ? "bg-emerald-500" : "bg-red-400 animate-pulse"}`} />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            IoT: {bin.device_id ?? bin.id.slice(0, 8)} ·{" "}
            {bin.collected ? `Collected ${bin.collected_at ? fmtTime(bin.collected_at.split("T")[1]?.slice(0, 5)) : ""}` : `${bin.fill_level}% capacity`}
          </p>
        </div>
      </div>

      {/* Fill level badge */}
      <div className="flex-shrink-0 text-right">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black"
          style={{ background: fb, color: fc }}
        >
          <span>{bin.fill_level}%</span>
        </div>
        <div className="w-16 h-2 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${bin.fill_level}%`, background: fc }}
          />
        </div>
      </div>

      {/* Collect arrow */}
      {!bin.collected && isRouting && (
        <div className="flex-shrink-0 ml-1 p-2.5 rounded-xl bg-slate-50 text-slate-300 transition-all group-hover:bg-emerald-500 group-hover:text-white">
          <Navigation2 size={16} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL ORDER CARD
// ─────────────────────────────────────────────────────────────────────────────

function TravelOrderCard({
  order,
  driverProfile,
  isActive,
  onActivate,
}: {
  order: TravelOrder;
  driverProfile: DriverProfile;
  isActive: boolean;
  onActivate: (order: TravelOrder) => void;
}) {
  const [expanded, setExpanded] = useState(isActive);
  const binCount = order.bin_ids?.length ?? 0;
  const isToday  = order.day_of_week === new Date().getDay();

  return (
    <div
      className={`rounded-[2.5rem] border overflow-hidden transition-all duration-300 ${
        isActive
          ? "border-emerald-300 shadow-xl shadow-emerald-50"
          : isToday
          ? "border-emerald-200 shadow-md"
          : "border-slate-100 shadow-sm"
      }`}
    >
      {/* Header row */}
      <div
        className={`flex items-center gap-4 p-6 cursor-pointer transition-colors ${
          isActive ? "bg-emerald-600 text-white" : "bg-white hover:bg-slate-50"
        }`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Day badge */}
        <div
          className={`w-16 h-16 rounded-[1.5rem] flex flex-col items-center justify-center flex-shrink-0 ${
            isActive ? "bg-white/20" : isToday ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-100"
          }`}
        >
          <span className={`text-xs font-black uppercase ${isActive ? "text-white/80" : isToday ? "text-white" : "text-slate-600"}`}>
            {order.day_of_week !== null ? DAYS_SHORT[order.day_of_week] : "—"}
          </span>
          <span className={`text-[9px] font-bold mt-0.5 ${isActive ? "text-white/60" : isToday ? "text-emerald-100" : "text-slate-400"}`}>
            {fmtTime(order.scheduled_time)}
          </span>
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-base font-black italic uppercase tracking-tight ${isActive ? "text-white" : "text-slate-900"}`}>
              {order.label}
            </span>
            {isToday && !isActive && (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">Today</span>
            )}
            {isActive && (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-widest animate-pulse">● Active</span>
            )}
          </div>

          <div className={`flex items-center gap-3 flex-wrap text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-white/70" : "text-slate-400"}`}>
            {order.collection_area && (
              <span className="flex items-center gap-1"><MapPin size={10} />{order.collection_area}</span>
            )}
            {order.vehicle_type && (
              <span className="flex items-center gap-1"><Truck size={10} />{order.vehicle_type}</span>
            )}
            {binCount > 0 && (
              <span className="flex items-center gap-1"><Trash2 size={10} />{binCount} bin{binCount !== 1 ? "s" : ""}</span>
            )}
            {order.estimated_distance_km && (
              <span className="flex items-center gap-1"><Route size={10} />{order.estimated_distance_km.toFixed(1)} km</span>
            )}
          </div>

          {/* Waste type pills */}
          <div className="flex gap-1.5 flex-wrap mt-2">
            {order.waste_types.map(t => (
              <span
                key={t}
                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                  isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isActive && (
            <button
              onClick={e => { e.stopPropagation(); onActivate(order); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95"
            >
              <Play size={12} fill="currentColor" /> Start
            </button>
          )}
          <div className={`p-2 rounded-xl transition-all ${isActive ? "text-white/60" : "text-slate-400"}`}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
      </div>

      {/* Notes strip */}
      {order.notes && expanded && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium leading-relaxed">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE ROUTE VIEW
// ─────────────────────────────────────────────────────────────────────────────

function ActiveRouteView({
  order,
  driverProfile,
  bins,
  tripSummary,
  onCollect,
  onComplete,
  onCancel,
  saving,
}: {
  order: TravelOrder;
  driverProfile: DriverProfile;
  bins: BinManifest[];
  tripSummary: TripSummary | null;
  onCollect: (binId: string) => void;
  onComplete: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const collected    = bins.filter(b => b.collected).length;
  const total        = bins.length;
  const pct          = total > 0 ? Math.round((collected / total) * 100) : 0;
  const avgFill      = bins.length > 0 ? bins.reduce((s, b) => s + b.fill_level, 0) / bins.length : 0;
  const allDone      = collected === total && total > 0;

  return (
    <div className="space-y-6">
      {/* Active route header */}
      <div className="rounded-[3rem] bg-emerald-600 p-8 text-white relative overflow-hidden shadow-2xl shadow-emerald-100">
        <div className="absolute right-[-20px] top-[-20px] text-[8rem] opacity-10 rotate-12">🚛</div>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] opacity-60 mb-1">Active Travel Order</p>
              <h2 className="text-2xl font-black italic uppercase tracking-tight">{order.label}</h2>
              <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-widest opacity-70 flex-wrap">
                {order.collection_area && <span className="flex items-center gap-1"><MapPin size={10} />{order.collection_area}</span>}
                {order.vehicle_type   && <span className="flex items-center gap-1"><Truck size={10} />{order.vehicle_type}</span>}
                {order.scheduled_time && <span className="flex items-center gap-1"><Clock size={10} />{fmtTime(order.scheduled_time)}</span>}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="flex-shrink-0 px-4 py-2.5 rounded-2xl bg-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition-all"
            >
              <Square size={12} className="inline mr-1.5" fill="currentColor" />Cancel
            </button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Route Progress</p>
              <p className="text-2xl font-black">{pct}%</p>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] opacity-60 font-bold">
              {collected} of {total} bins collected
            </p>
          </div>
        </div>
      </div>

      {/* Route stats */}
      <RouteStats
        binsTotal={total}
        binsCollected={collected}
        distKm={order.estimated_distance_km}
        durationMin={order.estimated_duration_min}
        fillHandled={avgFill}
      />

      {/* Bin manifest */}
      <div>
        <div className="flex items-center justify-between px-1 mb-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Bin Manifest — {total} stops
          </h4>
          {total > 0 && (
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-600"}`}>
              {allDone ? "✓ All collected" : `${total - collected} remaining`}
            </span>
          )}
        </div>

        {bins.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Trash2 size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold italic">No bins assigned to this route.</p>
            <p className="text-xs mt-1">The LGU admin can add bins when editing the schedule.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bins.map(bin => (
              <BinCard
                key={bin.id}
                bin={bin}
                onCollect={onCollect}
                isRouting={true}
                saving={saving}
              />
            ))}
          </div>
        )}
      </div>

      {/* Complete route button */}
      {total > 0 && (
        <div className="pt-2 pb-4">
          <button
            onClick={onComplete}
            disabled={saving}
            className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 flex items-center justify-center gap-3 ${
              allDone
                ? "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
                : "bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800"
            }`}
          >
            {saving ? (
              <><RefreshCcw size={16} className="animate-spin" /> Saving Trip…</>
            ) : allDone ? (
              <><CheckCircle2 size={16} fill="currentColor" /> Complete Route & Log Trip</>
            ) : (
              <><Flag size={16} /> Finish Early ({collected}/{total} collected)</>
            )}
          </button>
          {!allDone && (
            <p className="text-center text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">
              Tap a bin above to mark it as collected
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED TRIPS HISTORY
// ─────────────────────────────────────────────────────────────────────────────

function CompletedTrips({ driverId }: { driverId: string }) {
  const [trips,   setTrips]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("collections")
      .select("id,created_at,barangay,weight,type,bin_id,bins(name,fill_level)")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then((res: { data: TripRow[] | null; error: unknown }) => { setTrips(res.data ?? []); setLoading(false); });
  }, [driverId]);

  if (loading) return (
    <div className="py-10 text-center">
      <RefreshCcw size={20} className="animate-spin text-slate-300 mx-auto mb-2" />
      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading trip history…</p>
    </div>
  );

  if (trips.length === 0) return (
    <div className="py-12 text-center">
      <FileText size={32} className="text-slate-200 mx-auto mb-3" />
      <p className="text-sm font-black italic text-slate-400 uppercase">No completed trips yet</p>
      <p className="text-xs text-slate-400 mt-1">Start a route above to log your first collection.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {trips.map(t => (
        <div key={t.id} className="flex items-center gap-4 p-5 rounded-[2rem] bg-white border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-[1.2rem] bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900 italic uppercase">
              {(t.bins as any)?.name ?? `Bin ${t.bin_id?.slice(0, 8)}`}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>{t.barangay}</span>
              <span>·</span>
              <span>{t.type}</span>
              {t.weight && <span>· {t.weight.toFixed(1)} kg</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-bold text-slate-500">{fmtDate(t.created_at)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {new Date(t.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

// Props passed from DriverDashboard so active route state
// persists when the user switches away from this tab.
export interface ActiveRouteState {
  activeOrder:  TravelOrder | null;
  activeBins:   BinManifest[];
  tripSummary:  TripSummary | null;
  isRouting:    boolean;
}
export interface ActiveRouteSetters {
  setActiveOrder:  React.Dispatch<React.SetStateAction<TravelOrder | null>>;
  setActiveBins:   React.Dispatch<React.SetStateAction<BinManifest[]>>;
  setTripSummary:  React.Dispatch<React.SetStateAction<TripSummary | null>>;
  setIsRouting:    React.Dispatch<React.SetStateAction<boolean>>;
}
interface CollectionHistoryProps extends ActiveRouteState, ActiveRouteSetters {
  onRouteStarted?: (bins: BinManifest[], order: TravelOrder) => void;
}

export default function CollectionHistory({
  activeOrder, activeBins, tripSummary, isRouting,
  setActiveOrder, setActiveBins, setTripSummary, setIsRouting,
  onRouteStarted,
}: CollectionHistoryProps) {
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [orders,        setOrders]        = useState<TravelOrder[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isSyncing,     setIsSyncing]     = useState(false);
  const [activeView,    setActiveView]    = useState<"orders"|"history">("orders");
  const tripStartRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url,driver_details!inner(id,license_number,vehicle_plate_number,vehicle_type,assigned_route,duty_status,employment_status)")
      .eq("id", user.id)
      .single();

    if (profile) {
      setDriverProfile(profile as DriverProfile);
      setIsRouting((profile as any).driver_details?.duty_status === "ON-DUTY");
    }

    // Load schedules via schedule_assignments join table
    // (driver_id on collection_schedules requires migration — use join table)
    const { data: assignments } = await supabase
      .from("schedule_assignments")
      .select("schedule_id")
      .eq("driver_id", user.id)
      .eq("is_active", true);

    const scheduleIds = (assignments ?? []).map((a: any) => a.schedule_id).filter(Boolean);
    let schedData: any[] = [];
    if (scheduleIds.length > 0) {
      const { data } = await supabase
        .from("collection_schedules")
        .select("*")
        .in("id", scheduleIds)
        .eq("is_active", true)
        .order("day_of_week");
      schedData = data ?? [];
    }

    // Enrich with created_by name
    const creatorIds = [...new Set((schedData ?? []).map((s: any) => s.created_by).filter(Boolean))];
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from("profiles").select("id,full_name").in("id", creatorIds);
      creatorMap = Object.fromEntries((creators ?? []).map((c: any) => [c.id, c.full_name]));
    }

    setOrders((schedData ?? []).map((s: any) => ({
      ...s,
      created_by_name: creatorMap[s.created_by] ?? "LGU Admin",
    })));

    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: duty status changes
  useEffect(() => {
    if (!driverProfile?.id) return;
    const ch = supabase.channel(`driver-duty-${driverProfile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_details", filter: `id=eq.${driverProfile.id}` },
        (payload: RealtimePostgresUpdatePayload<{ id: string; duty_status: string }>) => {
          setIsRouting(payload.new.duty_status === "ON-DUTY");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driverProfile?.id]);

  const toggleDuty = async () => {
    const user = driverProfile;
    if (!user) return;
    const next = isRouting ? "OFF-DUTY" : "ON-DUTY";
    setIsSyncing(true);
    const { error } = await supabase
      .from("driver_details")
      .upsert({ id: user.id, duty_status: next }, { onConflict: "id" });
    if (!error) setIsRouting(next === "ON-DUTY");
    else alert(`Sync error: ${error.message}`);
    setIsSyncing(false);
  };

  /** Start a travel order — fetch bin manifests */
  const handleActivate = async (order: TravelOrder) => {
    setIsSyncing(true);
    let bins: BinManifest[] = [];

    if (order.bin_ids && order.bin_ids.length > 0) {
      const { data } = await supabase
        .from("bins")
        .select("id,name,fill_level,lat,lng,device_id")
        .in("id", order.bin_ids.map(Number));
      bins = (data ?? []).map((b: any) => ({ ...b, barangay: order.barangay, collected: false }));
    } else {
      // Fallback: fetch all bins (bins table has no barangay column)
      const { data } = await supabase
        .from("bins")
        .select("id,name,fill_level,lat,lng,device_id")
        .gte("fill_level", 20);
      bins = (data ?? []).map((b: any) => ({ ...b, barangay: order.barangay, collected: false }));
    }

    // Sort by fill_level descending (priority order mirrors A* TSP by fill weight)
    bins.sort((a, b) => b.fill_level - a.fill_level);

    setActiveBins(bins);
    setActiveOrder(order);
    tripStartRef.current = new Date().toISOString();
    setTripSummary({
      schedule_id:          order.id,
      bins_total:           bins.length,
      bins_collected:       0,
      total_fill_collected: 0,
      started_at:           new Date().toISOString(),
    });

    // Switch to ON-DUTY if not already
    if (!isRouting && driverProfile) {
      await supabase.from("driver_details").upsert({ id: driverProfile.id, duty_status: "ON-DUTY" }, { onConflict: "id" });
      setIsRouting(true);
    }

    // Notify dashboard → switch to map tab + start routing
    onRouteStarted?.(bins, order);

    setIsSyncing(false);
  };

  /** Mark a single bin as collected */
  const handleCollect = async (binId: string) => {
    if (!driverProfile || isSyncing) return;
    setIsSyncing(true);

    const bin = activeBins.find(b => b.id === binId);
    if (!bin) { setIsSyncing(false); return; }

    const collectedAt = new Date().toISOString();

    // Update bin fill_level → 0 in DB
    await supabase.from("bins").update({ fill_level: 0 }).eq("id", Number(binId));

    // Log to collections table
    await supabase.from("collections").insert({
      driver_id: driverProfile.id,
      bin_id:    Number(binId),    // bins.id is bigint
      device_id: bin.device_id ?? null,
      weight:    bin.fill_level * 0.45,
      type:      activeOrder?.waste_types[0] ?? "General",
      barangay:  bin.barangay ?? activeOrder?.barangay ?? "",
    });

    // Update local state
    setActiveBins(prev =>
      prev.map(b => b.id === binId ? { ...b, collected: true, fill_level: 0, collected_at: collectedAt } : b)
    );

    setTripSummary(prev => prev ? {
      ...prev,
      bins_collected:       prev.bins_collected + 1,
      total_fill_collected: prev.total_fill_collected + bin.fill_level,
    } : prev);

    setIsSyncing(false);
  };

  /** Complete the route — write trip summary */
  const handleComplete = async () => {
    if (!driverProfile || !activeOrder || !tripSummary) return;
    setIsSyncing(true);

    const completedAt = new Date().toISOString();
    const durationMs = tripStartRef.current
      ? new Date(completedAt).getTime() - new Date(tripStartRef.current).getTime()
      : 0;
    const durationMin = Math.round(durationMs / 60000);

    // Write trip summary audit
    await supabase.from("audit_logs").insert({
      admin_id:    driverProfile.id,
      action_type: "DRIVER_COMPLETE_ROUTE",
      target_id:   activeOrder.id,
      reason:      `Route "${activeOrder.label}" completed. ${tripSummary.bins_collected}/${tripSummary.bins_total} bins collected in ${durationMin} min.`,
    });

    // Update schedule last_run timestamp (if column exists)
    await supabase.from("collection_schedules")
      .update({ next_run_at: null })
      .eq("id", activeOrder.id);

    // Notify LGU admin (created_by)
    if (activeOrder.created_by) {
      await supabase.from("notifications").insert({
        user_id:    activeOrder.created_by,
        type:       "ROUTE_COMPLETED",
        title:      `Route Completed: ${activeOrder.label}`,
        body:       `${driverProfile.full_name} completed the collection route. ${tripSummary.bins_collected} of ${tripSummary.bins_total} bins collected${durationMin > 0 ? ` in ${durationMin} min` : ""}.`,
        created_by: driverProfile.id,
        metadata: {
          schedule_id:     activeOrder.id,
          bins_collected:  tripSummary.bins_collected,
          bins_total:      tripSummary.bins_total,
          duration_min:    durationMin,
          distance_km:     activeOrder.estimated_distance_km,
        },
      });
    }

    setIsSyncing(false);
    setActiveOrder(null);
    setActiveBins([]);
    setTripSummary(null);
    setIsRouting(false);
    tripStartRef.current = null;
    loadData();
  };

  // ─ Loading screen ──────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="max-w-4xl mx-auto p-10 space-y-4">
      <div className="h-48 w-full bg-slate-100 rounded-[3rem] animate-pulse" />
      <div className="h-24 w-full bg-slate-50 rounded-[2rem] animate-pulse" />
      <div className="h-24 w-full bg-slate-50 rounded-[2rem] animate-pulse" />
    </div>
  );

  // ─ ACTIVE ROUTE VIEW ───────────────────────────────────────────────────────
  if (activeOrder) {
    return (
      <div className="max-w-4xl mx-auto px-4 pb-20 space-y-6 animate-in fade-in duration-300">
        <ActiveRouteView
          order={activeOrder}
          driverProfile={driverProfile!}
          bins={activeBins}
          tripSummary={tripSummary}
          onCollect={handleCollect}
          onComplete={handleComplete}
          onCancel={() => { setActiveOrder(null); setActiveBins([]); setTripSummary(null); setIsRouting(false); }}
          saving={isSyncing}
        />
        {isSyncing && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl z-50 animate-in slide-in-from-bottom-4">
            <RefreshCcw size={14} className="animate-spin text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing EcoRoute Ledger…</span>
          </div>
        )}
      </div>
    );
  }

  const todaysOrders  = orders.filter(o => o.day_of_week === new Date().getDay());
  const otherOrders   = orders.filter(o => o.day_of_week !== new Date().getDay());

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 space-y-8 animate-in fade-in duration-500">

      {/* ── DUTY STATUS HEADER ── */}
      <div className={`rounded-[3.5rem] p-8 text-white shadow-2xl relative overflow-hidden transition-all duration-700 ${isRouting ? "bg-emerald-600" : "bg-slate-950"}`}>
        <div className="absolute right-[-10px] top-[-10px] text-[9rem] opacity-10 rotate-12">🚛</div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] opacity-60 mb-1">
              {isRouting ? "Currently On Route" : "Fleet Status: Standby"}
            </p>
            <h2 className="text-3xl font-black italic uppercase tracking-tight">
              {isRouting ? "On Duty" : "Off Duty"}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-widest opacity-70 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Truck size={10} />
                {driverProfile?.driver_details.vehicle_plate_number ?? "No truck"}
              </span>
              <span className="flex items-center gap-1.5">
                <Route size={10} />
                {driverProfile?.driver_details.assigned_route ?? "No route assigned"}
              </span>
            </div>
          </div>
          <button
            onClick={toggleDuty}
            disabled={isSyncing}
            className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl ${
              isRouting ? "bg-white text-emerald-600 hover:bg-emerald-50" : "bg-emerald-500 text-white hover:bg-emerald-400"
            }`}
          >
            {isSyncing ? <RefreshCcw size={14} className="animate-spin" />
              : isRouting ? <><Square size={14} fill="currentColor" /> End Shift</>
              : <><Play size={14} fill="currentColor" /> Start Shift</>}
          </button>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-[2rem]">
        {([
          { id: "orders",  label: "Travel Orders",  icon: <FileText size={14} />,    count: orders.length },
          { id: "history", label: "Trip History",   icon: <CheckCircle2 size={14} />, count: null },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveView(t.id)}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-[1.6rem] text-xs font-black uppercase tracking-widest transition-all ${
              activeView === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon}{t.label}
            {t.count !== null && t.count > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeView === t.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TRAVEL ORDERS ── */}
      {activeView === "orders" && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="bg-white rounded-[3rem] border border-slate-100 p-14 text-center shadow-sm">
              <Calendar size={40} className="text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-black italic uppercase text-sm">No schedules assigned</p>
              <p className="text-slate-400 text-xs mt-2 font-medium">Your LGU admin will assign collection schedules to you from the LGU dashboard.</p>
            </div>
          ) : (
            <>
              {/* Today's orders */}
              {todaysOrders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] px-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Today's Routes — {new Date().toLocaleDateString("en-PH", { weekday: "long" })}
                  </p>
                  {todaysOrders.map(o => (
                    <TravelOrderCard
                      key={o.id}
                      order={o}
                      driverProfile={driverProfile!}
                      isActive={false}
                      onActivate={handleActivate}
                    />
                  ))}
                </div>
              )}

              {/* Other orders */}
              {otherOrders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                    Upcoming Routes
                  </p>
                  {otherOrders.map(o => (
                    <TravelOrderCard
                      key={o.id}
                      order={o}
                      driverProfile={driverProfile!}
                      isActive={false}
                      onActivate={handleActivate}
                    />
                  ))}
                </div>
              )}

              {/* Route efficiency summary */}
              <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                  <BarChart3 size={12} /> Weekly Route Overview
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Assigned Routes", value: orders.length, icon: "📋" },
                    { label: "Total Bins",       value: orders.reduce((s, o) => s + (o.bin_ids?.length ?? 0), 0), icon: "🗑️" },
                    {
                      label: "Est. Total Distance",
                      value: orders.reduce((s, o) => s + (o.estimated_distance_km ?? 0), 0).toFixed(1) + " km",
                      icon: "🛣️",
                    },
                  ].map(s => (
                    <div key={s.label} className="text-center p-4 bg-slate-50 rounded-2xl">
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className="text-xl font-black text-slate-900 italic">{s.value}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TRIP HISTORY ── */}
      {activeView === "history" && driverProfile && (
        <CompletedTrips driverId={driverProfile.id} />
      )}
    </div>
  );
}