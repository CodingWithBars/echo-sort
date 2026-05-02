"use client";
// app/lgu/dashboard/CitizenModal.tsx

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Users, AlertTriangle, CheckCircle, Archive, ArchiveRestore, ShieldAlert, Phone, Mail, MapPin } from "lucide-react";
import { THEME, VIOLATION_TYPES, STATUS_CFG, INP, timeAgo, fmtDate, scoreColor } from "./_constants";
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
        <MHead title={citizen.full_name??"Citizen Node"} sub={`Registered Node ID: ${citizen.id.slice(0,8)}`} icon={Users} onClose={onClose}/>
        
        <div className="no-scrollbar" style={{padding:"24px",display:"flex",flexDirection:"column",gap:20,overflowY:"auto",minHeight:0}}>
          {successMsg && (
            <div style={{padding:"14px",borderRadius:12,background:THEME.accent,border:`1px solid ${THEME.primary}20`,display:"flex",alignItems:"center",gap:10, animation: "fadeInUp 0.4s ease both"}}>
              <CheckCircle size={18} className="text-[#1c4532]" />
              <span style={{fontSize:12,color:THEME.primary,fontWeight:900, textTransform: "uppercase"}}>{successMsg}</span>
            </div>
          )}

          {/* Quick Stats Header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ background: "#f9fafb", borderRadius: 16, padding: "16px", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${THEME.border}`, color: "#1c4532" }}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase" }}>Active Warnings</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: citizen.warning_count >= 3 ? "#dc2626" : THEME.text }}>{citizen.warning_count}</p>
              </div>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 16, padding: "16px", border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${THEME.border}`, color: scoreColor(currentScore) }}>
                <span style={{ fontWeight: 900, fontSize: 16 }}>{currentScore}</span>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase" }}>Eco Integrity</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: scoreColor(currentScore) }}>{currentScore >= 90 ? "OPTIMAL" : currentScore >= 70 ? "STABLE" : "REVIEW"}</p>
              </div>
            </div>
          </div>

          {/* Identity Info */}
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${THEME.border}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase" }}>Node Telemetry</span>
            </div>
            <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { icon: MapPin, l: "Purok Node", v: citizen.purok ?? "—" },
                { icon: MapPin, l: "Address Line", v: `${citizen.address_street ?? ""} ${citizen.house_lot_number ?? ""}` },
                { icon: Phone, l: "Signal Channel", v: citizen.contact_number ?? "—" },
                { icon: Mail, l: "Identity Sync", v: citizen.email },
              ].map(f => (
                <div key={f.l}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{f.l}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: THEME.text, textTransform: "uppercase" }}>{f.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Warning Management */}
          <div style={{ background: citizen.warning_count >= 3 ? "#fef2f2" : "#fff", borderRadius: 16, padding: "20px", border: citizen.warning_count >= 3 ? "1px solid #fecaca" : `1px solid ${THEME.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 900, color: citizen.warning_count >= 3 ? "#991b1b" : THEME.text, textTransform: "uppercase" }}>Governance Warnings</h4>
                <p style={{ fontSize: 11, color: THEME.textMuted, marginTop: 4, fontWeight: 600 }}>Formal proceedings trigger at 3 active signals.</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {citizen.warning_count > 0 && (
                  <button onClick={() => setShowRevoke(true)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", fontSize: 10, fontWeight: 900, textTransform: "uppercase", cursor: "pointer" }}>Revoke</button>
                )}
                <button onClick={() => setShowWarn(true)} disabled={citizen.is_archived} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: THEME.primary, color: "#fff", fontSize: 10, fontWeight: 900, textTransform: "uppercase", cursor: "pointer", opacity: citizen.is_archived ? 0.5 : 1 }}>Issue Warning</button>
              </div>
            </div>
            {citizen.warning_count >= 3 && (
              <div style={{ padding: "10px", background: "rgba(220, 38, 38, 0.05)", borderRadius: 10, border: "1px solid rgba(220, 38, 38, 0.1)", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 11, color: "#991b1b", fontWeight: 700, textTransform: "uppercase" }}>Escalate to RA 9003 Barangay Protocol</span>
              </div>
            )}
          </div>

          {/* Violations Log */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: THEME.text, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} className="text-[#1c4532]" /> Breach Transmission Log ({violations.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {violations.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", background: "#f9fafb", borderRadius: 16, border: `1px solid ${THEME.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={24} className="text-slate-200" />
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>No breaches detected</p>
                </div>
              ) : (
                violations.map(v => {
                  const sc = STATUS_CFG[v.status] ?? STATUS_CFG.Pending;
                  return (
                    <div key={v.id} style={{ padding: "16px", borderRadius: 16, background: "#fff", border: `1px solid ${THEME.border}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: THEME.text, textTransform: "uppercase" }}>{v.type.replace(/_/g, " ")}</span>
                          <span style={{ fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text, textTransform: "uppercase" }}>{sc.label}</span>
                        </div>
                        <p style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 500, lineHeight: 1.5 }}>{v.description ?? "No description"}</p>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, fontWeight: 700, textTransform: "uppercase" }}>{timeAgo(v.created_at)}</div>
                      </div>
                      {v.status !== "Resolved" && (
                        <button onClick={() => resolveV(v.id)} disabled={resolvingId === v.id} style={{ padding: "6px 12px", borderRadius: 8, background: THEME.accent, color: THEME.primary, border: `1px solid ${THEME.primary}20`, fontSize: 10, fontWeight: 900, textTransform: "uppercase", cursor: "pointer" }}>
                          {resolvingId === v.id ? "Syncing…" : "Resolve"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <MFooter>
          <button onClick={toggleArchive} disabled={archiving} style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: citizen.is_archived ? THEME.text : "#dc2626", fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>
            {citizen.is_archived ? <><ArchiveRestore size={16} /> Restore Node</> : <><Archive size={16} /> Archive Node</>}
          </button>
          <BtnCancel onClick={onClose} />
        </MFooter>
      </Modal>

      {/* Issue warning modal */}
      {showWarn && (
        <Modal onClose={() => setShowWarn(false)}>
          <MHead title="Governance Signal" sub={`Target: ${citizen.full_name}`} icon={AlertTriangle} onClose={() => setShowWarn(false)} />
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Breach Classification</label>
              <select value={warnType} onChange={e => setWarnType(e.target.value)} style={INP}>{VIOLATION_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Telemetry Notes</label>
              <textarea value={warnNote} onChange={e => setWarnNote(e.target.value)} placeholder="Add administrative context for this signal…" rows={3} style={{ ...INP, resize: "none", lineHeight: 1.6 }} />
            </div>
            <div style={{ padding: "12px", background: THEME.accent, borderRadius: 12, border: `1px solid ${THEME.primary}10`, fontSize: 11, color: THEME.primary, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>🛰️</span>
              <span>Resident node will receive an encrypted protocol warning.</span>
            </div>
          </div>
          <MFooter>
            <BtnCancel onClick={() => setShowWarn(false)} />
            <BtnPrimary onClick={issueWarning} disabled={saving}>{saving ? "Transmitting…" : "Issue Signal"}</BtnPrimary>
          </MFooter>
        </Modal>
      )}

      {/* Revoke confirm */}
      {showRevoke && (
        <Modal onClose={() => setShowRevoke(false)}>
          <MHead title="Revoke Protocol Signal" sub="Identity synchronization required" icon={ArchiveRestore} onClose={() => setShowRevoke(false)} />
          <div style={{ padding: "24px" }}>
            <p style={{ fontSize: 13, color: THEME.text, margin: "0 0 16px", lineHeight: 1.6, fontWeight: 600, textTransform: "uppercase" }}>
              Confirm signal revocation for <span style={{ color: THEME.primary }}>{citizen.full_name}</span>?
            </p>
            <div style={{ padding: "16px", background: "#f9fafb", borderRadius: 16, border: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Current</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: "#dc2626" }}>{citizen.warning_count}</p>
              </div>
              <div style={{ fontSize: 20, color: "#cbd5e1" }}>→</div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>New</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>{citizen.warning_count - 1}</p>
              </div>
            </div>
          </div>
          <MFooter>
            <BtnCancel onClick={() => setShowRevoke(false)} />
            <BtnPrimary onClick={revokeWarning} disabled={saving} danger>{saving ? "Revoking…" : "Confirm Revocation"}</BtnPrimary>
          </MFooter>
        </Modal>
      )}
    </>
  );
}