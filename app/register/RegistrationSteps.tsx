import { useState } from "react";

const getInputClass = (val: string) =>
  `w-full p-3.5 bg-slate-50 border rounded-2xl outline-none transition-all text-sm font-bold ${
    val ? "text-slate-950 border-slate-300" : "text-slate-400 border-slate-200"
  } focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`;

// --- STEP 1 ---
export function Step1({ formData, setFormData, showErrors, onNext, setShowErrors }: any) {
  const isValid = formData.firstName && formData.lastName && formData.contactNumber.length === 11;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">First Name</label>
          <input className={`${getInputClass(formData.firstName)} ${showErrors && !formData.firstName ? "border-red-400 bg-red-50/30" : ""}`} value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Last Name</label>
          <input className={`${getInputClass(formData.lastName)} ${showErrors && !formData.lastName ? "border-red-400 bg-red-50/30" : ""}`} value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ext.</label>
          <input className={getInputClass(formData.nameExt)} value={formData.nameExt} onChange={(e) => setFormData({ ...formData, nameExt: e.target.value })} />
        </div>
      </div>
      <button 
        onClick={() => { if(isValid) onNext(); else setShowErrors(true); }}
        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-slate-800 transition-all active:scale-95"
      >
        Continue
      </button>
    </div>
  );
}

// --- STEP 2 ---
export function Step2({ formData, setFormData, showErrors, onNext, onBack, setShowErrors }: any) {
  const isValid = formData.barangay && formData.purok && formData.address && formData.houseLotNumber;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <select className={getInputClass(formData.barangay)} value={formData.barangay} onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}>
        <option value="">Select Barangay...</option>
        <option value="Poblacion">Poblacion</option>
        <option value="Ilangay">Ilangay</option>
      </select>
      <input className={getInputClass(formData.address)} placeholder="Street / Sitio" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <input className={getInputClass(formData.purok)} placeholder="Purok" value={formData.purok} onChange={(e) => setFormData({ ...formData, purok: e.target.value })} />
        <input className={getInputClass(formData.houseLotNumber)} placeholder="House #" value={formData.houseLotNumber} onChange={(e) => setFormData({ ...formData, houseLotNumber: e.target.value })} />
      </div>
      <button onClick={() => { if(isValid) onNext(); else setShowErrors(true); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase">Continue</button>
      <button onClick={onBack} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase">Back</button>
    </div>
  );
}

// --- STEP 3 ---
export function Step3({ formData, setFormData, showErrors, onNext, onBack, setShowErrors }: any) {
  const [showPass, setShowPass] = useState(false);
  const isValid = formData.email.includes("@") && formData.password.length >= 6 && formData.password === formData.confirmPassword;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <input className={getInputClass(formData.email)} placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
      <input type={showPass ? "text" : "password"} className={getInputClass(formData.password)} placeholder="Password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
      <input type={showPass ? "text" : "password"} className={getInputClass(formData.confirmPassword)} placeholder="Confirm Password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
      <button onClick={() => { if(isValid) onNext(); else setShowErrors(true); }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase">Review & Register</button>
      <button onClick={onBack} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase">Back</button>
    </div>
  );
}