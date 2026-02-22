"use client";
import { useEffect, useState, Suspense } from "react"; // Added Suspense
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

// 1. Move the logic into a sub-component
function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setStatus("success");
      } else {
        const error = searchParams.get("error");
        if (error) setStatus("error");
        // Give it a small timeout to allow session to propagate
        else {
          const timeout = setTimeout(() => setStatus("error"), 5000);
          return () => clearTimeout(timeout);
        }
      }
    };

    checkSession();
  }, [searchParams]);

  return (
    <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-emerald-100 text-center">
      {status === "loading" && (
        <div className="animate-pulse">
          <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-6" />
          <h2 className="text-xl font-black text-slate-300 uppercase">Verifying...</h2>
        </div>
      )}

      {status === "success" && (
        <div className="animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-200">
            <span className="text-5xl text-white">✓</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase">Account Verified!</h1>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            Welcome to the EcoRoute fleet. Your citizen account is now active and ready for use.
          </p>
          <Link 
            href="/dashboard"
            className="block w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95"
          >
            Enter Dashboard
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <span className="text-5xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 uppercase">Link Expired</h1>
          <p className="text-slate-400 text-sm mb-10">
            This verification link has expired or has already been used.
          </p>
          <Link 
            href="/login"
            className="block w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest transition-all"
          >
            Back to Login
          </Link>
        </div>
      )}
    </div>
  );
}

// 2. The main page component wraps the content in Suspense
export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 font-sans">
      <Suspense fallback={
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-emerald-100 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-6 animate-pulse" />
          <h2 className="text-xl font-black text-slate-300 uppercase">Loading...</h2>
        </div>
      }>
        <ConfirmContent />
      </Suspense>
    </div>
  );
}