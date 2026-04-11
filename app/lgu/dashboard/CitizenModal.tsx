"use client";
// app/lgu/dashboard/CitizenModal.tsx

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Users, AlertTriangle, CheckCircle, Archive, ArchiveRestore, ShieldAlert } from "lucide-react";
import { EM, VIOLATION_TYPES, STATUS_CFG, INP, timeAgo, fmtDate, scoreColor } from "./_constants";
import { Modal, MHead, MFooter, BtnCancel, BtnPrimary } from "./_shared";
import type { Citizen, LGUProfile, Violation, ScoreRow } from "./_types";

const supabase = createClient();

export default function CitizenDetailModal({citizen,profile,onClose,onRefresh}:{citizen:Citizen;profile:LGUProfile;onClose:()=>void;onRefresh:()=>void}) {
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
    supabase.from("citizen_scores").select("score,score_month").eq("citizen_id",citizen.id).order("score_month",{ascending:false}).limit(6).then((res: { data: ScoreRow[]|null; error: unknown }) => {
  setScoreHistory(res.data ?? []);
});
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
        <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:14}}>
          {successMsg && (
            <div style={{padding:"10px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",alignItems:"center",gap:8}}>
              <CheckCircle size={15} color={EM[600]}/><span style={{fontSize:13,color:EM[800],fontWeight:600}}>{successMsg}</span>
            </div>
          )}

          {/* Info + Score grid */}
          <div style={{display:"flex",flexWrap:"wrap",gap:14,alignItems:"start"}}>
            <div style={{flex:"1 1 260px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
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
            <div style={{flex:"1 1 100%",display:"flex",alignItems:"center",gap:16,background:EM[50],borderRadius:14,padding:"14px 18px",border:`1.5px solid ${EM[100]}`}}>
              {/* Score number */}
              <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:36,fontWeight:900,color:scoreColor(currentScore),fontFamily:"Georgia,serif",lineHeight:1}}>{currentScore}</div>
                <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>/100</div>
              </div>
              {/* Label + mini bars */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Eco Score</div>
                {scoreHistory.length > 1 && (
                  <div style={{display:"flex",gap:3,alignItems:"flex-end"}}>
                    {scoreHistory.slice(0,5).reverse().map((s,i)=>(
                      <div key={i} style={{flex:1,borderRadius:3,background:scoreColor(s.score),height:Math.max(6,(s.score/100)*28),opacity:0.3+i*0.14,transition:"height .3s"}} title={`${s.score_month}: ${s.score}`}/>
                    ))}
                  </div>
                )}
                <div style={{fontSize:11,color:scoreColor(currentScore),fontWeight:700,marginTop:4}}>{currentScore>=90?"Excellent":currentScore>=70?"Good":currentScore>=50?"Fair":currentScore>=30?"Poor":"Critical"}</div>
              </div>
            </div>
          </div>

          {/* Warning bar */}
          <div style={{display:"flex",flexDirection:"column",gap:10,padding:"14px 16px",borderRadius:12,background:citizen.warning_count>=3?"#fef2f2":EM[50],border:`1.5px solid ${citizen.warning_count>=3?"#fecaca":EM[200]}`}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <ShieldAlert size={18} color={citizen.warning_count>=3?"#dc2626":EM[600]} style={{flexShrink:0,marginTop:2}}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:800,color:citizen.warning_count>=3?"#991b1b":EM[900]}}>{citizen.warning_count} Active Warning{citizen.warning_count!==1?"s":""}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:2,lineHeight:1.4}}>{citizen.warning_count>=3?"⚠️ Eligible for RA 9003 barangay proceedings":"3 warnings triggers formal proceedings"}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {citizen.warning_count>0 && <button onClick={()=>setShowRevoke(true)} style={{flex:"1 1 auto",fontSize:12,fontWeight:700,padding:"8px 14px",borderRadius:9,background:"#fff",color:"#dc2626",border:"1.5px solid #fca5a5",cursor:"pointer"}}>Revoke Warning</button>}
              <button onClick={()=>setShowWarn(true)} disabled={citizen.is_archived} style={{flex:"1 1 auto",fontSize:12,fontWeight:700,padding:"8px 14px",borderRadius:9,background:EM[600],color:"#fff",border:"none",cursor:"pointer",opacity:citizen.is_archived?.5:1}}>+ Issue Warning</button>
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

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderTop:`1px solid ${EM[100]}`,background:EM[50],borderRadius:"0 0 18px 18px",flexWrap:"wrap",gap:8,flexShrink:0}}>
          <button onClick={toggleArchive} disabled={archiving} style={{flex:"1 1 auto",fontSize:12,fontWeight:700,padding:"9px 14px",borderRadius:9,border:`1.5px solid ${citizen.is_archived?EM[300]:"#fca5a5"}`,background:"#fff",color:citizen.is_archived?EM[700]:"#dc2626",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {citizen.is_archived?<><ArchiveRestore size={14}/>Restore Account</>:<><Archive size={14}/>Archive Account</>}
          </button>
          <button onClick={onClose} style={{flex:"1 1 auto",fontSize:12,fontWeight:700,padding:"9px 14px",borderRadius:9,background:EM[600],color:"#fff",border:"none",cursor:"pointer"}}>Close</button>
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