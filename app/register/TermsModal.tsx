"use client";

interface TermsModalProps {
  barangay: string;
  onAccept: () => void;
  onClose: () => void;
}

export default function TermsModal({ barangay, onAccept, onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04kM12 21.75c-3.21 0-6.14-1.32-8.25-3.46l16.5 0c-2.11 2.14-5.04 3.46-8.25 3.46z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Legal Agreement</h2>
          </div>

          <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden mb-8">
            <div className="p-6 max-h-72 overflow-y-auto space-y-6 custom-scrollbar">
              <section>
                <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Terms of Use</h3>
                <div className="text-[11px] text-slate-600 leading-relaxed space-y-2 font-medium">
                  <p>• <strong>Accuracy:</strong> You agree to provide true and accurate information regarding your residence within <strong>Barangay {barangay}</strong>.</p>
                  <p>• <strong>Service:</strong> EcoRoute is a tool for waste collection optimization. Collection schedules are subject to local government changes and truck availability.</p>
                  <p>• <strong>Conduct:</strong> Users must not report false waste collection issues or interfere with the automated routing system.</p>
                </div>
              </section>

              <hr className="border-slate-200/50" />

              <section>
                <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Privacy Policy</h3>
                <div className="text-[11px] text-slate-600 leading-relaxed space-y-2 font-medium">
                  <p>• <strong>Data Collection:</strong> We collect your name, contact number, and exact address to map efficient garbage collection routes.</p>
                  <p>• <strong>Data Sharing:</strong> Your location and service type are shared only with authorized Barangay waste management personnel.</p>
                  <p>• <strong>Security:</strong> Your password is encrypted. We do not sell your personal data to third-party advertisers.</p>
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onAccept}
              className="w-full py-4 bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Accept & Create Account
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}