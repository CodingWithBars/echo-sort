"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/lgu/dashboard/page.tsx
// Drop this file at:  app/lgu/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LGU Dashboard
// Route: /lgu/dashboard
//
// Scope: Citizens registered under this LGU's assigned barangay.
// Features:
//   • Citizen roster with search + filter
//   • Violation oversight (pending / under review / resolved)
//   • Waste collection summary (bins in their barangay)
//   • Warning escalation (increment citizen warning_count)
//   • RA 9003 compliance snapshot
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Users, AlertTriangle, CheckCircle, Clock, Trash2,
  Search, LogOut, ChevronRight, Bell, FileText,
  BarChart3, MapPin, RefreshCw, ShieldAlert,
} from "lucide-react";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LGUProfile {
  id: string;
  full_name: string;
  email: string;
  barangay: string;
  municipality: string;
  position_title: string;
}

interface Citizen {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  warning_count: number;
  is_archived: boolean;
  purok: string;
  address_street: string;
  created_at: string;
}

interface Violation {
  id: string;
  citizen_id: string;
  citizen_name?: string;
  type: string;
  description: string;
  status: "Pending" | "Under Review" | "Resolved";
  created_at: string;
  resolved_at: string | null;
}

interface BinSummary {
  id: number;
  name: string;
  fill_level: number;
  battery_level: number;
  last_seen: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fillColor = (level: number) => {
  if (level >= 90) return { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" };
  if (level >= 70) return { bg: "#fff7ed", text: "#9a3412", dot: "#f97316" };
  if (level >= 40) return { bg: "#fefce8", text: "#854d0e", dot: "#eab308" };
  return { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" };
};

const statusConfig = {
  Pending:       { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b", label: "Pending"       },
  "Under Review":{ bg: "#eff6ff", text: "#1e40af", dot: "#3b82f6", label: "Under Review"  },
  Resolved:      { bg: "#f0fdf4", text: "#166534", dot: "#22c55e", label: "Resolved"      },
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent, delay = 0,
}: {
  icon: any; label: string; value: string | number;
  sub?: string; accent: string; delay?: number;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "20px 22px",
        border: "1.5px solid #e9ecf2",
        boxShadow: "0 2px 16px rgba(15,23,60,.06)",
        display: "flex", flexDirection: "column", gap: 12,
        animation: `fadeUp .5s ease ${delay}s both`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".08em", textTransform: "uppercase", fontFamily: "sans-serif" }}>
          {label}
        </span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#111827", lineHeight: 1, fontFamily: "Georgia, serif" }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, fontFamily: "sans-serif" }}>{sub}</div>}
      </div>
      <div style={{ height: 3, borderRadius: 2, background: `${accent}22` }}>
        <div style={{ height: "100%", width: "60%", borderRadius: 2, background: accent }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();

  const [profile,    setProfile]    = useState<LGUProfile | null>(null);
  const [citizens,   setCitizens]   = useState<Citizen[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [bins,       setBins]       = useState<BinSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<"citizens" | "violations" | "bins">("citizens");
  const [search,     setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [escalating, setEscalating] = useState<string | null>(null);

  // ── Fetch all data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // LGU profile + detail
    const { data: pData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .single();

    const { data: lguData } = await supabase
      .from("lgu_details")
      .select("barangay, municipality, position_title")
      .eq("id", user.id)
      .single();

    if (!pData || !lguData) { router.push("/login"); return; }

    const me: LGUProfile = {
      id: pData.id,
      full_name: pData.full_name ?? "LGU Official",
      email: pData.email ?? "",
      barangay: lguData.barangay,
      municipality: lguData.municipality ?? "",
      position_title: lguData.position_title ?? "LGU Official",
    };
    setProfile(me);

    // Citizens in this barangay
    const { data: citizenDetails } = await supabase
      .from("citizen_details")
      .select("id, purok, address_street, created_at")
      .eq("barangay", me.barangay);

    if (citizenDetails && citizenDetails.length > 0) {
      const ids = citizenDetails.map((c: any) => c.id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, contact_number, warning_count, is_archived")
        .in("id", ids)
        .eq("role", "CITIZEN");

      const merged = (profiles ?? []).map((p: any) => {
        const detail = citizenDetails.find((d: any) => d.id === p.id);
        return { ...p, ...detail };
      });
      setCitizens(merged);
    }

    // Violations in this barangay
    const { data: vData } = await supabase
      .from("violations")
      .select("*, profiles(full_name)")
      .eq("barangay", me.barangay)
      .order("created_at", { ascending: false });

    setViolations(
      (vData ?? []).map((v: any) => ({
        ...v,
        citizen_name: v.profiles?.full_name ?? "Unknown",
      }))
    );

    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Escalate warning ──────────────────────────────────────────────────────
  const escalateWarning = async (citizenId: string, current: number) => {
    setEscalating(citizenId);
    await supabase
      .from("profiles")
      .update({ warning_count: current + 1 })
      .eq("id", citizenId);
    await supabase.from("audit_logs").insert({
      admin_id: profile?.id,
      action_type: "LGU_ESCALATE_WARNING",
      target_id: citizenId,
      reason: "Warning issued by LGU official",
    });
    await fetchData();
    setEscalating(null);
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredCitizens = citizens.filter(c =>
    (c.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.purok ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredViolations = violations.filter(v => {
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    const matchSearch = (v.citizen_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingViolations = violations.filter(v => v.status === "Pending").length;
  const activeWarnings    = citizens.filter(c => c.warning_count > 0).length;
  const resolvedToday     = violations.filter(v =>
    v.resolved_at && new Date(v.resolved_at).toDateString() === new Date().toDateString()
  ).length;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8f9fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #1e3a8a", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "sans-serif" }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fb", fontFamily: "sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .row-hover:hover { background: #f8f9ff !important; }
        .tab-btn { transition: all .18s; }
        .act-btn { transition: all .15s; cursor: pointer; }
        .act-btn:hover { opacity: .85; transform: scale(.97); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav style={{
        background: "#0f172a",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1e40af,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={16} color="#93c5fd" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>EcoRoute LGU</div>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: ".06em", textTransform: "uppercase" }}>
              {profile?.barangay} · {profile?.municipality}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {pendingViolations > 0 && (
            <div style={{ position: "relative" }}>
              <Bell size={18} color="#94a3b8" />
              <span style={{
                position: "absolute", top: -6, right: -6,
                width: 16, height: 16, borderRadius: "50%",
                background: "#ef4444", color: "#fff",
                fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
              }}>{pendingViolations}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#93c5fd" }}>
              {(profile?.full_name ?? "L").charAt(0)}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{profile?.full_name}</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>{profile?.position_title}</span>
            </div>
          </div>
          <button onClick={signOut} className="act-btn" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "6px 12px", color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── PAGE TITLE ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28, animation: "fadeUp .4s ease both" }}>
          <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-.02em", fontFamily: "Georgia, serif" }}>
            Barangay {profile?.barangay}
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0", fontFamily: "sans-serif" }}>
            {profile?.municipality} · {citizens.length} registered citizens
          </p>
        </div>

        {/* ── STAT CARDS ────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
          <StatCard icon={Users}        label="Total Citizens"  value={citizens.length}     sub={`${citizens.filter(c => !c.is_archived).length} active`} accent="#1e40af" delay={0}   />
          <StatCard icon={AlertTriangle} label="Pending Reports" value={pendingViolations}   sub="Need review"              accent="#d97706" delay={0.05} />
          <StatCard icon={ShieldAlert}   label="Active Warnings" value={activeWarnings}      sub="Citizens warned"          accent="#dc2626" delay={0.1}  />
          <StatCard icon={CheckCircle}   label="Resolved Today"  value={resolvedToday}       sub="Cases closed"             accent="#059669" delay={0.15} />
        </div>

        {/* ── TABS + SEARCH ──────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e9ecf2", overflow: "hidden", boxShadow: "0 2px 16px rgba(15,23,60,.05)", animation: "fadeUp .5s ease .2s both" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 0 }}>
              {[
                { id: "citizens",   label: "Citizens",   icon: Users,        count: citizens.length       },
                { id: "violations", label: "Violations", icon: AlertTriangle, count: violations.length    },
                { id: "bins",       label: "Bins",       icon: Trash2,       count: bins.length           },
              ].map(tab => (
                <button
                  key={tab.id}
                  className="tab-btn"
                  onClick={() => { setActiveTab(tab.id as any); setSearch(""); setStatusFilter("all"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "16px 18px", border: "none", background: "transparent", cursor: "pointer",
                    fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? "#1e40af" : "#6b7280",
                    borderBottom: activeTab === tab.id ? "2px solid #1e40af" : "2px solid transparent",
                    fontFamily: "sans-serif",
                  }}
                >
                  <tab.icon size={15} />
                  {tab.label}
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: activeTab === tab.id ? "#eff6ff" : "#f1f5f9", color: activeTab === tab.id ? "#1e40af" : "#9ca3af" }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search + filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              {activeTab === "violations" && (
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ fontSize: 12, padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", color: "#374151", outline: "none", fontFamily: "sans-serif", cursor: "pointer" }}
                >
                  <option value="all">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Resolved">Resolved</option>
                </select>
              )}
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#374151", outline: "none", width: 180, background: "#f9fafb", fontFamily: "sans-serif" }}
                />
              </div>
              <button onClick={fetchData} className="act-btn" style={{ padding: "7px 9px", border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", cursor: "pointer" }}>
                <RefreshCw size={14} color="#6b7280" />
              </button>
            </div>
          </div>

          {/* ── CITIZENS TAB ──────────────────────────────────────────── */}
          {activeTab === "citizens" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Citizen", "Purok / Street", "Contact", "Warnings", "Status", "Action"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCitizens.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>No citizens found</td></tr>
                  ) : filteredCitizens.map(c => (
                    <tr key={c.id} className="row-hover" style={{ borderBottom: "1px solid #f8fafc", background: "#fff" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1e40af", flexShrink: 0 }}>
                            {(c.full_name ?? "?").charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.full_name ?? "—"}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                        <div>{c.purok ?? "—"}</div>
                        <div style={{ color: "#9ca3af" }}>{c.address_street ?? ""}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>{c.contact_number ?? "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                          background: c.warning_count >= 3 ? "#fef2f2" : c.warning_count > 0 ? "#fff7ed" : "#f0fdf4",
                          color: c.warning_count >= 3 ? "#991b1b" : c.warning_count > 0 ? "#9a3412" : "#166534",
                        }}>
                          {c.warning_count} warning{c.warning_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: c.is_archived ? "#f1f5f9" : "#f0fdf4", color: c.is_archived ? "#6b7280" : "#166534" }}>
                          {c.is_archived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => escalateWarning(c.id, c.warning_count)}
                          disabled={!!escalating || c.is_archived}
                          className="act-btn"
                          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", cursor: "pointer", opacity: escalating === c.id ? .5 : 1, display: "flex", alignItems: "center", gap: 5 }}
                        >
                          <AlertTriangle size={12} />
                          {escalating === c.id ? "Issuing…" : "Issue Warning"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── VIOLATIONS TAB ────────────────────────────────────────── */}
          {activeTab === "violations" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Citizen", "Violation Type", "Description", "Status", "Reported", ""].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredViolations.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>No violations found</td></tr>
                  ) : filteredViolations.map(v => {
                    const sc = statusConfig[v.status] ?? statusConfig.Pending;
                    return (
                      <tr key={v.id} className="row-hover" style={{ borderBottom: "1px solid #f8fafc", background: "#fff" }}>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{v.citizen_name}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>
                            {v.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", maxWidth: 200 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {v.description ?? "—"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: sc.text }}>{sc.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#9ca3af" }}>{timeAgo(v.created_at)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <ChevronRight size={16} color="#d1d5db" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BINS TAB ──────────────────────────────────────────────── */}
          {activeTab === "bins" && (
            <div style={{ padding: 20 }}>
              {bins.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48 }}>
                  <Trash2 size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>No bins deployed in {profile?.barangay} yet.</p>
                  <p style={{ color: "#d1d5db", fontSize: 12, marginTop: 4 }}>Ask your Admin to deploy bins to this barangay.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                  {bins.map(b => {
                    const fc = fillColor(b.fill_level);
                    return (
                      <div key={b.id} style={{ background: fc.bg, borderRadius: 12, padding: "16px 18px", border: `1.5px solid ${fc.dot}22` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{b.name}</div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: fc.text, background: "#fff", padding: "2px 8px", borderRadius: 20 }}>{b.fill_level}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,.08)", marginBottom: 10 }}>
                          <div style={{ height: "100%", width: `${b.fill_level}%`, borderRadius: 3, background: fc.dot, transition: "width .4s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: fc.text }}>🔋 {b.battery_level}% · {timeAgo(b.last_seen)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RA 9003 REMINDER ──────────────────────────────────────────── */}
        <div style={{
          marginTop: 24, padding: "18px 22px", borderRadius: 14,
          background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
          border: "1px solid rgba(147,197,253,.15)",
          display: "flex", alignItems: "center", gap: 16,
          animation: "fadeUp .5s ease .3s both",
        }}>
          <FileText size={22} color="#93c5fd" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", marginBottom: 3, fontFamily: "sans-serif" }}>RA 9003 Compliance Reminder</div>
            <p style={{ fontSize: 12, color: "rgba(209,236,255,.7)", margin: 0, fontFamily: "sans-serif", lineHeight: 1.6 }}>
              As LGU official, you are responsible for enforcing waste segregation and collection schedules under Republic Act 9003.
              Citizens with 3+ warnings may be escalated to barangay proceedings.
            </p>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#93c5fd", fontFamily: "Georgia, serif" }}>{Math.round((citizens.filter(c => c.warning_count === 0).length / Math.max(citizens.length, 1)) * 100)}%</div>
            <div style={{ fontSize: 10, color: "rgba(147,197,253,.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Compliant</div>
          </div>
        </div>
      </div>
    </div>
  );
}