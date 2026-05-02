"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/citizen/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import dynamic from "next/dynamic";
import {
  MapPin, Calendar, TrendingUp, Flag, Bell, LogOut, Menu, X,
  CheckCircle, AlertTriangle, Info, Trash2, Megaphone,
  Shield, FileText, Search, ChevronRight,
} from "lucide-react";
import CitizenProfileViewInner from "@/components/citizen/CitizenProfileView";

const supabase = createClient();

const CitizenBinMap = dynamic(
  () => import("@/components/citizen/CitizenBinMap"),
  { ssr: false }
);

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface CitizenProfile {
  id: string; full_name: string; email: string;
  contact_number: string; warning_count: number;
  barangay: string; municipality: string; purok: string;
  address_street: string; service_type: string;
  avatar_url?: string | null;
}
interface ScoreRecord { score: number; score_month: string; violations_count: number; warnings_count: number; resolved_count: number; }
interface Violation   { id: string; type: string; description: string; status: string; created_at: string; resolved_at: string | null; }
interface Schedule    { id: string; label: string; day_of_week: number | null; scheduled_time: string | null; waste_types: string[]; notes: string | null; is_active: boolean; }
interface Broadcast   { id: string; title: string; body: string; type: string; is_pinned: boolean; created_at: string; }
interface Notif       { id: string; type: string; title: string; body: string; is_read: boolean; created_at: string; }
interface CitizenPeer { id: string; full_name: string; purok: string; }

// ── THEME & CONSTANTS ─────────────────────────────────────────────────────────

const THEME = {
  bg: "#f4f7f5",
  surface: "#ffffff",
  primary: "#1c4532",
  primaryHover: "#2d5a45",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  accent: "#f0fdf4"
};

const SLIDE_IN_STYLE = `
  @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;

const SDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const VIOLATION_TYPES = [
  "Improper Disposal","Open Burning","Littering",
  "Illegal Dumping","Mixed Waste","Overflowing Bin",
  "Prohibited Area Dumping","Hazardous Waste Mishandling",
];
const STATUS_CFG: Record<string,{dot:string;badge:string}> = {
  Pending:        {dot:"#f59e0b", badge:`${THEME.accent} text-amber-800 border-amber-200`},
  "Under Review": {dot:"#3b82f6", badge:"bg-blue-50 text-blue-800 border-blue-200"},
  Resolved:       {dot:THEME.primary, badge:`${THEME.accent} text-[#1c4532] border-emerald-200`},
};
const BROADCAST_ICON: Record<string,string> = {
  AWARENESS:"🌿", SCHEDULE_CHANGE:"📅", NOTICE:"📋", WARNING:"⚠️", EVENT:"🎪",
};

const scoreHex   = (s:number) => s>=90?THEME.primary:s>=70?"#16a34a":s>=50?"#d97706":s>=30?"#ea580c":"#dc2626";
const scoreColor = (s:number) => s>=90?"text-[#1c4532]":s>=70?"text-green-600":s>=50?"text-amber-500":s>=30?"text-orange-500":"text-red-600";
const scoreBg    = (s:number) => s>=90?`${THEME.accent} border-emerald-200`:s>=70?"bg-green-50 border-green-200":s>=50?"bg-amber-50 border-amber-100":"bg-red-50 border-red-200";
const scoreTier  = (s:number) => s>=90?"Excellent":s>=70?"Good":s>=50?"Fair":s>=30?"Poor":"Critical";

const timeAgo = (iso:string) => {
  if (!iso) return "—";
  const d=Date.now()-new Date(iso).getTime(), m=Math.floor(d/60000);
  if (m<1) return "just now"; if (m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};
const fmtTime  = (t:string|null) => {
  if (!t) return "—";
  const [h,m]=t.split(":"), hr=parseInt(h);
  return `${hr>12?hr-12:hr||12}:${m} ${hr>=12?"PM":"AM"}`;
};
const fmtMonth = (iso:string) =>
  new Date(iso).toLocaleDateString("en-PH",{month:"short",year:"numeric"});

// ── SCORE RING ─────────────────────────────────────────────────────────────────

function ScoreRing({score,size=120}:{score:number;size?:number}) {
  const r=38,cx=50,cy=50,circ=2*Math.PI*r,dash=(score/100)*circ,col=scoreHex(score);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${col}20`} strokeWidth="7"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%",transition:"stroke-dasharray .6s ease"}}/>
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="900" fill={col} fontFamily="inherit">{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="9"  fontWeight="700" fill={THEME.textMuted} fontFamily="inherit">/ 100</text>
    </svg>
  );
}

// ── LOGOUT MODAL ───────────────────────────────────────────────────────────────

function LogoutModal({onConfirm,onCancel,loading}:{onConfirm:()=>void;onCancel:()=>void;loading:boolean}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(0,0,0,.3)",backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:32,padding:40,width:"100%",maxWidth:400,textAlign:"center",boxShadow:"0 20px 50px rgba(0,0,0,0.1)",animation:"slideInUp .3s ease-out"}}>
        <style>{SLIDE_IN_STYLE}</style>
        <div style={{width:64,height:64,borderRadius:22,background:"#fef2f2",color:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
          <LogOut size={32}/>
        </div>
        <h2 style={{fontSize:24,fontWeight:900,color:THEME.text,marginBottom:8,letterSpacing:"-.02em"}}>Sign Out?</h2>
        <p style={{fontSize:14,color:THEME.textMuted,marginBottom:32}}>You're about to end your citizen session. See you back soon!</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <button onClick={onConfirm} disabled={loading} style={{width:"100%",padding:"16px",borderRadius:16,background:THEME.primary,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:`0 10px 20px ${THEME.primary}25`}}>
            {loading?"Signing out…":"Yes, Sign Out"}
          </button>
          <button onClick={onCancel} disabled={loading} style={{width:"100%",padding:"16px",borderRadius:16,background:"#f3f4f6",color:THEME.text,border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            Stay Active
          </button>
        </div>
      </div>
    </div>
  );
}

// ── REPORT MODAL ───────────────────────────────────────────────────────────────
// Loads all citizens in the reporter's barangay so reporter can pick who to report.
// reported_id is sent to the DB — LGU can see it, but the citizen-facing view hides it.

function ReportModal({profile,onClose}:{profile:CitizenProfile;onClose:()=>void}) {
  const [type,        setType]        = useState(VIOLATION_TYPES[0]);
  const [desc,        setDesc]        = useState("");
  const [proofUrls,   setProofUrls]   = useState<string[]>([]);
  const [urlInput,    setUrlInput]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState("");

  // Peer selection
  const [peers,       setPeers]       = useState<CitizenPeer[]>([]);
  const [peersLoading,setPeersLoading]= useState(true);
  const [peerSearch,  setPeerSearch]  = useState("");
  const [reportedId,  setReportedId]  = useState<string>("");
  const [dropOpen,    setDropOpen]    = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load peers on mount
  useEffect(()=>{
    (async()=>{
      // Get all citizen IDs in the same barangay
      const {data:cds}=await supabase
        .from("citizen_details")
        .select("id,purok")
        .eq("barangay",profile.barangay);

      if (!cds||cds.length===0){setPeersLoading(false);return;}

      const ids=cds.map((c:any)=>c.id).filter((id:string)=>id!==profile.id); // exclude self
      if (ids.length===0){setPeersLoading(false);return;}

      const {data:profiles}=await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id",ids)
        .eq("role","CITIZEN")
        .eq("is_archived",false)
        .order("full_name");

      const purokMap=Object.fromEntries(cds.map((c:any)=>[c.id,c.purok]));
      setPeers((profiles??[]).map((p:any)=>({
        id:p.id, full_name:p.full_name??"Unknown", purok:purokMap[p.id]??"",
      })));
      setPeersLoading(false);
    })();
  },[profile.barangay,profile.id]);

  // Close dropdown on outside click
  useEffect(()=>{
    if (!dropOpen) return;
    const h=(e:MouseEvent)=>{if(dropRef.current&&!dropRef.current.contains(e.target as Node))setDropOpen(false);};
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[dropOpen]);

  const filteredPeers=peers.filter(p=>
    p.full_name.toLowerCase().includes(peerSearch.toLowerCase())||
    p.purok.toLowerCase().includes(peerSearch.toLowerCase())
  );
  const selectedPeer=peers.find(p=>p.id===reportedId);

  const addUrl=()=>{ if(urlInput.trim()){setProofUrls(p=>[...p,urlInput.trim()]);setUrlInput("");} };

  const submit=async()=>{
    if (!desc.trim()){setError("Please describe the incident.");return;}
    if (!reportedId){setError("Please select the citizen you are reporting.");return;}
    setSaving(true); setError("");
    const {error:err}=await supabase.from("citizen_reports").insert({
      reporter_id:profile.id,
      reported_id:reportedId,          // ← stored in DB, visible to LGU only
      barangay:profile.barangay,
      type, description:desc.trim(),
      proof_urls:proofUrls,
      status:"Submitted",
    });
    setSaving(false);
    if (err){setError(err.message);return;}
    setSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}/>
      <div className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div style={{ background: THEME.accent, borderBottom: `1px solid ${THEME.border}`, padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "#fee2e2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Flag size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: THEME.text, margin: 0, letterSpacing: "-.02em" }}>REPORT A VIOLATION</h3>
              <p style={{ fontSize: 11, fontWeight: 800, color: THEME.primary, textTransform: "uppercase", margin: 0, letterSpacing: ".05em" }}>Identity kept confidential</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} color={THEME.textMuted} />
          </button>
        </div>

        {success?(
          <div className="p-10 text-center">
            <div className={`w-20 h-20 ${THEME.accent} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <CheckCircle size={36} className={`text-[${THEME.primary}]`}/>
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase italic mb-3">Report Submitted!</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Your report has been submitted to your LGU officer for review. Your identity is kept confidential — the reported citizen will not know who filed this.
            </p>
            <button onClick={onClose} style={{ background: THEME.primary }} className="px-8 py-4 text-white rounded-[1.5rem] font-black text-xs uppercase shadow-lg shadow-emerald-100 hover:opacity-90 transition-all">
              Done
            </button>
          </div>
        ):(
          <div className="p-8 space-y-5">

            {/* Confidentiality notice */}
            <div className="flex gap-3 items-start p-4 bg-amber-50 rounded-[1.5rem] border border-amber-200">
              <Shield size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Your name will <strong>NOT</strong> be shown to the reported person. Only your LGU officer can see who filed this report and who is being reported.
              </p>
            </div>

            {/* ── WHO ARE YOU REPORTING? ── */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                Who are you reporting? *
              </label>

              {peersLoading?(
                <div className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400 italic">
                  Loading citizens…
                </div>
              ):(
                <div ref={dropRef} className="relative">
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={()=>setDropOpen(o=>!o)}
                    className={`w-full px-4 py-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      reportedId
                        ?"border-emerald-400 bg-emerald-50"
                        :"border-slate-200 bg-slate-50 hover:border-emerald-300"
                    }`}
                  >
                    {selectedPeer?(
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                          {selectedPeer.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{selectedPeer.full_name}</p>
                          {selectedPeer.purok&&<p className="text-[10px] text-slate-400 font-bold">{selectedPeer.purok}</p>}
                        </div>
                      </div>
                    ):(
                      <span className="text-sm text-slate-400 italic">Select a citizen from your barangay…</span>
                    )}
                    <span className={`text-slate-400 transition-transform ml-2 flex-shrink-0 ${dropOpen?"rotate-180":""}`}>▼</span>
                  </button>

                  {/* Dropdown */}
                  {dropOpen&&(
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white rounded-[1.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-150">
                      {/* Search */}
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                          <input
                            value={peerSearch}
                            onChange={e=>setPeerSearch(e.target.value)}
                            placeholder="Search by name or purok…"
                            autoFocus
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-emerald-400 focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      {/* List */}
                      <div className="max-h-52 overflow-y-auto">
                        {filteredPeers.length===0?(
                          <div className="py-6 text-center text-sm text-slate-400 italic">
                            {peerSearch?"No citizens match your search":"No other citizens in your barangay"}
                          </div>
                        ):filteredPeers.map(p=>(
                          <button
                            key={p.id}
                            type="button"
                            onClick={()=>{setReportedId(p.id);setDropOpen(false);setPeerSearch("");}}
                            className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-emerald-50 transition-colors ${reportedId===p.id?"bg-emerald-50":""}`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 ${reportedId===p.id?"bg-emerald-600":"bg-slate-400"}`}>
                              {p.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black truncate ${reportedId===p.id?"text-emerald-700":"text-slate-900"}`}>
                                {p.full_name}
                              </p>
                              {p.purok&&<p className="text-[10px] text-slate-400 font-bold">{p.purok}</p>}
                            </div>
                            {reportedId===p.id&&<CheckCircle size={14} className="text-emerald-600 flex-shrink-0"/>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Violation type */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Violation Type *</label>
              <select value={type} onChange={e=>setType(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold outline-none focus:border-emerald-400 focus:bg-white transition-all">
                {VIOLATION_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Description *</label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)}
                placeholder="Describe what happened, where, and when…" rows={4}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-emerald-400 focus:bg-white transition-all resize-none leading-relaxed"/>
            </div>

            {/* Proof links */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Proof Links (optional)</label>
              <div className="flex gap-2">
                <input value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addUrl()}
                  placeholder="Paste Google Drive / image link…"
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400 focus:bg-white transition-all"/>
                <button onClick={addUrl}
                  className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-xs uppercase hover:bg-emerald-100 transition-all whitespace-nowrap">
                  + Add
                </button>
              </div>
              {proofUrls.map((u,i)=>(
                <div key={i} className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <span className="text-xs text-emerald-700 flex-1 truncate">{u}</span>
                  <button onClick={()=>setProofUrls(p=>p.filter((_,j)=>j!==i))} className="text-slate-400 hover:text-red-500 transition-colors font-bold text-lg leading-none">×</button>
                </div>
              ))}
            </div>

            {error&&(
              <div className="flex gap-3 items-center p-4 bg-red-50 rounded-2xl border border-red-200">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0"/>
                <p className="text-xs text-red-700 font-semibold">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 text-slate-600 font-black text-xs uppercase hover:bg-slate-100 transition-all">
                Cancel
              </button>
              <button onClick={submit} disabled={saving||!desc.trim()||!reportedId}
                className="flex-1 py-4 rounded-[1.5rem] bg-red-600 text-white font-black text-xs uppercase shadow-lg shadow-red-100 disabled:opacity-40 hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                <Flag size={14}/>{saving?"Submitting…":"Submit Report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── NOTIFICATION PANEL ─────────────────────────────────────────────────────────

function NotifPanel({notifs,onRead,onClose}:{notifs:Notif[];onRead:(id:string)=>void;onClose:()=>void}) {
  const unread=notifs.filter(n=>!n.is_read).length;
  const iconFor=(type:string)=>{
    if (type==="WARNING_ISSUED")    return <AlertTriangle size={13} className="text-amber-500"/>;
    if (type==="VIOLATION_FILED")   return <AlertTriangle size={13} className="text-red-500"/>;
    if (type==="BROADCAST")         return <Megaphone size={13} className={`text-[${THEME.primary}]`}/>;
    if (type==="VIOLATION_RESOLVED")return <CheckCircle size={13} className={`text-[${THEME.primary}]`}/>;
    return <Info size={13} className="text-blue-500"/>;
  };
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 12px)", right: 0, width: 320,
      background: "#fff", borderRadius: 24, border: `1px solid ${THEME.border}`,
      boxShadow: "0 20px 50px rgba(0,0,0,0.1)", zIndex: 1100, overflow: "hidden",
      animation: "slideInUp .2s ease-out"
    }}>
      <style>{SLIDE_IN_STYLE}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: THEME.accent, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: THEME.text, textTransform: "uppercase" }}>Notifications</span>
          {unread > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: 10 }}>{unread}</span>}
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={12} color={THEME.textMuted} />
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
        {notifs.length===0?(
          <div className="py-10 text-center text-slate-400 text-sm font-medium italic">No notifications yet</div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)}
            className={`flex gap-3 items-start p-4 cursor-pointer transition-colors hover:bg-slate-50 ${!n.is_read?`${THEME.accent}70`:""}`}>
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              n.type==="WARNING_ISSUED"?"bg-amber-50":n.type==="VIOLATION_FILED"?"bg-red-50":THEME.accent}`}>
              {iconFor(n.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${n.is_read?"font-medium text-slate-700":"font-black text-slate-900"}`}>{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read&&<div className={`w-2 h-2 rounded-full bg-[${THEME.primary}] flex-shrink-0 mt-1.5`}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CITIZEN PROFILE PANEL ─────────────────────────────────────────────────────

function CitizenProfilePanel({profile,onClose}:{profile:CitizenProfile;onClose:()=>void}) {
  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)", zIndex: 3000 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 3001,
        width: "min(480px, 100vw)", background: "#fff",
        boxShadow: "-12px 0 50px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight .4s cubic-bezier(0.16, 1, 0.3, 1) both",
        fontFamily: "sans-serif",
        overflow: "hidden"
      }}>
        <CitizenProfileViewInner userId={profile.id} onClose={onClose} />
      </div>
    </>
  );
}


// ── MAIN PAGE ──────────────────────────────────────────────────────────────────

type Tab = "map" | "schedule" | "score" | "news";

export default function CitizenDashboard() {
  const router = useRouter();
  const [profile,       setProfile]      = useState<CitizenProfile|null>(null);
  const [scores,        setScores]       = useState<ScoreRecord[]>([]);
  const [violations,    setViolations]   = useState<Violation[]>([]);
  const [schedules,     setSchedules]    = useState<Schedule[]>([]);
  const [broadcasts,    setBroadcasts]   = useState<Broadcast[]>([]);
  const [notifs,        setNotifs]       = useState<Notif[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [activeTab,     setActiveTab]    = useState<Tab>("map");
  const [showReport,    setShowReport]   = useState(false);
  const [notifOpen,     setNotifOpen]    = useState(false);
  const [isSidebarOpen, setSidebarOpen]  = useState(false);
  const [showLogout,    setShowLogout]   = useState(false);
  const [isLoggingOut,  setIsLoggingOut] = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if (!notifOpen) return;
    const h=(e:MouseEvent)=>{if(notifRef.current&&!notifRef.current.contains(e.target as Node))setNotifOpen(false);};
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[notifOpen]);

  const fetchData=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if (!user){router.push("/login");return;}
    const {data:p}=await supabase.from("profiles").select("id,full_name,email,contact_number,warning_count,avatar_url").eq("id",user.id).single();
    const {data:cd}=await supabase.from("citizen_details").select("barangay,municipality,purok,address_street,service_type").eq("id",user.id).single();
    if (!p||!cd){router.push("/login");return;}
    setProfile({...p,...cd});
    const [{data:sc},{data:viol},{data:sched},{data:bc},{data:nd}]=await Promise.all([
      supabase.from("citizen_scores").select("*").eq("citizen_id",user.id).order("score_month",{ascending:false}).limit(12),
      supabase.from("violations").select("*").eq("citizen_id",user.id).order("created_at",{ascending:false}),
      supabase.from("collection_schedules").select("*").eq("barangay",cd.barangay).eq("is_active",true).order("day_of_week"),
      supabase.from("broadcasts").select("*").eq("barangay",cd.barangay).order("is_pinned",{ascending:false}).order("created_at",{ascending:false}).limit(20),
      supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
    ]);
    setScores(sc??[]);setViolations(viol??[]);setSchedules(sched??[]);setBroadcasts(bc??[]);setNotifs(nd??[]);
    setLoading(false);
  },[router]);

  useEffect(()=>{fetchData();},[fetchData]);

  useEffect(()=>{
    if (!profile?.id) return;
    const ch=supabase.channel("cit-notifs-dash")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${profile.id}`},
        (payload:any)=>{setNotifs(p=>[payload.new as Notif,...p].slice(0,30));})
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[profile?.id]);

  const markRead=async(id:string)=>{
    setNotifs(p=>p.map(n=>n.id===id?{...n,is_read:true}:n));
    await supabase.from("notifications").update({is_read:true}).eq("id",id);
  };
  const handleLogout=async()=>{
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const unreadC      = notifs.filter(n=>!n.is_read).length;
  const currentScore = scores[0]?.score??100;
  const activeViol   = violations.filter(v=>v.status!=="Resolved").length;

  const menuItems=[
    {id:"map",      label:"Bin Map",       icon:"🗺️"},
    {id:"schedule", label:"Schedule",      icon:"📅"},
    {id:"score",    label:"My Score",      icon:"⭐"},
    {id:"news",     label:"Barangay News", icon:"📢"},
  ] as const;

  const currentLabel=menuItems.find(m=>m.id===activeTab)?.label ?? "Dashboard";

  if (loading) return (
    <div style={{ height: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: `4px solid ${THEME.primary}20`, borderTopColor: THEME.primary, animation: "spin 1s linear infinite" }} />
        <style>{SLIDE_IN_STYLE}</style>
        <p style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".15em" }}>Syncing Profile…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: THEME.bg, fontFamily: "sans-serif", position: "relative", overflow: "hidden" }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 280, background: "#fff", borderRight: `1px solid ${THEME.border}`,
        display: "flex", flexDirection: "column", zIndex: 1010,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }} className={`${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:static inset-y-0 left-0 shadow-2xl lg:shadow-none`}>

        <div style={{ padding: "32px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, background: THEME.primary, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 20px ${THEME.primary}20` }}>
              <Trash2 size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: THEME.text, margin: 0, letterSpacing: "-.02em" }}>EcoRoute</h1>
              <p style={{ fontSize: 10, fontWeight: 800, color: THEME.primary, textTransform: "uppercase", margin: 0, letterSpacing: ".05em" }}>{profile?.barangay}</p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ padding: "0 16px", fontSize: 10, fontWeight: 800, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".15em", marginBottom: 12 }}>Citizen Portal</p>
          {menuItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 16, border: "none",
                  background: isActive ? THEME.accent : "transparent",
                  color: isActive ? THEME.primary : THEME.textMuted,
                  cursor: "pointer", transition: "all 0.2s"
                }}
                className="hover:bg-slate-50 group"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 20, filter: isActive ? "none" : "grayscale(100%) opacity(0.5)" }}>{item.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: isActive ? 800 : 600, letterSpacing: "-.01em" }}>{item.label}</span>
                </div>
                <ChevronRight size={14} style={{ opacity: isActive ? 0.8 : 0.3, transform: isActive ? "translateX(0)" : "translateX(-4px)", transition: "all 0.2s" }} className="group-hover:translate-x-0" />
              </button>
            );
          })}

          <button onClick={() => { setShowReport(true); setSidebarOpen(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 12 }}
            className="hover:bg-red-50 group"
          >
            <Flag size={20} />
            <span>Report Violation</span>
          </button>
        </nav>

        {/* Sidebar Footer (Score & Logout) */}
        <div style={{ padding: "24px", marginTop: "auto" }}>
          <div style={{ background: THEME.accent, borderRadius: 28, padding: "20px 24px", border: `1px solid ${THEME.primary}10`, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".15em", marginBottom: 8 }}>Eco Score</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 32, fontWeight: 900, color: THEME.primary, margin: 0, letterSpacing: "-.04em" }}>{currentScore}</p>
              <span style={{ fontSize: 10, fontWeight: 900, color: THEME.primary, background: "#fff", padding: "6px 12px", borderRadius: 12, border: `1px solid ${THEME.primary}20`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>{scoreTier(currentScore)}</span>
            </div>
          </div>
          <button onClick={() => setShowLogout(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 15, fontWeight: 700 }} className="hover:bg-red-50">
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Sidebar overlay */}
      {isSidebarOpen&&<div className="fixed inset-0 bg-black/30 z-[1000] lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

      {/* ── MAIN ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", position: "relative", overflow: "hidden" }}>

        {/* Header */}
        <header style={{ height: 80, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0, zIndex: 1001 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Menu size={20} />
            </button>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: THEME.primary, textTransform: "uppercase", letterSpacing: ".2em", marginBottom: 2 }}>
                {profile?.barangay}, {profile?.municipality}
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: THEME.text, margin: 0, textTransform: "uppercase", letterSpacing: "-.02em" }}>{currentLabel}</h2>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Notification bell */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button onClick={() => setNotifOpen(!notifOpen)}
                style={{
                  width: 44, height: 44, borderRadius: 14, border: `1px solid ${THEME.border}`,
                  background: notifOpen ? THEME.accent : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <Bell size={20} color={notifOpen ? THEME.primary : THEME.text} />
                {unreadC > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: "#ef4444", border: "2px solid #fff", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{unreadC > 9 ? "9+" : unreadC}</span>}
              </button>
              {notifOpen && <NotifPanel notifs={notifs} onRead={markRead} onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Profile badge */}
            <button
              onClick={() => setShowProfile(true)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "6px 6px 6px 16px",
                borderRadius: 20, background: showProfile ? THEME.text : "#fff",
                border: `1px solid ${showProfile ? THEME.text : THEME.border}`,
                cursor: "pointer", transition: "all 0.2s"
              }}
            >
              <div style={{ textAlign: "right" }} className="hidden md:block">
                <p style={{ fontSize: 13, fontWeight: 800, color: showProfile ? "#fff" : THEME.text, lineHeight: 1 }}>{profile?.full_name ?? "Citizen"}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: showProfile ? THEME.primary : THEME.primary, marginTop: 4, textTransform: "uppercase", letterSpacing: ".02em" }}>{profile?.purok}</p>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: profile?.avatar_url ? "#f1f5f9" : THEME.primary, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px solid ${THEME.border}` }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{profile?.full_name.charAt(0)}</span>}
              </div>
            </button>
          </div>
        </header>

        {/* ── VIEWS ── */}
        <div className={`flex-1 relative w-full ${activeTab==="map"?"overflow-hidden":"overflow-y-auto"}`}>

          {/* BIN MAP */}
          {activeTab==="map"&&(
            <div className="absolute inset-0 animate-in fade-in duration-700">
              <CitizenBinMap barangay={profile?.barangay??""}/>
            </div>
          )}

          {/* SCHEDULE */}
          {activeTab==="schedule"&&(
            <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Collection Schedule</h2>
                <p className={`text-sm ${scoreColor(100)} font-black uppercase tracking-widest mt-1`}>
                  Barangay {profile?.barangay} · {schedules.length} active route{schedules.length!==1?"s":""}
                </p>
              </div>

              {/* Week strip */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {SDAYS.map((d,i)=>{
                  const has=schedules.some(s=>s.day_of_week===i);
                  const isToday=i===new Date().getDay();
                  return (
                    <div key={i} className={`flex-shrink-0 w-14 rounded-[1.5rem] py-3 text-center border transition-all ${isToday?`bg-[${THEME.primary}] border-[${THEME.primary}] shadow-lg shadow-slate-200`:has?`${THEME.accent} border-slate-200`:"bg-white border-slate-100"}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isToday?"text-white":has?`text-[${THEME.primary}]`:"text-slate-300"}`}>{d}</p>
                      <div className={`w-2 h-2 rounded-full mx-auto ${isToday?"bg-white":has?`bg-[${THEME.primary}]`:"bg-slate-200"}`}/>
                    </div>
                  );
                })}
              </div>

              {schedules.length===0?(
                <div className="bg-white rounded-[3rem] border border-slate-100 p-12 text-center shadow-sm">
                  <Calendar size={40} className="text-slate-200 mx-auto mb-4"/>
                  <p className="text-slate-400 font-bold italic">No collection schedules set for your barangay yet.</p>
                </div>
              ):schedules.map(s=>{
                const isToday=s.day_of_week===new Date().getDay();
                const isTomorrow=s.day_of_week===(new Date().getDay()+1)%7;
                return (
                  <div key={s.id} className={`bg-white rounded-[2.5rem] border p-6 flex gap-5 items-start shadow-sm ${isToday?`border-[${THEME.primary}]30 shadow-slate-200 shadow-md`:"border-slate-100"}`}>
                    <div className={`w-14 h-14 rounded-[1.5rem] flex flex-col items-center justify-center flex-shrink-0 ${isToday?`bg-[${THEME.primary}] shadow-lg shadow-slate-200`:THEME.accent}`}>
                      <span className={`text-xs font-black uppercase ${isToday?"text-white":`text-[${THEME.primary}]`}`}>{s.day_of_week!==null?SDAYS[s.day_of_week]:"—"}</span>
                      <span className={`text-[9px] font-bold mt-0.5 ${isToday?"text-white/80":`text-[${THEME.primary}]`}`}>{fmtTime(s.scheduled_time)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="font-black text-slate-900 italic uppercase tracking-tight">{s.label}</span>
                        {isToday&&<span className={`text-[10px] font-black px-3 py-1 rounded-full ${THEME.accent} text-[${THEME.primary}] uppercase tracking-widest`}>Today</span>}
                        {isTomorrow&&!isToday&&<span className="text-[10px] font-black px-3 py-1 rounded-full bg-amber-50 text-amber-700 uppercase tracking-widest border border-amber-200">Tomorrow</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {s.waste_types.map(t=>(
                          <span key={t} className={`text-[10px] font-black px-3 py-1 rounded-full ${THEME.accent} text-[${THEME.primary}] border border-slate-100 uppercase tracking-widest`}>{t}</span>
                        ))}
                      </div>
                      {s.notes&&<p className="text-xs text-slate-500 leading-relaxed">{s.notes}</p>}
                    </div>
                    {isToday&&<div className={`w-2.5 h-2.5 rounded-full bg-[${THEME.primary}] flex-shrink-0 mt-1 animate-pulse`}/>}
                  </div>
                );
              })}

              <div style={{ background: THEME.primary, borderRadius: 32, padding: 24, display: "flex", gap: 16, alignItems: "start" }}>
                <div style={{ width: 40, height: 40, borderRadius: 16, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={18} color="#fff" />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>RA 9003 Reminder</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>Properly segregate your waste before collection day. Separate Biodegradable, Recyclable, and Residual waste. Violations may result in warnings on your account.</p>
                </div>
              </div>
            </div>
          )}

          {/* SCORE */}
          {activeTab==="score"&&(
            <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">My Eco Score</h2>
                <p className={`text-sm ${scoreColor(100)} font-black uppercase tracking-widest mt-1`}>Your RA 9003 compliance record</p>
              </div>

              <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm flex flex-col sm:flex-row gap-6 items-center">
                <div className="flex-shrink-0"><ScoreRing score={currentScore} size={130}/></div>
                <div className="flex-1 min-w-0 w-full">
                  <div className={`text-4xl font-black italic tracking-tight mb-1 ${scoreColor(currentScore)}`}>{scoreTier(currentScore)}</div>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-5">As of {scores[0]?fmtMonth(scores[0].score_month):"this month"}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {label:"Warnings",  val:profile?.warning_count??0,      color:"text-red-600",    bg:"bg-red-50 border-red-100",    pts:"-10"},
                      {label:"Violations",val:scores[0]?.violations_count??0, color:"text-amber-600",  bg:"bg-amber-50 border-amber-100",pts:"-15"},
                      {label:"Resolved",  val:scores[0]?.resolved_count??0,   color:`text-[${THEME.primary}]`,bg:`${THEME.accent} border-slate-100`,pts:"+5"},
                    ].map(f=>(
                      <div key={f.label} className={`rounded-[1.5rem] p-4 border ${f.bg}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${f.color} opacity-70`}>{f.pts} pts each</p>
                        <p className={`text-3xl font-black italic ${f.color}`}>{f.val}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{f.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {scores.length>1&&(
                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Score History</p>
                  <div className="flex gap-3 items-end h-20">
                    {scores.slice(0,6).reverse().map((s,i)=>{
                      const h=Math.max(12,(s.score/100)*80);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-black" style={{color:scoreHex(s.score)}}>{s.score}</span>
                          <div className="w-full rounded-xl" style={{height:h,background:scoreHex(s.score),opacity:i===scores.slice(0,6).length-1?1:0.5,transition:"height .4s"}}/>
                          <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">{fmtMonth(s.score_month).split(" ")[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <AlertTriangle size={15} className={`text-[${THEME.primary}]`}/>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Violation History ({violations.length})</span>
                  {activeViol>0&&<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{activeViol} open</span>}
                </div>
                {violations.length===0?(
                  <div className="py-8 text-center">
                    <CheckCircle size={28} style={{ color: THEME.primary, opacity: 0.4 }} className="mx-auto mb-3"/>
                    <p className="text-slate-400 font-black italic text-sm uppercase">No violations — keep it up! 🌿</p>
                  </div>
                ):violations.map(v=>{
                  const sc=STATUS_CFG[v.status]??STATUS_CFG.Pending;
                  return (
                    <div key={v.id} className="flex items-center gap-4 p-4 rounded-[1.5rem] border border-slate-100 mb-3 bg-slate-50/50">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-black text-slate-900 italic uppercase">{v.type}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${sc.badge} uppercase tracking-widest`}>{v.status}</span>
                        </div>
                        <p className="text-xs text-slate-500">{v.description??"No description"}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">{timeAgo(v.created_at)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-amber-50 rounded-[2rem] border border-amber-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={15} className="text-amber-600"/>
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">How Scoring Works</span>
                </div>
                <ul className="text-xs text-amber-800 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Start of each month: <strong>100 points</strong></li>
                  <li>Each active warning: <strong>−10 points</strong></li>
                  <li>Each unresolved violation: <strong>−15 points</strong></li>
                  <li>Each resolved violation: <strong>+5 points</strong></li>
                  <li>Minimum score: <strong>0 points</strong></li>
                </ul>
              </div>
            </div>
          )}

          {/* NEWS */}
          {activeTab==="news"&&(
            <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Barangay News</h2>
                <p className={`text-sm ${scoreColor(100)} font-black uppercase tracking-widest mt-1`}>Updates from Barangay {profile?.barangay}</p>
              </div>
              {broadcasts.length===0?(
                <div className="bg-white rounded-[3rem] border border-slate-100 p-12 text-center shadow-sm">
                  <Megaphone size={40} className="text-slate-200 mx-auto mb-4"/>
                  <p className="text-slate-400 font-black italic uppercase">No announcements yet.</p>
                </div>
              ):broadcasts.map(b=>{
                const icon=BROADCAST_ICON[b.type]??"📢";
                return (
                  <div key={b.id} className={`bg-white rounded-[2.5rem] border p-6 flex gap-5 items-start shadow-sm ${b.is_pinned?`border-emerald-200 shadow-emerald-50 shadow-md`:"border-slate-100"}`}>
                    <div className={`w-14 h-14 rounded-[1.5rem] ${THEME.accent} border border-emerald-100 flex items-center justify-center text-2xl flex-shrink-0`}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-black text-slate-900 italic uppercase tracking-tight">{b.title}</span>
                        {b.is_pinned&&<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">📌 Pinned</span>}
                        <span className="text-[10px] text-slate-400 font-bold ml-auto">{timeAgo(b.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{b.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Profile is now in CitizenProfilePanel slide-over — opened via profile badge */}
        </div>
      </main>

      {/* Citizen Profile Panel — slide-over from right, top:80px */}
      {showProfile&&profile&&(
        <CitizenProfilePanel
          profile={profile}
          onClose={()=>setShowProfile(false)}
        />
      )}

      {/* Modals */}
      {showReport&&profile&&<ReportModal profile={profile} onClose={()=>setShowReport(false)}/>}
      {showLogout&&<LogoutModal onConfirm={handleLogout} onCancel={()=>setShowLogout(false)} loading={isLoggingOut}/>}
    </div>
  );
}