"use client";
import { useState } from "react";

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
        <h3 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tighter">
          New Driver Account
        </h3>
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(formData);
          }}
          className="space-y-4"
        >
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="First Name"
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
              required
            />
            <input
              placeholder="Last Name"
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
              required
            />
          </div>

          {/* Credentials */}
          <input
            type="email"
            placeholder="Email Address"
            className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
          />
          <input
            type="password"
            placeholder="Initial Password"
            className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />

          {/* Vehicle Info */}
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Plate No."
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              onChange={(e) =>
                setFormData({ ...formData, truck_plate: e.target.value })
              }
              required
            />
            <input
              placeholder="License ID"
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              onChange={(e) =>
                setFormData({ ...formData, license_number: e.target.value })
              }
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}