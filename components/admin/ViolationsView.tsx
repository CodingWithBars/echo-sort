"use client";
// components/admin/ViolationsView.tsx
// Jurisdiction-scoped violations — only citizens in admin's barangay/municipality.

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search, Plus, Archive, RefreshCcw, CheckCircle2, AlertTriangle,
  Calendar, MapPin, Clock, FileText, Building2, User,
  ShieldAlert, ArrowUpDown, RotateCcw, Eye, Filter,
  TrendingUp, Hash, ChevronRight,
} from "lucide-react";

const supabase = createClient();

interface JurisdictionScope { municipality: string | null; barangay: string | null; }

interface Violation {
  id: string;
  citizen_id: string | null;
  barangay: string;
  type: string;
  description: string | null;
  status: "Pending" | "Under Review" | "Resolved";
  created_at: string;
  resolved_at: string | null;
  citizen_name: string | null;
  citizen_email: string | null;
  citizen_warnings: number;
  citizen_barangay: string | null;
}

const STATUS_CFG = {
  "Pending":      { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500"    },
  "Under Review": { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-500"  },
  "Resolved":     { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot: "bg-emerald-500"},
};

async function loadScope(): Promise<JurisdictionScope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { municipality: null, barangay: null };
  const { data } = await supabase
    .from("lgu_details").select("municipality,barangay")
    .eq("id", user.id).limit(1);
  return { municipality: data?.[0]?.municipality ?? null, barangay: data?.[0]?.barangay ?? null };
}

export default function ViolationsView() {
  const [scope, setScope]               = useState<JurisdictionScope>({ municipality: null, barangay: null });
  const [violations, setViolations]     = useState<Violation[]>([]);
  const [archivedLogs, setArchivedLogs] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [viewMode, setViewMode]         = useState<"active" | "archived">("active");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder]       = useState<"desc" | "asc">("desc");
  const [selected, setSelected]         = useState<Violation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason]     = useState("");
  const [processing, setProcessing]         = useState(false);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [addForm, setAddForm]               = useState({ citizen_id:"", type:"Improper Disposal", description:"", barangay:"" });
  const [citizenSearch, setCitizenSearch]   = useState("");
  const [citizenResults, setCitizenResults] = useState<any[]>([]);
  const [saveOk, setSaveOk]                 = useState(false);

  const fetchViolations = useCallback(async (sc: JurisdictionScope) => {
    setLoading(true);

    // Hard guard: admin must have a jurisdiction set — never show cross-municipality data
    if (!sc.municipality && !sc.barangay) {
      setViolations([]);
      setLoading(false);
      return;
    }

    let q = supabase
      .from("violations")
      .select(`*,profiles:citizen_id(full_name,email,warning_count,citizen_details(barangay,municipality))`)
      .order("created_at", { ascending: sortOrder === "asc" });

    // Scope by barangay (primary) or municipality fallback
    if (sc.barangay) {
      q = q.eq("barangay", sc.barangay);
    } else if (sc.municipality) {
      // LGU/admin covers whole municipality — no barangay restriction
      q = q.eq("barangay", sc.municipality); // municipality-level admins rarely exist but handled
    }

    if (statusFilter !== "All") q = q.eq("status", statusFilter);

    const { data } = await q;
    setViolations((data ?? []).map((v: any) => {
      const p = v.profiles;
      const det = Array.isArray(p?.citizen_details) ? p?.citizen_details[0] : p?.citizen_details;
      return {
        id: v.id, citizen_id: v.citizen_id, barangay: v.barangay,
        type: v.type, description: v.description, status: v.status,
        created_at: v.created_at, resolved_at: v.resolved_at,
        citizen_name: p?.full_name ?? "Unknown",
        citizen_email: p?.email ?? null,
        citizen_warnings: p?.warning_count ?? 0,
        citizen_barangay: det?.barangay ?? v.barangay,
      };
    }));

    // Fetch archived violation logs
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action_type", "DELETE_VIOLATION")
      .order("created_at", { ascending: false });
    setArchivedLogs(logs ?? []);

    setLoading(false);
  }, [sortOrder, statusFilter]);

  useEffect(() => {
    loadScope().then(sc => { setScope(sc); fetchViolations(sc); });
  }, [fetchViolations]);

  const stats = {
    total:      violations.length,
    pending:    violations.filter(v => v.status === "Pending").length,
    reviewing:  violations.filter(v => v.status === "Under Review").length,
    resolved:   violations.filter(v => v.status === "Resolved").length,
  };

  const filtered = violations.filter(v => {
    const q = search.toLowerCase();
    return (v.citizen_name ?? "").toLowerCase().includes(q)
      || v.type.toLowerCase().includes(q)
      || v.barangay.toLowerCase().includes(q);
  });

  const updateStatus = async (id: string, newStatus: string) => {
    setProcessing(true);
    const { error } = await supabase.from("violations").update({ status: newStatus }).eq("id", id);
    if (!error) {
      setViolations(p => p.map(v => v.id === id ? { ...v, status: newStatus as any } : v));
      setSelected(s => s && s.id === id ? { ...s, status: newStatus as any } : s);
      setSaveOk(true); setTimeout(() => setSaveOk(false), 2500);
    }
    setProcessing(false);
  };

  const confirmDelete = async () => {
    if (!selected || !deleteReason.trim()) return;
    setProcessing(true);
    await supabase.from("audit_logs").insert({
      action_type: "DELETE_VIOLATION",
      target_id: selected.citizen_id,
      reason: deleteReason,
      metadata: { resident: selected.citizen_name, type: selected.type, description: selected.description, barangay: selected.barangay },
    });
    await supabase.from("violations").delete().eq("id", selected.id);
    setViolations(p => p.filter(v => v.id !== selected.id));
    setShowDeleteConfirm(false); setSelected(null); setDeleteReason("");
    await fetchViolations(scope);
    setProcessing(false);
  };

  const restore = async (log: any) => {
    setProcessing(true);
    await supabase.from("violations").insert({
      citizen_id: log.target_id, type: log.metadata?.type,
      description: log.metadata?.description, barangay: log.metadata?.barangay ?? scope.barangay ?? "",
      status: "Pending",
    });
    await supabase.from("audit_logs").delete().eq("id", log.id);
    setArchivedLogs(p => p.filter(l => l.id !== log.id));
    await fetchViolations(scope);
    setProcessing(false);
  };

  const searchCitizens = async (q: string) => {
    if (!q.trim()) { setCitizenResults([]); return; }
    let query = supabase.from("profiles").select("id,full_name,email,citizen_details!inner(barangay)")
      .eq("role", "CITIZEN").ilike("full_name", `%${q}%`).limit(8);
    if (scope.barangay) query = query.eq("citizen_details.barangay", scope.barangay);
    const { data } = await query;
    setCitizenResults(data ?? []);
  };

  const submitViolation = async () => {
    if (!addForm.citizen_id || !addForm.type) return;
    setProcessing(true);
    await supabase.from("violations").insert({
      citizen_id: addForm.citizen_id,
      type: addForm.type, description: addForm.description || null,
      barangay: addForm.barangay || scope.barangay || "",
      status: "Pending",
    });
    // increment warning_count
    await supabase.rpc ? null : null; // skip rpc, just refetch
    setShowAddModal(false); setAddForm({ citizen_id:"", type:"Improper Disposal", description:"", barangay:"" });
    setCitizenResults([]); setCitizenSearch("");
    await fetchViolations(scope);
    setSaveOk(true); setTimeout(() => setSaveOk(false), 2500);
    setProcessing(false);
  };

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "N/A";

  const VIOLATION_TYPES = [
    "Improper Disposal","Littering","Open Burning","Illegal Dumping",
    "Non-Compliance with Segregation","Hazardous Waste Violation","Other",
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* ── JURISDICTION BADGE ── */}
      {(scope.municipality || scope.barangay) && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
            <Building2 size={12} className="text-emerald-600" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
              {[scope.barangay, scope.municipality].filter(Boolean).join(" · ")}
            </span>
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
            <Plus size={13} /> Report Incident
          </button>
        </div>
      )}

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",       value: stats.total,     color: "slate",   icon: <FileText size={16} /> },
          { label: "Pending",     value: stats.pending,   color: "red",     icon: <AlertTriangle size={16} /> },
          { label: "Under Review",value: stats.reviewing, color: "amber",   icon: <Clock size={16} /> },
          { label: "Resolved",    value: stats.resolved,  color: "emerald", icon: <CheckCircle2 size={16} /> },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3
              ${s.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                s.color === "red"     ? "bg-red-50 text-red-600" :
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
            placeholder="Search resident, type, barangay…"
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 ring-emerald-400/10 transition-all placeholder:text-slate-300 uppercase tracking-wide" />
        </div>
        <div className="flex bg-white border border-slate-200 p-1 rounded-xl gap-1 h-12">
          <button onClick={() => setViewMode("active")}
            className={`px-5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${viewMode === "active" ? "bg-emerald-600 text-white" : "text-slate-400"}`}>
            Active
          </button>
          <button onClick={() => setViewMode("archived")}
            className={`px-5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${viewMode === "archived" ? "bg-slate-900 text-white" : "text-slate-400"}`}>
            Archived
          </button>
        </div>
        <button onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
          className="h-12 px-4 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all">
          <ArrowUpDown size={13} className="text-emerald-500" />
          {sortOrder === "desc" ? "Newest" : "Oldest"}
        </button>
      </div>

      {viewMode === "active" && (
        <div className="flex gap-2 flex-wrap">
          {["All", "Pending", "Under Review", "Resolved"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all
                ${statusFilter === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200 text-slate-400 hover:border-emerald-300"}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />)}
        </div>
      ) : viewMode === "active" ? (
        filtered.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
            <ShieldAlert size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No violations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(v => {
              const sc = STATUS_CFG[v.status] ?? STATUS_CFG["Pending"];
              return (
                <div key={v.id} onClick={() => setSelected(v)}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-red-100 transition-all cursor-pointer overflow-hidden">
                  <div className={`h-1 w-full ${sc.dot}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg border uppercase ${sc.bg} ${sc.text} ${sc.border}`}>
                        {v.status}
                      </span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase">#{v.id.slice(0,8)}</span>
                    </div>
                    <h3 className="font-black text-slate-900 text-base group-hover:text-red-700 transition-colors">{v.citizen_name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{v.type}</p>
                    {v.description && (
                      <p className="text-[10px] text-slate-400 mt-2 line-clamp-2">{v.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                        <MapPin size={10} className="text-emerald-500" />
                        {v.barangay}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                        <Calendar size={10} />
                        {fmtDate(v.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivedLogs.map(log => (
            <div key={log.id} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
              <h4 className="text-white font-black text-base mb-1">{log.metadata?.resident ?? "Unknown"}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{log.metadata?.type}</p>
              <p className="text-[10px] text-emerald-400 italic leading-relaxed mb-4 opacity-80 line-clamp-2">"{log.reason}"</p>
              <p className="text-[9px] font-bold text-slate-600 uppercase mb-4">{fmtDate(log.created_at)}</p>
              <button onClick={() => restore(log)} disabled={processing}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50">
                {processing ? "Restoring…" : "Restore Record"}
              </button>
            </div>
          ))}
          {archivedLogs.length === 0 && (
            <div className="col-span-3 py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
              <Archive size={36} className="mx-auto text-slate-200 mb-3" />
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Archive is empty</p>
            </div>
          )}
        </div>
      )}

      {/* ── VIOLATION DETAIL MODAL ── */}
      {selected && !showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className={`h-1.5 w-full ${STATUS_CFG[selected.status]?.dot ?? "bg-red-500"}`} />
            <div className="p-6 overflow-y-auto max-h-[85vh]">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selected.citizen_name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase ${STATUS_CFG[selected.status]?.bg} ${STATUS_CFG[selected.status]?.text} ${STATUS_CFG[selected.status]?.border}`}>
                      {selected.status}
                    </span>
                    {selected.citizen_warnings > 0 && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase bg-red-50 text-red-600 border-red-200">
                        {selected.citizen_warnings} warnings
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-100">
                    <Archive size={16} />
                  </button>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-800 p-1">✕</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Type",      value: selected.type,                  icon: <ShieldAlert size={11} /> },
                  { label: "Barangay",  value: selected.barangay,              icon: <MapPin size={11} /> },
                  { label: "Filed",     value: fmtDate(selected.created_at),   icon: <Calendar size={11} /> },
                  { label: "Resolved",  value: fmtDate(selected.resolved_at),  icon: <CheckCircle2 size={11} /> },
                ].map(f => (
                  <div key={f.label} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">{f.icon}{f.label}</p>
                    <p className="text-xs font-bold text-slate-800">{f.value}</p>
                  </div>
                ))}
              </div>

              {selected.description && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Incident Narrative</p>
                  <p className="text-sm text-slate-700 leading-relaxed italic border-l-2 border-emerald-500 pl-3">{selected.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => updateStatus(selected.id, "Under Review")} disabled={processing}
                  className="py-3 bg-white border border-amber-200 text-amber-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50">
                  Under Review
                </button>
                <button onClick={() => updateStatus(selected.id, "Resolved")} disabled={processing}
                  className="py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200">
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-red-600 w-full" />
            <div className="p-7">
              <h3 className="text-lg font-black text-slate-900 mb-1">Archive Violation</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-5">State reason for archival</p>
              <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                placeholder="Reason for archiving this record…"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none resize-none focus:border-red-400 transition-all mb-4"
                rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="py-3.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">
                  Cancel
                </button>
                <button onClick={confirmDelete} disabled={!deleteReason.trim() || processing}
                  className="py-3.5 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-200">
                  {processing ? "Archiving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD VIOLATION MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-red-500 w-full" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Report Incident</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{scope.barangay}</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
              </div>

              {/* Citizen search */}
              <div className="mb-4">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Citizen</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={citizenSearch}
                    onChange={e => { setCitizenSearch(e.target.value); searchCitizens(e.target.value); }}
                    placeholder="Search citizen name…"
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-red-400 uppercase tracking-wide" />
                </div>
                {citizenResults.length > 0 && (
                  <div className="mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                    {citizenResults.map((c: any) => {
                      const det = Array.isArray(c.citizen_details) ? c.citizen_details[0] : c.citizen_details;
                      return (
                        <button key={c.id} onClick={() => {
                          setAddForm(f => ({ ...f, citizen_id: c.id, barangay: det?.barangay ?? scope.barangay ?? "" }));
                          setCitizenSearch(c.full_name); setCitizenResults([]);
                        }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-50 last:border-0 transition-colors">
                          <p className="text-[11px] font-bold text-slate-900">{c.full_name}</p>
                          <p className="text-[9px] text-slate-400">{c.email} · Brgy. {det?.barangay ?? "N/A"}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Violation Type</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-red-400 uppercase tracking-wide cursor-pointer">
                  {VIOLATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="mb-5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Description (optional)</label>
                <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the incident…" rows={3}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none resize-none focus:border-red-400 transition-all" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest">
                  Cancel
                </button>
                <button onClick={submitViolation} disabled={!addForm.citizen_id || processing}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-200">
                  {processing ? "Filing…" : "File Violation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saveOk && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl text-[11px] font-black uppercase tracking-widest">
          <CheckCircle2 size={14} /> Updated
        </div>
      )}
    </div>
  );
}