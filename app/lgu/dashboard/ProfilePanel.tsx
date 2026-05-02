"use client";
// app/lgu/dashboard/ProfilePanel.tsx

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Camera, Shield, Activity, Lock, CheckCircle, Save, ArrowLeft } from "lucide-react";
import { THEME, SLIDE_IN_RIGHT, INP } from "./_constants";
import type { LGUProfile, AvatarRow, AuditLogRow } from "./_types";

const supabase = createClient();

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

  const [avatarUrl,    setAvatarUrl]    = useState<string|null>(profile.avatar_url ?? null);
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  const [pwForm,       setPwForm]       = useState({next:"",confirm:""});
  const [showPw,       setShowPw]       = useState(false);
  const [pwSaving,     setPwSaving]     = useState(false);
  const [pwOk,         setPwOk]         = useState(false);
  const [pwErr,        setPwErr]        = useState("");

  const [logs,         setLogs]         = useState<LogEntry[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);

  useEffect(()=>{
    supabase.from("profiles").select("avatar_url").eq("id",profile.id).single()
      .then((res: { data: AvatarRow|null; error: unknown }) => {
        if (res.data?.avatar_url) setAvatarUrl(res.data.avatar_url);
      });
  },[profile.id]);

  useEffect(()=>{
    if (tab!=="activity") return;
    setLogsLoading(true);
    supabase.from("audit_logs").select("id,action_type,reason,created_at")
      .eq("admin_id",profile.id)
      .order("created_at",{ascending:false})
      .limit(40)
      .then((res: { data: AuditLogRow[]|null; error: unknown }) => {
        setLogs((res.data??[]).map(l=>({...l,_session:false})));
        setLogsLoading(false);
      });
  },[tab,profile.id]);

  const handleAvatarChange = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type});
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({avatar_url:publicUrl}).eq("id",profile.id);
    setAvatarUrl(publicUrl);
    setUploading(false);
    onRefresh();
  };

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

  const changePassword = async () => {
    setPwErr("");
    if (!pwForm.next||pwForm.next!==pwForm.confirm) { setPwErr("Passwords do not match."); return; }
    if (pwForm.next.length<8) { setPwErr("Minimum 8 characters required."); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({password:pwForm.next});
    if (error) { setPwErr(error.message); setPwSaving(false); return; }
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

  const fmtFull = (iso:string) => new Date(iso).toLocaleString("en-PH",{
    month:"short",day:"numeric",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:true,
  });

  const initials = (profile.full_name??"L").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const TABS_LIST = [
    {id:"profile",  label:"Profile",  icon: Shield },
    {id:"security", label:"Security", icon: Lock },
    {id:"activity", label:"Activity", icon: Activity },
  ] as const;

  return (
    <>
      <style>{SLIDE_IN_RIGHT}</style>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(12px)",zIndex:3000}}/>

      <div style={{
        position:"fixed",top:0,right:0,bottom:0,zIndex:3001,
        width:"min(480px, 100vw)",background:"#fff",
        boxShadow:"-12px 0 50px rgba(0,0,0,0.15)",
        display:"flex",flexDirection:"column",
        animation:"slideInRight .4s cubic-bezier(0.16, 1, 0.3, 1) both",
        fontFamily:"sans-serif",
        overflow:"hidden"
      }}>
        
        {/* Header - Super Admin Style */}
        <div style={{ padding: "24px", borderBottom: "1px solid #f3f4f6", background: "#f9fafb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1c4532", letterSpacing: ".05em", textTransform: "uppercase" }}>LGU Command Node</span>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} color="#6b7280" />
            </button>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: "#1c4532", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "2px solid #a3d4bb" }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{initials}</span>
                )}
                {uploading && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #1c4532", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
                  </div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: 8, background: "#1c4532", border: "2px solid #fff", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Camera size={14} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: "-0.02em" }}>{profile.full_name}</div>
              <div style={{ fontSize: 12, color: "#1c4532", marginTop: 2, fontWeight: 700, textTransform: "uppercase" }}>{profile.position_title}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{profile.email}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", flexShrink: 0, background: "#fff" }}>
          {TABS_LIST.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "14px 0", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#1c4532" : "#6b7280", borderBottom: isActive ? "2px solid #1c4532" : "2px solid transparent", transition: "all .15s" }}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20, background: "#f9fafb" }}>
          
          {tab === "profile" && (
            <>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Node Identity</span>
                  {!editing && (
                    <button onClick={() => setEditing(true)} style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, background: "#f3f4f6", color: "#1c4532", border: "none", cursor: "pointer", textTransform: "uppercase" }}>Edit</button>
                  )}
                </div>
                
                {editing ? (
                  <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Full Name</label>
                      <input value={editData.full_name} onChange={e => setEditData(prev => ({ ...prev, full_name: e.target.value }))} style={INP} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Position Title</label>
                      <input value={editData.position_title} onChange={e => setEditData(prev => ({ ...prev, position_title: e.target.value }))} style={INP} />
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", padding: "12px", background: "#f9fafb", borderRadius: 12, border: "1px solid #f3f4f6" }}>
                      Administrative region (Barangay/Municipality) can only be updated by the Super Admin node.
                    </div>
                    {saveErr && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{saveErr}</div>}
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditing(false); setSaveErr(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#4b5563", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
                      <button onClick={saveProfile} disabled={saving || saveOk} style={{ padding: "10px 20px", borderRadius: 10, background: saveOk ? "#059669" : "#1c4532", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>
                        {saving ? "Saving…" : saveOk ? "Saved!" : "Sync Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    {[
                      { l: "Operational Zone", v: profile.barangay },
                      { l: "Jurisdiction", v: profile.municipality },
                      { l: "Node Assignment", v: profile.position_title },
                      { l: "Sync Channel", v: profile.email },
                    ].map(f => (
                      <div key={f.l} style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 16px", border: "1px solid #f3f4f6" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>{f.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{f.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: "#111827", borderRadius: 16, padding: "20px", color: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1c4532", textTransform: "uppercase", letterSpacing: "0.1em" }}>LGU Protocol</div>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8, lineHeight: 1.6 }}>You are an authorized node for EcoRoute Governance. Your actions are audited in real-time under RA 9003 regulatory frameworks.</p>
              </div>
            </>
          )}

          {tab === "security" && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Auth Credentials</span>
              </div>
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", display: "block", marginBottom: 6 }}>New Node Password</label>
                  <input type={showPw ? "text" : "password"} value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Confirm New Password</label>
                  <input type={showPw ? "text" : "password"} value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} style={INP} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#4b5563", userSelect: "none" }}>
                  <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} style={{ accentColor: "#1c4532" }} />
                  Show passwords
                </label>
                {pwErr && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{pwErr}</div>}
                {pwOk && <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ Password updated successfully.</div>}
                <button onClick={changePassword} disabled={pwSaving || !pwForm.next || !pwForm.confirm} style={{ padding: "12px", borderRadius: 12, background: "#1c4532", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", opacity: (pwSaving || !pwForm.next || !pwForm.confirm) ? 0.6 : 1 }}>
                  {pwSaving ? "Syncing…" : "Apply New Protocol"}
                </button>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Audit Transmission Log</span>
              </div>
              {logsLoading ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#1c4532", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                </div>
              ) : logs.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>No activity recorded</div>
              ) : (
                <div>
                  {logs.map((l, i) => (
                    <div key={l.id ?? i} style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📋</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{l.action_type.replace(/_/g, " ")}</div>
                        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>{l.reason || "Automatic system log"}</p>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>{fmtFull(l.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}