"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/lgu/dashboard/page.tsx  — Production version
// Uses: notifications, broadcasts, collection_schedules, citizen_reports,
//       citizen_scores, audit_logs (all from add_production_features.sql)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Users, AlertTriangle, CheckCircle, Trash2, Search, LogOut,
  Bell, FileText, MapPin, RefreshCw, ShieldAlert, Menu, X,
  Eye, Archive, ArchiveRestore, Send, Megaphone, Lightbulb,
  UserCheck, Info, Calendar, Star, Flag, ChevronRight,
  ClipboardList, TrendingUp,
} from "lucide-react";

const supabase = createClient();

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface LGUProfile {
  id: string; full_name: string; email: string;
  barangay: string; municipality: string; position_title: string;
}
interface Citizen {
  id: string; full_name: string; email: string;
  contact_number: string; warning_count: number;
  is_archived: boolean; purok: string; address_street: string;
  created_at: string; house_lot_number?: string; service_type?: string;
  violations?: Violation[]; score?: number;
}
interface Violation {
  id: string; citizen_id: string; citizen_name?: string;
  type: string; description: string;
  status: "Pending" | "Under Review" | "Resolved";
  created_at: string; resolved_at: string | null;
}
interface DBNotif {
  id: string; type: string; title: string; body: string;
  is_read: boolean; created_at: string; metadata?: any;
}
interface Broadcast {
  id: string; title: string; body: string; type: string;
  is_pinned: boolean; created_at: string; expires_at: string | null;
  created_by: string;
}
interface Schedule {
  id: string; label: string; barangay: string;
  day_of_week: number | null; scheduled_time: string | null;
  waste_types: string[]; is_active: boolean; notes: string | null;
  next_run_at: string | null;
}
interface CitizenReport {
  id: string; reporter_id: string; reported_id: string | null;
  type: string; description: string | null; proof_urls: string[];
  status: string; lgu_notes: string | null;
  created_at: string; reviewed_at: string | null;
  reporter_name?: string; reported_name?: string;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const EM = {
  900:"#064e3b",800:"#065f46",700:"#047857",600:"#059669",
  500:"#10b981",400:"#34d399",300:"#6ee7b7",200:"#a7f3d0",
  100:"#d1fae5",50:"#ecfdf5",
};

const VIOLATION_TYPES = [
  "Improper Disposal","Open Burning","Littering",
  "Illegal Dumping","Mixed Waste","Overflowing Bin",
  "Prohibited Area Dumping","Hazardous Waste Mishandling",
];

const BROADCAST_TYPES = [
  {id:"AWARENESS",icon:"🌿",label:"Awareness"},
  {id:"SCHEDULE_CHANGE",icon:"📅",label:"Schedule Change"},
  {id:"NOTICE",icon:"📋",label:"Notice"},
  {id:"WARNING",icon:"⚠️",label:"Warning"},
  {id:"EVENT",icon:"🎪",label:"Event"},
];

const BROADCAST_TEMPLATES = [
  {id:"b1",type:"AWARENESS",icon:"🌿",title:"Segregation Reminder",body:"Please separate biodegradable and non-biodegradable waste before collection day."},
  {id:"b2",type:"SCHEDULE_CHANGE",icon:"📅",title:"Collection Schedule Change",body:"Due to the upcoming holiday, collection in your area is moved to Wednesday."},
  {id:"b3",type:"WARNING",icon:"⚠️",title:"Littering Warning",body:"Multiple littering incidents reported. Violators may be fined under RA 9003."},
  {id:"b4",type:"EVENT",icon:"♻️",title:"Composting Workshop",body:"Join us this Saturday 9AM at the Barangay Hall for a free composting seminar."},
];

const STATUS_CFG: Record<string, {dot:string;text:string;bg:string;label:string}> = {
  Pending:       {dot:"#f59e0b",text:"#92400e",bg:"#fef3c7",label:"Pending"},
  "Under Review":{dot:"#3b82f6",text:"#1e40af",bg:"#eff6ff",label:"Under Review"},
  Resolved:      {dot:EM[600],  text:EM[800],  bg:EM[50],   label:"Resolved"},
  Submitted:     {dot:"#8b5cf6",text:"#5b21b6",bg:"#f5f3ff",label:"Submitted"},
  Escalated:     {dot:"#ef4444",text:"#991b1b",bg:"#fef2f2",label:"Escalated"},
  Dismissed:     {dot:"#6b7280",text:"#374151",bg:"#f1f5f9",label:"Dismissed"},
};

const REPORT_STATUSES = ["Submitted","Under Review","Escalated","Dismissed","Resolved"];

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const timeAgo = (iso:string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if (m<1) return "just now";
  if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};
const fmtDate = (iso:string) => iso ? new Date(iso).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}) : "—";
const fmtTime = (t:string|null) => {
  if (!t) return "—";
  const [h,m] = t.split(":");
  const hr = parseInt(h);
  return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

const INP: React.CSSProperties = {
  padding:"9px 12px", borderRadius:9, border:`1.5px solid ${EM[200]}`,
  background:EM[50], color:EM[900], fontSize:13, outline:"none",
  fontFamily:"sans-serif", width:"100%", boxSizing:"border-box",
};

// ── HELPERS: score color ──────────────────────────────────────────────────────

const scoreColor = (s:number) =>
  s>=90 ? EM[600] : s>=70 ? "#059669" : s>=50 ? "#d97706" : s>=30 ? "#ea580c" : "#dc2626";

// ── MODAL WRAPPER ─────────────────────────────────────────────────────────────

function Modal({onClose,children,wide=false}:{onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(6,78,59,.18)",backdropFilter:"blur(4px)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,border:`1.5px solid ${EM[200]}`,width:"100%",maxWidth:wide?800:480,boxShadow:`0 24px 80px rgba(6,78,59,.18)`,animation:"modalIn .2s ease both",maxHeight:"90vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}
function MHead({title,sub,icon:Icon,onClose}:{title:string;sub?:string;icon?:any;onClose:()=>void}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"17px 22px",borderBottom:`1px solid ${EM[100]}`,background:EM[50],borderRadius:"18px 18px 0 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {Icon && <div style={{width:38,height:38,borderRadius:11,background:EM[100],display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={18} color={EM[700]}/></div>}
        <div>
          <div style={{fontSize:15,fontWeight:800,color:EM[900],fontFamily:"Georgia,serif"}}>{title}</div>
          {sub && <div style={{fontSize:12,color:EM[600],marginTop:1}}>{sub}</div>}
        </div>
      </div>
      <button onClick={onClose} style={{width:32,height:32,borderRadius:9,border:`1px solid ${EM[200]}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14} color={EM[700]}/></button>
    </div>
  );
}
function MFooter({children}:{children:React.ReactNode}) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,padding:"14px 22px",borderTop:`1px solid ${EM[100]}`,background:EM[50],borderRadius:"0 0 18px 18px",flexWrap:"wrap"}}>{children}</div>;
}
const BtnCancel = ({onClick}:{onClick:()=>void}) => (
  <button onClick={onClick} style={{padding:"8px 16px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:"#fff",color:EM[700],fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
);
const BtnPrimary = ({onClick,disabled,children,danger=false}:{onClick:()=>void;disabled?:boolean;children:React.ReactNode;danger?:boolean}) => (
  <button onClick={onClick} disabled={disabled} style={{padding:"8px 20px",borderRadius:9,background:danger?"#dc2626":EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1,display:"flex",alignItems:"center",gap:7}}>{children}</button>
);

// ── STAT CARD ─────────────────────────────────────────────────────────────────

function StatCard({icon:Icon,label,value,sub,accent,delay=0,warn=false}:{icon:any;label:string;value:string|number;sub?:string;accent:string;delay?:number;warn?:boolean}) {
  return (
    <div style={{background:"#fff",borderRadius:16,padding:"18px 20px",border:warn?`1.5px solid ${accent}55`:`1.5px solid ${EM[100]}`,boxShadow:warn?`0 4px 20px ${accent}15`:"0 2px 12px rgba(6,78,59,.06)",display:"flex",flexDirection:"column",gap:10,animation:`fadeUp .5s ease ${delay}s both`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:10,fontWeight:800,color:"#6b7280",letterSpacing:".1em",textTransform:"uppercase"}}>{label}</span>
        <div style={{width:36,height:36,borderRadius:10,background:`${accent}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={18} style={{color:accent}}/></div>
      </div>
      <div style={{fontSize:30,fontWeight:900,color:warn?accent:EM[900],lineHeight:1,fontFamily:"Georgia,serif"}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"#9ca3af"}}>{sub}</div>}
      <div style={{height:3,borderRadius:2,background:`${accent}18`}}><div style={{height:"100%",width:"60%",borderRadius:2,background:accent}}/></div>
    </div>
  );
}

// ── CITIZEN DETAIL MODAL ──────────────────────────────────────────────────────

function CitizenDetailModal({citizen,profile,onClose,onRefresh}:{citizen:Citizen;profile:LGUProfile;onClose:()=>void;onRefresh:()=>void}) {
  const [showWarn,    setShowWarn]    = useState(false);
  const [showRevoke,  setShowRevoke]  = useState(false);
  const [resolvingId, setResolvingId] = useState<string|null>(null);
  const [archiving,   setArchiving]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [warnNote,    setWarnNote]    = useState("");
  const [warnType,    setWarnType]    = useState(VIOLATION_TYPES[0]);
  const [successMsg,  setSuccessMsg]  = useState("");
  const [scoreHistory,setScoreHistory]= useState<{score:number;score_month:string}[]>([]);

  const violations = citizen.violations ?? [];
  const openV = violations.filter(v=>v.status!=="Resolved").length;

  useEffect(()=>{
    supabase.from("citizen_scores").select("score,score_month").eq("citizen_id",citizen.id).order("score_month",{ascending:false}).limit(6).then(({data}: {data: {score:number;score_month:string}[]|null, error: unknown})=>setScoreHistory(data??[]));
  },[citizen.id]);

  const flash = (msg:string) => { setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(""),3500); };

  const issueWarning = async () => {
    setSaving(true);
    await supabase.from("profiles").update({warning_count:citizen.warning_count+1}).eq("id",citizen.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_ISSUE_WARNING",target_id:citizen.id,reason:`Warning issued by ${profile.full_name} — ${warnNote||"No note"}`,metadata:{type:warnType,note:warnNote,barangay:profile.barangay}});
    // Insert notification for citizen
    await supabase.from("notifications").insert({user_id:citizen.id,type:"WARNING_ISSUED",title:"Warning Issued",body:`A warning has been issued against you for: ${warnType}. ${warnNote||""}`.trim(),created_by:profile.id,metadata:{type:warnType,note:warnNote,barangay:profile.barangay}});
    flash("Warning issued successfully."); setShowWarn(false); setWarnNote(""); setSaving(false); onRefresh();
  };

  const revokeWarning = async () => {
    if (citizen.warning_count<=0) return;
    setSaving(true);
    await supabase.from("profiles").update({warning_count:citizen.warning_count-1}).eq("id",citizen.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_REVOKE_WARNING",target_id:citizen.id,reason:`Warning revoked by ${profile.full_name}`});
    await supabase.from("notifications").insert({user_id:citizen.id,type:"WARNING_REVOKED",title:"Warning Revoked",body:`One of your warnings has been revoked by ${profile.position_title} ${profile.full_name}.`,created_by:profile.id});
    flash("Warning revoked."); setShowRevoke(false); setSaving(false); onRefresh();
  };

  const resolveV = async (id:string) => {
    setResolvingId(id);
    await supabase.from("violations").update({status:"Resolved",resolved_at:new Date().toISOString()}).eq("id",id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_RESOLVE_VIOLATION",target_id:id,reason:`Resolved by ${profile.full_name} in Barangay ${profile.barangay}`});
    await supabase.from("notifications").insert({user_id:citizen.id,type:"VIOLATION_RESOLVED",title:"Violation Resolved",body:`Your violation case has been resolved by ${profile.position_title} ${profile.full_name}.`,created_by:profile.id});
    flash("Violation resolved and citizen notified."); setResolvingId(null); onRefresh();
  };

  const toggleArchive = async () => {
    setArchiving(true);
    await supabase.from("profiles").update({is_archived:!citizen.is_archived}).eq("id",citizen.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:citizen.is_archived?"LGU_RESTORE_CITIZEN":"LGU_ARCHIVE_CITIZEN",target_id:citizen.id,reason:`${citizen.is_archived?"Restored":"Archived"} by ${profile.full_name}`});
    if (!citizen.is_archived) {
      await supabase.from("notifications").insert({user_id:citizen.id,type:"ACCOUNT_ARCHIVED",title:"Account Archived",body:"Your account has been archived. Contact the barangay office for assistance.",created_by:profile.id});
    }
    setArchiving(false); onRefresh(); onClose();
  };

  const currentScore = citizen.score ?? (scoreHistory[0]?.score ?? 100);

  return (
    <>
      <Modal onClose={onClose} wide>
        <MHead title={citizen.full_name??"Citizen"} sub={`${citizen.email} · Joined ${fmtDate(citizen.created_at)}`} icon={Users} onClose={onClose}/>
        <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:18}}>
          {successMsg && (
            <div style={{padding:"10px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",alignItems:"center",gap:8}}>
              <CheckCircle size={15} color={EM[600]}/><span style={{fontSize:13,color:EM[800],fontWeight:600}}>{successMsg}</span>
            </div>
          )}

          {/* Info + Score grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:14,alignItems:"start"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
              {[
                {label:"Purok",       value:citizen.purok??"—"},
                {label:"Street",      value:citizen.address_street??"—"},
                {label:"Lot / House", value:citizen.house_lot_number??"—"},
                {label:"Contact",     value:citizen.contact_number??"—"},
                {label:"Service",     value:citizen.service_type??"General"},
                {label:"Status",      value:citizen.is_archived?"Archived":"Active"},
              ].map(f=>(
                <div key={f.label} style={{background:EM[50],borderRadius:10,padding:"11px 14px",border:`1px solid ${EM[100]}`}}>
                  <div style={{fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{f.label}</div>
                  <div style={{fontSize:13,fontWeight:600,color:EM[900]}}>{f.value}</div>
                </div>
              ))}
            </div>
            {/* Score ring */}
            <div style={{textAlign:"center",background:EM[50],borderRadius:14,padding:"16px 20px",border:`1.5px solid ${EM[100]}`,minWidth:120}}>
              <div style={{fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Eco Score</div>
              <div style={{fontSize:38,fontWeight:900,color:scoreColor(currentScore),fontFamily:"Georgia,serif",lineHeight:1}}>{currentScore}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>/100</div>
              {scoreHistory.length > 1 && (
                <div style={{marginTop:10,display:"flex",gap:3,justifyContent:"center"}}>
                  {scoreHistory.slice(0,5).reverse().map((s,i)=>(
                    <div key={i} style={{width:8,height:24,borderRadius:3,background:`${scoreColor(s.score)}`,opacity:0.3+i*0.14}} title={`${s.score_month}: ${s.score}`}/>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Warning bar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderRadius:12,background:citizen.warning_count>=3?"#fef2f2":EM[50],border:`1.5px solid ${citizen.warning_count>=3?"#fecaca":EM[200]}`,flexWrap:"wrap",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <ShieldAlert size={20} color={citizen.warning_count>=3?"#dc2626":EM[600]}/>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:citizen.warning_count>=3?"#991b1b":EM[900]}}>{citizen.warning_count} Active Warning{citizen.warning_count!==1?"s":""}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{citizen.warning_count>=3?"⚠️ Eligible for RA 9003 barangay proceedings":"3 warnings triggers formal proceedings"}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              {citizen.warning_count>0 && <button onClick={()=>setShowRevoke(true)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:9,background:"#fff",color:"#dc2626",border:"1.5px solid #fecaca",cursor:"pointer"}}>Revoke</button>}
              <button onClick={()=>setShowWarn(true)} disabled={citizen.is_archived} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:9,background:EM[600],color:"#fff",border:"none",cursor:"pointer",opacity:citizen.is_archived?.5:1}}>+ Issue Warning</button>
            </div>
          </div>

          {/* Violations */}
          <div>
            <div style={{fontSize:12,fontWeight:800,color:EM[800],letterSpacing:".08em",textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:7}}>
              <AlertTriangle size={14} color={EM[600]}/>Violations ({violations.length}){openV>0&&<span style={{fontSize:10,fontWeight:800,padding:"1px 8px",borderRadius:20,background:"#fef3c7",color:"#92400e"}}>{openV} open</span>}
            </div>
            {violations.length===0 ? (
              <div style={{padding:18,textAlign:"center",background:EM[50],borderRadius:10,border:`1px solid ${EM[100]}`}}>
                <CheckCircle size={20} color={EM[400]} style={{margin:"0 auto 6px"}}/><p style={{fontSize:13,color:EM[700],margin:0}}>No violations recorded</p>
              </div>
            ) : violations.map(v=>{
              const sc = STATUS_CFG[v.status]??STATUS_CFG.Pending;
              return (
                <div key={v.id} style={{padding:"11px 14px",borderRadius:10,background:"#fff",border:`1.5px solid ${EM[100]}`,display:"flex",alignItems:"flex-start",gap:12,marginBottom:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:sc.dot,marginTop:5,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:800,color:EM[900]}}>{v.type.replace(/_/g," ")}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.text}}>{sc.label}</span>
                      <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{timeAgo(v.created_at)}</span>
                    </div>
                    <p style={{fontSize:12,color:"#6b7280",margin:0,lineHeight:1.5}}>{v.description??"No description"}</p>
                    {v.resolved_at&&<div style={{fontSize:11,color:EM[600],marginTop:3}}>Resolved: {fmtDate(v.resolved_at)}</div>}
                  </div>
                  {v.status!=="Resolved" && (
                    <button onClick={()=>resolveV(v.id)} disabled={resolvingId===v.id} style={{fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:8,background:EM[50],color:EM[700],border:`1.5px solid ${EM[300]}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                      {resolvingId===v.id?"Saving…":"✓ Resolve"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 22px",borderTop:`1px solid ${EM[100]}`,background:EM[50],borderRadius:"0 0 18px 18px",flexWrap:"wrap",gap:10}}>
          <button onClick={toggleArchive} disabled={archiving} style={{fontSize:12,fontWeight:700,padding:"8px 16px",borderRadius:9,border:`1.5px solid ${citizen.is_archived?EM[300]:"#fca5a5"}`,background:"#fff",color:citizen.is_archived?EM[700]:"#dc2626",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            {citizen.is_archived?<><ArchiveRestore size={14}/>Restore Account</>:<><Archive size={14}/>Archive Account</>}
          </button>
          <button onClick={onClose} style={{fontSize:12,fontWeight:700,padding:"8px 20px",borderRadius:9,background:EM[600],color:"#fff",border:"none",cursor:"pointer"}}>Close</button>
        </div>
      </Modal>

      {/* Issue warning modal */}
      {showWarn && (
        <Modal onClose={()=>setShowWarn(false)}>
          <MHead title="Issue Warning" sub={`To: ${citizen.full_name}`} icon={AlertTriangle} onClose={()=>setShowWarn(false)}/>
          <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Violation Type</label>
              <select value={warnType} onChange={e=>setWarnType(e.target.value)} style={INP}>{VIOLATION_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Note (optional)</label>
              <textarea value={warnNote} onChange={e=>setWarnNote(e.target.value)} placeholder="Add context for your records…" rows={3} style={{...INP,resize:"none",lineHeight:1.6}}/>
            </div>
            <div style={{padding:"9px 13px",borderRadius:9,background:"#fffbeb",border:"1px solid #fde68a",fontSize:12,color:"#78350f"}}>✅ Citizen will receive an in-app notification about this warning.</div>
          </div>
          <MFooter><BtnCancel onClick={()=>setShowWarn(false)}/><BtnPrimary onClick={issueWarning} disabled={saving}>{saving?"Issuing…":"Issue Warning"}</BtnPrimary></MFooter>
        </Modal>
      )}

      {/* Revoke confirm */}
      {showRevoke && (
        <Modal onClose={()=>setShowRevoke(false)}>
          <MHead title="Revoke Last Warning" sub="This action will be logged" icon={ArchiveRestore} onClose={()=>setShowRevoke(false)}/>
          <div style={{padding:"18px 22px"}}>
            <p style={{fontSize:14,color:"#374151",margin:"0 0 16px",lineHeight:1.6}}>
              Revoke one warning from <strong>{citizen.full_name}</strong>? Count: <strong>{citizen.warning_count}</strong> → <strong>{citizen.warning_count-1}</strong>.
            </p>
          </div>
          <MFooter><BtnCancel onClick={()=>setShowRevoke(false)}/><BtnPrimary onClick={revokeWarning} disabled={saving} danger>{saving?"Revoking…":"Revoke Warning"}</BtnPrimary></MFooter>
        </Modal>
      )}
    </>
  );
}

// ── BROADCAST MODAL ───────────────────────────────────────────────────────────

function BroadcastModal({profile,citizenCount,onClose,onSent}:{profile:LGUProfile;citizenCount:number;onClose:()=>void;onSent:()=>void}) {
  const [type,    setType]    = useState("AWARENESS");
  const [subject, setSubject] = useState("");
  const [body,    setBody]    = useState("");
  const [pinned,  setPinned]  = useState(false);
  const [picked,  setPicked]  = useState<string|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);

  const send = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    const { data: bc, error } = await supabase.from("broadcasts").insert({
      created_by: profile.id, barangay: profile.barangay, municipality: profile.municipality,
      title: subject.trim(), body: body.trim(), type, is_pinned: pinned,
    }).select("id").single();
    if (error || !bc) { setSaving(false); return; }

    // Get all citizens in this barangay and create notifications
    const { data: cDetails } = await supabase.from("citizen_details").select("id").eq("barangay", profile.barangay);
    if (cDetails && cDetails.length > 0) {
      const notifs = cDetails.map((c:any) => ({
        user_id: c.id, type: "BROADCAST", title: subject.trim(),
        body: body.trim(), created_by: profile.id,
        metadata: { broadcast_id: bc.id, broadcast_type: type, barangay: profile.barangay },
      }));
      await supabase.from("notifications").insert(notifs);
    }
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_BROADCAST",target_id:bc.id,reason:`Broadcast "${subject}" sent to Barangay ${profile.barangay} (${cDetails?.length??0} citizens)`});
    setSaving(false); setSuccess(true); onSent();
    setTimeout(onClose, 1200);
  };

  return (
    <Modal onClose={onClose} wide>
      <MHead title="Broadcast to Citizens" sub={`Barangay ${profile.barangay} · ${citizenCount} recipients`} icon={Megaphone} onClose={onClose}/>
      <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:16}}>
        {/* Type selector */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {BROADCAST_TYPES.map(t=>(
            <button key={t.id} onClick={()=>setType(t.id)} style={{padding:"8px 14px",borderRadius:10,border:`1.5px solid ${type===t.id?EM[400]:EM[100]}`,background:type===t.id?EM[50]:"#fff",cursor:"pointer",fontSize:12,fontWeight:type===t.id?700:500,color:type===t.id?EM[800]:"#374151",display:"flex",alignItems:"center",gap:5}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {/* Templates */}
        <div>
          <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Quick Templates</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {BROADCAST_TEMPLATES.map(s=>(
              <button key={s.id} onClick={()=>{setPicked(s.id);setType(s.type);setSubject(s.title);setBody(s.body);}} style={{padding:"10px 12px",borderRadius:9,textAlign:"left",cursor:"pointer",border:`1.5px solid ${picked===s.id?EM[400]:EM[100]}`,background:picked===s.id?EM[50]:"#fff"}}>
                <div style={{fontSize:13}}>{s.icon} <span style={{fontWeight:700,color:EM[900]}}>{s.title}</span></div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.body}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Subject *</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Segregation Reminder" style={INP}/>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Message *</label>
          <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Type your message to all citizens in your barangay…" rows={4} style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:EM[800]}}>
          <input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)} style={{width:16,height:16,accentColor:EM[600]}}/>
          Pin this broadcast (shows at top of citizen news feed)
        </label>
        {success
          ? <div style={{padding:"11px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={15} color={EM[600]}/><span style={{fontSize:13,color:EM[800],fontWeight:600}}>Broadcast sent to {citizenCount} citizens!</span></div>
          : <div style={{padding:"9px 13px",borderRadius:9,background:EM[50],border:`1px solid ${EM[200]}`,fontSize:12,color:EM[700]}}>✅ Citizens will receive an in-app notification. Push delivery requires FCM setup.</div>
        }
      </div>
      <MFooter>
        <BtnCancel onClick={onClose}/>
        <BtnPrimary onClick={send} disabled={!subject||!body||saving||success}><Send size={14}/> {saving?"Sending…":"Send Broadcast"}</BtnPrimary>
      </MFooter>
    </Modal>
  );
}

// ── REPORT REVIEW MODAL ───────────────────────────────────────────────────────

function ReportModal({report,profile,onClose,onRefresh}:{report:CitizenReport;profile:LGUProfile;onClose:()=>void;onRefresh:()=>void}) {
  const [notes,   setNotes]   = useState(report.lgu_notes ?? "");
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState("");

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    await supabase.from("citizen_reports").update({status:newStatus,lgu_notes:notes.trim()||null,reviewed_by:profile.id,reviewed_at:new Date().toISOString()}).eq("id",report.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_REVIEW_REPORT",target_id:report.id,reason:`Report ${newStatus} by ${profile.full_name}. Notes: ${notes||"none"}`});

    // Notify reporter of status change
    await supabase.from("notifications").insert({user_id:report.reporter_id,type:"REPORT_STATUS",title:`Your Report: ${newStatus}`,body:`Your report about ${report.type} has been updated to "${newStatus}".${notes?` LGU note: ${notes}`:""}`,created_by:profile.id,metadata:{report_id:report.id,status:newStatus}});

    // If escalating → create a violation
    if (newStatus === "Escalated" && report.reported_id) {
      await supabase.from("violations").insert({citizen_id:report.reported_id,barangay:profile.barangay,type:report.type as any,description:`Escalated from citizen report. ${report.description??""} ${notes?"LGU note: "+notes:""}`.trim(),status:"Pending"});
      await supabase.from("notifications").insert({user_id:report.reported_id,type:"VIOLATION_FILED",title:"Violation Filed",body:`A violation (${report.type}) has been filed against your account by the LGU.`,created_by:profile.id});
    }
    setSuccess(newStatus); setSaving(false); onRefresh();
  };

  const sc = STATUS_CFG[report.status] ?? STATUS_CFG.Submitted;
  const nextActions = REPORT_STATUSES.filter(s => s !== report.status && s !== "Resolved");

  return (
    <Modal onClose={onClose} wide>
      <MHead title="Review Report" sub={`Filed ${timeAgo(report.created_at)}`} icon={Flag} onClose={onClose}/>
      <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:16}}>
        {success && <div style={{padding:"10px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",alignItems:"center",gap:8}}><CheckCircle size={15} color={EM[600]}/><span style={{fontSize:13,color:EM[800],fontWeight:600}}>Status updated to: {success}</span></div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:EM[50],borderRadius:10,padding:"12px 14px",border:`1px solid ${EM[100]}`}}>
            <div style={{fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Reporter</div>
            <div style={{fontSize:13,fontWeight:600,color:EM[900]}}>{report.reporter_name ?? "Anonymous"}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>Identity hidden from reported citizen</div>
          </div>
          <div style={{background:"#fef3c7",borderRadius:10,padding:"12px 14px",border:"1px solid #fde68a"}}>
            <div style={{fontSize:10,fontWeight:800,color:"#92400e",letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Reported Citizen</div>
            <div style={{fontSize:13,fontWeight:600,color:"#78350f"}}>{report.reported_name ?? "Unknown"}</div>
          </div>
        </div>

        <div style={{padding:"12px 14px",borderRadius:10,background:"#fff",border:`1.5px solid ${EM[100]}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:800,color:EM[900]}}>{report.type.replace(/_/g," ")}</span>
            <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.text}}>{sc.label}</span>
          </div>
          <p style={{fontSize:13,color:"#374151",margin:0,lineHeight:1.6}}>{report.description ?? "No description provided."}</p>
        </div>

        {/* Proof images */}
        {report.proof_urls.length > 0 && (
          <div>
            <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Proof ({report.proof_urls.length} file{report.proof_urls.length!==1?"s":""})</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {report.proof_urls.map((url,i)=>(
                <a key={i} href={url} target="_blank" rel="noopener" style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,background:EM[50],border:`1px solid ${EM[200]}`,fontSize:12,color:EM[700],textDecoration:"none",fontWeight:600}}>
                  📎 File {i+1}
                </a>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>LGU Internal Notes (hidden from citizens)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add your assessment notes here…" rows={3} style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>

        {report.status !== "Escalated" && report.status !== "Dismissed" && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>updateStatus("Escalated")} disabled={saving||!report.reported_id} style={{padding:"8px 16px",borderRadius:9,background:"#fef2f2",color:"#dc2626",border:"1.5px solid #fecaca",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:(!report.reported_id||saving)?.5:1}}>
              <AlertTriangle size={13}/> Escalate → Violation
            </button>
            <button onClick={()=>updateStatus("Under Review")} disabled={saving||report.status==="Under Review"} style={{padding:"8px 16px",borderRadius:9,background:"#eff6ff",color:"#1e40af",border:"1.5px solid #bfdbfe",fontSize:12,fontWeight:700,cursor:"pointer",opacity:report.status==="Under Review"?.5:1}}>
              Mark Under Review
            </button>
            <button onClick={()=>updateStatus("Dismissed")} disabled={saving} style={{padding:"8px 16px",borderRadius:9,background:"#f1f5f9",color:"#374151",border:"1.5px solid #e2e8f0",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Dismiss
            </button>
          </div>
        )}
        {!report.reported_id && <p style={{fontSize:12,color:"#9ca3af",margin:0}}>⚠ Escalation requires a reported citizen to be identified.</p>}
      </div>
      <MFooter><button onClick={onClose} style={{padding:"8px 20px",borderRadius:9,background:EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>Close</button></MFooter>
    </Modal>
  );
}

// ── SCHEDULE MODAL ────────────────────────────────────────────────────────────

function ScheduleModal({profile,schedule,onClose,onRefresh}:{profile:LGUProfile;schedule?:Schedule;onClose:()=>void;onRefresh:()=>void}) {
  const [label,    setLabel]    = useState(schedule?.label??"");
  const [dow,      setDow]      = useState<number>(schedule?.day_of_week??1);
  const [time,     setTime]     = useState(schedule?.scheduled_time??"07:00");
  const [types,    setTypes]    = useState<string[]>(schedule?.waste_types??[]);
  const [notes,    setNotes]    = useState(schedule?.notes??"");
  const [saving,   setSaving]   = useState(false);
  const WASTE = ["Biodegradable","Recyclable","Residual","Hazardous"];

  const toggleType = (t:string) => setTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev,t]);

  const save = async () => {
    if (!label.trim() || types.length === 0) return;
    setSaving(true);
    const payload = {label:label.trim(),barangay:profile.barangay,municipality:profile.municipality,day_of_week:dow,scheduled_time:time,waste_types:types,notes:notes.trim()||null,is_active:true,created_by:profile.id};
    if (schedule) {
      await supabase.from("collection_schedules").update(payload).eq("id",schedule.id);
    } else {
      await supabase.from("collection_schedules").insert(payload);
    }
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:schedule?"LGU_UPDATE_SCHEDULE":"LGU_CREATE_SCHEDULE",target_id:schedule?.id??"new",reason:`${schedule?"Updated":"Created"} schedule "${label}" for Barangay ${profile.barangay}`});
    setSaving(false); onRefresh(); onClose();
  };

  return (
    <Modal onClose={onClose}>
      <MHead title={schedule?"Edit Schedule":"New Schedule"} sub={`Barangay ${profile.barangay}`} icon={Calendar} onClose={onClose}/>
      <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Schedule Label *</label>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Monday Morning Run" style={INP}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Day of Week</label>
            <select value={dow} onChange={e=>setDow(Number(e.target.value))} style={INP}>
              {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Time</label>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={INP}/>
          </div>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:8}}>Waste Types *</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {WASTE.map(w=>(
              <button key={w} onClick={()=>toggleType(w)} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${types.includes(w)?EM[400]:EM[100]}`,background:types.includes(w)?EM[100]:"#fff",color:types.includes(w)?EM[800]:"#6b7280",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Notes (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Special instructions…" style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>
      </div>
      <MFooter>
        <BtnCancel onClick={onClose}/>
        <BtnPrimary onClick={save} disabled={!label||types.length===0||saving}>{saving?"Saving…":schedule?"Update Schedule":"Create Schedule"}</BtnPrimary>
      </MFooter>
    </Modal>
  );
}

// ── NOTIFICATION PANEL ────────────────────────────────────────────────────────

function NotifPanel({notifs,onRead,onClose}:{notifs:DBNotif[];onRead:(id:string)=>void;onClose:()=>void}) {
  const unread = notifs.filter(n=>!n.is_read).length;
  const iconFor = (type:string) => {
    if (type==="REPORT_RECEIVED") return <Flag size={13} color="#d97706"/>;
    if (type==="new_citizen"||type==="BROADCAST") return <UserCheck size={13} color={EM[600]}/>;
    return <Info size={13} color="#3b82f6"/>;
  };
  const bgFor = (type:string) => type==="REPORT_RECEIVED"?"#fef3c7":type==="BROADCAST"?EM[100]:"#eff6ff";
  return (
    <div style={{position:"absolute",top:"calc(100% + 10px)",right:0,width:340,background:"#fff",borderRadius:16,border:`1.5px solid ${EM[100]}`,boxShadow:`0 20px 60px rgba(6,78,59,.18)`,zIndex:400,animation:"dropIn .18s ease both",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:`1px solid ${EM[100]}`,background:EM[50]}}>
        <div style={{fontSize:14,fontWeight:800,color:EM[900]}}>Notifications {unread>0&&<span style={{fontSize:10,fontWeight:800,marginLeft:5,background:"#ef4444",color:"#fff",padding:"1px 7px",borderRadius:20}}>{unread}</span>}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}><X size={14} color={EM[700]}/></button>
      </div>
      <div style={{maxHeight:380,overflowY:"auto"}}>
        {notifs.length===0 ? (
          <div style={{padding:32,textAlign:"center",color:"#9ca3af",fontSize:13}}>No notifications yet</div>
        ) : notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)} style={{padding:"12px 16px",borderBottom:`1px solid ${EM[50]}`,background:n.is_read?"#fff":EM[50],cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:bgFor(n.type),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {iconFor(n.type)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:n.is_read?500:700,color:EM[900]}}>{n.title}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.4}}>{n.body}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:3}}>{timeAgo(n.created_at)}</div>
            </div>
            {!n.is_read&&<div style={{width:7,height:7,borderRadius:"50%",background:EM[500],flexShrink:0,marginTop:5}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();
  const [profile,        setProfile]        = useState<LGUProfile|null>(null);
  const [citizens,       setCitizens]       = useState<Citizen[]>([]);
  const [violations,     setViolations]     = useState<Violation[]>([]);
  const [broadcasts,     setBroadcasts]     = useState<Broadcast[]>([]);
  const [schedules,      setSchedules]      = useState<Schedule[]>([]);
  const [reports,        setReports]        = useState<CitizenReport[]>([]);
  const [notifs,         setNotifs]         = useState<DBNotif[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState<"citizens"|"violations"|"reports"|"schedules"|"broadcasts"|"overview">("citizens");
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [citizenFilter,  setCitizenFilter]  = useState("all");
  const [selectedCitizen,setSelectedCitizen]= useState<Citizen|null>(null);
  const [selectedReport, setSelectedReport] = useState<CitizenReport|null>(null);
  const [showBroadcast,  setShowBroadcast]  = useState(false);
  const [showSchedule,   setShowSchedule]   = useState(false);
  const [editSchedule,   setEditSchedule]   = useState<Schedule|undefined>(undefined);
  const [mobileMenu,     setMobileMenu]     = useState(false);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if (!notifOpen) return;
    const h=(e:MouseEvent)=>{ if(notifRef.current&&!notifRef.current.contains(e.target as Node)) setNotifOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[notifOpen]);

  const fetchData = useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if (!user){router.push("/login");return;}

    const {data:pData}=await supabase.from("profiles").select("id,full_name,email").eq("id",user.id).single();
    const {data:lguData}=await supabase.from("lgu_details").select("barangay,municipality,position_title").eq("id",user.id).single();
    if (!pData||!lguData){router.push("/login");return;}

    const me:LGUProfile={id:pData.id,full_name:pData.full_name??"LGU Official",email:pData.email??"",barangay:lguData.barangay,municipality:lguData.municipality??"",position_title:lguData.position_title??"LGU Official"};
    setProfile(me);

    // Citizens
    const {data:cDetails}=await supabase.from("citizen_details").select("id,purok,address_street,house_lot_number,service_type,created_at").eq("barangay",me.barangay);
    if (cDetails&&cDetails.length>0) {
      const ids=cDetails.map((c:any)=>c.id);
      const {data:profiles}=await supabase.from("profiles").select("id,full_name,email,contact_number,warning_count,is_archived").in("id",ids).eq("role","CITIZEN");
      const {data:cv}=await supabase.from("violations").select("*").in("citizen_id",ids).order("created_at",{ascending:false});
      const {data:scores}=await supabase.from("citizen_scores").select("citizen_id,score").in("citizen_id",ids).order("score_month",{ascending:false});
      const vMap:Record<string,Violation[]>={};
      (cv??[]).forEach((v:any)=>{if(!vMap[v.citizen_id])vMap[v.citizen_id]=[];vMap[v.citizen_id].push(v);});
      const sMap:Record<string,number>={};
      (scores??[]).forEach((s:any)=>{ if(!sMap[s.citizen_id]) sMap[s.citizen_id]=s.score; });
      setCitizens((profiles??[]).map((p:any)=>{const d=cDetails.find((x:any)=>x.id===p.id);return{...p,...d,violations:vMap[p.id]??[],score:sMap[p.id]??100};}));
    } else setCitizens([]);

    // Violations
    const {data:vData}=await supabase.from("violations").select("*,profiles(full_name)").eq("barangay",me.barangay).order("created_at",{ascending:false});
    setViolations((vData??[]).map((v:any)=>({...v,citizen_name:v.profiles?.full_name??"Unknown"})));

    // Broadcasts
    const {data:bcData}=await supabase.from("broadcasts").select("*").eq("barangay",me.barangay).order("is_pinned",{ascending:false}).order("created_at",{ascending:false});
    setBroadcasts(bcData??[]);

    // Schedules
    const {data:schData}=await supabase.from("collection_schedules").select("*").eq("barangay",me.barangay).order("day_of_week");
    setSchedules(schData??[]);

    // Citizen reports
    const {data:repData}=await supabase.from("citizen_reports").select("*").eq("barangay",me.barangay).order("created_at",{ascending:false});
    if (repData && repData.length>0) {
      const allIds=[...new Set([...repData.map((r:any)=>r.reporter_id).filter(Boolean),...repData.map((r:any)=>r.reported_id).filter(Boolean)])];
      const {data:pNames}=await supabase.from("profiles").select("id,full_name").in("id",allIds);
      const nameMap:Record<string,string>=Object.fromEntries((pNames??[]).map((p:any)=>[p.id,p.full_name]));
      setReports(repData.map((r:any)=>({...r,reporter_name:nameMap[r.reporter_id]??"Unknown",reported_name:r.reported_id?nameMap[r.reported_id]??"Unknown":"Unknown"})));
    } else setReports([]);

    // Notifications (own)
    const {data:nData}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40);
    setNotifs(nData??[]);

    setLoading(false);
  },[router]);

  useEffect(()=>{fetchData();},[fetchData]);

  // Realtime subscriptions (citizens, violations, reports)
  useEffect(()=>{
    if (!profile?.barangay) return;
    const addN=(n:Omit<DBNotif,"id"|"is_read">)=>setNotifs(p=>[{...n,id:crypto.randomUUID(),is_read:false},...p].slice(0,40));

    const ch1=supabase.channel("lgu-cd").on("postgres_changes",{event:"INSERT",schema:"public",table:"citizen_details",filter:`barangay=eq.${profile.barangay}`},()=>{
      addN({type:"new_citizen",title:"New Citizen Registered",body:`A new resident has registered under Barangay ${profile.barangay}.`,created_at:new Date().toISOString()});
      fetchData();
    }).subscribe();

    const ch2=supabase.channel("lgu-viol").on("postgres_changes",{event:"INSERT",schema:"public",table:"violations",filter:`barangay=eq.${profile.barangay}`},(payload:any)=>{
      addN({type:"REPORT_RECEIVED",title:"New Violation Reported",body:`A violation (${payload.new?.type?.replace(/_/g," ")??"unknown"}) was reported in your barangay.`,created_at:new Date().toISOString()});
      fetchData();
    }).subscribe();

    const ch3=supabase.channel("lgu-rep").on("postgres_changes",{event:"INSERT",schema:"public",table:"citizen_reports",filter:`barangay=eq.${profile.barangay}`},(payload:any)=>{
      addN({type:"REPORT_RECEIVED",title:"New Citizen Report",body:`A citizen has filed a report (${payload.new?.type?.replace(/_/g," ")??"unknown"}) in your barangay.`,created_at:new Date().toISOString()});
      fetchData();
    }).subscribe();

    // Also subscribe to own notifications table
    const ch4=supabase.channel("lgu-notifs").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${profile.id}`},(payload:any)=>{
      setNotifs(p=>[payload.new as DBNotif,...p].slice(0,40));
    }).subscribe();

    return ()=>{supabase.removeChannel(ch1);supabase.removeChannel(ch2);supabase.removeChannel(ch3);supabase.removeChannel(ch4);};
  },[profile?.barangay,profile?.id,fetchData]);

  const markRead = async (id:string) => {
    setNotifs(p=>p.map(n=>n.id===id?{...n,is_read:true}:n));
    await supabase.from("notifications").update({is_read:true}).eq("id",id);
  };

  const toggleSchedule = async (id:string, active:boolean) => {
    await supabase.from("collection_schedules").update({is_active:!active}).eq("id",id);
    fetchData();
  };

  const deleteSchedule = async (id:string) => {
    await supabase.from("collection_schedules").delete().eq("id",id);
    await supabase.from("audit_logs").insert({admin_id:profile!.id,action_type:"LGU_DELETE_SCHEDULE",target_id:id,reason:`Schedule deleted by ${profile!.full_name}`});
    fetchData();
  };

  const unreadC = notifs.filter(n=>!n.is_read).length;
  const freshC  = selectedCitizen ? citizens.find(c=>c.id===selectedCitizen.id)??selectedCitizen : null;

  const filtCitizens=citizens.filter(c=>{
    const mF=citizenFilter==="all"?true:citizenFilter==="warnings"?c.warning_count>0:citizenFilter==="violations"?(c.violations?.length??0)>0:citizenFilter==="archived"?c.is_archived:true;
    const mS=(c.full_name??"").toLowerCase().includes(search.toLowerCase())||(c.email??"").toLowerCase().includes(search.toLowerCase())||(c.purok??"").toLowerCase().includes(search.toLowerCase());
    return mF&&mS;
  });
  const filtViolations=violations.filter(v=>{
    const mSt=statusFilter==="all"||v.status===statusFilter;
    const mS=(v.citizen_name??"").toLowerCase().includes(search.toLowerCase())||v.type.toLowerCase().includes(search.toLowerCase());
    return mSt&&mS;
  });
  const filtReports=reports.filter(r=>{
    const mSt=statusFilter==="all"||r.status===statusFilter;
    const mS=(r.reporter_name??"").toLowerCase().includes(search.toLowerCase())||(r.reported_name??"").toLowerCase().includes(search.toLowerCase())||r.type.toLowerCase().includes(search.toLowerCase());
    return mSt&&mS;
  });

  const pendingV    = violations.filter(v=>v.status==="Pending").length;
  const activeW     = citizens.filter(c=>c.warning_count>0).length;
  const pendingRep  = reports.filter(r=>r.status==="Submitted").length;
  const compliance  = citizens.length>0?Math.round((citizens.filter(c=>c.warning_count===0).length/citizens.length)*100):100;

  if (loading) return (
    <div style={{minHeight:"100vh",background:EM[50],display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:44,height:44,borderRadius:"50%",border:`3px solid ${EM[200]}`,borderTopColor:EM[600],animation:"spin 1s linear infinite",margin:"0 auto 14px"}}/>
        <p style={{fontSize:11,fontWeight:700,color:EM[700],letterSpacing:".1em",textTransform:"uppercase"}}>Loading dashboard…</p>
      </div>
    </div>
  );

  const TABS=[
    {id:"citizens",   label:"Citizens",   count:citizens.length},
    {id:"violations", label:"Violations", count:violations.length},
    {id:"reports",    label:"Reports",    count:reports.length,  badge:pendingRep},
    {id:"schedules",  label:"Schedules",  count:schedules.length},
    {id:"broadcasts", label:"Broadcasts", count:broadcasts.length},
    {id:"overview",   label:"Overview",   count:null},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f7faf8",fontFamily:"sans-serif",color:EM[900]}}>
      <style>{`
        @keyframes fadeUp  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dropIn  {from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn {from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes pulse   {0%,100%{opacity:1}50%{opacity:.35}}
        .row-hover:hover{background:${EM[50]}!important;cursor:pointer;}
        .tab-pill{transition:all .18s;border-radius:10px;cursor:pointer;}
        .tab-pill:hover{background:${EM[100]}!important;}
        .act-btn{transition:all .15s;}
        .act-btn:hover{opacity:.85;transform:scale(.98);}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${EM[200]};border-radius:2px;}
        input::placeholder,textarea::placeholder{color:#9ca3af;}
        select option{color:${EM[900]};background:#fff;}
        @media(max-width:640px){
          .nav-desktop{display:none!important;}
          .nav-ham{display:flex!important;}
          .d-only{display:none!important;}
          .sgrid{grid-template-columns:repeat(2,1fr)!important;}
        }
        @media(min-width:641px){.nav-ham{display:none!important;}}
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{background:"#fff",borderBottom:`1.5px solid ${EM[100]}`,padding:"0 20px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 12px rgba(6,78,59,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${EM[600]},${EM[800]})`,display:"flex",alignItems:"center",justifyContent:"center"}}><MapPin size={18} color="#fff"/></div>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:EM[900],lineHeight:1,letterSpacing:"-.01em"}}>EcoRoute LGU</div>
            <div style={{fontSize:10,color:EM[600],letterSpacing:".06em",textTransform:"uppercase"}}>{profile?.barangay} · {profile?.municipality}</div>
          </div>
        </div>
        <div className="nav-desktop" style={{display:"flex",gap:2,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} className="tab-pill" onClick={()=>{setActiveTab(t.id as any);setSearch("");}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"none",background:activeTab===t.id?EM[100]:"transparent",fontWeight:activeTab===t.id?700:500,color:activeTab===t.id?EM[800]:"#6b7280",fontSize:12,whiteSpace:"nowrap"}}>
              {t.label}
              {t.count!==null&&<span style={{fontSize:10,fontWeight:800,padding:"1px 6px",borderRadius:20,background:activeTab===t.id?EM[200]:"#f1f5f9",color:activeTab===t.id?EM[800]:"#9ca3af"}}>{t.count}</span>}
              {(t as any).badge>0&&<span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:20,background:"#ef4444",color:"#fff"}}>{(t as any).badge}</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setShowBroadcast(true)} className="act-btn d-only" style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:10,background:EM[50],color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer"}}>
            <Megaphone size={14}/> Broadcast
          </button>
          <div ref={notifRef} style={{position:"relative"}}>
            <button onClick={()=>setNotifOpen(o=>!o)} style={{width:38,height:38,borderRadius:11,background:notifOpen?EM[50]:"#fff",border:`1.5px solid ${notifOpen?EM[300]:EM[100]}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}>
              <Bell size={17} color={notifOpen?EM[600]:"#6b7280"}/>
              {unreadC>0&&<span style={{position:"absolute",top:-3,right:-3,width:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>{unreadC>9?"9+":unreadC}</span>}
            </button>
            {notifOpen&&<NotifPanel notifs={notifs} onRead={markRead} onClose={()=>setNotifOpen(false)}/>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg,${EM[400]},${EM[600]})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{(profile?.full_name??"L").charAt(0)}</div>
            <div className="d-only" style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontSize:13,fontWeight:700,color:EM[900],lineHeight:1.2}}>{profile?.full_name}</span>
              <span style={{fontSize:10,color:EM[600]}}>{profile?.position_title}</span>
            </div>
          </div>
          <button onClick={async()=>{await supabase.auth.signOut();router.push("/login");}} className="act-btn" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:10,background:"#fff",border:`1.5px solid ${EM[100]}`,color:"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            <LogOut size={14}/><span className="d-only">Sign out</span>
          </button>
          <button className="nav-ham" onClick={()=>setMobileMenu(o=>!o)} style={{display:"none",width:38,height:38,borderRadius:11,background:mobileMenu?EM[50]:"#fff",border:`1.5px solid ${EM[100]}`,alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            {mobileMenu?<X size={17} color={EM[700]}/>:<Menu size={17} color="#6b7280"/>}
          </button>
        </div>
      </nav>

      {mobileMenu&&(
        <div style={{background:"#fff",borderBottom:`1px solid ${EM[100]}`,padding:"10px 20px 16px",display:"flex",flexDirection:"column",gap:4}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setActiveTab(t.id as any);setMobileMenu(false);setSearch("");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",borderRadius:10,border:"none",background:activeTab===t.id?EM[50]:"transparent",color:activeTab===t.id?EM[800]:"#374151",fontSize:14,fontWeight:600,cursor:"pointer"}}>
              {t.label}
              {t.count!==null&&<span style={{fontSize:11,fontWeight:700,padding:"1px 9px",borderRadius:20,background:EM[100],color:EM[700]}}>{t.count}</span>}
            </button>
          ))}
          <button onClick={()=>{setShowBroadcast(true);setMobileMenu(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderRadius:10,border:"none",background:"transparent",color:"#374151",fontSize:14,fontWeight:600,cursor:"pointer"}}>
            <Megaphone size={16} color={EM[600]}/> Broadcast
          </button>
        </div>
      )}

      {/* ── MAIN ── */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"24px 20px"}}>
        <div style={{marginBottom:24,animation:"fadeUp .4s ease both"}}>
          <h1 style={{fontSize:"clamp(20px,5vw,28px)",fontWeight:900,color:EM[900],margin:0,letterSpacing:"-.02em",fontFamily:"Georgia,serif"}}>Barangay {profile?.barangay}</h1>
          <p style={{fontSize:13,color:EM[700],margin:"3px 0 0"}}>{profile?.municipality} · {profile?.position_title} · {citizens.length} registered citizens</p>
        </div>

        {/* Stat cards */}
        <div className="sgrid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:24}}>
          <StatCard icon={Users}        label="Citizens"       value={citizens.length}   sub={`${citizens.filter(c=>!c.is_archived).length} active`} accent={EM[600]}  delay={0}/>
          <StatCard icon={AlertTriangle} label="Pending Viol."  value={pendingV}          sub="Need review"           accent="#d97706" delay={.05} warn={pendingV>0}/>
          <StatCard icon={Flag}          label="Pending Reports" value={pendingRep}        sub="Citizen reports"       accent="#8b5cf6" delay={.08} warn={pendingRep>0}/>
          <StatCard icon={ShieldAlert}   label="Active Warnings" value={activeW}           sub="Citizens warned"       accent="#dc2626" delay={.1}  warn={activeW>0}/>
          <StatCard icon={Calendar}      label="Schedules"      value={schedules.filter(s=>s.is_active).length} sub="Active routes" accent={EM[600]} delay={.13}/>
          <StatCard icon={TrendingUp}    label="Compliance"     value={`${compliance}%`}  sub="RA 9003 adherence"     accent={compliance>=70?EM[600]:"#d97706"} delay={.16}/>
        </div>

        {/* Panel */}
        <div style={{background:"#fff",borderRadius:18,border:`1.5px solid ${EM[100]}`,boxShadow:"0 4px 24px rgba(6,78,59,.07)",overflow:"hidden",animation:"fadeUp .5s ease .2s both"}}>
          {/* Tabs */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px",borderBottom:`1px solid ${EM[100]}`,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",gap:0,overflowX:"auto"}}>
              {TABS.map(t=>(
                <button key={t.id} className="tab-pill" onClick={()=>{setActiveTab(t.id as any);setSearch("");setStatusFilter("all");}} style={{display:"flex",alignItems:"center",gap:6,padding:"15px 14px",border:"none",background:"transparent",fontWeight:activeTab===t.id?700:500,color:activeTab===t.id?EM[700]:"#6b7280",fontSize:12,borderBottom:activeTab===t.id?`2.5px solid ${EM[600]}`:"2.5px solid transparent",whiteSpace:"nowrap"}}>
                  {t.label}
                  {t.count!==null&&<span style={{fontSize:10,fontWeight:800,padding:"1px 6px",borderRadius:20,background:activeTab===t.id?EM[100]:"#f1f5f9",color:activeTab===t.id?EM[700]:"#9ca3af"}}>{t.count}</span>}
                  {(t as any).badge>0&&<span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:20,background:"#ef4444",color:"#fff"}}>{(t as any).badge}</span>}
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",flexWrap:"wrap"}}>
              {(activeTab==="violations"||activeTab==="reports")&&(
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{fontSize:12,padding:"7px 10px",border:`1.5px solid ${EM[100]}`,borderRadius:9,background:EM[50],color:EM[800],outline:"none",cursor:"pointer"}}>
                  <option value="all">All statuses</option>
                  {activeTab==="violations" && <>
                    <option value="Pending">Pending</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Resolved">Resolved</option>
                  </>}
                  {activeTab==="reports" && <>
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Escalated">Escalated</option>
                    <option value="Dismissed">Dismissed</option>
                    <option value="Resolved">Resolved</option>
                  </>}
                </select>
              )}
              {activeTab==="citizens"&&(
                <select value={citizenFilter} onChange={e=>setCitizenFilter(e.target.value)} style={{fontSize:12,padding:"7px 10px",border:`1.5px solid ${EM[100]}`,borderRadius:9,background:EM[50],color:EM[800],outline:"none",cursor:"pointer"}}>
                  <option value="all">All citizens</option>
                  <option value="warnings">With warnings</option>
                  <option value="violations">With violations</option>
                  <option value="archived">Archived</option>
                </select>
              )}
              {activeTab==="schedules"&&(
                <button onClick={()=>{setEditSchedule(undefined);setShowSchedule(true);}} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:9,background:EM[600],color:"#fff",border:"none",cursor:"pointer"}}>
                  <Calendar size={13}/> + New Schedule
                </button>
              )}
              {(["citizens","violations","reports","broadcasts"] as const).includes(activeTab as any)&&(
                <div style={{position:"relative"}}>
                  <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}/>
                  <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:30,paddingRight:10,paddingTop:7,paddingBottom:7,border:`1.5px solid ${EM[100]}`,borderRadius:9,fontSize:12,color:EM[900],outline:"none",width:150,background:EM[50]}}/>
                </div>
              )}
              <button onClick={fetchData} className="act-btn" style={{padding:"7px 9px",border:`1.5px solid ${EM[100]}`,borderRadius:9,background:EM[50],cursor:"pointer"}}><RefreshCw size={13} color={EM[600]}/></button>
            </div>
          </div>

          {/* ── CITIZENS ── */}
          {activeTab==="citizens"&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead><tr style={{background:EM[50]}}>
                  {["Citizen","Location","Contact","Warnings","Score","Violations","Status",""].map(h=>(
                    <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",borderBottom:`1px solid ${EM[100]}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtCitizens.length===0?(<tr><td colSpan={8} style={{textAlign:"center",padding:48,color:"#9ca3af",fontSize:13}}>No citizens found</td></tr>)
                  :filtCitizens.map(c=>{
                    const vCount=c.violations?.length??0;
                    const pendC=c.violations?.filter(v=>v.status!=="Resolved").length??0;
                    return (
                      <tr key={c.id} className="row-hover" onClick={()=>setSelectedCitizen(c)} style={{borderBottom:`1px solid ${EM[50]}`,background:"#fff"}}>
                        <td style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:34,height:34,borderRadius:"50%",background:c.is_archived?"#f1f5f9":EM[100],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:c.is_archived?"#9ca3af":EM[700],flexShrink:0}}>{(c.full_name??"?").charAt(0).toUpperCase()}</div>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:c.is_archived?"#9ca3af":EM[900],textDecoration:c.is_archived?"line-through":"none"}}>{c.full_name??"—"}</div>
                              <div style={{fontSize:11,color:"#9ca3af"}}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#6b7280"}}><div style={{fontWeight:600,color:EM[700]}}>{c.purok??"—"}</div><div style={{color:"#9ca3af"}}>{c.address_street??""}</div></td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#6b7280"}}>{c.contact_number??"—"}</td>
                        <td style={{padding:"12px 16px"}}><span style={{fontSize:11,fontWeight:800,padding:"3px 9px",borderRadius:20,background:c.warning_count>=3?"#fef2f2":c.warning_count>0?"#fff7ed":EM[50],color:c.warning_count>=3?"#991b1b":c.warning_count>0?"#9a3412":EM[700]}}>{c.warning_count}</span></td>
                        <td style={{padding:"12px 16px"}}><span style={{fontSize:13,fontWeight:800,color:scoreColor(c.score??100)}}>{c.score??100}</span><span style={{fontSize:10,color:"#9ca3af"}}>/100</span></td>
                        <td style={{padding:"12px 16px"}}>
                          {vCount>0?(
                            <div style={{display:"flex",gap:5,alignItems:"center"}}>
                              <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:pendC>0?"#fef3c7":EM[50],color:pendC>0?"#92400e":EM[700]}}>{vCount} case{vCount!==1?"s":""}</span>
                              {pendC>0&&<span style={{width:6,height:6,borderRadius:"50%",background:"#f59e0b",animation:"pulse 2s infinite",display:"inline-block"}}/>}
                            </div>
                          ):<span style={{fontSize:11,color:"#d1d5db"}}>None</span>}
                        </td>
                        <td style={{padding:"12px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:c.is_archived?"#f1f5f9":EM[50],color:c.is_archived?"#6b7280":EM[700]}}>{c.is_archived?"Archived":"Active"}</span></td>
                        <td style={{padding:"12px 14px"}}><div style={{width:28,height:28,borderRadius:8,background:EM[50],display:"flex",alignItems:"center",justifyContent:"center"}}><Eye size={14} color={EM[600]}/></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── VIOLATIONS ── */}
          {activeTab==="violations"&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:540}}>
                <thead><tr style={{background:EM[50]}}>
                  {["Citizen","Type","Description","Status","Reported","Action"].map(h=>(
                    <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",borderBottom:`1px solid ${EM[100]}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtViolations.length===0?(<tr><td colSpan={6} style={{textAlign:"center",padding:48,color:"#9ca3af",fontSize:13}}>No violations found</td></tr>)
                  :filtViolations.map(v=>{
                    const sc=STATUS_CFG[v.status]??STATUS_CFG.Pending;
                    return (
                      <tr key={v.id} className="row-hover" style={{borderBottom:`1px solid ${EM[50]}`,background:"#fff"}}>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:EM[900]}}>{v.citizen_name}</td>
                        <td style={{padding:"12px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"#fef3c7",color:"#92400e"}}>{v.type.replace(/_/g," ")}</span></td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#6b7280",maxWidth:200}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.description??"—"}</div></td>
                        <td style={{padding:"12px 16px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:sc.dot}}/><span style={{fontSize:12,fontWeight:600,color:sc.text}}>{sc.label}</span></div></td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#9ca3af",whiteSpace:"nowrap"}}>{timeAgo(v.created_at)}</td>
                        <td style={{padding:"12px 16px"}}>
                          {v.status!=="Resolved"&&profile?(
                            <button onClick={async()=>{await supabase.from("violations").update({status:"Resolved",resolved_at:new Date().toISOString()}).eq("id",v.id);await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_RESOLVE_VIOLATION",target_id:v.id,reason:`Resolved by ${profile.full_name}`});fetchData();}} className="act-btn" style={{fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:8,background:EM[50],color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer"}}>
                              ✓ Resolve
                            </button>
                          ):<span style={{fontSize:11,color:EM[500]}}>✓ Done</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── REPORTS ── */}
          {activeTab==="reports"&&(
            <div style={{overflowX:"auto"}}>
              <div style={{padding:"10px 18px",borderBottom:`1px solid ${EM[100]}`,fontSize:12,color:EM[700],background:EM[50]}}>
                ℹ️ Reporter identities are visible to you as LGU admin. They are hidden from reported citizens.
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead><tr style={{background:EM[50]}}>
                  {["Reporter","Reported Citizen","Type","Status","Filed","Action"].map(h=>(
                    <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",borderBottom:`1px solid ${EM[100]}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtReports.length===0?(<tr><td colSpan={6} style={{textAlign:"center",padding:48,color:"#9ca3af",fontSize:13}}>No reports found</td></tr>)
                  :filtReports.map(r=>{
                    const sc=STATUS_CFG[r.status]??STATUS_CFG.Submitted;
                    return (
                      <tr key={r.id} className="row-hover" onClick={()=>setSelectedReport(r)} style={{borderBottom:`1px solid ${EM[50]}`,background:"#fff"}}>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:EM[700]}}>{r.reporter_name}</td>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:"#92400e"}}>{r.reported_name??"Unknown"}</td>
                        <td style={{padding:"12px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"#fef3c7",color:"#92400e"}}>{r.type.replace(/_/g," ")}</span></td>
                        <td style={{padding:"12px 16px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:sc.dot}}/><span style={{fontSize:12,fontWeight:600,color:sc.text}}>{sc.label}</span></div></td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#9ca3af",whiteSpace:"nowrap"}}>{timeAgo(r.created_at)}</td>
                        <td style={{padding:"12px 14px"}}><div style={{width:28,height:28,borderRadius:8,background:EM[50],display:"flex",alignItems:"center",justifyContent:"center"}}><Eye size={14} color={EM[600]}/></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SCHEDULES ── */}
          {activeTab==="schedules"&&(
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
              {schedules.length===0?(
                <div style={{textAlign:"center",padding:48}}>
                  <Calendar size={36} color={EM[200]} style={{margin:"0 auto 12px"}}/><p style={{color:"#9ca3af",fontSize:13}}>No schedules yet. Create the first one!</p>
                </div>
              ):schedules.map(s=>(
                <div key={s.id} style={{padding:"16px 18px",borderRadius:12,background:s.is_active?"#fff":EM[50],border:`1.5px solid ${s.is_active?EM[200]:EM[100]}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{width:48,height:48,borderRadius:12,background:s.is_active?EM[100]:"#f1f5f9",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{fontSize:11,fontWeight:800,color:s.is_active?EM[700]:"#9ca3af"}}>{s.day_of_week!==null?DAYS[s.day_of_week]:"One-off"}</div>
                    <div style={{fontSize:10,color:s.is_active?EM[600]:"#9ca3af"}}>{fmtTime(s.scheduled_time)}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:s.is_active?EM[900]:"#9ca3af"}}>{s.label}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                      {s.waste_types.map(t=><span key={t} style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:EM[50],color:EM[700]}}>{t}</span>)}
                    </div>
                    {s.notes&&<div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>{s.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:8,flexShrink:0}}>
                    <button onClick={()=>{setEditSchedule(s);setShowSchedule(true);}} style={{fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:8,background:EM[50],color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>toggleSchedule(s.id,s.is_active)} style={{fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:8,background:s.is_active?"#fff7ed":"#f0fdf4",color:s.is_active?"#d97706":EM[700],border:`1.5px solid ${s.is_active?"#fde68a":EM[200]}`,cursor:"pointer"}}>{s.is_active?"Pause":"Activate"}</button>
                    <button onClick={()=>deleteSchedule(s.id)} style={{fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:8,background:"#fef2f2",color:"#dc2626",border:"1.5px solid #fecaca",cursor:"pointer"}}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BROADCASTS ── */}
          {activeTab==="broadcasts"&&(
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
              {broadcasts.length===0?(
                <div style={{textAlign:"center",padding:48}}><Megaphone size={36} color={EM[200]} style={{margin:"0 auto 12px"}}/><p style={{color:"#9ca3af",fontSize:13}}>No broadcasts yet. Send your first one!</p></div>
              ):broadcasts.filter(b=>!b.expires_at||new Date(b.expires_at)>new Date()).filter(b=>(b.title+b.body).toLowerCase().includes(search.toLowerCase())).map(b=>{
                const bt = BROADCAST_TYPES.find(t=>t.id===b.type);
                return (
                  <div key={b.id} style={{padding:"16px 18px",borderRadius:12,background:"#fff",border:`1.5px solid ${EM[b.is_pinned?200:100]}`,display:"flex",gap:14,alignItems:"flex-start"}}>
                    <div style={{width:40,height:40,borderRadius:10,background:EM[50],display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{bt?.icon??"📢"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,fontWeight:700,color:EM[900]}}>{b.title}</span>
                        {b.is_pinned&&<span style={{fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20,background:EM[100],color:EM[700]}}>📌 Pinned</span>}
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:EM[50],color:EM[600]}}>{bt?.label??b.type}</span>
                        <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{timeAgo(b.created_at)}</span>
                      </div>
                      <p style={{fontSize:13,color:"#374151",margin:0,lineHeight:1.6}}>{b.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {activeTab==="overview"&&(
            <div style={{padding:22,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>
              {/* Compliance */}
              <div style={{background:EM[50],borderRadius:14,padding:20,border:`1px solid ${EM[100]}`}}>
                <div style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>RA 9003 Compliance</div>
                <div style={{fontSize:44,fontWeight:900,color:compliance>=80?EM[600]:compliance>=50?"#d97706":"#dc2626",fontFamily:"Georgia,serif",lineHeight:1}}>{compliance}%</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:5,marginBottom:12}}>of citizens have zero warnings</div>
                <div style={{height:8,borderRadius:4,background:"#e5e7eb"}}><div style={{height:"100%",width:`${compliance}%`,borderRadius:4,background:`linear-gradient(90deg,${EM[500]},${EM[400]})`,transition:"width .6s"}}/></div>
                <p style={{fontSize:12,color:EM[700],lineHeight:1.6,padding:"10px 12px",borderRadius:9,background:"#fff",border:`1px solid ${EM[100]}`,marginTop:12,marginBottom:0}}>Citizens with 3+ warnings may be escalated to proceedings under RA 9003 Sec. 49.</p>
              </div>
              {/* Violations */}
              <div style={{background:EM[50],borderRadius:14,padding:20,border:`1px solid ${EM[100]}`}}>
                <div style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Violation Breakdown</div>
                {[
                  {label:"Pending",      val:violations.filter(v=>v.status==="Pending").length,      color:"#f59e0b"},
                  {label:"Under Review", val:violations.filter(v=>v.status==="Under Review").length,  color:"#3b82f6"},
                  {label:"Resolved",     val:violations.filter(v=>v.status==="Resolved").length,      color:EM[600]},
                ].map(s=>(
                  <div key={s.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${EM[100]}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:s.color}}/><span style={{fontSize:13,color:"#374151"}}>{s.label}</span></div>
                    <span style={{fontSize:17,fontWeight:900,color:s.color,fontFamily:"Georgia,serif"}}>{s.val}</span>
                  </div>
                ))}
              </div>
              {/* Score distribution */}
              <div style={{background:EM[50],borderRadius:14,padding:20,border:`1px solid ${EM[100]}`}}>
                <div style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Citizen Score Distribution</div>
                {[
                  {label:"Excellent (90-100)",val:citizens.filter(c=>(c.score??100)>=90).length,   color:EM[600]},
                  {label:"Good (70-89)",       val:citizens.filter(c=>(c.score??100)>=70&&(c.score??100)<90).length,color:"#059669"},
                  {label:"Fair (50-69)",        val:citizens.filter(c=>(c.score??100)>=50&&(c.score??100)<70).length,color:"#d97706"},
                  {label:"Poor (< 50)",         val:citizens.filter(c=>(c.score??100)<50).length,   color:"#dc2626"},
                ].map(s=>(
                  <div key={s.label} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:"#374151"}}>{s.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.val}</span>
                    </div>
                    <div style={{height:5,borderRadius:3,background:"#e5e7eb"}}>
                      <div style={{height:"100%",width:citizens.length>0?`${(s.val/citizens.length)*100}%`:"0%",borderRadius:3,background:s.color,transition:"width .6s"}}/>
                    </div>
                  </div>
                ))}
              </div>
              {/* Roadmap */}
              <div style={{background:"#fffbeb",borderRadius:14,padding:20,border:"1px solid #fde68a"}}>
                <div style={{fontSize:11,fontWeight:800,color:"#92400e",letterSpacing:".1em",textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:7}}><Lightbulb size={13} color="#d97706"/>Next Steps</div>
                {[
                  {icon:"🔔",title:"Push Notifications",  desc:"Set up VAPID keys + service worker to deliver browser push for all in-app notifications."},
                  {icon:"📊",title:"Purok Analytics",      desc:"Track waste generation per purok. Identify high-waste zones for targeted campaigns."},
                  {icon:"🏆",title:"Citizen Leaderboard",  desc:"Show top 10 compliant citizens per month (by score). Gamify RA 9003 compliance."},
                  {icon:"📅",title:"Schedule Reminders",   desc:"Edge Function cron: send COLLECTION_REMINDER notification to assigned driver 30 min before schedule."},
                ].map(f=>(
                  <div key={f.title} style={{display:"flex",gap:10,marginBottom:11}}>
                    <span style={{fontSize:17,flexShrink:0}}>{f.icon}</span>
                    <div><div style={{fontSize:12,fontWeight:700,color:"#78350f",marginBottom:2}}>{f.title}</div><p style={{fontSize:11,color:"#92400e",margin:0,lineHeight:1.5}}>{f.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RA 9003 footer */}
        <div style={{marginTop:20,padding:"16px 20px",borderRadius:14,background:`linear-gradient(135deg,${EM[800]},${EM[900]})`,border:`1px solid ${EM[700]}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",animation:"fadeUp .5s ease .3s both"}}>
          <FileText size={20} color={EM[200]} style={{flexShrink:0}}/>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:12,fontWeight:700,color:EM[200],marginBottom:2}}>RA 9003 — Ecological Solid Waste Management Act of 2000</div>
            <p style={{fontSize:12,color:"rgba(167,243,208,.75)",margin:0,lineHeight:1.55}}>You are responsible for enforcing waste segregation and collection schedules in Barangay {profile?.barangay}. Citizens with 3+ warnings may be escalated to proceedings.</p>
          </div>
          <div style={{textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:24,fontWeight:900,color:EM[300],fontFamily:"Georgia,serif"}}>{compliance}%</div>
            <div style={{fontSize:10,color:"rgba(167,243,208,.6)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Compliant</div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {freshC&&profile&&<CitizenDetailModal citizen={freshC} profile={profile} onClose={()=>setSelectedCitizen(null)} onRefresh={fetchData}/>}
      {showBroadcast&&profile&&<BroadcastModal profile={profile} citizenCount={citizens.filter(c=>!c.is_archived).length} onClose={()=>setShowBroadcast(false)} onSent={fetchData}/>}
      {showSchedule&&profile&&<ScheduleModal profile={profile} schedule={editSchedule} onClose={()=>{setShowSchedule(false);setEditSchedule(undefined);}} onRefresh={fetchData}/>}
      {selectedReport&&profile&&<ReportModal report={selectedReport} profile={profile} onClose={()=>setSelectedReport(null)} onRefresh={fetchData}/>}
    </div>
  );
}