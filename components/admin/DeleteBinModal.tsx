"use client";

import React from "react";

interface DeleteBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  binName: string;
}

export default function DeleteBinModal({ isOpen, onClose, onConfirm, binName }: DeleteBinModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6">
            🗑️
          </div>
          
          <h3 className="text-xl font-black text-slate-900 mb-2">Decommission Station?</h3>
          <p className="text-sm text-slate-500 font-medium mb-8">
            Are you sure you want to remove <span className="text-slate-900 font-bold underline decoration-red-500">{binName}</span>? This action cannot be undone.
          </p>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onConfirm}
              className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-red-200 transition-all active:scale-95"
            >
              Confirm Delete
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Keep Station
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}