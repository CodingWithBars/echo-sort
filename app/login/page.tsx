"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const setSession = (role: string) => {
      document.cookie = `user-role=${role}; path=/; max-age=86400`;
    };

    if (email === "admin@eco.com" && password === "admin123") {
      setSession("ADMIN");
      router.push("/admin/dashboard");
    } 
    else if (email === "driver1@eco.com" && password === "driver123") {
      setSession("DRIVER");
      router.push("/driver/map");
    } 
    else if (email === "citizen@eco.com" && password === "citizen123") {
      setSession("CITIZEN");
      router.push("/citizen/schedule");
    } 
    else {
      setError("Invalid email or password. Please check the test credentials.");
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-100">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-600 text-white mb-4 shadow-lg shadow-emerald-200">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">EcoRoute</h1>
          <p className="text-slate-500 text-sm mt-1">Efficient Waste Management Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3.5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl animate-shake">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}
          
          {/* Email Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
              placeholder="e.g., driver1@eco.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.956 9.956 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <button className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all mt-2">
            Sign In
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-slate-500 text-sm">
            Citizen without an account?{" "}
            <Link href="/register" className="text-emerald-600 font-bold hover:underline">
              Register Now
            </Link>
          </p>
          
          {/* Test Credentials Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Internal Test Access</p>
            <div className="space-y-1 text-[11px] font-mono text-slate-600">
              <div className="flex justify-between"><span>Admin: admin@eco.com</span> <span>admin123</span></div>
              <div className="flex justify-between"><span>Driver: driver1@eco.com</span> <span>driver123</span></div>
              <div className="flex justify-between"><span>Citizen: citizen@eco.com</span> <span>citizen123</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}