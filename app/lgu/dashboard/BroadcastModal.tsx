"use client";
// app/lgu/dashboard/BroadcastModal.tsx

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Megaphone, Send, CheckCircle, Pin } from "lucide-react";
import { THEME, BROADCAST_TYPES, BROADCAST_TEMPLATES, INP } from "./_constants";
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
      <MHead title="Broadcast Hub" sub={`${profile.barangay} · ${citizenCount} Active Recipients`} icon={Megaphone} onClose={onClose}/>
      
      <div className="no-scrollbar" style={{padding:"24px",display:"flex",flexDirection:"column",gap:20,overflowY:"auto",minHeight:0}}>
        
        {/* Type selection */}
        <div>
          <label style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",display:"block",marginBottom:10}}>Transmission Type</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {BROADCAST_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setType(t.id)}
                style={{
                  padding:"8px 16px",borderRadius:12,
                  border:`1px solid ${type===t.id?THEME.primary:THEME.border}`,
                  background:type===t.id?THEME.accent:"#fff",
                  cursor:"pointer",fontSize:11,fontWeight:900,
                  color:type===t.id?THEME.primary:THEME.text,
                  display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
                  textTransform: "uppercase", letterSpacing: "0.02em",
                  transition: "all 0.2s"
                }}>
                <span style={{fontSize:14}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div>
          <div style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>System Templates</div>
          <div style={{display:"grid",gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",gap:10}}>
            {BROADCAST_TEMPLATES.map(s=>(
              <button key={s.id}
                onClick={()=>{setPicked(s.id);setType(s.type);setSubject(s.title);setBody(s.body);}}
                style={{
                  padding:"14px",borderRadius:16,textAlign:"left",cursor:"pointer",
                  border:`1px solid ${picked===s.id?THEME.primary:THEME.border}`,
                  background:picked===s.id?THEME.accent:"#fff",
                  display:"flex",alignItems:"flex-start",gap:12,
                  transition: "all 0.2s",
                  boxShadow: picked === s.id ? `0 4px 12px ${THEME.primary}10` : "none"
                }}>
                <span style={{fontSize:20,flexShrink:0}}>{s.icon}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:900,color:THEME.text, textTransform: "uppercase"}}>{s.title}</div>
                  <div style={{fontSize:10,color:THEME.textMuted,marginTop:4,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical", fontWeight: 500}}>{s.body}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div>
            <label style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",display:"block",marginBottom:6}}>Broadcast Subject</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Protocol Update: Segregation" style={INP}/>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",display:"block",marginBottom:6}}>Signal Body</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Compose your transmission to all resident nodes…" rows={4} style={{...INP,resize:"none",lineHeight:1.6}}/>
          </div>
        </div>

        <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",fontSize:12,color:THEME.text, fontWeight: 700, textTransform: "uppercase", userSelect: "none"}}>
          <input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)} style={{width:18,height:18,accentColor:THEME.primary, cursor: "pointer"}}/>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Pin size={14} className={pinned ? "text-[#1c4532]" : "text-slate-400"} />
            <span>Pin to citizen dashboard</span>
          </div>
        </label>

        {success ? (
          <div style={{padding:"16px",borderRadius:12,background:THEME.accent,border:`1px solid ${THEME.primary}20`,display:"flex",gap:10,alignItems:"center", animation: "fadeInUp 0.4s ease both"}}>
            <CheckCircle size={18} className="text-[#1c4532]" />
            <span style={{fontSize:12,color:THEME.primary,fontWeight:900, textTransform: "uppercase"}}>Signal transmitted to {citizenCount} nodes!</span>
          </div>
        ) : (
          <div style={{padding:"12px 16px",borderRadius:12,background:"#f8fafc",border:`1px solid ${THEME.border}`,fontSize:11,color:THEME.textMuted,lineHeight:1.5, fontWeight: 600, display: "flex", gap: 8, alignItems: "center"}}>
            <span style={{ fontSize: 16 }}>📡</span>
            <span>Broadcasting will trigger real-time app notifications for all active residents in Barangay {profile.barangay}.</span>
          </div>
        )}
      </div>

      <MFooter>
        <BtnCancel onClick={onClose}/>
        <BtnPrimary onClick={send} disabled={!subject||!body||saving||success}>
          <Send size={14}/> {saving?"Transmitting…":"Send Broadcast"}
        </BtnPrimary>
      </MFooter>
    </Modal>
  );
}