"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/lgu/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Users, AlertTriangle, CheckCircle, Trash2, Search,
  LogOut, Bell, FileText, MapPin, RefreshCw, ShieldAlert,
  Menu, X, Eye, Archive, ArchiveRestore,
  Send, Megaphone, Info, Lightbulb, UserCheck,
} from "lucide-react";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LGUProfile {
  id: string; full_name: string; email: string;
  barangay: string; municipality: string; position_title: string;
}
interface Citizen {
  id: string; full_name: string; email: string;
  contact_number: string; warning_count: number;
  is_archived: boolean; purok: string;
  address_street: string; created_at: string;
  house_lot_number?: string; service_type?: string;
  violations?: Violation[];
}
interface Violation {
  id: string; citizen_id: string; citizen_name?: string;
  type: string; description: string;
  status: "Pending" | "Under Review" | "Resolved";
  created_at: string; resolved_at: string | null;
}
interface Notif {
  id: string; type: "new_citizen" | "new_violation" | "info";
  title: string; body: string; created_at: string; read: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EM = {
  900:"#064e3b",800:"#065f46",700:"#047857",600:"#059669",
  500:"#10b981",400:"#34d399",300:"#6ee7b7",200:"#a7f3d0",
  100:"#d1fae5",50:"#ecfdf5",
};

const VIOLATION_TYPES = [
  "Improper Disposal","Open Burning","Littering",
  "Illegal Dumping","Mixed Waste","Overflowing Bin",
];

const STATUS_CFG = {
  Pending:       {dot:"#f59e0b",text:"#92400e",bg:"#fef3c7",label:"Pending"},
  "Under Review":{dot:"#3b82f6",text:"#1e40af",bg:"#eff6ff",label:"Under Review"},
  Resolved:      {dot:EM[600],  text:EM[800],  bg:EM[50],   label:"Resolved"},
};

const BROADCAST_TEMPLATES = [
  {id:"b1",icon:"🌿",title:"Segregation Reminder",     body:"Please separate biodegradable and non-biodegradable waste before Tuesday's collection."},
  {id:"b2",icon:"📅",title:"Collection Schedule Change",body:"Due to the upcoming holiday, collection in your area is moved to Wednesday."},
  {id:"b3",icon:"⚠️",title:"Littering Warning",        body:"Multiple littering incidents have been reported. Violators may be fined under RA 9003."},
  {id:"b4",icon:"♻️",title:"Composting Workshop",      body:"Join us this Saturday 9AM at the Barangay Hall for a free composting seminar."},
];

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

const INP: React.CSSProperties = {
  padding:"9px 12px",borderRadius:9,border:`1.5px solid ${EM[200]}`,
  background:EM[50],color:EM[900],fontSize:13,outline:"none",
  fontFamily:"sans-serif",width:"100%",boxSizing:"border-box",
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function Modal({onClose,children,wide=false}:{onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(6,78,59,.15)",backdropFilter:"blur(4px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,border:`1.5px solid ${EM[200]}`,width:"100%",maxWidth:wide?760:480,boxShadow:`0 24px 80px rgba(6,78,59,.15)`,animation:"modalIn .2s ease both",maxHeight:"90vh",overflowY:"auto"}}>
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
const BtnPrimary = ({onClick,disabled,children}:{onClick:()=>void;disabled?:boolean;children:React.ReactNode}) => (
  <button onClick={onClick} disabled={disabled} style={{padding:"8px 20px",borderRadius:9,background:EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1,display:"flex",alignItems:"center",gap:7}}>{children}</button>
);

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// CITIZEN DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CitizenDetailModal({citizen,profile,onClose,onRefresh}:{citizen:Citizen;profile:LGUProfile;onClose:()=>void;onRefresh:()=>void}) {
  const [showWarn,     setShowWarn]     = useState(false);
  const [showRevoke,   setShowRevoke]   = useState(false);
  const [resolvingId,  setResolvingId]  = useState<string|null>(null);
  const [archiving,    setArchiving]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [warnNote,     setWarnNote]     = useState("");
  const [warnType,     setWarnType]     = useState(VIOLATION_TYPES[0]);
  const [successMsg,   setSuccessMsg]   = useState("");

  const violations = citizen.violations ?? [];
  const openV = violations.filter(v=>v.status!=="Resolved").length;

  const flash = (msg:string) => { setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(""),3500); };

  const issueWarning = async () => {
    setSaving(true);
    await supabase.from("profiles").update({warning_count:citizen.warning_count+1}).eq("id",citizen.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_ISSUE_WARNING",target_id:citizen.id,reason:`Warning issued by ${profile.full_name} — ${warnNote||"No note"}`,metadata:{type:warnType,note:warnNote,barangay:profile.barangay}});
    flash("Warning issued successfully."); setShowWarn(false); setWarnNote(""); setSaving(false); onRefresh();
  };

  const revokeWarning = async () => {
    if (citizen.warning_count<=0) return;
    setSaving(true);
    await supabase.from("profiles").update({warning_count:citizen.warning_count-1}).eq("id",citizen.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_REVOKE_WARNING",target_id:citizen.id,reason:`Warning revoked by ${profile.full_name}`});
    flash("Warning revoked."); setShowRevoke(false); setSaving(false); onRefresh();
  };

  const resolveV = async (id:string) => {
    setResolvingId(id);
    await supabase.from("violations").update({status:"Resolved",resolved_at:new Date().toISOString()}).eq("id",id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:"LGU_RESOLVE_VIOLATION",target_id:id,reason:`Resolved by ${profile.full_name} in Barangay ${profile.barangay}`});
    flash("Violation resolved."); setResolvingId(null); onRefresh();
  };

  const toggleArchive = async () => {
    setArchiving(true);
    await supabase.from("profiles").update({is_archived:!citizen.is_archived}).eq("id",citizen.id);
    await supabase.from("audit_logs").insert({admin_id:profile.id,action_type:citizen.is_archived?"LGU_RESTORE_CITIZEN":"LGU_ARCHIVE_CITIZEN",target_id:citizen.id,reason:`${citizen.is_archived?"Restored":"Archived"} by ${profile.full_name}`});
    setArchiving(false); onRefresh(); onClose();
  };

  return (
    <>
      <Modal onClose={onClose} wide>
        <MHead title={citizen.full_name??"Citizen"} sub={`${citizen.email} · Joined ${fmtDate(citizen.created_at)}`} icon={Users} onClose={onClose}/>

        <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:20}}>
          {successMsg && (
            <div style={{padding:"10px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",alignItems:"center",gap:8}}>
              <CheckCircle size={15} color={EM[600]}/><span style={{fontSize:13,color:EM[800],fontWeight:600}}>{successMsg}</span>
            </div>
          )}

          {/* Info grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            {[
              {label:"Purok",       value:citizen.purok??"—"},
              {label:"Street",      value:citizen.address_street??"—"},
              {label:"Lot / House", value:citizen.house_lot_number??"—"},
              {label:"Contact",     value:citizen.contact_number??"—"},
              {label:"Service",     value:citizen.service_type??"General"},
              {label:"Account",     value:citizen.is_archived?"Archived":"Active"},
            ].map(f=>(
              <div key={f.label} style={{background:EM[50],borderRadius:10,padding:"11px 14px",border:`1px solid ${EM[100]}`}}>
                <div style={{fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{f.label}</div>
                <div style={{fontSize:13,fontWeight:600,color:EM[900]}}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* Warning bar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderRadius:12,background:citizen.warning_count>=3?"#fef2f2":EM[50],border:`1.5px solid ${citizen.warning_count>=3?"#fecaca":EM[200]}`,flexWrap:"wrap",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <ShieldAlert size={20} color={citizen.warning_count>=3?"#dc2626":EM[600]}/>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:citizen.warning_count>=3?"#991b1b":EM[900]}}>{citizen.warning_count} Active Warning{citizen.warning_count!==1?"s":""}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{citizen.warning_count>=3?"⚠️ Eligible for barangay proceedings under RA 9003":"3 warnings triggers formal proceedings"}</div>
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
              <div style={{padding:20,textAlign:"center",background:EM[50],borderRadius:10,border:`1px solid ${EM[100]}`}}>
                <CheckCircle size={22} color={EM[400]} style={{margin:"0 auto 8px"}}/><p style={{fontSize:13,color:EM[700],margin:0}}>No violations recorded</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {violations.map(v=>{
                  const sc = STATUS_CFG[v.status]??STATUS_CFG.Pending;
                  return (
                    <div key={v.id} style={{padding:"12px 14px",borderRadius:10,background:"#fff",border:`1.5px solid ${EM[100]}`,display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:sc.dot,marginTop:5,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:800,color:EM[900]}}>{v.type.replace(/_/g," ")}</span>
                          <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.text}}>{sc.label}</span>
                          <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{timeAgo(v.created_at)}</span>
                        </div>
                        <p style={{fontSize:12,color:"#6b7280",margin:0,lineHeight:1.5}}>{v.description??"No description"}</p>
                        {v.resolved_at&&<div style={{fontSize:11,color:EM[600],marginTop:4}}>Resolved: {fmtDate(v.resolved_at)}</div>}
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
            )}
          </div>

          {/* Coming soon note */}
          <div style={{padding:"11px 15px",borderRadius:10,background:"#fffbeb",border:"1px solid #fde68a",display:"flex",gap:9,alignItems:"flex-start"}}>
            <Lightbulb size={14} color="#d97706" style={{flexShrink:0,marginTop:1}}/>
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"#92400e",marginBottom:2}}>Coming Soon: Direct Notice</div>
              <p style={{fontSize:11,color:"#78350f",margin:0,lineHeight:1.5}}>Warning notices will be sent directly to the citizen's account with violation details. Reporter identity shown only to you as LGU admin.</p>
            </div>
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
            <div style={{padding:"9px 13px",borderRadius:9,background:"#fffbeb",border:"1px solid #fde68a",fontSize:12,color:"#78350f"}}>⚠️ Logged in audit trail. Citizen notification coming soon.</div>
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
          <MFooter><BtnCancel onClick={()=>setShowRevoke(false)}/><button onClick={revokeWarning} disabled={saving} style={{padding:"8px 20px",borderRadius:9,background:"#dc2626",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"Revoking…":"Revoke Warning"}</button></MFooter>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST MODAL
// ─────────────────────────────────────────────────────────────────────────────

function BroadcastModal({profile,citizenCount,onClose}:{profile:LGUProfile;citizenCount:number;onClose:()=>void}) {
  const [subject,setSubject]=useState("");
  const [body,   setBody]   =useState("");
  const [picked, setPicked] =useState<string|null>(null);
  const [sent,   setSent]   =useState(false);

  return (
    <Modal onClose={onClose} wide>
      <MHead title="Broadcast to Citizens" sub={`Barangay ${profile.barangay} · ${citizenCount} recipients`} icon={Megaphone} onClose={onClose}/>
      <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:16}}>
        {/* Templates */}
        <div>
          <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Quick Templates</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {BROADCAST_TEMPLATES.map(s=>(
              <button key={s.id} onClick={()=>{setPicked(s.id);setSubject(s.title);setBody(s.body);}} style={{padding:"10px 12px",borderRadius:9,textAlign:"left",cursor:"pointer",border:`1.5px solid ${picked===s.id?EM[400]:EM[100]}`,background:picked===s.id?EM[50]:"#fff"}}>
                <div style={{fontSize:13}}>{s.icon} <span style={{fontWeight:700,color:EM[900]}}>{s.title}</span></div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.body}</div>
              </button>
            ))}
          </div>
        </div>
        {/* Compose */}
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Subject</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Segregation Reminder" style={INP}/>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Message</label>
          <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Type your message…" rows={4} style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>
        {sent
          ? <div style={{padding:"11px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={15} color={EM[600]}/><span style={{fontSize:13,color:EM[800],fontWeight:600}}>Broadcast queued! (Mock — not yet sent)</span></div>
          : <div style={{padding:"9px 13px",borderRadius:9,background:"#fffbeb",border:"1px solid #fde68a",fontSize:11,color:"#78350f"}}>🚧 <strong>Future feature:</strong> Delivered via push notification + in-app to all {citizenCount} citizens. Production: Supabase Edge Functions + Web Push (FCM/APNs) + per-user <code>notifications</code> table.</div>
        }
      </div>
      <MFooter>
        <BtnCancel onClick={onClose}/>
        <BtnPrimary onClick={()=>setSent(true)} disabled={!subject||!body||sent}><Send size={14}/> Send Broadcast</BtnPrimary>
      </MFooter>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PANEL
// ─────────────────────────────────────────────────────────────────────────────

function NotifPanel({notifs,onRead,onClose}:{notifs:Notif[];onRead:(id:string)=>void;onClose:()=>void}) {
  const unread=notifs.filter(n=>!n.read).length;
  return (
    <div style={{position:"absolute",top:"calc(100% + 10px)",right:0,width:330,background:"#fff",borderRadius:16,border:`1.5px solid ${EM[100]}`,boxShadow:`0 20px 60px rgba(6,78,59,.15)`,zIndex:300,animation:"dropIn .18s ease both",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:`1px solid ${EM[100]}`,background:EM[50]}}>
        <div style={{fontSize:14,fontWeight:800,color:EM[900]}}>Notifications {unread>0&&<span style={{fontSize:10,fontWeight:800,marginLeft:5,background:"#ef4444",color:"#fff",padding:"1px 7px",borderRadius:20}}>{unread}</span>}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}><X size={14} color={EM[700]}/></button>
      </div>
      <div style={{maxHeight:340,overflowY:"auto"}}>
        {notifs.length===0 ? (
          <div style={{padding:32,textAlign:"center",color:"#9ca3af",fontSize:13}}>No notifications yet</div>
        ) : notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)} style={{padding:"12px 16px",borderBottom:`1px solid ${EM[50]}`,background:n.read?"#fff":EM[50],cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:n.type==="new_violation"?"#fef3c7":n.type==="new_citizen"?EM[100]:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {n.type==="new_violation"?<AlertTriangle size={13} color="#d97706"/>:n.type==="new_citizen"?<UserCheck size={13} color={EM[600]}/>:<Info size={13} color="#3b82f6"/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:n.read?500:700,color:EM[900]}}>{n.title}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.4}}>{n.body}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:3}}>{timeAgo(n.created_at)}</div>
            </div>
            {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:EM[500],flexShrink:0,marginTop:5}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();

  const [profile,        setProfile]        = useState<LGUProfile|null>(null);
  const [citizens,       setCitizens]       = useState<Citizen[]>([]);
  const [violations,     setViolations]     = useState<Violation[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState<"citizens"|"violations"|"overview">("citizens");
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [citizenFilter,  setCitizenFilter]  = useState("all");
  const [selectedCitizen,setSelectedCitizen]= useState<Citizen|null>(null);
  const [showBroadcast,  setShowBroadcast]  = useState(false);
  const [mobileMenu,     setMobileMenu]     = useState(false);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const [notifs,         setNotifs]         = useState<Notif[]>([]);
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

    const {data:cDetails}=await supabase.from("citizen_details").select("id,purok,address_street,house_lot_number,service_type,created_at").eq("barangay",me.barangay);
    if (cDetails&&cDetails.length>0) {
      const ids=cDetails.map((c:any)=>c.id);
      const {data:profiles}=await supabase.from("profiles").select("id,full_name,email,contact_number,warning_count,is_archived").in("id",ids).eq("role","CITIZEN");
      const {data:cv}=await supabase.from("violations").select("*").in("citizen_id",ids).order("created_at",{ascending:false});
      const vMap:Record<string,Violation[]>={};
      (cv??[]).forEach((v:any)=>{if(!vMap[v.citizen_id])vMap[v.citizen_id]=[];vMap[v.citizen_id].push(v);});
      setCitizens((profiles??[]).map((p:any)=>{const d=cDetails.find((x:any)=>x.id===p.id);return{...p,...d,violations:vMap[p.id]??[]};}));
    } else setCitizens([]);

    const {data:vData}=await supabase.from("violations").select("*,profiles(full_name)").eq("barangay",me.barangay).order("created_at",{ascending:false});
    setViolations((vData??[]).map((v:any)=>({...v,citizen_name:v.profiles?.full_name??"Unknown"})));
    setLoading(false);
  },[router]);

  useEffect(()=>{fetchData();},[fetchData]);

  // Realtime subscriptions
  useEffect(()=>{
    if (!profile?.barangay) return;
    const addN=(n:Omit<Notif,"id"|"read">)=>setNotifs(p=>[{...n,id:crypto.randomUUID(),read:false},...p].slice(0,30));

    const ch1=supabase.channel("lgu-citizens").on("postgres_changes",{event:"INSERT",schema:"public",table:"citizen_details",filter:`barangay=eq.${profile.barangay}`},()=>{
      addN({type:"new_citizen",title:"New Citizen Registered",body:`A new resident has registered under Barangay ${profile.barangay}.`,created_at:new Date().toISOString()});
      fetchData();
    }).subscribe();

    const ch2=supabase.channel("lgu-violations").on("postgres_changes",{event:"INSERT",schema:"public",table:"violations",filter:`barangay=eq.${profile.barangay}`},(payload:any)=>{
      addN({type:"new_violation",title:"New Violation Reported",body:`A violation (${payload.new?.type?.replace(/_/g," ")??"unknown"}) was reported in your barangay.`,created_at:new Date().toISOString()});
      fetchData();
    }).subscribe();

    return ()=>{supabase.removeChannel(ch1);supabase.removeChannel(ch2);};
  },[profile?.barangay,fetchData]);

  const readN=(id:string)=>setNotifs(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const unreadC=notifs.filter(n=>!n.read).length;
  const freshC=selectedCitizen?citizens.find(c=>c.id===selectedCitizen.id)??selectedCitizen:null;

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

  const pendingV=violations.filter(v=>v.status==="Pending").length;
  const activeW=citizens.filter(c=>c.warning_count>0).length;
  const resolvedToday=violations.filter(v=>v.resolved_at&&new Date(v.resolved_at).toDateString()===new Date().toDateString()).length;
  const compliance=citizens.length>0?Math.round((citizens.filter(c=>c.warning_count===0).length/citizens.length)*100):100;

  if (loading) return (
    <div style={{minHeight:"100vh",background:EM[50],display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:44,height:44,borderRadius:"50%",border:`3px solid ${EM[200]}`,borderTopColor:EM[600],animation:"spin 1s linear infinite",margin:"0 auto 14px"}}/>
        <p style={{fontSize:11,fontWeight:700,color:EM[700],letterSpacing:".1em",textTransform:"uppercase"}}>Loading dashboard…</p>
      </div>
    </div>
  );

  const TABS=[{id:"citizens",label:"Citizens",count:citizens.length},{id:"violations",label:"Violations",count:violations.length},{id:"overview",label:"Overview",count:null}];

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
        input::placeholder{color:#9ca3af;}
        select option{color:${EM[900]};background:#fff;}
        @media(max-width:640px){
          .nav-desktop{display:none!important;}
          .nav-ham{display:flex!important;}
          .d-only{display:none!important;}
          .sgrid{grid-template-columns:repeat(2,1fr)!important;}
        }
        @media(min-width:641px){.nav-ham{display:none!important;}}
      `}</style>

      {/* NAVBAR */}
      <nav style={{background:"#fff",borderBottom:`1.5px solid ${EM[100]}`,padding:"0 20px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 12px rgba(6,78,59,.07)"}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${EM[600]},${EM[800]})`,display:"flex",alignItems:"center",justifyContent:"center"}}><MapPin size={18} color="#fff"/></div>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:EM[900],lineHeight:1,letterSpacing:"-.01em"}}>EcoRoute LGU</div>
            <div style={{fontSize:10,color:EM[600],letterSpacing:".06em",textTransform:"uppercase"}}>{profile?.barangay} · {profile?.municipality}</div>
          </div>
        </div>

        {/* Desktop center tabs */}
        <div className="nav-desktop" style={{display:"flex",gap:2}}>
          {TABS.map(t=>(
            <button key={t.id} className="tab-pill" onClick={()=>{setActiveTab(t.id as any);setSearch("");}} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",border:"none",background:activeTab===t.id?EM[100]:"transparent",fontWeight:activeTab===t.id?700:500,color:activeTab===t.id?EM[800]:"#6b7280",fontSize:13}}>
              {t.label}
              {t.count!==null&&<span style={{fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20,background:activeTab===t.id?EM[200]:"#f1f5f9",color:activeTab===t.id?EM[800]:"#9ca3af"}}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Right */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setShowBroadcast(true)} className="act-btn d-only" style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:10,background:EM[50],color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer"}}>
            <Megaphone size={14}/> Broadcast
          </button>

          {/* Bell */}
          <div ref={notifRef} style={{position:"relative"}}>
            <button onClick={()=>setNotifOpen(o=>!o)} style={{width:38,height:38,borderRadius:11,background:notifOpen?EM[50]:"#fff",border:`1.5px solid ${notifOpen?EM[300]:EM[100]}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}>
              <Bell size={17} color={notifOpen?EM[600]:"#6b7280"}/>
              {unreadC>0&&<span style={{position:"absolute",top:-3,right:-3,width:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>{unreadC>9?"9+":unreadC}</span>}
            </button>
            {notifOpen&&<NotifPanel notifs={notifs} onRead={readN} onClose={()=>setNotifOpen(false)}/>}
          </div>

          {/* Avatar */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg,${EM[400]},${EM[600]})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>
              {(profile?.full_name??"L").charAt(0)}
            </div>
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

      {/* Mobile menu */}
      {mobileMenu&&(
        <div style={{background:"#fff",borderBottom:`1px solid ${EM[100]}`,padding:"10px 20px 16px",display:"flex",flexDirection:"column",gap:4}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setActiveTab(t.id as any);setMobileMenu(false);setSearch("");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",borderRadius:10,border:"none",background:activeTab===t.id?EM[50]:"transparent",color:activeTab===t.id?EM[800]:"#374151",fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"left"}}>
              {t.label}
              {t.count!==null&&<span style={{fontSize:11,fontWeight:700,padding:"1px 9px",borderRadius:20,background:EM[100],color:EM[700]}}>{t.count}</span>}
            </button>
          ))}
          <button onClick={()=>{setShowBroadcast(true);setMobileMenu(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderRadius:10,border:"none",background:"transparent",color:"#374151",fontSize:14,fontWeight:600,cursor:"pointer"}}>
            <Megaphone size={16} color={EM[600]}/> Broadcast to Citizens
          </button>
        </div>
      )}

      {/* MAIN */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"24px 20px"}}>

        {/* Title */}
        <div style={{marginBottom:24,animation:"fadeUp .4s ease both"}}>
          <h1 style={{fontSize:"clamp(20px,5vw,28px)",fontWeight:900,color:EM[900],margin:0,letterSpacing:"-.02em",fontFamily:"Georgia,serif"}}>Barangay {profile?.barangay}</h1>
          <p style={{fontSize:13,color:EM[700],margin:"3px 0 0"}}>{profile?.municipality} · {profile?.position_title} · {citizens.length} registered citizens</p>
        </div>

        {/* Stats */}
        <div className="sgrid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginBottom:24}}>
          <StatCard icon={Users}       label="Total Citizens" value={citizens.length} sub={`${citizens.filter(c=>!c.is_archived).length} active`} accent={EM[600]} delay={0}/>
          <StatCard icon={AlertTriangle}label="Pending Reports"value={pendingV} sub="Need review" accent="#d97706" delay={.05} warn={pendingV>0}/>
          <StatCard icon={ShieldAlert}  label="Active Warnings" value={activeW} sub="Citizens warned" accent="#dc2626" delay={.1} warn={activeW>0}/>
          <StatCard icon={CheckCircle}  label="Resolved Today"  value={resolvedToday} sub="Cases closed" accent={EM[600]} delay={.15}/>
        </div>

        {/* Panel */}
        <div style={{background:"#fff",borderRadius:18,border:`1.5px solid ${EM[100]}`,boxShadow:"0 4px 24px rgba(6,78,59,.07)",overflow:"hidden",animation:"fadeUp .5s ease .2s both"}}>

          {/* Tab bar + toolbar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px",borderBottom:`1px solid ${EM[100]}`,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",gap:0}}>
              {TABS.map(t=>(
                <button key={t.id} className="tab-pill" onClick={()=>{setActiveTab(t.id as any);setSearch("");setStatusFilter("all");}} style={{display:"flex",alignItems:"center",gap:7,padding:"15px 16px",border:"none",background:"transparent",fontWeight:activeTab===t.id?700:500,color:activeTab===t.id?EM[700]:"#6b7280",fontSize:13,borderBottom:activeTab===t.id?`2.5px solid ${EM[600]}`:"2.5px solid transparent"}}>
                  {t.label}
                  {t.count!==null&&<span style={{fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20,background:activeTab===t.id?EM[100]:"#f1f5f9",color:activeTab===t.id?EM[700]:"#9ca3af"}}>{t.count}</span>}
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",flexWrap:"wrap"}}>
              {activeTab==="violations"&&(
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{fontSize:12,padding:"7px 10px",border:`1.5px solid ${EM[100]}`,borderRadius:9,background:EM[50],color:EM[800],outline:"none",cursor:"pointer"}}>
                  <option value="all">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Resolved">Resolved</option>
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
              <div style={{position:"relative"}}>
                <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}/>
                <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:30,paddingRight:10,paddingTop:7,paddingBottom:7,border:`1.5px solid ${EM[100]}`,borderRadius:9,fontSize:12,color:EM[900],outline:"none",width:160,background:EM[50]}}/>
              </div>
              <button onClick={fetchData} className="act-btn" style={{padding:"7px 9px",border:`1.5px solid ${EM[100]}`,borderRadius:9,background:EM[50],cursor:"pointer"}}><RefreshCw size={13} color={EM[600]}/></button>
            </div>
          </div>

          {/* CITIZENS TAB */}
          {activeTab==="citizens"&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
                <thead>
                  <tr style={{background:EM[50]}}>
                    {["Citizen","Location","Contact","Warnings","Violations","Status",""].map(h=>(
                      <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",borderBottom:`1px solid ${EM[100]}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtCitizens.length===0?(
                    <tr><td colSpan={7} style={{textAlign:"center",padding:48,color:"#9ca3af",fontSize:13}}>No citizens found</td></tr>
                  ):filtCitizens.map(c=>{
                    const vCount=c.violations?.length??0;
                    const pendC=c.violations?.filter(v=>v.status!=="Resolved").length??0;
                    return (
                      <tr key={c.id} className="row-hover" onClick={()=>setSelectedCitizen(c)} style={{borderBottom:`1px solid ${EM[50]}`,background:"#fff"}}>
                        <td style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:34,height:34,borderRadius:"50%",background:c.is_archived?"#f1f5f9":EM[100],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:c.is_archived?"#9ca3af":EM[700],flexShrink:0}}>
                              {(c.full_name??"?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:c.is_archived?"#9ca3af":EM[900],textDecoration:c.is_archived?"line-through":"none"}}>{c.full_name??"—"}</div>
                              <div style={{fontSize:11,color:"#9ca3af"}}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#6b7280"}}>
                          <div style={{fontWeight:600,color:EM[700]}}>{c.purok??"—"}</div>
                          <div style={{color:"#9ca3af"}}>{c.address_street??""}</div>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#6b7280"}}>{c.contact_number??"—"}</td>
                        <td style={{padding:"12px 16px"}}>
                          <span style={{fontSize:11,fontWeight:800,padding:"3px 9px",borderRadius:20,background:c.warning_count>=3?"#fef2f2":c.warning_count>0?"#fff7ed":EM[50],color:c.warning_count>=3?"#991b1b":c.warning_count>0?"#9a3412":EM[700]}}>{c.warning_count}</span>
                        </td>
                        <td style={{padding:"12px 16px"}}>
                          {vCount>0?(
                            <div style={{display:"flex",gap:5,alignItems:"center"}}>
                              <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:pendC>0?"#fef3c7":EM[50],color:pendC>0?"#92400e":EM[700]}}>{vCount} case{vCount!==1?"s":""}</span>
                              {pendC>0&&<span style={{width:6,height:6,borderRadius:"50%",background:"#f59e0b",animation:"pulse 2s infinite",display:"inline-block"}}/>}
                            </div>
                          ):<span style={{fontSize:11,color:"#d1d5db"}}>None</span>}
                        </td>
                        <td style={{padding:"12px 16px"}}>
                          <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:c.is_archived?"#f1f5f9":EM[50],color:c.is_archived?"#6b7280":EM[700]}}>{c.is_archived?"Archived":"Active"}</span>
                        </td>
                        <td style={{padding:"12px 14px"}}>
                          <div style={{width:28,height:28,borderRadius:8,background:EM[50],display:"flex",alignItems:"center",justifyContent:"center"}}><Eye size={14} color={EM[600]}/></div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIOLATIONS TAB */}
          {activeTab==="violations"&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:540}}>
                <thead>
                  <tr style={{background:EM[50]}}>
                    {["Citizen","Type","Description","Status","Reported","Action"].map(h=>(
                      <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",borderBottom:`1px solid ${EM[100]}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtViolations.length===0?(
                    <tr><td colSpan={6} style={{textAlign:"center",padding:48,color:"#9ca3af",fontSize:13}}>No violations found</td></tr>
                  ):filtViolations.map(v=>{
                    const sc=STATUS_CFG[v.status]??STATUS_CFG.Pending;
                    return (
                      <tr key={v.id} className="row-hover" style={{borderBottom:`1px solid ${EM[50]}`,background:"#fff"}}>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:EM[900]}}>{v.citizen_name}</td>
                        <td style={{padding:"12px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"#fef3c7",color:"#92400e"}}>{v.type.replace(/_/g," ")}</span></td>
                        <td style={{padding:"12px 16px",fontSize:12,color:"#6b7280",maxWidth:200}}>
                          <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.description??"—"}</div>
                        </td>
                        <td style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:7,height:7,borderRadius:"50%",background:sc.dot}}/>
                            <span style={{fontSize:12,fontWeight:600,color:sc.text}}>{sc.label}</span>
                          </div>
                        </td>
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

          {/* OVERVIEW TAB */}
          {activeTab==="overview"&&(
            <div style={{padding:22,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>

              {/* Compliance */}
              <div style={{background:EM[50],borderRadius:14,padding:20,border:`1px solid ${EM[100]}`}}>
                <div style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>RA 9003 Compliance</div>
                <div style={{fontSize:44,fontWeight:900,color:compliance>=80?EM[600]:compliance>=50?"#d97706":"#dc2626",fontFamily:"Georgia,serif",lineHeight:1}}>{compliance}%</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:5,marginBottom:12}}>of citizens have zero warnings</div>
                <div style={{height:8,borderRadius:4,background:"#e5e7eb"}}>
                  <div style={{height:"100%",width:`${compliance}%`,borderRadius:4,background:`linear-gradient(90deg,${EM[500]},${EM[400]})`,transition:"width .6s"}}/>
                </div>
                <p style={{fontSize:12,color:EM[700],lineHeight:1.6,padding:"10px 12px",borderRadius:9,background:"#fff",border:`1px solid ${EM[100]}`,marginTop:12,marginBottom:0}}>
                  Citizens with 3+ warnings may be escalated to barangay proceedings under RA 9003 Sec. 49.
                </p>
              </div>

              {/* Violation breakdown */}
              <div style={{background:EM[50],borderRadius:14,padding:20,border:`1px solid ${EM[100]}`}}>
                <div style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Violation Breakdown</div>
                {[
                  {label:"Pending",      val:violations.filter(v=>v.status==="Pending").length,      color:"#f59e0b"},
                  {label:"Under Review", val:violations.filter(v=>v.status==="Under Review").length,  color:"#3b82f6"},
                  {label:"Resolved",     val:violations.filter(v=>v.status==="Resolved").length,      color:EM[600]},
                ].map(s=>(
                  <div key={s.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${EM[100]}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:s.color}}/>
                      <span style={{fontSize:13,color:"#374151"}}>{s.label}</span>
                    </div>
                    <span style={{fontSize:17,fontWeight:900,color:s.color,fontFamily:"Georgia,serif"}}>{s.val}</span>
                  </div>
                ))}
              </div>

              {/* Roadmap */}
              <div style={{background:"#fffbeb",borderRadius:14,padding:20,border:"1px solid #fde68a"}}>
                <div style={{fontSize:11,fontWeight:800,color:"#92400e",letterSpacing:".1em",textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:7}}><Lightbulb size={13} color="#d97706"/>Production Roadmap</div>
                {[
                  {icon:"📱",title:"Citizen Notice System",     desc:"Auto-send warning notices with violation details. Reporter stays anonymous to citizens but visible in your admin view."},
                  {icon:"📢",title:"Push Broadcast",            desc:"Supabase Edge Functions + Web Push (FCM/APNs). Add a per-user notifications table and badge counts."},
                  {icon:"📊",title:"Waste Analytics per Purok", desc:"Track waste generation trends per purok. Identify high-waste zones for targeted campaigns."},
                  {icon:"🔔",title:"Realtime Bell",             desc:"Already live via Supabase Realtime — new citizens and violations trigger instant bell notifications."},
                ].map(f=>(
                  <div key={f.title} style={{display:"flex",gap:10,marginBottom:11}}>
                    <span style={{fontSize:17,flexShrink:0}}>{f.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#78350f",marginBottom:2}}>{f.title}</div>
                      <p style={{fontSize:11,color:"#92400e",margin:0,lineHeight:1.5}}>{f.desc}</p>
                    </div>
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
      {showBroadcast&&profile&&<BroadcastModal profile={profile} citizenCount={citizens.filter(c=>!c.is_archived).length} onClose={()=>setShowBroadcast(false)}/>}
    </div>
  );
}