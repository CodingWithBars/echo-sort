"use client";
// components/admin/CitizenRegistry.tsx
// Jurisdiction-scoped citizen registry — shows only citizens whose
// citizen_details.municipality + barangay match the admin's lgu_details.

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search, Archive, User, MapPin, Phone, Mail, AlertTriangle,
  ChevronDown, Plus, RefreshCcw, ShieldAlert, CheckCircle2,
  Clock, TrendingDown, Eye, Ban, RotateCcw, Star,
  FileText, Building2, Hash,
} from "lucide-react";

const supabase = createClient();

interface JurisdictionScope { municipality: string | null; barangay: string | null; }

interface Citizen {
  id: string;
  full_name: string;
  email: string | null;
  contact_number: string | null;
  avatar_url: string | null;
  is_archived: boolean;
  warning_count: number;
  updated_at: string;
  barangay: string;
  municipality: string | null;
  purok: string | null;
  address_street: string | null;
  house_lot_number: string | null;
  service_type: string | null;
  score: number | null;
  violations_count: number;
  reports_count: number;
}

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return "#94a3b8";
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#f59e0b";
  return "#ef4444";
};

const SCORE_LABEL = (s: number | null) => {
  if (s === null) return "No Data";
  if (s >= 80) return "Excellent";
  if (s >= 60) return "At Risk";
  return "Critical";
};

async function loadScope(): Promise<JurisdictionScope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { municipality: null, barangay: null };
  const { data } = await supabase
    .from("lgu_details").select("municipality,barangay")
    .eq("id", user.id).limit(1);
  return { municipality: data?.[0]?.municipality ?? null, barangay: data?.[0]?.barangay ?? null };
}

export default function CitizenRegistry({ onEditProfile }: { onEditProfile: (c: any) => void }) {
  const [scope, setScope]           = useState<JurisdictionScope>({ municipality: null, barangay: null });
  const [citizens, setCitizens]     = useState<Citizen[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [purokFilter, setPurokFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected]     = useState<Citizen | null>(null);
  const [toArchive, setToArchive]   = useState<Citizen | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saveOk, setSaveOk]         = useState(false);

  const fetchCitizens = useCallback(async (sc: JurisdictionScope) => {
    setLoading(true);
    // Base query — scope by municipality first (if available), then barangay
    let q = supabase
      .from("profiles")
      .select(`id,full_name,email,contact_number,avatar_url,is_archived,warning_count,updated_at,
               citizen_details!inner(barangay,municipality,purok,address_street,house_lot_number,service_type)`)
      .eq("role", "CITIZEN")
      .eq("is_archived", showArchived)
      .order("full_name");

    if (sc.municipality) q = q.eq("citizen_details.municipality", sc.municipality);
    if (sc.barangay)     q = q.eq("citizen_details.barangay",     sc.barangay);

    const { data: profileData } = await q;

    if (!profileData) { setLoading(false); return; }

    const ids = profileData.map((p: any) => p.id);

    // Fetch latest citizen scores
    const { data: scores } = ids.length > 0
      ? await supabase
          .from("citizen_scores")
          .select("citizen_id,score")
          .in("citizen_id", ids)
          .order("score_month", { ascending: false })
      : { data: [] };

    const scoreMap: Record<string, number> = {};
    (scores ?? []).forEach((s: any) => { if (!scoreMap[s.citizen_id]) scoreMap[s.citizen_id] = s.score; });

    // Fetch violation counts
    const { data: violations } = ids.length > 0
      ? await supabase.from("violations").select("citizen_id").in("citizen_id", ids)
      : { data: [] };
    const violMap: Record<string, number> = {};
    (violations ?? []).forEach((v: any) => { violMap[v.citizen_id] = (violMap[v.citizen_id] ?? 0) + 1; });

    // Fetch report counts (as reporter)
    const { data: reports } = ids.length > 0
      ? await supabase.from("citizen_reports").select("reporter_id").in("reporter_id", ids)
      : { data: [] };
    const repMap: Record<string, number> = {};
    (reports ?? []).forEach((r: any) => { repMap[r.reporter_id] = (repMap[r.reporter_id] ?? 0) + 1; });

    setCitizens(profileData.map((p: any) => {
      const det = Array.isArray(p.citizen_details) ? p.citizen_details[0] : p.citizen_details;
      return {
        id: p.id, full_name: p.full_name ?? "Unknown", email: p.email,
        contact_number: p.contact_number, avatar_url: p.avatar_url,
        is_archived: p.is_archived, warning_count: p.warning_count ?? 0,
        updated_at: p.updated_at,
        barangay: det?.barangay ?? "Unassigned",
        municipality: det?.municipality ?? null,
        purok: det?.purok ?? null,
        address_street: det?.address_street ?? null,
        house_lot_number: det?.house_lot_number ?? null,
        service_type: det?.service_type ?? "General",
        score: scoreMap[p.id] ?? null,
        violations_count: violMap[p.id] ?? 0,
        reports_count: repMap[p.id] ?? 0,
      };
    }));
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    loadScope().then(sc => { setScope(sc); fetchCitizens(sc); });
  }, [fetchCitizens]);

  const puroks = useMemo(() =>
    ["All", ...Array.from(new Set(citizens.map(c => c.purok ?? "N/A"))).sort()], [citizens]);

  const filtered = useMemo(() => citizens.filter(c => {
    const q = search.toLowerCase();
    const matchQ = c.full_name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || c.id.includes(q);
    const matchP = purokFilter === "All" || (c.purok ?? "N/A") === purokFilter;
    const matchS = scoreFilter === "All"
      || (scoreFilter === "critical"  && (c.score ?? 100) < 60)
      || (scoreFilter === "at_risk"   && (c.score ?? 100) >= 60 && (c.score ?? 100) < 80)
      || (scoreFilter === "good"      && (c.score ?? 100) >= 80);
    return matchQ && matchP && matchS;
  }), [citizens, search, purokFilter, scoreFilter]);

  const stats = useMemo(() => ({
    total:    citizens.length,
    critical: citizens.filter(c => (c.score ?? 100) < 60).length,
    warnings: citizens.reduce((s, c) => s + c.warning_count, 0),
    reports:  citizens.reduce((s, c) => s + c.reports_count, 0),
  }), [citizens]);

  const handleArchive = async () => {
    if (!toArchive) return;
    setProcessing(true);
    const { error } = await supabase.from("profiles")
      .update({ is_archived: !toArchive.is_archived }).eq("id", toArchive.id);
    if (!error) {
      setCitizens(p => p.filter(c => c.id !== toArchive.id));
      setToArchive(null); setSelected(null); setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    }
    setProcessing(false);
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const fmtDate  = (d: string) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* ── JURISDICTION BADGE ── */}
      {(scope.municipality || scope.barangay) && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"0 4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:100}}>
            <Building2 size={12} style={{color:"#1c4532"}} />
            <span style={{fontSize:10,fontWeight:800,color:"#1c4532",textTransform:"uppercase",letterSpacing:".05em"}}>
              {[scope.barangay, scope.municipality].filter(Boolean).join(" · ")}
            </span>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".02em"}}>
            {filtered.length} residents
          </span>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Citizens",   value: stats.total,    icon: <User size={16} />,         color: "emerald" },
          { label: "Critical Score",   value: stats.critical, icon: <ShieldAlert size={16} />,  color: "red" },
          { label: "Total Warnings",   value: stats.warnings, icon: <AlertTriangle size={16} />,color: "amber" },
          { label: "Reports Filed",    value: stats.reports,  icon: <FileText size={16} />,     color: "blue" },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3
              ${s.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                s.color === "red"     ? "bg-red-50 text-red-600" :
                s.color === "amber"   ? "bg-amber-50 text-amber-600" :
                                        "bg-blue-50 text-blue-600"}`}>
              {s.icon}
            </div>
            <p className="text-2xl font-black text-slate-900">{s.value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div style={{position:"relative",flex:1}}>
          <Search size={16} style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search residents by name or ID…"
            style={{width:"100%",height:52,paddingLeft:48,paddingRight:20,background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,fontSize:14,color:"#111827",outline:"none"}}
            className="focus:border-[#1c4532] transition-all" />
        </div>

        <select value={purokFilter} onChange={e => setPurokFilter(e.target.value)}
          style={{height:52,padding:"0 20px",background:"#111827",color:"#fff",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",borderRadius:16,border:"none",outline:"none",cursor:"pointer",minWidth:140}}>
          {puroks.map(p => <option key={p} value={p}>{p === "All" ? "All Puroks" : `Purok ${p}`}</option>)}
        </select>

        <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
          style={{height:52,padding:"0 20px",background:"#111827",color:"#fff",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",borderRadius:16,border:"none",outline:"none",cursor:"pointer",minWidth:140}}>
          <option value="All">All Scores</option>
          <option value="critical">Critical (below 60)</option>
          <option value="at_risk">At Risk (60–80)</option>
          <option value="good">Good (80+)</option>
        </select>

        <button onClick={() => setShowArchived(p => !p)}
          style={{
            height:52,padding:"0 24px",borderRadius:16,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",display:"flex",alignItems:"center",gap:10,transition:"all .2s",cursor:"pointer",
            background:showArchived ? "#f59e0b" : "#f0fdf4",
            color:showArchived ? "#fff" : "#166534",
            border:showArchived ? "none" : "1px solid #dcfce7"
          }}>
          {showArchived ? <><User size={14} /> Active</> : <><Archive size={14} /> Archives</>}
        </button>
      </div>

      {/* ── GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-52 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
          <User size={36} className="mx-auto text-slate-200 mb-3" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No residents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const score = c.score;
            const scoreColor = SCORE_COLOR(score);
            return (
              <div key={c.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all duration-200 overflow-hidden cursor-pointer"
                onClick={() => setSelected(c)}>
                {/* Score accent bar */}
                <div className="h-1" style={{ background: scoreColor }} />
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt={c.full_name} className="w-full h-full object-cover" />
                        : <span className="text-sm font-black text-slate-500">{initials(c.full_name)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                          {c.full_name}
                        </p>
                        {c.warning_count > 0 && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-md uppercase">
                            {c.warning_count}⚠
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{c.email ?? "No email"}</p>
                    </div>
                    {/* Score badge */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-black" style={{ color: scoreColor }}>
                        {score !== null ? score : "—"}
                      </p>
                      <p className="text-[8px] font-bold uppercase" style={{ color: scoreColor }}>
                        {SCORE_LABEL(score)}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl mb-3">
                    <MapPin size={11} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-slate-600 truncate">
                      {c.purok ? `Purok ${c.purok}, ` : ""}{c.barangay}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Violations", value: c.violations_count, hot: c.violations_count > 0 },
                      { label: "Reports",    value: c.reports_count,    hot: false },
                      { label: "Service",    value: c.service_type ?? "General", hot: false },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className={`text-sm font-black ${s.hot ? "text-red-600" : "text-slate-700"}`}>{s.value}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors">
                    Manage
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CITIZEN DETAIL MODAL ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: SCORE_COLOR(selected.score) }} />
            <div className="p-6 overflow-y-auto max-h-[85vh]">
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                  {selected.avatar_url
                    ? <img src={selected.avatar_url} alt={selected.full_name} className="w-full h-full object-cover" />
                    : <span className="text-lg font-black text-slate-500">{initials(selected.full_name)}</span>}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-slate-900">{selected.full_name}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    ID: {selected.id.slice(0, 12)}…
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-[9px] font-black px-2 py-1 rounded-lg border uppercase"
                      style={{ background: SCORE_COLOR(selected.score) + "15", color: SCORE_COLOR(selected.score), borderColor: SCORE_COLOR(selected.score) + "40" }}>
                      Score: {selected.score ?? "N/A"} · {SCORE_LABEL(selected.score)}
                    </span>
                    {selected.warning_count > 0 && (
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg border uppercase bg-red-50 text-red-600 border-red-200">
                        {selected.warning_count} Warning{selected.warning_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-800 p-1">✕</button>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Email",           value: selected.email ?? "N/A",             icon: <Mail size={11} /> },
                  { label: "Contact",         value: selected.contact_number ?? "N/A",    icon: <Phone size={11} /> },
                  { label: "Barangay",        value: selected.barangay,                   icon: <MapPin size={11} /> },
                  { label: "Municipality",    value: selected.municipality ?? "N/A",      icon: <Building2 size={11} /> },
                  { label: "Purok",           value: selected.purok ? `Purok ${selected.purok}` : "N/A", icon: <Hash size={11} /> },
                  { label: "Address",         value: selected.address_street ?? "N/A",    icon: <MapPin size={11} /> },
                  { label: "Lot / Unit",      value: selected.house_lot_number ?? "N/A",  icon: <Hash size={11} /> },
                  { label: "Service Type",    value: selected.service_type ?? "General",  icon: <Star size={11} /> },
                  { label: "Violations",      value: String(selected.violations_count),   icon: <ShieldAlert size={11} /> },
                  { label: "Reports Filed",   value: String(selected.reports_count),      icon: <FileText size={11} /> },
                  { label: "Last Updated",    value: fmtDate(selected.updated_at),        icon: <Clock size={11} /> },
                ].map(f => (
                  <div key={f.label} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                      {f.icon}{f.label}
                    </p>
                    <p className="text-xs font-bold text-slate-800 truncate">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {!selected.is_archived && (
                  <button onClick={() => { onEditProfile(selected); setSelected(null); }}
                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                    Edit Profile
                  </button>
                )}
                <button onClick={() => setToArchive(selected)}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    selected.is_archived
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white"
                      : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-600 hover:text-white"}`}>
                  {selected.is_archived ? "Restore" : "Archive"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ARCHIVE CONFIRM ── */}
      {toArchive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !processing && setToArchive(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 text-center">
            <div className={`w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center ${toArchive.is_archived ? "bg-emerald-100" : "bg-red-100"}`}>
              {processing ? <RefreshCcw size={20} className="animate-spin text-slate-500" />
                : toArchive.is_archived ? <RotateCcw size={20} className="text-emerald-600" />
                : <Archive size={20} className="text-red-600" />}
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">
              {toArchive.is_archived ? "Restore Resident?" : "Archive Resident?"}
            </h3>
            <p className="text-[11px] text-slate-400 font-bold mb-6 px-4 leading-relaxed">
              {toArchive.is_archived
                ? `${toArchive.full_name} will be moved back to the active registry.`
                : `${toArchive.full_name} will be removed from the active registry.`}
            </p>
            <div className="flex flex-col gap-2">
              <button disabled={processing} onClick={handleArchive}
                className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50
                  ${toArchive.is_archived ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-red-600"}`}>
                {processing ? "Processing…" : `Confirm ${toArchive.is_archived ? "Restore" : "Archive"}`}
              </button>
              {!processing && (
                <button onClick={() => setToArchive(null)}
                  className="w-full py-3.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS TOAST ── */}
      {saveOk && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl text-[11px] font-black uppercase tracking-widest">
          <CheckCircle2 size={14} /> Done
        </div>
      )}
    </div>
  );
}