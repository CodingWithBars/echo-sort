"use client";
// app/lgu/dashboard/NotifPanel.tsx

import React from "react";
import { Flag, UserCheck, Info, X } from "lucide-react";
import { EM, timeAgo } from "./_constants";
import type { DBNotif } from "./_types";

export default function NotifPanel({notifs,onRead,onClose}:{notifs:DBNotif[];onRead:(id:string)=>void;onClose:()=>void}) {
  const unread = notifs.filter(n=>!n.is_read).length;
  const iconFor = (type:string) => {
    if (type==="REPORT_RECEIVED") return <Flag size={13} color="#d97706"/>;
    if (type==="new_citizen"||type==="BROADCAST") return <UserCheck size={13} color={EM[600]}/>;
    return <Info size={13} color="#3b82f6"/>;
  };
  const bgFor = (type:string) => type==="REPORT_RECEIVED"?"#fef3c7":type==="BROADCAST"?EM[100]:"#eff6ff";
  return (
    <>
      {/* Mobile: fixed full-width centered overlay */}
      <style>{`
        @media(max-width:640px){
          .notif-panel{position:fixed!important;top:auto!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;max-width:100%!important;border-radius:20px 20px 0 0!important;max-height:75vh!important;}
          .notif-backdrop{display:block!important;}
        }
        @media(min-width:641px){
          .notif-panel{position:absolute!important;top:calc(100% + 10px)!important;right:0!important;width:340px!important;border-radius:16px!important;}
          .notif-backdrop{display:none!important;}
        }
        .notif-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:399;}
      `}</style>
      {/* Backdrop for mobile — tapping closes panel */}
      <div className="notif-backdrop" onClick={onClose}/>
      <div className="notif-panel" style={{background:"#fff",border:`1.5px solid ${EM[100]}`,boxShadow:`0 20px 60px rgba(6,78,59,.18)`,zIndex:400,animation:"dropIn .18s ease both",overflow:"hidden"}}>
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
    </>
  );
}

// ── LGU PROFILE PANEL ────────────────────────────────────────────────────────
// Slide-over panel from the right — shows LGU account info, barangay stats,
// editable profile fields, notification prefs, and account settings.
// Opened by clicking the profile badge in the top-right header.

// ── LGU PROFILE PANEL ────────────────────────────────────────────────────────
// Right slide-over: Profile management (avatar, name, title, contact) +
// Security (password change) + Activity log (admin actions + auth sessions).
// No overview stats — those live on the main dashboard.
// ─────────────────────────────────────────────────────────────────────────────

// Shared slide-over animation — reuse this keyframe for every role's panel.
// Usage: animation:"slideInRight .25s cubic-bezier(.4,0,.2,1) both"
const SLIDE_IN_STYLE = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`;

type LogEntry = {
  id:string; action_type:string; reason:string;
  created_at:string; _session?:boolean; _sessionType?:"LOGIN"|"LOGOUT";
};