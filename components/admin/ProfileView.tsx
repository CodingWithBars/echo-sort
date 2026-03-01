"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  User,
  Mail,
  Lock,
  MapPin,
  Home,
  ShieldCheck,
  Camera,
  Phone,
  ArrowLeft,
  Sparkles,
  Fingerprint,
} from "lucide-react";

interface ProfileViewProps {
  initialData?: any;
  onClearContext?: () => void;
}

const supabase = createClient();

export default function ProfileView({
  initialData,
  onClearContext,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(!!initialData);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        const { data: adminCheck } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authUser.id)
          .single();
        setCurrentUserRole(adminCheck?.role);
      }

      const targetId = initialData?.id || authUser?.id;
      if (targetId) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", targetId)
          .single();

        if (data) {
          setProfile(data);
          setEditForm({
            ...data,
            first_name: data.first_name || "",
            middle_name: data.middle_name || "",
            last_name: data.last_name || "",
            contact_number: data.contact_number || "",
            email: data.email || "",
            location: data.location || "",
            address: data.address || "",
            new_password: "",
          });
        }
      }
    } catch (err) {
      console.error("Registry Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [initialData?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const canEditLogistics =
    currentUserRole?.toString().trim().toUpperCase() === "ADMIN";

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file || !profile?.id) return;

      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        if (uploadError.message.includes("row-level security")) {
          throw new Error(
            "ADMIN OVERRIDE FAILED: Please update Storage RLS Policies in Supabase.",
          );
        }
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const timestampedUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: timestampedUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, avatar_url: timestampedUrl }));
    } catch (error: any) {
      console.error("Storage Error:", error);
      alert(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setIsSaving(true);
    const combinedName =
      `${editForm.first_name} ${editForm.middle_name} ${editForm.last_name}`
        .replace(/\s+/g, " ")
        .trim();

    const updatePayload: any = {
      full_name: combinedName,
      first_name: editForm.first_name,
      middle_name: editForm.middle_name,
      last_name: editForm.last_name,
      contact_number: editForm.contact_number,
      email: editForm.email,
      updated_at: new Date().toISOString(),
    };

    if (canEditLogistics) {
      updatePayload.location = editForm.location;
      updatePayload.address = editForm.address;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (editForm.new_password) {
      await supabase.auth.updateUser({ password: editForm.new_password });
    }

    if (!error) {
      setProfile({ ...profile, ...updatePayload });
      setIsEditing(false);
      if (initialData && onClearContext) onClearContext();
    }
    setIsSaving(false);
  };

  if (isLoading)
    return (
      <div className="h-96 w-full bg-white rounded-[3.5rem] animate-pulse border border-slate-100" />
    );

  const inputStyle =
    "w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-black text-black outline-none focus:ring-8 focus:bg-white ring-emerald-500/5 transition-all duration-300 placeholder:text-slate-300";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {initialData && (
        <button
          onClick={onClearContext}
          className="group flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-emerald-600 transition-all mb-2"
        >
          <div className="p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-all">
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
          </div>
          Return to Registry
        </button>
      )}

      <div className="bg-white rounded-[4rem] border border-slate-100 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] relative group/card">
        {/* TOP DECORATIVE BANNER */}
        <div className="h-52 bg-slate-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_70%_0%,_#10b981_0%,_transparent_50%)]" />
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="absolute top-8 right-12 flex flex-col items-end">
             <Fingerprint size={40} className="text-emerald-500/20" />
             <span className="text-emerald-500/10 font-black text-4xl mt-2 tracking-tighter">ECOROUTE: PROFILE</span>
          </div>
        </div>

        <div className="pt-20 p-8 md:p-16 relative">
          {/* AVATAR SYSTEM */}
          <div className="absolute -top-24 left-12 md:left-16">
            <div className="w-30 h-30 rounded-[2.5rem] bg-white p-3 shadow-2xl relative group/avatar transition-transform duration-500 hover:scale-105">
              <div className="w-full h-full rounded-[2.5rem] bg-emerald-600 flex items-center justify-center text-6xl text-white font-black italic overflow-hidden border-slate-50">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110"
                  />
                ) : (
                  <span className="drop-shadow-lg">{profile?.full_name?.charAt(0)}</span>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                className="hidden"
                accept="image/*"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`absolute inset-3 rounded-[2.8rem] bg-emerald-900/80 backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center text-white gap-2 ${
                  isUploading
                    ? "opacity-100"
                    : "opacity-0 group-hover/avatar:opacity-100"
                }`}
              >
                {isUploading ? (
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Camera size={28} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Update</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* HEADER INFO */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-16">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="h-[2px] w-8 bg-emerald-500" />
                 <span className="text-emerald-600 font-black text-[11px] tracking-[0.3em] uppercase">
                  {profile?.role} {initialData ? "REGISTRY FILE" : "NODE"}
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-slate-950 tracking-tighter uppercase italic leading-[0.9]">
                {profile?.full_name}
              </h2>
              <div className="flex items-center gap-4 text-slate-400 mt-4">
                 <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    <Sparkles size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Verified System User</span>
                 </div>
              </div>
            </div>
            
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="group px-10 py-5 bg-slate-950 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-emerald-500/20 flex items-center gap-3"
              >
                Edit Entity Record
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {["first_name", "middle_name", "last_name"].map((key) => (
                  <div key={key} className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-500" />
                      {key.replace("_", " ")}
                    </label>
                    <input
                      type="text"
                      placeholder={key.toUpperCase()}
                      value={editForm[key] || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, [key]: e.target.value })
                      }
                      className={inputStyle}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-emerald-50/30 rounded-[3rem] border border-emerald-100/50">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-700/50 uppercase tracking-widest ml-2">
                    Digital Mail
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className={inputStyle.replace("bg-slate-50", "bg-white shadow-sm")}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-700/50 uppercase tracking-widest ml-2">
                    Direct Line
                  </label>
                  <input
                    type="text"
                    value={editForm.contact_number || ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        contact_number: e.target.value,
                      })
                    }
                    className={inputStyle.replace("bg-slate-50", "bg-white shadow-sm")}
                  />
                </div>
              </div>

              <div className="relative">
                {!canEditLogistics && (
                  <div className="absolute -inset-4 bg-white/40 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-[3.5rem] border-2 border-dashed border-slate-200">
                    <div className="bg-slate-950 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-4 shadow-2xl scale-110">
                      <Lock size={16} className="text-emerald-500" /> Admin Restricted Area
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      Operational Route
                    </label>
                    <input
                      type="text"
                      value={editForm.location || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, location: e.target.value })
                      }
                      className={inputStyle}
                      disabled={!canEditLogistics}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      Point of Interest Address
                    </label>
                    <input
                      type="text"
                      value={editForm.address || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, address: e.target.value })
                      }
                      className={inputStyle}
                      disabled={!canEditLogistics}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 pt-10">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-[2] py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all hover:bg-emerald-500 hover:-translate-y-1"
                >
                  {isSaving ? "PUSHING UPDATES..." : "SYNC TO NETWORK"}
                </button>
                <button
                  onClick={onClearContext}
                  className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] hover:text-slate-900 hover:bg-slate-200 transition-all active:scale-[0.98]"
                >
                  Abort Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 pt-16 border-t border-slate-100/60">
              <StatCard label="Assigned Area" value={profile?.location || "UNDETERMINED"} />
              <StatCard label="Base Address" value={profile?.address || "NOT FILED"} />
              <StatCard
                label="System Violations"
                value={profile?.warning_count || "0"}
                color="text-red-500"
                icon={<ShieldCheck size={14} />}
              />
              <StatCard
                label="Network Integrity"
                value="SECURE"
                color="text-emerald-600"
                icon={<Sparkles size={14} />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-black",
  icon
}: {
  label: string;
  value: any;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 hover:border-emerald-200 hover:bg-white hover:shadow-xl transition-all duration-500 group/stat">
      <div className="flex items-center gap-2 mb-4">
        {icon && <div className="text-emerald-500 transition-transform group-hover/stat:rotate-12">{icon}</div>}
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
          {label}
        </p>
      </div>
      <p className={`text-lg font-black uppercase italic truncate tracking-tighter ${color}`}>
        {value}
      </p>
    </div>
  );
}