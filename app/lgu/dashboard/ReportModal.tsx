"use client";
// app/lgu/dashboard/ReportModal.tsx

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Flag, AlertTriangle, CheckCircle, Search, Eye, FileText, User, ShieldAlert } from "lucide-react";
import { THEME, STATUS_CFG, REPORT_STATUSES, INP, timeAgo, fmtDate } from "./_constants";
import { Modal, MHead, MFooter } from "./_shared";
import type { CitizenReport, LGUProfile } from "./_types";

const supabase = createClient();

export default function ReportModal({report,profile,onClose,onRefresh}:{report:CitizenReport;profile:LGUProfile;onClose:()=>void;onRefresh:()=>void}) {
  const [notes,   setNotes]   = useState(report.lgu_notes ?? "");
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState("");

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      const { error: rErr } = await supabase
        .from("citizen_reports")
        .update({
          status: newStatus,
          lgu_notes: notes.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", report.id);
      if (rErr) { console.error("citizen_reports update:", rErr); setSaving(false); return; }

      await supabase.from("audit_logs").insert({
        admin_id: profile.id,
        action_type: "LGU_REVIEW_REPORT",
        target_id: report.id,
        reason: `Report ${newStatus} by ${profile.full_name}. Notes: ${notes || "none"}`,
      });

      await supabase.from("notifications").insert({
        user_id: report.reporter_id,
        type: "REPORT_STATUS",
        title: `Your Report: ${newStatus}`,
        body: `Your report about ${report.type.replace(/_/g," ")} has been updated to "${newStatus}".${notes ? ` LGU note: ${notes}` : ""}`,
        created_by: profile.id,
        metadata: { report_id: report.id, status: newStatus },
      });

      if (newStatus === "Escalated" && report.reported_id) {
        const violationType = (report.type ?? "Improper Disposal").trim();
        const violationDesc = [
          "Escalated from citizen report.",
          report.description ?? "",
          notes ? `LGU note: ${notes}` : "",
        ].filter(Boolean).join(" ").trim();

        const { error: vErr } = await supabase.from("violations").insert({
          citizen_id:  report.reported_id,
          barangay:    profile.barangay,
          type:        violationType,
          description: violationDesc,
          status:      "Pending",
        });

        if (!vErr) {
          await supabase.from("notifications").insert({
            user_id:    report.reported_id,
            type:       "VIOLATION_FILED",
            title:      "Violation Filed Against You",
            body:       `A formal violation (${violationType}) has been filed against your account by the LGU following a citizen report.`,
            created_by: profile.id,
          });
        }
      }

      setSuccess(newStatus);
      onRefresh();
    } catch (e) {
      console.error("updateStatus error:", e);
    } finally {
      setSaving(false);
    }
  };

  const sc = STATUS_CFG[report.status] ?? STATUS_CFG.Submitted;

  return (
    <Modal onClose={onClose} wide>
      <MHead title="Review Inbound Signal" sub={`Inbound Transmission: ${timeAgo(report.created_at)}`} icon={Flag} onClose={onClose}/>
      
      <div className="no-scrollbar" style={{padding:"24px",display:"flex",flexDirection:"column",gap:20,overflowY:"auto",minHeight:0}}>
        {success && (
          <div style={{padding:"14px",borderRadius:12,background:THEME.accent,border:`1px solid ${THEME.primary}20`,display:"flex",alignItems:"center",gap:10, animation: "fadeInUp 0.4s ease both"}}>
            <CheckCircle size={18} className="text-[#1c4532]" />
            <span style={{fontSize:12,color:THEME.primary,fontWeight:900, textTransform: "uppercase"}}>Status updated to: {success}</span>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:12}}>
          <div style={{background:"#f9fafb",borderRadius:16,padding:"16px",border:`1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 12}}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${THEME.border}`, color: "#1c4532" }}>
              <User size={20} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase" }}>Reporter Node</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: THEME.text, textTransform: "uppercase" }}>{report.reporter_name ?? "Anonymous"}</p>
            </div>
          </div>
          <div style={{background:"#fef3c7",borderRadius:16,padding:"16px",border:"1px solid #fde68a", display: "flex", alignItems: "center", gap: 12}}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #fde68a", color: "#92400e" }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, color: "#92400e", textTransform: "uppercase" }}>Target Node</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#78350f", textTransform: "uppercase" }}>{report.reported_name ?? "Unknown"}</p>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`, overflow: "hidden"}}>
          <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{fontSize:12,fontWeight:900,color:THEME.text, textTransform: "uppercase"}}>{report.type.replace(/_/g," ")}</span>
              <span style={{fontSize:9,fontWeight:900,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.text, textTransform: "uppercase"}}>{sc.label}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase" }}>{fmtDate(report.created_at)}</span>
          </div>
          <div style={{ padding: "16px" }}>
            <p style={{fontSize:13,color:THEME.text,margin:0,lineHeight:1.6, fontWeight: 500}}>{report.description ?? "No description provided by reporter."}</p>
          </div>
        </div>

        {/* Proof attachments */}
        {report.proof_urls.length > 0 && (
          <div>
            <div style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10, display: "flex", alignItems: "center", gap: 6}}>
              <Eye size={12} /> Verification Assets ({report.proof_urls.length})
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {report.proof_urls.map((url,i)=>(
                <a key={i} href={url} target="_blank" rel="noopener" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:12,background:"#fff",border:`1px solid ${THEME.border}`,fontSize:11,color:THEME.text,textDecoration:"none",fontWeight:700, textTransform: "uppercase", transition: "all 0.2s"}}>
                  <FileText size={14} className="text-[#1c4532]" /> Asset {i+1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",display:"block",marginBottom:6}}>LGU Assessment Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add administrative assessment notes for this report (hidden from residents)…" rows={3} style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>

        {/* Action center */}
        {report.status !== "Escalated" && report.status !== "Dismissed" && (
          <div style={{display:"flex",flexDirection:"column",gap:12, padding: "20px", background: "#f9fafb", borderRadius: 16, border: `1px solid ${THEME.border}`}}>
            <div style={{ fontSize: 10, fontWeight: 900, color: THEME.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Protocol Actions</div>
            
            {report.reported_id ? (
              <button
                onClick={()=>updateStatus("Escalated")}
                disabled={saving}
                style={{
                  padding:"14px",borderRadius:12,
                  background:"#dc2626",color:"#fff",
                  border:"none",fontSize:12,fontWeight:900,
                  cursor:saving?"not-allowed":"pointer",
                  display:"flex",alignItems:"center",justifyContent: "center",gap:8,
                  opacity:saving?.6:1,
                  boxShadow:"0 8px 20px -6px rgba(220,38,38,0.3)",
                  transition:"all .2s",
                  textTransform: "uppercase"
                }}
              >
                <AlertTriangle size={16}/>
                Escalate Protocol: File Violation
              </button>
            ) : (
              <div style={{padding:"12px 16px",borderRadius:12,background:"#fffbeb",border:"1px solid #fde68a",fontSize:11,color:"#92400e",display:"flex",alignItems:"center",gap:10, fontWeight: 700, textTransform: "uppercase"}}>
                <AlertTriangle size={16}/> Protocol restricted: no target node identified.
              </div>
            )}
            
            <div style={{display:"grid",gridTemplateColumns: "1fr 1fr", gap:10}}>
              <button
                onClick={()=>updateStatus("Under Review")}
                disabled={saving||report.status==="Under Review"}
                style={{padding:"12px",borderRadius:12,background:"#fff",color:THEME.primary,border:`1px solid ${THEME.primary}30`,fontSize:11,fontWeight:900,textTransform: "uppercase", cursor:"pointer", transition: "all 0.2s"}}
              >
                Set Under Review
              </button>
              <button
                onClick={()=>updateStatus("Dismissed")}
                disabled={saving}
                style={{padding:"12px",borderRadius:12,background:"#fff",color:"#64748b",border:`1px solid ${THEME.border}`,fontSize:11,fontWeight:900,textTransform: "uppercase", cursor:"pointer", transition: "all 0.2s"}}
              >
                Dismiss Signal
              </button>
            </div>
          </div>
        )}
        
        {(report.status==="Escalated"||report.status==="Dismissed")&&(
          <div style={{padding:"16px",borderRadius:16,background:"#f1f5f9",border:`1px solid ${THEME.border}`,fontSize:11,color:THEME.textMuted,fontWeight:900, textTransform: "uppercase", textAlign: "center", letterSpacing: "0.05em"}}>
            ✓ Protocol {report.status} Logged. Signal Finalized.
          </div>
        )}
      </div>

      <MFooter>
        <button onClick={onClose} style={{padding:"10px 24px",borderRadius:10,background:THEME.primary,color:"#fff",border:"none",fontSize:12,fontWeight:900,textTransform: "uppercase", cursor:"pointer", boxShadow: `0 4px 12px ${THEME.primary}20`}}>Close</button>
      </MFooter>
    </Modal>
  );
}