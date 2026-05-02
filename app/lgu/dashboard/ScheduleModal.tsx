"use client";
// app/lgu/dashboard/ScheduleModal.tsx

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Calendar, Truck, User, MapPin, Trash2, Info, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { THEME, VEHICLE_TYPES, DAYS, DAYS_FULL, INP, fmtTime } from "./_constants";
import { Modal, MHead, MFooter, BtnCancel, BtnPrimary } from "./_shared";
import type { LGUProfile, Schedule, AssignedDriver, AreaBin } from "./_types";

const supabase = createClient();

async function fetchLocationSuggestions(barangay:string, municipality:string): Promise<string[]> {
  try {
    const q = encodeURIComponent(`${barangay}, ${municipality}, Davao Oriental, Philippines`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=20&countrycodes=ph`,
      { headers: { "Accept-Language":"en", "User-Agent":"EcoRoute/1.0" } }
    );
    const data = await res.json();
    const places: string[] = [];
    const seen = new Set<string>();
    for (const item of data) {
      const addr = item.address ?? {};
      const candidates = [
        addr.suburb, addr.village, addr.quarter, addr.neighbourhood,
        addr.residential, addr.road, addr.pedestrian, addr.hamlet,
      ].filter(Boolean) as string[];
      for (const c of candidates) {
        const key = c.toLowerCase();
        if (!seen.has(key) && c.length < 60) { seen.add(key); places.push(c); }
      }
    }
    const generic = ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5",
                     "Purok 6","Sitio Area","Main Road","Market Area",
                     "Coastal Area","Commercial Zone","Residential Zone"];
    for (const g of generic) if (!seen.has(g.toLowerCase())) places.push(g);
    return places.slice(0, 30);
  } catch {
    return ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5","Purok 6",
            "Sitio Area","Main Road","Market Area","Coastal Area"];
  }
}

export default function ScheduleModal({profile,schedule,onClose,onRefresh}:{profile:LGUProfile;schedule?:Schedule;onClose:()=>void;onRefresh:()=>void}) {
  const [label,          setLabel]          = useState(schedule?.label??"");
  const [dow,            setDow]            = useState<number>(schedule?.day_of_week??1);
  const [time,           setTime]           = useState(schedule?.scheduled_time??"07:00");
  const [types,          setTypes]          = useState<string[]>(schedule?.waste_types??[]);
  const [notes,          setNotes]          = useState(schedule?.notes??"");
  const [driverId,       setDriverId]       = useState<string>(schedule?.driver_id??"");
  const [vehicleType,    setVehicleType]    = useState(schedule?.vehicle_type??"Dump Truck");
  const [collectionArea, setCollectionArea] = useState(schedule?.collection_area??"");
  const [customAreaText, setCustomAreaText] = useState("");
  const [binIds,         setBinIds]         = useState<string[]>(schedule?.bin_ids??[]);
  const [saving,         setSaving]         = useState(false);
  const [saveErr,        setSaveErr]        = useState("");

  const [drivers,        setDrivers]        = useState<AssignedDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);

  const [areaSuggestions,setAreaSuggestions]= useState<string[]>([]);
  const [areasLoading,   setAreasLoading]   = useState(true);
  const [useCustomArea,  setUseCustomArea]  = useState(false);

  const [areaBins,       setAreaBins]       = useState<AreaBin[]>([]);
  const [binsLoading,    setBinsLoading]    = useState(false);
  const [binsErr,        setBinsErr]        = useState("");

  const WASTE = ["Biodegradable","Recyclable","Residual","Hazardous"];
  const toggleType = (t:string) => setTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]);
  const toggleBin  = (id:string) => setBinIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  useEffect(()=>{
    setAreasLoading(true);
    fetchLocationSuggestions(profile.barangay, profile.municipality)
      .then(s=>{ setAreaSuggestions(s); setAreasLoading(false); });
  },[profile.barangay,profile.municipality]);

  useEffect(()=>{
    (async()=>{
      const {data:dds} = await supabase
        .from("driver_details")
        .select("id,duty_status,license_number,vehicle_plate_number,assigned_route,employment_status")
        .eq("employment_status","ACTIVE");
      if (!dds||dds.length===0){setDriversLoading(false);return;}
      const ids = dds.map((d:any)=>d.id);
      const {data:profs} = await supabase
        .from("profiles").select("id,full_name").in("id",ids).eq("role","DRIVER").eq("is_archived",false);
      const profMap = Object.fromEntries((profs??[]).map((p:any)=>[p.id,p.full_name]));
      setDrivers((dds??[])
        .filter((d:any)=>profMap[d.id])
        .map((d:any)=>({
          id:d.id,
          full_name:profMap[d.id]??"Driver",
          duty_status:d.duty_status??"OFF-DUTY",
          vehicle_plate_number:d.vehicle_plate_number??null,
          license_number:d.license_number??null,
        }))
      );
      setDriversLoading(false);
    })();
  },[]);

  useEffect(()=>{
    const area = useCustomArea ? customAreaText : collectionArea;
    if (!area.trim() && area !== "") { setAreaBins([]); return; }
    setBinsLoading(true); setBinsErr("");
    (async()=>{
      const {data:bins,error} = await supabase
        .from("bins")
        .select("id,name,fill_level,lat,lng,device_id");
      if (error) {
        setBinsErr("Could not load bins: "+error.message);
        setBinsLoading(false); return;
      }
      const areaLower = area.toLowerCase();
      const filtered = (bins??[]).filter((b:any)=>{
        if (!area.trim()) return true;
        return (b.name??"").toLowerCase().includes(areaLower) ||
               areaLower.includes((b.name??"").toLowerCase().split(" ")[0]);
      });
      setAreaBins(filtered.map((b:any)=>({...b, barangay:profile.barangay})));
      if (!schedule && filtered.length>0) {
        setBinIds(filtered.filter((b:any)=>b.fill_level>=40).map((b:any)=>String(b.id)));
      }
      setBinsLoading(false);
    })();
  },[collectionArea,customAreaText,useCustomArea,profile.barangay,schedule]);

  const selectedDriver = drivers.find(d=>d.id===driverId);
  const effectiveArea  = useCustomArea ? customAreaText : collectionArea;

  const save = async () => {
    if (!label.trim()||types.length===0){setSaveErr("Label and at least one waste type are required.");return;}
    setSaving(true); setSaveErr("");

    const basePayload:any = {
      label:           label.trim(),
      barangay:        profile.barangay,
      municipality:    profile.municipality||null,
      day_of_week:     dow,
      scheduled_time:  time,
      waste_types:     types,
      notes:           notes.trim()||null,
      is_active:       true,
      created_by:      profile.id,
    };

    const extendedPayload:any = {
      ...basePayload,
      driver_id:       driverId||null,
      vehicle_type:    vehicleType||null,
      collection_area: effectiveArea.trim()||null,
      bin_ids:         binIds.length>0?binIds:null,
    };

    let opError:any=null, savedId:string|null=null;

    const doUpsert = async (payload:any) => {
      if (schedule) {
        const {error} = await supabase.from("collection_schedules").update(payload).eq("id",schedule.id);
        return {error, id:schedule.id};
      } else {
        const {data,error} = await supabase.from("collection_schedules").insert(payload).select("id").single();
        return {error, id:data?.id??null};
      }
    };

    let result = await doUpsert(extendedPayload);
    if (result.error?.code==="PGRST204") {
      result = await doUpsert(basePayload);
    }

    opError = result.error; savedId = result.id;

    if (opError) {
      setSaveErr(opError.message||"Save failed.");
      setSaving(false); return;
    }

    await supabase.from("audit_logs").insert({
      admin_id:    profile.id,
      action_type: schedule?"LGU_UPDATE_SCHEDULE":"LGU_CREATE_SCHEDULE",
      target_id:   savedId??"new",
      reason:      `${schedule?"Updated":"Created"} schedule "${label}" for Barangay ${profile.barangay}${driverId?` — assigned to ${selectedDriver?.full_name}`:""}`,
    });

    if (driverId && savedId) {
      const { data: existingRows } = await supabase
        .from("schedule_assignments")
        .select("id")
        .eq("schedule_id", savedId)
        .eq("driver_id",   driverId)
        .eq("is_active",   true)
        .limit(1);

      const alreadyAssigned = (existingRows ?? []).length > 0;

      if (!alreadyAssigned) {
        await supabase.from("schedule_assignments")
          .update({ is_active: false })
          .eq("schedule_id", savedId)
          .eq("is_active",   true);
        await supabase.from("schedule_assignments").insert({
          schedule_id: savedId,
          driver_id:   driverId,
          assigned_by: profile.id,
          is_active:   true,
        });
        
        const binCount = binIds.length;
        await supabase.from("notifications").insert({
          user_id:    driverId,
          type:       "COLLECTION_REMINDER",
          title:      `Collection Schedule: ${label}`,
          body:       `You have been assigned a collection route on ${DAYS[dow]} at ${fmtTime(time)}. Area: ${effectiveArea||profile.barangay}. ${binCount>0?`${binCount} bin${binCount!==1?"s":""} in route.`:""}${notes?` Note: ${notes}`:""}`,
          created_by: profile.id,
          metadata: {
            schedule_id:     savedId,
            day_of_week:     dow,
            scheduled_time:  time,
            collection_area: effectiveArea,
            vehicle_type:    vehicleType,
            bin_ids:         binIds,
            waste_types:     types,
          },
        });
      }
    }

    setSaving(false);
    onRefresh();
    onClose();
  };

  return (
    <Modal onClose={onClose} wide>
      <MHead title={schedule?"Edit Logistics Node":"Configure Logistics Node"} sub={`Protocol Node: Barangay ${profile.barangay}`} icon={Calendar} onClose={onClose}/>
      
      <div className="no-scrollbar" style={{padding:"24px",display:"flex",flexDirection:"column",gap:24,overflowY:"auto",minHeight:0}}>

        {/* Basic Schedule Configuration */}
        <div style={{background:"#f9fafb",borderRadius:16,padding:"20px",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",marginBottom:16, display: "flex", alignItems: "center", gap: 8}}>
            <Clock size={14} className="text-[#1c4532]" /> Temporal Configuration
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Protocol Label</label>
              <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Primary Alpha Collection Run" style={INP}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Operational Day</label>
                <select value={dow} onChange={e=>setDow(Number(e.target.value))} style={INP}>
                  {DAYS.map((d,i)=><option key={i} value={i}>{DAYS_FULL[i]}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Departure Signal</label>
                <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={INP}/>
              </div>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:8}}>Waste Classification Protocols</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {WASTE.map(w=>(
                  <button key={w} onClick={()=>toggleType(w)} style={{padding:"8px 16px",borderRadius:12,border:`1px solid ${types.includes(w)?THEME.primary:THEME.border}`,background:types.includes(w)?THEME.accent:"#fff",color:types.includes(w)?THEME.primary:THEME.text,fontSize:11,fontWeight:900,cursor:"pointer", textTransform: "uppercase", transition: "all 0.2s"}}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Resources Configuration */}
        <div style={{background:"#fff",borderRadius:16,padding:"20px",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",marginBottom:16, display: "flex", alignItems: "center", gap: 8}}>
            <Truck size={14} className="text-[#1c4532]" /> Resource Allocation
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Assigned Operator Node</label>
              {driversLoading?(
                <div style={{...INP,color:"#9ca3af",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${THEME.border}`,borderTopColor:THEME.primary,animation:"spin 1s linear infinite"}}/>
                  Syncing operator registry…
                </div>
              ):drivers.length===0?(
                <div style={{...INP,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca", fontWeight: 700}}>
                  ⚠ Critical: No active operator nodes detected in registry.
                </div>
              ):(
                <select value={driverId} onChange={e=>setDriverId(e.target.value)} style={INP}>
                  <option value="">— UNASSIGNED NODE —</option>
                  {drivers.map(d=>(
                    <option key={d.id} value={d.id}>
                      {d.full_name.toUpperCase()} {d.vehicle_plate_number?`[${d.vehicle_plate_number}]`:""} · {d.duty_status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedDriver&&(
              <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px",borderRadius:16,background:"#f9fafb",border:`1px solid ${THEME.border}`, animation: "fadeInUp 0.4s ease both"}}>
                <div style={{width:44,height:44,borderRadius:12,background:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0, border: `1px solid ${THEME.primary}10`}}>
                  <User size={22} className="text-[#1c4532]" />
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:900,color:THEME.text, textTransform: "uppercase"}}>{selectedDriver.full_name}</div>
                  <div style={{fontSize:10,color:THEME.textMuted,marginTop:2, fontWeight: 700, textTransform: "uppercase"}}>
                    {selectedDriver.vehicle_plate_number?`Unit: ${selectedDriver.vehicle_plate_number}`:""}{selectedDriver.license_number?` · Cred: ${selectedDriver.license_number}`:""}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:selectedDriver.duty_status==="ON-DUTY"?"#059669":"#94a3b8", animation: selectedDriver.duty_status==="ON-DUTY" ? "pulse 2s infinite" : "none"}}/>
                    <span style={{fontSize:10,color:selectedDriver.duty_status==="ON-DUTY"?"#059669":"#64748b",fontWeight:900, textTransform: "uppercase"}}>{selectedDriver.duty_status}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Vehicle Unit Classification</label>
              <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} style={INP}>
                {VEHICLE_TYPES.map(v=><option key={v}>{v.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Spatial Configuration */}
        <div style={{background:"#f9fafb",borderRadius:16,padding:"20px",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4, display: "flex", alignItems: "center", gap: 8}}>
            <MapPin size={14} className="text-[#1c4532]" /> Spatial Intelligence
          </div>
          <div style={{fontSize:10,color:THEME.textMuted,marginBottom:16, fontWeight: 600, textTransform: "uppercase"}}>OSM Telemetry Data: {profile.barangay} Node</div>
          
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {!useCustomArea?(
              <div>
                <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Operational Zone / Purok</label>
                {areasLoading?(
                  <div style={{...INP,color:"#9ca3af",display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${THEME.border}`,borderTopColor:THEME.primary,animation:"spin 1s linear infinite"}}/>
                    Polling OSM data…
                  </div>
                ):(
                  <select value={collectionArea} onChange={e=>setCollectionArea(e.target.value)} style={INP}>
                    <option value="">— GLOBAL BARANGAY SCAN —</option>
                    {areaSuggestions.map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}
                  </select>
                )}
                <button onClick={()=>setUseCustomArea(true)} style={{fontSize:10,color:THEME.primary,background:"none",border:"none",cursor:"pointer",marginTop:8,padding:0,textDecoration:"underline", fontWeight: 800, textTransform: "uppercase"}}>Type custom zone →</button>
              </div>
            ):(
              <div>
                <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Manual Zone Entry</label>
                <input value={customAreaText} onChange={e=>setCustomAreaText(e.target.value)} placeholder={`e.g. Sitio Mabolo Node, ${profile.barangay}`} style={INP} autoFocus />
                <button onClick={()=>{setUseCustomArea(false);setCustomAreaText("");}} style={{fontSize:10,color:THEME.primary,background:"none",border:"none",cursor:"pointer",marginTop:8,padding:0,textDecoration:"underline", fontWeight: 800, textTransform: "uppercase"}}>← Telemetry suggestions</button>
              </div>
            )}
          </div>
        </div>

        {/* Target Bins Configuration */}
        <div style={{background:"#fff",borderRadius:16,padding:"20px",border:`1px solid ${THEME.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase", display: "flex", alignItems: "center", gap: 8}}>
              <Trash2 size={14} className="text-[#1c4532]" /> Smart Bins in Route {areaBins.length>0&&`(${areaBins.length})`}
            </div>
            {areaBins.length>0&&(
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setBinIds(areaBins.map(b=>String(b.id)))} style={{fontSize:9,fontWeight:900,padding:"4px 10px",borderRadius:8,background:"#f1f5f9",color:THEME.text,border:"none",cursor:"pointer", textTransform: "uppercase"}}>All</button>
                <button onClick={()=>setBinIds(areaBins.filter(b=>b.fill_level>=40).map(b=>String(b.id)))} style={{fontSize:9,fontWeight:900,padding:"4px 10px",borderRadius:8,background:"#fef3c7",color:"#92400e",border:"none",cursor:"pointer", textTransform: "uppercase"}}>≥40%</button>
              </div>
            )}
          </div>

          {binsErr?(
            <div style={{padding:"12px",borderRadius:12,background:"#fef2f2",border:"1px solid #fecaca",fontSize:11,color:"#dc2626", fontWeight: 700}}>{binsErr}</div>
          ):binsLoading?(
            <div style={{padding:20,textAlign:"center",color:"#9ca3af",fontSize:11, fontWeight: 700, textTransform: "uppercase"}}>Querying Smart Bins…</div>
          ):areaBins.length===0?(
            <div style={{padding:24,textAlign:"center",color:THEME.textMuted,fontSize:11,background:"#f9fafb",borderRadius:16,border:`1px solid ${THEME.border}`, fontWeight: 700, textTransform: "uppercase"}}>
              {effectiveArea ? `No active bins detected in "${effectiveArea}"` : `Awaiting spatial zone selection…`}
            </div>
          ):(
            <div className="no-scrollbar" style={{display:"flex",flexDirection:"column",gap:8,maxHeight:240,overflowY:"auto"}}>
              {areaBins.map(b=>{
                const checked = binIds.includes(String(b.id));
                const fc = b.fill_level>=90?"#dc2626":b.fill_level>=70?"#ea580c":b.fill_level>=40?"#d97706":"#059669";
                return(
                  <label key={b.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:16,background:checked?THEME.accent:"#fff",border:`1px solid ${checked?THEME.primary:THEME.border}`,cursor:"pointer", transition: "all 0.2s"}}>
                    <input type="checkbox" checked={checked} onChange={()=>toggleBin(String(b.id))} style={{accentColor:THEME.primary,width:16,height:16,flexShrink:0,cursor:"pointer"}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:900,color:THEME.text, textTransform: "uppercase"}}>{b.name}</div>
                      {b.device_id&&<div style={{fontSize:9,color:THEME.textMuted, fontWeight: 700}}>ID: {b.device_id.toUpperCase()}</div>}
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:900,color:fc}}>{b.fill_level}%</div>
                      <div style={{width:48,height:4,borderRadius:2,background:"#e2e8f0",marginTop:4, overflow: "hidden"}}>
                        <div style={{width:`${b.fill_level}%`,height:"100%",background:fc}}/>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {binIds.length>0&&(
            <div style={{padding:"10px 14px",borderRadius:12,background:THEME.accent,border:`1px solid ${THEME.primary}20`,fontSize:11,color:THEME.primary,marginTop:12, fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8}}>
              <CheckCircle size={14} /> {binIds.length} Bins locked into route protocol
            </div>
          )}
        </div>

        {/* Final Settings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div>
            <label style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",display:"block",marginBottom:6}}>Administrative Instructions</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="e.g. Priority collection for market district bins, follow secondary access roads if flooding persists…" style={{...INP,resize:"none",lineHeight:1.6}}/>
          </div>

          <div style={{padding:"14px",borderRadius:16,background:"#fffbeb",border:"1px solid #fde68a",fontSize:11,color:"#78350f",display:"flex",gap:10,alignItems:"flex-start", fontWeight: 600}}>
            <Info size={18} className="shrink-0 mt-0.5 text-amber-600" />
            <div style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Protocol Signal: Driver assignment and spatial telemetry require system-wide sync. Confirm details before deployment.
            </div>
          </div>
        </div>

        {saveErr&&(
          <div style={{padding:"12px 16px",borderRadius:12,background:"#fef2f2",border:"1px solid #fecaca",fontSize:11,color:"#dc2626",display:"flex",gap:8,alignItems:"center", fontWeight: 900, textTransform: "uppercase"}}>
            <AlertTriangle size={16}/>{saveErr}
          </div>
        )}
      </div>

      <MFooter>
        <BtnCancel onClick={onClose}/>
        <BtnPrimary onClick={save} disabled={!label||types.length===0||saving}>
          {saving?"Syncing Protocol…":schedule?"Update Node":"Deploy Route Protocol"}
        </BtnPrimary>
      </MFooter>
    </Modal>
  );
}