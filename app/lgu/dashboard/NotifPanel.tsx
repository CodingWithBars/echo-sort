"use client";
// app/lgu/dashboard/NotifPanel.tsx

import React from "react";
import { Flag, UserCheck, Info, X, Bell } from "lucide-react";
import { timeAgo, THEME } from "./_constants";
import type { DBNotif } from "./_types";

export default function NotifPanel({notifs,onRead,onClose}:{notifs:DBNotif[];onRead:(id:string)=>void;onClose:()=>void}) {
  const unread = notifs.filter(n=>!n.is_read).length;
  
  const iconFor = (type:string) => {
    if (type==="REPORT_RECEIVED") return <Flag size={14} className="text-amber-600" />;
    if (type==="new_citizen" || type==="BROADCAST") return <UserCheck size={14} className="text-[#1c4532]" />;
    return <Info size={14} className="text-blue-500" />;
  };

  const bgFor = (type:string) => {
    if (type==="REPORT_RECEIVED") return "bg-amber-50 border-amber-100";
    if (type==="new_citizen" || type==="BROADCAST") return "bg-[#f0fdf4] border-[#1c4532]/10";
    return "bg-blue-50 border-blue-100";
  };

  return (
    <>
      <style>{`
        @media(max-width:640px){
          .notif-panel{position:fixed!important;top:auto!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;max-width:100%!important;border-radius:24px 24px 0 0!important;max-height:80vh!important;}
          .notif-backdrop{display:block!important;}
        }
        @media(min-width:641px){
          .notif-panel{position:absolute!important;top:calc(100% + 12px)!important;right:0!important;width:380px!important;border-radius:20px!important;}
          .notif-backdrop{display:none!important;}
        }
        .notif-backdrop{display:none;position:fixed;inset:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(4px);z-index:1999;}
      `}</style>

      <div className="notif-backdrop" onClick={onClose}/>
      
      <div className="notif-panel" style={{
        background:"#fff",
        border:`1px solid ${THEME.border}`,
        boxShadow:`0 20px 50px rgba(15,23,42,0.12)`,
        zIndex:2000,
        animation:"dropIn .2s cubic-bezier(0.16, 1, 0.3, 1) both",
        overflow:"hidden",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          padding:"16px 20px",
          borderBottom:`1px solid ${THEME.border}`,
          background:"#f9fafb"
        }}>
          <div style={{fontSize:13, fontWeight:900, color:THEME.text, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8}}>
            Signal Intelligence 
            {unread > 0 && (
              <span style={{fontSize:10, fontWeight:900, background:"#ef4444", color:"#fff", padding:"1px 8px", borderRadius:20}}>
                {unread}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{background:"#fff", border:`1px solid ${THEME.border}`, borderRadius: 8, padding: 6, cursor:"pointer", display:"flex"}}>
            <X size={14} color={THEME.textMuted}/>
          </button>
        </div>

        <div className="no-scrollbar" style={{maxHeight:440, overflowY:"auto"}}>
          {notifs.length === 0 ? (
            <div style={{padding:48, textAlign:"center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12}}>
              <Bell size={32} className="text-slate-200" />
              <p style={{color:"#9ca3af", fontSize:11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em"}}>No incoming signals</p>
            </div>
          ) : (
            notifs.map(n => (
              <div 
                key={n.id} 
                onClick={() => onRead(n.id)} 
                style={{
                  padding:"16px 20px",
                  borderBottom:`1px solid #f3f4f6`,
                  background: n.is_read ? "#fff" : THEME.accent,
                  cursor:"pointer",
                  display:"flex",
                  gap:14,
                  alignItems:"flex-start",
                  transition: "background 0.2s"
                }}
                className="hover:bg-slate-50"
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${bgFor(n.type)}`}>
                  {iconFor(n.type)}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight: n.is_read ? 700 : 900, color: THEME.text, textTransform: "uppercase", letterSpacing: "-0.01em"}}>{n.title}</div>
                  <div style={{fontSize:11, color: THEME.textMuted, marginTop:4, fontWeight: 500, lineHeight:1.5}}>{n.body}</div>
                  <div style={{fontSize:10, color:"#9ca3af", marginTop:8, fontWeight: 700, textTransform: "uppercase"}}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <div style={{width:8, height:8, borderRadius:"50%", background:"#ef4444", border: "2px solid #fff", flexShrink:0, marginTop:4}} />
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "12px", background: "#f9fafb", borderTop: `1px solid ${THEME.border}`, textAlign: "center" }}>
          <button style={{ fontSize: 10, fontWeight: 900, color: "#1c4532", textTransform: "uppercase", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer" }}>
            Archive All Signals
          </button>
        </div>
      </div>
    </>
  );
}