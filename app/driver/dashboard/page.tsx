"use client";
// app/driver/dashboard/page.tsx
// Uniform sidebar + topnav. Profile badge opens DriverProfilePanel slide-over (top:80px).

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import dynamic from "next/dynamic";
import { X, ShieldCheck } from "lucide-react";
import CollectionHistory, {
  type ActiveRouteState,
  type ActiveRouteSetters,
  type BinManifest,
  type TravelOrder,
  type TripSummary,
} from "@/components/driver/CollectionHistory";
import TruckStatus      from "@/components/driver/TruckStatus";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

interface DriverDetails {
  id:string;duty_status:string;license_number?:string;
  vehicle_plate_number?:string;assigned_route?:string;employment_status?:string;
}

const DriverMap = dynamic(()=>import("@/components/driver/DriverMap"),{
  ssr:false,
  loading:()=>(
    <div className="w-full h-full bg-slate-100 flex items-center justify-center shadow-inner">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Waking Eco-Engine...</p>
      </div>
    </div>
  ),
});

const supabase = createClient();

// ── SHARED SLIDE ANIMATION ────────────────────────────────────────────────────
const SLIDE_IN = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes spin{to{transform:rotate(360deg)}}`;
const EM = {50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d"};
const INP:React.CSSProperties={padding:"9px 12px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:EM[50],color:"#1e293b",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};

// ── DRIVER PROFILE PANEL ──────────────────────────────────────────────────────
// Driver-specific content: duty status, truck/plate/route, license number,
// plus standard profile edit + security + activity tabs.

type DriverLog = {id:string;action_type:string;reason:string;created_at:string};

interface DriverProfilePanelProps {
  driverData: any;
  onClose: ()=>void;
  onRefresh: ()=>void;
}

function DriverProfilePanel({driverData,onClose,onRefresh}:DriverProfilePanelProps) {
  const [tab,        setTab]        = useState<"profile"|"security"|"activity">("profile");
  const [avatarUrl,  setAvatarUrl]  = useState<string|null>(driverData?.avatar_url??null);
  const [uploading,  setUploading]  = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editName,   setEditName]   = useState(driverData?.full_name??"");
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [saveErr,    setSaveErr]    = useState("");
  const [pwForm,     setPwForm]     = useState({next:"",confirm:""});
  const [showPw,     setShowPw]     = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwOk,       setPwOk]       = useState(false);
  const [pwErr,      setPwErr]      = useState("");
  const [logs,       setLogs]       = useState<DriverLog[]>([]);
  const [logsLoading,setLogsLoading]= useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = driverData?.id;
  const details = driverData?.driver_details;

  useEffect(()=>{
    if(tab!=="activity"||!userId) return;
    setLogsLoading(true);
    supabase.from("audit_logs").select("id,action_type,reason,created_at")
      .eq("admin_id",userId).order("created_at",{ascending:false}).limit(40)
      .then((res: { data: DriverLog[] | null; error: unknown }) => { const data = res.data; setLogs(data??[]); setLogsLoading(false); });
  },[tab,userId]);

  const handleAvatar = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const f=e.target.files?.[0]; if(!f) return;
    setUploading(true);
    const ext=f.name.split(".").pop(), path=`${userId}/avatar-${Date.now()}.${ext}`;
    await supabase.storage.from("avatars").upload(path,f,{upsert:true,contentType:f.type});
    const {data:{publicUrl}}=supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({avatar_url:publicUrl}).eq("id",userId);
    setAvatarUrl(publicUrl); setUploading(false);
  };

  const saveProfile = async () => {
    if(!editName.trim()){setSaveErr("Name cannot be empty.");return;}
    setSaving(true); setSaveErr("");
    const {error}=await supabase.from("profiles").update({full_name:editName.trim()}).eq("id",userId);
    if(error){setSaveErr(error.message);setSaving(false);return;}
    setSaveOk(true); setTimeout(()=>{setSaveOk(false);setEditing(false);onRefresh();},1200); setSaving(false);
  };

  const changePassword = async () => {
    setPwErr("");
    if(!pwForm.next||pwForm.next!==pwForm.confirm){setPwErr("Passwords do not match.");return;}
    if(pwForm.next.length<8){setPwErr("Minimum 8 characters.");return;}
    setPwSaving(true);
    const {error}=await supabase.auth.updateUser({password:pwForm.next});
    if(error){setPwErr(error.message);setPwSaving(false);return;}
    setPwOk(true); setPwForm({next:"",confirm:""}); setTimeout(()=>setPwOk(false),3500); setPwSaving(false);
  };

  const fmtFull=(iso:string)=>new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
  const initials=(driverData?.full_name??"D").split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase();
  const isOnDuty = details?.duty_status==="ON-DUTY";

  const actionIcon=(t:string)=>{
    if(t.includes("LOGIN")) return{i:"🔑",c:EM[600]};
    if(t.includes("LOGOUT"))return{i:"🚪",c:"#6b7280"};
    if(t.includes("DUTY")) return{i:"🚛",c:EM[600]};
    return{i:"📋",c:"#6b7280"};
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
            <button onClick={onClose} style={{width:30,height:30,borderRadius:8,border:`1px solid ${EM[200]}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13} color={EM[700]}/></button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:68,height:68,borderRadius:18,background:avatarUrl?"#f1f5f9":`linear-gradient(135deg,${EM[500]},${EM[700]})`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:`2px solid ${EM[200]}`}}>
                {avatarUrl?<img src={avatarUrl} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:22,fontWeight:900,color:"#fff",fontStyle:"italic"}}>{initials}</span>}
                {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:18,height:18,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin 1s linear infinite"}}/></div>}
              </div>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{position:"absolute",bottom:-4,right:-4,width:24,height:24,borderRadius:8,background:EM[600],border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}} title="Change photo">📷</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:EM[900]}}>{driverData?.full_name??"Driver"}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:isOnDuty?"#22c55e":"#94a3b8",flexShrink:0,boxShadow:isOnDuty?"0 0 6px rgba(34,197,94,.6)":"none"}}/>
                <span style={{fontSize:12,color:isOnDuty?EM[600]:"#94a3b8",fontWeight:700}}>{isOnDuty?"On Duty":"Off Duty"}</span>
              </div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{details?.vehicle_plate_number??"No truck assigned"} {details?.assigned_route?`· ${details.assigned_route}`:""}</div>
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
            {/* Truck info card — driver-specific */}
            <div style={{background:`linear-gradient(135deg,${EM[700]},${EM[900]})`,borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
              <div style={{fontSize:10,fontWeight:800,color:"rgba(167,243,208,.7)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>Assigned Vehicle</div>
              <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{details?.vehicle_plate_number??"Unassigned"}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:4}}>{details?.assigned_route??"No route assigned"}</div>
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {label:"License",  value:details?.license_number??"—"},
                  {label:"Status",   value:details?.duty_status??"OFF-DUTY"},
                  {label:"Employment",value:details?.employment_status??"—"},
                ].map(s=>(
                  <div key={s.label} style={{background:"rgba(255,255,255,.1)",borderRadius:9,padding:"9px 12px"}}>
                    <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,.5)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{s.label}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit form / read-only */}
            {!editing?(
              <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[100]}`,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}>
                  <span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Account Details</span>
                  <button onClick={()=>setEditing(true)} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:8,background:"#fff",color:EM[700],border:`1.5px solid ${EM[200]}`,cursor:"pointer"}}>✏️ Edit</button>
                </div>
                <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{l:"Full Name",v:driverData?.full_name},{l:"Role",v:"Driver"},{l:"Plate No.",v:details?.vehicle_plate_number??"—"},{l:"Route",v:details?.assigned_route??"—"}].map(f=>(
                    <div key={f.l} style={{background:EM[50],borderRadius:9,padding:"9px 12px",border:`1px solid ${EM[100]}`}}>
                      <div style={{fontSize:9,fontWeight:800,color:EM[600],letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{f.l}</div>
                      <div style={{fontSize:13,fontWeight:600,color:EM[900],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{background:"#fff",borderRadius:14,border:`1.5px solid ${EM[300]}`,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:EM[50],borderBottom:`1px solid ${EM[100]}`}}><span style={{fontSize:11,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>Edit Name</span></div>
                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Full Name *</label>
                    <input value={editName} onChange={e=>setEditName(e.target.value)} style={INP}/>
                  </div>
                  <div style={{padding:"10px 12px",borderRadius:9,background:"#f8fafc",border:`1px solid ${EM[100]}`,fontSize:12,color:"#6b7280"}}>Truck assignment and routes are managed by the Admin.</div>
                  {saveErr&&<div style={{padding:"8px 12px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b"}}>{saveErr}</div>}
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setEditing(false);setSaveErr("");}} style={{padding:"8px 16px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:"#fff",color:EM[700],fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"sans-serif"}}>Cancel</button>
                    <button onClick={saveProfile} disabled={saving||saveOk} style={{padding:"8px 20px",borderRadius:9,background:saveOk?EM[500]:EM[600],color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif"}}>
                      {saving?"Saving…":saveOk?"✓ Saved!":"Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div style={{padding:"11px 14px",borderRadius:10,background:EM[50],border:`1px solid ${EM[100]}`,fontSize:12,color:EM[700],display:"flex",gap:9,alignItems:"center"}}>
              <span style={{fontSize:16}}>📷</span><span>Tap the camera icon on your photo above to update your profile picture.</span>
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
              <ul style={{margin:0,paddingLeft:16}}><li>Never share your login credentials</li><li>Log out when leaving your device</li><li>Contact your Admin if you notice suspicious activity</li></ul>
            </div>
          </>)}

          {/* ── ACTIVITY ── */}
          {tab==="activity"&&(<>
            <div style={{padding:"11px 14px",borderRadius:10,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:12,color:"#1e40af",lineHeight:1.5,display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{fontSize:15,flexShrink:0}}>ℹ️</span>
              <span>Your login sessions and duty status changes. If you see activity you don't recognize, contact your Admin immediately.</span>
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
                      <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{fmtFull(l.created_at)}</div>
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
export default function DriverDashboard() {
  const router = useRouter();
  const [activeTab,       setActiveTab]       = useState("map");
  const [isSidebarOpen,   setIsSidebarOpen]   = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut,    setIsLoggingOut]    = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [driverData,      setDriverData]      = useState<any>(null);
  const [isLoading,       setIsLoading]       = useState(true);

  // ── Lifted active-route state ────────────────────────────────────────────
  // Lives here so it persists when driver switches between map / history tabs.
  const [activeOrder,   setActiveOrder]   = useState<TravelOrder | null>(null);
  const [activeBins,    setActiveBins]    = useState<BinManifest[]>([]);
  const [tripSummary,   setTripSummary]   = useState<any>(null);
  const [isRouting,     setIsRouting]     = useState(false);
  // Bins formatted for RoutingLayerGL (needs fillLevel not fill_level)
  const routeBins = activeBins.map(b => ({
    id:          b.id,
    name:        b.name,
    lat:         b.lat,
    lng:         b.lng,
    fillLevel:   b.fill_level,
    batteryLevel:100,
    device_id:   b.device_id,
    collected:   b.collected,
  }));

  useEffect(()=>{
    (async()=>{
      try{
        const {data:{user}} = await supabase.auth.getUser();
        if(!user){router.push("/login");return;}
        const {data,error} = await supabase.from("profiles").select(`id,full_name,avatar_url,driver_details!inner(id,license_number,vehicle_plate_number,assigned_route,duty_status,employment_status)`).eq("id",user.id).single();
        if(error) throw error;
        if(data.driver_details.employment_status!=="ACTIVE"){await supabase.auth.signOut();router.push("/login");return;}
        setDriverData(data);
      }catch(err){console.error("Dashboard Error:",err);}
      finally{setIsLoading(false);}
    })();
  },[router]);

  useEffect(()=>{
    if(!driverData?.id) return;
    const ch = supabase.channel(`driver-status-${driverData.id}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"driver_details",filter:`id=eq.${driverData.id}`},
        (payload:RealtimePostgresUpdatePayload<DriverDetails>)=>{
          setDriverData((prev:any)=>({...prev,driver_details:{...prev.driver_details,duty_status:payload.new.duty_status}}));
        })
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[driverData?.id]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try{await supabase.auth.signOut();router.push("/login");router.refresh();}
    catch(error){console.error("Error logging out:",error);setIsLoggingOut(false);}
  };

  const refreshDriverData = async () => {
    const {data:{user}} = await supabase.auth.getUser();
    if(!user) return;
    const {data} = await supabase.from("profiles").select(`id,full_name,avatar_url,driver_details!inner(id,license_number,vehicle_plate_number,assigned_route,duty_status,employment_status)`).eq("id",user.id).single();
    if(data) setDriverData(data);
  };

  const menuItems=[
    {id:"map",     label:"Live Route Map",  icon:"🗺️"},
    {id:"history", label:"My Collections",  icon:"🚛"},
    {id:"status",  label:"Truck Health",    icon:"🛠️"},
  ];

  const routeStateProps: ActiveRouteState & ActiveRouteSetters = {
    activeOrder, activeBins, tripSummary, isRouting,
    setActiveOrder, setActiveBins, setTripSummary, setIsRouting,
  };

  const handleRouteStarted = (_bins: BinManifest[], _order: TravelOrder) => {
    // Switch to map so the driver sees the route immediately
    setActiveTab("map");
  };

  const renderContent=()=>{
    if(isLoading) return null;
    switch(activeTab){
      case "map":
        return (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <DriverMap activeBins={routeBins} hasActiveRoute={!!activeOrder}/>
            {activeOrder && (
              <div style={{
                position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",
                zIndex:1000,background:"#059669",color:"#fff",
                padding:"10px 20px",borderRadius:24,
                display:"flex",alignItems:"center",gap:10,
                boxShadow:"0 4px 20px rgba(5,150,105,.4)",
                fontFamily:"sans-serif",whiteSpace:"nowrap",
              }}>
                <span style={{fontSize:16}}>🚛</span>
                <div>
                  <div style={{fontSize:11,fontWeight:800,opacity:.75,letterSpacing:".08em",textTransform:"uppercase"}}>Active Route</div>
                  <div style={{fontSize:13,fontWeight:700}}>{activeOrder.label}</div>
                </div>
                <div style={{marginLeft:8,padding:"4px 12px",borderRadius:12,background:"rgba(255,255,255,.2)",fontSize:11,fontWeight:700}}>
                  {activeBins.filter(b=>b.collected).length}/{activeBins.length} bins
                </div>
                <button onClick={()=>setActiveTab("history")}
                  style={{marginLeft:4,padding:"4px 12px",borderRadius:12,background:"rgba(255,255,255,.9)",color:"#059669",fontSize:11,fontWeight:800,border:"none",cursor:"pointer"}}>
                  View →
                </button>
              </div>
            )}
          </div>
        );
      case "history":
        return <CollectionHistory {...routeStateProps} onRouteStarted={handleRouteStarted}/>;
      case "status":  return <TruckStatus/>;
      default:        return <DriverMap activeBins={[]} hasActiveRoute={false}/>;
    }
  };

  const currentLabel=menuItems.find(i=>i.id===activeTab)?.label??"Driver Portal";
  const isOnDuty=driverData?.driver_details?.duty_status==="ON-DUTY";

  if(isLoading) return (
    <div className="h-screen w-full flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Syncing Profile...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden">
      <style>{SLIDE_IN}</style>

      {/* Mobile overlay */}
      {isSidebarOpen&&<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden transition-opacity" onClick={()=>setIsSidebarOpen(false)}/>}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen?"translate-x-0 shadow-2xl":"-translate-x-full"}`}>
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] shadow-xl shadow-emerald-100 border border-emerald-50 overflow-hidden flex-shrink-0">
              <img src="/icons/icon-512x512.png" alt="EcoRoute Logo" className="h-full w-full object-cover p-3"/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">EcoRoute</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Driver Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Driver Menu</p>
          {menuItems.map(item=>(
            <button key={item.id} onClick={()=>{setActiveTab(item.id);setIsSidebarOpen(false);}}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[2rem] transition-all duration-200 group ${activeTab===item.id?"bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-bold":"text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
              <span className={`text-xl ${activeTab===item.id?"brightness-200":"grayscale opacity-70"}`}>{item.icon}</span>
              <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 shrink-0">
          <button onClick={()=>setShowLogoutModal(true)} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[2rem] bg-red-50 text-red-600 hover:bg-red-100 transition-all font-black text-xs uppercase tracking-widest border border-red-100">
            <span>Finish Shift</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">

        {/* ── TOPNAV — h-20 (80px) ── */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button onClick={()=>setIsSidebarOpen(true)} className="lg:hidden p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 active:scale-95 transition-transform">☰</button>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 ${isOnDuty?"text-emerald-600":"text-slate-400"}`}>
                {driverData?.driver_details?.duty_status??"OFF-DUTY"}
              </p>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{currentLabel}</h2>
            </div>
          </div>

          {/* Profile badge — opens slide-over at top:80px */}
          <button
            onClick={()=>setShowProfile(true)}
            className={`flex items-center gap-3 p-1 pr-4 rounded-full border transition-all ${showProfile?"bg-slate-900 border-slate-800":"bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200"}`}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-emerald-100 overflow-hidden border-2 border-white">
                {driverData?.avatar_url
                  ?<img src={driverData.avatar_url} alt="Profile" className="w-full h-full object-cover"/>
                  :<span className="italic">{driverData?.full_name?.charAt(0)??"D"}</span>
                }
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors duration-500 ${isOnDuty?"bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]":"bg-slate-400"}`}/>
            </div>
            <div className="text-left hidden sm:block">
              <p className={`text-[10px] font-black leading-none uppercase tracking-tighter italic ${showProfile?"text-white":"text-slate-900"}`}>{driverData?.full_name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{driverData?.driver_details?.vehicle_plate_number??"NO TRUCK"}</p>
                <div className="w-1 h-1 rounded-full bg-slate-200"/>
                <p className="text-[8px] text-emerald-600 font-black uppercase tracking-wider">{driverData?.driver_details?.assigned_route??"NO ROUTE"}</p>
              </div>
            </div>
          </button>
        </header>

        <div className={`flex-1 relative w-full h-full ${activeTab==="map"?"overflow-hidden":"overflow-y-auto p-6 lg:p-10"}`}>
          {renderContent()}
        </div>
      </main>

      {/* Driver Profile Panel — top:80px */}
      {showProfile&&driverData&&(
        <DriverProfilePanel
          driverData={driverData}
          onClose={()=>setShowProfile(false)}
          onRefresh={refreshDriverData}
        />
      )}

      {/* Logout modal */}
      {showLogoutModal&&(
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={()=>!isLoggingOut&&setShowLogoutModal(false)}/>
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl">
            <div className="text-center">
              <span className="text-5xl block mb-4">🏠</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Finish Shift?</h2>
              <p className="text-sm text-slate-500 mb-8">This marks your route as completed and clocks you out.</p>
              <div className="space-y-3">
                <button onClick={handleLogout} disabled={isLoggingOut} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50">
                  {isLoggingOut?"Ending Shift...":"Confirm & Logout"}
                </button>
                <button onClick={()=>setShowLogoutModal(false)} disabled={isLoggingOut} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all disabled:opacity-50">
                  Stay on Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}