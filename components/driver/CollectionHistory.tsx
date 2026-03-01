"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Wifi,
  CheckCircle2,
  Navigation,
  Play,
  RefreshCcw,
  Square,
  AlertCircle,
} from "lucide-react";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

const supabase = createClient();

interface DriverDetails {
  id: string;
  duty_status: string;
  [key: string]: any;
}

export default function CollectionHistory() {
  const [bins, setBins] = useState<any[]>([]);
  const [driverProfile, setProfile] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadOperationalData = useCallback(async () => {
    setIsLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select(`*, driver_details (*)`)
      .eq("id", user.id)
      .single();

    if (profile) {
      setProfile(profile);
      const currentStatus = profile.driver_details?.duty_status === "ON-DUTY";
      setIsRouting(currentStatus);
    }

    const { data: binData } = await supabase
      .from("bins")
      .select("*")
      .order("fill_level", { ascending: false });

    setBins(binData || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadOperationalData();

    const channel = supabase
      .channel("operational-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bins" },
        () => loadOperationalData(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "driver_details",
        },
        (payload: RealtimePostgresUpdatePayload<DriverDetails>) => {
          const newData = payload.new;
          if (newData.id === driverProfile?.id) {
            setIsRouting(newData.duty_status === "ON-DUTY");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOperationalData, driverProfile?.id]);

  const toggleRoute = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const nextStatus = isRouting ? "OFF-DUTY" : "ON-DUTY";
    setIsSyncing(true);

    // Attempting the upsert again now that policy is (hopefully) active
    const { data, error } = await supabase
      .from("driver_details")
      .upsert(
        {
          id: user.id,
          duty_status: nextStatus,
        },
        { onConflict: "id" },
      )
      .select();

    if (!error && data && data.length > 0) {
      setIsRouting(nextStatus === "ON-DUTY");
      setProfile((prev: any) => ({
        ...prev,
        driver_details: { ...prev?.driver_details, duty_status: nextStatus },
      }));
    } else if (error) {
      console.error("Database Update Failed:", error.message);
      // If it's still 42501 after running the SQL, the policy name might conflict
      // or the table might have a different owner.
      alert(`Sync Error: ${error.message}`);
    }

    setIsSyncing(false);
  };

  const handleCollect = async (bin: any) => {
    if (!isRouting || bin.fill_level === 0) return;

    setIsSyncing(true);
    const { error: collectError } = await supabase.from("collections").insert([
      {
        driver_id: driverProfile.id,
        bin_id: bin.id,
        device_id: bin.device_id,
        weight: bin.fill_level * 0.45,
        type: "General",
        barangay: bin.name.split(" ")[1] || "Default Area",
      },
    ]);

    if (!collectError) {
      await supabase.from("bins").update({ fill_level: 0 }).eq("id", bin.id);
      await loadOperationalData();
    }
    setIsSyncing(false);
  };

  const completedCount = bins.filter((b) => b.fill_level === 0).length;
  const progressPercentage =
    bins.length > 0 ? (completedCount / bins.length) * 100 : 0;

  if (isLoading)
    return (
      <div className="max-w-4xl mx-auto p-10 space-y-4">
        <div className="h-64 w-full bg-slate-100 rounded-[3rem] animate-pulse" />
        <div className="h-20 w-full bg-slate-50 rounded-[2rem] animate-pulse" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      {/* Header Card */}
      <div
        className={`rounded-[3.5rem] p-10 text-white shadow-2xl transition-all duration-1000 relative overflow-hidden ${
          isRouting ? "bg-emerald-600" : "bg-slate-950"
        }`}
      >
        <div
          className={`absolute right-[-20px] top-[-20px] text-[10rem] opacity-10 rotate-12 transition-transform duration-1000 ${isRouting ? "scale-110" : "scale-90"}`}
        >
          🚛
        </div>
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">
                {isRouting
                  ? "Real-Time Tracking Active"
                  : "Fleet Status: Standby"}
              </p>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                {isRouting ? "Active Route" : "Start Shift"}
              </h2>
            </div>
            <button
              onClick={toggleRoute}
              disabled={isSyncing}
              className={`group px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center gap-4 shadow-xl active:scale-95 ${
                isRouting
                  ? "bg-white text-emerald-600 hover:bg-emerald-50"
                  : "bg-emerald-500 text-white hover:bg-emerald-400"
              }`}
            >
              {isSyncing ? (
                <RefreshCcw size={16} className="animate-spin" />
              ) : isRouting ? (
                <>
                  <Square size={16} fill="currentColor" /> Stop Route
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> Start Route
                </>
              )}
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Route Progress
              </p>
              <p className="text-2xl font-black">
                {Math.round(progressPercentage)}%
              </p>
            </div>
            <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-white transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bin List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-6">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Route Checklist
          </h4>
          {!isRouting && (
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">
                Route Inactive
              </span>
            </div>
          )}
        </div>
        {bins.map((bin) => {
          const isCollected = bin.fill_level === 0;
          return (
            <div
              key={bin.id}
              onClick={() => handleCollect(bin)}
              className={`group p-8 rounded-[3rem] border transition-all duration-500 flex items-center justify-between ${!isRouting ? "opacity-40 pointer-events-none" : "cursor-pointer"} ${isCollected ? "bg-slate-50 border-slate-100" : "bg-white border-slate-100 shadow-sm hover:border-emerald-400 hover:shadow-xl hover:-translate-y-1"}`}
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-16 h-16 rounded-[1.5rem] flex flex-col items-center justify-center transition-all duration-700 ${isCollected ? "bg-emerald-500 text-white rotate-[360deg]" : "bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"}`}
                >
                  {isCollected ? (
                    <CheckCircle2 size={28} />
                  ) : (
                    <Wifi size={24} />
                  )}
                </div>
                <div>
                  <h5
                    className={`text-xl font-black tracking-tight ${isCollected ? "text-slate-400 line-through" : "text-slate-900"}`}
                  >
                    {bin.name}
                  </h5>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`w-2 h-2 rounded-full ${isCollected ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`}
                    />
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                      IoT Node: {bin.device_id} •{" "}
                      {isCollected
                        ? "Log Synchronized"
                        : `${bin.fill_level}% Capacity`}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className={`p-4 rounded-2xl bg-slate-50 text-slate-300 transition-all ${!isCollected && "group-hover:bg-emerald-500 group-hover:text-white"}`}
              >
                <Navigation size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {isSyncing && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 animate-in slide-in-from-bottom-10">
          <RefreshCcw size={16} className="animate-spin text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            Updating EcoRoute Ledger...
          </span>
        </div>
      )}
    </div>
  );
}
