"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/super-admin/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Shield, Users, Truck, Building2, User, Trash2,
  AlertTriangle, Activity, Search, LogOut, RefreshCw,
  MoreHorizontal, Archive, ChevronDown, Terminal,
  CheckCircle, Plus, Filter, MapPin, X,
} from "lucide-react";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type UserRole = "SUPER_ADMIN" | "ADMIN" | "DRIVER" | "LGU" | "CITIZEN";

interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_archived: boolean;
  warning_count: number;
  updated_at: string;
  barangay?: string;
  municipality?: string;
  duty_status?: string;
  employment_status?: string;
  license_number?: string;
  position_title?: string;
}

interface AuditEntry {
  id: string;
  admin_id: string;
  action_type: string;
  target_id: string;
  reason: string;
  created_at: string;
  admin_name?: string;
}

interface SystemStats {
  totalUsers:        number;
  totalAdmins:       number;
  totalDrivers:      number;
  totalLGU:          number;
  totalCitizens:     number;
  totalBins:         number;
  criticalBins:      number;
  pendingViolations: number;
  totalCollections:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; icon: any }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "#7c3aed", bg: "#f5f3ff", icon: Shield    },
  ADMIN:       { label: "Admin",       color: "#0284c7", bg: "#f0f9ff", icon: Building2 },
  DRIVER:      { label: "Driver",      color: "#059669", bg: "#f0fdf4", icon: Truck     },
  LGU:         { label: "LGU",         color: "#d97706", bg: "#fffbeb", icon: User      },
  CITIZEN:     { label: "Citizen",     color: "#64748b", bg: "#f8fafc", icon: Users     },
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
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
    <div style={{
      background: "#0f172a", borderRadius: 14, padding: "18px 20px",
      border: "1px solid rgba(255,255,255,.07)",
      display: "flex", flexDirection: "column", gap: 10,
      animation: `fadeUp .5s ease ${delay}s both`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#f1f5f9", lineHeight: 1, fontFamily: "Georgia, serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569" }}>{sub}</div>}
      <div style={{ height: 2, borderRadius: 1, background: `${accent}25` }}>
        <div style={{ height: "100%", width: "50%", borderRadius: 1, background: accent }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.CITIZEN;
  const RoleIcon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}25`,
    }}>
      <RoleIcon size={11} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN BARANGAY MODAL
// ─────────────────────────────────────────────────────────────────────────────

function AssignBarangayModal({
  user,
  meId,
  onClose,
  onSuccess,
}: {
  user: SystemUser;
  meId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [barangay,      setBarangay]      = useState(user.barangay ?? "");
  const [municipality,  setMunicipality]  = useState(user.municipality ?? "");
  const [positionTitle, setPositionTitle] = useState(user.position_title ?? "");
  const [empStatus,     setEmpStatus]     = useState(user.employment_status ?? "ACTIVE");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);

  const handleSave = async () => {
    setError(null);
    if (!barangay.trim()) return setError("Barangay name is required.");

    setSaving(true);
    try {
      // Check if lgu_details row already exists
      const { data: existing } = await supabase
        .from("lgu_details")
        .select("id")
        .eq("id", user.id)
        .single();

      if (existing) {
        const { error: updateErr } = await supabase
          .from("lgu_details")
          .update({
            barangay:          barangay.trim(),
            municipality:      municipality.trim() || null,
            position_title:    positionTitle.trim() || null,
            employment_status: empStatus,
          })
          .eq("id", user.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: insertErr } = await supabase
          .from("lgu_details")
          .insert({
            id:                user.id,
            barangay:          barangay.trim(),
            municipality:      municipality.trim() || null,
            position_title:    positionTitle.trim() || null,
            employment_status: empStatus,
          });
        if (insertErr) throw new Error(insertErr.message);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        admin_id:    meId,
        action_type: "ASSIGN_BARANGAY",
        target_id:   user.id,
        reason:      `Assigned barangay "${barangay.trim()}" to LGU account ${user.email} by Super Admin`,
      });

      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 900);
    } catch (e: any) {
      setError(e.message ?? "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,.1)",
    background: "#0a0f1e", color: "#e2e8f0",
    fontSize: 13, outline: "none",
    fontFamily: "sans-serif", width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.75)",
        zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0f172a", borderRadius: 18,
          border: "1px solid rgba(255,255,255,.1)",
          width: "100%", maxWidth: 460,
          boxShadow: "0 32px 80px rgba(0,0,0,.7)",
          animation: "fadeUp .22s ease both",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,.07)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(217,119,6,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={17} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>
                {user.barangay ? "Update Barangay" : "Assign Barangay"}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                Updating: <span style={{ color: "#94a3b8", fontWeight: 600 }}>{user.full_name ?? user.email}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}
          >
            <X size={14} color="#64748b" />
          </button>
        </div>

        {/* Current assignment banner */}
        {user.barangay && (
          <div style={{
            margin: "16px 22px 0",
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(217,119,6,.08)", border: "1px solid rgba(217,119,6,.2)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <MapPin size={13} color="#d97706" />
            <span style={{ fontSize: 12, color: "#d97706" }}>
              Currently: <strong>{user.barangay}</strong>
              {user.municipality ? `, ${user.municipality}` : ""}
            </span>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: ".06em", textTransform: "uppercase" }}>
              Barangay <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              placeholder="e.g. Barangay Poblacion"
              value={barangay}
              onChange={e => setBarangay(e.target.value)}
              style={inp}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: ".06em", textTransform: "uppercase" }}>
              Municipality
            </label>
            <input
              placeholder="e.g. Davao City"
              value={municipality}
              onChange={e => setMunicipality(e.target.value)}
              style={inp}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: ".06em", textTransform: "uppercase" }}>
              Position Title
            </label>
            <input
              placeholder="e.g. Barangay Captain"
              value={positionTitle}
              onChange={e => setPositionTitle(e.target.value)}
              style={inp}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: ".06em", textTransform: "uppercase" }}>
              Employment Status
            </label>
            <select
              value={empStatus}
              onChange={e => setEmpStatus(e.target.value)}
              style={{ ...inp, cursor: "pointer" }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>

          {error && (
            <div style={{
              background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.25)",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 12, color: "#f87171",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.25)",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 12, color: "#34d399",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle size={14} style={{ flexShrink: 0 }} />
              Barangay assigned successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
          padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,.07)",
        }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: success ? "#059669" : saving ? "#334155" : "#d97706",
              color: saving ? "#64748b" : "#fff",
              fontSize: 13, fontWeight: 700,
              cursor: saving || success ? "not-allowed" : "pointer",
              fontFamily: "sans-serif",
              display: "flex", alignItems: "center", gap: 8,
              transition: "background .2s",
            }}
          >
            {saving ? (
              <>
                <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #64748b", borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
                Saving…
              </>
            ) : success ? (
              <>
                <CheckCircle size={14} />
                Saved!
              </>
            ) : (
              <>
                <MapPin size={14} />
                {user.barangay ? "Update Barangay" : "Assign Barangay"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();

  const [meId,         setMeId]         = useState<string>("");
  const [meName,       setMeName]       = useState<string>("Super Admin");
  const [stats,        setStats]        = useState<SystemStats | null>(null);
  const [users,        setUsers]        = useState<SystemUser[]>([]);
  const [auditLogs,    setAuditLogs]    = useState<AuditEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"users" | "audit" | "system">("users");
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState<string>("all");
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [processing,   setProcessing]   = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<SystemUser | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setMeId(user.id);

    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (me) setMeName(me.full_name ?? "Super Admin");

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_archived, warning_count, updated_at")
      .in("role", ["SUPER_ADMIN", "ADMIN", "DRIVER", "LGU"])
      .order("role")
      .order("full_name");

    const { data: driverDetails } = await supabase
      .from("driver_details")
      .select("id, duty_status, employment_status, license_number");

    // Added municipality to the select
    const { data: lguDetails } = await supabase
      .from("lgu_details")
      .select("id, barangay, municipality, employment_status, position_title");

    const driverMap = Object.fromEntries((driverDetails ?? []).map((d: any) => [d.id, d]));
    const lguMap    = Object.fromEntries((lguDetails    ?? []).map((l: any) => [l.id, l]));

    const merged: SystemUser[] = (profiles ?? []).map((p: any) => ({
      ...p,
      ...(driverMap[p.id] ?? {}),
      ...(lguMap[p.id]    ?? {}),
    }));
    setUsers(merged);

    const [
      { count: totalProfiles },
      { count: totalBins     },
      { count: criticalBins  },
      { count: pendingViol   },
      { count: totalCollect  },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bins").select("id", { count: "exact", head: true }),
      supabase.from("bins").select("id", { count: "exact", head: true }).gte("fill_level", 90),
      supabase.from("violations").select("id", { count: "exact", head: true }).eq("status", "Pending"),
      supabase.from("collections").select("id", { count: "exact", head: true }),
    ]);

    const roleCounts = (profiles ?? []).reduce((acc: any, p: any) => {
      acc[p.role] = (acc[p.role] ?? 0) + 1;
      return acc;
    }, {});

    const { count: citizenCount } = await supabase
      .from("profiles").select("id", { count: "exact", head: true }).eq("role", "CITIZEN");

    setStats({
      totalUsers:        totalProfiles ?? 0,
      totalAdmins:       roleCounts.ADMIN ?? 0,
      totalDrivers:      roleCounts.DRIVER ?? 0,
      totalLGU:          roleCounts.LGU ?? 0,
      totalCitizens:     citizenCount ?? 0,
      totalBins:         totalBins ?? 0,
      criticalBins:      criticalBins ?? 0,
      pendingViolations: pendingViol ?? 0,
      totalCollections:  totalCollect ?? 0,
    });

    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*, auth_users:admin_id(email)")
      .order("created_at", { ascending: false })
      .limit(50);

    const adminIds = [...new Set((logs ?? []).map((l: any) => l.admin_id).filter(Boolean))];
    let adminNames: Record<string, string> = {};
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", adminIds);
      adminNames = Object.fromEntries((adminProfiles ?? []).map((p: any) => [p.id, p.full_name]));
    }

    setAuditLogs(
      (logs ?? []).map((l: any) => ({
        ...l,
        admin_name: adminNames[l.admin_id] ?? "System",
      }))
    );

    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Archive / unarchive ────────────────────────────────────────────────────
  const toggleArchive = async (userId: string, current: boolean) => {
    setProcessing(userId);
    setActionTarget(null);
    await supabase.from("profiles").update({ is_archived: !current }).eq("id", userId);
    await supabase.from("audit_logs").insert({
      admin_id: meId,
      action_type: current ? "UNARCHIVE_USER" : "ARCHIVE_USER",
      target_id: userId,
      reason: `${current ? "Unarchived" : "Archived"} by Super Admin`,
    });
    await fetchData();
    setProcessing(null);
  };

  // ── Change role ────────────────────────────────────────────────────────────
  const changeRole = async (userId: string, newRole: UserRole) => {
    setProcessing(userId);
    setActionTarget(null);
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    await supabase.from("audit_logs").insert({
      admin_id: meId,
      action_type: "ASSIGN_ROLE",
      target_id: userId,
      reason: `Role changed to ${newRole} by Super Admin`,
    });
    await fetchData();
    setProcessing(null);
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ── Filtered users ─────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchRole   = roleFilter === "all" || u.role === roleFilter;
    const matchSearch = (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
                        (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
                        (u.barangay ?? "").toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #7c3aed", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "sans-serif" }}>Loading system…</p>
        </div>
      </div>
    );
  }

  const onlineBadge = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: ".06em", textTransform: "uppercase" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite", display: "inline-block" }} />
      System Online
    </span>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#020617", fontFamily: "sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .row-hover:hover { background: rgba(255,255,255,.03) !important; }
        .tab-btn { transition: all .18s; }
        .act-btn { transition: all .15s; cursor: pointer; }
        .act-btn:hover { opacity: .8; }
        .menu-item:hover { background: rgba(255,255,255,.06) !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .dropdown { position: relative; display: inline-block; }
        .dropdown-menu { display: none; position: absolute; right: 0; top: calc(100% + 6px); background: #1e293b; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 6px; min-width: 210px; z-index: 200; box-shadow: 0 16px 48px rgba(0,0,0,.5); }
        .dropdown:hover .dropdown-menu, .dropdown-menu:hover { display: block; }
        input::placeholder { color: #334155; }
        select option { background: #1e293b; }
      `}</style>

      {/* ── ASSIGN BARANGAY MODAL ───────────────────────────────────────── */}
      {assignTarget && (
        <AssignBarangayModal
          user={assignTarget}
          meId={meId}
          onClose={() => setAssignTarget(null)}
          onSuccess={fetchData}
        />
      )}

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav style={{
        background: "#0a0f1e",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        padding: "0 28px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={16} color="#c4b5fd" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>EcoRoute</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: ".08em", textTransform: "uppercase" }}>Super Admin · Mission Control</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {onlineBadge}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#c4b5fd" }}>
              {meName.charAt(0)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{meName}</span>
          </div>
          <button onClick={signOut} className="act-btn" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "6px 12px", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── PAGE TITLE ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28, animation: "fadeUp .4s ease both" }}>
          <h1 style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 900, color: "#f8fafc", margin: 0, letterSpacing: "-.03em", fontFamily: "Georgia, serif" }}>
            System Control Center
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "4px 0 0" }}>
            Manage users, monitor operations, and review system activity.
          </p>
        </div>

        {/* ── STAT CARDS ────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
          <StatCard icon={Users}         label="Total Users"    value={stats?.totalUsers ?? 0}        sub="All roles"              accent="#7c3aed" delay={0}    />
          <StatCard icon={Building2}     label="Admins"         value={stats?.totalAdmins ?? 0}       sub="Barangay admins"        accent="#0284c7" delay={0.04} />
          <StatCard icon={Truck}         label="Drivers"        value={stats?.totalDrivers ?? 0}      sub="Waste collectors"       accent="#059669" delay={0.08} />
          <StatCard icon={User}          label="LGU Officials"  value={stats?.totalLGU ?? 0}          sub="Barangay scope"         accent="#d97706" delay={0.12} />
          <StatCard icon={Trash2}        label="Smart Bins"     value={stats?.totalBins ?? 0}         sub={`${stats?.criticalBins ?? 0} critical`} accent="#ef4444" delay={0.16} />
          <StatCard icon={AlertTriangle} label="Violations"     value={stats?.pendingViolations ?? 0} sub="Awaiting review"        accent="#f59e0b" delay={0.20} />
        </div>

        {/* ── TABS + TOOLBAR ────────────────────────────────────────────── */}
        <div style={{ background: "#0f172a", borderRadius: 16, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.3)", animation: "fadeUp .5s ease .22s both" }}>

          {/* Tab bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,.06)", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 0 }}>
              {[
                { id: "users",  label: "User Management", icon: Users    },
                { id: "audit",  label: "Audit Log",        icon: Terminal },
                { id: "system", label: "System Overview",  icon: Activity },
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className="tab-btn"
                    onClick={() => { setActiveTab(tab.id as any); setSearch(""); setRoleFilter("all"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "16px 18px", border: "none", background: "transparent", cursor: "pointer",
                      fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
                      color: activeTab === tab.id ? "#a78bfa" : "#475569",
                      borderBottom: activeTab === tab.id ? "2px solid #7c3aed" : "2px solid transparent",
                      fontFamily: "sans-serif",
                    }}
                  >
                    <TabIcon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search + filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              {activeTab === "users" && (
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  style={{ fontSize: 12, padding: "7px 10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, background: "#1e293b", color: "#94a3b8", outline: "none", fontFamily: "sans-serif", cursor: "pointer" }}
                >
                  <option value="all">All roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="DRIVER">Driver</option>
                  <option value="LGU">LGU</option>
                </select>
              )}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 12, color: "#cbd5e1", outline: "none", width: 180, background: "#1e293b", fontFamily: "sans-serif" }}
                />
              </div>
              <button onClick={fetchData} className="act-btn" style={{ padding: "7px 9px", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, background: "#1e293b", cursor: "pointer" }}>
                <RefreshCw size={13} color="#475569" />
              </button>
            </div>
          </div>

          {/* ── USERS TAB ─────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,.025)" }}>
                    {["User", "Role", "Detail", "Status", "Last Updated", "Actions"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,.05)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 48, color: "#475569", fontSize: 13 }}>No users found</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.id} className="row-hover" style={{ borderBottom: "1px solid rgba(255,255,255,.04)", background: "transparent" }}>
                      {/* User */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${ROLE_CONFIG[u.role]?.color ?? "#64748b"}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: ROLE_CONFIG[u.role]?.color ?? "#64748b", flexShrink: 0 }}>
                            {(u.full_name ?? "?").charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: u.is_archived ? "#475569" : "#f1f5f9", textDecoration: u.is_archived ? "line-through" : "none" }}>
                              {u.full_name ?? "—"}
                              {u.id === meId && <span style={{ fontSize: 9, fontWeight: 800, marginLeft: 6, color: "#7c3aed", background: "#f5f3ff", padding: "1px 6px", borderRadius: 10 }}>YOU</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#475569" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td style={{ padding: "12px 16px" }}>
                        <RoleBadge role={u.role} />
                      </td>
                      {/* Detail */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>
                        {u.role === "DRIVER" && (
                          <div>
                            <div>{u.license_number ?? "No license"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.duty_status === "ON-DUTY" ? "#22c55e" : "#475569", display: "inline-block" }} />
                              <span style={{ fontSize: 11, color: u.duty_status === "ON-DUTY" ? "#4ade80" : "#475569" }}>{u.duty_status ?? "OFF-DUTY"}</span>
                            </div>
                          </div>
                        )}
                        {u.role === "LGU" && (
                          <div>
                            {u.barangay ? (
                              <>
                                <div style={{ fontWeight: 600, color: "#94a3b8" }}>{u.barangay}</div>
                                <div style={{ fontSize: 11 }}>{u.position_title ?? "—"}</div>
                              </>
                            ) : (
                              // Unassigned pill — clickable shortcut
                              <button
                                onClick={() => setAssignTarget(u)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  fontSize: 11, fontWeight: 700,
                                  padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                                  background: "rgba(245,158,11,.12)",
                                  color: "#f59e0b",
                                  border: "1px solid rgba(245,158,11,.3)",
                                  fontFamily: "sans-serif",
                                }}
                              >
                                <MapPin size={10} />
                                Unassigned — click to assign
                              </button>
                            )}
                          </div>
                        )}
                        {u.role === "ADMIN"       && <span style={{ color: "#475569" }}>—</span>}
                        {u.role === "SUPER_ADMIN" && <span style={{ color: "#7c3aed", fontWeight: 700 }}>Full access</span>}
                      </td>
                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                          background: u.is_archived ? "rgba(71,85,105,.2)" : "rgba(52,211,153,.12)",
                          color: u.is_archived ? "#475569" : "#34d399",
                        }}>
                          {u.is_archived ? "Archived" : "Active"}
                        </span>
                      </td>
                      {/* Last updated */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569" }}>
                        {timeAgo(u.updated_at)}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "12px 16px" }}>
                        {u.id === meId ? (
                          <span style={{ fontSize: 11, color: "#334155" }}>—</span>
                        ) : processing === u.id ? (
                          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #7c3aed", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
                        ) : (
                          <div className="dropdown">
                            <button
                              className="act-btn"
                              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "5px 10px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            <div className="dropdown-menu">

                              {/* ── Assign / Update Barangay (LGU only) ── */}
                              {u.role === "LGU" && (
                                <>
                                  <button
                                    className="menu-item act-btn"
                                    onClick={() => setAssignTarget(u)}
                                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", border: "none", background: "transparent", color: "#fbbf24", fontSize: 12, cursor: "pointer", borderRadius: 6, textAlign: "left", fontFamily: "sans-serif" }}
                                  >
                                    <MapPin size={13} color="#d97706" />
                                    {u.barangay ? "Update Barangay" : "Assign Barangay"}
                                    {!u.barangay && (
                                      <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, background: "rgba(245,158,11,.2)", color: "#f59e0b", padding: "1px 6px", borderRadius: 8 }}>
                                        PENDING
                                      </span>
                                    )}
                                  </button>
                                  <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "4px 0" }} />
                                </>
                              )}

                              {/* Role change */}
                              {(["ADMIN", "DRIVER", "LGU"] as UserRole[]).filter(r => r !== u.role).map(r => {
                                const MenuRoleIcon = ROLE_CONFIG[r].icon;
                                return (
                                  <button
                                    key={r}
                                    className="menu-item act-btn"
                                    onClick={() => changeRole(u.id, r)}
                                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", border: "none", background: "transparent", color: "#cbd5e1", fontSize: 12, cursor: "pointer", borderRadius: 6, textAlign: "left", fontFamily: "sans-serif" }}
                                  >
                                    <MenuRoleIcon size={13} color={ROLE_CONFIG[r].color} />
                                    Set as {ROLE_CONFIG[r].label}
                                  </button>
                                );
                              })}

                              <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "4px 0" }} />
                              <button
                                className="menu-item act-btn"
                                onClick={() => toggleArchive(u.id, u.is_archived)}
                                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", border: "none", background: "transparent", color: u.is_archived ? "#34d399" : "#f87171", fontSize: 12, cursor: "pointer", borderRadius: 6, textAlign: "left", fontFamily: "sans-serif" }}
                              >
                                <Archive size={13} />
                                {u.is_archived ? "Restore account" : "Archive account"}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── AUDIT LOG TAB ─────────────────────────────────────────── */}
          {activeTab === "audit" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,.025)" }}>
                    {["Action", "Performed By", "Target", "Reason", "Time"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,.05)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 48, color: "#475569", fontSize: 13 }}>No audit logs yet</td></tr>
                  ) : auditLogs.filter(l =>
                    search === "" ||
                    l.action_type.toLowerCase().includes(search.toLowerCase()) ||
                    (l.admin_name ?? "").toLowerCase().includes(search.toLowerCase())
                  ).map((log) => (
                    <tr key={log.id} className="row-hover" style={{ borderBottom: "1px solid rgba(255,255,255,.04)", background: "transparent" }}>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, padding: "3px 9px", borderRadius: 6, background: "rgba(124,58,237,.15)", color: "#c4b5fd" }}>
                          {log.action_type}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: "#94a3b8" }}>{log.admin_name}</td>
                      <td style={{ padding: "11px 16px", fontSize: 11, fontFamily: "monospace", color: "#475569", maxWidth: 120 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.target_id ?? "—"}</div>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#64748b", maxWidth: 200 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.reason ?? "—"}</div>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{timeAgo(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SYSTEM OVERVIEW TAB ───────────────────────────────────── */}
          {activeTab === "system" && stats && (
            <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>User Breakdown</div>
                {(["SUPER_ADMIN","ADMIN","DRIVER","LGU","CITIZEN"] as UserRole[]).map(role => {
                  const cnt = role === "CITIZEN" ? stats.totalCitizens : users.filter(u => u.role === role).length;
                  const cfg = ROLE_CONFIG[role];
                  const pct = stats.totalUsers > 0 ? (cnt / stats.totalUsers) * 100 : 0;
                  return (
                    <div key={role} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>{cfg.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{cnt}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: cfg.color, transition: "width .6s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>Bin Network</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Total Bins",  value: stats.totalBins,        accent: "#7c3aed" },
                    { label: "Critical",    value: stats.criticalBins,     accent: "#ef4444" },
                    { label: "Collections",value: stats.totalCollections,  accent: "#34d399" },
                    { label: "Violations", value: stats.pendingViolations, accent: "#f59e0b" },
                  ].map(s => (
                    <div key={s.label} style={{ background: `${s.accent}10`, borderRadius: 10, padding: "14px 16px", border: `1px solid ${s.accent}20` }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.accent, fontFamily: "Georgia, serif" }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>Quick Actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "View all bins",       icon: Trash2,        color: "#ef4444", action: undefined },
                    { label: "View all violations", icon: AlertTriangle, color: "#f59e0b", action: undefined },
                    { label: "Review audit logs",   icon: Terminal,      color: "#7c3aed", action: () => setActiveTab("audit") },
                  ].map(a => {
                    const ActionIcon = a.icon;
                    return (
                      <button
                        key={a.label}
                        onClick={a.action ?? (() => {})}
                        className="act-btn"
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "transparent", cursor: "pointer", color: "#94a3b8", fontSize: 13, textAlign: "left", fontFamily: "sans-serif" }}
                      >
                        <ActionIcon size={16} color={a.color} />
                        {a.label}
                        <ChevronDown size={13} color="#334155" style={{ marginLeft: "auto", transform: "rotate(-90deg)" }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}