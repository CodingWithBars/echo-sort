"use client";
// app/lgu/dashboard/ScheduleModal.tsx

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Calendar } from "lucide-react";
import { EM, VEHICLE_TYPES, DAYS, DAYS_FULL, INP, fmtTime } from "./_constants";
import { Modal, MHead, MFooter, BtnCancel, BtnPrimary } from "./_shared";
import type { LGUProfile, Schedule, AssignedDriver, AreaBin } from "./_types";

const supabase = createClient();

// VEHICLE_TYPES imported from ./_constants

// Fetch puroks/streets from Nominatim for a given barangay + municipality
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
      // Collect suburb / village / quarter / neighbourhood / road
      const candidates = [
        addr.suburb, addr.village, addr.quarter, addr.neighbourhood,
        addr.residential, addr.road, addr.pedestrian, addr.hamlet,
      ].filter(Boolean) as string[];
      for (const c of candidates) {
        const key = c.toLowerCase();
        if (!seen.has(key) && c.length < 60) { seen.add(key); places.push(c); }
      }
    }
    // Deduplicate and add generic purok names as fallback
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

  // Drivers
  const [drivers,        setDrivers]        = useState<AssignedDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);

  // Area suggestions (Nominatim)
  const [areaSuggestions,setAreaSuggestions]= useState<string[]>([]);
  const [areasLoading,   setAreasLoading]   = useState(true);
  const [useCustomArea,  setUseCustomArea]  = useState(false);

  // Bins
  const [areaBins,       setAreaBins]       = useState<AreaBin[]>([]);
  const [binsLoading,    setBinsLoading]    = useState(false);
  const [binsErr,        setBinsErr]        = useState("");

  const WASTE = ["Biodegradable","Recyclable","Residual","Hazardous"];
  const toggleType = (t:string) => setTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]);
  const toggleBin  = (id:string) => setBinIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  // ── Load location suggestions from Nominatim ──────────────────────────────
  useEffect(()=>{
    setAreasLoading(true);
    fetchLocationSuggestions(profile.barangay, profile.municipality)
      .then(s=>{ setAreaSuggestions(s); setAreasLoading(false); });
  },[profile.barangay,profile.municipality]);

  // ── Load drivers (all active drivers — filtered by barangay via schedule_assignments) ──
  useEffect(()=>{
    (async()=>{
      // Get driver profiles
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
        .filter((d:any)=>profMap[d.id]) // only drivers with profiles
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

  // ── Load bins when area changes ──────────────────────────────────────────
  useEffect(()=>{
    const area = useCustomArea ? customAreaText : collectionArea;
    if (!area.trim() && area !== "") { setAreaBins([]); return; }
    setBinsLoading(true); setBinsErr("");
    (async()=>{
      // bins table has: id, device_id, name, lat, lng, fill_level, last_seen, battery_level
      // NO barangay column in schema — fetch all bins, filter by name match
      const {data:bins,error} = await supabase
        .from("bins")
        .select("id,name,fill_level,lat,lng,device_id");
      if (error) {
        setBinsErr("Could not load bins: "+error.message);
        setBinsLoading(false); return;
      }
      // Filter by area keyword match (name contains area, or show all if blank)
      const areaLower = area.toLowerCase();
      const filtered = (bins??[]).filter((b:any)=>{
        if (!area.trim()) return true; // show all if no area selected
        return (b.name??"").toLowerCase().includes(areaLower) ||
               areaLower.includes((b.name??"").toLowerCase().split(" ")[0]);
      });
      setAreaBins(filtered.map((b:any)=>({...b, barangay:profile.barangay})));
      // Auto-select ≥40% fill bins when creating new schedule
      if (!schedule && filtered.length>0) {
        setBinIds(filtered.filter((b:any)=>b.fill_level>=40).map((b:any)=>String(b.id)));
      }
      setBinsLoading(false);
    })();
  },[collectionArea,customAreaText,useCustomArea,profile.barangay]);

  const selectedDriver = drivers.find(d=>d.id===driverId);
  const effectiveArea  = useCustomArea ? customAreaText : collectionArea;

  const save = async () => {
    if (!label.trim()||types.length===0){setSaveErr("Label and at least one waste type are required.");return;}
    setSaving(true); setSaveErr("");

    // Base payload — only columns that EXIST in collection_schedules schema
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

    // Extended columns — only include if the migration SQL has been run.
    // If PGRST204 (column not found) is returned, we strip them and retry.
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

    // Try with extended columns first
    let result = await doUpsert(extendedPayload);
    if (result.error?.code==="PGRST204") {
      // Extended columns not in schema yet — fall back to base payload
      console.warn("Extended schedule columns not found — run migration SQL. Saving base fields only.");
      result = await doUpsert(basePayload);
    }

    opError = result.error; savedId = result.id;

    if (opError) {
      console.error("collection_schedules save:",opError);
      setSaveErr(opError.message||"Save failed.");
      setSaving(false); return;
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_id:    profile.id,
      action_type: schedule?"LGU_UPDATE_SCHEDULE":"LGU_CREATE_SCHEDULE",
      target_id:   savedId??"new",
      reason:      `${schedule?"Updated":"Created"} schedule "${label}" for Barangay ${profile.barangay}${driverId?` — assigned to ${selectedDriver?.full_name}`:""}`,
    });

    // Use schedule_assignments table for driver assignment (proper join table)
    if (driverId && savedId) {
      // Use .limit(1) array check — safer than .maybeSingle() which can throw 406.
      const { data: existingRows } = await supabase
        .from("schedule_assignments")
        .select("id")
        .eq("schedule_id", savedId)
        .eq("driver_id",   driverId)
        .eq("is_active",   true)
        .limit(1);

      const alreadyAssigned = (existingRows ?? []).length > 0;

      if (!alreadyAssigned) {
        // Deactivate any other active assignments for this schedule first
        await supabase.from("schedule_assignments")
          .update({ is_active: false })
          .eq("schedule_id", savedId)
          .eq("is_active",   true);
        // Insert the new assignment
        await supabase.from("schedule_assignments").insert({
          schedule_id: savedId,
          driver_id:   driverId,
          assigned_by: profile.id,
          is_active:   true,
        });
      }

      // Notify driver only on new assignment (not when re-saving same driver)
      if (!alreadyAssigned) {
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
      <MHead title={schedule?"Edit Schedule":"New Collection Schedule"} sub={`${profile.barangay} · ${profile.municipality}`} icon={Calendar} onClose={onClose}/>
      <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:16,overflowY:"auto",minHeight:0}}>

        {/* ── SECTION 1: BASIC INFO ── */}
        <div style={{background:EM[50],borderRadius:12,padding:"14px 16px",border:`1px solid ${EM[100]}`}}>
          <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>📋 Schedule Details</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Schedule Label *</label>
              <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Monday Morning Collection Run" style={INP}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Day of Week</label>
                <select value={dow} onChange={e=>setDow(Number(e.target.value))} style={INP}>
                  {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Departure Time</label>
                <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={INP}/>
              </div>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:8}}>Waste Types *</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {WASTE.map(w=>(
                  <button key={w} onClick={()=>toggleType(w)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${types.includes(w)?EM[400]:EM[100]}`,background:types.includes(w)?EM[100]:"#fff",color:types.includes(w)?EM[800]:"#6b7280",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: DRIVER + VEHICLE ── */}
        <div style={{background:EM[50],borderRadius:12,padding:"14px 16px",border:`1px solid ${EM[100]}`}}>
          <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>🚛 Driver & Vehicle</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Assigned Driver</label>
              {driversLoading?(
                <div style={{...INP,color:"#9ca3af",fontStyle:"italic",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${EM[200]}`,borderTopColor:EM[600],animation:"spin 1s linear infinite"}}/>
                  Loading drivers…
                </div>
              ):drivers.length===0?(
                <div style={{...INP,color:"#f59e0b",background:"#fffbeb",border:"1.5px solid #fde68a"}}>
                  ⚠ No active drivers found. Drivers must be added by a Super Admin.
                </div>
              ):(
                <select value={driverId} onChange={e=>setDriverId(e.target.value)} style={INP}>
                  <option value="">— Unassigned (optional) —</option>
                  {drivers.map(d=>(
                    <option key={d.id} value={d.id}>
                      {d.full_name}{d.vehicle_plate_number?` · ${d.vehicle_plate_number}`:""} · {d.duty_status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedDriver&&(
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,background:"#fff",border:`1.5px solid ${EM[200]}`}}>
                <div style={{width:38,height:38,borderRadius:10,background:EM[100],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🚛</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:EM[900]}}>{selectedDriver.full_name}</div>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>
                    {selectedDriver.vehicle_plate_number?`Plate: ${selectedDriver.vehicle_plate_number}`:""}{selectedDriver.license_number?` · Lic: ${selectedDriver.license_number}`:""}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:selectedDriver.duty_status==="ON-DUTY"?EM[500]:"#9ca3af"}}/>
                    <span style={{fontSize:11,color:selectedDriver.duty_status==="ON-DUTY"?EM[600]:"#9ca3af",fontWeight:600}}>{selectedDriver.duty_status}</span>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8,background:EM[50],color:EM[700],border:`1px solid ${EM[200]}`}}>Assigned ✓</div>
              </div>
            )}

            <div>
              <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Vehicle Type</label>
              <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} style={INP}>
                {VEHICLE_TYPES.map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: COLLECTION AREA ── */}
        <div style={{background:EM[50],borderRadius:12,padding:"14px 16px",border:`1px solid ${EM[100]}`}}>
          <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>📍 Collection Area</div>
          <div style={{fontSize:11,color:EM[600],marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
            <span>🌐</span>
            <span>Locations based on <strong>{profile.barangay}, {profile.municipality}</strong> via OpenStreetMap</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {!useCustomArea?(
              <div>
                <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Select Area / Purok / Street</label>
                {areasLoading?(
                  <div style={{...INP,color:"#9ca3af",fontStyle:"italic",display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${EM[200]}`,borderTopColor:EM[600],animation:"spin 1s linear infinite"}}/>
                    Fetching locations for {profile.barangay}…
                  </div>
                ):(
                  <select value={collectionArea} onChange={e=>setCollectionArea(e.target.value)} style={INP}>
                    <option value="">— All bins in {profile.barangay} —</option>
                    {areaSuggestions.map(a=><option key={a} value={a}>{a}</option>)}
                  </select>
                )}
                <button onClick={()=>setUseCustomArea(true)} style={{fontSize:11,color:EM[600],background:"none",border:"none",cursor:"pointer",marginTop:6,padding:0,textDecoration:"underline"}}>
                  Type a custom location instead →
                </button>
              </div>
            ):(
              <div>
                <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Custom Location</label>
                <input
                  value={customAreaText}
                  onChange={e=>setCustomAreaText(e.target.value)}
                  placeholder={`e.g. Sitio Mabolo, ${profile.barangay}`}
                  style={INP}
                  autoFocus
                />
                <button onClick={()=>{setUseCustomArea(false);setCustomAreaText("");}} style={{fontSize:11,color:EM[600],background:"none",border:"none",cursor:"pointer",marginTop:6,padding:0,textDecoration:"underline"}}>
                  ← Back to suggestions
                </button>
              </div>
            )}
            {effectiveArea&&(
              <div style={{padding:"8px 12px",borderRadius:8,background:"#fff",border:`1px solid ${EM[200]}`,fontSize:12,color:EM[700]}}>
                📍 Collection area set to: <strong>{effectiveArea}</strong>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 4: BINS IN ROUTE ── */}
        <div style={{background:EM[50],borderRadius:12,padding:"14px 16px",border:`1px solid ${EM[100]}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase"}}>
              🗑 Smart Bins in Route {areaBins.length>0&&`(${areaBins.length})`}
            </div>
            {areaBins.length>0&&(
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setBinIds(areaBins.map(b=>String(b.id)))} style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8,background:EM[100],color:EM[700],border:"none",cursor:"pointer"}}>All</button>
                <button onClick={()=>setBinIds(areaBins.filter(b=>b.fill_level>=40).map(b=>String(b.id)))} style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8,background:"#fef3c7",color:"#92400e",border:"none",cursor:"pointer"}}>≥40%</button>
                <button onClick={()=>setBinIds([])} style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8,background:"#f1f5f9",color:"#374151",border:"none",cursor:"pointer"}}>Clear</button>
              </div>
            )}
          </div>

          {binsErr?(
            <div style={{padding:"10px 12px",borderRadius:9,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b"}}>{binsErr}</div>
          ):binsLoading?(
            <div style={{padding:14,textAlign:"center",color:"#9ca3af",fontSize:12}}>Loading bins…</div>
          ):areaBins.length===0?(
            <div style={{padding:14,textAlign:"center",color:"#9ca3af",fontSize:12,background:"#fff",borderRadius:9,border:`1px solid ${EM[100]}`}}>
              {effectiveArea
                ? `No bins found matching "${effectiveArea}". All barangay bins will be included.`
                : `Select a collection area above to filter bins, or leave blank to include all bins.`
              }
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:220,overflowY:"auto"}}>
              {areaBins.map(b=>{
                const checked = binIds.includes(String(b.id));
                const fc = b.fill_level>=90?"#dc2626":b.fill_level>=70?"#ea580c":b.fill_level>=40?"#d97706":EM[600];
                return(
                  <label key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:9,background:checked?"#fff":EM[50],border:`1.5px solid ${checked?EM[300]:EM[100]}`,cursor:"pointer"}}>
                    <input type="checkbox" checked={checked} onChange={()=>toggleBin(String(b.id))} style={{accentColor:EM[600],width:15,height:15,flexShrink:0,cursor:"pointer"}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:EM[900]}}>{b.name}</div>
                      {b.device_id&&<div style={{fontSize:10,color:"#9ca3af"}}>IoT: {b.device_id}</div>}
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      <div style={{fontSize:12,fontWeight:800,color:fc}}>{b.fill_level}%</div>
                      <div style={{width:44,height:3,borderRadius:2,background:"#e5e7eb",marginTop:2}}>
                        <div style={{width:`${b.fill_level}%`,height:"100%",borderRadius:2,background:fc}}/>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {binIds.length>0&&(
            <div style={{padding:"8px 12px",borderRadius:8,background:EM[50],border:`1px solid ${EM[200]}`,fontSize:12,color:EM[700],marginTop:8}}>
              ✅ <strong>{binIds.length}</strong> bin{binIds.length!==1?"s":""} selected for this route
            </div>
          )}
        </div>

        {/* ── SECTION 5: NOTES ── */}
        <div>
          <label style={{fontSize:10,fontWeight:800,color:EM[700],letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:5}}>Special Instructions (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="e.g. Avoid flooded roads near sitio, prioritise market bins first…" style={{...INP,resize:"none",lineHeight:1.6}}/>
        </div>

        {driverId&&(
          <div style={{padding:"10px 13px",borderRadius:9,background:"#fffbeb",border:"1px solid #fde68a",fontSize:12,color:"#78350f",display:"flex",gap:8,alignItems:"center"}}>
            <span>🔔</span>
            <span><strong>{selectedDriver?.full_name}</strong> will receive a notification with the full schedule and bin list.</span>
          </div>
        )}

        {/* Migration notice — shown while extended columns don't exist yet */}
        <div style={{padding:"10px 13px",borderRadius:9,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:11,color:"#1e40af",display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{flexShrink:0}}>ℹ️</span>
          <span>Driver assignment, vehicle type, area, and bin list require the <strong>migration SQL</strong> (see output file). Without it, only label/day/time/waste types are saved.</span>
        </div>

        {saveErr&&(
          <div style={{padding:"9px 12px",borderRadius:9,background:"#fef2f2",border:"1px solid #fecaca",fontSize:12,color:"#991b1b",display:"flex",gap:7,alignItems:"center"}}>
            <span>⚠️</span>{saveErr}
          </div>
        )}
      </div>
      <MFooter>
        <BtnCancel onClick={onClose}/>
        <BtnPrimary onClick={save} disabled={!label||types.length===0||saving}>{saving?"Saving…":schedule?"Update Schedule":"Create Schedule"}</BtnPrimary>
      </MFooter>
    </Modal>
  );
}

// ── NOTIFICATION PANEL ────────────────────────────────────────────────────────