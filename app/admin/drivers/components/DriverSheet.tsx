"use client";

import React from 'react';
import { 
  X, 
  Truck, 
  Phone, 
  Archive, 
  RefreshCw, 
  CreditCard, 
  Activity, 
  Mail,
  UserCheck
} from "lucide-react";

interface DriverSheetProps {
  selectedDriver: any;
  setSelectedDriver: (driver: any) => void;
  onRemove: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  loading: boolean;
}

export default function DriverSheet({
  selectedDriver,
  setSelectedDriver,
  onRemove,
  onRestore,
  loading,
}: DriverSheetProps) {
  if (!selectedDriver) return null;

  const isArchived = selectedDriver.status === "REMOVED";

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={() => setSelectedDriver(null)} 
      />
      
      {/* Bottom Sheet Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-slate-200">
        {/* Status Indicator Bar */}
        <div className={`h-1.5 w-full ${isArchived ? "bg-red-500" : "bg-emerald-500"}`} />

        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner border border-slate-200">
                <UserCheck size={32} className={isArchived ? "text-slate-300" : "text-emerald-600"} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                    {selectedDriver.full_name}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                    isArchived ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                  }`}>
                    {isArchived ? "Archived" : "Active"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Mail size={12} />
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-none pt-0.5">
                    {selectedDriver.email}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedDriver(null)}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all active:scale-90"
            >
              <X size={20} />
            </button>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={14} className="text-emerald-600" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pt-0.5">Vehicle Plate</p>
              </div>
              <p className="text-sm font-bold font-mono text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1 w-fit shadow-sm">
                {selectedDriver.truck_plate}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-emerald-600" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pt-0.5">Performance</p>
              </div>
              <p className="text-sm font-black text-emerald-600">
                {selectedDriver.efficiency_score || "0"}% Efficiency
              </p>
            </div>
          </div>

          {/* License Badge */}
          <div className="p-5 bg-slate-900 rounded-2xl text-white mb-8 relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
              <CreditCard size={100} />
            </div>
            
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-[0.2em] relative z-10">
              Professional Driver License
            </p>
            <div className="flex items-center gap-3 relative z-10">
              <CreditCard size={18} className="text-emerald-500" />
              <p className="text-sm font-mono font-black tracking-[0.25em]">
                {selectedDriver.license_number}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isArchived ? (
              <>
                <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Phone size={16} />
                  Call Driver
                </button>
                <button
                  onClick={() => onRemove(selectedDriver.id)}
                  disabled={loading}
                  className="w-full py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  <Archive size={14} className="group-hover:rotate-12 transition-transform" />
                  {loading ? "Archiving Profile..." : "Archive Driver Account"}
                </button>
              </>
            ) : (
              <button
                onClick={() => onRestore(selectedDriver.id)}
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-xl hover:bg-emerald-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                {loading ? "Restoring Access..." : "Restore to Active Fleet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}