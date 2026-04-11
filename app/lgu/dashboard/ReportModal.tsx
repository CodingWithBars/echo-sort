"use client";
// app/lgu/dashboard/ReportModal.tsx

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Flag, AlertTriangle, CheckCircle } from "lucide-react";
import { EM, STATUS_CFG, REPORT_STATUSES, INP, timeAgo } from "./_constants";
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
      // 1. Update report status
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

      // 2. Audit log
      await supabase.from("audit_logs").insert({
        admin_id: profile.id,
        action_type: "LGU_REVIEW_REPORT",
        target_id: report.id,
        reason: `Report ${newStatus} by ${profile.full_name}. Notes: ${notes || "none"}`,
      });

      // 3. Notify reporter
      await supabase.from("notifications").insert({
        user_id: report.reporter_id,
        type: "REPORT_STATUS",
        title: `Your Report: ${newStatus}`,
        body: `Your report about ${report.type.replace(/_/g," ")} has been updated to "${newStatus}".${notes ? ` LGU note: ${notes}` : ""}`,
        created_by: profile.id,
        metadata: { report_id: report.id, status: newStatus },
      });

      // 4. If escalating → insert a violation against the reported citizen
      if (newStatus === "Escalated" && report.reported_id) {
        // Map the free-text report type to the violations type column.
        // The violations table uses the same text values — pass as-is.
        // We strip extra whitespace and ensure it is non-empty.
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

        if (vErr) {
          console.error("violations insert:", vErr);
          // Surface error to LGU user without blocking the status update
          setSuccess(newStatus + " (violation insert failed — check console)");
        } else {
          // Notify the reported citizen about the filed violation
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
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Primary action — Escalate */}
            {report.reported_id ? (
              <button
                onClick={()=>updateStatus("Escalated")}
                disabled={saving}
                style={{
                  padding:"12px 18px",borderRadius:10,
                  background:"#dc2626",color:"#fff",
                  border:"none",fontSize:13,fontWeight:800,
                  cursor:saving?"not-allowed":"pointer",
                  display:"flex",alignItems:"center",gap:8,
                  opacity:saving?.6:1,
                  boxShadow:"0 4px 16px rgba(220,38,38,.25)",
                  transition:"all .15s",
                }}
              >
                <AlertTriangle size={15}/>
                Escalate → File Formal Violation against {report.reported_name ?? "citizen"}
              </button>
            ) : (
              <div style={{padding:"10px 14px",borderRadius:10,background:"#fef3c7",border:"1px solid #fde68a",fontSize:12,color:"#92400e",display:"flex",alignItems:"center",gap:8}}>
                ⚠ Cannot escalate — no reported citizen identified. This report was filed without selecting a specific citizen.
              </div>
            )}
            {/* Secondary actions */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button
                onClick={()=>updateStatus("Under Review")}
                disabled={saving||report.status==="Under Review"}
                style={{padding:"8px 16px",borderRadius:9,background:"#eff6ff",color:"#1e40af",border:"1.5px solid #bfdbfe",fontSize:12,fontWeight:700,cursor:"pointer",opacity:(report.status==="Under Review"||saving)?.5:1}}
              >
                Mark Under Review
              </button>
              <button
                onClick={()=>updateStatus("Dismissed")}
                disabled={saving}
                style={{padding:"8px 16px",borderRadius:9,background:"#f1f5f9",color:"#374151",border:"1.5px solid #e2e8f0",fontSize:12,fontWeight:700,cursor:"pointer"}}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {(report.status==="Escalated"||report.status==="Dismissed")&&(
          <div style={{padding:"10px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[200]}`,fontSize:12,color:EM[700],fontWeight:600}}>
            ✓ This report has been {report.status.toLowerCase()}. No further actions available.
          </div>
        )}
      </div>
      <MFooter><button onClick={onClose} style={{padding:"8px 20px",borderRadius:9,background:EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>Close</button></MFooter>
    </Modal>
  );
}

// ── SCHEDULE MODAL ────────────────────────────────────────────────────────────
// Uses schedule_assignments table (join table) for driver assignment.
// New columns (bin_ids, driver_id, vehicle_type, collection_area) need the
// migration SQL below before they work — they are silently omitted until then.
// Nominatim OSM geocoding fetches real puroks/streets for the LGU's barangay.