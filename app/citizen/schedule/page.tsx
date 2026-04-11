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
  Shield, FileText, Search,
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

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const SDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const VIOLATION_TYPES = [
  "Improper Disposal","Open Burning","Littering",
  "Illegal Dumping","Mixed Waste","Overflowing Bin",
  "Prohibited Area Dumping","Hazardous Waste Mishandling",
];
const STATUS_CFG: Record<string,{dot:string;badge:string}> = {
  Pending:        {dot:"bg-amber-400",   badge:"bg-amber-50 text-amber-800 border-amber-200"},
  "Under Review": {dot:"bg-blue-400",    badge:"bg-blue-50 text-blue-800 border-blue-200"},
  Resolved:       {dot:"bg-emerald-500", badge:"bg-emerald-50 text-emerald-800 border-emerald-200"},
};
const BROADCAST_ICON: Record<string,string> = {
  AWARENESS:"🌿", SCHEDULE_CHANGE:"📅", NOTICE:"📋", WARNING:"⚠️", EVENT:"🎪",
};

const scoreHex   = (s:number) => s>=90?"#059669":s>=70?"#16a34a":s>=50?"#d97706":s>=30?"#ea580c":"#dc2626";
const scoreColor = (s:number) => s>=90?"text-emerald-600":s>=70?"text-green-600":s>=50?"text-amber-500":s>=30?"text-orange-500":"text-red-600";
const scoreBg    = (s:number) => s>=90?"bg-emerald-50 border-emerald-200":s>=70?"bg-green-50 border-green-200":s>=50?"bg-amber-50 border-amber-200":"bg-red-50 border-red-200";
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
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="900" fill={col} fontFamily="Georgia,serif">{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="9"  fontWeight="700" fill="#9ca3af" fontFamily="sans-serif">/ 100</text>
    </svg>
  );
}

// ── LOGOUT MODAL ───────────────────────────────────────────────────────────────

function LogoutModal({onConfirm,onCancel,loading}:{onConfirm:()=>void;onCancel:()=>void;loading:boolean}) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={()=>!loading&&onCancel()}/>
      <div className="relative w-full max-w-sm bg-white rounded-[3.5rem] p-10 shadow-2xl text-center animate-in zoom-in-95 duration-200">
        <span className="text-5xl block mb-6">♻️</span>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase italic">End Session?</h2>
        <p className="text-sm text-slate-500 mb-8 font-medium italic">Your contribution today helped make our barangay a little cleaner.</p>
        <div className="space-y-3">
          <button onClick={onConfirm} disabled={loading}
            className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all disabled:opacity-60">
            {loading?"Signing out…":"Confirm & Logout"}
          </button>
          <button onClick={onCancel}
            className="w-full py-5 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase active:scale-95 transition-all">
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
        <div className="bg-emerald-50 border-b border-emerald-100 px-8 py-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-[1.2rem] flex items-center justify-center">
              <Flag size={20} className="text-red-600"/>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Report a Violation</h3>
              <p className="text-xs text-emerald-600 font-black uppercase tracking-widest">Identity kept confidential</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all">
            <X size={16} className="text-slate-500"/>
          </button>
        </div>

        {success?(
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={36} className="text-emerald-600"/>
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase italic mb-3">Report Submitted!</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Your report has been submitted to your LGU officer for review. Your identity is kept confidential — the reported citizen will not know who filed this.
            </p>
            <button onClick={onClose} className="px-8 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
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
    if (type==="BROADCAST")         return <Megaphone size={13} className="text-emerald-600"/>;
    if (type==="VIOLATION_RESOLVED")return <CheckCircle size={13} className="text-emerald-600"/>;
    return <Info size={13} className="text-blue-500"/>;
  };
  return (
    <div className="absolute top-[calc(100%+12px)] right-0 w-80 bg-white rounded-[2rem] border border-slate-100 shadow-2xl z-[400] overflow-hidden animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-900 text-sm uppercase italic">Notifications</span>
          {unread>0&&<span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">{unread}</span>}
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-xl bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-all">
          <X size={12} className="text-slate-500"/>
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
        {notifs.length===0?(
          <div className="py-10 text-center text-slate-400 text-sm font-medium italic">No notifications yet</div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)}
            className={`flex gap-3 items-start p-4 cursor-pointer transition-colors hover:bg-slate-50 ${!n.is_read?"bg-emerald-50/50":""}`}>
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              n.type==="WARNING_ISSUED"?"bg-amber-50":n.type==="VIOLATION_FILED"?"bg-red-50":"bg-emerald-50"}`}>
              {iconFor(n.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${n.is_read?"font-medium text-slate-700":"font-black text-slate-900"}`}>{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read&&<div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5"/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CITIZEN PROFILE PANEL ─────────────────────────────────────────────────────
// Slides in from right, top:80px (below h-20 topnav).
// Wraps CitizenProfileView in a panel shell — no redundant stats shown.
// Citizen-focused: eco score, barangay, purok, avatar upload, account edit.

function CitizenProfilePanel({profile,onClose}:{profile:CitizenProfile;onClose:()=>void}) {
  const SLIDE = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`;
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 z-[700] bg-black/25 backdrop-blur-sm"/>

      {/* Panel — top:80px clears the h-20 header */}
      <div style={{
        position:"fixed",top:80,right:0,bottom:0,zIndex:800,
        width:"min(480px,100vw)",background:"#fff",
        boxShadow:"-8px 0 48px rgba(0,0,0,.15)",
        display:"flex",flexDirection:"column",
        animation:"slideInRight .25s cubic-bezier(.4,0,.2,1) both",
        fontFamily:"sans-serif",
      }}>
        <style>{SLIDE}</style>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-5 bg-emerald-50 border-b border-emerald-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.avatar_url
                ?<img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover"/>
                :<span className="font-black text-white italic text-base">{profile.full_name.charAt(0)}</span>
              }
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 uppercase italic">{profile.full_name}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{profile.barangay} · {profile.purok}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-2xl bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all">
            <X size={15} className="text-slate-500"/>
          </button>
        </div>

        {/* CitizenProfileView handles its own data fetch + all editing */}
        <div className="flex-1 overflow-y-auto">
          <CitizenProfileViewInner/>
        </div>
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
    <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Syncing Profile…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen?"translate-x-0 shadow-2xl":"-translate-x-full"}`}>

        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-emerald-100">
              <Trash2 size={20} className="text-white"/>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight italic">EcoRoute</h1>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{profile?.barangay}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic opacity-70">Citizen Portal</p>
          {menuItems.map(item=>(
            <button key={item.id}
              onClick={()=>{setActiveTab(item.id);setSidebarOpen(false);}}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-300 ${
                activeTab===item.id
                  ?"bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-bold"
                  :"text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
            </button>
          ))}

          {/* Report button */}
          <button onClick={()=>{setShowReport(true);setSidebarOpen(false);}}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-300 text-red-400 hover:bg-red-50 hover:text-red-600 mt-2">
            <Flag size={20}/>
            <span className="text-sm font-black uppercase tracking-tight">Report Violation</span>
          </button>
        </nav>

        {/* Score pill in sidebar */}
        <div className="px-6 mb-3">
          <div className={`flex items-center justify-between px-5 py-3 rounded-[2rem] border ${scoreBg(currentScore)}`}>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eco Score</p>
              <p className={`text-2xl font-black italic ${scoreColor(currentScore)}`}>{currentScore}</p>
            </div>
            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${scoreBg(currentScore)} ${scoreColor(currentScore)}`}>
              {scoreTier(currentScore)}
            </span>
          </div>
        </div>

        <div className="p-6 shrink-0">
          <button onClick={()=>setShowLogout(true)}
            className="w-full py-4 rounded-[2rem] bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all font-black text-xs uppercase tracking-widest border border-slate-100">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sidebar overlay */}
      {isSidebarOpen&&<div className="fixed inset-0 bg-black/30 z-[2000] lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">

        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button onClick={()=>setSidebarOpen(true)} className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100">
              <Menu size={18}/>
            </button>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-0.5">
                {profile?.barangay}, {profile?.municipality}
              </p>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight uppercase italic">{currentLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div ref={notifRef} className="relative">
              <button onClick={()=>setNotifOpen(o=>!o)}
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all relative ${notifOpen?"bg-emerald-50 border-emerald-200":"bg-white border-slate-100 hover:border-emerald-200"}`}>
                <Bell size={17} className={notifOpen?"text-emerald-600":"text-slate-500"}/>
                {unreadC>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white">{unreadC>9?"9+":unreadC}</span>}
              </button>
              {notifOpen&&<NotifPanel notifs={notifs} onRead={markRead} onClose={()=>setNotifOpen(false)}/>}
            </div>

            {/* ── PROFILE BADGE — clicking opens CitizenProfileView ── */}
            <button
              onClick={()=>setShowProfile(true)}
              className={`flex items-center gap-3 p-1.5 pr-1 md:pr-5 rounded-[1.8rem] border transition-all duration-300 ${
                showProfile
                  ?"bg-slate-950 border-slate-900 shadow-xl"
                  :"bg-white border-slate-100 hover:border-emerald-200 hover:bg-slate-50 shadow-sm"}`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 md:w-11 md:h-11 rounded-2xl flex items-center justify-center overflow-hidden border transition-all duration-300 ${showProfile?"border-emerald-500/50 scale-105":"border-slate-200"}`}>
                {profile?.avatar_url?(
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover"/>
                ):(
                  <div className="w-full h-full bg-emerald-600 flex items-center justify-center">
                    <span className="font-black text-white italic text-base">{(profile?.full_name??"C").charAt(0)}</span>
                  </div>
                )}
              </div>
              {/* Name + status */}
              <div className="text-left hidden md:block">
                <p className={`text-[11px] font-black uppercase tracking-tight transition-colors duration-300 ${showProfile?"text-white":"text-slate-900"}`}>
                  {profile?.full_name??"Valued Citizen"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  <p className={`text-[8px] font-bold uppercase tracking-[0.15em] ${showProfile?"text-emerald-400/80":"text-slate-400"}`}>
                    {profile?.purok} • Authorized
                  </p>
                </div>
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
                <p className="text-sm text-emerald-600 font-black uppercase tracking-widest mt-1">
                  Barangay {profile?.barangay} · {schedules.length} active route{schedules.length!==1?"s":""}
                </p>
              </div>

              {/* Week strip */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {SDAYS.map((d,i)=>{
                  const has=schedules.some(s=>s.day_of_week===i);
                  const isToday=i===new Date().getDay();
                  return (
                    <div key={i} className={`flex-shrink-0 w-14 rounded-[1.5rem] py-3 text-center border transition-all ${isToday?"bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-100":has?"bg-emerald-50 border-emerald-200":"bg-white border-slate-100"}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isToday?"text-emerald-100":has?"text-emerald-600":"text-slate-300"}`}>{d}</p>
                      <div className={`w-2 h-2 rounded-full mx-auto ${isToday?"bg-white":has?"bg-emerald-400":"bg-slate-200"}`}/>
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
                  <div key={s.id} className={`bg-white rounded-[2.5rem] border p-6 flex gap-5 items-start shadow-sm ${isToday?"border-emerald-300 shadow-emerald-100 shadow-md":"border-slate-100"}`}>
                    <div className={`w-14 h-14 rounded-[1.5rem] flex flex-col items-center justify-center flex-shrink-0 ${isToday?"bg-emerald-600 shadow-lg shadow-emerald-100":"bg-emerald-50"}`}>
                      <span className={`text-xs font-black uppercase ${isToday?"text-white":"text-emerald-700"}`}>{s.day_of_week!==null?SDAYS[s.day_of_week]:"—"}</span>
                      <span className={`text-[9px] font-bold mt-0.5 ${isToday?"text-emerald-100":"text-emerald-500"}`}>{fmtTime(s.scheduled_time)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="font-black text-slate-900 italic uppercase tracking-tight">{s.label}</span>
                        {isToday&&<span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">Today</span>}
                        {isTomorrow&&!isToday&&<span className="text-[10px] font-black px-3 py-1 rounded-full bg-amber-50 text-amber-700 uppercase tracking-widest border border-amber-200">Tomorrow</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {s.waste_types.map(t=>(
                          <span key={t} className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-widest">{t}</span>
                        ))}
                      </div>
                      {s.notes&&<p className="text-xs text-slate-500 leading-relaxed">{s.notes}</p>}
                    </div>
                    {isToday&&<div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1 animate-pulse"/>}
                  </div>
                );
              })}

              <div className="bg-emerald-900 rounded-[2rem] p-6 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-[1rem] bg-emerald-800 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-emerald-300"/>
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-300 uppercase tracking-widest mb-2">RA 9003 Reminder</p>
                  <p className="text-xs text-emerald-100/70 leading-relaxed">Properly segregate your waste before collection day. Separate Biodegradable, Recyclable, and Residual waste. Violations may result in warnings on your account.</p>
                </div>
              </div>
            </div>
          )}

          {/* SCORE */}
          {activeTab==="score"&&(
            <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">My Eco Score</h2>
                <p className="text-sm text-emerald-600 font-black uppercase tracking-widest mt-1">Your RA 9003 compliance record</p>
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
                      {label:"Resolved",  val:scores[0]?.resolved_count??0,   color:"text-emerald-600",bg:"bg-emerald-50 border-emerald-100",pts:"+5"},
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
                  <AlertTriangle size={15} className="text-emerald-600"/>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Violation History ({violations.length})</span>
                  {activeViol>0&&<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{activeViol} open</span>}
                </div>
                {violations.length===0?(
                  <div className="py-8 text-center">
                    <CheckCircle size={28} className="text-emerald-300 mx-auto mb-3"/>
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
                <p className="text-sm text-emerald-600 font-black uppercase tracking-widest mt-1">Updates from Barangay {profile?.barangay}</p>
              </div>
              {broadcasts.length===0?(
                <div className="bg-white rounded-[3rem] border border-slate-100 p-12 text-center shadow-sm">
                  <Megaphone size={40} className="text-slate-200 mx-auto mb-4"/>
                  <p className="text-slate-400 font-black italic uppercase">No announcements yet.</p>
                </div>
              ):broadcasts.map(b=>{
                const icon=BROADCAST_ICON[b.type]??"📢";
                return (
                  <div key={b.id} className={`bg-white rounded-[2.5rem] border p-6 flex gap-5 items-start shadow-sm ${b.is_pinned?"border-emerald-200 shadow-emerald-50 shadow-md":"border-slate-100"}`}>
                    <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl flex-shrink-0">{icon}</div>
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