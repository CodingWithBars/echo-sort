"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/super-admin/dashboard/page.tsx
// Drop this file at: app/super-admin/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Shield, Users, Truck, Building2, User, Trash2,
  AlertTriangle, Activity, Search, LogOut, RefreshCw,
  MoreHorizontal, Archive, ChevronDown, Terminal,
  CheckCircle, MapPin, X, Bell, Eye, ChevronRight,
  ArchiveRestore, UserCog, Menu, BarChart3, Clock,
  FileText, Layers, Database,
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
  vehicle_plate_number?: string;
  position_title?: string;
}

interface CitizenRecord {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  warning_count: number;
  is_archived: boolean;
  barangay: string;
  purok: string;
  address_street: string;
  municipality: string;
  service_type: string;
  created_at: string;
  lgu_name?: string;
  violations?: ViolationRecord[];
}

interface ViolationRecord {
  id: string;
  type: string;
  description: string;
  status: "Pending" | "Under Review" | "Resolved";
  created_at: string;
  resolved_at: string | null;
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
  totalUsers: number;
  totalAdmins: number;
  totalDrivers: number;
  totalLGU: number;
  totalCitizens: number;
  totalBins: number;
  criticalBins: number;
  highBins: number;
  pendingViolations: number;
  totalCollections: number;
  archivedUsers: number;
  onDutyDrivers: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; darkBg: string; icon: any }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "#34d399", bg: "#f0fdf4", darkBg: "rgba(52,211,153,.12)", icon: Shield    },
  ADMIN:       { label: "Admin",       color: "#6ee7b7", bg: "#f0fdf4", darkBg: "rgba(110,231,183,.1)",  icon: Building2 },
  DRIVER:      { label: "Driver",      color: "#a7f3d0", bg: "#f0fdf4", darkBg: "rgba(167,243,208,.1)",  icon: Truck     },
  LGU:         { label: "LGU",         color: "#fcd34d", bg: "#fefce8", darkBg: "rgba(252,211,77,.1)",   icon: MapPin    },
  CITIZEN:     { label: "Citizen",     color: "#94a3b8", bg: "#f8fafc", darkBg: "rgba(148,163,184,.1)",  icon: Users     },
};

const VIOLATION_STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  "Pending":      { dot: "#f59e0b", text: "#fcd34d", bg: "rgba(245,158,11,.12)"  },
  "Under Review": { dot: "#3b82f6", text: "#93c5fd", bg: "rgba(59,130,246,.12)"  },
  "Resolved":     { dot: "#10b981", text: "#6ee7b7", bg: "rgba(16,185,129,.12)"  },
};

const timeAgo = (iso: string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent, delay = 0, warn = false }: {
  icon: any; label: string; value: string | number;
  sub?: string; accent: string; delay?: number; warn?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,.03)",
      borderRadius: 14, padding: "18px 20px",
      border: warn ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,.07)",
      display: "flex", flexDirection: "column", gap: 10,
      animation: `fadeUp .5s ease ${delay}s both`,
      position: "relative", overflow: "hidden",
    }}>
      {warn && <div style={{ position: "absolute", inset: 0, background: `${accent}06`, pointerEvents: "none" }} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: ".1em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: warn ? accent : "#f0fdf4", lineHeight: 1, fontFamily: "Georgia, serif", position: "relative" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#374151", position: "relative" }}>{sub}</div>}
      <div style={{ height: 2, borderRadius: 1, background: `${accent}18`, position: "relative" }}>
        <div style={{ height: "100%", width: "55%", borderRadius: 1, background: accent }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.CITIZEN;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
      background: cfg.darkBg, color: cfg.color,
      border: `1px solid ${cfg.color}25`, whiteSpace: "nowrap",
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION DROPDOWN (toggle-based, not hover-based)
// ─────────────────────────────────────────────────────────────────────────────

function ActionMenu({ user, meId, onArchive, onRole, onAssign }: {
  user: SystemUser;
  meId: string;
  onArchive: (id: string, current: boolean) => void;
  onRole: (id: string, role: UserRole) => void;
  onAssign: (u: SystemUser) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (user.id === meId) return <span style={{ fontSize: 11, color: "#1f2937" }}>—</span>;

  const roles: UserRole[] = (["ADMIN", "DRIVER", "LGU"] as UserRole[]).filter(r => r !== user.role);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? "rgba(52,211,153,.15)" : "rgba(255,255,255,.05)",
          border: `1px solid ${open ? "rgba(52,211,153,.35)" : "rgba(255,255,255,.1)"}`,
          borderRadius: 8, padding: "6px 10px",
          color: open ? "#34d399" : "#6b7280",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          fontSize: 12, transition: "all .15s",
        }}
      >
        <MoreHorizontal size={14} />
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          background: "#0a1628", border: "1px solid rgba(52,211,153,.2)",
          borderRadius: 12, padding: 6, minWidth: 220, zIndex: 500,
          boxShadow: "0 20px 60px rgba(0,0,0,.7)",
          animation: "dropIn .15s ease both",
        }}>
          {/* LGU barangay assign */}
          {user.role === "LGU" && (
            <>
              <button
                onClick={() => { onAssign(user); setOpen(false); }}
                style={{ ...menuItemStyle, color: "#fcd34d" }}
              >
                <MapPin size={13} color="#f59e0b" />
                <span style={{ flex: 1 }}>{user.barangay ? "Update Barangay" : "Assign Barangay"}</span>
                {!user.barangay && (
                  <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(245,158,11,.2)", color: "#f59e0b", padding: "1px 6px", borderRadius: 8 }}>PENDING</span>
                )}
              </button>
              <div style={dividerStyle} />
            </>
          )}

          {/* Role change */}
          <div style={{ padding: "4px 8px 2px", fontSize: 9, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase" }}>Change Role</div>
          {roles.map(r => {
            const RIcon = ROLE_CONFIG[r].icon;
            return (
              <button key={r} onClick={() => { onRole(user.id, r); setOpen(false); }} style={{ ...menuItemStyle, color: "#d1fae5" }}>
                <RIcon size={13} color={ROLE_CONFIG[r].color} />
                Set as {ROLE_CONFIG[r].label}
              </button>
            );
          })}

          <div style={dividerStyle} />

          {/* Archive */}
          <button
            onClick={() => { onArchive(user.id, user.is_archived); setOpen(false); }}
            style={{ ...menuItemStyle, color: user.is_archived ? "#6ee7b7" : "#f87171" }}
          >
            {user.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            {user.is_archived ? "Restore account" : "Archive account"}
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9,
  width: "100%", padding: "8px 10px",
  border: "none", background: "transparent",
  fontSize: 12, cursor: "pointer", borderRadius: 8,
  textAlign: "left", fontFamily: "sans-serif",
  transition: "background .12s",
};
const dividerStyle: React.CSSProperties = {
  height: 1, background: "rgba(52,211,153,.1)", margin: "4px 0",
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN BARANGAY MODAL
// ─────────────────────────────────────────────────────────────────────────────

function AssignBarangayModal({ user, meId, onClose, onSuccess }: {
  user: SystemUser; meId: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [barangay,     setBarangay]     = useState(user.barangay ?? "");
  const [municipality, setMunicipality] = useState(user.municipality ?? "");
  const [position,     setPosition]     = useState(user.position_title ?? "");
  const [empStatus,    setEmpStatus]    = useState(user.employment_status ?? "ACTIVE");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);

  const inp: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 9,
    border: "1px solid rgba(52,211,153,.2)",
    background: "rgba(52,211,153,.04)", color: "#d1fae5",
    fontSize: 13, outline: "none", fontFamily: "sans-serif",
    width: "100%", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  const save = async () => {
    setError(null);
    if (!barangay.trim()) return setError("Barangay is required.");
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("lgu_details").select("id").eq("id", user.id).single();
      const payload = {
        barangay: barangay.trim(),
        municipality: municipality.trim() || null,
        position_title: position.trim() || null,
        employment_status: empStatus,
      };
      if (existing) {
        const { error: e } = await supabase.from("lgu_details").update(payload).eq("id", user.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("lgu_details").insert({ id: user.id, ...payload });
        if (e) throw e;
      }
      await supabase.from("audit_logs").insert({
        admin_id: meId, action_type: "ASSIGN_BARANGAY",
        target_id: user.id,
        reason: `Assigned barangay "${barangay.trim()}" to ${user.email} by Super Admin`,
      });
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (e: any) {
      setError(e.message ?? "Unexpected error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#061020", borderRadius: 20,
        border: "1px solid rgba(52,211,153,.25)",
        width: "100%", maxWidth: 460,
        boxShadow: "0 32px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(52,211,153,.08)",
        animation: "fadeUp .2s ease both", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: "rgba(52,211,153,.06)", padding: "18px 22px", borderBottom: "1px solid rgba(52,211,153,.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(52,211,153,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={18} color="#34d399" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#d1fae5" }}>{user.barangay ? "Update Barangay" : "Assign Barangay"}</div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 1 }}>{user.full_name ?? user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}>
            <X size={14} color="#4b5563" />
          </button>
        </div>

        {user.barangay && (
          <div style={{ margin: "14px 22px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,.06)", border: "1px solid rgba(52,211,153,.2)", display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={13} color="#34d399" />
            <span style={{ fontSize: 12, color: "#6ee7b7" }}>
              Current: <strong>{user.barangay}{user.municipality ? `, ${user.municipality}` : ""}</strong>
            </span>
          </div>
        )}

        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
          {[
            { label: "Barangay", req: true,  val: barangay,     set: setBarangay,     ph: "e.g. Barangay Poblacion" },
            { label: "Municipality", val: municipality, set: setMunicipality, ph: "e.g. Mati City" },
            { label: "Position Title", val: position, set: setPosition, ph: "e.g. Barangay Captain" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#374151", letterSpacing: ".07em", textTransform: "uppercase" }}>
                {f.label} {(f as any).req && <span style={{ color: "#f87171" }}>*</span>}
              </label>
              <input placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} style={inp} />
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#374151", letterSpacing: ".07em", textTransform: "uppercase" }}>Status</label>
            <select value={empStatus} onChange={e => setEmpStatus(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
          {error   && <div style={{ background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.25)", borderRadius: 9, padding: "9px 13px", fontSize: 12, color: "#f87171", display: "flex", gap: 8, alignItems: "center" }}><AlertTriangle size={13} />{error}</div>}
          {success && <div style={{ background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.25)", borderRadius: 9, padding: "9px 13px", fontSize: 12, color: "#34d399", display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={13} />Saved!</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid rgba(52,211,153,.1)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#4b5563", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif" }}>Cancel</button>
          <button onClick={save} disabled={saving || success} style={{ padding: "8px 20px", borderRadius: 9, border: "none", background: success ? "#059669" : "#065f46", color: "#d1fae5", fontSize: 13, fontWeight: 700, cursor: saving || success ? "not-allowed" : "pointer", fontFamily: "sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background .2s" }}>
            {saving ? <><div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #374151", borderTopColor: "#34d399", animation: "spin .7s linear infinite" }} />Saving…</> : success ? <><CheckCircle size={14} />Saved!</> : <><MapPin size={14} />{user.barangay ? "Update" : "Assign"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CITIZEN ROW (expandable — shows violations inline)
// ─────────────────────────────────────────────────────────────────────────────

function CitizenRow({ c, lguMap }: { c: CitizenRecord; lguMap: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const vcount = c.violations?.length ?? 0;
  const pendingV = c.violations?.filter(v => v.status === "Pending").length ?? 0;

  return (
    <>
      <tr
        className="row-hover"
        onClick={() => vcount > 0 && setExpanded(e => !e)}
        style={{
          borderBottom: expanded ? "none" : "1px solid rgba(52,211,153,.05)",
          background: "transparent",
          cursor: vcount > 0 ? "pointer" : "default",
        }}
      >
        {/* Name */}
        <td style={{ padding: "11px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.is_archived ? "rgba(71,85,105,.2)" : "rgba(52,211,153,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: c.is_archived ? "#374151" : "#34d399", flexShrink: 0 }}>
              {(c.full_name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.is_archived ? "#374151" : "#d1fae5", textDecoration: c.is_archived ? "line-through" : "none" }}>{c.full_name ?? "—"}</div>
              <div style={{ fontSize: 11, color: "#374151" }}>{c.email}</div>
            </div>
          </div>
        </td>
        {/* Barangay */}
        <td style={{ padding: "11px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6ee7b7" }}>{c.barangay ?? "—"}</div>
          <div style={{ fontSize: 11, color: "#374151" }}>{c.municipality ?? ""}</div>
        </td>
        {/* Purok */}
        <td style={{ padding: "11px 16px" }}>
          <div style={{ fontSize: 12, color: "#4b5563" }}>{c.purok ?? "—"}</div>
          <div style={{ fontSize: 11, color: "#374151" }}>{c.address_street ?? ""}</div>
        </td>
        {/* LGU assigned */}
        <td style={{ padding: "11px 16px" }}>
          {lguMap[c.barangay ?? ""] ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontSize: 12, color: "#6ee7b7" }}>{lguMap[c.barangay ?? ""]}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#374151" }}>Unassigned</span>
          )}
        </td>
        {/* Warnings */}
        <td style={{ padding: "11px 16px" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
            background: c.warning_count >= 3 ? "rgba(239,68,68,.15)" : c.warning_count > 0 ? "rgba(245,158,11,.12)" : "rgba(52,211,153,.1)",
            color: c.warning_count >= 3 ? "#f87171" : c.warning_count > 0 ? "#fcd34d" : "#34d399",
          }}>
            {c.warning_count} warning{c.warning_count !== 1 ? "s" : ""}
          </span>
        </td>
        {/* Violations */}
        <td style={{ padding: "11px 16px" }}>
          {vcount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: pendingV > 0 ? "rgba(245,158,11,.12)" : "rgba(52,211,153,.1)", color: pendingV > 0 ? "#fcd34d" : "#6ee7b7" }}>
                {vcount} {vcount === 1 ? "case" : "cases"}
              </span>
              {pendingV > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: "rgba(245,158,11,.15)", color: "#f59e0b" }}>{pendingV} pending</span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#1f2937" }}>No violations</span>
          )}
        </td>
        {/* Status */}
        <td style={{ padding: "11px 16px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: c.is_archived ? "rgba(71,85,105,.2)" : "rgba(52,211,153,.1)", color: c.is_archived ? "#374151" : "#34d399" }}>
            {c.is_archived ? "Archived" : "Active"}
          </span>
        </td>
        {/* Expand toggle */}
        <td style={{ padding: "11px 14px", textAlign: "center" }}>
          {vcount > 0 && (
            <ChevronRight size={14} color="#374151" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          )}
        </td>
      </tr>

      {/* Violations expansion panel */}
      {expanded && vcount > 0 && (
        <tr style={{ borderBottom: "1px solid rgba(52,211,153,.05)" }}>
          <td colSpan={8} style={{ padding: 0, background: "rgba(52,211,153,.03)" }}>
            <div style={{ padding: "12px 16px 14px 62px", borderTop: "1px solid rgba(52,211,153,.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
                Violation History · {c.full_name}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {c.violations!.map(v => {
                  const sc = VIOLATION_STATUS[v.status] ?? VIOLATION_STATUS.Pending;
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, background: sc.bg, border: `1px solid ${sc.dot}20` }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: sc.text, minWidth: 100 }}>{v.type.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 11, color: "#374151", flex: 1 }}>{v.description ?? "No description"}</span>
                      <span style={{ fontSize: 10, color: "#374151", whiteSpace: "nowrap" }}>{fmtDate(v.created_at)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${sc.dot}20`, color: sc.text }}>{v.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();

  const [meId,         setMeId]         = useState("");
  const [meName,       setMeName]       = useState("Super Admin");
  const [stats,        setStats]        = useState<SystemStats | null>(null);
  const [users,        setUsers]        = useState<SystemUser[]>([]);
  const [citizens,     setCitizens]     = useState<CitizenRecord[]>([]);
  const [lguMap,       setLguMap]       = useState<Record<string, string>>({});
  const [auditLogs,    setAuditLogs]    = useState<AuditEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"users" | "citizens" | "audit" | "system">("users");
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("all");
  const [citizenFilter,setCitizenFilter]= useState("all");
  const [processing,   setProcessing]   = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<SystemUser | null>(null);
  const [mobileMenu,   setMobileMenu]   = useState(false);

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setMeId(user.id);

    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (me) setMeName(me.full_name ?? "Super Admin");

    // Staff users (non-citizen)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_archived, warning_count, updated_at")
      .in("role", ["SUPER_ADMIN", "ADMIN", "DRIVER", "LGU"])
      .order("role").order("full_name");

    const { data: driverD } = await supabase.from("driver_details").select("id, duty_status, employment_status, license_number, vehicle_plate_number");
    const { data: lguD    } = await supabase.from("lgu_details").select("id, barangay, municipality, employment_status, position_title");

    const driverMap = Object.fromEntries((driverD ?? []).map((d: any) => [d.id, d]));
    const lguDMap   = Object.fromEntries((lguD    ?? []).map((l: any) => [l.id, l]));

    setUsers((profiles ?? []).map((p: any) => ({ ...p, ...(driverMap[p.id] ?? {}), ...(lguDMap[p.id] ?? {}) })));

    // LGU barangay → name map
    const barangayToLGU: Record<string, string> = {};
    (lguD ?? []).forEach((l: any) => {
      if (l.barangay) {
        const lguProfile = (profiles ?? []).find((p: any) => p.id === l.id);
        if (lguProfile) barangayToLGU[l.barangay] = lguProfile.full_name ?? "LGU";
      }
    });
    setLguMap(barangayToLGU);

    // All citizens with details
    const { data: citizenProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, contact_number, warning_count, is_archived")
      .eq("role", "CITIZEN")
      .order("full_name");

    const { data: citizenDetails } = await supabase
      .from("citizen_details")
      .select("id, barangay, purok, address_street, municipality, service_type, created_at");

    // All violations
    const { data: allViolations } = await supabase
      .from("violations")
      .select("id, citizen_id, type, description, status, created_at, resolved_at")
      .order("created_at", { ascending: false });

    const violationsByCitizen: Record<string, ViolationRecord[]> = {};
    (allViolations ?? []).forEach((v: any) => {
      if (v.citizen_id) {
        if (!violationsByCitizen[v.citizen_id]) violationsByCitizen[v.citizen_id] = [];
        violationsByCitizen[v.citizen_id].push(v);
      }
    });

    const cDetailMap = Object.fromEntries((citizenDetails ?? []).map((d: any) => [d.id, d]));
    const mergedCitizens: CitizenRecord[] = (citizenProfiles ?? []).map((p: any) => ({
      ...p,
      ...(cDetailMap[p.id] ?? {}),
      violations: violationsByCitizen[p.id] ?? [],
    }));
    setCitizens(mergedCitizens);

    // Stats
    const [
      { count: totalProfiles },
      { count: totalBins },
      { count: criticalBins },
      { count: highBins },
      { count: pendingViol },
      { count: totalCollect },
      { count: archivedUsers },
      { count: onDutyDrivers },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bins").select("id", { count: "exact", head: true }),
      supabase.from("bins").select("id", { count: "exact", head: true }).gte("fill_level", 90),
      supabase.from("bins").select("id", { count: "exact", head: true }).gte("fill_level", 70).lt("fill_level", 90),
      supabase.from("violations").select("id", { count: "exact", head: true }).eq("status", "Pending"),
      supabase.from("collections").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_archived", true),
      supabase.from("driver_details").select("id", { count: "exact", head: true }).eq("duty_status", "ON-DUTY"),
    ]);

    const { count: citizenCount } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "CITIZEN");
    const roleCounts = (profiles ?? []).reduce((acc: any, p: any) => { acc[p.role] = (acc[p.role] ?? 0) + 1; return acc; }, {});

    setStats({
      totalUsers: totalProfiles ?? 0,
      totalAdmins: roleCounts.ADMIN ?? 0,
      totalDrivers: roleCounts.DRIVER ?? 0,
      totalLGU: roleCounts.LGU ?? 0,
      totalCitizens: citizenCount ?? 0,
      totalBins: totalBins ?? 0,
      criticalBins: criticalBins ?? 0,
      highBins: highBins ?? 0,
      pendingViolations: pendingViol ?? 0,
      totalCollections: totalCollect ?? 0,
      archivedUsers: archivedUsers ?? 0,
      onDutyDrivers: onDutyDrivers ?? 0,
    });

    // Audit logs (last 60)
    const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(60);
    const adminIds = [...new Set((logs ?? []).map((l: any) => l.admin_id).filter(Boolean))];
    let adminNames: Record<string, string> = {};
    if (adminIds.length > 0) {
      const { data: ap } = await supabase.from("profiles").select("id, full_name").in("id", adminIds);
      adminNames = Object.fromEntries((ap ?? []).map((p: any) => [p.id, p.full_name]));
    }
    setAuditLogs((logs ?? []).map((l: any) => ({ ...l, admin_name: adminNames[l.admin_id] ?? "System" })));

    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleArchive = async (userId: string, current: boolean) => {
    setProcessing(userId);
    await supabase.from("profiles").update({ is_archived: !current }).eq("id", userId);
    await supabase.from("audit_logs").insert({ admin_id: meId, action_type: current ? "UNARCHIVE_USER" : "ARCHIVE_USER", target_id: userId, reason: `${current ? "Unarchived" : "Archived"} by Super Admin` });
    await fetchData();
    setProcessing(null);
  };

  const changeRole = async (userId: string, newRole: UserRole) => {
    setProcessing(userId);
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    await supabase.from("audit_logs").insert({ admin_id: meId, action_type: "ASSIGN_ROLE", target_id: userId, reason: `Role changed to ${newRole} by Super Admin` });
    await fetchData();
    setProcessing(null);
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const mR = roleFilter === "all" || u.role === roleFilter;
    const mS = (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
               (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
               (u.barangay ?? "").toLowerCase().includes(search.toLowerCase());
    return mR && mS;
  });

  const filteredCitizens = citizens.filter(c => {
    const mF = citizenFilter === "all" ? true
      : citizenFilter === "warnings" ? c.warning_count > 0
      : citizenFilter === "violations" ? (c.violations?.length ?? 0) > 0
      : citizenFilter === "archived" ? c.is_archived
      : true;
    const mS = (c.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
               (c.barangay ?? "").toLowerCase().includes(search.toLowerCase()) ||
               (c.email ?? "").toLowerCase().includes(search.toLowerCase());
    return mF && mS;
  });

  const unassignedLGU = users.filter(u => u.role === "LGU" && !u.barangay).length;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#020c1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid rgba(52,211,153,.2)", borderTopColor: "#34d399", animation: "spin 1s linear infinite", margin: "0 auto 14px" }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "sans-serif" }}>Loading system…</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "users",    label: "Staff",    icon: UserCog,   badge: users.length },
    { id: "citizens", label: "Citizens", icon: Users,     badge: citizens.length },
    { id: "audit",    label: "Audit Log",icon: Terminal,  badge: auditLogs.length },
    { id: "system",   label: "Overview", icon: BarChart3, badge: null },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020c1a", fontFamily: "sans-serif", color: "#d1fae5" }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dropIn  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .row-hover:hover   { background: rgba(52,211,153,.03) !important; }
        .tab-pill          { transition: all .18s; border-radius: 10px; }
        .tab-pill:hover    { background: rgba(52,211,153,.08) !important; }
        .act-btn           { transition: all .15s; }
        .act-btn:hover     { opacity: .85; }
        .menu-btn:hover    { background: rgba(52,211,153,.1) !important; }
        input::placeholder { color: #1f2937; }
        select option      { background: #0a1628; color: #d1fae5; }
        ::-webkit-scrollbar       { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(52,211,153,.2); border-radius: 2px; }
      `}</style>

      {/* MODAL */}
      {assignTarget && (
        <AssignBarangayModal user={assignTarget} meId={meId} onClose={() => setAssignTarget(null)} onSuccess={fetchData} />
      )}

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <nav style={{
        background: "rgba(2,12,26,.95)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(52,211,153,.1)",
        padding: "0 20px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 200,
        boxShadow: "0 1px 0 rgba(52,211,153,.06), 0 4px 24px rgba(0,0,0,.4)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "linear-gradient(135deg, rgba(52,211,153,.3), rgba(6,95,70,.6))", border: "1px solid rgba(52,211,153,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={17} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#d1fae5", lineHeight: 1, letterSpacing: "-.01em" }}>EcoRoute</div>
            <div style={{ fontSize: 9, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase" }}>Super Admin</div>
          </div>
        </div>

        {/* Center — alert pills (hidden on mobile) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center", padding: "0 24px", overflow: "hidden" }}>
          {stats && stats.criticalBins > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)", whiteSpace: "nowrap" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>{stats.criticalBins} critical bin{stats.criticalBins !== 1 ? "s" : ""}</span>
            </div>
          )}
          {unassignedLGU > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", whiteSpace: "nowrap" }}>
              <MapPin size={11} color="#f59e0b" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fcd34d" }}>{unassignedLGU} LGU unassigned</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.15)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: ".06em", textTransform: "uppercase" }}>Online</span>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Desktop: name + signout */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, rgba(52,211,153,.3), rgba(6,95,70,.5))", border: "1px solid rgba(52,211,153,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#34d399" }}>
              {meName.charAt(0)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6ee7b7", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meName}</span>
          </div>
          <button onClick={signOut} className="act-btn" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(52,211,153,.15)", borderRadius: 9, padding: "6px 12px", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={13} color="#374151" />
            <span style={{ display: "none" }} className="desktop-only">Sign out</span>
          </button>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenu(o => !o)} style={{ display: "none", background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.15)", borderRadius: 9, padding: 8, cursor: "pointer" }} className="mobile-menu-btn">
            <Menu size={16} color="#34d399" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && (
        <div style={{ background: "rgba(2,12,26,.98)", borderBottom: "1px solid rgba(52,211,153,.1)", padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map(t => {
            const TIcon = t.icon;
            return (
              <button key={t.id} onClick={() => { setActiveTab(t.id as any); setMobileMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeTab === t.id ? "rgba(52,211,153,.1)" : "transparent", color: activeTab === t.id ? "#34d399" : "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif", textAlign: "left" }}>
                <TIcon size={16} />
                {t.label}
              </button>
            );
          })}
          <div style={{ height: 1, background: "rgba(52,211,153,.1)", margin: "6px 0" }} />
          <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif" }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}

      {/* Extra responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .mobile-menu-btn { display: flex !important; }
          .desktop-only { display: inline !important; }
        }
        @media (min-width: 641px) {
          .desktop-only { display: inline !important; }
        }
        .menu-btn:hover { background: rgba(52,211,153,.1) !important; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── TITLE ───────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24, animation: "fadeUp .4s ease both" }}>
          <h1 style={{ fontSize: "clamp(20px,4vw,30px)", fontWeight: 900, color: "#d1fae5", margin: 0, letterSpacing: "-.03em", fontFamily: "Georgia, serif" }}>
            System Control Center
          </h1>
          <p style={{ fontSize: 13, color: "#374151", margin: "3px 0 0" }}>
            EcoRoute · Davao Oriental · {citizens.length} citizens · {users.length} staff accounts
          </p>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard icon={Users}         label="Total Users"    value={stats?.totalUsers ?? 0}        sub={`${stats?.archivedUsers ?? 0} archived`}     accent="#34d399" delay={0}    />
          <StatCard icon={Building2}     label="Admins"         value={stats?.totalAdmins ?? 0}       sub="Barangay scope"                               accent="#6ee7b7" delay={0.04} />
          <StatCard icon={Truck}         label="Drivers"        value={stats?.totalDrivers ?? 0}      sub={`${stats?.onDutyDrivers ?? 0} on duty`}       accent="#a7f3d0" delay={0.08} />
          <StatCard icon={MapPin}        label="LGU Officials"  value={stats?.totalLGU ?? 0}          sub={unassignedLGU > 0 ? `${unassignedLGU} unassigned` : "All assigned"} accent="#fcd34d" delay={0.12} warn={unassignedLGU > 0} />
          <StatCard icon={Users}         label="Citizens"       value={stats?.totalCitizens ?? 0}     sub="Registered users"                             accent="#34d399" delay={0.16} />
          <StatCard icon={Trash2}        label="Smart Bins"     value={stats?.totalBins ?? 0}         sub={`${stats?.criticalBins ?? 0} critical · ${stats?.highBins ?? 0} high`} accent="#f87171" delay={0.20} warn={(stats?.criticalBins ?? 0) > 0} />
          <StatCard icon={AlertTriangle} label="Violations"     value={stats?.pendingViolations ?? 0} sub="Pending review"                               accent="#fcd34d" delay={0.24} warn={(stats?.pendingViolations ?? 0) > 0} />
          <StatCard icon={Database}      label="Collections"    value={stats?.totalCollections ?? 0}  sub="Total logged"                                 accent="#6ee7b7" delay={0.28} />
        </div>

        {/* ── MAIN PANEL ──────────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(2,15,30,.8)",
          borderRadius: 18, border: "1px solid rgba(52,211,153,.12)",
          overflow: "hidden",
          boxShadow: "0 8px 48px rgba(0,0,0,.5), 0 0 0 1px rgba(52,211,153,.04)",
          animation: "fadeUp .5s ease .3s both",
        }}>

          {/* Tab bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 18px", borderBottom: "1px solid rgba(52,211,153,.08)",
            flexWrap: "wrap", gap: 4, background: "rgba(52,211,153,.02)",
          }}>
            <div style={{ display: "flex", gap: 2, padding: "8px 0" }}>
              {TABS.map(tab => {
                const TIcon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className="tab-pill"
                    onClick={() => { setActiveTab(tab.id as any); setSearch(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "8px 14px", border: "none", cursor: "pointer",
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? "#34d399" : "#374151",
                      background: active ? "rgba(52,211,153,.1)" : "transparent",
                      fontFamily: "sans-serif",
                    }}
                  >
                    <TIcon size={14} />
                    {tab.label}
                    {tab.badge !== null && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: active ? "rgba(52,211,153,.2)" : "rgba(255,255,255,.05)", color: active ? "#34d399" : "#374151" }}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              {activeTab === "users" && (
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", border: "1px solid rgba(52,211,153,.15)", borderRadius: 8, background: "rgba(52,211,153,.06)", color: "#6ee7b7", outline: "none", fontFamily: "sans-serif", cursor: "pointer" }}>
                  <option value="all">All roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="DRIVER">Driver</option>
                  <option value="LGU">LGU</option>
                </select>
              )}
              {activeTab === "citizens" && (
                <select value={citizenFilter} onChange={e => setCitizenFilter(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", border: "1px solid rgba(52,211,153,.15)", borderRadius: 8, background: "rgba(52,211,153,.06)", color: "#6ee7b7", outline: "none", fontFamily: "sans-serif", cursor: "pointer" }}>
                  <option value="all">All citizens</option>
                  <option value="warnings">With warnings</option>
                  <option value="violations">With violations</option>
                  <option value="archived">Archived</option>
                </select>
              )}
              {(activeTab === "users" || activeTab === "citizens" || activeTab === "audit") && (
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#374151" }} />
                  <input
                    placeholder="Search…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: "1px solid rgba(52,211,153,.15)", borderRadius: 8, fontSize: 12, color: "#d1fae5", outline: "none", width: 170, background: "rgba(52,211,153,.06)", fontFamily: "sans-serif" }}
                  />
                </div>
              )}
              <button onClick={fetchData} className="act-btn" style={{ padding: "7px 9px", border: "1px solid rgba(52,211,153,.15)", borderRadius: 8, background: "rgba(52,211,153,.06)", cursor: "pointer" }}>
                <RefreshCw size={13} color="#34d399" />
              </button>
            </div>
          </div>

          {/* ── STAFF/USERS TAB ─────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "rgba(52,211,153,.03)" }}>
                    {["User", "Role", "Detail", "Status", "Updated", "Actions"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(52,211,153,.07)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 48, color: "#374151", fontSize: 13 }}>No users found</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.id} className="row-hover" style={{ borderBottom: "1px solid rgba(52,211,153,.05)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${ROLE_CONFIG[u.role]?.color ?? "#34d399"}15`, border: `1px solid ${ROLE_CONFIG[u.role]?.color ?? "#34d399"}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: ROLE_CONFIG[u.role]?.color ?? "#34d399", flexShrink: 0 }}>
                            {(u.full_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: u.is_archived ? "#374151" : "#d1fae5", textDecoration: u.is_archived ? "line-through" : "none", display: "flex", alignItems: "center", gap: 6 }}>
                              {u.full_name ?? "—"}
                              {u.id === meId && <span style={{ fontSize: 9, fontWeight: 800, color: "#34d399", background: "rgba(52,211,153,.12)", padding: "1px 6px", borderRadius: 8 }}>YOU</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#374151" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}><RoleBadge role={u.role} /></td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>
                        {u.role === "DRIVER" && (
                          <div>
                            <div style={{ color: "#6ee7b7", fontWeight: 600 }}>{u.license_number ?? "No license"}</div>
                            {u.vehicle_plate_number && <div style={{ fontSize: 11 }}>{u.vehicle_plate_number}</div>}
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: u.duty_status === "ON-DUTY" ? "#34d399" : "#374151", display: "inline-block" }} />
                              <span style={{ fontSize: 11, color: u.duty_status === "ON-DUTY" ? "#34d399" : "#374151" }}>{u.duty_status ?? "OFF-DUTY"}</span>
                            </div>
                          </div>
                        )}
                        {u.role === "LGU" && (
                          u.barangay ? (
                            <div>
                              <div style={{ fontWeight: 600, color: "#fcd34d" }}>{u.barangay}</div>
                              <div style={{ fontSize: 11 }}>{u.position_title ?? "—"}</div>
                              {u.municipality && <div style={{ fontSize: 11 }}>{u.municipality}</div>}
                            </div>
                          ) : (
                            <button onClick={() => setAssignTarget(u)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: "rgba(245,158,11,.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.25)", fontFamily: "sans-serif" }}>
                              <MapPin size={10} />Unassigned
                            </button>
                          )
                        )}
                        {u.role === "ADMIN"       && <span style={{ color: "#374151" }}>Barangay Admin</span>}
                        {u.role === "SUPER_ADMIN" && <span style={{ color: "#34d399", fontWeight: 700 }}>Full system access</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: u.is_archived ? "rgba(71,85,105,.15)" : "rgba(52,211,153,.1)", color: u.is_archived ? "#374151" : "#34d399" }}>
                          {u.is_archived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{timeAgo(u.updated_at)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {processing === u.id ? (
                          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(52,211,153,.2)", borderTopColor: "#34d399", animation: "spin .8s linear infinite" }} />
                        ) : (
                          <ActionMenu user={u} meId={meId} onArchive={toggleArchive} onRole={changeRole} onAssign={setAssignTarget} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CITIZENS TAB ────────────────────────────────────────────── */}
          {activeTab === "citizens" && (
            <div style={{ overflowX: "auto" }}>
              {/* Summary bar */}
              <div style={{ display: "flex", gap: 16, padding: "12px 18px", borderBottom: "1px solid rgba(52,211,153,.06)", flexWrap: "wrap" }}>
                {[
                  { label: "Total",          val: citizens.length,                                           color: "#34d399" },
                  { label: "With warnings",  val: citizens.filter(c => c.warning_count > 0).length,          color: "#fcd34d" },
                  { label: "With violations",val: citizens.filter(c => (c.violations?.length ?? 0) > 0).length, color: "#f87171" },
                  { label: "Archived",       val: citizens.filter(c => c.is_archived).length,                color: "#374151" },
                  { label: "Showing",        val: filteredCitizens.length,                                   color: "#6ee7b7" },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.val}</span>
                    <span style={{ fontSize: 11, color: "#374151" }}>{s.label}</span>
                  </div>
                ))}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ background: "rgba(52,211,153,.03)" }}>
                    {["Citizen", "Barangay", "Purok / Street", "LGU Assigned", "Warnings", "Violations", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(52,211,153,.07)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCitizens.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 48, color: "#374151", fontSize: 13 }}>No citizens found</td></tr>
                  ) : filteredCitizens.map(c => (
                    <CitizenRow key={c.id} c={c} lguMap={lguMap} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── AUDIT LOG TAB ───────────────────────────────────────────── */}
          {activeTab === "audit" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: "rgba(52,211,153,.03)" }}>
                    {["Action", "Performed By", "Target ID", "Reason", "Time"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(52,211,153,.07)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 48, color: "#374151", fontSize: 13 }}>No audit logs yet</td></tr>
                  ) : auditLogs.filter(l =>
                    search === "" ||
                    l.action_type.toLowerCase().includes(search.toLowerCase()) ||
                    (l.admin_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
                    (l.reason ?? "").toLowerCase().includes(search.toLowerCase())
                  ).map(log => (
                    <tr key={log.id} className="row-hover" style={{ borderBottom: "1px solid rgba(52,211,153,.04)" }}>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(52,211,153,.1)", color: "#6ee7b7", whiteSpace: "nowrap" }}>
                          {log.action_type}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#6ee7b7", fontWeight: 600 }}>{log.admin_name}</td>
                      <td style={{ padding: "11px 16px", fontSize: 11, fontFamily: "monospace", color: "#374151", maxWidth: 140 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.target_id ?? "—"}</div>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#4b5563", maxWidth: 240 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.reason ?? "—"}</div>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>{timeAgo(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SYSTEM OVERVIEW TAB ─────────────────────────────────────── */}
          {activeTab === "system" && stats && (
            <div style={{ padding: "20px 20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>

              {/* User breakdown */}
              <div style={{ background: "rgba(52,211,153,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(52,211,153,.09)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
                  <Layers size={13} color="#34d399" />User Breakdown
                </div>
                {([
                  { role: "SUPER_ADMIN", cnt: users.filter(u => u.role === "SUPER_ADMIN").length },
                  { role: "ADMIN",  cnt: stats.totalAdmins },
                  { role: "DRIVER", cnt: stats.totalDrivers },
                  { role: "LGU",    cnt: stats.totalLGU },
                  { role: "CITIZEN",cnt: stats.totalCitizens },
                ] as { role: UserRole; cnt: number }[]).map(({ role, cnt }) => {
                  const cfg = ROLE_CONFIG[role];
                  const pct = stats.totalUsers > 0 ? (cnt / stats.totalUsers) * 100 : 0;
                  return (
                    <div key={role} style={{ marginBottom: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                          <span style={{ fontSize: 12, color: "#6ee7b7" }}>{cfg.label}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#d1fae5" }}>{cnt}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(52,211,153,.08)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: cfg.color, transition: "width .6s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bin health */}
              <div style={{ background: "rgba(52,211,153,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(52,211,153,.09)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
                  <Trash2 size={13} color="#34d399" />Bin Network Health
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Total Bins",   value: stats.totalBins,        color: "#34d399" },
                    { label: "Critical",     value: stats.criticalBins,     color: "#f87171" },
                    { label: "High Fill",    value: stats.highBins,         color: "#fcd34d" },
                    { label: "Collections", value: stats.totalCollections,  color: "#6ee7b7" },
                  ].map(s => (
                    <div key={s.label} style={{ background: `${s.color}08`, borderRadius: 10, padding: "14px 16px", border: `1px solid ${s.color}18` }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: "Georgia, serif", lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Violations + compliance */}
              <div style={{ background: "rgba(52,211,153,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(52,211,153,.09)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
                  <AlertTriangle size={13} color="#f59e0b" />Violations Overview
                </div>
                {[
                  { label: "Pending",      val: citizens.reduce((a, c) => a + (c.violations?.filter(v => v.status === "Pending").length ?? 0), 0), color: "#f59e0b" },
                  { label: "Under Review", val: citizens.reduce((a, c) => a + (c.violations?.filter(v => v.status === "Under Review").length ?? 0), 0), color: "#60a5fa" },
                  { label: "Resolved",     val: citizens.reduce((a, c) => a + (c.violations?.filter(v => v.status === "Resolved").length ?? 0), 0), color: "#34d399" },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(52,211,153,.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                      <span style={{ fontSize: 13, color: "#6ee7b7" }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "Georgia, serif" }}>{s.val}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#6ee7b7" }}>RA 9003 Compliance</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#34d399" }}>
                      {stats.totalCitizens > 0 ? Math.round(((stats.totalCitizens - citizens.filter(c => c.warning_count > 0).length) / stats.totalCitizens) * 100) : 0}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(52,211,153,.1)" }}>
                    <div style={{ height: "100%", width: `${stats.totalCitizens > 0 ? Math.round(((stats.totalCitizens - citizens.filter(c => c.warning_count > 0).length) / stats.totalCitizens) * 100) : 0}%`, borderRadius: 3, background: "linear-gradient(90deg, #059669, #34d399)", transition: "width .6s" }} />
                  </div>
                </div>
              </div>

              {/* LGU coverage */}
              <div style={{ background: "rgba(52,211,153,.03)", borderRadius: 14, padding: 20, border: "1px solid rgba(52,211,153,.09)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#374151", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
                  <MapPin size={13} color="#fcd34d" />LGU Coverage
                </div>
                {users.filter(u => u.role === "LGU").length === 0 ? (
                  <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>No LGU accounts yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {users.filter(u => u.role === "LGU").map(u => {
                      const citizenCount = citizens.filter(c => c.barangay === u.barangay).length;
                      return (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: "rgba(52,211,153,.04)", border: `1px solid ${u.barangay ? "rgba(52,211,153,.12)" : "rgba(245,158,11,.2)"}` }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: u.barangay ? "#34d399" : "#f59e0b", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#d1fae5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name}</div>
                            <div style={{ fontSize: 11, color: u.barangay ? "#fcd34d" : "#f59e0b" }}>{u.barangay ?? "Unassigned"}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399" }}>{citizenCount} citizens</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}