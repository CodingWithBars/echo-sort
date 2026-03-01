"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  User,
  ShieldCheck,
  Camera,
  Phone,
  Sparkles,
  Fingerprint,
  Lock,
  Truck,
  MapPin,
  KeyRound,
  Eye,
  EyeOff,
  Activity,
} from "lucide-react";

const supabase = createClient();

export default function DriverProfileView() {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchDriverData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select(`*, driver_details (*)`)
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setEditForm({
          first_name: data.first_name || "",
          middle_name: data.middle_name || "",
          last_name: data.last_name || "",
          contact_number: data.contact_number || "",
          email: data.email || "",
          new_password: "",
          confirm_password: "",
        });
      }
    } catch (err) {
      console.error("Driver Profile Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDriverData();
  }, [fetchDriverData]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file || !profile?.id) return;

      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const timestampedUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: timestampedUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, avatar_url: timestampedUrl }));
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
      const { error } = await supabase
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

      // 2. Handle Password Update if requested
      if (editForm.new_password && editForm.new_password === editForm.confirm_password) {
        await supabase.auth.updateUser({ password: editForm.new_password });
      }

      if (!error) {
        await fetchDriverData();
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="h-96 w-full bg-white rounded-[4rem] animate-pulse border border-slate-100" />;

  const inputStyle = "w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-black text-black outline-none focus:ring-8 focus:bg-white ring-emerald-500/5 transition-all duration-300 placeholder:text-slate-300";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-white rounded-[4.5rem] border border-slate-100 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] relative group/card">
        
        {/* TOP DECORATIVE BANNER */}
        <div className="h-52 bg-slate-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_70%_0%,_#10b981_0%,_transparent_50%)]" />
          <div className="absolute top-8 right-12 flex flex-col items-end">
             <Truck size={40} className="text-emerald-500/20" />
             <span className="text-emerald-500/10 font-black text-4xl mt-2 tracking-tighter uppercase italic">ECOROUTE: DRIVER</span>
          </div>
        </div>

        <div className="pt-20 p-8 md:p-16 relative">
          {/* AVATAR SYSTEM */}
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
                 <span className="text-emerald-600 font-black text-[11px] tracking-[0.3em] uppercase">Operational Personnel</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-slate-950 tracking-tighter uppercase italic leading-[0.9]">
                {profile?.full_name}
              </h2>
              <div className="flex items-center gap-4 text-slate-400 mt-4">
                 <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    <Sparkles size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Active Duty: {profile?.driver_details?.duty_status}</span>
                 </div>
              </div>
            </div>
            
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="group px-10 py-5 bg-slate-950 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-emerald-500/20"
              >
                Modify Identity Credentials
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

              {/* CONTACT & SECURITY */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-10 bg-emerald-50/30 rounded-[3rem] border border-emerald-100/50 space-y-6">
                  <p className="text-[10px] font-black text-emerald-700/50 uppercase tracking-widest">System Comms</p>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Phone Line</label>
                    <input className={inputStyle.replace("bg-slate-50", "bg-white")} value={editForm.contact_number || ""} onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })} />
                  </div>
                </div>

                <div className="p-10 bg-slate-900 rounded-[3rem] text-white space-y-6">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Lock size={14} /> Security Override</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="w-full px-7 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-sm outline-none focus:border-emerald-500 transition-all" 
                        placeholder="New System Password" 
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
                      placeholder="Confirm New Password" 
                      value={editForm.confirm_password}
                      onChange={e => setEditForm({...editForm, confirm_password: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col md:flex-row gap-6 pt-10 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={isSaving || (editForm.new_password !== editForm.confirm_password)}
                  className="flex-[2] py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all hover:bg-emerald-500"
                >
                  {isSaving ? "Authorizing..." : "Sync Credentials to Node"}
                </button>
                <button
                  onClick={() => { setIsEditing(false); fetchDriverData(); }}
                  className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] hover:text-slate-900 transition-all"
                >
                  Abort Changes
                </button>
              </div>
            </div>
          ) : (
            /* VIEW MODE: OPERATIONAL STATS */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 pt-16 border-t border-slate-100/60">
              <StatCard label="Assigned Truck" value={profile?.driver_details?.vehicle_plate_number || "NO ASSET"} icon={<Truck size={14} />} />
              <StatCard label="Route Node" value={profile?.driver_details?.assigned_route || "UNASSIGNED"} icon={<MapPin size={14} />} />
              <StatCard label="License ID" value={profile?.driver_details?.license_number || "PENDING"} icon={<ShieldCheck size={14} />} />
              <StatCard label="Status" value={profile?.driver_details?.duty_status} color="text-emerald-600" icon={<Activity size={14} />} />
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