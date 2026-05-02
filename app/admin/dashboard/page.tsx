"use client";
// app/admin/dashboard/page.tsx
// Uniform sidebar + topnav layout. Profile badge opens AdminProfilePanel slide-over.

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import nextDynamic from "next/dynamic";
import {
  LayoutDashboard, Map as MapIcon, Truck, Users, Recycle,
  AlertTriangle, LogOut, Menu, ShieldCheck, ChevronRight, X,
  Search, Bell, Smartphone, ArrowUpRight
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

// ── THEME CONSTANTS ──────────────────────────────────────────────────────────
const SLIDE_IN = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes spin{to{transform:rotate(360deg)}}`;
const SLIDE_IN_STYLE = `
  @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

const THEME = {
  bg: "#f4f7f5",
  surface: "#ffffff",
  primary: "#1c4532",
  primaryHover: "#2d5a45",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  accent: "#f0fdf4"
};

const INP:React.CSSProperties = {
  padding:"10px 14px",
  borderRadius:10,
  border:`1px solid ${THEME.border}`,
  background:THEME.surface,
  color:THEME.text,
  fontSize:13,
  outline:"none",
  width:"100%",
  boxSizing:"border-box",
  transition: "border-color 0.2s"
};

// ── ADMIN PROFILE PANEL ───────────────────────────────────────────────────────
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
      .then((res: any) => { if(res.data?.email) setEmail(res.data.email); });
  },[userId]);

  useEffect(()=>{
    if(tab!=="activity") return;
    setLogsLoading(true);
    supabase.from("audit_logs").select("id,action_type,reason,created_at")
      .eq("admin_id",userId).order("created_at",{ascending:false}).limit(40)
      .then((res: any) => { setLogs(res.data??[]); setLogsLoading(false); });
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

  const initials = profile.full_name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const TABS_LIST=[{id:"profile",label:"Profile",icon:"👤"},{id:"security",label:"Security",icon:"🔒"},{id:"activity",label:"Activity",icon:"🗒️"}] as const;
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.3)",backdropFilter:"blur(4px)",zIndex:2002}}/>
      <div style={{
        position:"fixed",top:20,right:20,bottom:20,zIndex:2003,
        width:"min(440px,100vw - 40px)",background:"#fff",
        boxShadow:"-10px 0 40px rgba(0,0,0,.08)",
        display:"flex",flexDirection:"column",
        borderRadius:24,
        animation:"slideInRight .3s cubic-bezier(.4,0,.2,1) both",
        fontFamily:"sans-serif",
        overflow:"hidden"
      }}>
        <style>{SLIDE_IN}</style>

        {/* Header */}
        <div style={{padding:"24px",borderBottom:`1px solid ${THEME.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <span style={{fontSize:13,fontWeight:800,color:THEME.text,letterSpacing:".02em"}}>Admin Profile</span>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:10,border:`1px solid ${THEME.border}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <X size={14} color={THEME.text}/>
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:72,height:72,borderRadius:20,background:avatarUrl?"#f1f5f9":THEME.primary,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:`2px solid #fff`,boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}}>
                {avatarUrl?<img src={avatarUrl} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:24,fontWeight:900,color:"#fff"}}>{initials}</span>}
                {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:20,height:20,borderRadius:"50%",border:`2px solid rgba(255,255,255,.3)`,borderTopColor:"#fff",animation:"spin 1s linear infinite"}}/></div>}
              </div>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{position:"absolute",bottom:-4,right:-4,width:26,height:26,borderRadius:10,background:THEME.primary,border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,boxShadow:"0 2px 6px rgba(0,0,0,0.1)"}} title="Change photo">📷</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:18,fontWeight:800,color:THEME.text}}>{profile.full_name}</div>
              <div style={{fontSize:12,color:THEME.textMuted,marginTop:4,display:"flex",alignItems:"center",gap:6}}>
                <ShieldCheck size={14} color={THEME.primary}/> Barangay Admin
              </div>
              <div style={{fontSize:11,color:THEME.textMuted,marginTop:2}}>{email}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",padding:"0 12px",borderBottom:`1px solid ${THEME.border}`,flexShrink:0,background:"#fafafa"}}>
          {TABS_LIST.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"14px 0",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:13,fontWeight:tab===t.id?700:500,color:tab===t.id?THEME.primary:THEME.textMuted,borderBottom:tab===t.id?`3px solid ${THEME.primary}`:"3px solid transparent",transition:"all .2s balanced"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"24px",display:"flex",flexDirection:"column",gap:20}}>

          {tab==="profile"&&(<>
            {!editing?(
              <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:"#fafafa",borderBottom:`1px solid ${THEME.border}`}}>
                  <span style={{fontSize:11,fontWeight:800,color:THEME.textMuted,letterSpacing:".05em",textTransform:"uppercase"}}>Personal Info</span>
                  <button onClick={()=>setEditing(true)} style={{fontSize:12,fontWeight:700,color:THEME.primary,background:"transparent",border:"none",cursor:"pointer"}}>Edit</button>
                </div>
                <div style={{padding:"20px",display:"grid",gap:16}}>
                  {[{l:"Full Name",v:profile.full_name},{l:"Email",v:email},{l:"Role",v:"Barangay Admin"}].map(f=>(
                    <div key={f.l}>
                      <div style={{fontSize:11,fontWeight:600,color:THEME.textMuted,marginBottom:4}}>{f.l}</div>
                      <div style={{fontSize:14,fontWeight:600,color:THEME.text}}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:THEME.text,display:"block",marginBottom:6}}>Full Name</label>
                  <input value={editName} onChange={e=>setEditName(e.target.value)} style={INP}/>
                </div>
                {saveErr&&<div style={{padding:12,borderRadius:10,background:"#fef2f2",fontSize:12,color:"#991b1b"}}>{saveErr}</div>}
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button onClick={()=>{setEditing(false);setSaveErr("");}} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${THEME.border}`,background:"#fff",color:THEME.text,fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                  <button onClick={saveProfile} disabled={saving||saveOk} style={{flex:1,padding:"12px",borderRadius:12,background:saveOk?"#059669":THEME.primary,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                    {saving?"Saving…":saveOk?"✓ Saved!":"Save"}
                  </button>
                </div>
              </div>
            )}
          </>)}

          {tab==="security"&&(<>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:THEME.text,display:"block",marginBottom:6}}>New Password</label>
                <input type={showPw?"text":"password"} value={pwForm.next} onChange={e=>setPwForm(p=>({...p,next:e.target.value}))} style={INP}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:THEME.text,display:"block",marginBottom:6}}>Confirm Password</label>
                <input type={showPw?"text":"password"} value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} style={INP}/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:THEME.textMuted}}>
                <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)}/> Show passwords
              </label>
              {pwErr&&<div style={{padding:12,borderRadius:10,background:"#fef2f2",fontSize:12,color:"#991b1b"}}>{pwErr}</div>}
              {pwOk&&<div style={{padding:12,borderRadius:10,background:THEME.accent,fontSize:12,color:THEME.primary,fontWeight:600}}>✓ Password updated.</div>}
              <button onClick={changePassword} disabled={pwSaving||!pwForm.next||!pwForm.confirm} style={{padding:"14px",borderRadius:12,background:THEME.primary,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",marginTop:8,opacity:(!pwForm.next||!pwForm.confirm||pwSaving)?.5:1}}>
                {pwSaving?"Updating…":"Change Password"}
              </button>
            </div>
          </>)}

          {tab==="activity"&&(<>
            {logsLoading?<div style={{padding:40,textAlign:"center",color:THEME.textMuted,fontSize:13}}>Loading…</div>
            :logs.length===0?<div style={{padding:40,textAlign:"center",color:THEME.textMuted,fontSize:13}}>No activity yet.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:12}}>{logs.map((l,i)=>(
              <div key={l.id??i} style={{padding:"14px",borderRadius:14,border:`1px solid ${THEME.border}`,background:"#fff"}}>
                <div style={{fontSize:13,fontWeight:700,color:THEME.text,marginBottom:4}}>{(l.action_type??"").replace(/_/g," ")}</div>
                <div style={{fontSize:12,color:THEME.textMuted,lineHeight:1.4}}>{l.reason||"—"}</div>
                <div style={{fontSize:11,color:THEME.textMuted,marginTop:8}}>{new Date(l.created_at).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}</div>
              </div>
            ))}</div>}
          </>)}
        </div>
      </div>
    </>
  );
}

// ── NOTIFICATIONS PANEL ───────────────────────────────────────────────────────
function NotificationsPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)
      .then((res: any) => { setNotifs(res.data || []); setLoading(false); });
  }, [userId]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", backdropFilter: "blur(4px)", zIndex: 2002 }} />
      <div style={{
        position: "fixed", top: 20, right: 20, bottom: 20, zIndex: 2003,
        width: "min(400px, 100vw - 40px)", background: "#fff",
        boxShadow: "-10px 0 40px rgba(0,0,0,.08)",
        display: "flex", flexDirection: "column",
        borderRadius: 24,
        animation: "slideInRight .3s cubic-bezier(.4,0,.2,1) both",
        fontFamily: "sans-serif",
        overflow: "hidden"
      }}>
        <div style={{ padding: "24px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: THEME.text }}>Notifications</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${THEME.border}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={THEME.text} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: THEME.textMuted }}>Loading alerts…</div>
            : notifs.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: THEME.textMuted }}>No new notifications.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {notifs.map(n => (
                  <div key={n.id} style={{ padding: "16px", borderRadius: 16, background: n.read ? "#fff" : THEME.accent, border: `1px solid ${THEME.border}` }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 12, background: THEME.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Bell size={18} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text, marginBottom: 4 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 8 }}>{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
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
  const [showNotifications,  setShowNotifications] = useState(false);
  const [adminProfile,       setAdminProfile]      = useState<{id:string;full_name:string;role:string;avatar_url?:string|null}|null>(null);
  const [loading,            setLoading]           = useState(true);
  const [deferredPrompt,     setDeferredPrompt]    = useState<any>(null);
  const [isInstallable,      setIsInstallable]     = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const fetchAdminProfile = useCallback(async()=>{
    const {data:{user}} = await supabase.auth.getUser();
    if(!user){router.replace("/login");return;}
    const {data:p} = await supabase.from("profiles").select("id,full_name,role,avatar_url").eq("id",user.id).single();
    if(p) setAdminProfile(p);
    setLoading(false);
  },[router]);

  useEffect(()=>{fetchAdminProfile();},[fetchAdminProfile]);
  
  const initials = adminProfile?.full_name?.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase() ?? "A";

  const handleLogout = async () => {
    setIsLoggingOut(true);
    if(adminProfile){
      try{await supabase.from("audit_logs").insert({admin_id:adminProfile.id,action_type:"ADMIN_LOGOUT",target_id:adminProfile.id,reason:`Session ended at ${new Date().toLocaleString("en-PH")}`});}catch(_){}
    }
    try{await supabase.auth.signOut();router.replace("/login");router.refresh();}
    catch{setIsLoggingOut(false);}
  };

  const handleEditCitizenProfile=()=>{setActiveTab("citizens");};

  const menuItems=[
    {id:"overview",    label:"Overview",         icon:LayoutDashboard},
    {id:"map",         label:"Bin Placement",    icon:MapIcon},
    {id:"drivers",     label:"Driver Fleet",     icon:Truck},
    {id:"citizens",    label:"Citizen Registry", icon:Users},
    {id:"collections", label:"Collections",      icon:Recycle},
    {id:"violations",  label:"Violations",       icon:AlertTriangle},
  ];

  if(loading)return(<div style={{minHeight:"100vh",background:"#f4f7f5",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{SLIDE_IN_STYLE}</style><div style={{textAlign:"center"}}><div style={{width:48,height:48,borderRadius:"50%",border:"3px solid #e5e7eb",borderTopColor:"#1c4532",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/><p style={{fontSize:12,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase",fontFamily:"sans-serif"}}>Loading workspace…</p></div></div>);

  const renderContent=()=>{
    switch(activeTab){
      case "overview":    return <div className="p-6 lg:p-8"><Overview /></div>;
      case "map":         return <div className="lg:p-6 h-full w-full"><DynamicBinSim /></div>;
      case "drivers":     return <div className="p-6 lg:p-8"><DriversList /></div>;
      case "citizens":    return <div className="p-6 lg:p-8 w-full"><CitizenRegistry onEditProfile={handleEditCitizenProfile}/></div>;
      case "collections": return <div className="p-6 lg:p-8"><CollectionsView /></div>;
      case "violations":  return <div className="p-6 lg:p-8"><ViolationsView /></div>;
      default:            return <div className="p-6 lg:p-8"><Overview /></div>;
    }
  };

  const currentLabel=menuItems.find(i=>i.id===activeTab)?.label??"Dashboard";

  return (
    <div className="flex h-screen w-full relative overflow-hidden" style={{background:THEME.bg,color:THEME.text,fontFamily:"sans-serif"}}>
      <style>{SLIDE_IN_STYLE}</style>
      <style>{`.row-hover:hover{background:#f9fafb!important;}input::placeholder,textarea::placeholder{color:#9ca3af;}select option{background:#fff;color:#111827;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px;}`}</style>

      {isSidebarOpen&&<div className="fixed inset-0 z-[2000] lg:hidden" style={{background:"rgba(0,0,0,.3)",backdropFilter:"blur(2px)"}} onClick={()=>setIsSidebarOpen(false)}/>}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 transform transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen?"translate-x-0":"-translate-x-full"}`}
        style={{background:"#ffffff",borderRight:`1px solid ${THEME.border}`,boxShadow:"2px 0 10px rgba(0,0,0,0.02)"}}>
        <div style={{padding:"28px 24px 20px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:THEME.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Recycle size={20} color="#ffffff"/>
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:THEME.text,letterSpacing:"-.02em"}}>EcoRoute</div>
              <div style={{fontSize:10,color:THEME.primary,letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}}>Admin Portal</div>
            </div>
          </div>
        </div>
        
        <nav style={{flex:1,padding:"10px 16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          <p style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",letterSpacing:".1em",padding:"12px 12px 6px"}}>Menu</p>
          {menuItems.map(item=>{
            const Icon=item.icon, isActive=activeTab===item.id;
            return(
              <button key={item.id} onClick={()=>{setActiveTab(item.id);setIsSidebarOpen(false);}}
                style={{
                  width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"12px 16px",borderRadius:14,border:"none",cursor:"pointer",
                  transition:"all .2s ease",
                  background:isActive?THEME.primary:"transparent",
                  color:isActive?"#ffffff":THEME.text,
                }}
                className="group"
              >
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Icon size={18} style={{opacity:isActive?1:0.6}}/>
                  <span style={{fontSize:14,fontWeight:isActive?700:500}}>{item.label}</span>
                </div>
                {isActive&&<ChevronRight size={14} style={{opacity:0.6}}/>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Card */}
        {isInstallable && (
          <div style={{padding:"20px",marginTop:"auto"}}>
            <div style={{background:THEME.accent,borderRadius:20,padding:20,position:"relative",overflow:"hidden",border:`1px solid #dcfce7`}}>
              <div style={{width:36,height:36,borderRadius:12,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,boxShadow:"0 4px 10px rgba(0,0,0,0.05)"}}>
                <Smartphone size={18} color={THEME.primary}/>
              </div>
              <p style={{fontSize:13,fontWeight:800,color:THEME.primary,marginBottom:4}}>EcoRoute Mobile</p>
              <p style={{fontSize:11,color:"#4b7a63",lineHeight:1.5,marginBottom:12}}>Monitor collections on the go.</p>
              <button 
                onClick={handleInstallApp}
                style={{width:"100%",padding:"10px",borderRadius:12,background:THEME.primary,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
              >
                Get the App <ArrowUpRight size={14}/>
              </button>
            </div>
          </div>
        )}

        <div style={{padding:"0 16px 24px",flexShrink:0}}>
          <button onClick={()=>setShowLogoutModal(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,border:"none",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:14,fontWeight:600}} className="hover:bg-red-50">
            <LogOut size={18}/>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden" style={{background:THEME.bg}}>
        
        {/* ── TOPNAV ── */}
        <header style={{height:80,background:"rgba(255,255,255,0.8)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",flexShrink:0,zIndex:1001}}>
          <div style={{display:"flex",alignItems:"center",gap:20,flex:1}}>
            <button onClick={()=>setIsSidebarOpen(true)} className="lg:hidden" style={{width:40,height:40,borderRadius:12,background:"#fff",border:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <Menu size={20}/>
            </button>
            <div style={{display:"flex",alignItems:"center",gap:12,background:"#f3f4f6",padding:"10px 18px",borderRadius:24,width:"min(400px, 100%)",border:`1px solid ${THEME.border}`}}>
              <Search size={16} color="#9ca3af"/>
              <input placeholder={`Search in ${currentLabel.toLowerCase()}…`} style={{background:"transparent",border:"none",outline:"none",fontSize:13,width:"100%",color:THEME.text}}/>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <button 
              onClick={() => setShowNotifications(true)}
              style={{width:44,height:44,borderRadius:14,border:`1px solid ${THEME.border}`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}
            >
              <Bell size={20} color={THEME.text}/>
              <div style={{position:"absolute",top:12,right:12,width:8,height:8,background:"#ef4444",borderRadius:"50%",border:"2px solid #fff"}}/>
            </button>

            <div style={{width:1,height:32,background:THEME.border,margin:"0 4px"}}/>

            <button
              onClick={()=>setShowProfile(true)}
              style={{
                display:"flex",alignItems:"center",gap:12,padding:"6px 6px 6px 14px",borderRadius:16,
                background:showProfile?THEME.accent:"#fff",
                border:`1px solid ${showProfile?THEME.primary:THEME.border}`,
                cursor:"pointer",transition:"all .2s ease"
              }}
            >
              <div style={{textAlign:"right"}} className="hidden md:block">
                <p style={{fontSize:13,fontWeight:800,color:THEME.text,lineHeight:1}}>{adminProfile?.full_name??"Admin"}</p>
                <p style={{fontSize:10,fontWeight:600,color:THEME.primary,marginTop:4,textTransform:"uppercase",letterSpacing:".02em"}}>Barangay Admin</p>
              </div>
              <div style={{width:38,height:38,borderRadius:12,background:adminProfile?.avatar_url?"#f1f5f9":THEME.primary,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:`1px solid ${THEME.border}`}}>
                {adminProfile?.avatar_url?<img src={adminProfile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:14,fontWeight:900,color:"#fff"}}>{initials}</span>}
              </div>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div style={{flex:1, overflowY: activeTab === "map" ? "hidden" : "auto", paddingBottom: activeTab === "map" ? 0 : 40, padding: activeTab === "map" ? 0 : undefined, margin: activeTab === "map" ? 0 : undefined}} className="animate-in fade-in duration-500">
           {activeTab !== "map" && (
             <div style={{padding:"32px 32px 0"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#10b981"}}/>
                  <span style={{fontSize:11,fontWeight:700,color:"#10b981",textTransform:"uppercase",letterSpacing:".1em"}}>System Online</span>
                </div>
                <h1 style={{fontSize:28,fontWeight:900,color:THEME.text,letterSpacing:"-.03em"}}>{currentLabel}</h1>
             </div>
           )}
           <div className={activeTab === "map" ? "h-full w-full" : ""} style={{ height: activeTab === "map" ? "100%" : "auto", width: activeTab === "map" ? "100%" : "auto" }}>
             {renderContent()}
           </div>
        </div>
      </main>

      {/* Notifications Panel */}
      {showNotifications && adminProfile && (
        <NotificationsPanel
          userId={adminProfile.id}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Admin Profile Panel */}
      {showProfile && adminProfile && (
        <AdminProfilePanel
          userId={adminProfile.id}
          profile={adminProfile}
          onClose={()=>setShowProfile(false)}
          onRefresh={fetchAdminProfile}
        />
      )}

      {/* Logout Modal */}
      {showLogoutModal&&(
        <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(0,0,0,.3)",backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:32,padding:40,width:"100%",maxWidth:400,textAlign:"center",boxShadow:"0 20px 50px rgba(0,0,0,0.1)",animation:"slideInUp .3s ease-out"}}>
            <div style={{width:64,height:64,borderRadius:22,background:"#fef2f2",color:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
              <LogOut size={32}/>
            </div>
            <h2 style={{fontSize:24,fontWeight:900,color:THEME.text,marginBottom:8,letterSpacing:"-.02em"}}>Sign Out?</h2>
            <p style={{fontSize:14,color:THEME.textMuted,marginBottom:32}}>You're about to end your administrative session.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <button onClick={handleLogout} disabled={isLoggingOut} style={{width:"100%",padding:"16px",borderRadius:16,background:"#ef4444",color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 10px 20px rgba(239,68,68,0.15)"}}>
                {isLoggingOut?"Signing out…":"Yes, Sign Out"}
              </button>
              <button onClick={()=>setShowLogoutModal(false)} disabled={isLoggingOut} style={{width:"100%",padding:"16px",borderRadius:16,background:"#f3f4f6",color:THEME.text,border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}