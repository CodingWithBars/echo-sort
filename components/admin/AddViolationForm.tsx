"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

interface AddViolationProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function AddViolationForm({ onSuccess, onClose }: AddViolationProps) {
  const [residents, setResidents] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState("Not Selected");
  
  const [formData, setFormData] = useState({
    citizen_id: "",
    barangay: "",
    type: "Improper Segregation",
    description: "",
  });

  useEffect(() => {
    const fetchResidents = async () => {
      // Logic: Ensure we fetch the nested barangay field correctly
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name, 
          citizen_details (barangay)
        `)
        .eq("role", "CITIZEN")
        .eq("is_archived", false);
      
      if (error) console.error("Fetch error:", error);
      if (data) setResidents(data);
    };
    fetchResidents();
  }, []);

  // --- THE FIX: SMART DATA EXTRACTOR ---
  const handleResidentChange = (id: string) => {
    const resident = residents.find(r => r.id === id);
    
    // Handle both array and single object response from Supabase
    let brgy = "Unassigned";
    const details = resident?.citizen_details;
    
    if (Array.isArray(details) && details.length > 0) {
      brgy = details[0].barangay;
    } else if (details && typeof details === 'object' && !Array.isArray(details)) {
      brgy = (details as any).barangay;
    }
    
    setFormData(prev => ({ ...prev, citizen_id: id, barangay: brgy }));
    setSelectedBarangay(brgy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.citizen_id || formData.citizen_id === "") {
        return alert("Please select a resident");
    }
    
    setIsSubmitting(true);

    const { error } = await supabase.from("violations").insert([formData]);

    if (error) {
      alert(error.message);
    } else {
      onSuccess();
      onClose();
    }
    setIsSubmitting(false);
  };

  const inputStyles = "w-full p-4 bg-slate-50 border-2 border-transparent rounded-[1.2rem] text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500/30 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all duration-200";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20"
      >
        {/* --- HEADER --- */}
        <div className="bg-emerald-600 p-10 text-white relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-white/20 p-2 rounded-xl backdrop-blur-md">⚠️</span>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase">Log Incident</h2>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-100 opacity-70">EcoRoute Enforcement Registry</p>
          </div>
        </div>

        <div className="p-10 space-y-6">
          {/* Resident Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Resident Involved</label>
            <div className="relative">
                <select
                required
                className={`${inputStyles} appearance-none cursor-pointer pr-10`}
                onChange={(e) => handleResidentChange(e.target.value)}
                defaultValue=""
                >
                <option value="" disabled className="text-slate-400">Select Profile...</option>
                {residents.map(r => (
                    <option key={r.id} value={r.id} className="text-slate-900 font-bold">
                        👤 {r.full_name}
                    </option>
                ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs font-black">↓</div>
            </div>
          </div>

          {/* Barangay (Read-only Display) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Target Barangay</label>
            <div className={`w-full p-4 border-2 rounded-[1.2rem] flex items-center gap-3 transition-all ${
                selectedBarangay === "Unassigned" || selectedBarangay === "Not Selected" 
                ? "bg-slate-50 border-slate-100" 
                : "bg-emerald-50/50 border-emerald-100"
            }`}>
                <span className={selectedBarangay === "Unassigned" ? "grayscale" : ""}>📍</span>
                <span className={`text-sm font-black ${
                    selectedBarangay === "Unassigned" || selectedBarangay === "Not Selected" 
                    ? "text-slate-400" 
                    : "text-emerald-900"
                }`}>
                    {selectedBarangay !== "Not Selected" ? `Brgy. ${selectedBarangay}` : "Awaiting Resident Selection"}
                </span>
            </div>
          </div>

          {/* Violation Type */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Violation Category</label>
            <div className="relative">
                <select
                className={`${inputStyles} appearance-none cursor-pointer pr-10`}
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                    <option value="Improper Segregation">♻️ Improper Segregation</option>
                    <option value="Late Collection">⏰ Late Collection</option>
                    <option value="Illegal Dumping">🚫 Illegal Dumping</option>
                    <option value="Unauthorized Burning">🔥 Unauthorized Burning</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs font-black">↓</div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Incident Details</label>
            <textarea
              required
              maxLength={200}
              rows={3}
              placeholder="Describe what happened..."
              className={`${inputStyles} resize-none leading-relaxed text-slate-900`}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              type="submit"
              className="flex-[2] py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? "Logging..." : "Confirm Report"}
            </button>
          </div>
        </div>

        {/* Decorative Brand Accent */}
        <div className="h-2 w-full bg-slate-50 flex">
            <div className="h-full bg-emerald-500 w-1/3" />
            <div className="h-full bg-emerald-400 w-1/3" />
            <div className="h-full bg-emerald-300 w-1/3" />
        </div>
      </form>
    </div>
  );
}