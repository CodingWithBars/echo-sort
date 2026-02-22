"use client";

import React, { useState } from "react";

interface AddBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deviceId: string, binName: string) => void;
  suggestedName: string;
}

export default function AddBinModal({ isOpen, onClose, onConfirm, suggestedName }: AddBinModalProps) {
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState(suggestedName);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl">🚛</div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-tight">New Station</h3>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Provisioning Device</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Device ID (ESP32 UID)</label>
              <input 
                autoFocus
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="e.g. ESP32-BIN-01"
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none transition-all font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Display Name</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none transition-all font-bold text-slate-700"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                if(deviceId && name) onConfirm(deviceId, name);
                setDeviceId(""); // Reset
              }}
              disabled={!deviceId}
              className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 transition-all active:scale-95"
            >
              Deploy Bin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}