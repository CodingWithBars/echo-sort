"use client";

import { Leaf } from "lucide-react";

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="relative flex items-center justify-center">
        {/* Outer Glow Effect */}
        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse"></div>
        
        {/* Primary spinning ring */}
        <div className="w-20 h-20 border-[3px] border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
        
        {/* Secondary reverse spinning ring */}
        <div className="absolute w-14 h-14 border-[3px] border-slate-400/10 border-b-emerald-400 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
        
        {/* Center Icon */}
        <div className="absolute inset-0 flex items-center justify-center text-emerald-500 animate-pulse">
          <Leaf size={24} fill="currentColor" className="opacity-90" />
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <h3 className="text-white font-bold text-xs uppercase tracking-[0.3em] animate-in slide-in-from-bottom-2 duration-700">
          Creating Account
        </h3>
        <p className="text-emerald-400/60 font-medium text-[9px] uppercase tracking-widest animate-pulse">
          Securing your waste management profile
        </p>
      </div>

      {/* Decorative progress-like bar (Static visual) */}
      <div className="mt-6 w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 w-1/2 rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}