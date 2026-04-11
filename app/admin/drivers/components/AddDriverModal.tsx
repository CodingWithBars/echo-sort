"use client";
// components/admin/AddDriverModal.tsx
// Production-grade modal for registering a new driver account.
// Uses Supabase Edge Function (or service-role RPC) to create the auth user
// then inserts profiles + driver_details rows.
//
// Fields collected:
//   Personal  : first_name, last_name, middle_name, name_ext, contact_number
//   Auth      : email, password
//   Jurisdiction : municipality (pre-filled from admin scope), barangay
//   Vehicle   : vehicle_plate_number, vehicle_type, license_number, license_expiry
//   Assignment: assigned_route, employment_status
//   Emergency : emergency_contact_name, emergency_contact_number
//   Notes     : notes (internal memo, not shown to driver)

import { useState, useEffect } from "react";
import { createClient }        from "@/utils/supabase/client";
import {
  UserPlus, Mail, Lock, User, Truck, CreditCard, X, ShieldCheck,
  MapPin, Building2, Phone, FileText, AlertTriangle, Calendar,
  CheckCircle2, ChevronDown, Navigation, Eye, EyeOff,
} from "lucide-react";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  "Dump Truck", "Compactor Truck", "Open Truck",
  "Utility Vehicle", "Motorcycle w/ Cart", "Trike", "Pickup Truck",
];

const EMPLOYMENT_STATUSES = ["ACTIVE", "INACTIVE"];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AdminScope {
  municipality: string | null;
  barangay:     string | null;
  adminId:      string | null;
}

interface DriverForm {
  // Personal
  first_name:   string;
  middle_name:  string;
  last_name:    string;
  name_ext:     string;
  contact_number: string;
  // Auth
  email:        string;
  password:     string;
  // Jurisdiction
  municipality: string;
  barangay:     string;
  // Vehicle
  vehicle_plate_number: string;
  vehicle_type:  string;
  license_number: string;
  license_expiry: string;   // date string YYYY-MM-DD
  // Assignment
  assigned_route:    string;
  employment_status: string;
  // Emergency contact
  emergency_contact_name:   string;
  emergency_contact_number: string;
  // Internal
  notes: string;
}

const EMPTY_FORM: DriverForm = {
  first_name: "", middle_name: "", last_name: "", name_ext: "",
  contact_number: "",
  email: "", password: "",
  municipality: "", barangay: "",
  vehicle_plate_number: "", vehicle_type: "Dump Truck",
  license_number: "", license_expiry: "",
  assigned_route: "", employment_status: "ACTIVE",
  emergency_contact_name: "", emergency_contact_number: "",
  notes: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER helper
// ─────────────────────────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-4">
      <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <Icon size={12} className="text-emerald-600" />
      </div>
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT helpers
// ─────────────────────────────────────────────────────────────────────────────

const baseInput = "w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-normal outline-none focus:border-emerald-400 focus:ring-2 ring-emerald-400/10 transition-all";
const selectCls = baseInput + " cursor-pointer appearance-none pr-8";

function Field({
  label, required, children, hint,
}: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[9px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDriverModal({ isOpen, onClose, onSuccess }: Props) {
  const [form,        setForm]        = useState<DriverForm>(EMPTY_FORM);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [adminScope,  setAdminScope]  = useState<AdminScope>({ municipality: null, barangay: null, adminId: null });
  const [step,        setStep]        = useState<1 | 2 | 3>(1); // 3-step form

  // Load admin scope on open
  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(false);
    setStep(1);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("lgu_details")
        .select("municipality,barangay").eq("id", user.id).limit(1);
      const lgu = data?.[0];
      const scope: AdminScope = {
        municipality: lgu?.municipality ?? null,
        barangay:     lgu?.barangay     ?? null,
        adminId:      user.id,
      };
      setAdminScope(scope);
      // Pre-fill jurisdiction from admin scope
      setForm(f => ({
        ...f,
        municipality: lgu?.municipality ?? "",
        barangay:     lgu?.barangay     ?? "",
      }));
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (k: keyof DriverForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  // Driver creation must go through a server-side API route that uses the
  // Supabase service-role key. The client-side signUp() replaces the admin's
  // session with the new driver's session, which then fails RLS on profiles.
  const handleSubmit = async () => {
    setError(null);

    // ── Client-side validation ──────────────────────────────────────────────
    if (!form.first_name.trim() || !form.last_name.trim())
      return setError("First and last name are required.");

    // Email format check
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(form.email.trim()))
      return setError("Please enter a valid email address (e.g. juan@gmail.com).");

    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");

    // Philippine mobile number: must be exactly 11 digits starting with 09
    if (form.contact_number.trim()) {
      const digits = form.contact_number.replace(/[\s\-().+]/g, "");
      if (!/^09\d{9}$/.test(digits))
        return setError("Mobile number must be a valid 11-digit Philippine number starting with 09 (e.g. 09171234567).");
    }

    // Emergency contact number — same rule if provided
    if (form.emergency_contact_number.trim()) {
      const ecDigits = form.emergency_contact_number.replace(/[\s\-().+]/g, "");
      if (!/^09\d{9}$/.test(ecDigits))
        return setError("Emergency contact number must be a valid 11-digit Philippine number starting with 09.");
    }

    if (!form.municipality.trim() || !form.barangay.trim())
      return setError("Municipality and barangay are required.");
    if (!form.license_number.trim())
      return setError("License number is required.");

    setLoading(true);
    try {
      const fullName = [form.first_name, form.middle_name, form.last_name, form.name_ext]
        .map(s => s.trim()).filter(Boolean).join(" ");

      // Call our server-side API route which uses the service-role key.
      // This keeps the admin's session intact and bypasses RLS correctly.
      const res = await fetch("/api/admin/create-driver", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:                form.email.trim().toLowerCase(),
          password:             form.password,
          full_name:            fullName,
          first_name:           form.first_name.trim(),
          middle_name:          form.middle_name.trim() || null,
          last_name:            form.last_name.trim(),
          name_ext:             form.name_ext.trim() || null,
          contact_number:       form.contact_number.replace(/[\s\-().+]/g, "") || null,
          municipality:         form.municipality.trim(),
          barangay:             form.barangay.trim(),
          license_number:       form.license_number.trim(),
          license_expiry:       form.license_expiry || null,
          vehicle_plate_number: form.vehicle_plate_number.trim().toUpperCase() || null,
          vehicle_type:         form.vehicle_type || null,
          assigned_route:       form.assigned_route.trim() || null,
          employment_status:    form.employment_status,
          emergency_contact_name:   form.emergency_contact_name.trim() || null,
          emergency_contact_number: form.emergency_contact_number.replace(/[\s\-().+]/g, "") || null,
          notes:                form.notes.trim() || null,
          admin_id:             adminScope.adminId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 1800);

    } catch (e: any) {
      setError(e.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // ── STEP VALIDATION ────────────────────────────────────────────────────────
  const canStep1  = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.password.length >= 8;
  const canStep2  = form.municipality.trim() && form.barangay.trim();   // license is on Step 3
  const canSubmit = canStep1 && canStep2 && form.license_number.trim(); // require license before final submit

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[70vh]">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-200">
              <UserPlus size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Register New Driver</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Fleet Management System</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── STEP INDICATOR ── */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-50 flex-shrink-0">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <button onClick={() => { if (s <= step || (s === 2 && canStep1) || (s === 3 && canStep1 && canStep2)) setStep(s); }}
                className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all
                  ${step === s ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                    : step > s  ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-400"}`}>
                  {step > s ? <CheckCircle2 size={10} /> : s}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-wider hidden sm:inline
                  ${step === s ? "text-emerald-700" : step > s ? "text-slate-500" : "text-slate-300"}`}>
                  {s === 1 ? "Identity" : s === 2 ? "Jurisdiction" : "Vehicle"}
                </span>
              </button>
              {i < 2 && (
                <div className={`flex-1 h-px mx-2 transition-colors ${step > s ? "bg-emerald-200" : "bg-slate-100"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── FORM BODY ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── STEP 1: PERSONAL + AUTH ── */}
          {step === 1 && (
            <>
              <SectionHead icon={User} label="Personal Information" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" required>
                  <input value={form.first_name} onChange={set("first_name")} placeholder="Juan" className={baseInput} />
                </Field>
                <Field label="Last Name" required>
                  <input value={form.last_name} onChange={set("last_name")} placeholder="Dela Cruz" className={baseInput} />
                </Field>
                <Field label="Middle Name">
                  <input value={form.middle_name} onChange={set("middle_name")} placeholder="Santos" className={baseInput} />
                </Field>
                <Field label="Name Extension">
                  <div className="relative">
                    <select value={form.name_ext} onChange={set("name_ext")} className={selectCls}>
                      <option value="">— None —</option>
                      {["Jr.", "Sr.", "II", "III", "IV"].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </Field>
              </div>
              <Field label="Mobile Number" hint="Will be used for on-duty contact and emergency purposes">
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={form.contact_number} onChange={set("contact_number")} placeholder="09XX-XXX-XXXX"
                    className={baseInput + " pl-8"} />
                </div>
              </Field>

              <SectionHead icon={Mail} label="Login Credentials" />
              <Field label="Email Address" required hint="Driver will use this to log into the EcoRoute app">
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={form.email} onChange={set("email")} placeholder="driver@ecosort.ph"
                    className={baseInput + " pl-8"} />
                </div>
              </Field>
              <Field label="Initial Password" required hint="Min. 8 characters. Driver can change this after first login.">
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")}
                    placeholder="Min. 8 characters" className={baseInput + " pl-8 pr-10"} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </Field>

              <SectionHead icon={Phone} label="Emergency Contact" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Name">
                  <input value={form.emergency_contact_name} onChange={set("emergency_contact_name")} placeholder="Maria Dela Cruz" className={baseInput} />
                </Field>
                <Field label="Contact Number">
                  <input value={form.emergency_contact_number} onChange={set("emergency_contact_number")} placeholder="09XX-XXX-XXXX" className={baseInput} />
                </Field>
              </div>
            </>
          )}

          {/* ── STEP 2: JURISDICTION + ASSIGNMENT ── */}
          {step === 2 && (
            <>
              <SectionHead icon={Building2} label="Jurisdiction Assignment" />

              {adminScope.municipality && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl mb-4">
                  <Building2 size={12} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-emerald-700">
                    Pre-filled from your admin scope: <span className="font-black">{adminScope.barangay} · {adminScope.municipality}</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Municipality" required>
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.municipality} onChange={set("municipality")} placeholder="e.g. Lupon"
                      className={baseInput + " pl-8"} />
                  </div>
                </Field>
                <Field label="Barangay" required>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.barangay} onChange={set("barangay")} placeholder="e.g. Poblacion"
                      className={baseInput + " pl-8"} />
                  </div>
                </Field>
              </div>

              <Field label="Assigned Route / Area" hint="Primary collection area or route name. Can be updated later via Schedule.">
                <div className="relative">
                  <Navigation size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={form.assigned_route} onChange={set("assigned_route")} placeholder="e.g. Purok 1–3 Main Road Loop"
                    className={baseInput + " pl-8"} />
                </div>
              </Field>

              <Field label="Employment Status" required>
                <div className="relative">
                  <select value={form.employment_status} onChange={set("employment_status")} className={selectCls}>
                    {EMPLOYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </Field>

              <SectionHead icon={FileText} label="Internal Notes" />
              <Field label="Admin Notes" hint="Not visible to the driver. Use for hiring source, referral, or onboarding notes.">
                <textarea value={form.notes} onChange={set("notes")} rows={3}
                  placeholder="e.g. Hired via PESO referral. Has experience with compactor trucks. Background check complete."
                  className={baseInput + " h-auto py-2.5 resize-none leading-relaxed"} />
              </Field>
            </>
          )}

          {/* ── STEP 3: VEHICLE + LICENSE ── */}
          {step === 3 && (
            <>
              <SectionHead icon={CreditCard} label="Driver's License" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="License Number" required>
                  <div className="relative">
                    <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.license_number} onChange={set("license_number")} placeholder="A01-00-123456"
                      className={baseInput + " pl-8 font-mono"} />
                  </div>
                </Field>
                <Field label="License Expiry" hint="For renewal reminders">
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="date" value={form.license_expiry} onChange={set("license_expiry")}
                      className={baseInput + " pl-8"} />
                  </div>
                </Field>
              </div>

              <SectionHead icon={Truck} label="Vehicle Assignment" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plate Number">
                  <div className="relative">
                    <Truck size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.vehicle_plate_number} onChange={set("vehicle_plate_number")} placeholder="ABC 1234"
                      className={baseInput + " pl-8 font-mono uppercase"} />
                  </div>
                </Field>
                <Field label="Vehicle Type">
                  <div className="relative">
                    <select value={form.vehicle_type} onChange={set("vehicle_type")} className={selectCls}>
                      <option value="">— Select type —</option>
                      {VEHICLE_TYPES.map(v => <option key={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </Field>
              </div>

              {/* Summary card */}
              <div className="mt-2 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Registration Summary</p>
                {[
                  { label: "Full Name",     value: [form.first_name, form.last_name, form.name_ext].filter(Boolean).join(" ") },
                  { label: "Email",         value: form.email },
                  { label: "Jurisdiction",  value: [form.barangay, form.municipality].filter(Boolean).join(", ") || "—" },
                  { label: "License",       value: form.license_number || "—" },
                  { label: "Plate No.",     value: form.vehicle_plate_number || "— Unassigned" },
                  { label: "Vehicle",       value: form.vehicle_type || "—" },
                  { label: "Route",         value: form.assigned_route || "— To be assigned" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{r.label}</span>
                    <span className="text-[10px] font-black text-slate-700 text-right max-w-[60%] truncate">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── ERROR ── */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {success && (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wide">
                Driver account created! Sending welcome notification…
              </p>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => (s - 1) as any)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors">
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => (s + 1) as any)}
                disabled={step === 1 ? !canStep1 : !canStep2}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-200">
                Next Step →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || success || !canSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-40 shadow-sm shadow-emerald-200">
                {loading
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                  : <><ShieldCheck size={13} />Create Driver Account</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}