"use client";

import { useState, useRef } from "react";

export default function ProfileView() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  // State for the Form
  const [adminData, setAdminData] = useState({
    name: "System Administrator",
    email: "admin@ecoroute.gov",
    phone: "+63 917 123 4567",
    role: "Super Admin",
    joined: "January 2026",
    notifications: true,
    twoFactor: false,
  });

  // Local state for the temporary edits
  const [editForm, setEditForm] = useState({ ...adminData });

  const handleSave = () => {
    setIsSaving(true);
    
    // Simulate API Call
    setTimeout(() => {
      setAdminData({ ...editForm });
      setIsSaving(false);
      setIsEditing(false);
      setShowToast(true);
      
      // Auto-hide toast after 3 seconds
      setTimeout(() => setShowToast(false), 3000);
    }, 1200);
  };

  const logs = [
    { action: "Updated Profile Details", time: "Just now", icon: "📝" },
    { action: "Updated Driver Schedule", time: "2 hours ago", icon: "🚚" },
    { action: "Approved Violation Report #882", time: "5 hours ago", icon: "⚠️" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* --- SUCCESS TOAST --- */}
      {showToast && (
        <div className="fixed top-24 right-10 z-[60] bg-emerald-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-8">
          <span className="bg-emerald-500 rounded-full p-1 text-[10px]">✓</span>
          <span className="text-xs font-black uppercase tracking-widest">Profile Updated Successfully</span>
        </div>
      )}

      {/* --- PROFILE HEADER CARD --- */}
      <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="h-40 bg-gradient-to-r from-emerald-600 to-teal-500 w-full relative">
          <div className="absolute -bottom-12 left-10">
            <div className="w-28 h-28 rounded-[2.5rem] bg-white p-1 shadow-2xl">
              <div className="w-full h-full rounded-[2.3rem] bg-slate-100 flex items-center justify-center text-5xl border border-slate-50 relative group">
                👤
                <button className="absolute inset-0 bg-black/40 rounded-[2.3rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-black uppercase tracking-tighter">
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-16 p-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{adminData.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest">{adminData.role}</p>
              </div>
            </div>
            {!isEditing && (
              <button 
                onClick={() => {
                  setEditForm({ ...adminData });
                  setIsEditing(true);
                }}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                Edit Account Settings
              </button>
            )}
          </div>

          {!isEditing ? (
            /* --- READ-ONLY DASHBOARD --- */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-slate-100">
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</p>
                <p className="font-bold text-slate-700 break-words">{adminData.email}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Number</p>
                <p className="font-bold text-slate-700">{adminData.phone}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Member Since</p>
                <p className="font-bold text-slate-700">{adminData.joined}</p>
              </div>
            </div>
          ) : (
            /* --- FUNCTIONAL EDIT FORM --- */
            <div className="mt-12 pt-12 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input 
                    type="text" 
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Role</label>
                  <select 
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none cursor-pointer"
                  >
                    <option>Super Admin</option>
                    <option>Dispatcher</option>
                    <option>Compliance Officer</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Email Notifications</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Weekly Collection Reports</p>
                    </div>
                    <button 
                      onClick={() => setEditForm({...editForm, notifications: !editForm.notifications})}
                      className={`w-12 h-6 rounded-full transition-colors relative ${editForm.notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.notifications ? 'right-1' : 'left-1'}`} />
                    </button>
                 </div>
                 <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-700">2FA Security</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Two-Factor Authentication</p>
                    </div>
                    <button 
                      onClick={() => setEditForm({...editForm, twoFactor: !editForm.twoFactor})}
                      className={`w-12 h-6 rounded-full transition-colors relative ${editForm.twoFactor ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.twoFactor ? 'right-1' : 'left-1'}`} />
                    </button>
                 </div>
              </div>

              <div className="flex items-center gap-4 mt-10">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- SECURITY & LOGS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Logs */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Recent Audit Logs</h3>
          <div className="space-y-4">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <span className="text-lg">{log.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{log.action}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{log.time}</p>
                  </div>
                </div>
                <button className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600">Details</button>
              </div>
            ))}
          </div>
        </div>

        {/* Password Reset Card */}
        <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200">
           <div className="absolute top-[-20px] right-[-20px] text-8xl opacity-10 rotate-12">🔑</div>
           <h3 className="text-lg font-black tracking-tight mb-2 uppercase">Security</h3>
           <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">
             Manage your login credentials. We recommend changing your password every 90 days.
           </p>
           <button 
            onClick={() => alert("Password reset link sent to " + adminData.email)}
            className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-white/10"
           >
             Reset Password
           </button>
           <p className="mt-6 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
             Last changed: 42 days ago
           </p>
        </div>
      </div>
    </div>
  );
}