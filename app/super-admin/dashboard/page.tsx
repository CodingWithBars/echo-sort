"use client";
// app/super-admin/dashboard/page.tsx — Sidebar layout + SuperAdminProfilePanel

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Shield, Users, Truck, Building2, Trash2,
  AlertTriangle, Search, LogOut, RefreshCw,
  MoreHorizontal, Archive, ChevronDown, Terminal,
  CheckCircle, MapPin, X, Bell, ChevronRight,
  ArchiveRestore, UserCog, Menu, BarChart3,
  Layers, Database, Settings, Calendar,
  Megaphone, Flag, TrendingUp, Info, Mail,
  ArrowUpRight
} from "lucide-react";

const supabase = createClient();

type UserRole = "SUPER_ADMIN"|"ADMIN"|"DRIVER"|"LGU"|"CITIZEN";
interface SystemUser{id:string;full_name:string;email:string;role:UserRole;is_archived:boolean;warning_count:number;updated_at:string;barangay?:string;municipality?:string;duty_status?:string;employment_status?:string;license_number?:string;vehicle_plate_number?:string;position_title?:string;}
interface CitizenRecord{id:string;full_name:string;email:string;contact_number:string;warning_count:number;is_archived:boolean;barangay:string;purok:string;address_street:string;municipality:string;service_type:string;created_at:string;violations?:ViolationRecord[];score?:number;}
interface ViolationRecord{id:string;type:string;description:string;status:"Pending"|"Under Review"|"Resolved";created_at:string;resolved_at:string|null;}
interface AuditEntry{id:string;admin_id:string;action_type:string;target_id:string;reason:string;created_at:string;admin_name?:string;}
interface DBNotif{id:string;type:string;title:string;body:string;is_read:boolean;created_at:string;metadata?:any;}
interface SystemStat{totalUsers:number;totalAdmins:number;totalDrivers:number;totalLGU:number;totalCitizens:number;totalBins:number;criticalBins:number;highBins:number;pendingViolations:number;totalCollections:number;archivedUsers:number;onDutyDrivers:number;totalBroadcasts:number;totalReports:number;pendingReports:number;totalSchedules:number;}
interface Setting{key:string;value:any;description:string;is_public:boolean;}

const ROLE_CONFIG:Record<UserRole,{label:string;color:string;bg:string;darkBg:string;icon:any}>={SUPER_ADMIN:{label:"Super Admin",color:"#1d412e",bg:"#e6f0eb",darkBg:"#e6f0eb",icon:Shield},ADMIN:{label:"Admin",color:"#276749",bg:"#e6f0eb",darkBg:"#e6f0eb",icon:Building2},DRIVER:{label:"Driver",color:"#38a169",bg:"#e6f0eb",darkBg:"#e6f0eb",icon:Truck},LGU:{label:"LGU",color:"#d97706",bg:"#fef3c7",darkBg:"#fef3c7",icon:MapPin},CITIZEN:{label:"Citizen",color:"#4b5563",bg:"#f3f4f6",darkBg:"#f3f4f6",icon:Users}};
const VIOLATION_STATUS:Record<string,{dot:string;text:string;bg:string}>={"Pending":{dot:"#d97706",text:"#b45309",bg:"#fef3c7"},"Under Review":{dot:"#2563eb",text:"#1d4ed8",bg:"#dbeafe"},"Resolved":{dot:"#059669",text:"#047857",bg:"#d1fae5"}};
const timeAgo=(iso:string)=>{if(!iso)return"—";const diff=Date.now()-new Date(iso).getTime(),m=Math.floor(diff/60000);if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);if(d<30)return`${d}d ago`;return new Date(iso).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});};
const fmtDate=(iso:string)=>iso?new Date(iso).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}):"—";
const fmtFull=(iso:string)=>new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
const scoreColor=(s:number)=>s>=90?"#059669":s>=70?"#38a169":s>=50?"#d97706":s>=30?"#ea580c":"#dc2626";

const SLIDE_IN_STYLE=`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`;

function StatCard({label,value,sub,delay=0,isPrimary=false}:{label:string;value:string|number;sub?:string;delay?:number;isPrimary?:boolean}){
  const bg = isPrimary ? '#1c4532' : '#ffffff';
  const textColor = isPrimary ? '#ffffff' : '#111827';
  const subColor = isPrimary ? '#8bc5a3' : '#6b7280';
  const arrowBg = isPrimary ? '#ffffff' : '#ffffff';
  const arrowColor = isPrimary ? '#1c4532' : '#1c4532';
  const arrowBorder = isPrimary ? 'none' : '1px solid #e5e7eb';

  return(
    <div style={{background:bg,borderRadius:24,padding:"24px",display:"flex",flexDirection:"column",gap:16,animation:`fadeUp .5s ease ${delay}s both`,position:"relative",boxShadow:isPrimary?"0 10px 25px rgba(28,69,50,0.2)":"0 4px 15px rgba(0,0,0,0.03)",border:isPrimary?"none":"1px solid #f3f4f6"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div style={{fontSize:15,fontWeight:600,color:textColor,fontFamily:"sans-serif"}}>{label}</div>
        <div style={{width:32,height:32,borderRadius:"50%",background:arrowBg,border:arrowBorder,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isPrimary?"":"0 2px 5px rgba(0,0,0,0.05)"}}>
          <ArrowUpRight size={16} style={{color:arrowColor}}/>
        </div>
      </div>
      <div>
        <div style={{fontSize:38,fontWeight:700,color:textColor,lineHeight:1.1,fontFamily:"sans-serif",letterSpacing:"-0.02em"}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:subColor,marginTop:10,display:"flex",alignItems:"center",gap:6}}>
          <div style={{padding:"2px 6px",borderRadius:6,background:isPrimary?"rgba(255,255,255,0.1)":"#e6f0eb",color:isPrimary?"#fff":"#1c4532",fontSize:10,fontWeight:700}}>↑</div>
          {sub}
        </div>}
      </div>
    </div>
  );
}

function RoleBadge({role}:{role:UserRole}){const cfg=ROLE_CONFIG[role]??ROLE_CONFIG.CITIZEN,Icon=cfg.icon;return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,background:cfg.bg,color:cfg.color,whiteSpace:"nowrap"}}><Icon size={12}/>{cfg.label}</span>;}

const menuItemStyle:React.CSSProperties={display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",border:"none",background:"transparent",fontSize:12,cursor:"pointer",borderRadius:8,textAlign:"left",fontFamily:"sans-serif",color:"#374151",transition:"background .12s"};
const dividerStyle:React.CSSProperties={height:1,background:"#f3f4f6",margin:"4px 0"};

function ActionMenu({user,meId,onArchive,onRole,onAssign,onNotify}:{user:SystemUser;meId:string;onArchive:(id:string,cur:boolean)=>void;onRole:(id:string,r:UserRole)=>void;onAssign:(u:SystemUser)=>void;onNotify:(u:SystemUser)=>void}){const[open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);useEffect(()=>{if(!open)return;const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);if(user.id===meId)return<span style={{fontSize:12,color:"#9ca3af"}}>—</span>;const roles:UserRole[]=(["ADMIN","DRIVER","LGU","CITIZEN"] as UserRole[]).filter(r=>r!==user.role);return(<div ref={ref} style={{position:"relative",display:"inline-block"}}><button onClick={()=>setOpen(o=>!o)} style={{background:open?"#e6f0eb":"#f9fafb",border:`1px solid ${open?"#a3d4bb":"#e5e7eb"}`,borderRadius:8,padding:"6px 10px",color:open?"#1c4532":"#4b5563",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,transition:"all .15s"}}><MoreHorizontal size={14}/><ChevronDown size={11} style={{transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}/></button>{open&&(<div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:12,padding:6,minWidth:220,zIndex:500,boxShadow:"0 10px 30px rgba(0,0,0,.08)",animation:"dropIn .15s ease both"}}>{user.role==="LGU"&&(<><button onClick={()=>{onAssign(user);setOpen(false);}} style={{...menuItemStyle,color:"#b45309"}}><MapPin size={13} color="#d97706"/><span style={{flex:1}}>{user.barangay?"Update Barangay":"Assign Barangay"}</span>{!user.barangay&&<span style={{fontSize:9,fontWeight:800,background:"#fef3c7",color:"#d97706",padding:"2px 6px",borderRadius:8}}>PENDING</span>}</button><div style={dividerStyle}/></>)}<button onClick={()=>{onNotify(user);setOpen(false);}} style={{...menuItemStyle,color:"#1d4ed8"}}><Bell size={13} color="#2563eb"/>Send Notification</button><div style={dividerStyle}/><div style={{padding:"4px 8px 2px",fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>Change Role</div>{roles.map(r=>{const RIcon=ROLE_CONFIG[r].icon;return(<button key={r} onClick={()=>{onRole(user.id,r);setOpen(false);}} style={{...menuItemStyle,color:"#374151"}}><RIcon size={13} color={ROLE_CONFIG[r].color}/>Set as {ROLE_CONFIG[r].label}</button>);})}<div style={dividerStyle}/><button onClick={()=>{onArchive(user.id,user.is_archived);setOpen(false);}} style={{...menuItemStyle,color:user.is_archived?"#059669":"#dc2626"}}>{user.is_archived?<ArchiveRestore size={13}/>:<Archive size={13}/>}{user.is_archived?"Restore account":"Archive account"}</button></div>)}</div>);}

function PromoteMenu({citizen,onRole}:{citizen:CitizenRecord;onRole:(id:string,r:UserRole)=>void}){const[open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);useEffect(()=>{if(!open)return;const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);const roles:UserRole[]=["ADMIN","DRIVER","LGU"];return(<div ref={ref} onClick={e=>e.stopPropagation()} style={{position:"relative",display:"inline-block"}}><button onClick={()=>setOpen(o=>!o)} style={{background:open?"#e6f0eb":"#f9fafb",border:`1px solid ${open?"#a3d4bb":"#e5e7eb"}`,borderRadius:8,padding:"5px 9px",color:open?"#1c4532":"#4b5563",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:11,transition:"all .15s"}}>Promote <ChevronDown size={11} style={{transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}/></button>{open&&(<div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:12,padding:6,minWidth:160,zIndex:500,boxShadow:"0 10px 30px rgba(0,0,0,.08)",animation:"dropIn .15s ease both"}}><div style={{padding:"4px 8px 2px",fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>Promote to</div>{roles.map(r=>{const RIcon=ROLE_CONFIG[r].icon;return(<button key={r} onClick={()=>{onRole(citizen.id,r);setOpen(false);}} style={{...menuItemStyle}}><RIcon size={13} color={ROLE_CONFIG[r].color}/>{ROLE_CONFIG[r].label}</button>);})}</div>)}</div>);}
function CitizenRow({c,lguMap,onRole}:{c:CitizenRecord;lguMap:Record<string,string>;onRole:(id:string,r:UserRole)=>void}){const[expanded,setExpanded]=useState(false);const vcount=c.violations?.length??0,pendingV=c.violations?.filter(v=>v.status==="Pending").length??0;return(<><tr className="row-hover" onClick={()=>vcount>0&&setExpanded(e=>!e)} style={{borderBottom:expanded?"none":"1px solid #f3f4f6",background:"#ffffff",cursor:vcount>0?"pointer":"default"}}><td style={{padding:"14px 16px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:"50%",background:c.is_archived?"#f1f5f9":"#e6f0eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:c.is_archived?"#94a3b8":"#1c4532",flexShrink:0}}>{(c.full_name??"?").charAt(0).toUpperCase()}</div><div><div style={{fontSize:13,fontWeight:600,color:c.is_archived?"#9ca3af":"#111827",textDecoration:c.is_archived?"line-through":"none"}}>{c.full_name??"—"}</div><div style={{fontSize:12,color:"#6b7280"}}>{c.email}</div></div></div></td><td style={{padding:"14px 16px"}}><div style={{fontSize:13,fontWeight:500,color:"#111827"}}>{c.barangay??"—"}</div><div style={{fontSize:12,color:"#6b7280"}}>{c.municipality??""}</div></td><td style={{padding:"14px 16px"}}><div style={{fontSize:13,color:"#374151"}}>{c.purok??"—"}</div><div style={{fontSize:12,color:"#6b7280"}}>{c.address_street??""}</div></td><td style={{padding:"14px 16px"}}>{lguMap[c.barangay??""]?<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:"#10b981"}}/><span style={{fontSize:13,color:"#111827"}}>{lguMap[c.barangay??""]}</span></div>:<span style={{fontSize:12,color:"#9ca3af"}}>Unassigned</span>}</td><td style={{padding:"14px 16px"}}><span style={{fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:20,background:c.warning_count>=3?"#fee2e2":c.warning_count>0?"#fef3c7":"#e6f0eb",color:c.warning_count>=3?"#dc2626":c.warning_count>0?"#d97706":"#1c4532"}}>{c.warning_count} warning{c.warning_count!==1?"s":""}</span></td><td style={{padding:"14px 16px"}}><span style={{fontSize:14,fontWeight:700,color:scoreColor(c.score??100)}}>{c.score??100}</span><span style={{fontSize:11,color:"#9ca3af"}}>/100</span></td><td style={{padding:"14px 16px"}}>{vcount>0?<div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:20,background:pendingV>0?"#fef3c7":"#e6f0eb",color:pendingV>0?"#d97706":"#1c4532"}}>{vcount} {vcount===1?"case":"cases"}</span>{pendingV>0&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#fee2e2",color:"#dc2626"}}>{pendingV} pending</span>}</div>:<span style={{fontSize:12,color:"#6b7280"}}>None</span>}</td><td style={{padding:"14px 16px"}}><span style={{fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:20,background:c.is_archived?"#f1f5f9":"#e6f0eb",color:c.is_archived?"#64748b":"#1c4532"}}>{c.is_archived?"Archived":"Active"}</span></td><td style={{padding:"14px 16px"}}><PromoteMenu citizen={c} onRole={onRole}/></td><td style={{padding:"14px 14px",textAlign:"center"}}>{vcount>0&&<ChevronRight size={16} color="#9ca3af" style={{transform:expanded?"rotate(90deg)":"none",transition:"transform .15s"}}/>}</td></tr>{expanded&&vcount>0&&(<tr style={{borderBottom:"1px solid #e5e7eb"}}><td colSpan={10} style={{padding:0,background:"#f9fafb"}}><div style={{padding:"16px 20px 20px 68px",borderTop:"1px solid #f3f4f6"}}><div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:".05em",textTransform:"uppercase",marginBottom:12}}>Violation History · {c.full_name}</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{c.violations!.map(v=>{const sc=VIOLATION_STATUS[v.status]??VIOLATION_STATUS.Pending;return(<div key={v.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,background:"#fff",border:`1px solid ${sc.bg}`}}><div style={{width:8,height:8,borderRadius:"50%",background:sc.dot,flexShrink:0}}/><span style={{fontSize:12,fontWeight:600,color:sc.text,minWidth:120}}>{v.type.replace(/_/g," ")}</span><span style={{fontSize:12,color:"#4b5563",flex:1}}>{v.description??"No description"}</span><span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap"}}>{fmtDate(v.created_at)}</span><span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:sc.bg,color:sc.text}}>{v.status}</span></div>);})}</div></div></td></tr>)}</>);}


// ─── SUPER ADMIN PROFILE PANEL ───────────────────────────────────────────────

type SALogEntry = { id:string; action_type:string; reason:string; created_at:string; };

function SuperAdminProfilePanel({meId,meName,onClose}:{meId:string;meName:string;onClose:()=>void}) {
  const [tab,        setTab]        = useState<"profile"|"security"|"activity">("profile");
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [saveErr,    setSaveErr]    = useState("");
  const [avatarUrl,  setAvatarUrl]  = useState<string|null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [editData,   setEditData]   = useState({ full_name: meName });
  const [email,      setEmail]      = useState("");
  const [pwForm,     setPwForm]     = useState({next:"",confirm:""});
  const [showPw,     setShowPw]     = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwOk,       setPwOk]       = useState(false);
  const [pwErr,      setPwErr]      = useState("");
  const [logs,       setLogs]       = useState<SALogEntry[]>([]);
  const [logsLoading,setLogsLoading]= useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{
    supabase.from("profiles").select("email, avatar_url").eq("id",meId).single().then((res: any)=>{
      if(res.data){ setEmail(res.data.email??""); setAvatarUrl(res.data.avatar_url); }
    });
  },[meId]);
  useEffect(()=>{
    if(tab==="activity"&&logs.length===0){
      setLogsLoading(true);
      supabase.from("audit_logs").select("*").eq("admin_id",meId).order("created_at",{ascending:false}).limit(50)
        .then(({data}: any)=>setLogs(data??[])).finally(()=>setLogsLoading(false));
    }
  },[tab,meId,logs.length]);

  const initials = meName?meName.charAt(0).toUpperCase():"?";
  const INP:React.CSSProperties = {width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #d1d5db",background:"#f9fafb",color:"#111827",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"};
  const saveProfile = async() => {
    if(!editData.full_name.trim()){ setSaveErr("Name required."); return; }
    setSaving(true); setSaveErr(""); setSaveOk(false);
    const {error} = await supabase.from("profiles").update({full_name:editData.full_name.trim()}).eq("id",meId);
    if(error) setSaveErr(error.message);
    else { setSaveOk(true); setTimeout(()=>setEditing(false),1500); }
    setSaving(false);
  };
  const changePassword = async() => {
    setPwErr(""); setPwOk(false);
    if(pwForm.next.length<8){ setPwErr("Min 8 chars."); return; }
    if(pwForm.next!==pwForm.confirm){ setPwErr("Mismatch."); return; }
    setPwSaving(true);
    const {error} = await supabase.auth.updateUser({password:pwForm.next});
    if(error) setPwErr(error.message); else { setPwOk(true); setPwForm({next:"",confirm:""}); }
    setPwSaving(false);
  };
  const handleAvatar = async(e:React.ChangeEvent<HTMLInputElement>) => {
    if(!e.target.files||!e.target.files[0])return;
    const f=e.target.files[0]; setUploading(true);
    const ext=f.name.split('.').pop(); const path=`${meId}/avatar_${Date.now()}.${ext}`;
    const {error:uErr}=await supabase.storage.from("avatars").upload(path,f,{upsert:true});
    if(!uErr){
      const {data:{publicUrl}}=supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({avatar_url:publicUrl}).eq("id",meId);
      setAvatarUrl(publicUrl);
    }
    setUploading(false);
  };

  const actionIcon=(act:string)=>{
    if(act.includes("LOGIN")) return {i:"🔓",c:"#10b981"};
    if(act.includes("LOGOUT")) return {i:"🔒",c:"#64748b"};
    if(act.includes("ROLE")||act.includes("BARANGAY")) return {i:"⚙️",c:"#3b82f6"};
    if(act.includes("ARCHIVE")) return {i:"📦",c:"#f59e0b"};
    return {i:"📝",c:"#8b5cf6"};
  };
  const TABS = [
    {id:"profile", label:"Profile", icon:"👤"},
    {id:"security",label:"Security",icon:"🛡️"},
    {id:"activity",label:"Activity",icon:"📋"}
  ];

  return (
    <>
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:2000,backdropFilter:"blur(2px)"}} onClick={onClose}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:"100%",maxWidth:420,background:"#ffffff",zIndex:2001,boxShadow:"-10px 0 40px rgba(0,0,0,.1)",display:"flex",flexDirection:"column",animation:"slideInRight .3s cubic-bezier(0.16, 1, 0.3, 1) both"}}>
        <div style={{padding:"24px",borderBottom:"1px solid #f3f4f6",background:"#f9fafb",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <span style={{fontSize:13,fontWeight:700,color:"#1c4532",letterSpacing:".05em",textTransform:"uppercase"}}>My Profile</span>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16} color="#6b7280"/></button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:80,height:80,borderRadius:24,background:avatarUrl?"#f3f4f6":"#e6f0eb",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:"2px solid #a3d4bb"}}>
                {avatarUrl?<img src={avatarUrl} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:28,fontWeight:700,color:"#1c4532"}}>{initials}</span>}
                {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(255,255,255,.8)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:20,height:20,borderRadius:"50%",border:"2px solid #1c4532",borderTopColor:"transparent",animation:"spin 1s linear infinite"}}/></div>}
              </div>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{position:"absolute",bottom:-4,right:-4,width:28,height:28,borderRadius:8,background:"#1c4532",border:"2px solid #fff",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}} title="Change photo">📷</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:18,fontWeight:700,color:"#111827"}}>{meName}</div>
              <div style={{fontSize:13,color:"#1c4532",marginTop:2,fontWeight:500}}>Super Administrator</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>{email}</div>
            </div>
          </div>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",flexShrink:0,background:"#fff"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as any)} style={{flex:1,padding:"14px 0",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:13,fontWeight:tab===t.id?600:500,color:tab===t.id?"#1c4532":"#6b7280",borderBottom:tab===t.id?"2px solid #1c4532":"2px solid transparent",transition:"all .15s",fontFamily:"sans-serif"}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"24px",display:"flex",flexDirection:"column",gap:16,background:"#f9fafb"}}>
          {tab==="profile"&&(<>
            {!editing?(
              <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px",borderBottom:"1px solid #f3f4f6"}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#4b5563",textTransform:"uppercase"}}>Account Details</span>
                  <button onClick={()=>setEditing(true)} style={{fontSize:12,fontWeight:600,padding:"6px 14px",borderRadius:8,background:"#f3f4f6",color:"#1c4532",border:"none",cursor:"pointer"}}>Edit</button>
                </div>
                <div style={{padding:"16px",display:"grid",gridTemplateColumns:"1fr",gap:12}}>
                  {[{l:"Full Name",v:meName},{l:"Email",v:email},{l:"Role",v:"Super Administrator"}].map(f=>(
                    <div key={f.l} style={{background:"#f9fafb",borderRadius:12,padding:"12px 16px",border:"1px solid #f3f4f6"}}>
                      <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",textTransform:"uppercase",marginBottom:4}}>{f.l}</div>
                      <div style={{fontSize:14,fontWeight:500,color:"#111827"}}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden"}}>
                <div style={{padding:"16px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb"}}><span style={{fontSize:12,fontWeight:700,color:"#4b5563",textTransform:"uppercase"}}>Edit Profile</span></div>
                <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase",display:"block",marginBottom:6}}>Full Name</label>
                    <input value={editData.full_name} onChange={e=>setEditData({full_name:e.target.value})} style={INP}/>
                  </div>
                  <div style={{padding:"12px",borderRadius:10,background:"#f3f4f6",border:"1px solid #e5e7eb",fontSize:12,color:"#6b7280"}}>Email can only be changed through Supabase Auth settings.</div>
                  {saveErr&&<div style={{padding:"10px 14px",borderRadius:10,background:"#fee2e2",border:"1px solid #fca5a5",fontSize:12,color:"#dc2626"}}>{saveErr}</div>}
                  <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
                    <button onClick={()=>{setEditing(false);setSaveErr("");}} style={{padding:"10px 16px",borderRadius:10,border:"1px solid #e5e7eb",background:"#fff",color:"#4b5563",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                    <button onClick={saveProfile} disabled={saving||saveOk} style={{padding:"10px 20px",borderRadius:10,background:saveOk?"#059669":"#1c4532",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                      {saving?"Saving…":saveOk?"✓ Saved!":"Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>)}

          {tab==="security"&&(<>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden"}}>
              <div style={{padding:"16px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb"}}><span style={{fontSize:12,fontWeight:700,color:"#4b5563",textTransform:"uppercase"}}>Change Password</span></div>
              <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
                {([{label:"New Password",key:"next",ph:"Min. 8 characters"},{label:"Confirm Password",key:"confirm",ph:"Re-enter password"}] as const).map(f=>(
                  <div key={f.key}>
                    <label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase",display:"block",marginBottom:6}}>{f.label}</label>
                    <input type={showPw?"text":"password"} value={pwForm[f.key]} onChange={e=>setPwForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph} style={INP} onKeyDown={e=>e.key==="Enter"&&changePassword()}/>
                  </div>
                ))}
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#4b5563",userSelect:"none"}}>
                  <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)} style={{accentColor:"#1c4532",cursor:"pointer",width:16,height:16}}/>Show passwords
                </label>
                {pwErr&&<div style={{padding:"10px 14px",borderRadius:10,background:"#fee2e2",border:"1px solid #fca5a5",fontSize:12,color:"#dc2626"}}>{pwErr}</div>}
                {pwOk&&<div style={{padding:"10px 14px",borderRadius:10,background:"#d1fae5",border:"1px solid #6ee7b7",fontSize:12,color:"#059669",fontWeight:500}}>Password updated.</div>}
                <button onClick={changePassword} disabled={pwSaving||!pwForm.next||!pwForm.confirm} style={{padding:"12px 0",borderRadius:10,background:"#1c4532",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",opacity:(!pwForm.next||!pwForm.confirm||pwSaving)?.5:1}}>
                  {pwSaving?"Updating…":"Update Password"}
                </button>
              </div>
            </div>
          </>)}

          {tab==="activity"&&(<>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden"}}>
              <div style={{padding:"16px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:12,fontWeight:700,color:"#4b5563",textTransform:"uppercase"}}>Recent Activity</span>
              </div>
              {logsLoading?<div style={{padding:32,textAlign:"center",color:"#6b7280",fontSize:13}}>Loading…</div>
              :logs.length===0?<div style={{padding:32,textAlign:"center",color:"#6b7280",fontSize:13}}>No activity yet.</div>
              :<div>{logs.map((l,i)=>{const {i:icon,c:col}=actionIcon(l.action_type??"");return(
                <div key={l.id??i} style={{padding:"14px 16px",borderBottom:"1px solid #f3f4f6",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:`${col}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#111827"}}>
                      {(l.action_type??"").replace(/_/g," ")}
                    </div>
                    <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.4}}>{l.reason||"—"}</div>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>{fmtFull(l.created_at)}</div>
                  </div>
                </div>
              );})}</div>}
            </div>
          </>)}
        </div>
      </div>
    </>
  );
}


function AssignBarangayModal({user,meId,onClose,onSuccess}:{user:SystemUser;meId:string;onClose:()=>void;onSuccess:()=>void}){const[barangay,setBarangay]=useState(user.barangay??"");const[municipality,setMunicipality]=useState(user.municipality??"");const[position,setPosition]=useState(user.position_title??"");const[empStatus,setEmpStatus]=useState(user.employment_status??"ACTIVE");const[saving,setSaving]=useState(false);const[error,setError]=useState<string|null>(null);const[success,setSuccess]=useState(false);const inp:React.CSSProperties={padding:"10px 14px",borderRadius:10,border:"1px solid #d1d5db",background:"#f9fafb",color:"#111827",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};const save=async()=>{setError(null);if(!barangay.trim())return setError("Barangay is required.");setSaving(true);try{const{data:ex}=await supabase.from("lgu_details").select("id").eq("id",user.id).single();const payload={barangay:barangay.trim(),municipality:municipality.trim()||null,position_title:position.trim()||null,employment_status:empStatus};if(ex){const{error:e}=await supabase.from("lgu_details").update(payload).eq("id",user.id);if(e)throw e;}else{const{error:e}=await supabase.from("lgu_details").insert({id:user.id,...payload});if(e)throw e;}await supabase.from("audit_logs").insert({admin_id:meId,action_type:"ASSIGN_BARANGAY",target_id:user.id,reason:`Assigned barangay "${barangay.trim()}" to ${user.email}`});await supabase.from("notifications").insert({user_id:user.id,type:"SYSTEM",title:"Barangay Assigned",body:`You have been assigned to Barangay ${barangay.trim()}${municipality?`, ${municipality}`:""}. You may now access your LGU dashboard.`,created_by:meId});setSuccess(true);setTimeout(()=>{onSuccess();onClose();},800);}catch(e:any){setError(e.message??"Error.");}finally{setSaving(false);}};return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(2px)"}}><div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",borderRadius:24,border:"1px solid #e5e7eb",width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.1)",animation:"fadeUp .2s ease both",overflow:"hidden"}}><div style={{background:"#f9fafb",padding:"20px 24px",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:44,height:44,borderRadius:12,background:"#fef3c7",display:"flex",alignItems:"center",justifyContent:"center"}}><MapPin size={20} color="#d97706"/></div><div><div style={{fontSize:16,fontWeight:700,color:"#111827"}}>{user.barangay?"Update Barangay":"Assign Barangay"}</div><div style={{fontSize:12,color:"#6b7280"}}>{user.full_name??user.email}</div></div></div><button onClick={onClose} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:8,cursor:"pointer",display:"flex"}}><X size={16} color="#6b7280"/></button></div>{user.barangay&&<div style={{margin:"16px 24px 0",padding:"12px 16px",borderRadius:12,background:"#fef3c7",border:"1px solid #fde68a",display:"flex",alignItems:"center",gap:10}}><MapPin size={14} color="#d97706"/><span style={{fontSize:13,color:"#92400e"}}>Current: <strong>{user.barangay}{user.municipality?`, ${user.municipality}`:""}</strong></span></div>}<div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>{[{label:"Barangay",req:true,val:barangay,set:setBarangay,ph:"e.g. Barangay Poblacion"},{label:"Municipality",val:municipality,set:setMunicipality,ph:"e.g. Mati City"},{label:"Position Title",val:position,set:setPosition,ph:"e.g. Barangay Captain"}].map(f=>(<div key={f.label} style={{display:"flex",flexDirection:"column",gap:6}}><label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase"}}>{f.label} {(f as any).req&&<span style={{color:"#ef4444"}}>*</span>}</label><input placeholder={f.ph} value={f.val} onChange={e=>f.set(e.target.value)} style={inp}/></div>))}<div style={{display:"flex",flexDirection:"column",gap:6}}><label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase"}}>Status</label><select value={empStatus} onChange={e=>setEmpStatus(e.target.value)} style={{...inp,cursor:"pointer"}}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ON_LEAVE">On Leave</option></select></div>{error&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#dc2626",display:"flex",gap:8,alignItems:"center"}}><AlertTriangle size={14}/>{error}</div>}{success&&<div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#059669",display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={14}/>Saved! LGU notified.</div>}</div><div style={{display:"flex",justifyContent:"flex-end",gap:12,padding:"16px 24px",borderTop:"1px solid #e5e7eb",background:"#f9fafb"}}><button onClick={onClose} style={{padding:"10px 18px",borderRadius:10,border:"1px solid #d1d5db",background:"#fff",color:"#4b5563",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button><button onClick={save} disabled={saving||success} style={{padding:"10px 24px",borderRadius:10,border:"none",background:success?"#059669":"#1c4532",color:"#fff",fontSize:13,fontWeight:600,cursor:saving||success?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8}}>{saving?"Saving…":success?"Saved!":"Assign"}</button></div></div></div>);}

function SendNotifModal({user,meId,onClose}:{user:SystemUser;meId:string;onClose:()=>void}){const[title,setTitle]=useState("");const[body,setBody]=useState("");const[type,setType]=useState("SYSTEM");const[saving,setSaving]=useState(false);const[success,setSuccess]=useState(false);const inp:React.CSSProperties={padding:"10px 14px",borderRadius:10,border:"1px solid #d1d5db",background:"#f9fafb",color:"#111827",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};const send=async()=>{if(!title||!body)return;setSaving(true);await supabase.from("notifications").insert({user_id:user.id,type,title:title.trim(),body:body.trim(),created_by:meId,metadata:{sent_by_super_admin:true}});await supabase.from("audit_logs").insert({admin_id:meId,action_type:"SUPER_ADMIN_NOTIFY",target_id:user.id,reason:`Notification sent: "${title}"`});setSuccess(true);setSaving(false);setTimeout(onClose,1200);};return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(2px)"}}><div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",borderRadius:24,border:"1px solid #e5e7eb",width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.1)",animation:"fadeUp .2s ease both",overflow:"hidden"}}><div style={{background:"#f9fafb",padding:"20px 24px",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:44,height:44,borderRadius:12,background:"#dbeafe",display:"flex",alignItems:"center",justifyContent:"center"}}><Bell size={20} color="#2563eb"/></div><div><div style={{fontSize:16,fontWeight:700,color:"#111827"}}>Send Notification</div><div style={{fontSize:12,color:"#6b7280"}}>To: {user.full_name??user.email}</div></div></div><button onClick={onClose} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:8,cursor:"pointer",display:"flex"}}><X size={16} color="#6b7280"/></button></div><div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}><div><label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase",display:"block",marginBottom:6}}>Type</label><select value={type} onChange={e=>setType(e.target.value)} style={{...inp,cursor:"pointer"}}>{["SYSTEM","ROLE_CHANGED","ACCOUNT_ARCHIVED","ACCOUNT_RESTORED"].map(t=><option key={t}>{t}</option>)}</select></div><div><label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase",display:"block",marginBottom:6}}>Title *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Notification title" style={inp}/></div><div><label style={{fontSize:11,fontWeight:600,color:"#4b5563",textTransform:"uppercase",display:"block",marginBottom:6}}>Message *</label><textarea value={body} onChange={e=>setBody(e.target.value)} rows={4} placeholder="Message body…" style={{...inp,resize:"none",lineHeight:1.5}}/></div>{success&&<div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#059669",display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={14}/>Sent successfully!</div>}</div><div style={{display:"flex",justifyContent:"flex-end",gap:12,padding:"16px 24px",borderTop:"1px solid #e5e7eb",background:"#f9fafb"}}><button onClick={onClose} style={{padding:"10px 18px",borderRadius:10,border:"1px solid #d1d5db",background:"#fff",color:"#4b5563",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button><button onClick={send} disabled={!title||!body||saving||success} style={{padding:"10px 24px",borderRadius:10,border:"none",background:"#1c4532",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8,opacity:(!title||!body)?.5:1}}>{saving?"Sending...":"Send Notification"}</button></div></div></div>);}

export default function Page() {
  const router=useRouter();
  const[meId,setMeId]=useState("");
  const[meName,setMeName]=useState("Super Admin");
  const[email,setEmail]=useState("");
  const[stats,setStats]=useState<SystemStat|null>(null);
  const[users,setUsers]=useState<SystemUser[]>([]);
  const[citizens,setCitizens]=useState<CitizenRecord[]>([]);
  const[lguMap,setLguMap]=useState<Record<string,string>>({});
  const[auditLogs,setAuditLogs]=useState<AuditEntry[]>([]);
  const[notifs,setNotifs]=useState<DBNotif[]>([]);
  const[settings,setSettings]=useState<Setting[]>([]);
  const[loading,setLoading]=useState(true);
  const[activeTab,setActiveTab]=useState<"users"|"citizens"|"audit"|"system"|"settings">("system");
  const[search,setSearch]=useState("");
  const[roleFilter,setRoleFilter]=useState("all");
  const[citizenFilter,setCitizenFilter]=useState("all");
  const[processing,setProcessing]=useState<string|null>(null);
  const[assignTarget,setAssignTarget]=useState<SystemUser|null>(null);
  const[notifyTarget,setNotifyTarget]=useState<SystemUser|null>(null);
  const[isSidebarOpen,setIsSidebarOpen]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[showLogout,setShowLogout]=useState(false);
  const[isLoggingOut,setIsLoggingOut]=useState(false);
  const[notifOpen,setNotifOpen]=useState(false);
  const[editingKey,setEditingKey]=useState<string|null>(null);
  const[editingVal,setEditingVal]=useState("");
  const notifRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{if(!notifOpen)return;const h=(e:MouseEvent)=>{if(notifRef.current&&!notifRef.current.contains(e.target as Node))setNotifOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[notifOpen]);

  const fetchData=useCallback(async()=>{
    const{data:{user}}=await supabase.auth.getUser();
    if(!user){router.push("/login");return;}
    setMeId(user.id);
    const{data:me}=await supabase.from("profiles").select("full_name, email").eq("id",user.id).single();
    if(me){setMeName(me.full_name??"Super Admin");setEmail(me.email??"");}
    if(!sessionStorage.getItem("sa_login_"+user.id)){sessionStorage.setItem("sa_login_"+user.id,"1");try{await supabase.from("audit_logs").insert({admin_id:user.id,action_type:"SUPER_ADMIN_LOGIN",target_id:user.id,reason:`Session started at ${new Date().toLocaleString("en-PH")}`});}catch(_){}}
    const{data:profiles}=await supabase.from("profiles").select("id,full_name,email,role,is_archived,warning_count,updated_at").in("role",["SUPER_ADMIN","ADMIN","DRIVER","LGU"]).order("role").order("full_name");
    const{data:driverD}=await supabase.from("driver_details").select("id,duty_status,employment_status,license_number,vehicle_plate_number");
    const{data:lguD}=await supabase.from("lgu_details").select("id,barangay,municipality,employment_status,position_title");
    const driverMap=Object.fromEntries((driverD??[]).map((d:any)=>[d.id,d]));const lguDMap=Object.fromEntries((lguD??[]).map((l:any)=>[l.id,l]));
    setUsers((profiles??[]).map((p:any)=>({...p,...(driverMap[p.id]??{}),...(lguDMap[p.id]??{})})));
    const bToLGU:Record<string,string>={};(lguD??[]).forEach((l:any)=>{if(l.barangay){const lp=(profiles??[]).find((p:any)=>p.id===l.id);if(lp)bToLGU[l.barangay]=lp.full_name??"LGU";}});setLguMap(bToLGU);
    const{data:cProfiles}=await supabase.from("profiles").select("id,full_name,email,contact_number,warning_count,is_archived").eq("role","CITIZEN").order("full_name");
    const{data:cDetails}=await supabase.from("citizen_details").select("id,barangay,purok,address_street,municipality,service_type,created_at");
    const{data:allViol}=await supabase.from("violations").select("id,citizen_id,type,description,status,created_at,resolved_at").order("created_at",{ascending:false});
    const{data:allScores}=await supabase.from("citizen_scores").select("citizen_id,score").order("score_month",{ascending:false});
    const vByCitizen:Record<string,any[]>={};(allViol??[]).forEach((v:any)=>{if(v.citizen_id){if(!vByCitizen[v.citizen_id])vByCitizen[v.citizen_id]=[];vByCitizen[v.citizen_id].push(v);}});
    const scoreMap:Record<string,number>={};(allScores??[]).forEach((s:any)=>{if(!scoreMap[s.citizen_id])scoreMap[s.citizen_id]=s.score;});
    const cDetailMap=Object.fromEntries((cDetails??[]).map((d:any)=>[d.id,d]));
    setCitizens((cProfiles??[]).map((p:any)=>({...p,...(cDetailMap[p.id]??{}),violations:vByCitizen[p.id]??[],score:scoreMap[p.id]??100})));
    const[{count:totalProfiles},{count:totalBins},{count:criticalBins},{count:highBins},{count:pendingViol},{count:totalCollect},{count:archivedUsers},{count:onDutyDrivers},{count:totalBroadcasts},{count:totalReports},{count:pendingReports},{count:totalSchedules}]=await Promise.all([supabase.from("profiles").select("id",{count:"exact",head:true}),supabase.from("bins").select("id",{count:"exact",head:true}),supabase.from("bins").select("id",{count:"exact",head:true}).gte("fill_level",90),supabase.from("bins").select("id",{count:"exact",head:true}).gte("fill_level",70).lt("fill_level",90),supabase.from("violations").select("id",{count:"exact",head:true}).eq("status","Pending"),supabase.from("collections").select("id",{count:"exact",head:true}),supabase.from("profiles").select("id",{count:"exact",head:true}).eq("is_archived",true),supabase.from("driver_details").select("id",{count:"exact",head:true}).eq("duty_status","ON-DUTY"),supabase.from("broadcasts").select("id",{count:"exact",head:true}),supabase.from("citizen_reports").select("id",{count:"exact",head:true}),supabase.from("citizen_reports").select("id",{count:"exact",head:true}).eq("status","Submitted"),supabase.from("collection_schedules").select("id",{count:"exact",head:true}).eq("is_active",true)]);
    const{count:citizenCount}=await supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","CITIZEN");
    const roleCounts=(profiles??[]).reduce((acc:any,p:any)=>{acc[p.role]=(acc[p.role]??0)+1;return acc;},{});
    setStats({totalUsers:totalProfiles??0,totalAdmins:roleCounts.ADMIN??0,totalDrivers:roleCounts.DRIVER??0,totalLGU:roleCounts.LGU??0,totalCitizens:citizenCount??0,totalBins:totalBins??0,criticalBins:criticalBins??0,highBins:highBins??0,pendingViolations:pendingViol??0,totalCollections:totalCollect??0,archivedUsers:archivedUsers??0,onDutyDrivers:onDutyDrivers??0,totalBroadcasts:totalBroadcasts??0,totalReports:totalReports??0,pendingReports:pendingReports??0,totalSchedules:totalSchedules??0});
    const{data:logs}=await supabase.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(80);
    const adminIds=[...new Set((logs??[]).map((l:any)=>l.admin_id).filter(Boolean))];let adminNames:Record<string,string>={};
    if(adminIds.length>0){const{data:ap}=await supabase.from("profiles").select("id,full_name").in("id",adminIds);adminNames=Object.fromEntries((ap??[]).map((p:any)=>[p.id,p.full_name]));}
    setAuditLogs((logs??[]).map((l:any)=>({...l,admin_name:adminNames[l.admin_id]??"System"})));
    const{data:nData}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);setNotifs(nData??[]);
    const{data:sData}=await supabase.from("system_settings").select("*").order("key");setSettings(sData??[]);
    setLoading(false);
  },[router]);

  useEffect(()=>{fetchData();},[fetchData]);
  useEffect(()=>{if(!meId)return;const ch=supabase.channel("sa-notifs").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${meId}`},(payload:any)=>{setNotifs(p=>[payload.new as DBNotif,...p].slice(0,30));}).subscribe();return()=>supabase.removeChannel(ch);},[meId]);

  const toggleArchive=async(userId:string,current:boolean)=>{setProcessing(userId);await supabase.from("profiles").update({is_archived:!current}).eq("id",userId);await supabase.from("audit_logs").insert({admin_id:meId,action_type:current?"UNARCHIVE_USER":"ARCHIVE_USER",target_id:userId,reason:`${current?"Unarchived":"Archived"} by Super Admin`});await supabase.from("notifications").insert({user_id:userId,type:current?"ACCOUNT_RESTORED":"ACCOUNT_ARCHIVED",title:current?"Account Restored":"Account Archived",body:current?"Your account has been restored.":"Your account has been archived.",created_by:meId});await fetchData();setProcessing(null);};
  const changeRole=async(userId:string,newRole:UserRole)=>{setProcessing(userId);await supabase.from("profiles").update({role:newRole}).eq("id",userId);await supabase.from("audit_logs").insert({admin_id:meId,action_type:"ASSIGN_ROLE",target_id:userId,reason:`Role changed to ${newRole}`});await supabase.from("notifications").insert({user_id:userId,type:"ROLE_CHANGED",title:"Account Role Updated",body:`Your role has been changed to ${newRole}.`,created_by:meId});await fetchData();setProcessing(null);};
  const saveSetting=async(key:string,value:string)=>{await supabase.from("system_settings").update({value:JSON.parse(value),updated_by:meId,updated_at:new Date().toISOString()}).eq("key",key);await supabase.from("audit_logs").insert({admin_id:meId,action_type:"SUPER_ADMIN_UPDATE_SETTING",target_id:key,reason:`Setting "${key}" updated`});setEditingKey(null);fetchData();};
  const markRead=async(id:string)=>{setNotifs(p=>p.map(n=>n.id===id?{...n,is_read:true}:n));await supabase.from("notifications").update({is_read:true}).eq("id",id);};
  const handleSignOut=async()=>{setIsLoggingOut(true);try{await supabase.from("audit_logs").insert({admin_id:meId,action_type:"SUPER_ADMIN_LOGOUT",target_id:meId,reason:`Session ended at ${new Date().toLocaleString("en-PH")}`});}catch(_){}await supabase.auth.signOut();router.push("/login");};

  const filteredUsers=users.filter(u=>{const mR=roleFilter==="all"||u.role===roleFilter;const mS=(u.full_name??"").toLowerCase().includes(search.toLowerCase())||(u.email??"").toLowerCase().includes(search.toLowerCase())||(u.barangay??"").toLowerCase().includes(search.toLowerCase());return mR&&mS;});
  const filteredCitizens=citizens.filter(c=>{const mF=citizenFilter==="all"?true:citizenFilter==="warnings"?c.warning_count>0:citizenFilter==="violations"?(c.violations?.length??0)>0:citizenFilter==="archived"?c.is_archived:true;const mS=(c.full_name??"").toLowerCase().includes(search.toLowerCase())||(c.barangay??"").toLowerCase().includes(search.toLowerCase())||(c.email??"").toLowerCase().includes(search.toLowerCase());return mF&&mS;});
  const unassignedLGU=users.filter(u=>u.role==="LGU"&&!u.barangay).length;
  const unreadC=notifs.filter(n=>!n.is_read).length;

  if(loading)return(<div style={{minHeight:"100vh",background:"#f4f7f5",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{SLIDE_IN_STYLE}</style><div style={{textAlign:"center"}}><div style={{width:48,height:48,borderRadius:"50%",border:"3px solid #e5e7eb",borderTopColor:"#1c4532",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/><p style={{fontSize:12,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase",fontFamily:"sans-serif"}}>Loading workspace…</p></div></div>);

  const TABS=[{id:"system",label:"Overview",icon:BarChart3,badge:null},{id:"users",label:"Staff",icon:UserCog,badge:users.length},{id:"citizens",label:"Citizens",icon:Users,badge:citizens.length},{id:"audit",label:"Audit Log",icon:Terminal,badge:auditLogs.length},{id:"settings",label:"Settings",icon:Settings,badge:null}];
  const currentLabel=TABS.find(t=>t.id===activeTab)?.label??"Dashboard";

  return(
    <div className="flex h-screen w-full relative overflow-hidden" style={{background:"#f4f7f5",color:"#111827",fontFamily:"sans-serif"}}>
      <style>{SLIDE_IN_STYLE}</style>
      <style>{`.row-hover:hover{background:#f9fafb!important;}input::placeholder,textarea::placeholder{color:#9ca3af;}select option{background:#fff;color:#111827;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px;}
      .stat-cards-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 32px; }
      @media (max-width: 1024px) { .stat-cards-container { display: flex; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 12px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; width: 100%; scroll-behavior: smooth; } .stat-cards-container::-webkit-scrollbar { height: 4px; } .stat-cards-container::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; } .stat-cards-container > div { flex: 0 0 280px; scroll-snap-align: start; } }`}</style>

      {isSidebarOpen&&<div className="fixed inset-0 z-[2000] lg:hidden" style={{background:"rgba(0,0,0,.3)",backdropFilter:"blur(2px)"}} onClick={()=>setIsSidebarOpen(false)}/>}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 transform transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen?"translate-x-0":"-translate-x-full"}`}
        style={{background:"#ffffff",borderRight:"1px solid #e5e7eb",boxShadow:"2px 0 10px rgba(0,0,0,0.02)"}}>
        <div style={{padding:"28px 24px 20px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:"#1c4532",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Shield size={20} color="#ffffff"/>
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:"#111827",letterSpacing:"-.02em"}}>EcoRoute</div>
              <div style={{fontSize:10,color:"#1c4532",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}}>Super Admin</div>
            </div>
          </div>
        </div>
        
        <nav style={{flex:1,padding:"10px 16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",letterSpacing:".1em",textTransform:"uppercase",padding:"12px 12px 4px"}}>Menu</div>
          {TABS.map(tab=>{const TIcon=tab.icon;const isActive=activeTab===tab.id;return(
            <button key={tab.id} onClick={()=>{setActiveTab(tab.id as any);setIsSidebarOpen(false);setSearch("");}} 
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:12,border:"none",background:isActive?"#e6f0eb":"transparent",color:isActive?"#1c4532":"#4b5563",cursor:"pointer",fontFamily:"sans-serif",transition:"all .2s",position:"relative"}}>
              {isActive&&<div style={{position:"absolute",left:0,top:8,bottom:8,width:4,borderRadius:"0 4px 4px 0",background:"#1c4532"}}/>}
              <div style={{display:"flex",alignItems:"center",gap:14,marginLeft:isActive?4:0}}>
                <TIcon size={18} strokeWidth={isActive?2.5:2} color={isActive?"#1c4532":"#6b7280"}/>
                <span style={{fontSize:14,fontWeight:isActive?700:500}}>{tab.label}</span>
                {tab.badge!==null&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:isActive?"#1c4532":"#f3f4f6",color:isActive?"#fff":"#4b5563",marginLeft:4}}>{tab.badge}</span>}
              </div>
            </button>
          );})}
        </nav>

        {/* Upgrade / Download Card imitation */}
        <div style={{padding:"24px",flexShrink:0}}>
          <div style={{background:"linear-gradient(145deg, #102a1e, #1c4532)",borderRadius:20,padding:"24px",position:"relative",overflow:"hidden",color:"#fff",boxShadow:"0 10px 25px rgba(28,69,50,0.3)"}}>
            <div style={{position:"absolute",right:-20,bottom:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
            <div style={{position:"absolute",right:10,top:-10,width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Shield size={16} color="#a3d4bb"/>
            </div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Download our<br/>Mobile App</div>
            <div style={{fontSize:11,color:"#a3d4bb",marginBottom:16}}>Manage system on the go</div>
            <button style={{width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",backdropFilter:"blur(4px)"}}>Download</button>
          </div>
        </div>

      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Header */}
        <header style={{height:80,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",flexShrink:0,zIndex:100,position:"relative"}}>
          
          {/* Mobile menu button */}
          <div className="lg:hidden" style={{marginRight:16}}>
            <button onClick={()=>setIsSidebarOpen(true)} style={{width:40,height:40,borderRadius:12,background:"#fff",border:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Menu size={18} color="#111827"/></button>
          </div>

          {/* Search Pill */}
          <div className="hidden md:flex" style={{flex:1,maxWidth:400,position:"relative"}}>
            <Search size={16} style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}/>
            <input placeholder="Search users, citizens…" value={search} onChange={e=>setSearch(e.target.value)} 
              style={{width:"100%",padding:"12px 16px 12px 42px",borderRadius:24,border:"1px solid #e5e7eb",background:"#ffffff",fontSize:13,color:"#111827",outline:"none",boxShadow:"0 2px 10px rgba(0,0,0,0.02)"}}/>
            <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"#f3f4f6",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:600,color:"#6b7280"}}>⌘ F</div>
          </div>

          {/* Right actions */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginLeft:"auto"}}>
            
            <button onClick={fetchData} style={{width:40,height:40,borderRadius:20,background:"#fff",border:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.02)"}} title="Refresh Data"><RefreshCw size={16} color="#4b5563"/></button>

            <div ref={notifRef} style={{position:"relative"}}>
              <button onClick={()=>setNotifOpen(o=>!o)} style={{width:40,height:40,borderRadius:20,background:"#fff",border:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative",boxShadow:"0 2px 10px rgba(0,0,0,0.02)"}}>
                <Bell size={16} color="#4b5563"/>
                {unreadC>0&&<span style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>{unreadC>9?"9+":unreadC}</span>}
              </button>
              {notifOpen&&(<div style={{position:"absolute",top:"calc(100% + 12px)",right:0,width:340,background:"#ffffff",borderRadius:16,border:"1px solid #e5e7eb",boxShadow:"0 20px 40px rgba(0,0,0,.08)",zIndex:300,animation:"dropIn .2s ease both",overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px",borderBottom:"1px solid #f3f4f6",background:"#f9fafb"}}><span style={{fontSize:14,fontWeight:700,color:"#111827"}}>Notifications{unreadC>0&&<span style={{fontSize:11,marginLeft:6,background:"#ef4444",color:"#fff",padding:"2px 8px",borderRadius:20,fontWeight:600}}>{unreadC} new</span>}</span><button onClick={()=>setNotifOpen(false)} style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}><X size={16} color="#6b7280"/></button></div><div style={{maxHeight:320,overflowY:"auto"}}>{notifs.length===0?<div style={{padding:32,textAlign:"center",color:"#6b7280",fontSize:13}}>No notifications</div>:notifs.map(n=>(<div key={n.id} onClick={()=>markRead(n.id)} style={{padding:"14px 16px",borderBottom:"1px solid #f3f4f6",background:n.is_read?"#fff":"#f8fafc",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:32,height:32,borderRadius:"50%",background:"#e0e7ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Info size={14} color="#4f46e5"/></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:n.is_read?500:700,color:"#111827"}}>{n.title}</div><div style={{fontSize:12,color:"#4b5563",marginTop:4,lineHeight:1.4}}>{n.body}</div><div style={{fontSize:11,color:"#9ca3af",marginTop:6}}>{timeAgo(n.created_at)}</div></div>{!n.is_read&&<div style={{width:8,height:8,borderRadius:"50%",background:"#3b82f6",flexShrink:0,marginTop:6}}/>}</div>))}</div></div>)}
            </div>

            {/* Profile trigger */}
            <button onClick={()=>setShowProfile(true)} style={{display:"flex",alignItems:"center",gap:12,padding:"4px 16px 4px 4px",borderRadius:24,border:"none",background:"transparent",cursor:"pointer"}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:"#e6f0eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#1c4532",border:"1px solid #a3d4bb"}}>{meName.charAt(0)}</div>
              <div className="hidden md:block" style={{textAlign:"left"}}><div style={{fontSize:13,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{meName}</div><div style={{fontSize:11,color:"#6b7280",fontWeight:500}}>{email}</div></div>
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto"}}>
          <div style={{maxWidth:1400,margin:"0 auto",padding:"16px 32px 40px"}}>
            
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:32,flexWrap:"wrap",gap:16}}>
              <div>
                <h1 style={{fontSize:32,fontWeight:700,color:"#111827",margin:"0 0 4px",letterSpacing:"-0.02em"}}>{currentLabel}</h1>
                <p style={{fontSize:14,color:"#6b7280",margin:0}}>Monitor and manage all system operations from one place.</p>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button onClick={fetchData} style={{padding:"10px 20px",borderRadius:24,background:"#1c4532",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}><RefreshCw size={14}/> Refresh Data</button>
                <button onClick={()=>setShowLogout(true)} style={{padding:"10px 20px",borderRadius:24,background:"#fff",color:"#111827",border:"1px solid #e5e7eb",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 5px rgba(0,0,0,0.02)",display:"flex",alignItems:"center",gap:8}}><LogOut size={14}/> Sign Out</button>
              </div>
            </div>

            {activeTab === "system" && (
              <div className="stat-cards-container">
                <StatCard label="Total Users"        value={stats?.totalUsers??0}        sub={`${stats?.archivedUsers??0} archived`} isPrimary={true}/>
                <StatCard label="Admins"             value={stats?.totalAdmins??0}       sub={`${stats?.totalLGU??0} LGU officers`} delay={0.05}/>
                <StatCard label="Active Drivers"     value={stats?.totalDrivers??0}      sub={`${stats?.onDutyDrivers??0} currently on duty`} delay={0.1}/>
                <StatCard label="Citizens"           value={stats?.totalCitizens??0}     sub={`${stats?.pendingViolations??0} pending violations`} delay={0.15}/>
                <StatCard label="Smart Bins"         value={stats?.totalBins??0}         sub={`${stats?.criticalBins??0} critical level`} delay={0.2}/>
                <StatCard label="Collections"        value={stats?.totalCollections??0}  sub={`${stats?.totalSchedules??0} active schedules`} delay={0.25}/>
              </div>
            )}

            <div style={{background:"#ffffff",borderRadius:24,border:"1px solid #e5e7eb",overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.02)"}}>
              
              {activeTab==="users"&&(<div style={{padding:"24px"}}><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{fontSize:13,padding:"10px 14px",border:"1px solid #d1d5db",borderRadius:12,background:"#f9fafb",color:"#111827",outline:"none",cursor:"pointer"}}><option value="all">All roles</option><option value="SUPER_ADMIN">Super Admin</option><option value="ADMIN">Admin</option><option value="DRIVER">Driver</option><option value="LGU">LGU</option></select><div style={{position:"relative",flex:1,maxWidth:300}}><Search size={14} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#6b7280"}}/><input placeholder="Search users…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",paddingLeft:38,paddingRight:14,paddingTop:10,paddingBottom:10,border:"1px solid #d1d5db",borderRadius:12,fontSize:13,color:"#111827",outline:"none",background:"#f9fafb",boxSizing:"border-box"}}/></div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["User","Role","Detail","Status","Updated","Actions"].map(h=><th key={h} style={{padding:"14px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead><tbody>{filteredUsers.length===0?<tr><td colSpan={6} style={{textAlign:"center",padding:60,color:"#6b7280",fontSize:14}}>No users found</td></tr>:filteredUsers.map(u=>(<tr key={u.id} className="row-hover" style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"16px"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:"50%",background:ROLE_CONFIG[u.role]?.bg??"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:ROLE_CONFIG[u.role]?.color??"#1c4532",flexShrink:0}}>{(u.full_name??"?").charAt(0).toUpperCase()}</div><div><div style={{fontSize:14,fontWeight:600,color:u.is_archived?"#9ca3af":"#111827",textDecoration:u.is_archived?"line-through":"none",display:"flex",alignItems:"center",gap:8}}>{u.full_name??"—"}{u.id===meId&&<span style={{fontSize:10,fontWeight:700,color:"#fff",background:"#1c4532",padding:"2px 8px",borderRadius:20}}>YOU</span>}</div><div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{u.email}</div></div></div></td><td style={{padding:"16px"}}><RoleBadge role={u.role}/></td><td style={{padding:"16px",fontSize:13,color:"#4b5563"}}>{u.role==="DRIVER"&&<div><div style={{color:"#111827",fontWeight:600}}>{u.license_number??"No license"}</div>{u.vehicle_plate_number&&<div style={{fontSize:12,marginTop:2}}>{u.vehicle_plate_number}</div>}<div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}><span style={{width:6,height:6,borderRadius:"50%",background:u.duty_status==="ON-DUTY"?"#10b981":"#9ca3af",display:"inline-block"}}/><span style={{fontSize:12,color:u.duty_status==="ON-DUTY"?"#059669":"#6b7280",fontWeight:500}}>{u.duty_status??"OFF-DUTY"}</span></div></div>}{u.role==="LGU"&&(u.barangay?<div><div style={{fontWeight:600,color:"#111827"}}>{u.barangay}</div><div style={{fontSize:12,marginTop:2}}>{u.position_title??"—"}</div>{u.municipality&&<div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{u.municipality}</div>}</div>:<button onClick={()=>setAssignTarget(u)} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:20,cursor:"pointer",background:"#fef3c7",color:"#d97706",border:"none"}}><MapPin size={12}/>Assign LGU</button>)}{u.role==="ADMIN"&&<span style={{color:"#4b5563"}}>Barangay Admin</span>}{u.role==="SUPER_ADMIN"&&<span style={{color:"#1c4532",fontWeight:700}}>Full system access</span>}</td><td style={{padding:"16px"}}><span style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20,background:u.is_archived?"#f1f5f9":"#e6f0eb",color:u.is_archived?"#64748b":"#1c4532"}}>{u.is_archived?"Archived":"Active"}</span></td><td style={{padding:"16px",fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>{timeAgo(u.updated_at)}</td><td style={{padding:"16px"}}>{processing===u.id?<div style={{width:20,height:20,borderRadius:"50%",border:"2px solid #e5e7eb",borderTopColor:"#1c4532",animation:"spin .8s linear infinite"}}/>:<ActionMenu user={u} meId={meId} onArchive={toggleArchive} onRole={changeRole} onAssign={setAssignTarget} onNotify={setNotifyTarget}/>}</td></tr>))}</tbody></table></div></div>)}
              
              {activeTab==="citizens"&&(<div style={{padding:"24px"}}><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,flexWrap:"wrap"}}><select value={citizenFilter} onChange={e=>setCitizenFilter(e.target.value)} style={{fontSize:13,padding:"10px 14px",border:"1px solid #d1d5db",borderRadius:12,background:"#f9fafb",color:"#111827",outline:"none",cursor:"pointer"}}><option value="all">All citizens</option><option value="warnings">With warnings</option><option value="violations">With violations</option><option value="archived">Archived</option></select><div style={{position:"relative",flex:1,maxWidth:300}}><Search size={14} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#6b7280"}}/><input placeholder="Search citizens…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",paddingLeft:38,paddingRight:14,paddingTop:10,paddingBottom:10,border:"1px solid #d1d5db",borderRadius:12,fontSize:13,color:"#111827",outline:"none",background:"#f9fafb",boxSizing:"border-box"}}/></div><div style={{display:"flex",gap:16,marginLeft:"auto"}}>{[{label:"Total",val:citizens.length,color:"#1c4532"},{label:"Warnings",val:citizens.filter(c=>c.warning_count>0).length,color:"#d97706"},{label:"Violations",val:citizens.filter(c=>(c.violations?.length??0)>0).length,color:"#dc2626"}].map(s=>(<div key={s.label} style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16,fontWeight:800,color:s.color}}>{s.val}</span><span style={{fontSize:12,fontWeight:600,color:"#6b7280",textTransform:"uppercase"}}>{s.label}</span></div>))}</div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Citizen","Barangay","Purok / Street","LGU Assigned","Warnings","Score","Violations","Status","Actions",""].map(h=><th key={h} style={{padding:"14px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead><tbody>{filteredCitizens.length===0?<tr><td colSpan={10} style={{textAlign:"center",padding:60,color:"#6b7280",fontSize:14}}>No citizens found</td></tr>:filteredCitizens.map(c=><CitizenRow key={c.id} c={c} lguMap={lguMap} onRole={changeRole}/>)}</tbody></table></div></div>)}
              
              {activeTab==="audit"&&(<div style={{padding:"24px"}}><div style={{marginBottom:24,maxWidth:300,position:"relative"}}><Search size={14} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#6b7280"}}/><input placeholder="Search logs…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",paddingLeft:38,paddingRight:14,paddingTop:10,paddingBottom:10,border:"1px solid #d1d5db",borderRadius:12,fontSize:13,color:"#111827",outline:"none",background:"#f9fafb",boxSizing:"border-box"}}/></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Action","Performed By","Target ID","Reason","Time"].map(h=><th key={h} style={{padding:"14px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead><tbody>{auditLogs.length===0?<tr><td colSpan={5} style={{textAlign:"center",padding:60,color:"#6b7280",fontSize:14}}>No audit logs yet</td></tr>:auditLogs.filter(l=>search===""||l.action_type.toLowerCase().includes(search.toLowerCase())||(l.admin_name??"").toLowerCase().includes(search.toLowerCase())||(l.reason??"").toLowerCase().includes(search.toLowerCase())).map(log=>(<tr key={log.id} className="row-hover" style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"14px 16px"}}><span style={{fontFamily:"monospace",fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:8,background:"#f3f4f6",color:"#4b5563"}}>{log.action_type}</span></td><td style={{padding:"14px 16px",fontSize:13,color:"#111827",fontWeight:600}}>{log.admin_name}</td><td style={{padding:"14px 16px",fontSize:12,fontFamily:"monospace",color:"#6b7280",maxWidth:140}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{log.target_id??"—"}</div></td><td style={{padding:"14px 16px",fontSize:13,color:"#4b5563",maxWidth:280}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{log.reason??"—"}</div></td><td style={{padding:"14px 16px",fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>{timeAgo(log.created_at)}</td></tr>))}</tbody></table></div></div>)}
              
              {activeTab==="system"&&stats&&(<div style={{padding:"32px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24}}>
                <div style={{background:"#f9fafb",borderRadius:20,padding:24,border:"1px solid #e5e7eb"}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:24,display:"flex",alignItems:"center",gap:8}}><Layers size={18} color="#1c4532"/>User Breakdown</div>
                  {([{role:"SUPER_ADMIN",cnt:users.filter(u=>u.role==="SUPER_ADMIN").length},{role:"ADMIN",cnt:stats.totalAdmins},{role:"DRIVER",cnt:stats.totalDrivers},{role:"LGU",cnt:stats.totalLGU},{role:"CITIZEN",cnt:stats.totalCitizens}] as {role:UserRole;cnt:number}[]).map(({role,cnt})=>{const cfg=ROLE_CONFIG[role],pct=stats.totalUsers>0?(cnt/stats.totalUsers)*100:0;return<div key={role} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:cfg.color}}/><span style={{fontSize:13,fontWeight:500,color:"#4b5563"}}>{cfg.label}</span></div><span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{cnt}</span></div><div style={{height:6,borderRadius:3,background:"#e5e7eb"}}><div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:cfg.color,transition:"width .6s"}}/></div></div>;})}
                </div>
                <div style={{background:"#f9fafb",borderRadius:20,padding:24,border:"1px solid #e5e7eb"}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:24,display:"flex",alignItems:"center",gap:8}}><Trash2 size={18} color="#1c4532"/>Bin Network Health</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>{[{label:"Total Bins",value:stats.totalBins,color:"#1c4532",bg:"#e6f0eb"},{label:"Critical",value:stats.criticalBins,color:"#dc2626",bg:"#fee2e2"},{label:"High Fill",value:stats.highBins,color:"#d97706",bg:"#fef3c7"},{label:"Collections",value:stats.totalCollections,color:"#2563eb",bg:"#dbeafe"}].map(s=>(<div key={s.label} style={{background:s.bg,borderRadius:16,padding:"20px",border:`1px solid ${s.color}20`}}><div style={{fontSize:28,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div><div style={{fontSize:13,fontWeight:600,color:s.color,marginTop:8}}>{s.label}</div></div>))}</div>
                </div>
                <div style={{background:"#f9fafb",borderRadius:20,padding:24,border:"1px solid #e5e7eb",display:"flex",flexDirection:"column"}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:24,display:"flex",alignItems:"center",gap:8}}><AlertTriangle size={18} color="#1c4532"/>Violations & Reports</div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
                    {[{label:"Pending Violations",val:citizens.reduce((a,c)=>a+(c.violations?.filter(v=>v.status==="Pending").length??0),0),color:"#d97706"},{label:"Under Review",val:citizens.reduce((a,c)=>a+(c.violations?.filter(v=>v.status==="Under Review").length??0),0),color:"#2563eb"},{label:"Resolved",val:citizens.reduce((a,c)=>a+(c.violations?.filter(v=>v.status==="Resolved").length??0),0),color:"#059669"},{label:"Citizen Reports",val:stats.totalReports,color:"#7c3aed"}].map(s=>(<div key={s.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #e5e7eb"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:10,height:10,borderRadius:"50%",background:s.color}}/><span style={{fontSize:14,fontWeight:500,color:"#4b5563"}}>{s.label}</span></div><span style={{fontSize:18,fontWeight:700,color:s.color}}>{s.val}</span></div>))}
                  </div>
                </div>
              </div>)}
              
              {activeTab==="settings"&&(<div style={{padding:"32px"}}><div style={{marginBottom:32}}><div style={{fontSize:18,fontWeight:700,color:"#111827",marginBottom:8}}>System Configuration</div><p style={{fontSize:14,color:"#6b7280",margin:0}}>Manage global variables stored in the <code style={{background:"#f3f4f6",padding:"2px 6px",borderRadius:4,color:"#4b5563"}}>system_settings</code> table.</p></div><div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:800}}>{settings.map(s=>(<div key={s.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:24,padding:"20px",borderRadius:16,background:"#f9fafb",border:"1px solid #e5e7eb",flexWrap:"wrap"}}><div style={{flex:1,minWidth:250}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}><span style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:"#111827"}}>{s.key}</span><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:s.is_public?"#d1fae5":"#fee2e2",color:s.is_public?"#059669":"#dc2626"}}>{s.is_public?"PUBLIC":"PRIVATE"}</span></div>{s.description&&<div style={{fontSize:13,color:"#6b7280"}}>{s.description}</div>}</div>{editingKey===s.key?(<div style={{display:"flex",gap:10,alignItems:"center"}}><input value={editingVal} onChange={e=>setEditingVal(e.target.value)} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #d1d5db",background:"#fff",color:"#111827",fontSize:13,outline:"none",fontFamily:"monospace",width:200}}/><button onClick={()=>saveSetting(s.key,editingVal)} style={{padding:"10px 16px",borderRadius:10,background:"#1c4532",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save</button><button onClick={()=>setEditingKey(null)} style={{padding:"10px 16px",borderRadius:10,background:"#fff",color:"#4b5563",border:"1px solid #d1d5db",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button></div>):(<div style={{display:"flex",gap:16,alignItems:"center"}}><span style={{fontFamily:"monospace",fontSize:14,color:"#1c4532",background:"#e6f0eb",padding:"6px 12px",borderRadius:8}}>{JSON.stringify(s.value)}</span><button onClick={()=>{setEditingKey(s.key);setEditingVal(JSON.stringify(s.value));}} style={{fontSize:12,fontWeight:600,padding:"8px 16px",borderRadius:10,background:"#fff",color:"#111827",border:"1px solid #d1d5db",cursor:"pointer"}}>Edit</button></div>)}</div>))}</div></div>)}
            </div>

          </div>
        </div>
      </main>

      {/* Profile slide-over */}
      {showProfile&&<SuperAdminProfilePanel meId={meId} meName={meName} onClose={()=>setShowProfile(false)}/>}

      {/* Logout modal */}
      {showLogout&&(<div className="fixed inset-0 z-[4000] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,.4)",backdropFilter:"blur(2px)"}}><div style={{background:"#ffffff",borderRadius:24,border:"1px solid #e5e7eb",width:"100%",maxWidth:380,padding:"32px",boxShadow:"0 20px 60px rgba(0,0,0,.1)",animation:"fadeUp .2s ease both",textAlign:"center"}}><div style={{width:64,height:64,borderRadius:20,background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}><LogOut size={28} color="#dc2626"/></div><h2 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 12px"}}>End Session?</h2><p style={{fontSize:14,color:"#6b7280",margin:"0 0 32px",lineHeight:1.6}}>You are about to sign out of the Donezo Super Admin portal.</p><div style={{display:"flex",flexDirection:"column",gap:12}}><button onClick={handleSignOut} disabled={isLoggingOut} style={{width:"100%",padding:"14px",borderRadius:14,background:"#dc2626",color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",opacity:isLoggingOut?.6:1}}>{isLoggingOut?"Signing out…":"Confirm & Sign Out"}</button><button onClick={()=>setShowLogout(false)} disabled={isLoggingOut} style={{width:"100%",padding:"14px",borderRadius:14,background:"#fff",color:"#4b5563",border:"1px solid #e5e7eb",fontSize:14,fontWeight:700,cursor:"pointer"}}>Stay Active</button></div></div></div>)}

      {assignTarget&&<AssignBarangayModal user={assignTarget} meId={meId} onClose={()=>setAssignTarget(null)} onSuccess={fetchData}/>}
      {notifyTarget&&<SendNotifModal user={notifyTarget} meId={meId} onClose={()=>setNotifyTarget(null)}/>}
    </div>
  );
}