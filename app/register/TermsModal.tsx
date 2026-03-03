"use client";

import { ShieldCheck, X, FileText, CheckCircle2 } from "lucide-react";

interface TermsModalProps {
  barangay: string;
  onAccept: () => void;
  onClose: () => void;
}

export default function TermsModal({ barangay, onAccept, onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Legal Agreement</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Privacy & Terms</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {/* Barangay Badge */}
          <div className="mb-6 flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl w-fit">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">
              Coverage: Barangay {barangay || "General"}
            </span>
          </div>

          {/* Scrollable Content */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-8">
            <div className="p-6 max-h-64 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-emerald-600" />
                  <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Terms of Use</h3>
                </div>
                <div className="text-[12px] text-slate-600 leading-relaxed space-y-3 font-medium">
                  <p>
                    <strong>Accuracy:</strong> You agree to provide true and accurate information regarding your residence within <span className="text-emerald-600 font-bold">Barangay {barangay}</span>.
                  </p>
                  <p>
                    <strong>Service:</strong> EcoRoute is a tool for waste collection optimization. Collection schedules are subject to local government changes and truck availability.
                  </p>
                  <p>
                    <strong>Conduct:</strong> Users must not report false waste collection issues or interfere with the automated routing system.
                  </p>
                </div>
              </section>

              <hr className="border-slate-200" />

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Privacy Policy</h3>
                </div>
                <div className="text-[12px] text-slate-600 leading-relaxed space-y-3 font-medium">
                  <p>
                    <strong>Data Collection:</strong> We collect your name, contact number, and exact address to map efficient garbage collection routes.
                  </p>
                  <p>
                    <strong>Data Sharing:</strong> Your location and service type are shared only with authorized Barangay waste management personnel.
                  </p>
                  <p>
                    <strong>Security:</strong> Your password is encrypted. We do not sell your personal data to third-party advertisers.
                  </p>
                </div>
              </section>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onAccept}
              className="w-full py-3.5 bg-emerald-600 text-white font-bold text-sm uppercase tracking-[0.15em] rounded-xl shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-[0.98] transition-all"
            >
              Accept & Create Account
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}