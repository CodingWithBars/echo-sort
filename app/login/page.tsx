"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// 1. Move the logic into a separate component
function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams(); // This hook requires Suspense
  const supabase = createClient();

  // Handle success messages from the registration redirect
  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg) setMessage(msg);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    // 1. Authenticate the user
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // 2. Fetch the Role from the PROFILES table (where we ran the SQL update)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setError("Profile configuration error. Please contact support.");
      setLoading(false);
      return;
    }

    // 3. Routing based on the database Role
    const role = profile.role;

    if (role === "ADMIN") {
      window.location.href = "/admin/dashboard"; // Hard redirect
    } else if (role === "DRIVER") {
      window.location.href = "/driver/dashboard";
    } else {
      window.location.href = "/citizen/schedule";
    }

    router.refresh();
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl w-full max-w-md border border-emerald-100">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-600 text-white mb-4 shadow-lg shadow-emerald-200">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            EcoRoute
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Waste Management Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Success Message */}
          {message && (
            <div className="flex items-center gap-2 p-4 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in fade-in zoom-in-95">
              <span>✅ {message}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-4 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-2xl animate-in slide-in-from-top-2">
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              required
              disabled={loading}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm"
              placeholder="name@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm"
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                {showPassword ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.956 9.956 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter">
            Citizen without an account?{" "}
            <Link
              href="/register"
              className="text-emerald-600 hover:underline ml-1"
            >
              Register Now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// 2. Wrap the sub-component in a Suspense boundary for the main export
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">
            Loading Portal
          </p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
