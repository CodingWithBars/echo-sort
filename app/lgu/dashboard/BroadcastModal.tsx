"use client";
// app/lgu/dashboard/BroadcastModal.tsx

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Megaphone, Send, CheckCircle } from "lucide-react";
import { EM, BROADCAST_TYPES, BROADCAST_TEMPLATES, INP } from "./_constants";
import { Modal, MHead, MFooter, BtnCancel, BtnPrimary } from "./_shared";
import type { LGUProfile } from "./_types";

const supabase = createClient();

export default function BroadcastModal({profile,citizenCount,onClose,onSent}:{profile:LGUProfile;citizenCount:number;onClose:()=>void;onSent:()=>void}) {
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
    const { data: cDetails } = await supabase.from("citizen_details").select("id").eq("barangay", profile.barangay).eq("municipality", profile.municipality);
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
      <MHead title="Broadcast to Citizens" sub={`${profile.barangay} · ${citizenCount} recipients`} icon={Megaphone} onClose={onClose}/>
      {/* Scrollable body — min-height:0 lets flex parent shrink it */}
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12,overflowY:"auto",minHeight:0}}>
        {/* Type pills */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {BROADCAST_TYPES.map(t=>(
            <button key={t.id} onClick={()=>setType(t.id)}
              style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${type===t.id?EM[400]:EM[100]}`,
                background:type===t.id?EM[100]:"#fff",cursor:"pointer",fontSize:11,fontWeight:type===t.id?700:500,
                color:type===t.id?EM[800]:"#374151",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Quick templates — single column, description wraps instead of overflowing */}
        <div>
          <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:7}}>Quick Templates</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {BROADCAST_TEMPLATES.map(s=>(
              <button key={s.id}
                onClick={()=>{setPicked(s.id);setType(s.type);setSubject(s.title);setBody(s.body);}}
                style={{padding:"10px 12px",borderRadius:10,textAlign:"left",cursor:"pointer",width:"100%",
                  border:`1.5px solid ${picked===s.id?EM[400]:EM[100]}`,
                  background:picked===s.id?EM[50]:"#fff",
                  display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18,flexShrink:0}}>{s.icon}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:EM[900]}}>{s.title}</div>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:1,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{s.body}</div>
                </div>
                {picked===s.id && <span style={{fontSize:13,color:EM[600],flexShrink:0,marginLeft:"auto"}}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Subject *</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Segregation Reminder" style={INP}/>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Message *</label>
          <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Type your message to all citizens…" rows={3} style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:EM[800]}}>
          <input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)} style={{width:16,height:16,accentColor:EM[600]}}/>
          <span>Pin to top of citizen news feed</span>
        </label>
        {success
          ? <div style={{padding:"10px 12px",borderRadius:9,background:EM[50],border:`1px solid ${EM[300]}`,display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={14} color={EM[600]}/><span style={{fontSize:12,color:EM[800],fontWeight:600}}>Broadcast sent to {citizenCount} citizens!</span></div>
          : <div style={{padding:"9px 12px",borderRadius:9,background:EM[50],border:`1px solid ${EM[200]}`,fontSize:12,color:EM[700],lineHeight:1.5}}>✅ Citizens receive an in-app notification. Push delivery requires FCM setup.</div>
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