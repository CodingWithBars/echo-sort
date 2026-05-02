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
  Calendar, Lightbulb, Smartphone, ArrowUpRight
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
  STATUS_CFG, BROADCAST_TYPES, DAYS,
  timeAgo, fmtDate, fmtTime, scoreColor,
  INP, THEME, SLIDE_IN_RIGHT, FADE_IN_UP
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

  const [activeTab,       setActiveTab]      = useState<"overview"|"citizens"|"violations"|"reports"|"schedules"|"broadcasts">("overview");
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
  
  const [deferredPrompt,  setDeferredPrompt]  = useState<any>(null);
  const [isInstallable,   setIsInstallable]   = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [notifOpen]);

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

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: pData }   = await supabase.from("profiles").select("id,full_name,email,avatar_url").eq("id", user.id).single();
    const { data: lguData } = await supabase.from("lgu_details").select("barangay,municipality,position_title").eq("id", user.id).single();
    if (!pData || !lguData) { router.push("/login"); return; }

    const me: LGUProfile = {
      id:             pData.id,
      full_name:      pData.full_name  ?? "LGU Official",
      email:          pData.email     ?? "",
      barangay:       lguData.barangay,
      municipality:   lguData.municipality ?? "",
      position_title: lguData.position_title ?? "LGU Official",
      avatar_url:     pData.avatar_url
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
    <div style={{ minHeight:"100vh", background:THEME.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{SLIDE_IN_RIGHT}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", border:`4px solid ${THEME.primary}20`, borderTopColor:THEME.primary, animation:"spin 1s linear infinite", margin:"0 auto 16px" }}/>
        <p style={{ fontSize:11, fontWeight:800, color:THEME.textMuted, letterSpacing:".15em", textTransform:"uppercase" }}>Syncing Barangay Data…</p>
      </div>
    </div>
  );

  // ── Tab config ────────────────────────────────────────────────────────────
  const TABS = [
    { id:"overview",   label:"Overview",   count:null },
    { id:"citizens",   label:"Citizens",   count:citizens.length },
    { id:"violations", label:"Violations", count:violations.length },
    { id:"reports",    label:"Reports",    count:reports.length, badge:pendingRep },
    { id:"schedules",  label:"Schedules",  count:schedules.length },
    { id:"broadcasts", label:"Broadcasts", count:broadcasts.length },
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
        ${SLIDE_IN_RIGHT}
        ${FADE_IN_UP}
        @keyframes modalIn {from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse   {0%,100%{opacity:1}50%{opacity:.35}}
        .row-hover:hover   {background:${THEME.accent}!important;cursor:pointer;}
        .tab-pill          {transition:all .18s;border-radius:10px;cursor:pointer;}
        .tab-pill:hover    {background:${THEME.accent}!important;}
        .act-btn           {transition:all .15s;}
        .act-btn:hover     {opacity:.85;transform:scale(.98);}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${THEME.border};border-radius:2px;}
        input::placeholder,textarea::placeholder{color:#9ca3af;}
        select option{color:${THEME.text};background:#fff;}
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
            <div className="w-10 h-10 bg-[#1c4532] rounded-xl flex items-center justify-center shadow-lg shadow-[#1c453220] border border-[#1c4532]/10">
              <Recycle className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">EcoRoute</h1>
              <p className="text-[10px] font-bold text-[#1c4532] uppercase tracking-[0.1em] mt-1">LGU Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto no-scrollbar">
          <p className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Node: Barangay {profile?.barangay}</p>
          {TABS.map(tab => {
            const Icon = TAB_ICONS[tab.id] ?? TrendingUp;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); setSearch(""); }}
                className={`w-full flex items-center justify-between px-5 py-3 rounded-xl transition-all duration-200 group ${isActive ? "bg-[#1c4532] text-white shadow-md shadow-[#1c453220]" : "text-slate-500 hover:bg-slate-50 hover:text-[#1c4532]"}`}>
                <div className="flex items-center gap-4">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-xs font-black uppercase tracking-wider ${isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}>{tab.label}</span>
                  {(tab as any).badge > 0 && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>{(tab as any).badge}</span>
                  )}
                </div>
                {isActive && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
              </button>
            );
          })}
          <div className="pt-2">
            <button onClick={() => { setShowBroadcast(true); setIsSidebarOpen(false); }}
              className="w-full flex items-center justify-between px-5 py-3 rounded-xl transition-all duration-200 text-slate-500 hover:bg-[#f0fdf4] hover:text-[#1c4532] group">
              <div className="flex items-center gap-4">
                <Send size={18} strokeWidth={2} />
                <span className="text-xs font-black uppercase tracking-wider opacity-80 group-hover:opacity-100">Broadcast</span>
              </div>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer Card */}
        {isInstallable && (
          <div className="p-4 mt-auto">
            <div className="bg-[#f0fdf4] rounded-2xl p-5 border border-[#dcfce7] relative overflow-hidden">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center mb-3 shadow-sm">
                <Smartphone size={18} className="text-[#1c4532]" />
              </div>
              <p className="text-xs font-black text-[#1c4532] uppercase tracking-tight mb-1">EcoRoute Mobile</p>
              <p className="text-[10px] text-[#4b7a63] font-bold leading-relaxed mb-3">Monitor local logistics on the go.</p>
              <button 
                onClick={handleInstallApp}
                className="w-full py-2.5 bg-[#1c4532] text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#2d5a45] transition-all"
              >
                Get the App <ArrowUpRight size={14}/>
              </button>
            </div>
          </div>
        )}

        <div className="p-4 pt-0 shrink-0">
          <button onClick={() => setShowLogout(true)} className="w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-red-500 hover:bg-red-50 transition-all font-black text-[10px] uppercase tracking-widest group">
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" /><span>Sign Out</span>
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
            <div className="hidden sm:block">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1c4532] animate-pulse" />
                <p className="text-[9px] font-black text-[#1c4532] uppercase tracking-[0.2em]">{profile?.municipality} · Operational</p>
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight leading-tight uppercase">{currentLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 w-64">
              <Search size={14} className="text-slate-400" />
              <input 
                placeholder={`Search ${currentLabel.toLowerCase()}…`}
                className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder:text-slate-400"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Bell */}
            <div ref={notifRef} className="relative">
              <button onClick={() => setNotifOpen(o => !o)}
                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all relative ${notifOpen ? "bg-[#f0fdf4] border-[#1c4532]/20" : "bg-white border-slate-200 hover:border-[#1c4532]/20"}`}>
                <Bell size={18} className={notifOpen ? "text-[#1c4532]" : "text-slate-500"} />
                {unreadC > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                )}
              </button>
              {notifOpen && <NotifPanel notifs={notifs} onRead={markRead} onClose={() => setNotifOpen(false)} />}
            </div>

            <div className="w-px h-8 bg-slate-200 mx-1" />

            {/* Profile badge */}
            <button onClick={() => setShowProfile(true)}
              className={`flex items-center gap-3 p-1.5 pr-4 rounded-xl border transition-all duration-200 ${showProfile ? "bg-slate-900 border-slate-800 shadow-lg" : "bg-white border-slate-200 hover:border-[#1c4532]/30 shadow-sm"}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden border transition-all ${showProfile ? "border-[#1c4532]/60 scale-105" : "border-slate-100"} bg-[#1c4532]`}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-white text-xs uppercase">{(profile?.full_name ?? "L").charAt(0)}</span>
                )}
              </div>
              <div className="text-left hidden md:block">
                <p className={`text-[10px] font-black uppercase tracking-tight transition-colors ${showProfile ? "text-white" : "text-slate-900"}`}>{profile?.full_name ?? "LGU Official"}</p>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={10} className={showProfile ? "text-[#f0fdf4]" : "text-[#1c4532]"} />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${showProfile ? "text-emerald-400/80" : "text-slate-500"}`}>{profile?.position_title ?? "LGU Officer"}</p>
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
          <div style={{ maxWidth:1200, margin:"0 auto", padding:"32px 24px" }}>
            
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-baseline gap-3 mb-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Barangay {profile?.barangay}</h1>
                <span className="px-2.5 py-1 bg-[#f0fdf4] text-[#1c4532] text-[10px] font-black uppercase tracking-widest rounded-lg border border-[#1c4532]/10">LGU Node</span>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{profile?.municipality} · {profile?.position_title} · {citizens.length} Registry Entries</p>
            </div>

            {/* Main Panel Content */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">

              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  {(activeTab === "violations" || activeTab === "reports") && (
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-[11px] font-bold uppercase tracking-wider py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none cursor-pointer focus:border-[#1c4532] transition-all shadow-sm">
                      <option value="all">Status: All</option>
                      {activeTab === "violations" && <><option value="Pending">Pending</option><option value="Under Review">Under Review</option><option value="Resolved">Resolved</option></>}
                      {activeTab === "reports" && <><option value="Submitted">Submitted</option><option value="Under Review">Under Review</option><option value="Escalated">Escalated</option><option value="Dismissed">Dismissed</option><option value="Resolved">Resolved</option></>}
                    </select>
                  )}
                  {activeTab === "citizens" && (
                    <select value={citizenFilter} onChange={e => setCitizenFilter(e.target.value)} className="text-[11px] font-bold uppercase tracking-wider py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 outline-none cursor-pointer focus:border-[#1c4532] transition-all shadow-sm">
                      <option value="all">Category: All</option>
                      <option value="warnings">With Warnings</option>
                      <option value="violations">With Violations</option>
                      <option value="archived">Archived Records</option>
                    </select>
                  )}
                  {activeTab === "schedules" && (
                    <button onClick={() => { setEditSchedule(undefined); setShowSchedule(true); }} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest py-2 px-4 rounded-xl bg-[#1c4532] text-white border-none cursor-pointer hover:bg-[#2d5a45] transition-all shadow-md shadow-[#1c4532]/10 active:scale-95">
                      <Calendar size={13} /> + New Schedule
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <button onClick={fetchData} className="w-10 h-10 border border-slate-200 rounded-xl bg-white text-[#1c4532] flex items-center justify-center hover:bg-slate-50 transition-all active:scale-90">
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* ── CITIZENS TAB ── */}
              {activeTab === "citizens" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-left">
                        {["Citizen Node","Location","Contact","Alerts","Integrity","Breaches","Status",""].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtCitizens.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-20 text-slate-400 text-xs font-bold uppercase tracking-widest">No registry matches found</td></tr>
                      ) : (
                        filtCitizens.map(c => {
                          const vCount = c.violations?.length ?? 0;
                          const pendC  = c.violations?.filter(v => v.status !== "Resolved").length ?? 0;
                          return (
                            <tr key={c.id} className="row-hover transition-colors group" onClick={() => setSelectedCitizen(c)}>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase border shadow-sm ${c.is_archived ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-[#f0fdf4] border-[#1c4532]/10 text-[#1c4532]"}`}>
                                    {(c.full_name ?? "?").charAt(0)}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-black tracking-tight uppercase leading-none mb-1 ${c.is_archived ? "text-slate-400 line-through" : "text-slate-900"}`}>{c.full_name ?? "—"}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">{c.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-[11px] font-black text-[#1c4532] uppercase tracking-tight">{c.purok ?? "—"}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{c.address_street ?? ""}</p>
                              </td>
                              <td className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{c.contact_number ?? "—"}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${c.warning_count >= 3 ? "bg-red-50 border-red-100 text-red-600" : c.warning_count > 0 ? "bg-orange-50 border-orange-100 text-orange-600" : "bg-slate-50 border-slate-100 text-slate-500"}`}>
                                  {c.warning_count} Alerts
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-black" style={{ color:scoreColor(c.score??100) }}>{c.score??100}</span>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase">/100</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {vCount > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${pendC > 0 ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-[#f0fdf4] border-[#1c4532]/10 text-[#1c4532]"}`}>
                                      {vCount} Transmissions
                                    </span>
                                    {pendC > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-sm shadow-amber-200" />}
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Clear</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border ${c.is_archived ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-[#f0fdf4] border-[#1c4532]/10 text-[#1c4532]"}`}>
                                  {c.is_archived ? "Archived" : "Active"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-[#1c4532] group-hover:text-white transition-all">
                                  <Search size={14} />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VIOLATIONS TAB ── */}
              {activeTab === "violations" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-left">
                        {["Citizen Node","Violation Type","Protocol Details","Signal Status","Transmission","System Action"].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtViolations.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-20 text-slate-400 text-xs font-bold uppercase tracking-widest">No protocol breaches logged</td></tr>
                      ) : (
                        filtViolations.map(v => {
                          const sc = STATUS_CFG[v.status] ?? STATUS_CFG.Pending;
                          return (
                            <tr key={v.id} className="row-hover transition-colors">
                              <td className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-tight">{v.citizen_name}</td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest bg-amber-50 border border-amber-100 text-amber-700">
                                  {v.type.replace(/_/g," ")}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[240px]">
                                <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed truncate">{v.description ?? "—"}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background:sc.dot }} />
                                  <span className="text-[11px] font-black uppercase tracking-wider" style={{ color:sc.text }}>{sc.label}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter whitespace-nowrap">{timeAgo(v.created_at)}</td>
                              <td className="px-6 py-4">
                                {v.status !== "Resolved" && profile ? (
                                  <button 
                                    onClick={async (e) => { 
                                      e.stopPropagation();
                                      await supabase.from("violations").update({ status:"Resolved", resolved_at:new Date().toISOString() }).eq("id",v.id); 
                                      await supabase.from("audit_logs").insert({ admin_id:profile.id, action_type:"LGU_RESOLVE_VIOLATION", target_id:v.id, reason:`Resolved by ${profile.full_name}` }); 
                                      fetchData(); 
                                    }} 
                                    className="px-3 py-1.5 bg-[#f0fdf4] text-[#1c4532] text-[10px] font-black uppercase tracking-widest rounded-lg border border-[#1c4532]/10 hover:bg-[#1c4532] hover:text-white transition-all active:scale-95"
                                  >
                                    ✓ Resolve Node
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-black text-[#1c4532] uppercase tracking-widest opacity-60">✓ Logged & Sync'd</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── REPORTS TAB ── */}
              {activeTab === "reports" && (
                <div className="overflow-x-auto">
                  <div className="px-6 py-3 bg-[#1c4532] text-white/90 text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-3">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Encrypted Protocol: Reporter identities are visible to LGU nodes only.
                  </div>
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-left">
                        {["Reporter Node","Subject Node","Transmission Type","Status","Signal","Log"].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtReports.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-20 text-slate-400 text-xs font-bold uppercase tracking-widest">No inbound signals detected</td></tr>
                      ) : (
                        filtReports.map(r => {
                          const sc = STATUS_CFG[r.status] ?? STATUS_CFG.Submitted;
                          return (
                            <tr key={r.id} className="row-hover transition-colors group" onClick={() => setSelectedReport(r)}>
                              <td className="px-6 py-4 text-xs font-black text-[#1c4532] uppercase tracking-tight">{r.reporter_name}</td>
                              <td className="px-6 py-4 text-xs font-black text-orange-700 uppercase tracking-tight">{r.reported_name ?? "Unknown Node"}</td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest bg-slate-50 border border-slate-100 text-slate-600">
                                  {r.type.replace(/_/g," ")}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background:sc.dot }} />
                                  <span className="text-[11px] font-black uppercase tracking-wider" style={{ color:sc.text }}>{sc.label}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter whitespace-nowrap">{timeAgo(r.created_at)}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-[#1c4532] group-hover:text-white transition-all mx-auto">
                                  <Search size={14} />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── SCHEDULES TAB ── */}
              {activeTab === "schedules" && (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schedules.length === 0 ? (
                    <div className="col-span-2 text-center py-20">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <Calendar size={28} className="text-slate-300" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No collection nodes configured</p>
                    </div>
                  ) : (
                    schedules.map(s => (
                      <div key={s.id} className={`p-6 rounded-2xl border transition-all duration-300 ${s.is_active ? "bg-white border-[#1c4532]/20 shadow-sm" : "bg-slate-50 border-slate-100 grayscale-[0.5]"}`}>
                        <div className="flex items-start gap-5">
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border ${s.is_active ? "bg-[#f0fdf4] border-[#1c4532]/10" : "bg-white border-slate-100"}`}>
                            <p className={`text-[11px] font-black uppercase ${s.is_active ? "text-[#1c4532]" : "text-slate-400"}`}>{s.day_of_week !== null ? DAYS[s.day_of_week] : "FIXED"}</p>
                            <p className={`text-[9px] font-bold uppercase mt-1 ${s.is_active ? "text-emerald-600/60" : "text-slate-300"}`}>{fmtTime(s.scheduled_time)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-black uppercase tracking-tight mb-2 ${s.is_active ? "text-slate-900" : "text-slate-400"}`}>{s.label}</h4>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {s.waste_types.map(t => (
                                <span key={t} className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${s.is_active ? "bg-[#1c4532] text-white" : "bg-slate-200 text-slate-500"}`}>{t}</span>
                              ))}
                            </div>
                            {s.collection_area && <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#1c4532]/70 uppercase mb-1">📍 {s.collection_area}</div>}
                            {s.notes && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-relaxed italic">{s.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100">
                          <button onClick={() => { setEditSchedule(s); setShowSchedule(true); }} className="flex-1 py-2 bg-slate-50 text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-slate-100 transition-all border border-slate-100">Config</button>
                          <button onClick={() => toggleSchedule(s.id, s.is_active)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg transition-all border ${s.is_active ? "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100" : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"}`}>
                            {s.is_active ? "Suspend" : "Activate"}
                          </button>
                          <button onClick={() => deleteSchedule(s.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-100"><RefreshCw size={14} className="rotate-45" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── BROADCASTS TAB ── */}
              {activeTab === "broadcasts" && (
                <div className="p-8 space-y-4">
                  {broadcasts.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <Megaphone size={28} className="text-slate-300" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No network broadcasts transmitted</p>
                    </div>
                  ) : (
                    broadcasts
                        .filter(b => !b.expires_at || new Date(b.expires_at) > new Date())
                        .filter(b => (b.title + b.body).toLowerCase().includes(search.toLowerCase()))
                        .map(b => {
                          const bt = BROADCAST_TYPES.find(t => t.id === b.type);
                          return (
                            <div key={b.id} className={`p-6 rounded-2xl border transition-all duration-300 ${b.is_pinned ? "bg-[#f0fdf4] border-[#1c4532]/20" : "bg-white border-slate-100"}`}>
                              <div className="flex gap-5">
                                <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-xl shrink-0 border border-slate-100 shadow-sm">{bt?.icon ?? "📢"}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">{b.title}</h4>
                                    {b.is_pinned && <span className="text-[9px] font-black px-2 py-0.5 bg-[#1c4532] text-white rounded-md uppercase tracking-widest">📌 Essential</span>}
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase tracking-widest">{bt?.label ?? b.type}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter ml-auto">{timeAgo(b.created_at)}</span>
                                  </div>
                                  <p className="text-[12px] font-medium text-slate-600 leading-relaxed uppercase tracking-tight">{b.body}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                  )}
                </div>
              )}

              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && (
                <div className="p-8 flex flex-col gap-8">
                  {/* Stat cards - Horizontally scrollable on mobile */}
                  <div className="overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
                    <div className="flex md:grid md:grid-cols-3 lg:grid-cols-6 gap-4 w-max md:w-full">
                      <StatCard className="w-[280px] md:w-auto shrink-0" icon={Users}         label="Citizens"         value={citizens.length}                                       sub={`${citizens.filter(c=>!c.is_archived).length} Active`} accent="#1c4532" delay={0}/>
                      <StatCard className="w-[280px] md:w-auto shrink-0" icon={AlertTriangle} label="Pending Viol."    value={pendingV}                                              sub="Action Required"        accent="#d97706" delay={.05} warn={pendingV>0}/>
                      <StatCard className="w-[280px] md:w-auto shrink-0" icon={Flag}          label="Pending Reports"  value={pendingRep}                                            sub="Inbound Signals"        accent="#8b5cf6" delay={.08} warn={pendingRep>0}/>
                      <StatCard className="w-[280px] md:w-auto shrink-0" icon={ShieldAlert}   label="Active Warnings"  value={activeW}                                               sub="Protocol Alerts"        accent="#dc2626" delay={.1}  warn={activeW>0}/>
                      <StatCard className="w-[280px] md:w-auto shrink-0" icon={Calendar}      label="Schedules"        value={schedules.filter(s=>s.is_active).length}               sub="Active Routes"          accent="#1c4532" delay={.13}/>
                      <StatCard className="w-[280px] md:w-auto shrink-0" icon={TrendingUp}    label="Compliance"       value={`${compliance}%`}                                      sub="RA 9003 Index"          accent={compliance>=70?"#1c4532":"#d97706"} delay={.16}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Compliance */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-[#1c4532] uppercase tracking-[0.2em] mb-4">RA 9003 Compliance Index</p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl font-black tracking-tighter" style={{ color:compliance>=80?"#1c4532":compliance>=50?"#d97706":"#dc2626" }}>{compliance}%</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Adherence</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-5 leading-relaxed">of resident nodes maintain a zero-warning integrity score.</p>
                    <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden mb-6">
                      <div className="h-full bg-[#1c4532] rounded-full transition-all duration-1000 ease-out" style={{ width:`${compliance}%` }} />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase italic">Protocol Reminder: Citizens with 3+ breaches must be escalated under RA 9003 Sec. 49.</p>
                    </div>
                  </div>

                  {/* Violations breakdown */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Breach Signal Breakdown</p>
                    <div className="space-y-4">
                      {[
                        {label:"Pending Alert",      val:violations.filter(v=>v.status==="Pending").length,      color:"#f59e0b"},
                        {label:"In Processing",      val:violations.filter(v=>v.status==="Under Review").length,  color:"#3b82f6"},
                        {label:"Resolved Logs",      val:violations.filter(v=>v.status==="Resolved").length,      color:"#1c4532"},
                      ].map(s => (
                        <div key={s.label} className="flex justify-between items-center pb-3 border-b border-slate-200/50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shadow-sm" style={{ background:s.color }} />
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{s.label}</span>
                          </div>
                          <span className="text-xl font-black tracking-tight" style={{ color:s.color }}>{s.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score distribution */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Integrity Distribution</p>
                    <div className="space-y-4">
                      {[
                        {label:"Excellent (90–100)", val:citizens.filter(c=>(c.score??100)>=90).length,                                    color:"#1c4532"},
                        {label:"Standard (70–89)",   val:citizens.filter(c=>(c.score??100)>=70&&(c.score??100)<90).length,                 color:"#059669"},
                        {label:"Review (50–69)",     val:citizens.filter(c=>(c.score??100)>=50&&(c.score??100)<70).length,                 color:"#d97706"},
                        {label:"Critical (< 50)",    val:citizens.filter(c=>(c.score??100)<50).length,                                    color:"#dc2626"},
                      ].map(s => (
                        <div key={s.label}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{s.label}</span>
                            <span className="text-[11px] font-black" style={{ color:s.color }}>{s.val}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width:citizens.length>0?`${(s.val/citizens.length)*100}%`:"0%", background:s.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System Protocol Card */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-3 p-8 bg-slate-900 rounded-3xl text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <ShieldCheck size={160} />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-[#1c4532] rounded-xl flex items-center justify-center border border-white/10 shadow-lg">
                            <Lightbulb className="text-emerald-400" size={20} />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Node Optimization Strategies</p>
                        </div>
                        <h3 className="text-3xl font-black tracking-tight mb-4 leading-none">Enhance Local Ecosystem Governance</h3>
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-tight max-w-2xl leading-relaxed">Implement advanced telemetry and gamified compliance to drive RA 9003 adherence across Barangay {profile?.barangay}.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto shrink-0">
                        {[
                          {icon:"📡",title:"Live Telemetry", desc:"Real-time logistics tracking"},
                          {icon:"🏆",title:"Leaderboards",   desc:"Compliance gamification"},
                          {icon:"📊",title:"Spatial Data",   desc:"High-waste zone mapping"},
                          {icon:"🔔",title:"Push Alerts",    desc:"Encrypted mobile signals"},
                        ].map(f => (
                          <div key={f.title} className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-lg">{f.icon}</span>
                              <p className="text-[10px] font-black uppercase tracking-widest">{f.title}</p>
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter leading-none">{f.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* RA 9003 Statutory Footer */}
            <div className="mt-10 p-8 rounded-3xl bg-[#1c4532] text-white border border-[#1c4532]/10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)] pointer-events-none" />
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                <FileText className="text-emerald-300" size={28} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-2">Statutory Enforcement Protocol</p>
                <h4 className="text-lg font-black tracking-tight mb-2 uppercase">RA 9003 — Ecological Solid Waste Management Act</h4>
                <p className="text-sm font-medium text-emerald-100/70 tracking-tight leading-relaxed max-w-3xl uppercase italic">You are delegated with the executive authority to enforce waste segregation and synchronization of collection schedules within the jurisdiction of Barangay {profile?.barangay}.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-center shrink-0 min-w-[140px]">
                <p className="text-4xl font-black tracking-tighter mb-1">{compliance}%</p>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400">Node Stability</p>
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
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">End Protocol?</h2>
              <p className="text-[10px] font-bold text-slate-500 mb-8 leading-relaxed uppercase tracking-widest">You are about to sign out of the LGU command center.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleLogout} disabled={isLoggingOut} className="w-full py-4 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50">
                  {isLoggingOut ? "Processing…" : "Confirm Termination"}
                </button>
                <button onClick={() => setShowLogout(false)} disabled={isLoggingOut} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
                  Maintain Sync
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