"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  User,
  ShieldCheck,
  Camera,
  Phone,
  Sparkles,
  Lock,
  MapPin,
  Eye,
  EyeOff,
  Leaf,
  Home,
  Trash2,
  CheckCircle2,
} from "lucide-react";

const supabase = createClient();

export default function CitizenProfileView() {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchCitizenData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select(`*, citizen_details (*)`)
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setEditForm({
          first_name: data.first_name || "",
          middle_name: data.middle_name || "",
          last_name: data.last_name || "",
          contact_number: data.contact_number || "",
          barangay: data.citizen_details?.barangay || "",
          purok: data.citizen_details?.purok || "",
          address_street: data.citizen_details?.address_street || "",
          house_lot_number: data.citizen_details?.house_lot_number || "",
          new_password: "",
          confirm_password: "",
        });
      }
    } catch (err) {
      console.error("Citizen Profile Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCitizenData();
  }, [fetchCitizenData]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file || !profile?.id) return;

      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const combinedName = `${editForm.first_name} ${editForm.middle_name} ${editForm.last_name}`.replace(/\s+/g, " ").trim();

      // 1. Update Core Profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: editForm.first_name,
          middle_name: editForm.middle_name,
          last_name: editForm.last_name,
          full_name: combinedName,
          contact_number: editForm.contact_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      // 2. Update Citizen Details
      const { error: detailsError } = await supabase
        .from("citizen_details")
        .update({
          barangay: editForm.barangay,
          purok: editForm.purok,
          address_street: editForm.address_street,
          house_lot_number: editForm.house_lot_number,
        })
        .eq("id", profile.id);

      // 3. Password Update
      if (editForm.new_password && editForm.new_password === editForm.confirm_password) {
        await supabase.auth.updateUser({ password: editForm.new_password });
      }

      if (!profileError && !detailsError) {
        await fetchCitizenData();
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="h-96 w-full bg-white rounded-[4rem] animate-pulse border border-slate-100" />;

  const inputStyle = "w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-black text-black outline-none focus:ring-8 focus:bg-white ring-emerald-500/5 transition-all duration-300 placeholder:text-slate-300";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-white rounded-[4.5rem] border border-slate-100 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] relative">
        
        {/* TOP BANNER */}
        <div className="h-52 bg-emerald-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_70%_0%,_#10b981_0%,_transparent_50%)]" />
          <div className="absolute top-8 right-12 flex flex-col items-end">
             <Leaf size={40} className="text-emerald-500/20" />
             <span className="text-emerald-500/10 font-black text-4xl mt-2 tracking-tighter uppercase italic">ECOROUTE: CITIZEN</span>
          </div>
        </div>

        <div className="pt-20 p-8 md:p-16 relative">
          {/* AVATAR */}
          <div className="absolute -top-24 left-12 md:left-16">
            <div className="w-36 h-36 rounded-[3rem] bg-white p-3 shadow-2xl relative group/avatar transition-transform duration-500 hover:scale-105">
              <div className="w-full h-full rounded-[2.5rem] bg-emerald-600 flex items-center justify-center text-6xl text-white font-black italic overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110" />
                ) : (
                  <span className="drop-shadow-lg">{profile?.full_name?.charAt(0)}</span>
                )}
              </div>

              <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`absolute inset-3 rounded-[2.8rem] bg-emerald-900/80 backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center text-white gap-2 ${isUploading ? "opacity-100" : "opacity-0 group-hover/avatar:opacity-100"}`}
              >
                {isUploading ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><Camera size={28} /><span className="text-[9px] font-black uppercase tracking-widest">Update</span></>}
              </button>
            </div>
          </div>

          {/* HEADER INFO */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-16">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="h-[2px] w-8 bg-emerald-500" />
                 <span className="text-emerald-600 font-black text-[11px] tracking-[0.3em] uppercase">Verified Eco-Citizen</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-slate-950 tracking-tighter uppercase italic leading-[0.9]">
                {profile?.full_name}
              </h2>
              <div className="flex items-center gap-4 text-slate-400 mt-4">
                 <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    <Sparkles size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tight">Eco-Points: {profile?.eco_points || 0}</span>
                 </div>
              </div>
            </div>
            
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="group px-10 py-5 bg-slate-950 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-emerald-500/20"
              >
                Edit Profile Details
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
              {/* NAME FIELDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {["first_name", "middle_name", "last_name"].map((key) => (
                  <div key={key} className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-500" /> {key.replace("_", " ")}
                    </label>
                    <input className={inputStyle} value={editForm[key] || ""} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
                  </div>
                ))}
              </div>

              {/* ADDRESS & LOCATION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 space-y-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Residency Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Barangay</label>
                        <input className={inputStyle.replace("bg-slate-50", "bg-white")} value={editForm.barangay} onChange={e => setEditForm({...editForm, barangay: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Purok</label>
                        <input className={inputStyle.replace("bg-slate-50", "bg-white")} value={editForm.purok} onChange={e => setEditForm({...editForm, purok: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Street Address / House #</label>
                        <input className={inputStyle.replace("bg-slate-50", "bg-white")} value={editForm.address_street} onChange={e => setEditForm({...editForm, address_street: e.target.value})} />
                  </div>
                </div>

                {/* SECURITY */}
                <div className="p-10 bg-slate-900 rounded-[3rem] text-white space-y-6">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Lock size={14} /> Security Update</p>
                  <div className="space-y-4">
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="w-full px-7 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-sm outline-none focus:border-emerald-500 transition-all" 
                        placeholder="New Password" 
                        value={editForm.new_password}
                        onChange={e => setEditForm({...editForm, new_password: e.target.value})}
                      />
                      <button onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/40">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="w-full px-7 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-sm outline-none focus:border-emerald-500 transition-all" 
                      placeholder="Confirm Password" 
                      value={editForm.confirm_password}
                      onChange={e => setEditForm({...editForm, confirm_password: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex flex-col md:flex-row gap-6 pt-10 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-[2] py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all hover:bg-emerald-500"
                >
                  {isSaving ? "Updating Community Record..." : "Save My Profile"}
                </button>
                <button
                  onClick={() => { setIsEditing(false); fetchCitizenData(); }}
                  className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] hover:text-slate-900 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* VIEW MODE: CITIZEN STATS */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 pt-16 border-t border-slate-100/60">
              <StatCard label="My Location" value={`${profile?.citizen_details?.purok}, ${profile?.citizen_details?.barangay}`} icon={<MapPin size={14} />} />
              <StatCard label="Service Level" value={profile?.citizen_details?.service_type || "General"} icon={<Home size={14} />} />
              <StatCard label="Sustainability Score" value={`${profile?.eco_points || 0} Pts`} color="text-emerald-600" icon={<Leaf size={14} />} />
              <StatCard label="Account Status" value={profile?.is_archived ? "Inactive" : "Verified"} icon={<CheckCircle2 size={14} />} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-black", icon }: any) {
  return (
    <div className="p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 hover:border-emerald-200 hover:bg-white hover:shadow-xl transition-all duration-500 group/stat">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-emerald-500 group-hover/stat:rotate-12 transition-transform">{icon}</div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">{label}</p>
      </div>
      <p className={`text-lg font-black uppercase italic truncate tracking-tighter ${color}`}>{value}</p>
    </div>
  );
}