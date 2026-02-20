"use client";

import { useState, useEffect } from "react";

interface ProfileViewProps {
  initialData?: any;
  onClearContext?: () => void;
}

export default function ProfileView({ initialData, onClearContext }: ProfileViewProps) {
  // If initialData exists (from Citizen Registry), default to editing mode
  const [isEditing, setIsEditing] = useState(!!initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  // Initialize state with either passed citizen data or admin defaults
  const [adminData, setAdminData] = useState({
    name: initialData?.name || "System Administrator",
    email: initialData?.email || "admin@ecoroute.gov",
    phone: initialData?.phone || "+63 917 123 4567",
    role: initialData?.role || "Super Admin",
    joined: initialData?.joined || "Jan 2026",
    notifications: true,
    twoFactor: false,
  });

  const [editForm, setEditForm] = useState({ ...adminData });

  // Sync state if initialData changes (e.g., clicking a different citizen)
  useEffect(() => {
    if (initialData) {
      const newData = {
        ...adminData,
        name: initialData.name,
        email: initialData.email,
        role: initialData.role || "Citizen",
        joined: initialData.joined
      };
      setAdminData(newData);
      setEditForm(newData);
      setIsEditing(true);
    }
  }, [initialData]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setAdminData({ ...editForm });
      setIsSaving(false);
      setIsEditing(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 1200);
  };

  const logs = [
    { action: "Updated Profile Details", time: "Just now", icon: "📝" },
    { action: "Updated Driver Schedule", time: "2 hours ago", icon: "🚚" },
    { action: "Approved Violation Report #882", time: "5 hours ago", icon: "⚠️" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-700 relative">
      
      {/* --- CONTEXT SWITCHER (Only shows when editing a Citizen) --- */}
      {initialData && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-amber-50 border border-amber-100 p-4 px-6 rounded-[2rem] animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-3 sm:mb-0">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none">Administrative Override</p>
              <p className="text-xs font-bold text-slate-700 mt-1">
                Currently modifying: <span className="text-slate-900 font-black">{initialData.name}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClearContext}
            className="px-5 py-2 bg-white text-slate-900 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all active:scale-95"
          >
            Back to my Profile
          </button>
        </div>
      )}

      {/* --- SUCCESS TOAST --- */}
      {showToast && (
        <div className="fixed top-10 right-4 md:right-10 z-[70] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-8">
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px]">✓</div>
          <span className="text-[10px] font-black uppercase tracking-widest">Changes Saved</span>
        </div>
      )}

      {/* --- MAIN PROFILE CARD --- */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="h-32 bg-slate-900 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />
          <div className="absolute -bottom-10 left-8 md:left-12">
            <div className="w-24 h-24 rounded-3xl bg-white p-1.5 shadow-xl">
              <div className="w-full h-full rounded-2xl bg-slate-50 flex items-center justify-center text-4xl border border-slate-100 relative group overflow-hidden">
                👤
                <button className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white text-[8px] font-black uppercase tracking-tighter">
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-14 p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{adminData.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${initialData ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <p className="text-slate-400 font-black uppercase text-[9px] tracking-[0.15em]">{adminData.role}</p>
              </div>
            </div>
            {!isEditing && (
              <button 
                onClick={() => {
                  setEditForm({ ...adminData });
                  setIsEditing(true);
                }}
                className="px-6 py-3.5 bg-slate-50 text-slate-900 border border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all active:scale-95"
              >
                Account Settings
              </button>
            )}
          </div>

          {isEditing ? (
            /* --- EDIT FORM --- */
            <div className="mt-10 space-y-8 animate-in slide-in-from-top-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: "Full Name", key: "name", type: "text" },
                  { label: "Email Address", key: "email", type: "email" },
                  { label: "Phone Number", key: "phone", type: "text" },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{field.label}</label>
                    <input 
                      type={field.type} 
                      value={(editForm as any)[field.key]}
                      onChange={(e) => setEditForm({...editForm, [field.key]: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
                  <select 
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none cursor-pointer appearance-none"
                  >
                    <option>Super Admin</option>
                    <option>Dispatcher</option>
                    <option>Citizen</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 disabled:opacity-50"
                >
                  {isSaving ? "Synchronizing..." : initialData ? "Update Citizen Record" : "Save Changes"}
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-8 py-4 bg-white text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 pt-10 border-t border-slate-100">
              {[
                { label: "Email", value: adminData.email, icon: "✉️" },
                { label: "Hotline", value: adminData.phone, icon: "📞" },
                { label: "Joined", value: adminData.joined, icon: "🗓️" },
              ].map((item) => (
                <div key={item.label} className="p-5 bg-slate-50 rounded-2xl border border-slate-50">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{item.label}</p>
                  <p className="text-[11px] font-black text-slate-700 truncate">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- LOGS (Only show for Admin or context-appropriate logs) --- */}
      {!initialData && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Security & Audit</h3>
           <div className="space-y-3">
             {logs.map((log, i) => (
               <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                 <div className="flex items-center gap-4">
                   <span className="text-sm">{log.icon}</span>
                   <div>
                     <p className="text-[11px] font-black text-slate-700">{log.action}</p>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{log.time}</p>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}