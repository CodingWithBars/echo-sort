"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client"; // Import your client utility

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 1. Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Redirect based on the role you stored in metadata
        const role = user.user_metadata?.role;
        if (role === 'ADMIN') router.push('/admin');
        else if (role === 'DRIVER') router.push('/driver');
        else router.push('/dashboard'); // For regular citizens
      }
      setLoading(false);
    };

    checkUser();

    // 2. Splash screen timer
    const timer = setTimeout(() => setShowSplash(false), 3500);
    return () => clearTimeout(timer);
  }, [router, supabase.auth]);

  // While checking auth or showing splash, keep the splash visible
  if (showSplash || loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-emerald-600 overflow-hidden">
        {/* ... Your Existing Splash Screen HTML ... */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white shadow-[0_0_50px_rgba(0,0,0,0.2)] overflow-hidden">
            <img
              src="/icons/icon-512x512.png"
              alt="EcoRoute Logo"
              className="h-full w-full object-cover p-5"
            />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white italic">
            ECO<span className="opacity-70">ROUTE</span>
          </h1>
        </div>

        <div className="relative mt-12 w-64 h-16">
          <div className="absolute top-1/2 left-0 w-full h-1 border-b-2 border-dashed border-emerald-400/50 -translate-y-1/2" />
          <div className="absolute top-1/2 left-0 -translate-y-1/2 animate-truck-move">
            <div className="flex flex-col items-center">
              <span className="text-3xl mb-1 drop-shadow-md scale-x-[-1]">🚛</span>
              <div className="flex gap-1 mr-6">
                <div className="h-1 w-1 bg-emerald-200 rounded-full animate-ping" />
                <div className="h-1 w-1 bg-emerald-200 rounded-full animate-ping delay-75" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-emerald-200 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">
          {loading ? "Verifying Session..." : "Optimizing Collection..."}
        </p>

        <style jsx>{`
          @keyframes truckMove {
            0% { transform: translate(-40px, -50%); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translate(260px, -50%); opacity: 0; }
          }
          .animate-truck-move {
            animation: truckMove 3.5s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // --- MAIN HOME PAGE VIEW ---
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-50 px-6 font-sans animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        {/* ... Rest of your existing Home UI ... */}
        <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white shadow-xl shadow-emerald-100 border border-emerald-50 overflow-hidden">
          <img src="/icons/icon-512x512.png" alt="EcoRoute Logo" className="h-full w-full object-cover p-4" />
        </div>

        <h1 className="text-4xl font-black tracking-tight text-emerald-900">EcoRoute</h1>
        
        <div className="mt-10 flex w-full flex-col gap-4">
          <Link href="/login" className="flex h-16 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 shadow-lg">
            Sign In
          </Link>
          <Link href="/register" className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white text-lg font-black uppercase tracking-widest text-emerald-700">
            Register as a Citizen
          </Link>
        </div>
      </main>
    </div>
  );
}