"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/lgu/dashboard/page.tsx
// Main entry point — data fetching + layout only.
// All modals/panels live in sibling files under this directory.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Users, AlertTriangle, Search, LogOut, Bell, FileText,
  RefreshCw, ShieldAlert, Menu, Flag, ChevronRight,
  TrendingUp, ShieldCheck, Recycle, Megaphone, Send,
  Calendar, Lightbulb,
} from "lucide-react";

// ── Extracted components ──────────────────────────────────────────────────────
import { StatCard } from "./_shared";
import CitizenDetailModal  from "./CitizenModal";
import BroadcastModal      from "./BroadcastModal";
import ReportModal         from "./ReportModal";
import ScheduleModal       from "./ScheduleModal";
import NotifPanel          from "./NotifPanel";
import LGUProfilePanel     from "./ProfilePanel";

// ── Types + constants ─────────────────────────────────────────────────────────
import type {
  LGUProfile, Citizen, Violation, DBNotif,
  Broadcast, Schedule, CitizenReport,
} from "./_types";
import {
  EM, STATUS_CFG, BROADCAST_TYPES, DAYS,
  timeAgo, fmtDate, fmtTime, scoreColor,
  INP,
} from "./_constants";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
export default function Page() {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [profile,         setProfile]        = useState<LGUProfile | null>(null);
  const [citizens,        setCitizens]       = useState<Citizen[]>([]);
  const [violations,      setViolations]     = useState<Violation[]>([]);
  const [broadcasts,      setBroadcasts]     = useState<Broadcast[]>([]);
  const [schedules,       setSchedules]      = useState<Schedule[]>([]);
  const [reports,         setReports]        = useState<CitizenReport[]>([]);
  const [notifs,          setNotifs]         = useState<DBNotif[]>([]);
  const [loading,         setLoading]        = useState(true);

  const [activeTab,       setActiveTab]      = useState<"citizens"|"violations"|"reports"|"schedules"|"broadcasts"|"overview">("citizens");
  const [search,          setSearch]         = useState("");
  const [statusFilter,    setStatusFilter]   = useState("all");
  const [citizenFilter,   setCitizenFilter]  = useState("all");

  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [selectedReport,  setSelectedReport]  = useState<CitizenReport | null>(null);
  const [showBroadcast,   setShowBroadcast]   = useState(false);
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [editSchedule,    setEditSchedule]    = useState<Schedule | undefined>(undefined);
  const [isSidebarOpen,   setIsSidebarOpen]   = useState(false);
  const [showLogout,      setShowLogout]      = useState(false);
  const [isLoggingOut,    setIsLoggingOut]    = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [notifOpen,       setNotifOpen]       = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [notifOpen]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: pData }   = await supabase.from("profiles").select("id,full_name,email").eq("id", user.id).single();
    const { data: lguData } = await supabase.from("lgu_details").select("barangay,municipality,position_title").eq("id", user.id).single();
    if (!pData || !lguData) { router.push("/login"); return; }

    const me: LGUProfile = {
      id:             pData.id,
      full_name:      pData.full_name  ?? "LGU Official",
      email:          pData.email     ?? "",
      barangay:       lguData.barangay,
      municipality:   lguData.municipality ?? "",
      position_title: lguData.position_title ?? "LGU Official",
    };
    setProfile(me);

    // Login audit — once per browser session
    if (!sessionStorage.getItem("lgu_login_logged_" + pData.id)) {
      sessionStorage.setItem("lgu_login_logged_" + pData.id, "1");
      await supabase.from("audit_logs").insert({
        admin_id:    pData.id,
        action_type: "LGU_LOGIN",
        target_id:   pData.id,
        reason:      `Session started — signed in at ${new Date().toLocaleString("en-PH")}`,
      });
    }

    // Citizens — filter by BOTH barangay + municipality (prevents Poblacion collision)
    const { data: cDetails } = await supabase
      .from("citizen_details")
      .select("id,purok,address_street,house_lot_number,service_type,municipality,created_at")
      .eq("barangay",     me.barangay)
      .eq("municipality", me.municipality);

    if (cDetails && cDetails.length > 0) {
      const ids = cDetails.map((c: any) => c.id);
      const [{ data: profiles }, { data: cv }, { data: scores }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,contact_number,warning_count,is_archived").in("id", ids).eq("role","CITIZEN"),
        supabase.from("violations").select("*").in("citizen_id", ids).order("created_at", { ascending: false }),
        supabase.from("citizen_scores").select("citizen_id,score").in("citizen_id", ids).order("score_month", { ascending: false }),
      ]);
      const vMap: Record<string, Violation[]> = {};
      (cv ?? []).forEach((v: any) => { if (!vMap[v.citizen_id]) vMap[v.citizen_id] = []; vMap[v.citizen_id].push(v); });
      const sMap: Record<string, number> = {};
      (scores ?? []).forEach((s: any) => { if (!sMap[s.citizen_id]) sMap[s.citizen_id] = s.score; });
      setCitizens((profiles ?? []).map((p: any) => {
        const d = cDetails.find((x: any) => x.id === p.id);
        return { ...p, ...d, municipality: d?.municipality ?? me.municipality, violations: vMap[p.id] ?? [], score: sMap[p.id] ?? 100 };
      }));
    } else {
      setCitizens([]);
    }

    // Violations — barangay only (no municipality column on violations table)
    const { data: vData } = await supabase
      .from("violations")
      .select("*,profiles(full_name)")
      .eq("barangay", me.barangay)
      .order("created_at", { ascending: false });
    setViolations((vData ?? []).map((v: any) => ({ ...v, citizen_name: v.profiles?.full_name ?? "Unknown" })));

    // Broadcasts
    const { data: bcData } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("barangay",     me.barangay)
      .eq("municipality", me.municipality)
      .order("is_pinned",  { ascending: false })
      .order("created_at", { ascending: false });
    setBroadcasts(bcData ?? []);

    // Schedules
    const { data: schData } = await supabase
      .from("collection_schedules")
      .select("*")
      .eq("barangay",     me.barangay)
      .eq("municipality", me.municipality)
      .order("day_of_week");
    setSchedules(schData ?? []);

    // Citizen reports — barangay only (no municipality column on citizen_reports)
    const { data: repData } = await supabase
      .from("citizen_reports")
      .select("*")
      .eq("barangay", me.barangay)
      .order("created_at", { ascending: false });
    if (repData && repData.length > 0) {
      const allIds = [...new Set([
        ...repData.map((r: any) => r.reporter_id).filter(Boolean),
        ...repData.map((r: any) => r.reported_id).filter(Boolean),
      ])];
      const { data: pNames } = await supabase.from("profiles").select("id,full_name").in("id", allIds);
      const nameMap: Record<string, string> = Object.fromEntries((pNames ?? []).map((p: any) => [p.id, p.full_name]));
      setReports(repData.map((r: any) => ({
        ...r,
        reporter_name: nameMap[r.reporter_id] ?? "Unknown",
        reported_name: r.reported_id ? (nameMap[r.reported_id] ?? "Unknown") : "Unknown",
      })));
    } else {
      setReports([]);
    }

    // Own notifications
    const { data: nData } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    setNotifs(nData ?? []);

    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.barangay) return;
    const addN = (n: Omit<DBNotif, "id" | "is_read">) =>
      setNotifs(p => [{ ...n, id: crypto.randomUUID(), is_read: false }, ...p].slice(0, 40));

    const ch1 = supabase.channel("lgu-cd")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"citizen_details", filter:`barangay=eq.${profile.barangay}` }, () => {
        addN({ type:"new_citizen", title:"New Citizen Registered", body:`A new resident registered under Barangay ${profile.barangay}.`, created_at: new Date().toISOString() });
        fetchData();
      }).subscribe();

    const ch2 = supabase.channel("lgu-viol")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"violations", filter:`barangay=eq.${profile.barangay}` }, (payload: any) => {
        addN({ type:"REPORT_RECEIVED", title:"New Violation Reported", body:`A violation (${payload.new?.type?.replace(/_/g," ") ?? "unknown"}) was reported.`, created_at: new Date().toISOString() });
        fetchData();
      }).subscribe();

    const ch3 = supabase.channel("lgu-rep")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"citizen_reports", filter:`barangay=eq.${profile.barangay}` }, (payload: any) => {
        addN({ type:"REPORT_RECEIVED", title:"New Citizen Report", body:`A citizen filed a report (${payload.new?.type?.replace(/_/g," ") ?? "unknown"}).`, created_at: new Date().toISOString() });
        fetchData();
      }).subscribe();

    const ch4 = supabase.channel("lgu-notifs")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications", filter:`user_id=eq.${profile.id}` }, (payload: any) => {
        setNotifs(p => [payload.new as DBNotif, ...p].slice(0, 40));
      }).subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); };
  }, [profile?.barangay, profile?.id, fetchData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const toggleSchedule = async (id: string, active: boolean) => {
    await supabase.from("collection_schedules").update({ is_active: !active }).eq("id", id);
    fetchData();
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("collection_schedules").delete().eq("id", id);
    await supabase.from("audit_logs").insert({ admin_id: profile!.id, action_type:"LGU_DELETE_SCHEDULE", target_id: id, reason:`Schedule deleted by ${profile!.full_name}` });
    fetchData();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    if (profile) {
      await supabase.from("audit_logs").insert({
        admin_id:    profile.id,
        action_type: "LGU_LOGOUT",
        target_id:   profile.id,
        reason:      `Session ended by ${profile.full_name} at ${new Date().toLocaleString("en-PH")}`,
      });
    }
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const unreadC      = notifs.filter(n => !n.is_read).length;
  const freshC       = selectedCitizen ? (citizens.find(c => c.id === selectedCitizen.id) ?? selectedCitizen) : null;
  const pendingV     = violations.filter(v => v.status === "Pending").length;
  const activeW      = citizens.filter(c => c.warning_count > 0).length;
  const pendingRep   = reports.filter(r => r.status === "Submitted").length;
  const compliance   = citizens.length > 0
    ? Math.round((citizens.filter(c => c.warning_count === 0).length / citizens.length) * 100)
    : 100;

  const filtCitizens = citizens.filter(c => {
    const mF = citizenFilter === "all" ? true
      : citizenFilter === "warnings"   ? c.warning_count > 0
      : citizenFilter === "violations" ? (c.violations?.length ?? 0) > 0
      : citizenFilter === "archived"   ? c.is_archived : true;
    const mS = (c.full_name ?? "").toLowerCase().includes(search.toLowerCase())
            || (c.email    ?? "").toLowerCase().includes(search.toLowerCase())
            || (c.purok    ?? "").toLowerCase().includes(search.toLowerCase());
    return mF && mS;
  });

  const filtViolations = violations.filter(v => {
    const mSt = statusFilter === "all" || v.status === statusFilter;
    const mS  = (v.citizen_name ?? "").toLowerCase().includes(search.toLowerCase())
             || v.type.toLowerCase().includes(search.toLowerCase());
    return mSt && mS;
  });

  const filtReports = reports.filter(r => {
    const mSt = statusFilter === "all" || r.status === statusFilter;
    const mS  = (r.reporter_name ?? "").toLowerCase().includes(search.toLowerCase())
             || (r.reported_name ?? "").toLowerCase().includes(search.toLowerCase())
             || r.type.toLowerCase().includes(search.toLowerCase());
    return mSt && mS;
  });

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", background:EM[50], display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:44, height:44, borderRadius:"50%", border:`3px solid ${EM[200]}`, borderTopColor:EM[600], animation:"spin 1s linear infinite", margin:"0 auto 14px" }}/>
        <p style={{ fontSize:11, fontWeight:700, color:EM[700], letterSpacing:".1em", textTransform:"uppercase" }}>Loading dashboard…</p>
      </div>
    </div>
  );

  // ── Tab config ────────────────────────────────────────────────────────────
  const TABS = [
    { id:"citizens",   label:"Citizens",   count:citizens.length },
    { id:"violations", label:"Violations", count:violations.length },
    { id:"reports",    label:"Reports",    count:reports.length, badge:pendingRep },
    { id:"schedules",  label:"Schedules",  count:schedules.length },
    { id:"broadcasts", label:"Broadcasts", count:broadcasts.length },
    { id:"overview",   label:"Overview",   count:null },
  ];
  const TAB_ICONS: Record<string, any> = {
    citizens: Users, violations: AlertTriangle, reports: Flag,
    schedules: Calendar, broadcasts: Megaphone, overview: TrendingUp,
  };
  const currentLabel = TABS.find(t => t.id === activeTab)?.label ?? "Dashboard";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans relative overflow-hidden text-slate-900">
      <style>{`
        @keyframes fadeUp  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dropIn  {from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn {from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes pulse   {0%,100%{opacity:1}50%{opacity:.35}}
        .row-hover:hover   {background:${EM[50]}!important;cursor:pointer;}
        .tab-pill          {transition:all .18s;border-radius:10px;cursor:pointer;}
        .tab-pill:hover    {background:${EM[100]}!important;}
        .act-btn           {transition:all .15s;}
        .act-btn:hover     {opacity:.85;transform:scale(.98);}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${EM[200]};border-radius:2px;}
        input::placeholder,textarea::placeholder{color:#9ca3af;}
        select option{color:${EM[900]};background:#fff;}
        .sgrid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));}
        @media(max-width:640px){.sgrid{grid-template-columns:repeat(2,1fr)!important;}}
      `}</style>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed inset-y-0 left-0 z-[2001] w-72 bg-white border-r border-slate-200 transform transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 border border-emerald-500/20">
              <Recycle className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">EcoRoute</h1>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mt-0.5">LGU Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto">
          <p className="px-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Barangay {profile?.barangay}</p>
          {TABS.map(tab => {
            const Icon = TAB_ICONS[tab.id] ?? TrendingUp;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); setSearch(""); }}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-300 group ${isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" : "text-slate-500 hover:bg-slate-50 hover:text-emerald-600"}`}>
                <div className="flex items-center gap-4">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}>{tab.label}</span>
                  {(tab as any).badge > 0 && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>{(tab as any).badge}</span>
                  )}
                </div>
                {isActive && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
              </button>
            );
          })}
          <button onClick={() => { setShowBroadcast(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-300 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 group mt-2">
            <div className="flex items-center gap-4">
              <Send size={18} strokeWidth={2} />
              <span className="text-xs font-bold uppercase tracking-wider opacity-80 group-hover:opacity-100">Broadcast</span>
            </div>
          </button>
        </nav>

        <div className="p-6 shrink-0">
          <button onClick={() => setShowLogout(true)} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-[10px] uppercase tracking-widest border border-slate-100 hover:border-red-100 group">
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-slate-50/50">

        {/* ── TOPNAV ── */}
        <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-[1002]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-all">
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em]">{profile?.municipality} · System Live</p>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight uppercase">{currentLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Bell */}
            <div ref={notifRef} style={{ position:"relative" }}>
              <button onClick={() => setNotifOpen(o => !o)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative ${notifOpen ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 hover:border-emerald-200"}`}>
                <Bell size={17} color={notifOpen ? "#059669" : "#64748b"} />
                {unreadC > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white">
                    {unreadC > 9 ? "9+" : unreadC}
                  </span>
                )}
              </button>
              {notifOpen && <NotifPanel notifs={notifs} onRead={markRead} onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Profile badge */}
            <button onClick={() => setShowProfile(true)}
              className={`flex items-center gap-3 p-1.5 pr-4 rounded-xl border transition-all duration-200 ${showProfile ? "bg-slate-900 border-slate-800 shadow-lg" : "bg-white border-slate-200 hover:border-emerald-300 shadow-sm"}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden border transition-all ${showProfile ? "border-emerald-500/60 scale-105" : "border-slate-100"} bg-emerald-600`}>
                <span className="font-black text-white text-sm uppercase">{(profile?.full_name ?? "L").charAt(0)}</span>
              </div>
              <div className="text-left hidden md:block">
                <p className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${showProfile ? "text-white" : "text-slate-900"}`}>{profile?.full_name ?? "LGU Official"}</p>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={10} className={showProfile ? "text-emerald-400" : "text-emerald-600"} />
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${showProfile ? "text-emerald-400/80" : "text-slate-500"}`}>{profile?.position_title ?? "LGU Officer"}</p>
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto">
          <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 20px" }}>
            <div style={{ marginBottom:24, animation:"fadeUp .4s ease both" }}>
              <h1 style={{ fontSize:"clamp(20px,5vw,28px)", fontWeight:900, color:EM[900], margin:0, letterSpacing:"-.02em", fontFamily:"Georgia,serif" }}>Barangay {profile?.barangay}</h1>
              <p style={{ fontSize:13, color:EM[700], margin:"3px 0 0" }}>{profile?.municipality} · {profile?.position_title} · {citizens.length} registered citizens</p>
            </div>

            {/* Stat cards */}
            <div className="sgrid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:24 }}>
              <StatCard icon={Users}         label="Citizens"         value={citizens.length}                                       sub={`${citizens.filter(c=>!c.is_archived).length} active`} accent={EM[600]}   delay={0}/>
              <StatCard icon={AlertTriangle} label="Pending Viol."    value={pendingV}                                              sub="Need review"           accent="#d97706" delay={.05} warn={pendingV>0}/>
              <StatCard icon={Flag}          label="Pending Reports"  value={pendingRep}                                            sub="Citizen reports"       accent="#8b5cf6" delay={.08} warn={pendingRep>0}/>
              <StatCard icon={ShieldAlert}   label="Active Warnings"  value={activeW}                                               sub="Citizens warned"       accent="#dc2626" delay={.1}  warn={activeW>0}/>
              <StatCard icon={Calendar}      label="Schedules"        value={schedules.filter(s=>s.is_active).length}               sub="Active routes"         accent={EM[600]}  delay={.13}/>
              <StatCard icon={TrendingUp}    label="Compliance"       value={`${compliance}%`}                                      sub="RA 9003 adherence"     accent={compliance>=70?EM[600]:"#d97706"} delay={.16}/>
            </div>

            {/* Panel */}
            <div style={{ background:"#fff", borderRadius:18, border:`1.5px solid ${EM[100]}`, boxShadow:"0 4px 24px rgba(6,78,59,.07)", overflow:"hidden", animation:"fadeUp .5s ease .2s both" }}>

              {/* Toolbar */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 18px", borderBottom:`1px solid ${EM[100]}`, flexWrap:"wrap", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {(activeTab === "violations" || activeTab === "reports") && (
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ fontSize:12, padding:"7px 10px", border:`1.5px solid ${EM[100]}`, borderRadius:9, background:EM[50], color:EM[800], outline:"none", cursor:"pointer" }}>
                      <option value="all">All statuses</option>
                      {activeTab === "violations" && <><option value="Pending">Pending</option><option value="Under Review">Under Review</option><option value="Resolved">Resolved</option></>}
                      {activeTab === "reports" && <><option value="Submitted">Submitted</option><option value="Under Review">Under Review</option><option value="Escalated">Escalated</option><option value="Dismissed">Dismissed</option><option value="Resolved">Resolved</option></>}
                    </select>
                  )}
                  {activeTab === "citizens" && (
                    <select value={citizenFilter} onChange={e => setCitizenFilter(e.target.value)} style={{ fontSize:12, padding:"7px 10px", border:`1.5px solid ${EM[100]}`, borderRadius:9, background:EM[50], color:EM[800], outline:"none", cursor:"pointer" }}>
                      <option value="all">All citizens</option>
                      <option value="warnings">With warnings</option>
                      <option value="violations">With violations</option>
                      <option value="archived">Archived</option>
                    </select>
                  )}
                  {activeTab === "schedules" && (
                    <button onClick={() => { setEditSchedule(undefined); setShowSchedule(true); }} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, padding:"7px 14px", borderRadius:9, background:EM[600], color:"#fff", border:"none", cursor:"pointer" }}>
                      <Calendar size={13} /> + New Schedule
                    </button>
                  )}
                  {(["citizens","violations","reports","broadcasts"] as const).includes(activeTab as any) && (
                    <div style={{ position:"relative" }}>
                      <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
                      <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:30, paddingRight:10, paddingTop:7, paddingBottom:7, border:`1.5px solid ${EM[100]}`, borderRadius:9, fontSize:12, color:EM[900], outline:"none", width:150, background:EM[50] }}/>
                    </div>
                  )}
                  <button onClick={fetchData} className="act-btn" style={{ padding:"7px 9px", border:`1.5px solid ${EM[100]}`, borderRadius:9, background:EM[50], cursor:"pointer" }}>
                    <RefreshCw size={13} color={EM[600]} />
                  </button>
                </div>
              </div>

              {/* ── CITIZENS TAB ── */}
              {activeTab === "citizens" && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                    <thead><tr style={{ background:EM[50] }}>
                      {["Citizen","Location","Contact","Warnings","Score","Violations","Status",""].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:800, color:EM[600], letterSpacing:".08em", textTransform:"uppercase", borderBottom:`1px solid ${EM[100]}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtCitizens.length === 0
                        ? <tr><td colSpan={8} style={{ textAlign:"center", padding:48, color:"#9ca3af", fontSize:13 }}>No citizens found</td></tr>
                        : filtCitizens.map(c => {
                          const vCount = c.violations?.length ?? 0;
                          const pendC  = c.violations?.filter(v => v.status !== "Resolved").length ?? 0;
                          return (
                            <tr key={c.id} className="row-hover" onClick={() => setSelectedCitizen(c)} style={{ borderBottom:`1px solid ${EM[50]}`, background:"#fff" }}>
                              <td style={{ padding:"12px 16px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <div style={{ width:34, height:34, borderRadius:"50%", background:c.is_archived?"#f1f5f9":EM[100], display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:c.is_archived?"#9ca3af":EM[700], flexShrink:0 }}>{(c.full_name ?? "?").charAt(0).toUpperCase()}</div>
                                  <div>
                                    <div style={{ fontSize:13, fontWeight:600, color:c.is_archived?"#9ca3af":EM[900], textDecoration:c.is_archived?"line-through":"none" }}>{c.full_name ?? "—"}</div>
                                    <div style={{ fontSize:11, color:"#9ca3af" }}>{c.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding:"12px 16px", fontSize:12, color:"#6b7280" }}><div style={{ fontWeight:600, color:EM[700] }}>{c.purok ?? "—"}</div><div style={{ color:"#9ca3af" }}>{c.address_street ?? ""}</div></td>
                              <td style={{ padding:"12px 16px", fontSize:12, color:"#6b7280" }}>{c.contact_number ?? "—"}</td>
                              <td style={{ padding:"12px 16px" }}><span style={{ fontSize:11, fontWeight:800, padding:"3px 9px", borderRadius:20, background:c.warning_count>=3?"#fef2f2":c.warning_count>0?"#fff7ed":EM[50], color:c.warning_count>=3?"#991b1b":c.warning_count>0?"#9a3412":EM[700] }}>{c.warning_count}</span></td>
                              <td style={{ padding:"12px 16px" }}><span style={{ fontSize:13, fontWeight:800, color:scoreColor(c.score??100) }}>{c.score??100}</span><span style={{ fontSize:10, color:"#9ca3af" }}>/100</span></td>
                              <td style={{ padding:"12px 16px" }}>
                                {vCount > 0
                                  ? <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                                      <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:pendC>0?"#fef3c7":EM[50], color:pendC>0?"#92400e":EM[700] }}>{vCount} case{vCount!==1?"s":""}</span>
                                      {pendC > 0 && <span style={{ width:6, height:6, borderRadius:"50%", background:"#f59e0b", animation:"pulse 2s infinite", display:"inline-block" }}/>}
                                    </div>
                                  : <span style={{ fontSize:11, color:"#d1d5db" }}>None</span>}
                              </td>
                              <td style={{ padding:"12px 16px" }}><span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:c.is_archived?"#f1f5f9":EM[50], color:c.is_archived?"#6b7280":EM[700] }}>{c.is_archived?"Archived":"Active"}</span></td>
                              <td style={{ padding:"12px 14px" }}><div style={{ width:28, height:28, borderRadius:8, background:EM[50], display:"flex", alignItems:"center", justifyContent:"center" }}><Search size={14} color={EM[600]}/></div></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VIOLATIONS TAB ── */}
              {activeTab === "violations" && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:540 }}>
                    <thead><tr style={{ background:EM[50] }}>
                      {["Citizen","Type","Description","Status","Reported","Action"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:800, color:EM[600], letterSpacing:".08em", textTransform:"uppercase", borderBottom:`1px solid ${EM[100]}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtViolations.length === 0
                        ? <tr><td colSpan={6} style={{ textAlign:"center", padding:48, color:"#9ca3af", fontSize:13 }}>No violations found</td></tr>
                        : filtViolations.map(v => {
                          const sc = STATUS_CFG[v.status] ?? STATUS_CFG.Pending;
                          return (
                            <tr key={v.id} className="row-hover" style={{ borderBottom:`1px solid ${EM[50]}`, background:"#fff" }}>
                              <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:EM[900] }}>{v.citizen_name}</td>
                              <td style={{ padding:"12px 16px" }}><span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"#fef3c7", color:"#92400e" }}>{v.type.replace(/_/g," ")}</span></td>
                              <td style={{ padding:"12px 16px", fontSize:12, color:"#6b7280", maxWidth:200 }}><div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.description ?? "—"}</div></td>
                              <td style={{ padding:"12px 16px" }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:7, height:7, borderRadius:"50%", background:sc.dot }}/><span style={{ fontSize:12, fontWeight:600, color:sc.text }}>{sc.label}</span></div></td>
                              <td style={{ padding:"12px 16px", fontSize:12, color:"#9ca3af", whiteSpace:"nowrap" }}>{timeAgo(v.created_at)}</td>
                              <td style={{ padding:"12px 16px" }}>
                                {v.status !== "Resolved" && profile
                                  ? <button onClick={async () => { await supabase.from("violations").update({ status:"Resolved", resolved_at:new Date().toISOString() }).eq("id",v.id); await supabase.from("audit_logs").insert({ admin_id:profile.id, action_type:"LGU_RESOLVE_VIOLATION", target_id:v.id, reason:`Resolved by ${profile.full_name}` }); fetchData(); }} className="act-btn" style={{ fontSize:11, fontWeight:700, padding:"5px 11px", borderRadius:8, background:EM[50], color:EM[700], border:`1.5px solid ${EM[200]}`, cursor:"pointer" }}>✓ Resolve</button>
                                  : <span style={{ fontSize:11, color:EM[500] }}>✓ Done</span>}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── REPORTS TAB ── */}
              {activeTab === "reports" && (
                <div style={{ overflowX:"auto" }}>
                  <div style={{ padding:"10px 18px", borderBottom:`1px solid ${EM[100]}`, fontSize:12, color:EM[700], background:EM[50] }}>
                    ℹ️ Reporter identities are visible to you as LGU admin. They are hidden from reported citizens.
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                    <thead><tr style={{ background:EM[50] }}>
                      {["Reporter","Reported Citizen","Type","Status","Filed","Action"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:800, color:EM[600], letterSpacing:".08em", textTransform:"uppercase", borderBottom:`1px solid ${EM[100]}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtReports.length === 0
                        ? <tr><td colSpan={6} style={{ textAlign:"center", padding:48, color:"#9ca3af", fontSize:13 }}>No reports found</td></tr>
                        : filtReports.map(r => {
                          const sc = STATUS_CFG[r.status] ?? STATUS_CFG.Submitted;
                          return (
                            <tr key={r.id} className="row-hover" onClick={() => setSelectedReport(r)} style={{ borderBottom:`1px solid ${EM[50]}`, background:"#fff" }}>
                              <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:EM[700] }}>{r.reporter_name}</td>
                              <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#92400e" }}>{r.reported_name ?? "Unknown"}</td>
                              <td style={{ padding:"12px 16px" }}><span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"#fef3c7", color:"#92400e" }}>{r.type.replace(/_/g," ")}</span></td>
                              <td style={{ padding:"12px 16px" }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:7, height:7, borderRadius:"50%", background:sc.dot }}/><span style={{ fontSize:12, fontWeight:600, color:sc.text }}>{sc.label}</span></div></td>
                              <td style={{ padding:"12px 16px", fontSize:12, color:"#9ca3af", whiteSpace:"nowrap" }}>{timeAgo(r.created_at)}</td>
                              <td style={{ padding:"12px 14px" }}><div style={{ width:28, height:28, borderRadius:8, background:EM[50], display:"flex", alignItems:"center", justifyContent:"center" }}><Search size={14} color={EM[600]}/></div></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── SCHEDULES TAB ── */}
              {activeTab === "schedules" && (
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                  {schedules.length === 0
                    ? <div style={{ textAlign:"center", padding:48 }}><Calendar size={36} color={EM[200]} style={{ margin:"0 auto 12px" }}/><p style={{ color:"#9ca3af", fontSize:13 }}>No schedules yet. Create the first one!</p></div>
                    : schedules.map(s => (
                      <div key={s.id} style={{ padding:"16px 18px", borderRadius:12, background:s.is_active?"#fff":EM[50], border:`1.5px solid ${s.is_active?EM[200]:EM[100]}`, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                        <div style={{ width:48, height:48, borderRadius:12, background:s.is_active?EM[100]:"#f1f5f9", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:s.is_active?EM[700]:"#9ca3af" }}>{s.day_of_week !== null ? DAYS[s.day_of_week] : "One-off"}</div>
                          <div style={{ fontSize:10, color:s.is_active?EM[600]:"#9ca3af" }}>{fmtTime(s.scheduled_time)}</div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:s.is_active?EM[900]:"#9ca3af" }}>{s.label}</div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:5 }}>
                            {s.waste_types.map(t => <span key={t} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:EM[50], color:EM[700] }}>{t}</span>)}
                          </div>
                          {s.collection_area && <div style={{ fontSize:11, color:EM[600], marginTop:3 }}>📍 {s.collection_area}</div>}
                          {s.notes && <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{s.notes}</div>}
                        </div>
                        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                          <button onClick={() => { setEditSchedule(s); setShowSchedule(true); }} style={{ fontSize:11, fontWeight:700, padding:"5px 11px", borderRadius:8, background:EM[50], color:EM[700], border:`1.5px solid ${EM[200]}`, cursor:"pointer" }}>Edit</button>
                          <button onClick={() => toggleSchedule(s.id, s.is_active)} style={{ fontSize:11, fontWeight:700, padding:"5px 11px", borderRadius:8, background:s.is_active?"#fff7ed":"#f0fdf4", color:s.is_active?"#d97706":EM[700], border:`1.5px solid ${s.is_active?"#fde68a":EM[200]}`, cursor:"pointer" }}>{s.is_active?"Pause":"Activate"}</button>
                          <button onClick={() => deleteSchedule(s.id)} style={{ fontSize:11, fontWeight:700, padding:"5px 11px", borderRadius:8, background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fecaca", cursor:"pointer" }}>Delete</button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* ── BROADCASTS TAB ── */}
              {activeTab === "broadcasts" && (
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                  {broadcasts.length === 0
                    ? <div style={{ textAlign:"center", padding:48 }}><Megaphone size={36} color={EM[200]} style={{ margin:"0 auto 12px" }}/><p style={{ color:"#9ca3af", fontSize:13 }}>No broadcasts yet.</p></div>
                    : broadcasts
                        .filter(b => !b.expires_at || new Date(b.expires_at) > new Date())
                        .filter(b => (b.title + b.body).toLowerCase().includes(search.toLowerCase()))
                        .map(b => {
                          const bt = BROADCAST_TYPES.find(t => t.id === b.type);
                          return (
                            <div key={b.id} style={{ padding:"16px 18px", borderRadius:12, background:"#fff", border:`1.5px solid ${EM[b.is_pinned?200:100]}`, display:"flex", gap:14, alignItems:"flex-start" }}>
                              <div style={{ width:40, height:40, borderRadius:10, background:EM[50], display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{bt?.icon ?? "📢"}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                                  <span style={{ fontSize:14, fontWeight:700, color:EM[900] }}>{b.title}</span>
                                  {b.is_pinned && <span style={{ fontSize:10, fontWeight:800, padding:"1px 7px", borderRadius:20, background:EM[100], color:EM[700] }}>📌 Pinned</span>}
                                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:EM[50], color:EM[600] }}>{bt?.label ?? b.type}</span>
                                  <span style={{ fontSize:11, color:"#9ca3af", marginLeft:"auto" }}>{timeAgo(b.created_at)}</span>
                                </div>
                                <p style={{ fontSize:13, color:"#374151", margin:0, lineHeight:1.6 }}>{b.body}</p>
                              </div>
                            </div>
                          );
                        })}
                </div>
              )}

              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && (
                <div style={{ padding:22, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:18 }}>
                  {/* Compliance */}
                  <div style={{ background:EM[50], borderRadius:14, padding:20, border:`1px solid ${EM[100]}` }}>
                    <div style={{ fontSize:11, fontWeight:800, color:EM[700], letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>RA 9003 Compliance</div>
                    <div style={{ fontSize:44, fontWeight:900, color:compliance>=80?EM[600]:compliance>=50?"#d97706":"#dc2626", fontFamily:"Georgia,serif", lineHeight:1 }}>{compliance}%</div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:5, marginBottom:12 }}>of citizens have zero warnings</div>
                    <div style={{ height:8, borderRadius:4, background:"#e5e7eb" }}><div style={{ height:"100%", width:`${compliance}%`, borderRadius:4, background:`linear-gradient(90deg,${EM[500]},${EM[400]})`, transition:"width .6s" }}/></div>
                    <p style={{ fontSize:12, color:EM[700], lineHeight:1.6, padding:"10px 12px", borderRadius:9, background:"#fff", border:`1px solid ${EM[100]}`, marginTop:12, marginBottom:0 }}>Citizens with 3+ warnings may be escalated under RA 9003 Sec. 49.</p>
                  </div>
                  {/* Violations breakdown */}
                  <div style={{ background:EM[50], borderRadius:14, padding:20, border:`1px solid ${EM[100]}` }}>
                    <div style={{ fontSize:11, fontWeight:800, color:EM[700], letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>Violation Breakdown</div>
                    {[
                      {label:"Pending",      val:violations.filter(v=>v.status==="Pending").length,      color:"#f59e0b"},
                      {label:"Under Review", val:violations.filter(v=>v.status==="Under Review").length,  color:"#3b82f6"},
                      {label:"Resolved",     val:violations.filter(v=>v.status==="Resolved").length,      color:EM[600]},
                    ].map(s => (
                      <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${EM[100]}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:8, height:8, borderRadius:"50%", background:s.color }}/><span style={{ fontSize:13, color:"#374151" }}>{s.label}</span></div>
                        <span style={{ fontSize:17, fontWeight:900, color:s.color, fontFamily:"Georgia,serif" }}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                  {/* Score distribution */}
                  <div style={{ background:EM[50], borderRadius:14, padding:20, border:`1px solid ${EM[100]}` }}>
                    <div style={{ fontSize:11, fontWeight:800, color:EM[700], letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>Score Distribution</div>
                    {[
                      {label:"Excellent (90–100)", val:citizens.filter(c=>(c.score??100)>=90).length,                                    color:EM[600]},
                      {label:"Good (70–89)",        val:citizens.filter(c=>(c.score??100)>=70&&(c.score??100)<90).length,                 color:"#059669"},
                      {label:"Fair (50–69)",         val:citizens.filter(c=>(c.score??100)>=50&&(c.score??100)<70).length,                 color:"#d97706"},
                      {label:"Poor (< 50)",          val:citizens.filter(c=>(c.score??100)<50).length,                                    color:"#dc2626"},
                    ].map(s => (
                      <div key={s.label} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:12, color:"#374151" }}>{s.label}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.val}</span>
                        </div>
                        <div style={{ height:5, borderRadius:3, background:"#e5e7eb" }}>
                          <div style={{ height:"100%", width:citizens.length>0?`${(s.val/citizens.length)*100}%`:"0%", borderRadius:3, background:s.color, transition:"width .6s" }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Next steps */}
                  <div style={{ background:"#fffbeb", borderRadius:14, padding:20, border:"1px solid #fde68a" }}>
                    <div style={{ fontSize:11, fontWeight:800, color:"#92400e", letterSpacing:".1em", textTransform:"uppercase", marginBottom:14, display:"flex", alignItems:"center", gap:7 }}>
                      <Lightbulb size={13} color="#d97706"/>Next Steps
                    </div>
                    {[
                      {icon:"🔔",title:"Push Notifications",  desc:"Set up VAPID keys + service worker to deliver browser push for all in-app notifications."},
                      {icon:"📊",title:"Purok Analytics",      desc:"Track waste generation per purok. Identify high-waste zones for targeted campaigns."},
                      {icon:"🏆",title:"Citizen Leaderboard",  desc:"Show top 10 compliant citizens per month (by score). Gamify RA 9003 compliance."},
                      {icon:"📅",title:"Schedule Reminders",   desc:"Edge Function cron: send COLLECTION_REMINDER to assigned driver 30 min before schedule."},
                    ].map(f => (
                      <div key={f.title} style={{ display:"flex", gap:10, marginBottom:11 }}>
                        <span style={{ fontSize:17, flexShrink:0 }}>{f.icon}</span>
                        <div><div style={{ fontSize:12, fontWeight:700, color:"#78350f", marginBottom:2 }}>{f.title}</div><p style={{ fontSize:11, color:"#92400e", margin:0, lineHeight:1.5 }}>{f.desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RA 9003 footer */}
            <div style={{ marginTop:20, padding:"16px 20px", borderRadius:14, background:`linear-gradient(135deg,${EM[800]},${EM[900]})`, border:`1px solid ${EM[700]}`, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", animation:"fadeUp .5s ease .3s both" }}>
              <FileText size={20} color={EM[200]} style={{ flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:12, fontWeight:700, color:EM[200], marginBottom:2 }}>RA 9003 — Ecological Solid Waste Management Act of 2000</div>
                <p style={{ fontSize:12, color:"rgba(167,243,208,.75)", margin:0, lineHeight:1.55 }}>You are responsible for enforcing waste segregation and collection schedules in Barangay {profile?.barangay}.</p>
              </div>
              <div style={{ textAlign:"center", flexShrink:0 }}>
                <div style={{ fontSize:24, fontWeight:900, color:EM[300], fontFamily:"Georgia,serif" }}>{compliance}%</div>
                <div style={{ fontSize:10, color:"rgba(167,243,208,.6)", fontWeight:700, textTransform:"uppercase", letterSpacing:".06em" }}>Compliant</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── PANELS & MODALS ── */}
      {showProfile && profile && (
        <LGUProfilePanel profile={profile} onClose={() => setShowProfile(false)} onRefresh={fetchData} />
      )}

      {showLogout && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><LogOut size={32}/></div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">End Session?</h2>
              <p className="text-xs font-medium text-slate-500 mb-8 leading-relaxed">You are about to sign out of the LGU portal.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleLogout} disabled={isLoggingOut} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50">
                  {isLoggingOut ? "Signing out…" : "Confirm & Sign Out"}
                </button>
                <button onClick={() => setShowLogout(false)} disabled={isLoggingOut} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
                  Stay Active
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {freshC    && profile && <CitizenDetailModal citizen={freshC}   profile={profile} onClose={() => setSelectedCitizen(null)} onRefresh={fetchData} />}
      {showBroadcast && profile && <BroadcastModal profile={profile} citizenCount={citizens.filter(c=>!c.is_archived).length} onClose={() => setShowBroadcast(false)} onSent={fetchData} />}
      {showSchedule  && profile && <ScheduleModal  profile={profile} schedule={editSchedule} onClose={() => { setShowSchedule(false); setEditSchedule(undefined); }} onRefresh={fetchData} />}
      {selectedReport && profile && <ReportModal   report={selectedReport} profile={profile} onClose={() => setSelectedReport(null)} onRefresh={fetchData} />}
    </div>
  );
}