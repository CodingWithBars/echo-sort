"use client";
// app/lgu/dashboard/ProfilePanel.tsx

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { X } from "lucide-react";
import { EM } from "./_constants";
import type { LGUProfile, AvatarRow, AuditLogRow } from "./_types";

const supabase = createClient();

const SLIDE_IN_STYLE = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`;

type LogEntry = {
  id:string; action_type:string; reason:string;
  created_at:string; _session?:boolean; _sessionType?:"LOGIN"|"LOGOUT";
};

export default function LGUProfilePanel({profile,onClose,onRefresh}:{
  profile:LGUProfile; onClose:()=>void; onRefresh:()=>void;
}) {
  const [tab,          setTab]          = useState<"profile"|"security"|"activity">("profile");
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveOk,       setSaveOk]       = useState(false);
  const [saveErr,      setSaveErr]      = useState("");
  const [editData,     setEditData]     = useState({
    full_name:      profile.full_name,
    position_title: profile.position_title,
    email:          profile.email,
  });

  // Avatar upload
  const [avatarUrl,    setAvatarUrl]    = useState<string|null>(null);
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Password
  const [pwForm,       setPwForm]       = useState({next:"",confirm:""});
  const [showPw,       setShowPw]       = useState(false);
  const [pwSaving,     setPwSaving]     = useState(false);
  const [pwOk,         setPwOk]         = useState(false);
  const [pwErr,        setPwErr]        = useState("");

  // Activity log
  const [logs,         setLogs]         = useState<LogEntry[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);

  // Load avatar on mount
  useEffect(()=>{
    supabase.from("profiles").select("avatar_url").eq("id",profile.id).single()
      .then((res: { data: AvatarRow|null; error: unknown }) => {
  if (res.data?.avatar_url) setAvatarUrl(res.data.avatar_url);
});
  },[profile.id]);

  // Load activity when tab opens
  useEffect(()=>{
    if (tab!=="activity") return;
    setLogsLoading(true);
    // Fetch admin audit logs
    supabase.from("audit_logs").select("id,action_type,reason,created_at")
      .eq("admin_id",profile.id)
      .order("created_at",{ascending:false})
      .limit(40)
      .then((res: { data: AuditLogRow[]|null; error: unknown }) => {
  const rows = (res.data??[]).map(l=>({...l,_session:false}));
        setLogs(rows);
        setLogsLoading(false);
      });
  },[tab,profile.id]);

  // ── Avatar upload ───────────────────────────────────────────────────────────
  const handleAvatarChange = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type});
    if (upErr) { console.error("Avatar upload:",upErr); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({avatar_url:publicUrl}).eq("id",profile.id);
    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  // ── Save profile ────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!editData.full_name.trim()) { setSaveErr("Name cannot be empty."); return; }
    setSaving(true); setSaveErr("");
    const { error:pErr } = await supabase.from("profiles").update({
      full_name: editData.full_name.trim(),
    }).eq("id",profile.id);
    const { error:lErr } = await supabase.from("lgu_details").update({
      position_title: editData.position_title.trim()||null,
    }).eq("id",profile.id);
    if (pErr||lErr) {
      setSaveErr((pErr||lErr)!.message);
      setSaving(false); return;
    }
    await supabase.from("audit_logs").insert({
      admin_id:    profile.id,
      action_type: "LGU_UPDATE_PROFILE",
      target_id:   profile.id,
      reason:      `Profile details updated`,
    });
    setSaveOk(true);
    setTimeout(()=>{ setSaveOk(false); setEditing(false); onRefresh(); },1200);
    setSaving(false);
  };

  // ── Change password ─────────────────────────────────────────────────────────
  const changePassword = async () => {
    setPwErr("");
    if (!pwForm.next||pwForm.next!==pwForm.confirm) { setPwErr("Passwords do not match."); return; }
    if (pwForm.next.length<8) { setPwErr("Minimum 8 characters required."); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({password:pwForm.next});
    if (error) { setPwErr(error.message); setPwSaving(false); return; }
    // Log the password change for accountability
    await supabase.from("audit_logs").insert({
      admin_id:    profile.id,
      action_type: "LGU_PASSWORD_CHANGE",
      target_id:   profile.id,
      reason:      `Password changed by ${profile.full_name}`,
    });
    setPwOk(true); setPwForm({next:"",confirm:""});
    setTimeout(()=>setPwOk(false),3500);
    setPwSaving(false);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const INP2:React.CSSProperties = {
    padding:"9px 12px",borderRadius:9,border:`1.5px solid ${EM[200]}`,
    background:EM[50],color:EM[900],fontSize:13,outline:"none",
    fontFamily:"sans-serif",width:"100%",boxSizing:"border-box",
  };

  const actionIcon = (type:string) => {
    if (type==="LGU_LOGIN"    ||type==="LOGIN")          return {icon:"🔑",color:"#059669"};
    if (type==="LGU_LOGOUT"   ||type==="LOGOUT")         return {icon:"🚪",color:"#6b7280"};
    if (type==="LGU_PASSWORD_CHANGE")                    return {icon:"🔒",color:"#d97706"};
    if (type==="LGU_UPDATE_PROFILE")                     return {icon:"✏️",color:EM[600]};
    if (type==="LGU_ISSUE_WARNING")                      return {icon:"⚠️",color:"#d97706"};
    if (type==="LGU_REVOKE_WARNING")                     return {icon:"↩️",color:"#6b7280"};
    if (type==="LGU_RESOLVE_VIOLATION")                  return {icon:"✅",color:EM[600]};
    if (type==="LGU_REVIEW_REPORT")                      return {icon:"🔍",color:"#3b82f6"};
    if (type==="LGU_BROADCAST")                          return {icon:"📢",color:"#8b5cf6"};
    if (type==="LGU_CREATE_SCHEDULE"||type==="LGU_UPDATE_SCHEDULE") return {icon:"📅",color:EM[600]};
    if (type==="LGU_ARCHIVE_CITIZEN")                    return {icon:"📦",color:"#dc2626"};
    if (type==="LGU_RESTORE_CITIZEN")                    return {icon:"♻️",color:EM[600]};
    return {icon:"📋",color:"#6b7280"};
  };

  const fmtFull = (iso:string) => new Date(iso).toLocaleString("en-PH",{
    month:"short",day:"numeric",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:true,
  });

  const initials = (profile.full_name??"L").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const TABS = [
    {id:"profile",  label:"Profile",  icon:"👤"},
    {id:"security", label:"Security", icon:"🔒"},
    {id:"activity", label:"Activity", icon:"🗒️"},
  ] as const;

  return (
    <>
      {/* Backdrop — click to close */}
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.3)",backdropFilter:"blur(2px)",zIndex:700}}/>

      {/* Slide-over panel */}
      <div style={{
        position:"fixed",top:80,right:0,bottom:0,zIndex:800,
        width:"min(460px,100vw)",background:"#fff",
        boxShadow:"-8px 0 48px rgba(0,0,0,.18)",
        display:"flex",flexDirection:"column",
        animation:"slideInRight .25s cubic-bezier(.4,0,.2,1) both",
        fontFamily:"sans-serif",
      }}>
        <style>{SLIDE_IN_STYLE}</style>

        {/* ── HEADER ── */}
        <div style={{padding:"20px",borderBottom:`1px solid ${EM[100]}`,background:EM[50],flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontSize:12,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase"}}>My Profile</span>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:9,border:`1px solid ${EM[200]}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <X size={14} color={EM[700]}/>
            </button>
          </div>

          {/* Avatar + identity */}
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            {/* Avatar with upload overlay */}
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{
                width:72,height:72,borderRadius:20,
                background:avatarUrl?"#f1f5f9":`linear-gradient(135deg,${EM[500]},${EM[700]})`,
                display:"flex",alignItems:"center",justifyContent:"center",
                overflow:"hidden",border:`2px solid ${EM[200]}`,
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontSize:22,fontWeight:900,color:"#fff"}}>{initials}</span>
                }
                {uploading&&(
                  <div style={{position:"absolute",inset:0,background:"rgba(6,78,59,.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin 1s linear infinite"}}/>
                  </div>
                )}
              </div>
              {/* Upload button */}
              <button
                onClick={()=>fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  position:"absolute",bottom:-4,right:-4,
                  width:24,height:24,borderRadius:8,
                  background:EM[600],border:"2px solid #fff",
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                }}
                title="Change photo"
              >
                <span style={{fontSize:11}}>📷</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{display:"none"}}/>
            </div>

            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:EM[900],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.full_name}</div>
              <div style={{fontSize:12,color:EM[600],marginTop:2}}>{profile.position_title}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:3}}>{profile.barangay} · {profile.municipality}</div>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{display:"flex",borderBottom:`1px solid ${EM[100]}`,flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{
                flex:1,padding:"11px 0",border:"none",background:"transparent",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                fontSize:12,fontWeight:tab===t.id?700:500,
                color:tab===t.id?EM[700]:"#6b7280",
                borderBottom:tab===t.id?`2.5px solid ${EM[600]}`:"2.5px solid transparent",
                transition:"color .15s",
              }}>
              <span style={{fontSize:14}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px",display:"flex",flexDirection:"column",gap:14}}>

          {/* ── PROFILE TAB ── */}
          {tab==="profile"&&(
            <>
              {/* Info tiles (read-only) */}
              {!editing&&(
                <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}>
                    <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Account Details</span>
                    <button onClick={()=>setEditing(true)} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:8,background:"#fff",color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                      ✏️ Edit
                    </button>
                  </div>
                  <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      {label:"Full Name",    value:profile.full_name},
                      {label:"Email",        value:profile.email},
                      {label:"Position",     value:profile.position_title||"—"},
                      {label:"Barangay",     value:profile.barangay},
                      {label:"Municipality", value:profile.municipality},
                    ].map(f=>(
                      <div key={f.label} style={{background:EM[50],borderRadius:9,padding:"9px 12px",border:`1px solid ${EM[100]}`}}>
                        <div style={{fontSize:9,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{f.label}</div>
                        <div style={{fontSize:13,fontWeight:600,color:EM[900],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit form */}
              {editing&&(
                <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[300]}`,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}>
                    <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Edit Profile</span>
                  </div>
                  <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                    {[
                      {label:"Full Name *",     key:"full_name",      ph:"Your full name",             type:"text"},
                      {label:"Position / Title",key:"position_title", ph:"e.g. Barangay LGU Officer",  type:"text"},
                    ].map(f=>(
                      <div key={f.key}>
                        <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>{f.label}</label>
                        <input
                          type={f.type}
                          value={(editData as any)[f.key]}
                          onChange={e=>setEditData(d=>({...d,[f.key]:e.target.value}))}
                          placeholder={f.ph}
                          style={INP2}
                        />
                      </div>
                    ))}

                    {/* Read-only fields */}
                    <div style={{padding:"10px 12px",borderRadius:9,background:"#f8fafc",border:`1px solid ${EM[100]}`,fontSize:12,color:"#6b7280"}}>
                      <strong style={{color:EM[700]}}>Email</strong> and <strong style={{color:EM[700]}}>barangay assignment</strong> can only be changed by a Super Admin.
                    </div>

                    {saveErr&&<div style={{padding:"8px 12px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b"}}>{saveErr}</div>}

                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button onClick={()=>{setEditing(false);setSaveErr("");setEditData({full_name:profile.full_name,position_title:profile.position_title,email:profile.email});}}
                        style={{padding:"8px 16px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:"#fff",color:EM[700],fontSize:12,fontWeight:600,cursor:"pointer"}}>
                        Cancel
                      </button>
                      <button onClick={saveProfile} disabled={saving||saveOk}
                        style={{padding:"8px 20px",borderRadius:9,background:saveOk?EM[500]:EM[600],color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"background .2s"}}>
                        {saving?"Saving…":saveOk?"✓ Saved!":"Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Avatar tip */}
              <div style={{padding:"11px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[100]}`,fontSize:12,color:EM[700],display:"flex",gap:9,alignItems:"center"}}>
                <span style={{fontSize:16}}>📷</span>
                <span>Tap the camera icon on your photo above to upload a new profile picture. JPG, PNG accepted.</span>
              </div>
            </>
          )}

          {/* ── SECURITY TAB ── */}
          {tab==="security"&&(
            <>
              <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}>
                  <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>🔒 Change Password</span>
                </div>
                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                  {([
                    {label:"New Password",     key:"next",    ph:"Minimum 8 characters"},
                    {label:"Confirm Password", key:"confirm", ph:"Re-enter new password"},
                  ] as const).map(f=>(
                    <div key={f.key}>
                      <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>{f.label}</label>
                      <input
                        type={showPw?"text":"password"}
                        value={pwForm[f.key]}
                        onChange={e=>setPwForm(p=>({...p,[f.key]:e.target.value}))}
                        placeholder={f.ph}
                        style={INP2}
                        onKeyDown={e=>e.key==="Enter"&&changePassword()}
                      />
                    </div>
                  ))}
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:EM[800],userSelect:"none"}}>
                    <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)} style={{accentColor:EM[600],cursor:"pointer"}}/>
                    Show passwords
                  </label>
                  {pwErr&&<div style={{padding:"9px 12px",borderRadius:9,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b",display:"flex",gap:7,alignItems:"center"}}><span>⚠️</span>{pwErr}</div>}
                  {pwOk&&<div style={{padding:"9px 12px",borderRadius:9,background:EM[50],border:`1px solid ${EM[300]}`,fontSize:12,color:EM[800],fontWeight:600,display:"flex",gap:7,alignItems:"center"}}><span>✅</span>Password updated successfully.</div>}
                  <button onClick={changePassword} disabled={pwSaving||!pwForm.next||!pwForm.confirm}
                    style={{padding:"10px 0",borderRadius:9,background:EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",opacity:(!pwForm.next||!pwForm.confirm||pwSaving)?.5:1}}>
                    {pwSaving?"Updating…":"Update Password"}
                  </button>
                </div>
              </div>

              {/* Security tips */}
              <div style={{padding:"14px 16px",borderRadius:12,background:"#fffbeb",border:"1px solid #fde68a",fontSize:12,color:"#78350f",lineHeight:1.7}}>
                <div style={{fontWeight:800,marginBottom:6}}>🛡️ Security Tips</div>
                <ul style={{margin:0,paddingLeft:16}}>
                  <li>Use a strong password — mix letters, numbers, and symbols</li>
                  <li>Never share your credentials with anyone</li>
                  <li>Log out on shared devices after each session</li>
                  <li>Check the Activity tab regularly for unauthorized access</li>
                </ul>
              </div>
            </>
          )}

          {/* ── ACTIVITY TAB ── */}
          {tab==="activity"&&(
            <>
              <div style={{padding:"11px 14px",borderRadius:10,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:12,color:"#1e40af",lineHeight:1.5,display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:15,flexShrink:0}}>ℹ️</span>
                <span>This log records your administrative actions and auth sessions. If you see activity you don't recognize, change your password immediately.</span>
              </div>

              <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Recent Activity</span>
                  <span style={{fontSize:10,color:"#9ca3af"}}>Last 40 entries</span>
                </div>

                {logsLoading?(
                  <div style={{padding:32,textAlign:"center"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${EM[100]}`,borderTopColor:EM[600],animation:"spin 1s linear infinite",margin:"0 auto 8px"}}/>
                    <span style={{fontSize:12,color:"#9ca3af"}}>Loading activity…</span>
                  </div>
                ):logs.length===0?(
                  <div style={{padding:32,textAlign:"center",color:"#9ca3af",fontSize:13}}>No activity logged yet.</div>
                ):(
                  <div>
                    {logs.map((l,i)=>{
                      const {icon,color} = actionIcon(l.action_type??"");
                      const isAuth = l.action_type==="LGU_LOGIN"||l.action_type==="LGU_LOGOUT"||l.action_type==="LOGIN"||l.action_type==="LOGOUT";
                      return (
                        <div key={l.id??i} style={{
                          padding:"11px 16px",
                          borderBottom:`1px solid ${EM[50]}`,
                          display:"flex",gap:12,alignItems:"flex-start",
                          background:isAuth?"#f8fafc":"#fff",
                        }}>
                          {/* Icon badge */}
                          <div style={{
                            width:32,height:32,borderRadius:9,flexShrink:0,
                            background:`${color}15`,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:15,
                          }}>
                            {icon}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{
                              fontSize:12,fontWeight:700,color:EM[900],
                              display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",
                            }}>
                              {(l.action_type??"").replace(/_/g," ")}
                              {isAuth&&<span style={{fontSize:9,fontWeight:800,padding:"1px 7px",borderRadius:20,background:l.action_type?.includes("LOGIN")?"#dcfce7":"#f1f5f9",color:l.action_type?.includes("LOGIN")?"#166534":"#475569"}}>
                                {l.action_type?.includes("LOGIN")?"SESSION START":"SESSION END"}
                              </span>}
                            </div>
                            <div style={{fontSize:11,color:"#6b7280",marginTop:2,lineHeight:1.4}}>{l.reason||"—"}</div>
                            {/* Full timestamp for accountability */}
                            <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{fmtFull(l.created_at)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}



// ── MAIN PAGE ─────────────────────────────────────────────────────────────────