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
  Megaphone, Flag, TrendingUp, Info,
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

const ROLE_CONFIG:Record<UserRole,{label:string;color:string;bg:string;darkBg:string;icon:any}>={SUPER_ADMIN:{label:"Super Admin",color:"#34d399",bg:"#f0fdf4",darkBg:"rgba(52,211,153,.12)",icon:Shield},ADMIN:{label:"Admin",color:"#6ee7b7",bg:"#f0fdf4",darkBg:"rgba(110,231,183,.1)",icon:Building2},DRIVER:{label:"Driver",color:"#a7f3d0",bg:"#f0fdf4",darkBg:"rgba(167,243,208,.1)",icon:Truck},LGU:{label:"LGU",color:"#fcd34d",bg:"#fefce8",darkBg:"rgba(252,211,77,.1)",icon:MapPin},CITIZEN:{label:"Citizen",color:"#94a3b8",bg:"#f8fafc",darkBg:"rgba(148,163,184,.1)",icon:Users}};
const VIOLATION_STATUS:Record<string,{dot:string;text:string;bg:string}>={"Pending":{dot:"#f59e0b",text:"#fcd34d",bg:"rgba(245,158,11,.12)"},"Under Review":{dot:"#3b82f6",text:"#93c5fd",bg:"rgba(59,130,246,.12)"},"Resolved":{dot:"#10b981",text:"#6ee7b7",bg:"rgba(16,185,129,.12)"}};
const timeAgo=(iso:string)=>{if(!iso)return"—";const diff=Date.now()-new Date(iso).getTime(),m=Math.floor(diff/60000);if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);if(d<30)return`${d}d ago`;return new Date(iso).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});};
const fmtDate=(iso:string)=>iso?new Date(iso).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}):"—";
const fmtFull=(iso:string)=>new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
const scoreColor=(s:number)=>s>=90?"#34d399":s>=70?"#6ee7b7":s>=50?"#fcd34d":s>=30?"#f97316":"#f87171";

// Shared slide-in animation used by ALL role profile panels for uniform UX
const SLIDE_IN_STYLE=`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`;

function StatCard({icon:Icon,label,value,sub,accent,delay=0,warn=false}:{icon:any;label:string;value:string|number;sub?:string;accent:string;delay?:number;warn?:boolean}){return(<div style={{background:"rgba(255,255,255,.03)",borderRadius:14,padding:"18px 20px",border:warn?`1px solid ${accent}40`:"1px solid rgba(255,255,255,.07)",display:"flex",flexDirection:"column",gap:10,animation:`fadeUp .5s ease ${delay}s both`,position:"relative",overflow:"hidden"}}>{warn&&<div style={{position:"absolute",inset:0,background:`${accent}06`,pointerEvents:"none"}}/>}<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}><span style={{fontSize:10,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase"}}>{label}</span><div style={{width:34,height:34,borderRadius:9,background:`${accent}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={17} style={{color:accent}}/></div></div><div style={{fontSize:30,fontWeight:900,color:warn?accent:"#f0fdf4",lineHeight:1,fontFamily:"Georgia,serif",position:"relative"}}>{value}</div>{sub&&<div style={{fontSize:11,color:"#374151",position:"relative"}}>{sub}</div>}<div style={{height:2,borderRadius:1,background:`${accent}18`,position:"relative"}}><div style={{height:"100%",width:"55%",borderRadius:1,background:accent}}/></div></div>);}
function RoleBadge({role}:{role:UserRole}){const cfg=ROLE_CONFIG[role]??ROLE_CONFIG.CITIZEN,Icon=cfg.icon;return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,background:cfg.darkBg,color:cfg.color,border:`1px solid ${cfg.color}25`,whiteSpace:"nowrap"}}><Icon size={10}/>{cfg.label}</span>;}

const menuItemStyle:React.CSSProperties={display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",border:"none",background:"transparent",fontSize:12,cursor:"pointer",borderRadius:8,textAlign:"left",fontFamily:"sans-serif",transition:"background .12s"};
const dividerStyle:React.CSSProperties={height:1,background:"rgba(52,211,153,.1)",margin:"4px 0"};

function ActionMenu({user,meId,onArchive,onRole,onAssign,onNotify}:{user:SystemUser;meId:string;onArchive:(id:string,cur:boolean)=>void;onRole:(id:string,r:UserRole)=>void;onAssign:(u:SystemUser)=>void;onNotify:(u:SystemUser)=>void}){const[open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);useEffect(()=>{if(!open)return;const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);if(user.id===meId)return<span style={{fontSize:11,color:"#1f2937"}}>—</span>;const roles:UserRole[]=(["ADMIN","DRIVER","LGU"] as UserRole[]).filter(r=>r!==user.role);return(<div ref={ref} style={{position:"relative",display:"inline-block"}}><button onClick={()=>setOpen(o=>!o)} style={{background:open?"rgba(52,211,153,.15)":"rgba(255,255,255,.05)",border:`1px solid ${open?"rgba(52,211,153,.35)":"rgba(255,255,255,.1)"}`,borderRadius:8,padding:"6px 10px",color:open?"#34d399":"#6b7280",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,transition:"all .15s"}}><MoreHorizontal size={14}/><ChevronDown size={11} style={{transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}/></button>{open&&(<div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#0a1628",border:"1px solid rgba(52,211,153,.2)",borderRadius:12,padding:6,minWidth:220,zIndex:500,boxShadow:"0 20px 60px rgba(0,0,0,.7)",animation:"dropIn .15s ease both"}}>{user.role==="LGU"&&(<><button onClick={()=>{onAssign(user);setOpen(false);}} style={{...menuItemStyle,color:"#fcd34d"}}><MapPin size={13} color="#f59e0b"/><span style={{flex:1}}>{user.barangay?"Update Barangay":"Assign Barangay"}</span>{!user.barangay&&<span style={{fontSize:9,fontWeight:800,background:"rgba(245,158,11,.2)",color:"#f59e0b",padding:"1px 6px",borderRadius:8}}>PENDING</span>}</button><div style={dividerStyle}/></>)}<button onClick={()=>{onNotify(user);setOpen(false);}} style={{...menuItemStyle,color:"#93c5fd"}}><Bell size={13} color="#60a5fa"/>Send Notification</button><div style={dividerStyle}/><div style={{padding:"4px 8px 2px",fontSize:9,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase"}}>Change Role</div>{roles.map(r=>{const RIcon=ROLE_CONFIG[r].icon;return(<button key={r} onClick={()=>{onRole(user.id,r);setOpen(false);}} style={{...menuItemStyle,color:"#d1fae5"}}><RIcon size={13} color={ROLE_CONFIG[r].color}/>Set as {ROLE_CONFIG[r].label}</button>);})}<div style={dividerStyle}/><button onClick={()=>{onArchive(user.id,user.is_archived);setOpen(false);}} style={{...menuItemStyle,color:user.is_archived?"#6ee7b7":"#f87171"}}>{user.is_archived?<ArchiveRestore size={13}/>:<Archive size={13}/>}{user.is_archived?"Restore account":"Archive account"}</button></div>)}</div>);}

function AssignBarangayModal({user,meId,onClose,onSuccess}:{user:SystemUser;meId:string;onClose:()=>void;onSuccess:()=>void}){const[barangay,setBarangay]=useState(user.barangay??"");const[municipality,setMunicipality]=useState(user.municipality??"");const[position,setPosition]=useState(user.position_title??"");const[empStatus,setEmpStatus]=useState(user.employment_status??"ACTIVE");const[saving,setSaving]=useState(false);const[error,setError]=useState<string|null>(null);const[success,setSuccess]=useState(false);const inp:React.CSSProperties={padding:"9px 12px",borderRadius:9,border:"1px solid rgba(52,211,153,.2)",background:"rgba(52,211,153,.04)",color:"#d1fae5",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};const save=async()=>{setError(null);if(!barangay.trim())return setError("Barangay is required.");setSaving(true);try{const{data:ex}=await supabase.from("lgu_details").select("id").eq("id",user.id).single();const payload={barangay:barangay.trim(),municipality:municipality.trim()||null,position_title:position.trim()||null,employment_status:empStatus};if(ex){const{error:e}=await supabase.from("lgu_details").update(payload).eq("id",user.id);if(e)throw e;}else{const{error:e}=await supabase.from("lgu_details").insert({id:user.id,...payload});if(e)throw e;}await supabase.from("audit_logs").insert({admin_id:meId,action_type:"ASSIGN_BARANGAY",target_id:user.id,reason:`Assigned barangay "${barangay.trim()}" to ${user.email}`});await supabase.from("notifications").insert({user_id:user.id,type:"SYSTEM",title:"Barangay Assigned",body:`You have been assigned to Barangay ${barangay.trim()}${municipality?`, ${municipality}`:""}. You may now access your LGU dashboard.`,created_by:meId});setSuccess(true);setTimeout(()=>{onSuccess();onClose();},800);}catch(e:any){setError(e.message??"Error.");}finally{setSaving(false);}};return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}}><div onClick={e=>e.stopPropagation()} style={{background:"#061020",borderRadius:20,border:"1px solid rgba(52,211,153,.25)",width:"100%",maxWidth:460,boxShadow:"0 32px 80px rgba(0,0,0,.8)",animation:"fadeUp .2s ease both",overflow:"hidden"}}><div style={{background:"rgba(52,211,153,.06)",padding:"18px 22px",borderBottom:"1px solid rgba(52,211,153,.1)",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:38,height:38,borderRadius:11,background:"rgba(52,211,153,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><MapPin size={18} color="#34d399"/></div><div><div style={{fontSize:14,fontWeight:800,color:"#d1fae5"}}>{user.barangay?"Update Barangay":"Assign Barangay"}</div><div style={{fontSize:11,color:"#374151"}}>{user.full_name??user.email}</div></div></div><button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:7,cursor:"pointer",display:"flex"}}><X size={14} color="#4b5563"/></button></div>{user.barangay&&<div style={{margin:"14px 22px 0",padding:"10px 14px",borderRadius:10,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.2)",display:"flex",alignItems:"center",gap:8}}><MapPin size={13} color="#34d399"/><span style={{fontSize:12,color:"#6ee7b7"}}>Current: <strong>{user.barangay}{user.municipality?`, ${user.municipality}`:""}</strong></span></div>}<div style={{padding:"16px 22px",display:"flex",flexDirection:"column",gap:13}}>{[{label:"Barangay",req:true,val:barangay,set:setBarangay,ph:"e.g. Barangay Poblacion"},{label:"Municipality",val:municipality,set:setMunicipality,ph:"e.g. Mati City"},{label:"Position Title",val:position,set:setPosition,ph:"e.g. Barangay Captain"}].map(f=>(<div key={f.label} style={{display:"flex",flexDirection:"column",gap:5}}><label style={{fontSize:10,fontWeight:700,color:"#374151",letterSpacing:".07em",textTransform:"uppercase"}}>{f.label} {(f as any).req&&<span style={{color:"#f87171"}}>*</span>}</label><input placeholder={f.ph} value={f.val} onChange={e=>f.set(e.target.value)} style={inp}/></div>))}<div style={{display:"flex",flexDirection:"column",gap:5}}><label style={{fontSize:10,fontWeight:700,color:"#374151",letterSpacing:".07em",textTransform:"uppercase"}}>Status</label><select value={empStatus} onChange={e=>setEmpStatus(e.target.value)} style={{...inp,cursor:"pointer"}}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ON_LEAVE">On Leave</option></select></div>{error&&<div style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.25)",borderRadius:9,padding:"9px 13px",fontSize:12,color:"#f87171",display:"flex",gap:8,alignItems:"center"}}><AlertTriangle size={13}/>{error}</div>}{success&&<div style={{background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.25)",borderRadius:9,padding:"9px 13px",fontSize:12,color:"#34d399",display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={13}/>Saved! LGU notified.</div>}</div><div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:"14px 22px",borderTop:"1px solid rgba(52,211,153,.1)"}}><button onClick={onClose} style={{padding:"8px 16px",borderRadius:9,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"#4b5563",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"sans-serif"}}>Cancel</button><button onClick={save} disabled={saving||success} style={{padding:"8px 20px",borderRadius:9,border:"none",background:success?"#059669":"#065f46",color:"#d1fae5",fontSize:13,fontWeight:700,cursor:saving||success?"not-allowed":"pointer",fontFamily:"sans-serif",display:"flex",alignItems:"center",gap:8}}>{saving?<><div style={{width:13,height:13,borderRadius:"50%",border:"2px solid #374151",borderTopColor:"#34d399",animation:"spin .7s linear infinite"}}/>Saving…</>:success?<><CheckCircle size={14}/>Saved!</>:<><MapPin size={14}/>{user.barangay?"Update":"Assign"}</>}</button></div></div></div>);}

function SendNotifModal({user,meId,onClose}:{user:SystemUser;meId:string;onClose:()=>void}){const[title,setTitle]=useState("");const[body,setBody]=useState("");const[type,setType]=useState("SYSTEM");const[saving,setSaving]=useState(false);const[success,setSuccess]=useState(false);const inp:React.CSSProperties={padding:"9px 12px",borderRadius:9,border:"1px solid rgba(52,211,153,.2)",background:"rgba(52,211,153,.04)",color:"#d1fae5",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};const send=async()=>{if(!title||!body)return;setSaving(true);await supabase.from("notifications").insert({user_id:user.id,type,title:title.trim(),body:body.trim(),created_by:meId,metadata:{sent_by_super_admin:true}});await supabase.from("audit_logs").insert({admin_id:meId,action_type:"SUPER_ADMIN_NOTIFY",target_id:user.id,reason:`Notification sent: "${title}"`});setSuccess(true);setSaving(false);setTimeout(onClose,1200);};return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}}><div onClick={e=>e.stopPropagation()} style={{background:"#061020",borderRadius:20,border:"1px solid rgba(52,211,153,.25)",width:"100%",maxWidth:440,boxShadow:"0 32px 80px rgba(0,0,0,.8)",animation:"fadeUp .2s ease both",overflow:"hidden"}}><div style={{background:"rgba(52,211,153,.06)",padding:"18px 22px",borderBottom:"1px solid rgba(52,211,153,.1)",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:38,height:38,borderRadius:11,background:"rgba(52,211,153,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Bell size={18} color="#34d399"/></div><div><div style={{fontSize:14,fontWeight:800,color:"#d1fae5"}}>Send Notification</div><div style={{fontSize:11,color:"#374151"}}>To: {user.full_name??user.email}</div></div></div><button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:7,cursor:"pointer",display:"flex"}}><X size={14} color="#4b5563"/></button></div><div style={{padding:"16px 22px",display:"flex",flexDirection:"column",gap:13}}><div><label style={{fontSize:10,fontWeight:700,color:"#374151",letterSpacing:".07em",textTransform:"uppercase",display:"block",marginBottom:5}}>Type</label><select value={type} onChange={e=>setType(e.target.value)} style={{...inp,cursor:"pointer"}}>{["SYSTEM","ROLE_CHANGED","ACCOUNT_ARCHIVED","ACCOUNT_RESTORED"].map(t=><option key={t}>{t}</option>)}</select></div><div><label style={{fontSize:10,fontWeight:700,color:"#374151",letterSpacing:".07em",textTransform:"uppercase",display:"block",marginBottom:5}}>Title *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Notification title" style={inp}/></div><div><label style={{fontSize:10,fontWeight:700,color:"#374151",letterSpacing:".07em",textTransform:"uppercase",display:"block",marginBottom:5}}>Message *</label><textarea value={body} onChange={e=>setBody(e.target.value)} rows={3} placeholder="Message body…" style={{...inp,resize:"none",lineHeight:1.6}}/></div>{success&&<div style={{background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.25)",borderRadius:9,padding:"9px 13px",fontSize:12,color:"#34d399",display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={13}/>Sent!</div>}</div><div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:"14px 22px",borderTop:"1px solid rgba(52,211,153,.1)"}}><button onClick={onClose} style={{padding:"8px 16px",borderRadius:9,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"#4b5563",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"sans-serif"}}>Cancel</button><button onClick={send} disabled={!title||!body||saving||success} style={{padding:"8px 20px",borderRadius:9,border:"none",background:"#065f46",color:"#d1fae5",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif",display:"flex",alignItems:"center",gap:8,opacity:(!title||!body)?.5:1}}>{saving?<><div style={{width:13,height:13,borderRadius:"50%",border:"2px solid #374151",borderTopColor:"#34d399",animation:"spin .7s linear infinite"}}/>Sending…</>:<><Bell size={14}/>Send</>}</button></div></div></div>);}

function CitizenRow({c,lguMap}:{c:CitizenRecord;lguMap:Record<string,string>}){const[expanded,setExpanded]=useState(false);const vcount=c.violations?.length??0,pendingV=c.violations?.filter(v=>v.status==="Pending").length??0;return(<><tr className="row-hover" onClick={()=>vcount>0&&setExpanded(e=>!e)} style={{borderBottom:expanded?"none":"1px solid rgba(52,211,153,.05)",background:"transparent",cursor:vcount>0?"pointer":"default"}}><td style={{padding:"11px 16px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",background:c.is_archived?"rgba(71,85,105,.2)":"rgba(52,211,153,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:c.is_archived?"#374151":"#34d399",flexShrink:0}}>{(c.full_name??"?").charAt(0).toUpperCase()}</div><div><div style={{fontSize:13,fontWeight:600,color:c.is_archived?"#374151":"#d1fae5",textDecoration:c.is_archived?"line-through":"none"}}>{c.full_name??"—"}</div><div style={{fontSize:11,color:"#374151"}}>{c.email}</div></div></div></td><td style={{padding:"11px 16px"}}><div style={{fontSize:12,fontWeight:600,color:"#6ee7b7"}}>{c.barangay??"—"}</div><div style={{fontSize:11,color:"#374151"}}>{c.municipality??""}</div></td><td style={{padding:"11px 16px"}}><div style={{fontSize:12,color:"#4b5563"}}>{c.purok??"—"}</div><div style={{fontSize:11,color:"#374151"}}>{c.address_street??""}</div></td><td style={{padding:"11px 16px"}}>{lguMap[c.barangay??""]?<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:"#34d399"}}/><span style={{fontSize:12,color:"#6ee7b7"}}>{lguMap[c.barangay??""]}</span></div>:<span style={{fontSize:11,color:"#374151"}}>Unassigned</span>}</td><td style={{padding:"11px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:c.warning_count>=3?"rgba(239,68,68,.15)":c.warning_count>0?"rgba(245,158,11,.12)":"rgba(52,211,153,.1)",color:c.warning_count>=3?"#f87171":c.warning_count>0?"#fcd34d":"#34d399"}}>{c.warning_count} warning{c.warning_count!==1?"s":""}</span></td><td style={{padding:"11px 16px"}}><span style={{fontSize:13,fontWeight:800,color:scoreColor(c.score??100)}}>{c.score??100}</span><span style={{fontSize:10,color:"#374151"}}>/100</span></td><td style={{padding:"11px 16px"}}>{vcount>0?<div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:pendingV>0?"rgba(245,158,11,.12)":"rgba(52,211,153,.1)",color:pendingV>0?"#fcd34d":"#6ee7b7"}}>{vcount} {vcount===1?"case":"cases"}</span>{pendingV>0&&<span style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:20,background:"rgba(245,158,11,.15)",color:"#f59e0b"}}>{pendingV} pending</span>}</div>:<span style={{fontSize:11,color:"#1f2937"}}>None</span>}</td><td style={{padding:"11px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:c.is_archived?"rgba(71,85,105,.2)":"rgba(52,211,153,.1)",color:c.is_archived?"#374151":"#34d399"}}>{c.is_archived?"Archived":"Active"}</span></td><td style={{padding:"11px 14px",textAlign:"center"}}>{vcount>0&&<ChevronRight size={14} color="#374151" style={{transform:expanded?"rotate(90deg)":"none",transition:"transform .15s"}}/>}</td></tr>{expanded&&vcount>0&&(<tr style={{borderBottom:"1px solid rgba(52,211,153,.05)"}}><td colSpan={9} style={{padding:0,background:"rgba(52,211,153,.03)"}}><div style={{padding:"12px 16px 14px 62px",borderTop:"1px solid rgba(52,211,153,.06)"}}><div style={{fontSize:10,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Violation History · {c.full_name}</div><div style={{display:"flex",flexDirection:"column",gap:7}}>{c.violations!.map(v=>{const sc=VIOLATION_STATUS[v.status]??VIOLATION_STATUS.Pending;return(<div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:9,background:sc.bg,border:`1px solid ${sc.dot}20`}}><div style={{width:7,height:7,borderRadius:"50%",background:sc.dot,flexShrink:0}}/><span style={{fontSize:11,fontWeight:700,color:sc.text,minWidth:100}}>{v.type.replace(/_/g," ")}</span><span style={{fontSize:11,color:"#374151",flex:1}}>{v.description??"No description"}</span><span style={{fontSize:10,color:"#374151",whiteSpace:"nowrap"}}>{fmtDate(v.created_at)}</span><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:`${sc.dot}20`,color:sc.text}}>{v.status}</span></div>);})}</div></div></td></tr>)}</>);}


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
    supabase.from("profiles").select("avatar_url,email").eq("id",meId).single()
      .then(({data}:{data:{avatar_url:string|null;email:string}|null})=>{
        if(data?.avatar_url) setAvatarUrl(data.avatar_url);
        if(data?.email) setEmail(data.email);
      });
  },[meId]);

  useEffect(()=>{
    if(tab!=="activity") return;
    setLogsLoading(true);
    supabase.from("audit_logs").select("id,action_type,reason,created_at")
      .eq("admin_id",meId).order("created_at",{ascending:false}).limit(50)
      .then(({data}:{data:SALogEntry[]|null})=>{ setLogs(data??[]); setLogsLoading(false); });
  },[tab,meId]);

  const handleAvatar = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    setUploading(true);
    const ext=f.name.split(".").pop();
    const path=`${meId}/avatar-${Date.now()}.${ext}`;
    await supabase.storage.from("avatars").upload(path,f,{upsert:true,contentType:f.type});
    const {data:{publicUrl}}=supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({avatar_url:publicUrl}).eq("id",meId);
    setAvatarUrl(publicUrl); setUploading(false);
  };

  const saveProfile = async () => {
    if(!editData.full_name.trim()){setSaveErr("Name cannot be empty.");return;}
    setSaving(true); setSaveErr("");
    const {error}=await supabase.from("profiles").update({full_name:editData.full_name.trim()}).eq("id",meId);
    if(error){setSaveErr(error.message);setSaving(false);return;}
    await supabase.from("audit_logs").insert({admin_id:meId,action_type:"SUPER_ADMIN_UPDATE_PROFILE",target_id:meId,reason:"Super Admin profile updated"});
    setSaveOk(true); setTimeout(()=>{setSaveOk(false);setEditing(false);},1200); setSaving(false);
  };

  const changePassword = async () => {
    setPwErr("");
    if(!pwForm.next||pwForm.next!==pwForm.confirm){setPwErr("Passwords do not match.");return;}
    if(pwForm.next.length<8){setPwErr("Minimum 8 characters.");return;}
    setPwSaving(true);
    const {error}=await supabase.auth.updateUser({password:pwForm.next});
    if(error){setPwErr(error.message);setPwSaving(false);return;}
    await supabase.from("audit_logs").insert({admin_id:meId,action_type:"SUPER_ADMIN_PASSWORD_CHANGE",target_id:meId,reason:"Password changed"});
    setPwOk(true); setPwForm({next:"",confirm:""}); setTimeout(()=>setPwOk(false),3500); setPwSaving(false);
  };

  const INP:React.CSSProperties={padding:"9px 12px",borderRadius:9,border:"1px solid rgba(52,211,153,.25)",background:"rgba(52,211,153,.05)",color:"#d1fae5",fontSize:13,outline:"none",fontFamily:"sans-serif",width:"100%",boxSizing:"border-box"};

  const actionIcon=(t:string)=>{
    if(t.includes("LOGIN"))  return {i:"🔑",c:"#34d399"};
    if(t.includes("LOGOUT")) return {i:"🚪",c:"#6b7280"};
    if(t.includes("PASSWORD")) return {i:"🔒",c:"#fcd34d"};
    if(t.includes("PROFILE")) return {i:"✏️",c:"#6ee7b7"};
    if(t.includes("ARCHIVE")) return {i:"📦",c:"#f87171"};
    if(t.includes("ROLE"))   return {i:"🔄",c:"#a78bfa"};
    if(t.includes("ASSIGN")) return {i:"📍",c:"#fcd34d"};
    if(t.includes("NOTIFY")) return {i:"📢",c:"#60a5fa"};
    if(t.includes("SETTING")) return {i:"⚙️",c:"#34d399"};
    return {i:"📋",c:"#6b7280"};
  };

  const fmtFull=(iso:string)=>new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
  const initials = meName.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const TABS=[{id:"profile",label:"Profile",icon:"👤"},{id:"security",label:"Security",icon:"🔒"},{id:"activity",label:"Activity",icon:"🗒️"}] as const;

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(3px)",zIndex:700}}/>
      <div style={{position:"fixed",top:80,right:0,bottom:0,zIndex:800,width:"min(460px,100vw)",background:"#061020",boxShadow:"-8px 0 48px rgba(0,0,0,.5)",display:"flex",flexDirection:"column",animation:"slideInRight .25s cubic-bezier(.4,0,.2,1) both",fontFamily:"sans-serif",border:"1px solid rgba(52,211,153,.12)"}}>
        <style>{SLIDE_IN_STYLE}</style>

        {/* Header */}
        <div style={{padding:"20px",borderBottom:"1px solid rgba(52,211,153,.1)",background:"rgba(52,211,153,.03)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontSize:12,fontWeight:800,color:"#34d399",letterSpacing:".1em",textTransform:"uppercase"}}>My Profile</span>
            <button onClick={onClose} style={{width:30,height:30,borderRadius:8,border:"1px solid rgba(52,211,153,.2)",background:"rgba(52,211,153,.06)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13} color="#34d399"/></button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:72,height:72,borderRadius:18,background:avatarUrl?"#0a1628":"linear-gradient(135deg,rgba(52,211,153,.4),rgba(6,95,70,.7))",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:"2px solid rgba(52,211,153,.3)"}}>
                {avatarUrl?<img src={avatarUrl} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:22,fontWeight:900,color:"#34d399"}}>{initials}</span>}
                {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:18,height:18,borderRadius:"50%",border:"2px solid rgba(52,211,153,.3)",borderTopColor:"#34d399",animation:"spin 1s linear infinite"}}/></div>}
              </div>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{position:"absolute",bottom:-4,right:-4,width:24,height:24,borderRadius:7,background:"#065f46",border:"2px solid #020c1a",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}} title="Change photo">📷</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:"#d1fae5"}}>{meName}</div>
              <div style={{fontSize:12,color:"#34d399",marginTop:2}}>Super Administrator</div>
              <div style={{fontSize:11,color:"#374151",marginTop:3}}>{email}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid rgba(52,211,153,.08)",flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"11px 0",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,fontWeight:tab===t.id?700:500,color:tab===t.id?"#34d399":"#4b5563",borderBottom:tab===t.id?"2.5px solid #34d399":"2.5px solid transparent",transition:"color .15s",fontFamily:"sans-serif"}}>
              <span style={{fontSize:14}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px",display:"flex",flexDirection:"column",gap:14}}>

          {tab==="profile"&&(<>
            {!editing?(
              <div style={{background:"rgba(52,211,153,.04)",borderRadius:14,border:"1px solid rgba(52,211,153,.12)",overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"rgba(52,211,153,.04)",borderBottom:"1px solid rgba(52,211,153,.08)"}}>
                  <span style={{fontSize:11,fontWeight:800,color:"#34d399",letterSpacing:".08em",textTransform:"uppercase"}}>Account Details</span>
                  <button onClick={()=>setEditing(true)} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:8,background:"rgba(52,211,153,.1)",color:"#34d399",border:"1px solid rgba(52,211,153,.25)",cursor:"pointer"}}>✏️ Edit</button>
                </div>
                <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{l:"Full Name",v:meName},{l:"Email",v:email},{l:"Role",v:"Super Administrator"},{l:"Access Level",v:"Full System Access"}].map(f=>(
                    <div key={f.l} style={{background:"rgba(52,211,153,.03)",borderRadius:9,padding:"9px 12px",border:"1px solid rgba(52,211,153,.08)"}}>
                      <div style={{fontSize:9,fontWeight:800,color:"#374151",letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{f.l}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"#d1fae5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{background:"rgba(52,211,153,.04)",borderRadius:14,border:"1px solid rgba(52,211,153,.25)",overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:"rgba(52,211,153,.06)",borderBottom:"1px solid rgba(52,211,153,.1)"}}><span style={{fontSize:11,fontWeight:800,color:"#34d399",letterSpacing:".08em",textTransform:"uppercase"}}>Edit Profile</span></div>
                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:800,color:"#34d399",letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Full Name *</label>
                    <input value={editData.full_name} onChange={e=>setEditData({full_name:e.target.value})} style={INP}/>
                  </div>
                  <div style={{padding:"10px 12px",borderRadius:9,background:"rgba(52,211,153,.04)",border:"1px solid rgba(52,211,153,.15)",fontSize:12,color:"#374151"}}>Email can only be changed through Supabase Auth settings.</div>
                  {saveErr&&<div style={{padding:"8px 12px",borderRadius:8,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.25)",fontSize:12,color:"#f87171"}}>{saveErr}</div>}
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setEditing(false);setSaveErr("");}} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"#4b5563",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"sans-serif"}}>Cancel</button>
                    <button onClick={saveProfile} disabled={saving||saveOk} style={{padding:"8px 18px",borderRadius:8,background:saveOk?"#065f46":"#059669",color:"#d1fae5",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif"}}>
                      {saving?"Saving…":saveOk?"✓ Saved!":"Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div style={{padding:"11px 14px",borderRadius:10,background:"rgba(52,211,153,.04)",border:"1px solid rgba(52,211,153,.15)",fontSize:12,color:"#374151",display:"flex",gap:9,alignItems:"center"}}>
              <span style={{fontSize:16}}>📷</span><span>Tap the camera icon on your photo to upload a new profile picture.</span>
            </div>
            <div style={{padding:"12px 16px",borderRadius:12,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",fontSize:12,color:"#fcd34d",lineHeight:1.6}}>
              <strong>⚡ Super Admin</strong> — You have full unrestricted access to all system data, user management, and configuration. All your actions are logged in the audit trail.
            </div>
          </>)}

          {tab==="security"&&(<>
            <div style={{background:"rgba(52,211,153,.04)",borderRadius:14,border:"1px solid rgba(52,211,153,.12)",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"rgba(52,211,153,.04)",borderBottom:"1px solid rgba(52,211,153,.08)"}}><span style={{fontSize:11,fontWeight:800,color:"#34d399",letterSpacing:".08em",textTransform:"uppercase"}}>🔒 Change Password</span></div>
              <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
                {([{label:"New Password",key:"next",ph:"Min. 8 characters"},{label:"Confirm Password",key:"confirm",ph:"Re-enter password"}] as const).map(f=>(
                  <div key={f.key}>
                    <label style={{fontSize:10,fontWeight:800,color:"#34d399",letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>{f.label}</label>
                    <input type={showPw?"text":"password"} value={pwForm[f.key]} onChange={e=>setPwForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph} style={INP} onKeyDown={e=>e.key==="Enter"&&changePassword()}/>
                  </div>
                ))}
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#6ee7b7",userSelect:"none"}}>
                  <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)} style={{accentColor:"#34d399",cursor:"pointer"}}/>Show passwords
                </label>
                {pwErr&&<div style={{padding:"9px 12px",borderRadius:9,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.25)",fontSize:12,color:"#f87171",display:"flex",gap:7,alignItems:"center"}}><span>⚠️</span>{pwErr}</div>}
                {pwOk&&<div style={{padding:"9px 12px",borderRadius:9,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.25)",fontSize:12,color:"#34d399",fontWeight:600,display:"flex",gap:7,alignItems:"center"}}><span>✅</span>Password updated.</div>}
                <button onClick={changePassword} disabled={pwSaving||!pwForm.next||!pwForm.confirm} style={{padding:"10px 0",borderRadius:9,background:"#065f46",color:"#d1fae5",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"sans-serif",opacity:(!pwForm.next||!pwForm.confirm||pwSaving)?.5:1}}>
                  {pwSaving?"Updating…":"Update Password"}
                </button>
              </div>
            </div>
            <div style={{padding:"14px 16px",borderRadius:12,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",fontSize:12,color:"#fcd34d",lineHeight:1.7}}>
              <div style={{fontWeight:800,marginBottom:6}}>🛡️ Security Tips</div>
              <ul style={{margin:0,paddingLeft:16}}><li>Use a unique password not used anywhere else</li><li>Enable 2FA in Supabase Auth if available</li><li>Review the Activity log regularly for unauthorized access</li><li>Sign out immediately if you suspect compromise</li></ul>
            </div>
          </>)}

          {tab==="activity"&&(<>
            <div style={{padding:"11px 14px",borderRadius:10,background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.2)",fontSize:12,color:"#93c5fd",lineHeight:1.5,display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{fontSize:15,flexShrink:0}}>ℹ️</span>
              <span>Your admin actions and auth sessions are logged here. Unexpected activity may indicate unauthorized access.</span>
            </div>
            <div style={{background:"rgba(52,211,153,.03)",borderRadius:14,border:"1px solid rgba(52,211,153,.1)",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"rgba(52,211,153,.04)",borderBottom:"1px solid rgba(52,211,153,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,fontWeight:800,color:"#34d399",letterSpacing:".08em",textTransform:"uppercase"}}>Recent Activity</span>
                <span style={{fontSize:10,color:"#374151"}}>Last 50 entries</span>
              </div>
              {logsLoading?<div style={{padding:28,textAlign:"center",color:"#374151",fontSize:13}}>Loading…</div>
              :logs.length===0?<div style={{padding:28,textAlign:"center",color:"#374151",fontSize:13}}>No activity yet.</div>
              :<div>{logs.map((l,i)=>{const {i:icon,c:col}=actionIcon(l.action_type??"");const isAuth=l.action_type?.includes("LOGIN")||l.action_type?.includes("LOGOUT");return(
                <div key={l.id??i} style={{padding:"11px 16px",borderBottom:"1px solid rgba(52,211,153,.04)",display:"flex",gap:12,alignItems:"flex-start",background:isAuth?"rgba(52,211,153,.02)":"transparent"}}>
                  <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:`${col}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#d1fae5",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      {(l.action_type??"").replace(/_/g," ")}
                      {isAuth&&<span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:20,background:l.action_type?.includes("LOGIN")?"rgba(52,211,153,.2)":"rgba(71,85,105,.2)",color:l.action_type?.includes("LOGIN")?"#34d399":"#94a3b8"}}>{l.action_type?.includes("LOGIN")?"SESSION START":"SESSION END"}</span>}
                    </div>
                    <div style={{fontSize:11,color:"#374151",marginTop:2,lineHeight:1.4}}>{l.reason||"—"}</div>
                    <div style={{fontSize:10,color:"#1f2937",marginTop:3}}>{fmtFull(l.created_at)}</div>
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


export default function Page() {
  const router=useRouter();
  const[meId,setMeId]=useState("");
  const[meName,setMeName]=useState("Super Admin");
  const[stats,setStats]=useState<SystemStat|null>(null);
  const[users,setUsers]=useState<SystemUser[]>([]);
  const[citizens,setCitizens]=useState<CitizenRecord[]>([]);
  const[lguMap,setLguMap]=useState<Record<string,string>>({});
  const[auditLogs,setAuditLogs]=useState<AuditEntry[]>([]);
  const[notifs,setNotifs]=useState<DBNotif[]>([]);
  const[settings,setSettings]=useState<Setting[]>([]);
  const[loading,setLoading]=useState(true);
  const[activeTab,setActiveTab]=useState<"users"|"citizens"|"audit"|"system"|"settings">("users");
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
    const{data:me}=await supabase.from("profiles").select("full_name").eq("id",user.id).single();
    if(me)setMeName(me.full_name??"Super Admin");
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

  if(loading)return(<div style={{minHeight:"100vh",background:"#020c1a",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{SLIDE_IN_STYLE}</style><div style={{textAlign:"center"}}><div style={{width:44,height:44,borderRadius:"50%",border:"2px solid rgba(52,211,153,.2)",borderTopColor:"#34d399",animation:"spin 1s linear infinite",margin:"0 auto 14px"}}/><p style={{fontSize:11,fontWeight:700,color:"#374151",letterSpacing:".12em",textTransform:"uppercase",fontFamily:"sans-serif"}}>Loading system…</p></div></div>);

  const TABS=[{id:"users",label:"Staff",icon:UserCog,badge:users.length},{id:"citizens",label:"Citizens",icon:Users,badge:citizens.length},{id:"audit",label:"Audit Log",icon:Terminal,badge:auditLogs.length},{id:"system",label:"Overview",icon:BarChart3,badge:null},{id:"settings",label:"Settings",icon:Settings,badge:null}];
  const currentLabel=TABS.find(t=>t.id===activeTab)?.label??"Dashboard";

  return(
    <div className="flex h-screen w-full relative overflow-hidden" style={{background:"#020c1a",color:"#d1fae5",fontFamily:"sans-serif"}}>
      <style>{SLIDE_IN_STYLE}</style>
      <style>{`.row-hover:hover{background:rgba(52,211,153,.03)!important;}.act-btn{transition:all .15s;}.act-btn:hover{opacity:.85;}input::placeholder,textarea::placeholder{color:#1f2937;}select option{background:#0a1628;color:#d1fae5;}::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(52,211,153,.2);border-radius:2px;}`}</style>

      {isSidebarOpen&&<div className="fixed inset-0 z-[2000] lg:hidden" style={{background:"rgba(0,0,0,.65)",backdropFilter:"blur(4px)"}} onClick={()=>setIsSidebarOpen(false)}/>}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 transform transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen?"translate-x-0":"-translate-x-full"}`}
        style={{background:"rgba(2,12,26,.99)",borderRight:"1px solid rgba(52,211,153,.12)"}}>
        <div style={{padding:"24px 22px 18px",flexShrink:0,borderBottom:"1px solid rgba(52,211,153,.07)"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:13,background:"linear-gradient(135deg,rgba(52,211,153,.28),rgba(6,95,70,.7))",border:"1px solid rgba(52,211,153,.35)",display:"flex",alignItems:"center",justifyContent:"center"}}><Shield size={20} color="#34d399"/></div><div><div style={{fontSize:16,fontWeight:800,color:"#d1fae5",letterSpacing:"-.01em"}}>EcoRoute</div><div style={{fontSize:9,color:"#34d399",letterSpacing:".12em",textTransform:"uppercase",fontWeight:700}}>Super Admin</div></div></div></div>
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
          {stats&&stats.criticalBins>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)"}}><div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s infinite",flexShrink:0}}/><span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{stats.criticalBins} critical bin{stats.criticalBins!==1?"s":""}</span></div>}
          {unassignedLGU>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.18)"}}><MapPin size={11} color="#f59e0b"/><span style={{fontSize:11,fontWeight:700,color:"#fcd34d"}}>{unassignedLGU} LGU unassigned</span></div>}
          {stats&&stats.pendingReports>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.2)"}}><Flag size={11} color="#a78bfa"/><span style={{fontSize:11,fontWeight:700,color:"#c4b5fd"}}>{stats.pendingReports} pending report{stats.pendingReports!==1?"s":""}</span></div>}
        </div>
        <nav style={{flex:1,padding:"6px 12px",overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontSize:9,fontWeight:800,color:"#374151",letterSpacing:".12em",textTransform:"uppercase",padding:"4px 8px 8px"}}>System Control</div>
          {TABS.map(tab=>{const TIcon=tab.icon;const isActive=activeTab===tab.id;return(<button key={tab.id} onClick={()=>{setActiveTab(tab.id as any);setIsSidebarOpen(false);setSearch("");}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderRadius:12,border:"none",background:isActive?"rgba(52,211,153,.12)":"transparent",color:isActive?"#34d399":"#4b5563",cursor:"pointer",fontFamily:"sans-serif",transition:"all .15s"}}><div style={{display:"flex",alignItems:"center",gap:11}}><TIcon size={16} strokeWidth={isActive?2.5:2}/><span style={{fontSize:12,fontWeight:isActive?700:500,textTransform:"uppercase",letterSpacing:".05em"}}>{tab.label}</span>{tab.badge!==null&&<span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:20,background:isActive?"rgba(52,211,153,.2)":"rgba(255,255,255,.06)",color:isActive?"#34d399":"#374151"}}>{tab.badge}</span>}</div>{isActive&&<ChevronRight size={13} color="#34d399"/>}</button>);})}
        </nav>
        <div style={{padding:"14px 16px",flexShrink:0,borderTop:"1px solid rgba(52,211,153,.07)"}}>
          <button onClick={()=>setShowLogout(true)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"11px",borderRadius:12,border:"1px solid rgba(52,211,153,.12)",background:"rgba(52,211,153,.03)",color:"#374151",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:".08em",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,.08)";e.currentTarget.style.color="#f87171";e.currentTarget.style.borderColor="rgba(239,68,68,.25)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(52,211,153,.03)";e.currentTarget.style.color="#374151";e.currentTarget.style.borderColor="rgba(52,211,153,.12)";}}>
            <LogOut size={14}/><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden" style={{background:"rgba(2,8,20,.96)"}}>
        {/* Header — height:64px; profile panel starts at top:64px */}
        <header style={{height:64,background:"rgba(2,12,26,.96)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(52,211,153,.08)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",flexShrink:0,zIndex:100,position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="lg:hidden" onClick={()=>setIsSidebarOpen(true)} style={{width:34,height:34,borderRadius:9,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Menu size={16} color="#34d399"/></button>
            <div><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}><div style={{width:5,height:5,borderRadius:"50%",background:"#34d399",animation:"pulse 2s infinite"}}/><span style={{fontSize:9,fontWeight:700,color:"#34d399",letterSpacing:".12em",textTransform:"uppercase"}}>System Live</span></div><h2 style={{fontSize:16,fontWeight:800,color:"#d1fae5",margin:0}}>{currentLabel}</h2></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div ref={notifRef} style={{position:"relative"}}>
              <button onClick={()=>setNotifOpen(o=>!o)} style={{width:36,height:36,borderRadius:10,background:notifOpen?"rgba(52,211,153,.15)":"rgba(255,255,255,.05)",border:`1px solid ${notifOpen?"rgba(52,211,153,.35)":"rgba(255,255,255,.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}><Bell size={16} color={notifOpen?"#34d399":"#6b7280"}/>{unreadC>0&&<span style={{position:"absolute",top:-3,right:-3,width:15,height:15,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #020c1a"}}>{unreadC>9?"9+":unreadC}</span>}</button>
              {notifOpen&&(<div style={{position:"absolute",top:"calc(100% + 10px)",right:0,width:330,background:"#0f172a",borderRadius:14,border:"1px solid rgba(52,211,153,.15)",boxShadow:"0 20px 60px rgba(0,0,0,.6)",zIndex:300,animation:"dropIn .18s ease both",overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid rgba(52,211,153,.08)",background:"rgba(52,211,153,.04)"}}><span style={{fontSize:14,fontWeight:800,color:"#d1fae5"}}>Notifications{unreadC>0&&<span style={{fontSize:10,marginLeft:5,background:"#ef4444",color:"#fff",padding:"1px 6px",borderRadius:20,fontWeight:800}}>{unreadC}</span>}</span><button onClick={()=>setNotifOpen(false)} style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}><X size={13} color="#374151"/></button></div><div style={{maxHeight:300,overflowY:"auto"}}>{notifs.length===0?<div style={{padding:28,textAlign:"center",color:"#374151",fontSize:13}}>No notifications</div>:notifs.map(n=>(<div key={n.id} onClick={()=>markRead(n.id)} style={{padding:"11px 16px",borderBottom:"1px solid rgba(52,211,153,.04)",background:n.is_read?"transparent":"rgba(52,211,153,.03)",cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:"50%",background:"rgba(52,211,153,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Info size={12} color="#34d399"/></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:n.is_read?400:700,color:"#d1fae5"}}>{n.title}</div><div style={{fontSize:11,color:"#374151",marginTop:1,lineHeight:1.4}}>{n.body}</div><div style={{fontSize:10,color:"#1f2937",marginTop:3}}>{timeAgo(n.created_at)}</div></div>{!n.is_read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#34d399",flexShrink:0,marginTop:5}}/>}</div>))}</div></div>)}
            </div>
            {/* Profile badge — opens slide-over at top:64px */}
            <button onClick={()=>setShowProfile(true)} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 14px 6px 6px",borderRadius:12,border:`1px solid ${showProfile?"rgba(52,211,153,.4)":"rgba(52,211,153,.15)"}`,background:showProfile?"rgba(52,211,153,.12)":"rgba(52,211,153,.05)",cursor:"pointer",transition:"all .2s"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,rgba(52,211,153,.3),rgba(6,95,70,.5))",border:"1px solid rgba(52,211,153,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#34d399"}}>{meName.charAt(0)}</div>
              <div className="hidden md:block" style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:700,color:"#d1fae5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{meName}</div><div style={{fontSize:9,color:"#34d399",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>Super Admin</div></div>
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto"}}>
          <div style={{maxWidth:1400,margin:"0 auto",padding:"24px 20px"}}>
            <div style={{marginBottom:24,animation:"fadeUp .4s ease both"}}><h1 style={{fontSize:"clamp(20px,4vw,30px)",fontWeight:900,color:"#d1fae5",margin:0,letterSpacing:"-.03em",fontFamily:"Georgia,serif"}}>System Control Center</h1><p style={{fontSize:13,color:"#374151",margin:"3px 0 0"}}>EcoRoute · Davao Oriental · {citizens.length} citizens · {users.length} staff</p></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:24}}>
              <StatCard icon={Users}        label="Total Users"   value={stats?.totalUsers??0}        sub={`${stats?.archivedUsers??0} archived`}   accent="#34d399" delay={0}/>
              <StatCard icon={Building2}    label="Admins"        value={stats?.totalAdmins??0}       sub="Barangay scope"                          accent="#6ee7b7" delay={.03}/>
              <StatCard icon={Truck}        label="Drivers"       value={stats?.totalDrivers??0}      sub={`${stats?.onDutyDrivers??0} on duty`}    accent="#a7f3d0" delay={.06}/>
              <StatCard icon={MapPin}       label="LGU Officials" value={stats?.totalLGU??0}          sub={unassignedLGU>0?`${unassignedLGU} unassigned`:"All assigned"} accent="#fcd34d" delay={.09} warn={unassignedLGU>0}/>
              <StatCard icon={Users}        label="Citizens"      value={stats?.totalCitizens??0}     sub="Registered"                             accent="#34d399" delay={.12}/>
              <StatCard icon={Trash2}       label="Smart Bins"    value={stats?.totalBins??0}         sub={`${stats?.criticalBins??0} critical`}    accent="#f87171" delay={.15} warn={(stats?.criticalBins??0)>0}/>
              <StatCard icon={AlertTriangle}label="Violations"    value={stats?.pendingViolations??0} sub="Pending review"                         accent="#fcd34d" delay={.18} warn={(stats?.pendingViolations??0)>0}/>
              <StatCard icon={Flag}         label="Reports"       value={stats?.totalReports??0}      sub={`${stats?.pendingReports??0} pending`}   accent="#c4b5fd" delay={.21} warn={(stats?.pendingReports??0)>0}/>
              <StatCard icon={Megaphone}    label="Broadcasts"    value={stats?.totalBroadcasts??0}   sub="Sent total"                             accent="#6ee7b7" delay={.24}/>
              <StatCard icon={Calendar}     label="Schedules"     value={stats?.totalSchedules??0}    sub="Active routes"                          accent="#a7f3d0" delay={.27}/>
              <StatCard icon={Database}     label="Collections"   value={stats?.totalCollections??0}  sub="Total logged"                           accent="#6ee7b7" delay={.30}/>
              <StatCard icon={TrendingUp}   label="Compliance"    value={stats&&stats.totalCitizens>0?`${Math.round(((stats.totalCitizens-citizens.filter(c=>c.warning_count>0).length)/stats.totalCitizens)*100)}%`:"—"} sub="RA 9003 adherence" accent="#34d399" delay={.33}/>
            </div>
            <div style={{background:"rgba(2,15,30,.8)",borderRadius:18,border:"1px solid rgba(52,211,153,.12)",overflow:"hidden",boxShadow:"0 8px 48px rgba(0,0,0,.5)",animation:"fadeUp .5s ease .35s both"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 18px",borderBottom:"1px solid rgba(52,211,153,.08)",flexWrap:"wrap",gap:6,background:"rgba(52,211,153,.02)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {activeTab==="users"&&<select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid rgba(52,211,153,.15)",borderRadius:8,background:"rgba(52,211,153,.06)",color:"#6ee7b7",outline:"none",cursor:"pointer"}}><option value="all">All roles</option><option value="SUPER_ADMIN">Super Admin</option><option value="ADMIN">Admin</option><option value="DRIVER">Driver</option><option value="LGU">LGU</option></select>}
                  {activeTab==="citizens"&&<select value={citizenFilter} onChange={e=>setCitizenFilter(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid rgba(52,211,153,.15)",borderRadius:8,background:"rgba(52,211,153,.06)",color:"#6ee7b7",outline:"none",cursor:"pointer"}}><option value="all">All citizens</option><option value="warnings">With warnings</option><option value="violations">With violations</option><option value="archived">Archived</option></select>}
                  {(activeTab==="users"||activeTab==="citizens"||activeTab==="audit")&&(<div style={{position:"relative"}}><Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#374151"}}/><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:30,paddingRight:10,paddingTop:7,paddingBottom:7,border:"1px solid rgba(52,211,153,.15)",borderRadius:8,fontSize:12,color:"#d1fae5",outline:"none",width:170,background:"rgba(52,211,153,.06)",fontFamily:"sans-serif"}}/></div>)}
                  <button onClick={fetchData} className="act-btn" style={{padding:"7px 9px",border:"1px solid rgba(52,211,153,.15)",borderRadius:8,background:"rgba(52,211,153,.06)",cursor:"pointer"}}><RefreshCw size={13} color="#34d399"/></button>
                </div>
              </div>
              {activeTab==="users"&&(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}><thead><tr style={{background:"rgba(52,211,153,.03)"}}>{["User","Role","Detail","Status","Updated","Actions"].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(52,211,153,.07)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{filteredUsers.length===0?<tr><td colSpan={6} style={{textAlign:"center",padding:48,color:"#374151",fontSize:13}}>No users found</td></tr>:filteredUsers.map(u=>(<tr key={u.id} className="row-hover" style={{borderBottom:"1px solid rgba(52,211,153,.05)"}}><td style={{padding:"12px 16px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:"50%",background:`${ROLE_CONFIG[u.role]?.color??"#34d399"}15`,border:`1px solid ${ROLE_CONFIG[u.role]?.color??"#34d399"}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:ROLE_CONFIG[u.role]?.color??"#34d399",flexShrink:0}}>{(u.full_name??"?").charAt(0).toUpperCase()}</div><div><div style={{fontSize:13,fontWeight:600,color:u.is_archived?"#374151":"#d1fae5",textDecoration:u.is_archived?"line-through":"none",display:"flex",alignItems:"center",gap:6}}>{u.full_name??"—"}{u.id===meId&&<span style={{fontSize:9,fontWeight:800,color:"#34d399",background:"rgba(52,211,153,.12)",padding:"1px 6px",borderRadius:8}}>YOU</span>}</div><div style={{fontSize:11,color:"#374151"}}>{u.email}</div></div></div></td><td style={{padding:"12px 16px"}}><RoleBadge role={u.role}/></td><td style={{padding:"12px 16px",fontSize:12,color:"#374151"}}>{u.role==="DRIVER"&&<div><div style={{color:"#6ee7b7",fontWeight:600}}>{u.license_number??"No license"}</div>{u.vehicle_plate_number&&<div style={{fontSize:11}}>{u.vehicle_plate_number}</div>}<div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}><span style={{width:5,height:5,borderRadius:"50%",background:u.duty_status==="ON-DUTY"?"#34d399":"#374151",display:"inline-block"}}/><span style={{fontSize:11,color:u.duty_status==="ON-DUTY"?"#34d399":"#374151"}}>{u.duty_status??"OFF-DUTY"}</span></div></div>}{u.role==="LGU"&&(u.barangay?<div><div style={{fontWeight:600,color:"#fcd34d"}}>{u.barangay}</div><div style={{fontSize:11}}>{u.position_title??"—"}</div>{u.municipality&&<div style={{fontSize:11}}>{u.municipality}</div>}</div>:<button onClick={()=>setAssignTarget(u)} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,cursor:"pointer",background:"rgba(245,158,11,.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,.25)",fontFamily:"sans-serif"}}><MapPin size={10}/>Unassigned</button>)}{u.role==="ADMIN"&&<span style={{color:"#374151"}}>Barangay Admin</span>}{u.role==="SUPER_ADMIN"&&<span style={{color:"#34d399",fontWeight:700}}>Full system access</span>}</td><td style={{padding:"12px 16px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:u.is_archived?"rgba(71,85,105,.15)":"rgba(52,211,153,.1)",color:u.is_archived?"#374151":"#34d399"}}>{u.is_archived?"Archived":"Active"}</span></td><td style={{padding:"12px 16px",fontSize:12,color:"#374151",whiteSpace:"nowrap"}}>{timeAgo(u.updated_at)}</td><td style={{padding:"12px 16px"}}>{processing===u.id?<div style={{width:18,height:18,borderRadius:"50%",border:"2px solid rgba(52,211,153,.2)",borderTopColor:"#34d399",animation:"spin .8s linear infinite"}}/>:<ActionMenu user={u} meId={meId} onArchive={toggleArchive} onRole={changeRole} onAssign={setAssignTarget} onNotify={setNotifyTarget}/>}</td></tr>))}</tbody></table></div>)}
              {activeTab==="citizens"&&(<div style={{overflowX:"auto"}}><div style={{display:"flex",gap:16,padding:"12px 18px",borderBottom:"1px solid rgba(52,211,153,.06)",flexWrap:"wrap"}}>{[{label:"Total",val:citizens.length,color:"#34d399"},{label:"With warnings",val:citizens.filter(c=>c.warning_count>0).length,color:"#fcd34d"},{label:"With violations",val:citizens.filter(c=>(c.violations?.length??0)>0).length,color:"#f87171"},{label:"Archived",val:citizens.filter(c=>c.is_archived).length,color:"#374151"},{label:"Showing",val:filteredCitizens.length,color:"#6ee7b7"}].map(s=>(<div key={s.label} style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,fontWeight:800,color:s.color}}>{s.val}</span><span style={{fontSize:11,color:"#374151"}}>{s.label}</span></div>))}</div><table style={{width:"100%",borderCollapse:"collapse",minWidth:840}}><thead><tr style={{background:"rgba(52,211,153,.03)"}}>{["Citizen","Barangay","Purok / Street","LGU Assigned","Warnings","Score","Violations","Status",""].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(52,211,153,.07)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{filteredCitizens.length===0?<tr><td colSpan={9} style={{textAlign:"center",padding:48,color:"#374151",fontSize:13}}>No citizens found</td></tr>:filteredCitizens.map(c=><CitizenRow key={c.id} c={c} lguMap={lguMap}/>)}</tbody></table></div>)}
              {activeTab==="audit"&&(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}><thead><tr style={{background:"rgba(52,211,153,.03)"}}>{["Action","Performed By","Target ID","Reason","Time"].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:10,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(52,211,153,.07)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{auditLogs.length===0?<tr><td colSpan={5} style={{textAlign:"center",padding:48,color:"#374151",fontSize:13}}>No audit logs yet</td></tr>:auditLogs.filter(l=>search===""||l.action_type.toLowerCase().includes(search.toLowerCase())||(l.admin_name??"").toLowerCase().includes(search.toLowerCase())||(l.reason??"").toLowerCase().includes(search.toLowerCase())).map(log=>(<tr key={log.id} className="row-hover" style={{borderBottom:"1px solid rgba(52,211,153,.04)"}}><td style={{padding:"11px 16px"}}><span style={{fontFamily:"monospace",fontSize:11,padding:"3px 9px",borderRadius:6,background:"rgba(52,211,153,.1)",color:"#6ee7b7",whiteSpace:"nowrap"}}>{log.action_type}</span></td><td style={{padding:"11px 16px",fontSize:12,color:"#6ee7b7",fontWeight:600}}>{log.admin_name}</td><td style={{padding:"11px 16px",fontSize:11,fontFamily:"monospace",color:"#374151",maxWidth:140}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{log.target_id??"—"}</div></td><td style={{padding:"11px 16px",fontSize:12,color:"#4b5563",maxWidth:240}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{log.reason??"—"}</div></td><td style={{padding:"11px 16px",fontSize:11,color:"#374151",whiteSpace:"nowrap"}}>{timeAgo(log.created_at)}</td></tr>))}</tbody></table></div>)}
              {activeTab==="system"&&stats&&(<div style={{padding:"20px 20px 24px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}><div style={{background:"rgba(52,211,153,.03)",borderRadius:14,padding:20,border:"1px solid rgba(52,211,153,.09)"}}><div style={{fontSize:11,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",marginBottom:16,display:"flex",alignItems:"center",gap:7}}><Layers size={13} color="#34d399"/>User Breakdown</div>{([{role:"SUPER_ADMIN",cnt:users.filter(u=>u.role==="SUPER_ADMIN").length},{role:"ADMIN",cnt:stats.totalAdmins},{role:"DRIVER",cnt:stats.totalDrivers},{role:"LGU",cnt:stats.totalLGU},{role:"CITIZEN",cnt:stats.totalCitizens}] as {role:UserRole;cnt:number}[]).map(({role,cnt})=>{const cfg=ROLE_CONFIG[role],pct=stats.totalUsers>0?(cnt/stats.totalUsers)*100:0;return<div key={role} style={{marginBottom:13}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:6,height:6,borderRadius:"50%",background:cfg.color}}/><span style={{fontSize:12,color:"#6ee7b7"}}>{cfg.label}</span></div><span style={{fontSize:13,fontWeight:800,color:"#d1fae5"}}>{cnt}</span></div><div style={{height:4,borderRadius:2,background:"rgba(52,211,153,.08)"}}><div style={{height:"100%",width:`${pct}%`,borderRadius:2,background:cfg.color,transition:"width .6s"}}/></div></div>;})}</div><div style={{background:"rgba(52,211,153,.03)",borderRadius:14,padding:20,border:"1px solid rgba(52,211,153,.09)"}}><div style={{fontSize:11,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",marginBottom:16,display:"flex",alignItems:"center",gap:7}}><Trash2 size={13} color="#34d399"/>Bin Network Health</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{label:"Total Bins",value:stats.totalBins,color:"#34d399"},{label:"Critical",value:stats.criticalBins,color:"#f87171"},{label:"High Fill",value:stats.highBins,color:"#fcd34d"},{label:"Collections",value:stats.totalCollections,color:"#6ee7b7"}].map(s=>(<div key={s.label} style={{background:`${s.color}08`,borderRadius:10,padding:"14px 16px",border:`1px solid ${s.color}18`}}><div style={{fontSize:24,fontWeight:900,color:s.color,fontFamily:"Georgia,serif",lineHeight:1}}>{s.value}</div><div style={{fontSize:11,color:"#374151",marginTop:4}}>{s.label}</div></div>))}</div></div><div style={{background:"rgba(52,211,153,.03)",borderRadius:14,padding:20,border:"1px solid rgba(52,211,153,.09)"}}><div style={{fontSize:11,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",marginBottom:16,display:"flex",alignItems:"center",gap:7}}><AlertTriangle size={13} color="#f59e0b"/>Violations & Reports</div>{[{label:"Pending Violations",val:citizens.reduce((a,c)=>a+(c.violations?.filter(v=>v.status==="Pending").length??0),0),color:"#f59e0b"},{label:"Under Review",val:citizens.reduce((a,c)=>a+(c.violations?.filter(v=>v.status==="Under Review").length??0),0),color:"#60a5fa"},{label:"Resolved",val:citizens.reduce((a,c)=>a+(c.violations?.filter(v=>v.status==="Resolved").length??0),0),color:"#34d399"},{label:"Citizen Reports",val:stats.totalReports,color:"#c4b5fd"}].map(s=>(<div key={s.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(52,211,153,.06)"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:s.color}}/><span style={{fontSize:13,color:"#6ee7b7"}}>{s.label}</span></div><span style={{fontSize:16,fontWeight:800,color:s.color,fontFamily:"Georgia,serif"}}>{s.val}</span></div>))}</div><div style={{background:"rgba(52,211,153,.03)",borderRadius:14,padding:20,border:"1px solid rgba(52,211,153,.09)"}}><div style={{fontSize:11,fontWeight:800,color:"#374151",letterSpacing:".1em",textTransform:"uppercase",marginBottom:16,display:"flex",alignItems:"center",gap:7}}><MapPin size={13} color="#fcd34d"/>LGU Coverage</div>{users.filter(u=>u.role==="LGU").length===0?<p style={{fontSize:13,color:"#374151",margin:0}}>No LGU accounts yet.</p>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{users.filter(u=>u.role==="LGU").map(u=>{const cc=citizens.filter(c=>c.barangay===u.barangay).length;return<div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,background:"rgba(52,211,153,.04)",border:`1px solid ${u.barangay?"rgba(52,211,153,.12)":"rgba(245,158,11,.2)"}`}}><div style={{width:7,height:7,borderRadius:"50%",background:u.barangay?"#34d399":"#f59e0b",flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#d1fae5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name}</div><div style={{fontSize:11,color:u.barangay?"#fcd34d":"#f59e0b"}}>{u.barangay??"Unassigned"}</div></div><span style={{fontSize:11,fontWeight:700,color:"#34d399"}}>{cc} citizens</span></div>;})} </div>}</div></div>)}
              {activeTab==="settings"&&(<div style={{padding:24}}><div style={{marginBottom:20}}><div style={{fontSize:13,fontWeight:700,color:"#34d399",marginBottom:4}}>System Configuration</div><p style={{fontSize:12,color:"#374151",margin:0}}>Stored in <code style={{color:"#6ee7b7"}}>system_settings</code> table.</p></div><div style={{display:"flex",flexDirection:"column",gap:6}}>{settings.map(s=>(<div key={s.key} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderRadius:10,background:"rgba(52,211,153,.03)",border:"1px solid rgba(52,211,153,.08)",flexWrap:"wrap"}}><div style={{flex:1,minWidth:200}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><span style={{fontFamily:"monospace",fontSize:12,color:"#6ee7b7"}}>{s.key}</span><span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:8,background:s.is_public?"rgba(52,211,153,.15)":"rgba(245,158,11,.15)",color:s.is_public?"#34d399":"#fcd34d"}}>{s.is_public?"PUBLIC":"PRIVATE"}</span></div>{s.description&&<div style={{fontSize:11,color:"#374151"}}>{s.description}</div>}</div>{editingKey===s.key?(<div style={{display:"flex",gap:8,alignItems:"center"}}><input value={editingVal} onChange={e=>setEditingVal(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(52,211,153,.3)",background:"rgba(52,211,153,.06)",color:"#d1fae5",fontSize:13,outline:"none",fontFamily:"monospace",width:140}}/><button onClick={()=>saveSetting(s.key,editingVal)} style={{padding:"6px 12px",borderRadius:8,background:"#065f46",color:"#d1fae5",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif"}}>Save</button><button onClick={()=>setEditingKey(null)} style={{padding:"6px 12px",borderRadius:8,background:"rgba(255,255,255,.05)",color:"#374151",border:"1px solid rgba(255,255,255,.08)",fontSize:12,cursor:"pointer",fontFamily:"sans-serif"}}>Cancel</button></div>):(<div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontFamily:"monospace",fontSize:13,color:"#a7f3d0",background:"rgba(52,211,153,.08)",padding:"4px 10px",borderRadius:6}}>{JSON.stringify(s.value)}</span><button onClick={()=>{setEditingKey(s.key);setEditingVal(JSON.stringify(s.value));}} style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:7,background:"rgba(52,211,153,.06)",color:"#34d399",border:"1px solid rgba(52,211,153,.2)",cursor:"pointer",fontFamily:"sans-serif"}}>Edit</button></div>)}</div>))}</div></div>)}
            </div>
          </div>
        </div>
      </main>

      {/* Profile slide-over — top:64px keeps topnav visible */}
      {showProfile&&<SuperAdminProfilePanel meId={meId} meName={meName} onClose={()=>setShowProfile(false)}/>}

      {/* Logout modal */}
      {showLogout&&(<div className="fixed inset-0 z-[3000] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)"}}><div style={{background:"#061020",borderRadius:24,border:"1px solid rgba(52,211,153,.25)",width:"100%",maxWidth:360,padding:"32px",boxShadow:"0 32px 80px rgba(0,0,0,.8)",animation:"fadeUp .2s ease both",textAlign:"center"}}><div style={{width:64,height:64,borderRadius:18,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><LogOut size={28} color="#f87171"/></div><h2 style={{fontSize:22,fontWeight:900,color:"#d1fae5",margin:"0 0 8px"}}>End Session?</h2><p style={{fontSize:12,color:"#374151",margin:"0 0 28px",lineHeight:1.6}}>You are about to sign out of the Super Admin portal.</p><div style={{display:"flex",flexDirection:"column",gap:10}}><button onClick={handleSignOut} disabled={isLoggingOut} style={{width:"100%",padding:"14px",borderRadius:12,background:"#dc2626",color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:".08em",opacity:isLoggingOut?.6:1}}>{isLoggingOut?"Signing out…":"Confirm & Sign Out"}</button><button onClick={()=>setShowLogout(false)} disabled={isLoggingOut} style={{width:"100%",padding:"14px",borderRadius:12,background:"rgba(255,255,255,.05)",color:"#374151",border:"1px solid rgba(255,255,255,.08)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:".08em"}}>Stay Active</button></div></div></div>)}

      {assignTarget&&<AssignBarangayModal user={assignTarget} meId={meId} onClose={()=>setAssignTarget(null)} onSuccess={fetchData}/>}
      {notifyTarget&&<SendNotifModal user={notifyTarget} meId={meId} onClose={()=>setNotifyTarget(null)}/>}
    </div>
  );
}