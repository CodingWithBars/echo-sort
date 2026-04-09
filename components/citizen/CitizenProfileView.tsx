"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/citizen/CitizenProfileView.tsx
// Full citizen profile: account info, score, violations, reports filed,
// broadcasts, notification preferences, account settings
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  User, ShieldAlert, AlertTriangle, CheckCircle, Flag,
  Megaphone, Bell, Settings, Edit2, Save, X, ChevronRight,
  Calendar, TrendingUp, Trash2, Clock,
} from "lucide-react";

const supabase = createClient();

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface CitizenProfile {
  id: string; full_name: string; email: string; contact_number: string;
  warning_count: number; barangay: string; municipality: string;
  purok: string; address_street: string; house_lot_number: string;
  service_type: string; created_at: string;
}
interface ScoreRecord { score: number; score_month: string; violations_count: number; warnings_count: number; resolved_count: number; }
interface Violation { id: string; type: string; description: string; status: string; created_at: string; resolved_at: string | null; }
interface MyReport { id: string; type: string; description: string; status: string; created_at: string; }

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const EM = {
  900:"#064e3b",800:"#065f46",700:"#047857",600:"#059669",
  500:"#10b981",400:"#34d399",300:"#6ee7b7",200:"#a7f3d0",
  100:"#d1fae5",50:"#ecfdf5",
};
const STATUS_CFG: Record<string,{dot:string;text:string;bg:string}> = {
  Pending:       {dot:"#f59e0b",text:"#92400e",bg:"#fef3c7"},
  "Under Review":{dot:"#3b82f6",text:"#1e40af",bg:"#eff6ff"},
  Resolved:      {dot:EM[600],  text:EM[800],  bg:EM[50]},
  Submitted:     {dot:"#8b5cf6",text:"#5b21b6",bg:"#f5f3ff"},
  Escalated:     {dot:"#ef4444",text:"#991b1b",bg:"#fef2f2"},
  Dismissed:     {dot:"#6b7280",text:"#374151",bg:"#f1f5f9"},
};

const scoreColor = (s:number) => s>=90?EM[600]:s>=70?"#16a34a":s>=50?"#d97706":s>=30?"#ea580c":"#dc2626";
const scoreTier  = (s:number) => s>=90?"Excellent":s>=70?"Good":s>=50?"Fair":s>=30?"Poor":"Critical";

const timeAgo = (iso:string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if (m<1) return "just now"; if (m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};
const fmtDate = (iso:string) => iso ? new Date(iso).toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"}) : "—";
const fmtMonth = (iso:string) => new Date(iso).toLocaleDateString("en-PH",{month:"short",year:"numeric"});

const INP: React.CSSProperties = {
  padding:"9px 12px",borderRadius:9,border:`1.5px solid ${EM[200]}`,
  background:EM[50],color:EM[900],fontSize:13,outline:"none",
  fontFamily:"sans-serif",width:"100%",boxSizing:"border-box",
};

// ── SCORE RING ────────────────────────────────────────────────────────────────

function ScoreRing({score,size=90}:{score:number;size?:number}) {
  const r=34,cx=42,cy=42,circ=2*Math.PI*r;
  const dash=(score/100)*circ;
  const col=scoreColor(score);
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${col}20`} strokeWidth="7"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%",transition:"stroke-dasharray .6s"}}/>
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="16" fontWeight="900" fill={col} fontFamily="Georgia,serif">{score}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize="8" fontWeight="700" fill="#9ca3af" fontFamily="sans-serif">/ 100</text>
    </svg>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────────────────────

function SectionHeader({icon:Icon,title,count}:{icon:any;title:string;count?:number}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"4px 0"}}>
      <div style={{width:28,height:28,borderRadius:8,background:EM[100],display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={14} color={EM[600]}/></div>
      <span style={{fontSize:13,fontWeight:800,color:EM[800],letterSpacing:"-.01em"}}>{title}</span>
      {count!==undefined&&<span style={{fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20,background:EM[50],color:EM[600]}}>{count}</span>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

interface CitizenProfileViewProps {
  userId?: string; // if not passed, loads from auth session
}

export default function CitizenProfileView({ userId }: CitizenProfileViewProps) {
  const [profile,    setProfile]    = useState<CitizenProfile|null>(null);
  const [scores,     setScores]     = useState<ScoreRecord[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [myReports,  setMyReports]  = useState<MyReport[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [editData,   setEditData]   = useState<Partial<CitizenProfile>>({});
  const [activeSection, setActiveSection] = useState<"overview"|"violations"|"reports"|"settings">("overview");

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
      supabase.from("profiles").select("id,full_name,email,contact_number,warning_count").eq("id", uid).single(),
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

  const startEdit = () => {
    if (!profile) return;
    setEditData({
      full_name: profile.full_name,
      contact_number: profile.contact_number,
      purok: profile.purok,
      address_street: profile.address_street,
      house_lot_number: profile.house_lot_number,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({
      full_name: editData.full_name,
      contact_number: editData.contact_number,
    }).eq("id", profile.id);
    await supabase.from("citizen_details").update({
      purok: editData.purok,
      address_street: editData.address_street,
      house_lot_number: editData.house_lot_number,
    }).eq("id", profile.id);
    setSaving(false); setSaveOk(true);
    setTimeout(() => { setSaveOk(false); setEditing(false); fetchData(); }, 1000);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${EM[200]}`, borderTopColor: EM[600], animation: "spin 1s linear infinite" }}/>
    </div>
  );

  if (!profile) return (
    <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Could not load profile.</div>
  );

  const currentScore = scores[0]?.score ?? 100;
  const openViolations = violations.filter(v => v.status !== "Resolved").length;

  const SECTIONS = [
    { id: "overview",   label: "Overview",   icon: TrendingUp },
    { id: "violations", label: "Violations", icon: AlertTriangle, badge: openViolations },
    { id: "reports",    label: "My Reports", icon: Flag,           badge: myReports.filter(r=>r.status==="Submitted").length },
    { id: "settings",   label: "Settings",   icon: Settings },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", color: EM[900] }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .pf-tab{transition:all .15s;cursor:pointer;}
        .pf-tab:hover{background:${EM[100]}!important;}
        input::placeholder,textarea::placeholder{color:#9ca3af;}
        select option{color:${EM[900]};background:#fff;}
      `}</style>

      {/* ── PROFILE HERO ── */}
      <div style={{ background: `linear-gradient(135deg, ${EM[800]}, ${EM[900]})`, borderRadius: 18, padding: "24px", marginBottom: 16, position: "relative", overflow: "hidden", animation: "fadeUp .4s ease both" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.04)" }}/>
        <div style={{ position: "absolute", bottom: -20, right: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.03)" }}/>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", position: "relative" }}>
          {/* Avatar */}
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${EM[400]}, ${EM[500]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, color: "#fff", flexShrink: 0, border: "3px solid rgba(255,255,255,.2)" }}>
            {(profile.full_name ?? "C").charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", fontFamily: "Georgia,serif", marginBottom: 2 }}>{profile.full_name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", marginBottom: 6 }}>{profile.email}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)" }}>📍 {profile.barangay}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)" }}>🏠 {profile.service_type ?? "General"}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)" }}>📅 Joined {fmtDate(profile.created_at).split(",")[0]}</span>
            </div>
          </div>

          {/* Score ring */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <ScoreRing score={currentScore} size={90}/>
            <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(currentScore), marginTop: 2 }}>{scoreTier(currentScore)}</div>
          </div>
        </div>

        {/* Warning banner */}
        {profile.warning_count > 0 && (
          <div style={{ marginTop: 14, padding: "8px 14px", borderRadius: 10, background: profile.warning_count >= 3 ? "rgba(239,68,68,.2)" : "rgba(245,158,11,.15)", border: `1px solid ${profile.warning_count >= 3 ? "rgba(239,68,68,.4)" : "rgba(245,158,11,.3)"}`, display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            <ShieldAlert size={15} color={profile.warning_count >= 3 ? "#f87171" : "#fcd34d"}/>
            <span style={{ fontSize: 12, fontWeight: 700, color: profile.warning_count >= 3 ? "#f87171" : "#fcd34d" }}>
              {profile.warning_count} active warning{profile.warning_count !== 1 ? "s" : ""}
              {profile.warning_count >= 3 ? " — Eligible for barangay proceedings (RA 9003)" : " — 3 warnings trigger formal proceedings"}
            </span>
          </div>
        )}
      </div>

      {/* ── SECTION TABS ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto" }}>
        {SECTIONS.map(s => {
          const SIcon = s.icon;
          const active = activeSection === s.id;
          return (
            <button key={s.id} className="pf-tab" onClick={() => setActiveSection(s.id as any)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${active ? EM[300] : EM[100]}`, background: active ? EM[50] : "#fff", fontWeight: active ? 700 : 500, color: active ? EM[700] : "#6b7280", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" }}>
              <SIcon size={14}/>{s.label}
              {(s as any).badge > 0 && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 20, background: "#ef4444", color: "#fff" }}>{(s as any).badge}</span>}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp .3s ease both" }}>
          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {[
              { icon: "⭐", label: "Eco Score",  value: currentScore, unit: "/100", color: scoreColor(currentScore) },
              { icon: "⚠️", label: "Warnings",   value: profile.warning_count, unit: "active",  color: profile.warning_count > 0 ? "#dc2626" : EM[600] },
              { icon: "🚨", label: "Violations", value: openViolations, unit: "open",    color: openViolations > 0 ? "#d97706" : EM[600] },
              { icon: "🚩", label: "Reports",    value: myReports.length, unit: "filed",   color: EM[600] },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `1.5px solid ${EM[100]}`, textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "Georgia,serif", lineHeight: 1, marginTop: 6 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{s.unit}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: EM[700], marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Account info */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${EM[100]}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <SectionHeader icon={User} title="Account Information"/>
              {!editing && (
                <button onClick={startEdit} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, background: EM[50], color: EM[700], border: `1.5px solid ${EM[200]}`, cursor: "pointer" }}>
                  <Edit2 size={12}/> Edit
                </button>
              )}
            </div>

            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Full Name",     key: "full_name",      ph: "Your full name" },
                  { label: "Contact #",     key: "contact_number", ph: "e.g. 09XX-XXX-XXXX" },
                  { label: "Purok",         key: "purok",          ph: "e.g. Purok 1" },
                  { label: "Street",        key: "address_street", ph: "Street address" },
                  { label: "Lot / House #", key: "house_lot_number",ph: "e.g. Lot 12 Block 3" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, fontWeight: 800, color: EM[700], letterSpacing: ".08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input
                      value={(editData as any)[f.key] ?? ""}
                      onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={INP}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditing(false)} style={{ padding: "8px 16px", borderRadius: 9, border: `1.5px solid ${EM[200]}`, background: "#fff", color: EM[700], fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveEdit} disabled={saving || saveOk} style={{ padding: "8px 20px", borderRadius: 9, background: saveOk ? "#059669" : EM[600], color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                    {saving ? "Saving…" : saveOk ? <><CheckCircle size={13}/>Saved!</> : <><Save size={13}/>Save</>}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                {[
                  { label: "Barangay",     value: profile.barangay },
                  { label: "Municipality", value: profile.municipality },
                  { label: "Purok",        value: profile.purok ?? "—" },
                  { label: "Street",       value: profile.address_street ?? "—" },
                  { label: "Lot / House",  value: profile.house_lot_number ?? "—" },
                  { label: "Contact",      value: profile.contact_number ?? "—" },
                  { label: "Service Type", value: profile.service_type ?? "General" },
                  { label: "Member Since", value: fmtDate(profile.created_at) },
                ].map(f => (
                  <div key={f.label} style={{ background: EM[50], borderRadius: 10, padding: "10px 12px", border: `1px solid ${EM[100]}` }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: EM[600], letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: EM[900] }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score trend (last 6 months) */}
          {scores.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${EM[100]}` }}>
              <SectionHeader icon={TrendingUp} title="Score Trend"/>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 70 }}>
                {scores.slice(0, 6).reverse().map((s, i) => {
                  const h = Math.max(10, (s.score / 100) * 70);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: scoreColor(s.score) }}>{s.score}</div>
                      <div style={{ width: "100%", borderRadius: 4, background: scoreColor(s.score), height: h, transition: "height .4s", opacity: 0.6 + i * 0.08 }}/>
                      <div style={{ fontSize: 9, color: "#9ca3af" }}>{fmtMonth(s.score_month).split(" ")[0]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIOLATIONS ── */}
      {activeSection === "violations" && (
        <div style={{ animation: "fadeUp .3s ease both" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${EM[100]}` }}>
            <SectionHeader icon={AlertTriangle} title="Violation History" count={violations.length}/>
            {violations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <CheckCircle size={28} color={EM[400]} style={{ margin: "0 auto 10px" }}/>
                <p style={{ color: EM[700], fontSize: 13, margin: 0 }}>No violations on record — great work! 🌿</p>
              </div>
            ) : violations.map(v => {
              const sc = STATUS_CFG[v.status] ?? STATUS_CFG.Pending;
              return (
                <div key={v.id} style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: `1.5px solid ${EM[100]}`, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, marginTop: 6, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: EM[900] }}>{v.type.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text }}>{v.status}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{timeAgo(v.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{v.description ?? "No description provided."}</p>
                    {v.resolved_at && (
                      <div style={{ fontSize: 11, color: EM[600], marginTop: 4, fontWeight: 600 }}>✓ Resolved on {fmtDate(v.resolved_at)}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* How to clear violations */}
            {openViolations > 0 && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12, color: "#78350f" }}>
                💡 To clear violations, comply with RA 9003 waste segregation rules and contact your LGU officer.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MY REPORTS ── */}
      {activeSection === "reports" && (
        <div style={{ animation: "fadeUp .3s ease both" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${EM[100]}` }}>
            <SectionHeader icon={Flag} title="Reports I Filed" count={myReports.length}/>
            <div style={{ padding: "8px 12px", borderRadius: 9, background: EM[50], border: `1px solid ${EM[100]}`, fontSize: 12, color: EM[700], marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              🔒 Your identity is kept confidential. Reported persons cannot see who filed this report.
            </div>
            {myReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Flag size={28} color={EM[200]} style={{ margin: "0 auto 10px" }}/>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No reports filed yet.</p>
              </div>
            ) : myReports.map(r => {
              const sc = STATUS_CFG[r.status] ?? STATUS_CFG.Submitted;
              return (
                <div key={r.id} style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: `1.5px solid ${EM[100]}`, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, marginTop: 6, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: EM[900] }}>{r.type.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text }}>{r.status}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{timeAgo(r.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{r.description ?? "No description"}</p>
                    {r.status === "Escalated" && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>⚠️ Escalated to a formal violation</div>
                    )}
                    {r.status === "Dismissed" && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>This report was reviewed and dismissed by the LGU.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {activeSection === "settings" && (
        <div style={{ animation: "fadeUp .3s ease both" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${EM[100]}`, marginBottom: 14 }}>
            <SectionHeader icon={Bell} title="Notification Preferences"/>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 14px", lineHeight: 1.6 }}>
              Notifications are delivered in-app. Enable push notifications in your browser for real-time alerts about warnings, violations, and barangay broadcasts.
            </p>
            {[
              { label: "⚠️ Warning issued",       desc: "When LGU issues a warning against your account"      },
              { label: "🚨 Violation filed",       desc: "When a formal violation is filed against you"        },
              { label: "✅ Violation resolved",    desc: "When your violation case is resolved"                },
              { label: "📢 Barangay broadcasts",   desc: "Announcements, schedule changes, awareness tips"     },
              { label: "🚩 Report status update",  desc: "When your filed report changes status"               },
            ].map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < 4 ? `1px solid ${EM[50]}` : "none" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: EM[900] }}>{n.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{n.desc}</div>
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: EM[500], position: "relative", cursor: "pointer" }}>
                  <div style={{ position: "absolute", right: 2, top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff" }}/>
                </div>
              </div>
            ))}
          </div>

          {/* RA 9003 Guide */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${EM[100]}` }}>
            <SectionHeader icon={Trash2} title="Waste Segregation Guide"/>
            {[
              { icon: "🟢", label: "Biodegradable",  desc: "Food scraps, garden waste, paper, leaves. Collected separately.", color: "#16a34a" },
              { icon: "🔵", label: "Recyclable",      desc: "Plastic bottles, cans, glass, cardboard, metals.", color: "#2563eb" },
              { icon: "🔴", label: "Residual",        desc: "Non-recyclable, non-biodegradable waste. Diapers, soiled materials.", color: "#dc2626" },
              { icon: "⚫", label: "Special / Hazardous", desc: "Batteries, electronics, chemicals, syringes. Requires special disposal.", color: "#374151" },
            ].map(w => (
              <div key={w.label} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: `1px solid ${EM[50]}` }}>
                <div style={{ fontSize: 20 }}>{w.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: w.color }}>{w.label}</div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0", lineHeight: 1.5 }}>{w.desc}</p>
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "12px 0 0", lineHeight: 1.6 }}>
              Under RA 9003, failure to segregate waste is subject to fines and warnings. Repeat offenders may face barangay proceedings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}