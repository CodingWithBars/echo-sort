"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

interface ProfileViewProps {
  initialData?: any;
  onClearContext?: () => void;
}

const supabase = createClient();

export default function ProfileView({ initialData, onClearContext }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(!!initialData);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  // --- IMAGE UPLOAD LOGIC ---
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}/avatar.${fileExt}`;

      // 1. Upload to Supabase Storage Bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update Profile Table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Upload failed. Check if "avatars" bucket is public.');
    } finally {
      setIsUploading(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    const targetId = initialData?.id;
    
    let queryId = targetId;
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser();
      queryId = user?.id;
    }

    if (queryId) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", queryId)
        .single();
      
      if (data) {
        setProfile(data);
        setEditForm(data);
      }
    }
    setIsLoading(false);
  }, [initialData]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
      })
      .eq("id", profile.id);

    if (!error) {
      setProfile(editForm);
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  if (isLoading) return <div className="h-96 w-full bg-white rounded-[2.5rem] animate-pulse" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* (Context Switcher remains here...) */}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="h-32 bg-slate-900 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />
        </div>
        
        <div className="pt-14 p-8 md:p-12 relative">
          {/* PROFILE IMAGE SECTION */}
          <div className="absolute -top-12 left-12">
            <div className="w-24 h-24 rounded-3xl bg-white p-1.5 shadow-xl group relative">
              <div className="w-full h-full rounded-2xl bg-emerald-600 flex items-center justify-center text-4xl text-white font-black italic overflow-hidden border border-slate-100">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0)
                )}
              </div>
              
              {/* HIDDEN FILE INPUT */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                accept="image/*" 
                className="hidden" 
              />

              {/* UPLOAD OVERLAY */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-1.5 rounded-2xl bg-slate-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <span className="text-[8px] font-black text-white uppercase tracking-tighter">
                  {isUploading ? "Uploading..." : "Change Photo"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{profile?.full_name}</h2>
              <p className="text-emerald-600 font-black uppercase text-[10px] tracking-[0.2em]">{profile?.role}</p>
            </div>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="px-6 py-4 bg-slate-50 text-slate-900 border border-slate-100 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
                Edit Record
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="mt-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Full Legal Name</label>
                  <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({...editForm, full_name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-4 ring-emerald-500/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Email Address</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50 transition-all">
                  {isSaving ? "Syncing..." : "Push Updates to Database"}
                </button>
                <button onClick={() => setIsEditing(false)} className="px-8 py-5 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-slate-900 transition-all">
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 pt-10 border-t border-slate-100">
               <div className="p-6 bg-slate-50 rounded-[1.5rem]">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Contact Point</p>
                  <p className="text-[11px] font-black text-slate-700">{profile?.email}</p>
               </div>
               <div className="p-6 bg-slate-50 rounded-[1.5rem]">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Registry Date</p>
                  <p className="text-[11px] font-black text-slate-700">{new Date(profile?.created_at).toLocaleDateString()}</p>
               </div>
               <div className="p-6 bg-slate-50 rounded-[1.5rem]">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Account Status</p>
                  <p className="text-[11px] font-black text-emerald-600 uppercase">Verified</p>
               </div>
            </div>
          )}
        </div>
      </div>
      {/* (Audit logs continue below...) */}
    </div>
  );
}