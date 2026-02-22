"use client";

import React from 'react';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={() => setSelectedDriver(null)} 
      />
      
      {/* Bottom Sheet Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
        {/* EcoRoute Emerald/Red Status Bar */}
        <div className={`h-2 w-full ${isArchived ? "bg-red-500" : "bg-emerald-500"}`} />

        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl shadow-inner">
                🪪
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {selectedDriver.full_name}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Operator • {selectedDriver.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDriver(null)}
              className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Vehicle Plate</p>
              <p className="text-sm font-bold font-mono text-slate-900">{selectedDriver.truck_plate}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Efficiency</p>
              <p className="text-sm font-black text-emerald-600">{selectedDriver.efficiency_score}%</p>
            </div>
          </div>

          {/* License Badge */}
          <div className="p-5 bg-slate-900 rounded-3xl text-white mb-6">
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Driver License</p>
            <p className="text-sm font-mono font-black tracking-[0.2em]">{selectedDriver.license_number}</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isArchived ? (
              <>
                <button className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-xl hover:bg-emerald-700 transition-all active:scale-95">
                  Call Driver Now
                </button>
                <button
                  onClick={() => onRemove(selectedDriver.id)}
                  disabled={loading}
                  className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-red-500 transition-all disabled:opacity-50"
                >
                  {loading ? "Archiving..." : "Archive Driver Account"}
                </button>
              </>
            ) : (
              <button
                onClick={() => onRestore(selectedDriver.id)}
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-xl hover:bg-emerald-600 transition-all active:scale-95"
              >
                {loading ? "Restoring..." : "Restore to Active Fleet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}