"use client";
import { useState } from "react";
import { 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Truck, 
  CreditCard, 
  X,
  ShieldCheck
} from "lucide-react";

export default function AddDriverModal({
  isOpen,
  onClose,
  onAdd,
  loading,
}: any) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    truck_plate: "",
    license_number: "",
  });

  if (!isOpen) return null;

  const inputStyles = "w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all";
  const iconStyles = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                New Driver
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fleet Registration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAdd(formData);
            }}
            className="space-y-4"
          >
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <User className={iconStyles} size={18} />
                <input
                  placeholder="First Name"
                  className={inputStyles}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="relative group">
                <User className={iconStyles} size={18} />
                <input
                  placeholder="Last Name"
                  className={inputStyles}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="relative group">
              <Mail className={iconStyles} size={18} />
              <input
                type="email"
                placeholder="Email Address"
                className={inputStyles}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="relative group">
              <Lock className={iconStyles} size={18} />
              <input
                type="password"
                placeholder="Initial Password"
                className={inputStyles}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>

            {/* Vehicle Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <Truck className={iconStyles} size={18} />
                <input
                  placeholder="Plate No."
                  className={inputStyles}
                  onChange={(e) =>
                    setFormData({ ...formData, truck_plate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="relative group">
                <CreditCard className={iconStyles} size={18} />
                <input
                  placeholder="License ID"
                  className={inputStyles}
                  onChange={(e) =>
                    setFormData({ ...formData, license_number: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Create Driver Account
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel Entry
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}