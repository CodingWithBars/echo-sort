"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  Shield, Mail, Lock, Eye, EyeOff,
  Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Role → redirect map
// Keep this as the single source of truth — update routes here only.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_REDIRECT: Record<string, string> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  ADMIN:       "/admin/dashboard",
  DRIVER:      "/driver/dashboard",
  LGU:         "/lgu/dashboard",
  CITIZEN:     "/citizen/schedule",
};

// Fallback for unknown / unmapped roles
const DEFAULT_REDIRECT = "/citizen/schedule";

// ─────────────────────────────────────────────────────────────────────────────
// Login form
// ─────────────────────────────────────────────────────────────────────────────

function LoginContent() {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const [message,      setMessage]      = useState("");
  const [loading,      setLoading]      = useState(false);

  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg) setMessage(decodeURIComponent(msg));
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    // ── 1. Authenticate ───────────────────────────────────────────────────
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // ── 2. Fetch role from profiles ───────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_archived")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Profile configuration error. Please contact support.");
      setLoading(false);
      return;
    }

    // ── 3. Guard: archived accounts ───────────────────────────────────────
    if (profile.is_archived) {
      await supabase.auth.signOut();
      setError("Your account has been deactivated. Please contact your administrator.");
      setLoading(false);
      return;
    }

    // ── 4. Guard: Driver must be ACTIVE ──────────────────────────────────
    if (profile.role === "DRIVER") {
      const { data: driverData } = await supabase
        .from("driver_details")
        .select("employment_status")
        .eq("id", authData.user.id)
        .single();

      if (driverData?.employment_status !== "ACTIVE") {
        await supabase.auth.signOut();
        setError("Your driver account is not active. Contact your administrator.");
        setLoading(false);
        return;
      }
    }

    // ── 5. Guard: LGU must have a barangay assignment ─────────────────────
    if (profile.role === "LGU") {
      const { data: lguData } = await supabase
        .from("lgu_details")
        .select("barangay")
        .eq("id", authData.user.id)
        .single();

      if (!lguData?.barangay) {
        setError("LGU account is not yet assigned to a barangay. Contact your Super Admin.");
        setLoading(false);
        return;
      }
    }

    // ── 6. Redirect ───────────────────────────────────────────────────────
    const dest = ROLE_REDIRECT[profile.role] ?? DEFAULT_REDIRECT;
    router.refresh();
    window.location.href = dest;
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Decorative top bar */}
        <div className="h-1.5 bg-emerald-600 w-full" />

        <div className="p-8 md:p-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100 mb-4 transition-transform hover:scale-105">
              <Shield size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">EcoRoute</h1>
            <p className="text-slate-500 text-sm mt-1">Resource & Waste Management Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Success message (e.g. after registration) */}
            {message && (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-emerald-800">{message}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                Account Email
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  disabled={loading}
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                Security Key
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest shadow-md shadow-emerald-100 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : (
                "Authorize Login"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col gap-4 text-center">
            <p className="text-sm text-slate-500">
              New to the platform?{" "}
              <Link
                href="/register"
                className="text-emerald-600 hover:text-emerald-700 font-bold decoration-emerald-200 underline-offset-4 hover:underline"
              >
                Create an account
              </Link>
            </p>
            <div className="flex justify-center gap-4 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
              <span className="hover:text-slate-600 cursor-pointer">Security Portal</span>
              <span>•</span>
              <span className="hover:text-slate-600 cursor-pointer">Help Center</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page wrapper (Suspense required for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest animate-pulse">
            Establishing Secure Connection
          </p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}