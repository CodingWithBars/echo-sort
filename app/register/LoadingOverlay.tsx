"use client";

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative">
        {/* Outer spinning ring */}
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        {/* Inner pulsing logo */}
        <div className="absolute inset-0 flex items-center justify-center font-black text-emerald-500 text-xs uppercase animate-pulse">
          Eco
        </div>
      </div>
      <p className="mt-4 text-white font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
        Creating Account...
      </p>
    </div>
  );
}