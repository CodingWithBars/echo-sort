"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/citizen/CitizenProfileView.tsx
// Full citizen profile: account info, score, violations, reports filed,
// broadcasts, notification preferences, account settings
// Refined to match the SuperAdminProfilePanel style
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  User, ShieldAlert, AlertTriangle, CheckCircle, Flag,
  Megaphone, Bell, Settings, Edit2, Save, X, ChevronRight,
  Calendar, TrendingUp, Trash2, Clock, Info, Shield, 
  MapPin, Phone, Mail, Award, AlertCircle, FileText,
  Camera, ArrowLeft, Lock, Trash
} from "lucide-react";

const supabase = createClient();

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface CitizenProfile {
  id: string; full_name: string; email: string; contact_number: string;
  warning_count: number; barangay: string; municipality: string;
  purok: string; address_street: string; house_lot_number: string;
  service_type: string; created_at: string; avatar_url?: string;
}
interface ScoreRecord { score: number; score_month: string; violations_count: number; warnings_count: number; resolved_count: number; }
interface Violation { id: string; type: string; description: string; status: string; created_at: string; resolved_at: string | null; }
interface MyReport { id: string; type: string; description: string; status: string; created_at: string; }

const THEME = {
  primary: "#1c4532",
  accent: "#e6f0eb",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f9fafb",
};

const VIOLATION_STATUS: Record<string,{dot:string;text:string;bg:string}> = {
  Pending:       {dot:"#d97706",text:"#b45309",bg:"#fef3c7"},
  "Under Review":{dot:"#2563eb",text:"#1d4ed8",bg:"#dbeafe"},
  Resolved:      {dot:"#059669",text:"#047857",bg:"#d1fae5"},
};

const scoreColor = (s:number) => s>=90?"#059669":s>=70?"#38a169":s>=50?"#d97706":s>=30?"#ea580c":"#dc2626";
const scoreTier  = (s:number) => s>=90?"Excellent":s>=70?"Good":s>=50?"Fair":s>=30?"Poor":"Critical";

const fmtDate = (iso:string) => iso ? new Date(iso).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) : "—";
const fmtFull = (iso:string) => new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});

// ── COMPONENTS ────────────────────────────────────────────────────────────────

const INP:React.CSSProperties = {width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #d1d5db",background:"#f9fafb",color:"#111827",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"};

export default function CitizenProfileView({ userId, onClose }: { userId?: string; onClose?: () => void }) {
  const [profile,    setProfile]    = useState<CitizenProfile|null>(null);
  const [scores,     setScores]     = useState<ScoreRecord[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [myReports,  setMyReports]  = useState<MyReport[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<"overview"|"violations"|"reports"|"settings">("overview");
  
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [saveErr,    setSaveErr]    = useState("");
  const [editData,   setEditData]   = useState<Partial<CitizenProfile>>({});
  
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      uid = user.id;
    }

    const [
      { data: p }, { data: cd },
      { data: sc }, { data: viol }, { data: reps }
    ] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,contact_number,warning_count,avatar_url").eq("id", uid).single(),
      supabase.from("citizen_details").select("barangay,municipality,purok,address_street,house_lot_number,service_type,created_at").eq("id", uid).single(),
      supabase.from("citizen_scores").select("*").eq("citizen_id", uid).order("score_month", { ascending: false }).limit(12),
      supabase.from("violations").select("*").eq("citizen_id", uid).order("created_at", { ascending: false }),
      supabase.from("citizen_reports_public").select("*").order("created_at", { ascending: false }),
    ]);

    if (p && cd) setProfile({ ...p, ...cd });
    setScores(sc ?? []);
    setViolations(viol ?? []);
    setMyReports(reps ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !profile) return;
    const f = e.target.files[0]; setUploading(true);
    try {
      const ext = f.name.split('.').pop(); 
      const path = `${profile.id}/avatar_${Date.now()}.${ext}`;
      
      const { error: uErr } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
      if (uErr) throw uErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true); setSaveErr(""); setSaveOk(false);
    try {
      const { error: pErr } = await supabase.from("profiles").update({
        full_name: editData.full_name,
        contact_number: editData.contact_number,
      }).eq("id", profile.id);
      if (pErr) throw pErr;

      const { error: dErr } = await supabase.from("citizen_details").update({
        purok: editData.purok,
        address_street: editData.address_street,
        house_lot_number: editData.house_lot_number,
      }).eq("id", profile.id);
      if (dErr) throw dErr;

      setSaveOk(true);
      setTimeout(() => { setEditing(false); setSaveOk(false); fetchData(); }, 1500);
    } catch (err: any) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#1c4532", animation: "spin 1s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!profile) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Profile not found.</div>;

  const currentScore = scores[0]?.score ?? 100;
  const openViolations = violations.filter(v => v.status !== "Resolved").length;
  const initials = profile.full_name ? profile.full_name.charAt(0).toUpperCase() : "?";

  const TABS = [
    { id: "overview",   label: "Overview",   icon: "📊" },
    { id: "violations", label: "Violations", icon: "⚠️", badge: openViolations },
    { id: "reports",    label: "Reports",    icon: "📋" },
    { id: "settings",   label: "Settings",   icon: "⚙️" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", fontFamily: "sans-serif" }}>
      
      {/* Header Section - SuperAdmin Style */}
      <div style={{ padding: "24px", borderBottom: "1px solid #f3f4f6", background: "#f9fafb", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1c4532", letterSpacing: ".05em", textTransform: "uppercase" }}>Citizen Registry Node</span>
          {onClose && (
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} color="#6b7280" />
            </button>
          )}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: profile.avatar_url ? "#f3f4f6" : "#e6f0eb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "2px solid #a3d4bb" }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 28, fontWeight: 700, color: "#1c4532" }}>{initials}</span>
              )}
              {uploading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #1c4532", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
                </div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: 8, background: "#1c4532", border: "2px solid #fff", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }} title="Change photo">📷</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: "none" }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: "-0.02em" }}>{profile.full_name}</div>
            <div style={{ fontSize: 12, color: "#1c4532", marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: scoreColor(currentScore) }} />
              {scoreTier(currentScore)} Integrity
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{profile.email}</div>
          </div>
        </div>
      </div>

      {/* Tabs - SuperAdmin Style */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", flexShrink: 0, background: "#fff" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ flex: 1, padding: "14px 0", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#1c4532" : "#6b7280", borderBottom: tab === t.id ? "2px solid #1c4532" : "2px solid transparent", transition: "all .15s", position: "relative" }}>
            <span>{t.icon}</span>{t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span style={{ position: "absolute", top: 10, right: 10, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 6, border: "2px solid #fff" }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area - Scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20, background: "#f9fafb" }}>
        
        {tab === "overview" && (
          <>
            {/* Account Details Card */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Node Identity</span>
                {!editing && (
                  <button onClick={() => { setEditData({ ...profile }); setEditing(true); }} style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, background: "#f3f4f6", color: "#1c4532", border: "none", cursor: "pointer", textTransform: "uppercase" }}>Edit</button>
                )}
              </div>
              
              {editing ? (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    { label: "Full Name", key: "full_name" },
                    { label: "Contact Number", key: "contact_number" },
                    { label: "Purok", key: "purok" },
                    { label: "Street", key: "address_street" },
                    { label: "House / Lot #", key: "house_lot_number" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <input value={(editData as any)[f.key] || ""} onChange={e => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))} style={INP} />
                    </div>
                  ))}
                  {saveErr && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fee2e2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>{saveErr}</div>}
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={() => { setEditing(false); setSaveErr(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#4b5563", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
                    <button onClick={saveProfile} disabled={saving || saveOk} style={{ padding: "10px 20px", borderRadius: 10, background: saveOk ? "#059669" : "#1c4532", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>
                      {saving ? "Saving…" : saveOk ? "Saved!" : "Sync Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  {[
                    { l: "Barangay Node", v: profile.barangay },
                    { l: "Sub-Node (Purok)", v: profile.purok || "—" },
                    { l: "Deployment Zone", v: profile.address_street || "—" },
                    { l: "Lot Identifier", v: profile.house_lot_number || "—" },
                    { l: "Service Category", v: profile.service_type || "General" },
                    { l: "Communication", v: profile.contact_number || "—" },
                    { l: "Operational Since", v: fmtDate(profile.created_at) },
                  ].map(f => (
                    <div key={f.l} style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 16px", border: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>{f.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{f.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Eco Score Integration Card */}
            <div style={{ background: "#1c4532", borderRadius: 16, padding: "20px", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 10px 25px rgba(28,69,50,0.2)" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8 }}>Integrity Index</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>{currentScore}<span style={{ fontSize: 14, opacity: 0.6 }}>/100</span></div>
              </div>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={28} />
              </div>
            </div>
          </>
        )}

        {tab === "violations" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Protocol Breaches</span>
            </div>
            {violations.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🌿</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1c4532" }}>No Active Breaches</div>
                <p style={{ fontSize: 11, marginTop: 4 }}>Your account is in full compliance with RA 9003.</p>
              </div>
            ) : (
              <div>
                {violations.map(v => {
                  const sc = VIOLATION_STATUS[v.status] || VIOLATION_STATUS.Pending;
                  return (
                    <div key={v.id} style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{v.type.replace(/_/g, " ")}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: sc.bg, color: sc.text }}>{v.status}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>{v.description}</p>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>Filed: {fmtFull(v.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Incident Transmissions</span>
            </div>
            {myReports.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>📡</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>No Logs Found</div>
              </div>
            ) : (
              <div>
                {myReports.map(r => (
                  <div key={r.id} style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📋</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{r.type.replace(/_/g, " ")}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#e6f0eb", color: "#1c4532" }}>{r.status}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>{r.description}</p>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>Dispatched: {fmtFull(r.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Preferences Card */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Signal Management</span>
              </div>
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { l: "Warning Alerts", d: "High priority compliance signals" },
                  { l: "Network Broadcasts", d: "LGU system updates" },
                  { l: "Telemetry Logs", d: "Transmission lifecycle events" },
                ].map(item => (
                  <div key={item.l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f9fafb", borderRadius: 12, border: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{item.l}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textTransform: "uppercase" }}>{item.d}</div>
                    </div>
                    <div style={{ width: 36, height: 18, borderRadius: 10, background: "#1c4532", display: "flex", justifyContent: "flex-end", padding: 2, cursor: "pointer" }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Support/Info Card */}
            <div style={{ background: "#111827", borderRadius: 16, padding: "20px", color: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1c4532", textTransform: "uppercase", letterSpacing: "0.1em" }}>System Protocol</div>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8, lineHeight: 1.6 }}>RA 9003 Compliance is monitored 24/7. Your Eco Score impacts your node standing within the LGU network.</p>
              <button style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>View Legal Guidelines</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}