"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  Truck, 
  Wifi, 
  Play, 
  CheckCircle2, 
  Navigation,
  Database,
  RefreshCcw,
  Zap
} from "lucide-react";

const supabase = createClient();

export default function DriverCollectionNode() {
  const [bins, setBins] = useState<any[]>([]);
  const [driverData, setDriverData] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Fetch Driver Profile & Initial Bin Mock Data
  const initDeployment = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Profile joined with Driver Details
    const { data: profile } = await supabase
      .from("profiles")
      .select(`*, driver_details (*)`)
      .eq("id", user.id)
      .single();

    if (profile) {
      setDriverData(profile);
      setIsRouting(profile.driver_details?.duty_status === 'ON-DUTY');
    }

    // Fetch Bins (Mocking IoT status)
    const { data: binData } = await supabase.from("bins").select("*");
    setBins(binData || []);
  }, []);

  useEffect(() => { initDeployment(); }, [initDeployment]);

  // 2. Toggle Duty Status (The "Routing" Trigger)
  const toggleDuty = async () => {
    if (!driverData) return;
    const nextStatus = isRouting ? 'OFF-DUTY' : 'ON-DUTY';

    const { error } = await supabase
      .from("driver_details")
      .update({ duty_status: nextStatus })
      .eq("id", driverData.id);

    if (!error) {
      setIsRouting(!isRouting);
      setDriverData((prev: any) => ({
        ...prev,
        driver_details: { ...prev.driver_details, duty_status: nextStatus }
      }));
    }
  };

  // 3. Simulate Collection (Connecting Bin to Collection Table)
  const simulateCollection = async (bin: any) => {
    if (!isRouting) return alert("Please START ROUTING to log collections.");
    setIsSyncing(true);

    // This simulates the IoT trigger where bin weight is pushed to collections
    const { error } = await supabase
      .from("collections")
      .insert([{
        driver_id: driverData.id,
        bin_id: bin.id,
        device_id: bin.device_id,
        weight: Math.floor(Math.random() * 50) + 10, // Mock 10-60kg
        type: "General",
        barangay: bin.name.split(' - ')[0] || "Zone A"
      }]);

    if (!error) {
      // Mock update to bin level after collection
      setBins(prev => prev.map(b => b.id === bin.id ? { ...b, fill_level: 0 } : b));
    }
    setIsSyncing(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      
      {/* HEADER: OPERATIONAL CONTEXT */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-100 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <Zap size={14} fill="currentColor" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Node: {driverData?.driver_details?.vehicle_plate_number || 'TRUCK_PENDING'}</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
            Collection <span className="text-emerald-500">Log</span>
          </h1>
        </div>

        <button 
          onClick={toggleDuty}
          className={`px-10 py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] transition-all flex items-center gap-4 shadow-2xl ${
            isRouting ? "bg-slate-950 text-white shadow-emerald-200" : "bg-emerald-600 text-white shadow-emerald-100"
          }`}
        >
          {isRouting ? <><Navigation size={16} className="animate-pulse" /> Stop Routing</> : <><Play size={16} /> Start Collection Route</>}
        </button>
      </div>

      {/* BIN GRID: SIMULATING IOT NODES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {bins.map((bin) => (
          <div 
            key={bin.id}
            onClick={() => simulateCollection(bin)}
            className={`group relative bg-white border border-slate-100 rounded-[3.5rem] p-10 transition-all duration-500 cursor-pointer overflow-hidden ${
              isRouting ? "hover:border-emerald-500 hover:shadow-2xl hover:-translate-y-2" : "opacity-50 grayscale cursor-not-allowed"
            }`}
          >
            {/* Liquid Fill Visual */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-emerald-500/5 transition-all duration-1000 ease-in-out" 
              style={{ height: `${bin.fill_level}%` }}
            />

            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-colors ${bin.fill_level > 80 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-emerald-600'}`}>
                  <Wifi size={24} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{bin.device_id}</p>
                  <p className="text-xs font-black text-slate-900">{bin.fill_level}% FULL</p>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-950 uppercase italic tracking-tighter">{bin.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">IoT Node Connected</p>
              </div>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={12} className="text-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Feed</span>
                </div>
                {bin.fill_level === 0 && <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isSyncing && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full flex items-center gap-4 shadow-2xl animate-bounce">
          <RefreshCcw size={16} className="animate-spin text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest">Pushing Collection Data to Registry...</span>
        </div>
      )}
    </div>
  );
}