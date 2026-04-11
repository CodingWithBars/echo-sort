"use client";
// app/admin/dashboard/page.tsx
// Uniform sidebar + topnav layout. Profile badge opens AdminProfilePanel slide-over (top:80px).

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import nextDynamic from "next/dynamic";
import {
  LayoutDashboard, Map as MapIcon, Truck, Users, Recycle,
  AlertTriangle, LogOut, Menu, ShieldCheck, ChevronRight, X,
} from "lucide-react";

import Overview       from "@/components/admin/Overview";
import DriversList    from "@/components/admin/DriverList";
import CitizenRegistry from "@/components/admin/CitizenRegistry";
import CollectionsView from "@/components/admin/CollectionsView";
import ViolationsView  from "@/components/admin/ViolationsView";

const DynamicBinSim = nextDynamic(() => import("@/components/admin/BinPlacementSimulator"), {
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-slate-50 animate-pulse rounded-3xl m-6 border border-slate-100" />,
});

export const dynamic = "force-dynamic";
const supabase = createClient();

// ── SHARED SLIDE ANIMATION ────────────────────────────────────────────────────
const SLIDE_IN = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes spin{to{transform:rotate(360deg)}}`;
const EM = { 50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d" };
const INP:React.CSSProperties = {padding:"9px 12px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:EM[50],color:"#1e293b",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};

// ── ADMIN PROFILE PANEL ───────────────────────────────────────────────────────
// Slides in from the right below the 80px topnav.
// 3 tabs: Profile (avatar + edit name/title) | Security (password) | Activity (audit log)
// Admin-specific content: barangay scope, role badge, recent admin actions.

type AdminLog = {id:string;action_type:string;reason:string;created_at:string};

interface AdminProfilePanelProps {
  userId: string;
  profile: {full_name:string;role:string;avatar_url?:string|null};
  onClose: ()=>void;
  onRefresh: ()=>void;
}

function AdminProfilePanel({userId,profile,onClose,onRefresh}:AdminProfilePanelProps) {
  const [tab,        setTab]        = useState<"profile"|"security"|"activity">("profile");
  const [avatarUrl,  setAvatarUrl]  = useState<string|null>(profile.avatar_url??null);
  const [uploading,  setUploading]  = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editName,   setEditName]   = useState(profile.full_name);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [saveErr,    setSaveErr]    = useState("");
  const [pwForm,     setPwForm]     = useState({next:"",confirm:""});
  const [showPw,     setShowPw]     = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwOk,       setPwOk]       = useState(false);
  const [pwErr,      setPwErr]      = useState("");
  const [logs,       setLogs]       = useState<AdminLog[]>([]);
  const [logsLoading,setLogsLoading]= useState(false);
  const [email,      setEmail]      = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{
    supabase.from("profiles").select("email").eq("id",userId).single()
      .then((res: {data: {email:string}|null; error: unknown}) => { if(res.data?.email) setEmail(res.data.email); });
  },[userId]);

  useEffect(()=>{
    if(tab!=="activity") return;
    setLogsLoading(true);
    supabase.from("audit_logs").select("id,action_type,reason,created_at")
      .eq("admin_id",userId).order("created_at",{ascending:false}).limit(40)
      .then((res: {data: AdminLog[]|null; error: unknown}) => { setLogs(res.data??[]); setLogsLoading(false); });
  },[tab,userId]);

  const handleAvatar = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    setUploading(true);
    const ext=f.name.split(".").pop(), path=`${userId}/avatar-${Date.now()}.${ext}`;
    await supabase.storage.from("avatars").upload(path,f,{upsert:true,contentType:f.type});
    const {data:{publicUrl}} = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({avatar_url:publicUrl}).eq("id",userId);
    setAvatarUrl(publicUrl); setUploading(false);
  };

  const saveProfile = async () => {
    if(!editName.trim()){setSaveErr("Name cannot be empty.");return;}
    setSaving(true); setSaveErr("");
    const {error} = await supabase.from("profiles").update({full_name:editName.trim()}).eq("id",userId);
    if(error){setSaveErr(error.message);setSaving(false);return;}
    await supabase.from("audit_logs").insert({admin_id:userId,action_type:"ADMIN_UPDATE_PROFILE",target_id:userId,reason:"Profile updated"});
    setSaveOk(true); setTimeout(()=>{setSaveOk(false);setEditing(false);onRefresh();},1200); setSaving(false);
  };

  const changePassword = async () => {
    setPwErr("");
    if(!pwForm.next||pwForm.next!==pwForm.confirm){setPwErr("Passwords do not match.");return;}
    if(pwForm.next.length<8){setPwErr("Minimum 8 characters.");return;}
    setPwSaving(true);
    const {error} = await supabase.auth.updateUser({password:pwForm.next});
    if(error){setPwErr(error.message);setPwSaving(false);return;}
    await supabase.from("audit_logs").insert({admin_id:userId,action_type:"ADMIN_PASSWORD_CHANGE",target_id:userId,reason:"Password changed"});
    setPwOk(true); setPwForm({next:"",confirm:""}); setTimeout(()=>setPwOk(false),3500); setPwSaving(false);
  };

  const fmtFull = (iso:string) => new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
  const initials = profile.full_name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const actionIcon = (t:string) => {
    if(t.includes("LOGIN"))    return {i:"🔑",c:EM[600]};
    if(t.includes("LOGOUT"))   return {i:"🚪",c:"#6b7280"};
    if(t.includes("PASSWORD")) return {i:"🔒",c:"#d97706"};
    if(t.includes("PROFILE"))  return {i:"✏️",c:EM[600]};
    if(t.includes("CITIZEN"))  return {i:"👤",c:"#3b82f6"};
    if(t.includes("VIOLATION"))return {i:"⚠️",c:"#d97706"};
    if(t.includes("WARNING"))  return {i:"🚨",c:"#ef4444"};
    return {i:"📋",c:"#6b7280"};
  };

  const TABS=[{id:"profile",label:"Profile",icon:"👤"},{id:"security",label:"Security",icon:"🔒"},{id:"activity",label:"Activity",icon:"🗒️"}] as const;

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(2px)",zIndex:700}}/>
      <div style={{
        position:"fixed",top:80,right:0,bottom:0,zIndex:800,
        width:"min(460px,100vw)",background:"#fff",
        boxShadow:"-8px 0 48px rgba(0,0,0,.15)",
        display:"flex",flexDirection:"column",
        animation:"slideInRight .25s cubic-bezier(.4,0,.2,1) both",
        fontFamily:"sans-serif",
      }}>
        <style>{SLIDE_IN}</style>

        {/* Header */}
        <div style={{padding:"20px",borderBottom:`1px solid ${EM[100]}`,background:EM[50],flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontSize:12,fontWeight:800,color:EM[700],letterSpacing:".1em",textTransform:"uppercase"}}>My Profile</span>
            <button onClick={onClose} style={{width:30,height:30,borderRadius:8,border:`1px solid ${EM[200]}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <X size={13} color={EM[700]}/>
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:68,height:68,borderRadius:18,background:avatarUrl?"#f1f5f9":`linear-gradient(135deg,${EM[500]},${EM[700]})`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:`2px solid ${EM[200]}`}}>
                {avatarUrl?<img src={avatarUrl} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:22,fontWeight:900,color:"#fff"}}>{initials}</span>}
                {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid rgba(255,255,255,.3)`,borderTopColor:"#fff",animation:"spin 1s linear infinite"}}/></div>}
              </div>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{position:"absolute",bottom:-4,right:-4,width:24,height:24,borderRadius:8,background:EM[600],border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}} title="Change photo">📷</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:EM[900]}}>{profile.full_name}</div>
              <div style={{fontSize:12,color:EM[600],marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                <ShieldCheck size={13} color={EM[600]}/> Barangay Admin
              </div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{email}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${EM[100]}`,flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"11px 0",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,fontWeight:tab===t.id?700:500,color:tab===t.id?EM[700]:"#6b7280",borderBottom:tab===t.id?`2.5px solid ${EM[600]}`:"2.5px solid transparent",transition:"color .15s",fontFamily:"sans-serif"}}>
              <span style={{fontSize:14}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px",display:"flex",flexDirection:"column",gap:14}}>

          {/* ── PROFILE ── */}
          {tab==="profile"&&(<>
            {!editing?(
              <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}>
                  <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Account Details</span>
                  <button onClick={()=>setEditing(true)} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:8,background:"#fff",color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer"}}>✏️ Edit</button>
                </div>
                <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{l:"Full Name",v:profile.full_name},{l:"Email",v:email},{l:"Role",v:"Barangay Admin"},{l:"Access",v:"Barangay Scope"}].map(f=>(
                    <div key={f.l} style={{background:EM[50],borderRadius:9,padding:"9px 12px",border:`1px solid ${EM[100]}`}}>
                      <div style={{fontSize:9,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{f.l}</div>
                      <div style={{fontSize:13,fontWeight:600,color:EM[900],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[300]}`,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}><span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Edit Profile</span></div>
                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Full Name *</label>
                    <input value={editName} onChange={e=>setEditName(e.target.value)} style={INP}/>
                  </div>
                  <div style={{padding:"10px 12px",borderRadius:9,background:"#f8fafc",border:`1px solid ${EM[100]}`,fontSize:12,color:"#6b7280"}}>Email and role are managed by Super Admin.</div>
                  {saveErr&&<div style={{padding:"8px 12px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b"}}>{saveErr}</div>}
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setEditing(false);setSaveErr("");}} style={{padding:"8px 16px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:"#fff",color:EM[700],fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"sans-serif"}}>Cancel</button>
                    <button onClick={saveProfile} disabled={saving||saveOk} style={{padding:"8px 20px",borderRadius:9,background:saveOk?EM[500]:EM[600],color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif"}}>
                      {saving?"Saving…":saveOk?"✓ Saved!":"Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div style={{padding:"11px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[100]}`,fontSize:12,color:EM[700],display:"flex",gap:9,alignItems:"center"}}>
              <span style={{fontSize:16}}>📷</span><span>Tap the camera icon on your photo above to upload a new profile picture.</span>
            </div>
          </>)}

          {/* ── SECURITY ── */}
          {tab==="security"&&(<>
            <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}><span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>🔒 Change Password</span></div>
              <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                {([{label:"New Password",key:"next",ph:"Min. 8 characters"},{label:"Confirm Password",key:"confirm",ph:"Re-enter password"}] as const).map(f=>(
                  <div key={f.key}>
                    <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>{f.label}</label>
                    <input type={showPw?"text":"password"} value={pwForm[f.key]} onChange={e=>setPwForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph} style={INP} onKeyDown={e=>e.key==="Enter"&&changePassword()}/>
                  </div>
                ))}
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:EM[800],userSelect:"none"}}>
                  <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)} style={{accentColor:EM[600],cursor:"pointer"}}/>Show passwords
                </label>
                {pwErr&&<div style={{padding:"9px 12px",borderRadius:9,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b",display:"flex",gap:7,alignItems:"center"}}><span>⚠️</span>{pwErr}</div>}
                {pwOk&&<div style={{padding:"9px 12px",borderRadius:9,background:EM[50],border:`1px solid ${EM[300]}`,fontSize:12,color:EM[800],fontWeight:600,display:"flex",gap:7,alignItems:"center"}}><span>✅</span>Password updated.</div>}
                <button onClick={changePassword} disabled={pwSaving||!pwForm.next||!pwForm.confirm} style={{padding:"10px 0",borderRadius:9,background:EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"sans-serif",opacity:(!pwForm.next||!pwForm.confirm||pwSaving)?.5:1}}>
                  {pwSaving?"Updating…":"Update Password"}
                </button>
              </div>
            </div>
            <div style={{padding:"14px 16px",borderRadius:12,background:"#fffbeb",border:"1px solid #fde68a",fontSize:12,color:"#78350f",lineHeight:1.7}}>
              <div style={{fontWeight:800,marginBottom:6}}>🛡️ Security Tips</div>
              <ul style={{margin:0,paddingLeft:16}}><li>Use a unique password not used elsewhere</li><li>Log out on shared devices</li><li>Check Activity log for unauthorized sessions</li></ul>
            </div>
          </>)}

          {/* ── ACTIVITY ── */}
          {tab==="activity"&&(<>
            <div style={{padding:"11px 14px",borderRadius:10,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:12,color:"#1e40af",lineHeight:1.5,display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{fontSize:15,flexShrink:0}}>ℹ️</span>
              <span>Your admin actions and auth sessions. Unexpected activity may indicate unauthorized access — change your password immediately.</span>
            </div>
            <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Recent Activity</span>
                <span style={{fontSize:10,color:"#9ca3af"}}>Last 40 entries</span>
              </div>
              {logsLoading?<div style={{padding:28,textAlign:"center",color:"#9ca3af",fontSize:13}}>Loading…</div>
              :logs.length===0?<div style={{padding:28,textAlign:"center",color:"#9ca3af",fontSize:13}}>No activity yet.</div>
              :<div>{logs.map((l,i)=>{
                const{i:icon,c:col}=actionIcon(l.action_type??"");
                const isAuth=l.action_type?.includes("LOGIN")||l.action_type?.includes("LOGOUT");
                return(
                  <div key={l.id??i} style={{padding:"11px 16px",borderBottom:`1px solid ${EM[50]}`,display:"flex",gap:12,alignItems:"flex-start",background:isAuth?"#f8fafc":"#fff"}}>
                    <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:`${col}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:EM[900],display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                        {(l.action_type??"").replace(/_/g," ")}
                        {isAuth&&<span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:20,background:l.action_type?.includes("LOGIN")?EM[100]:"#f1f5f9",color:l.action_type?.includes("LOGIN")?EM[700]:"#475569"}}>{l.action_type?.includes("LOGIN")?"SESSION START":"SESSION END"}</span>}
                      </div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:2,lineHeight:1.4}}>{l.reason||"—"}</div>
                      <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{new Date(l.created_at).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}</div>
                    </div>
                  </div>
                );
              })}</div>}
            </div>
          </>)}
        </div>
      </div>
    </>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router   = useRouter();
  const [activeTab,          setActiveTab]         = useState("overview");
  const [isSidebarOpen,      setIsSidebarOpen]     = useState(false);
  const [showLogoutModal,    setShowLogoutModal]   = useState(false);
  const [isLoggingOut,       setIsLoggingOut]      = useState(false);
  const [showProfile,        setShowProfile]       = useState(false);
  const [selectedCitizenData,setSelectedCitizenData]=useState<any|null>(null);
  const [adminProfile,       setAdminProfile]      = useState<{id:string;full_name:string;role:string;avatar_url?:string|null}|null>(null);

  const fetchAdminProfile = useCallback(async()=>{
    const {data:{user}} = await supabase.auth.getUser();
    if(!user){router.replace("/login");return;}
    const {data:p} = await supabase.from("profiles").select("id,full_name,role,avatar_url").eq("id",user.id).single();
    if(p) setAdminProfile(p);
  },[router]);

  useEffect(()=>{fetchAdminProfile();},[fetchAdminProfile]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    if(adminProfile){
      try{await supabase.from("audit_logs").insert({admin_id:adminProfile.id,action_type:"ADMIN_LOGOUT",target_id:adminProfile.id,reason:`Session ended at ${new Date().toLocaleString("en-PH")}`});}catch(_){}
    }
    try{await supabase.auth.signOut();router.replace("/login");router.refresh();}
    catch{setIsLoggingOut(false);}
  };

  const handleEditCitizenProfile=(citizen:any)=>{setSelectedCitizenData(citizen);setActiveTab("citizens");};

  const menuItems=[
    {id:"overview",    label:"Overview",         icon:LayoutDashboard},
    {id:"map",         label:"Bin Placement",           icon:MapIcon},
    {id:"drivers",     label:"Driver Fleet",      icon:Truck},
    {id:"citizens",    label:"Citizen Registry",  icon:Users},
    {id:"collections", label:"Collections",       icon:Recycle},
    {id:"violations",  label:"Violations",        icon:AlertTriangle},
  ];

  const renderContent=()=>{
    switch(activeTab){
      case "overview":    return <div className="p-6 lg:p-8"><Overview /></div>;
      case "map":         return <div className="p-6 h-full min-h-[600px]"><DynamicBinSim /></div>;
      case "drivers":     return <div className="p-6 lg:p-8"><DriversList /></div>;
      case "citizens":    return <div className="p-6 lg:p-8 w-full"><CitizenRegistry onEditProfile={handleEditCitizenProfile}/></div>;
      case "collections": return <div className="p-6 lg:p-8"><CollectionsView /></div>;
      case "violations":  return <div className="p-6 lg:p-8"><ViolationsView /></div>;
      default:            return <div className="p-6 lg:p-8"><Overview /></div>;
    }
  };

  const currentLabel=menuItems.find(i=>i.id===activeTab)?.label??"Dashboard";

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden text-slate-900">
      <style>{SLIDE_IN}</style>

      {/* Mobile overlay */}
      {isSidebarOpen&&<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden animate-in fade-in duration-300" onClick={()=>setIsSidebarOpen(false)}/>}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen?"translate-x-0":"-translate-x-full"}`}>
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 border border-emerald-500/20">
              <Recycle className="text-white" size={20}/>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">EcoRoute</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto">
          <p className="px-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Management Portal</p>
          {menuItems.map(item=>{
            const Icon=item.icon, isActive=activeTab===item.id;
            return(
              <button key={item.id} onClick={()=>{setActiveTab(item.id);setIsSidebarOpen(false);}}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-300 group ${isActive?"bg-emerald-600 text-white shadow-md shadow-emerald-100":"text-slate-500 hover:bg-slate-50 hover:text-emerald-600"}`}>
                <div className="flex items-center gap-4">
                  <Icon size={20} strokeWidth={isActive?2.5:2}/>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isActive?"opacity-100":"opacity-80 group-hover:opacity-100"}`}>{item.label}</span>
                </div>
                {isActive&&<ChevronRight size={14} className="animate-in slide-in-from-left-2"/>}
              </button>
            );
          })}
        </nav>

        <div className="p-6 shrink-0">
          <button onClick={()=>setShowLogoutModal(true)} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-[10px] uppercase tracking-widest border border-slate-100 hover:border-red-100 group">
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform"/>
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-slate-50/50">

        {/* ── TOPNAV — h-20 (80px) ── */}
        <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button onClick={()=>setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-all">
              <Menu size={20}/>
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em]">System Live</p>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight uppercase">{currentLabel}</h2>
            </div>
          </div>

          {/* Profile badge — opens slide-over (top:80px, below this header) */}
          <button
            onClick={()=>setShowProfile(true)}
            className={`flex items-center gap-3 p-1.5 pr-4 rounded-xl border transition-all duration-300 ${showProfile?"bg-slate-900 border-slate-800 shadow-lg":"bg-white border-slate-200 hover:border-emerald-200 hover:shadow-sm"}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden border transition-all ${showProfile?"border-emerald-500/50":"border-slate-100"}`}>
              {adminProfile?.avatar_url
                ? <img src={adminProfile.avatar_url} alt="Admin" className="w-full h-full object-cover"/>
                : <div className="w-full h-full bg-emerald-600 flex items-center justify-center"><span className="font-black text-white text-sm uppercase">{adminProfile?.full_name?.charAt(0)??"A"}</span></div>
              }
            </div>
            <div className="text-left hidden md:block">
              <p className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${showProfile?"text-white":"text-slate-900"}`}>{adminProfile?.full_name??"System Admin"}</p>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={10} className={showProfile?"text-emerald-400":"text-emerald-600"}/>
                <p className={`text-[9px] font-bold uppercase tracking-widest ${showProfile?"text-slate-400":"text-slate-500"}`}>
                  {adminProfile?.role??"Administrator"}
                </p>
              </div>
            </div>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          {renderContent()}
        </div>
      </main>

      {/* Admin Profile Panel — top:80px clears the h-20 header */}
      {showProfile && adminProfile && (
        <AdminProfilePanel
          userId={adminProfile.id}
          profile={adminProfile}
          onClose={()=>setShowProfile(false)}
          onRefresh={fetchAdminProfile}
        />
      )}

      {/* Logout modal */}
      {showLogoutModal&&(
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><LogOut size={32}/></div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">End Session?</h2>
              <p className="text-xs font-medium text-slate-500 mb-8 leading-relaxed">You are about to exit the management portal.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleLogout} disabled={isLoggingOut} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50">
                  {isLoggingOut?"Closing Session…":"Confirm & Logout"}
                </button>
                <button onClick={()=>setShowLogoutModal(false)} disabled={isLoggingOut} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
                  Stay Active
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}