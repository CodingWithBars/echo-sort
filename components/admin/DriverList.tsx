"use client";
// components/admin/DriverList.tsx
// Jurisdiction-scoped driver list — only drivers whose lgu_details or
// profiles municipality/barangay matches the admin's scope.
// Note: drivers don't have lgu_details; scope is derived from their
// assigned_route / barangay cross-referenced via collections or passed
// as a metadata filter. For now we scope via the admin's municipality
// by filtering collections barangay matches.
// Production approach: filter profiles where driver_details.assigned_route
// contains the admin's barangay, OR where the driver was created/assigned
// by an admin of the same municipality. We use a join via schedule_assignments.

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search, Plus, Truck, MapPin, TrendingUp, UserX, RefreshCcw,
  CheckCircle2, AlertTriangle, Clock, Battery, Wifi,
  ShieldCheck, RotateCcw, Eye, Building2, Phone, Mail,
  Star, Activity, Hash, Calendar,
} from "lucide-react";

import AddDriverModal from "@/app/admin/drivers/components/AddDriverModal";

const supabase = createClient();

interface JurisdictionScope { municipality: string | null; barangay: string | null; }

interface Driver {
  id: string;
  full_name: string;
  email: string | null;
  contact_number: string | null;
  avatar_url: string | null;
  license_number: string | null;
  vehicle_plate_number: string | null;
  vehicle_type: string | null;
  assigned_route: string | null;
  employment_status: string;
  duty_status: string;
  collections_count: number;
  last_collection: string | null;
  schedules_count: number;
}

async function loadScope(): Promise<JurisdictionScope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { municipality: null, barangay: null };
  const { data } = await supabase
    .from("lgu_details").select("municipality,barangay")
    .eq("id", user.id).limit(1);
  return { municipality: data?.[0]?.municipality ?? null, barangay: data?.[0]?.barangay ?? null };
}

const STATUS_COLORS: Record<string, string> = {
  "ON-DUTY":  "bg-emerald-500",
  "OFF-DUTY": "bg-slate-300",
};

const EMPLOY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "ACTIVE":   { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  "INACTIVE": { bg: "bg-slate-50",   text: "text-slate-500",   border: "border-slate-100"   },
  "REMOVED":  { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-100"     },
};

export default function DriversList() {
  const [scope, setScope]         = useState<JurisdictionScope>({ municipality: null, barangay: null });
  const [drivers, setDrivers]     = useState<Driver[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [tab, setTab]             = useState<"ACTIVE" | "INACTIVE" | "REMOVED">("ACTIVE");
  const [selected, setSelected]   = useState<Driver | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState("");
  const [showAdd,  setShowAdd]     = useState(false);

  const fetchDrivers = useCallback(async (sc: JurisdictionScope) => {
    setLoading(true);

    // ── PRIMARY SCOPE: lgu_details.municipality ───────────────────────────────
    // AddDriverModal writes the driver's municipality + barangay into lgu_details
    // at creation time. This is the authoritative jurisdiction tag — no fallbacks
    // to schedule_assignments that could leak cross-municipality drivers.
    if (!sc.municipality) {
      // Admin has no jurisdiction set — show nothing rather than everything
      setDrivers([]);
      setLoading(false);
      return;
    }

    // 1. Get all driver IDs in this municipality from lgu_details
    const { data: lguRows } = await supabase
      .from("lgu_details")
      .select("id")
      .eq("municipality", sc.municipality)
      .eq("position_title", "Driver");

    const scopedIds = new Set<string>((lguRows ?? []).map((r: any) => r.id));

    if (scopedIds.size === 0) {
      setDrivers([]);
      setLoading(false);
      return;
    }

    // 2. Fetch profiles + driver_details for only those IDs
    const { data: allDrivers } = await supabase
      .from("profiles")
      .select(`id,full_name,email,contact_number,avatar_url,
               driver_details!inner(license_number,vehicle_plate_number,vehicle_type,assigned_route,employment_status,duty_status)`)
      .eq("role", "DRIVER")
      .in("id", [...scopedIds]);

    if (!allDrivers) { setLoading(false); return; }

    const ids = allDrivers.map((d: any) => d.id);
    const scopedDrivers = allDrivers;

    // Fetch collection stats
    const { data: collections } = ids.length > 0
      ? await supabase.from("collections").select("driver_id,created_at").in("driver_id", ids)
      : { data: [] };
    const collMap: Record<string, { count: number; last: string | null }> = {};
    (collections ?? []).forEach((c: any) => {
      if (!collMap[c.driver_id]) collMap[c.driver_id] = { count: 0, last: null };
      collMap[c.driver_id].count++;
      if (!collMap[c.driver_id].last || c.created_at > collMap[c.driver_id].last!)
        collMap[c.driver_id].last = c.created_at;
    });

    // Fetch schedule counts
    const { data: schedAssign } = ids.length > 0
      ? await supabase.from("schedule_assignments").select("driver_id").in("driver_id", ids).eq("is_active", true)
      : { data: [] };
    const schedMap: Record<string, number> = {};
    (schedAssign ?? []).forEach((s: any) => { schedMap[s.driver_id] = (schedMap[s.driver_id] ?? 0) + 1; });

    setDrivers(scopedDrivers.map((d: any) => {
      const det = d.driver_details;
      return {
        id: d.id, full_name: d.full_name ?? "Unknown Driver",
        email: d.email, contact_number: d.contact_number, avatar_url: d.avatar_url,
        license_number:       det?.license_number ?? null,
        vehicle_plate_number: det?.vehicle_plate_number ?? null,
        vehicle_type:         det?.vehicle_type ?? null,
        assigned_route:       det?.assigned_route ?? null,
        employment_status:    det?.employment_status ?? "ACTIVE",
        duty_status:          det?.duty_status ?? "OFF-DUTY",
        collections_count:    collMap[d.id]?.count ?? 0,
        last_collection:      collMap[d.id]?.last ?? null,
        schedules_count:      schedMap[d.id] ?? 0,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScope().then(sc => { setScope(sc); fetchDrivers(sc); });
  }, [fetchDrivers]);

  const filtered = drivers.filter(d => {
    const q = search.toLowerCase();
    const matchQ = d.full_name.toLowerCase().includes(q)
      || (d.vehicle_plate_number ?? "").toLowerCase().includes(q)
      || (d.license_number ?? "").toLowerCase().includes(q);
    const matchTab = d.employment_status === tab;
    return matchQ && matchTab;
  });

  const stats = {
    total:   drivers.filter(d => d.employment_status === "ACTIVE").length,
    onDuty:  drivers.filter(d => d.duty_status === "ON-DUTY").length,
    inactive:drivers.filter(d => d.employment_status === "INACTIVE").length,
    collections: drivers.reduce((s, d) => s + d.collections_count, 0),
  };

  const toggleEmployment = async (driver: Driver, newStatus: string) => {
    setProcessing(true);
    const { error } = await supabase.from("driver_details")
      .update({ employment_status: newStatus }).eq("id", driver.id);
    if (!error) {
      setDrivers(p => p.map(d => d.id === driver.id ? { ...d, employment_status: newStatus } : d));
      setSelected(s => s && s.id === driver.id ? { ...s, employment_status: newStatus } : s);
      setSaveMsg(`${driver.full_name} → ${newStatus}`); setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    }
    setProcessing(false);
  };

  const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "Never";

  const ec = (s: string) => EMPLOY_COLORS[s] ?? EMPLOY_COLORS["ACTIVE"];

  return (
    <div className="space-y-6">

      {/* ── ADD DRIVER BUTTON ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {(scope.municipality || scope.barangay) && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
              <Building2 size={12} className="text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                {[scope.barangay, scope.municipality].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filtered.length} operators</span>
          </div>
        )}
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm shadow-emerald-200 ml-auto">
          <Plus size={14} />
          Add New Driver
        </button>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Drivers", value: stats.total,       icon: <Truck size={16} />,        color: "emerald" },
          { label: "On Duty Now",    value: stats.onDuty,      icon: <Activity size={16} />,     color: "blue" },
          { label: "Inactive",       value: stats.inactive,    icon: <AlertTriangle size={16} />, color: "amber" },
          { label: "Total Trips",    value: stats.collections, icon: <CheckCircle2 size={16} />, color: "slate" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3
              ${s.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                s.color === "blue"    ? "bg-blue-50 text-blue-600" :
                s.color === "amber"   ? "bg-amber-50 text-amber-600" :
                                        "bg-slate-50 text-slate-600"}`}>
              {s.icon}
            </div>
            <p className="text-2xl font-black text-slate-900">{s.value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, plate, or license…"
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 ring-emerald-400/10 transition-all placeholder:text-slate-300 uppercase tracking-wide" />
        </div>
        <div className="flex bg-white border border-slate-200 p-1 rounded-xl gap-1 h-12">
          {(["ACTIVE", "INACTIVE", "REMOVED"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all
                ${tab === t
                  ? t === "ACTIVE"   ? "bg-emerald-600 text-white shadow-sm"
                  : t === "INACTIVE" ? "bg-amber-500 text-white shadow-sm"
                                     : "bg-red-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
          <UserX size={36} className="mx-auto text-slate-200 mb-3" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No operators found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => {
            const ec2 = ec(d.employment_status);
            return (
              <div key={d.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all overflow-hidden cursor-pointer"
                onClick={() => setSelected(d)}>
                <div className={`h-1 w-full ${d.employment_status === "ACTIVE" ? "bg-emerald-500" : d.employment_status === "INACTIVE" ? "bg-amber-400" : "bg-red-500"}`} />
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-slate-100 flex items-center justify-center overflow-hidden">
                      {d.avatar_url
                        ? <img src={d.avatar_url} alt={d.full_name} className="w-full h-full object-cover" />
                        : <span className="text-sm font-black text-slate-500">{initials(d.full_name)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors truncate">{d.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[d.duty_status] ?? "bg-slate-300"}`} />
                        <span className={`text-[9px] font-bold uppercase ${d.duty_status === "ON-DUTY" ? "text-emerald-600" : "text-slate-400"}`}>
                          {d.duty_status}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border uppercase ${ec2.bg} ${ec2.text} ${ec2.border}`}>
                      {d.employment_status}
                    </span>
                  </div>

                  {/* Plate + vehicle */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="px-3 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black tracking-widest font-mono">
                      {d.vehicle_plate_number ?? "NO PLATE"}
                    </div>
                    {d.vehicle_type && (
                      <span className="text-[9px] font-bold text-slate-500 uppercase">{d.vehicle_type}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Trips",     value: d.collections_count },
                      { label: "Schedules", value: d.schedules_count },
                      { label: "Last Trip", value: d.last_collection ? new Date(d.last_collection).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—" },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-sm font-black text-slate-700">{s.value}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DRIVER DETAIL MODAL ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className={`h-1.5 w-full ${selected.employment_status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-400"}`} />
            <div className="p-6 overflow-y-auto max-h-[85vh]">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                  {selected.avatar_url
                    ? <img src={selected.avatar_url} alt={selected.full_name} className="w-full h-full object-cover" />
                    : <span className="text-lg font-black text-slate-500">{initials(selected.full_name)}</span>}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-slate-900">{selected.full_name}</h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-2 h-2 rounded-full ${selected.duty_status === "ON-DUTY" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                    <span className={`text-[10px] font-bold uppercase ${selected.duty_status === "ON-DUTY" ? "text-emerald-600" : "text-slate-400"}`}>
                      {selected.duty_status}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-800 p-1">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Email",         value: selected.email ?? "N/A",                icon: <Mail size={11} /> },
                  { label: "Contact",       value: selected.contact_number ?? "N/A",        icon: <Phone size={11} /> },
                  { label: "License",       value: selected.license_number ?? "N/A",        icon: <ShieldCheck size={11} /> },
                  { label: "Plate No.",     value: selected.vehicle_plate_number ?? "N/A",  icon: <Hash size={11} /> },
                  { label: "Vehicle Type",  value: selected.vehicle_type ?? "N/A",          icon: <Truck size={11} /> },
                  { label: "Assigned Route",value: selected.assigned_route ?? "Unassigned", icon: <MapPin size={11} /> },
                  { label: "Total Trips",   value: String(selected.collections_count),      icon: <CheckCircle2 size={11} /> },
                  { label: "Schedules",     value: String(selected.schedules_count),        icon: <Calendar size={11} /> },
                  { label: "Last Trip",     value: fmtDate(selected.last_collection),       icon: <Clock size={11} /> },
                ].map(f => (
                  <div key={f.label} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">{f.icon}{f.label}</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Employment actions */}
              <div className="flex gap-3 pt-2">
                {selected.employment_status === "ACTIVE" && (
                  <>
                    <button onClick={() => toggleEmployment(selected, "INACTIVE")} disabled={processing}
                      className="flex-1 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50">
                      Set Inactive
                    </button>
                    <button onClick={() => toggleEmployment(selected, "REMOVED")} disabled={processing}
                      className="flex-1 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50">
                      Remove
                    </button>
                  </>
                )}
                {selected.employment_status !== "ACTIVE" && (
                  <button onClick={() => toggleEmployment(selected, "ACTIVE")} disabled={processing}
                    className="flex-1 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50">
                    {processing ? <><RefreshCcw size={12} className="inline animate-spin mr-1" />Processing…</> : "Restore to Active"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {saveOk && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl text-[11px] font-black uppercase tracking-widest">
          <CheckCircle2 size={14} /> {saveMsg}
        </div>
      )}

      {/* ── ADD DRIVER MODAL ── */}
      <AddDriverModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          setShowAdd(false);
          loadScope().then(sc => { setScope(sc); fetchDrivers(sc); });
        }}
      />
    </div>
  );
}