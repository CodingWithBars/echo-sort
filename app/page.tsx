"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500); // Slightly longer to enjoy the animation
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-emerald-600 overflow-hidden">
        {/* Main Logo Container */}
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

        {/* --- ROAD & TRUCK ANIMATION --- */}
        <div className="relative mt-12 w-64 h-16">
          {/* The Road (Dashed Line) */}
          <div className="absolute top-1/2 left-0 w-full h-1 border-b-2 border-dashed border-emerald-400/50 -translate-y-1/2" />

          {/* Static Bins along the road */}
          <div className="absolute top-1/2 left-4 -translate-y-[150%] text-xs opacity-60">
            🗑️
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-y-[-50%] text-xs opacity-60">
            🗑️
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-[150%] text-xs opacity-60">
            🗑️
          </div>

          {/* The Moving Truck Container */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 animate-truck-move">
            <div className="flex flex-col items-center">
              {/* Flip the truck icon so it faces right */}
              <span className="text-3xl mb-1 drop-shadow-md scale-x-[-1]">
                🚛
              </span>

              {/* Exhaust puffs - repositioned to stay behind the truck */}
              <div className="flex gap-1 mr-6">
                <div className="h-1 w-1 bg-emerald-200 rounded-full animate-ping" />
                <div className="h-1 w-1 bg-emerald-200 rounded-full animate-ping delay-75" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-emerald-200 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">
          Optimizing Collection...
        </p>

        <style jsx>{`
          @keyframes truckMove {
            0% {
              transform: translate(-40px, -50%);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              transform: translate(260px, -50%);
              opacity: 0;
            }
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
        <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white shadow-xl shadow-emerald-100 border border-emerald-50 overflow-hidden">
          <img
            src="/icons/icon-512x512.png"
            alt="EcoRoute Logo"
            className="h-full w-full object-cover p-4"
          />
        </div>

        <h1 className="text-4xl font-black tracking-tight text-emerald-900">
          EcoRoute
        </h1>
        <p className="mt-4 text-lg leading-7 text-emerald-700 font-medium">
          Smart Waste Management for <br />
          <span className="font-black text-emerald-600 uppercase text-sm tracking-widest">
            Efficient Collection
          </span>
        </p>

        <div className="mt-10 flex w-full flex-col gap-4">
          <Link
            href="/login"
            className="flex h-16 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-200"
          >
            Sign In
          </Link>

          <Link
            href="/register"
            className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white text-lg font-black uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
          >
            Register as a Citizen
          </Link>
        </div>

        <p className="mt-12 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/40">
          Efficiency • Sustainability • Community
        </p>
      </main>
    </div>
  );
}
