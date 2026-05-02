"use client";
// components/admin/CollectionsView.tsx
// Jurisdiction-scoped collections — only records from drivers assigned to
// schedules in the admin's barangay/municipality.

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search, ChevronDown, Download, Truck, CheckCircle2,
  X, BarChart3, Clock, Scale, MapPin, Building2,
  Calendar, ArrowUpDown, TrendingUp, RefreshCcw, Hash,
} from "lucide-react";

const supabase = createClient();

interface JurisdictionScope { municipality: string | null; barangay: string | null; }

interface CollectionRecord {
  id: string;
  created_at: string;
  barangay: string;
  weight: number;
  type: string;
  status: string;
  driver_name: string | null;
  bin_name: string | null;
  device_id: string | null;
}

interface BarangaySummary {
  name:           string;
  weight:         number;
  count:          number;
  lastCollection: string;
  status:         "High" | "Normal" | "Low";
  drivers:        Set<string>;
}

async function loadScope(): Promise<JurisdictionScope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { municipality: null, barangay: null };
  const { data } = await supabase
    .from("lgu_details").select("municipality,barangay")
    .eq("id", user.id).limit(1);
  return { municipality: data?.[0]?.municipality ?? null, barangay: data?.[0]?.barangay ?? null };
}

const STATUS_COLOR = (s: "High" | "Normal" | "Low") =>
  s === "High" ? "bg-[#ef4444]" : s === "Normal" ? "bg-[#10b981]" : "bg-[#f59e0b]";

export default function CollectionsView() {
  const [scope, setScope]               = useState<JurisdictionScope>({ municipality: null, barangay: null });
  const [records, setRecords]           = useState<CollectionRecord[]>([]);
  const [barangays, setBarangays]       = useState<BarangaySummary[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [sortBy, setSortBy]             = useState("weight-high");
  const [selectedBrgy, setSelectedBrgy] = useState<BarangaySummary | null>(null);
  const [viewMode, setViewMode]         = useState<"summary" | "records">("summary");
  const [sortRecords, setSortRecords]   = useState<"desc" | "asc">("desc");

  const fetchCollections = useCallback(async (sc: JurisdictionScope) => {
    setLoading(true);

    // Get driver IDs scoped to this jurisdiction via schedule_assignments
    let scopedDriverIds: string[] | null = null;
    if (sc.barangay) {
      const { data: sched } = await supabase
        .from("schedule_assignments")
        .select("driver_id,collection_schedules!inner(barangay,municipality)")
        .eq("collection_schedules.barangay", sc.barangay)
        .eq("is_active", true);
      if (sched && sched.length > 0) {
        scopedDriverIds = [...new Set<string>(sched.map((s: any) => s.driver_id as string))];
      }
    }

    let q = supabase
      .from("collections")
      .select(`id,created_at,barangay,weight,type,status,driver_id,bin_id,device_id,
               profiles:driver_id(full_name),
               bins:bin_id(name)`)
      .order("created_at", { ascending: sortRecords === "asc" });

    if (sc.barangay) q = q.eq("barangay", sc.barangay);
    if (scopedDriverIds && scopedDriverIds.length > 0) {
      q = q.in("driver_id", scopedDriverIds);
    }

    const { data } = await q;
    const raw: CollectionRecord[] = (data ?? []).map((r: any) => ({
      id:           r.id,
      created_at:   r.created_at,
      barangay:     r.barangay,
      weight:       Number(r.weight ?? 0),
      type:         r.type,
      status:       r.status ?? "VERIFIED",
      driver_name:  r.profiles?.full_name ?? null,
      bin_name:     r.bins?.name ?? null,
      device_id:    r.device_id ?? null,
    }));

    setRecords(raw);

    // Aggregate by barangay
    const grouped: Record<string, BarangaySummary> = {};
    raw.forEach(r => {
      if (!grouped[r.barangay]) grouped[r.barangay] = { name:r.barangay, weight:0, count:0, lastCollection:r.created_at, status:"Low", drivers:new Set() };
      grouped[r.barangay].weight += r.weight;
      grouped[r.barangay].count++;
      if (r.created_at > grouped[r.barangay].lastCollection) grouped[r.barangay].lastCollection = r.created_at;
      if (r.driver_name) grouped[r.barangay].drivers.add(r.driver_name);
    });
    const summaries = Object.values(grouped).map(b => ({
      ...b,
      status: (b.weight > 1000 ? "High" : b.weight > 400 ? "Normal" : "Low") as "High" | "Normal" | "Low",
    }));
    setBarangays(summaries);
    setLoading(false);
  }, [sortRecords]);

  useEffect(() => {
    loadScope().then(sc => { setScope(sc); fetchCollections(sc); });
  }, [fetchCollections]);

  const totalWeight = records.reduce((s, r) => s + r.weight, 0);
  const totalTrips  = records.length;
  const uniqueDrivers = new Set(records.map(r => r.driver_name).filter(Boolean)).size;
  const thisMonth = records.filter(r =>
    new Date(r.created_at).getMonth() === new Date().getMonth()).length;

  const sortedBarangays = [...barangays]
    .filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "weight-high") return b.weight - a.weight;
      if (sortBy === "weight-low")  return a.weight - b.weight;
      if (sortBy === "name")        return a.name.localeCompare(b.name);
      if (sortBy === "count")       return b.count - a.count;
      return 0;
    });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit", hour12:true });

  const filteredRecords = records.filter(r => {
    const q = search.toLowerCase();
    return (r.driver_name ?? "").toLowerCase().includes(q)
      || r.barangay.toLowerCase().includes(q)
      || r.type.toLowerCase().includes(q)
      || (r.bin_name ?? "").toLowerCase().includes(q);
  }).sort((a,b) => sortRecords === "desc"
    ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    : new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
          <button onClick={() => fetchCollections(scope)}
            style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:"#9ca3af",background:"none",border:"none",cursor:"pointer"}}
            className="hover:text-[#1c4532] transition-colors">
            <RefreshCcw size={14} /> Refresh Logs
          </button>
        </div>
      )}

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Weight",    value: `${totalWeight.toLocaleString()} kg`, icon: <Scale size={16} />,       color: "emerald" },
          { label: "Total Trips",     value: totalTrips,                           icon: <Truck size={16} />,       color: "blue" },
          { label: "Active Drivers",  value: uniqueDrivers,                        icon: <TrendingUp size={16} />,  color: "amber" },
          { label: "This Month",      value: thisMonth,                            icon: <Calendar size={16} />,    color: "slate" },
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
      <div className="flex flex-col md:flex-row gap-4">
        <div style={{position:"relative",flex:1}}>
          <Search size={16} style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search records by driver, bin, or type…"
            style={{width:"100%",height:52,paddingLeft:48,paddingRight:20,background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,fontSize:14,color:"#111827",outline:"none"}}
            className="focus:border-[#1c4532] transition-all" />
        </div>
        <div style={{display:"flex",background:"#fff",border:"1px solid #e5e7eb",padding:6,borderRadius:16,gap:4,height:52}}>
          <button onClick={() => setViewMode("summary")}
            style={{
              padding:"0 20px",borderRadius:12,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",border:"none",cursor:"pointer",transition:"all .2s",
              background:viewMode === "summary" ? "#1c4532" : "transparent",
              color:viewMode === "summary" ? "#fff" : "#6b7280"
            }}>
            Summary
          </button>
          <button onClick={() => setViewMode("records")}
            style={{
              padding:"0 20px",borderRadius:12,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",border:"none",cursor:"pointer",transition:"all .2s",
              background:viewMode === "records" ? "#111827" : "transparent",
              color:viewMode === "records" ? "#fff" : "#6b7280"
            }}>
            Records
          </button>
        </div>
        {viewMode === "summary" ? (
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{height:52,padding:"0 20px",background:"#111827",color:"#fff",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",borderRadius:16,border:"none",outline:"none",cursor:"pointer",minWidth:200}}>
            <option value="weight-high">Sort: Highest Weight</option>
            <option value="weight-low">Sort: Lowest Weight</option>
            <option value="count">Sort: Most Trips</option>
            <option value="name">Sort: Alphabetical</option>
          </select>
        ) : (
          <button onClick={() => setSortRecords(o => o === "desc" ? "asc" : "desc")}
            style={{height:52,padding:"0 24px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,display:"flex",alignItems:"center",gap:10,fontSize:11,fontWeight:800,color:"#111827",textTransform:"uppercase",letterSpacing:".05em",cursor:"pointer"}}
            className="hover:border-[#1c4532]">
            <ArrowUpDown size={14} style={{color:"#10b981"}} />
            {sortRecords === "desc" ? "Newest First" : "Oldest First"}
          </button>
        )}
      </div>

      {/* ── SUMMARY VIEW ── */}
      {viewMode === "summary" && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-44 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />)}
          </div>
        ) : sortedBarangays.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
            <Truck size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No collection data found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedBarangays.map(b => (
              <div key={b.name} onClick={() => setSelectedBrgy(b)}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all cursor-pointer overflow-hidden">
                <div className={`h-1.5 w-full ${STATUS_COLOR(b.status)}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border uppercase
                      ${b.status === "High"   ? "bg-red-50 text-red-700 border-red-200" :
                        b.status === "Normal" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {b.status} Volume
                    </span>
                    <span className="text-[9px] text-slate-300 font-bold">{b.count} logs</span>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg group-hover:text-emerald-700 transition-colors italic uppercase">{b.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1 mb-4">
                    <span className="text-3xl font-black text-slate-900">{b.weight.toLocaleString()}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase">kg</span>
                  </div>
                  <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden mb-4">
                    <div className={`${STATUS_COLOR(b.status)} h-full transition-all duration-700`}
                      style={{ width: `${Math.min((b.weight / 2000) * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <div className="flex items-center gap-1"><MapPin size={9} className="text-emerald-500" />{b.drivers.size} driver{b.drivers.size !== 1 ? "s":""}</div>
                    <div className="flex items-center gap-1"><Calendar size={9} />{fmtDate(b.lastCollection)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── RECORDS VIEW ── */}
      {viewMode === "records" && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Date & Time", "Driver", "Bin / Station", "Barangay", "Type", "Weight", "Status"].map(h => (
                    <th key={h} className="px-5 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-[11px] font-black text-slate-300 uppercase tracking-widest">
                      No records found
                    </td>
                  </tr>
                ) : filteredRecords.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-slate-50 hover:bg-emerald-50/30 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                    <td className="px-5 py-3">
                      <p className="text-[11px] font-bold text-slate-700">{fmtDate(r.created_at)}</p>
                      <p className="text-[9px] text-slate-400">{fmtTime(r.created_at)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[11px] font-bold text-slate-700">{r.driver_name ?? "Unknown"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[11px] font-bold text-slate-700">{r.bin_name ?? r.device_id ?? "N/A"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg uppercase">{r.barangay}</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{r.type}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[11px] font-black text-slate-900">{r.weight.toFixed(1)} kg</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase
                        ${r.status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── BARANGAY DETAIL MODAL ── */}
      {selectedBrgy && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setSelectedBrgy(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className={`h-1.5 w-full ${STATUS_COLOR(selectedBrgy.status)}`} />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 italic uppercase">{selectedBrgy.name}</h2>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Collection Intelligence</p>
                </div>
                <button onClick={() => setSelectedBrgy(null)} className="text-slate-400 hover:text-slate-800 p-1">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label:"Total Weight",  value:`${selectedBrgy.weight.toLocaleString()} kg`, icon:<Scale size={14}/> },
                  { label:"Total Trips",   value:selectedBrgy.count,                           icon:<Truck size={14}/> },
                  { label:"Active Drivers",value:selectedBrgy.drivers.size,                    icon:<TrendingUp size={14}/> },
                  { label:"Last Collection",value:fmtDate(selectedBrgy.lastCollection),        icon:<Clock size={14}/> },
                ].map(s => (
                  <div key={s.label} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">{s.icon}<span className="text-[8px] font-black uppercase tracking-widest">{s.label}</span></div>
                    <p className="text-lg font-black text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>

              {selectedBrgy.drivers.size > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 mb-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Assigned Drivers</p>
                  <div className="flex flex-wrap gap-2">
                    {[...selectedBrgy.drivers].map(name => (
                      <span key={name} className="text-[10px] font-bold px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSelectedBrgy(null)}
                  className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Close
                </button>
                <button onClick={() => { setSearch(selectedBrgy.name); setViewMode("records"); setSelectedBrgy(null); }}
                  className="py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                  View Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}