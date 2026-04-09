"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL RESPONSIVE STYLES
// Mobile-first CSS — all grids/spacing in a <style> block with breakpoints.
// 360px → base, 640px → tablet, 1024px → desktop
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }

  @keyframes ringPulse  { 0%{transform:scale(.8);opacity:0} 50%{opacity:1} 100%{transform:scale(1.4);opacity:0} }
  @keyframes truckMove  { 0%{transform:translate(-40px,-50%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translate(260px,-50%);opacity:0} }
  @keyframes fadeUp     { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
  @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes slideDown  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeInScale{ from{opacity:0;transform:scale(.4)} to{opacity:1;transform:scale(1)} }

  .anim-1 { animation: fadeUp .9s cubic-bezier(.4,0,.2,1) forwards; }
  .anim-2 { animation: fadeUp .9s cubic-bezier(.4,0,.2,1) .18s forwards; opacity:0; }
  .anim-3 { animation: fadeUp .9s cubic-bezier(.4,0,.2,1) .34s forwards; opacity:0; }
  .slide-down { animation: slideDown .22s ease forwards; }

  /* Section padding — mobile */
  .sp { padding: 60px 20px; }
  .si { max-width: 1100px; margin: 0 auto; width: 100%; }

  /* Navbar */
  .nav { position:fixed; top:0; left:0; right:0; z-index:1000; height:64px;
         display:flex; align-items:center; justify-content:space-between; padding:0 20px;
         background:rgba(6,78,59,.93); backdrop-filter:blur(16px);
         border-bottom:1px solid rgba(110,231,183,.14); }
  .nav-dlinks { display:none; gap:28px; align-items:center; }
  .nav-link { color:rgba(255,255,255,.8); text-decoration:none; font-size:13px; font-weight:700;
              letter-spacing:.04em; transition:color .2s; font-family:sans-serif; }
  .nav-link:hover { color:#6ee7b7; }
  .ham { display:flex; align-items:center; justify-content:center; width:40px; height:40px;
         border-radius:10px; border:none; background:rgba(255,255,255,.1);
         color:#fff; cursor:pointer; font-size:18px; }
  .mmenu { position:fixed; top:64px; left:0; right:0; z-index:999;
           background:rgba(6,60,39,.97); backdrop-filter:blur(16px);
           border-bottom:1px solid rgba(110,231,183,.14);
           padding:12px 20px 20px; display:flex; flex-direction:column; gap:2; }
  .mlink { display:flex; align-items:center; padding:12px 16px; border-radius:12px;
           text-decoration:none; font-family:sans-serif; font-size:15px; font-weight:700;
           color:rgba(209,250,229,.9); transition:background .15s; }
  .mlink:hover { background:rgba(52,211,153,.12); color:#34d399; }
  .mdiv { height:1px; background:rgba(255,255,255,.08); margin:8px 0; }

  /* Auth dropdown */
  .abtn { display:flex; align-items:center; justify-content:center; background:#34d399;
          color:#022c22; padding:9px 18px; border-radius:12px; font-size:12px; font-weight:800;
          letter-spacing:.05em; text-transform:uppercase; border:none; cursor:pointer;
          font-family:sans-serif; box-shadow:0 4px 16px rgba(52,211,153,.4); transition:all .2s; }
  .abtn:hover { transform:translateY(-1px); }
  .adrop { position:absolute; top:calc(100% + 10px); right:0; background:#fff;
           border-radius:16px; overflow:hidden; min-width:210px;
           box-shadow:0 20px 60px rgba(0,0,0,.22); border:1px solid #e2e8f0; }
  .aitem { display:flex; align-items:center; gap:10px; padding:13px 16px;
           text-decoration:none; color:#0f172a; transition:background .15s;
           font-family:sans-serif; }
  .aitem:hover { background:#f0fdf4; }

  /* CTA buttons */
  .cb { display:inline-flex; align-items:center; justify-content:center;
        font-family:sans-serif; font-weight:800; letter-spacing:.06em;
        text-transform:uppercase; text-decoration:none; transition:all .2s;
        cursor:pointer; border:none; }
  .cb:hover { transform:translateY(-2px); }
  .cb:active { transform:scale(.97); }
  .cp { background:#34d399; color:#022c22; border-radius:14px; box-shadow:0 6px 24px rgba(52,211,153,.45); }
  .cg { background:rgba(255,255,255,.09); color:#d1fae5; border:1.5px solid rgba(255,255,255,.22); border-radius:14px; }
  .csm { padding:11px 20px; font-size:12px; }
  .cmd { padding:14px 26px; font-size:13px; }
  .clg { padding:16px 32px; font-size:14px; }

  /* Hero */
  .hero { position:relative; min-height:100svh; overflow:hidden; display:flex;
          align-items:center; padding-top:64px;
          background:linear-gradient(150deg,#022c22 0%,#064e3b 45%,#047857 100%); }
  .hero-c { position:relative; z-index:2; padding:56px 20px 72px; width:100%; }
  .hero-map { display:none; }
  .hero-stats { display:grid; grid-template-columns:repeat(2,1fr);
                background:rgba(255,255,255,.07); backdrop-filter:blur(8px);
                border:1px solid rgba(255,255,255,.1); border-radius:16px;
                overflow:hidden; margin-top:36px; }
  .hs { padding:15px 10px; text-align:center; }
  .hs-r { border-right:1px solid rgba(255,255,255,.1); }
  .hs-b { border-bottom:1px solid rgba(255,255,255,.1); }
  .hero-btns { display:flex; flex-direction:column; gap:12px; margin-top:28px; }

  /* About */
  .about-g { display:flex; flex-direction:column; gap:44px; }
  .about-r  { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }

  /* How */
  .how-steps { display:flex; flex-direction:column; gap:28px; }
  .how-step  { display:flex; align-items:flex-start; gap:18px; }
  .how-conn  { display:none; }
  .how-stats { display:grid; grid-template-columns:repeat(2,1fr);
               background:linear-gradient(135deg,#022c22,#064e3b);
               border-radius:18px; overflow:hidden; margin-top:44px;
               border:1px solid rgba(52,211,153,.18); box-shadow:0 16px 48px rgba(6,78,59,.28); }
  .hws { padding:20px 14px; text-align:center; }
  .hws-r { border-right:1px solid rgba(255,255,255,.08); }
  .hws-b { border-bottom:1px solid rgba(255,255,255,.08); }

  /* RA grid */
  .ra-g { display:flex; flex-direction:column; gap:44px; }

  /* Waste */
  .waste-g { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
  .wc { transition:transform .2s, box-shadow .2s; }
  .wc:hover { transform:translateY(-3px); }
  .tip { display:flex; flex-direction:column; gap:14px; margin-top:24px; padding:22px 20px;
         border-radius:18px; background:linear-gradient(135deg,#064e3b,#065f46);
         border:1px solid rgba(52,211,153,.22); }

  /* Accountability */
  .acct-g { display:flex; flex-direction:column; gap:16px; }

  /* Footer */
  .foot-i { display:flex; flex-direction:column; align-items:center; gap:18px; text-align:center; }
  .foot-l { display:flex; flex-wrap:wrap; justify-content:center; gap:16px; }

  /* Label + title */
  .lbl { font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
         font-family:sans-serif; margin-bottom:12px; }
  .ttl { font-size:clamp(26px,7vw,44px); font-weight:900; letter-spacing:-.025em;
         line-height:1.08; margin:0 0 18px; }

  /* ─── TABLET 640px+ ─── */
  @media(min-width:640px){
    .nav { padding:0 32px; }
    .hero-c { padding:72px 40px 80px; }
    .hero-stats { grid-template-columns:repeat(4,1fr); }
    .hs-b { border-bottom:none; }
    .hero-btns { flex-direction:row; }
    .sp { padding:80px 40px; }
    .how-steps { display:grid; grid-template-columns:repeat(2,1fr); gap:24px; }
    .how-step  { flex-direction:column; align-items:center; text-align:center; }
    .how-stats { grid-template-columns:repeat(4,1fr); }
    .hws-b { border-bottom:none; }
    .waste-g { grid-template-columns:repeat(2,1fr); gap:16px; }
    .tip { flex-direction:row; align-items:center; padding:26px 28px; }
    .foot-i { flex-direction:row; justify-content:space-between; align-items:center; text-align:left; }
    .foot-l { flex-wrap:nowrap; }
  }

  /* ─── DESKTOP 1024px+ ─── */
  @media(min-width:1024px){
    .nav { padding:0 48px; }
    .nav-dlinks { display:flex; }
    .ham { display:none; }
    .hero-c { padding:100px 80px 100px; max-width:600px; }
    .hero-map { display:block; position:absolute; right:-40px; top:50%;
                transform:translateY(-50%); width:52%; max-width:660px;
                aspect-ratio:3/2; opacity:.8; }
    .hero-stats { grid-template-columns:repeat(4,1fr); }
    .hero-btns { flex-direction:row; }
    .sp { padding:96px 64px; }
    .about-g { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; }
    .how-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:relative; }
    .how-conn  { display:block; position:absolute; top:36px; left:12.5%; right:12.5%;
                 height:2px; background:linear-gradient(to right,#34d399,#059669); z-index:0; }
    .how-step  { flex-direction:column; align-items:center; text-align:center; padding:0 10px; z-index:1; }
    .how-stats { grid-template-columns:repeat(4,1fr); }
    .ra-g { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; }
    .waste-g { grid-template-columns:repeat(4,1fr); gap:16px; }
    .acct-g { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────────────────────────────────────

function SplashScreen({ loading }: { loading: boolean }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",overflow:"hidden",
      background:"linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)"}}>
      <style>{`
        @keyframes ringPulse{0%{transform:scale(.8);opacity:0}50%{opacity:1}100%{transform:scale(1.4);opacity:0}}
        @keyframes truckMove{0%{transform:translate(-40px,-50%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translate(260px,-50%);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
      <div style={{position:"absolute",inset:0,opacity:.04,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}} />
      {[400,300,200].map((s,i)=>(
        <div key={s} style={{position:"absolute",width:s,height:s,borderRadius:"50%",
          border:`1px solid rgba(110,231,183,${.12+i*.08})`,
          animation:`ringPulse 3s ease-out infinite ${i*.5}s`}} />
      ))}
      <div style={{position:"relative",zIndex:10,display:"flex",flexDirection:"column",
        alignItems:"center",animation:"fadeUp .6s ease forwards"}}>
        <div style={{width:96,height:96,borderRadius:"2rem",marginBottom:24,overflow:"hidden",
          background:"rgba(255,255,255,.12)",backdropFilter:"blur(12px)",
          border:"1.5px solid rgba(255,255,255,.25)",boxShadow:"0 20px 60px rgba(0,0,0,.3)",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src="/icons/icon-512x512.png" alt="EcoRoute" style={{width:"100%",height:"100%",objectFit:"cover",padding:16}} />
        </div>
        <h1 style={{fontFamily:"Georgia,serif",fontSize:42,fontWeight:900,color:"#fff",
          letterSpacing:"-.02em",lineHeight:1,margin:0}}>
          Eco<span style={{opacity:.6,fontStyle:"italic"}}>Route</span>
        </h1>
        <p style={{marginTop:8,color:"rgba(167,243,208,.8)",fontSize:10,fontWeight:700,
          letterSpacing:".35em",textTransform:"uppercase",fontFamily:"sans-serif"}}>
          Davao Oriental
        </p>
      </div>
      <div style={{position:"relative",marginTop:48,width:256,height:48}}>
        <div style={{position:"absolute",top:"50%",left:0,width:"100%",height:1,
          borderBottom:"2px dashed rgba(110,231,183,.35)",transform:"translateY(-50%)"}} />
        <div style={{position:"absolute",top:"50%",left:0,transform:"translateY(-50%)",
          animation:"truckMove 3.5s linear infinite"}}>
          <span style={{fontSize:28,display:"block",transform:"scaleX(-1)",
            filter:"drop-shadow(0 2px 4px rgba(0,0,0,.3))"}}>🚛</span>
        </div>
      </div>
      <p style={{marginTop:32,color:"rgba(167,243,208,.7)",fontSize:10,fontWeight:700,
        letterSpacing:".4em",textTransform:"uppercase",fontFamily:"sans-serif",
        animation:"pulse 2s ease-in-out infinite"}}>
        {loading ? "Verifying Session…" : "Optimizing Collection…"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED ROUTE MAP
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedRouteMap() {
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    const p = pathRef.current; if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
    requestAnimationFrame(() => {
      p.style.transition = "stroke-dashoffset 3s cubic-bezier(.4,0,.2,1) .6s";
      p.style.strokeDashoffset = "0";
    });
  }, []);
  const ROUTE = "M 120 340 L 120 280 L 200 280 L 200 180 L 340 180 L 340 80 L 480 80 L 480 180 L 540 180";
  const BINS: [number,number,number,string][] = [
    [120,340,90,"#ef4444"],[200,280,65,"#f97316"],[200,180,45,"#eab308"],
    [340,180,80,"#ef4444"],[340,80,30,"#22c55e"],[480,80,55,"#eab308"],[480,180,70,"#f97316"],
  ];
  return (
    <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg"
      style={{width:"100%",height:"100%",position:"absolute",inset:0}}>
      <defs>
        <filter id="eco-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="eco-soft"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <style>{`@keyframes fadeInScale{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}`}</style>
      <g stroke="rgba(255,255,255,.07)" strokeWidth="1" fill="none">
        {[80,200,340,480].map(x=><line key={`v${x}`} x1={x} y1="0" x2={x} y2="400"/>)}
        {[80,180,280,360].map(y=><line key={`h${y}`} x1="0" y1={y} x2="600" y2={y}/>)}
        <line x1="0" y1="0" x2="600" y2="400" strokeWidth="1.5"/>
        <line x1="100" y1="0" x2="600" y2="300"/>
      </g>
      <path d={ROUTE} stroke="#34d399" strokeWidth="14" fill="none"
        strokeLinecap="round" strokeLinejoin="round" opacity=".18" filter="url(#eco-soft)"/>
      <path ref={pathRef} d={ROUTE} stroke="#34d399" strokeWidth="3.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round" filter="url(#eco-glow)"/>
      <rect x="56" y="326" width="28" height="28" rx="6" fill="#d97706" stroke="#fcd34d" strokeWidth="2"
        style={{animation:"fadeInScale .4s ease .3s both"}}/>
      <text x="70" y="344" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="900" fontFamily="sans-serif"
        style={{animation:"fadeInScale .4s ease .3s both"}}>HQ</text>
      {BINS.map(([x,y,fill,color],i)=>(
        <g key={i} style={{animation:`fadeInScale .4s ease ${.55+i*.22}s both`}}>
          <circle cx={x} cy={y} r="15" fill="rgba(0,0,0,.45)" stroke={color} strokeWidth="2"/>
          <text x={x} y={y+4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" fontFamily="monospace">{fill}%</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WASTE CARD
// ─────────────────────────────────────────────────────────────────────────────

function WasteCard({icon,type,color,bg,examples,tip}: {icon:string;type:string;color:string;bg:string;examples:string[];tip:string}) {
  return (
    <div className="wc" style={{background:bg,borderRadius:18,padding:"20px 16px",
      border:`1.5px solid ${color}26`,boxShadow:`0 4px 20px ${color}10`,
      display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:32}}>{icon}</div>
      <div>
        <div style={{fontSize:10,fontWeight:800,color,letterSpacing:".07em",textTransform:"uppercase",
          marginBottom:6,fontFamily:"sans-serif"}}>{type}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {examples.map(e=>(
            <span key={e} style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,
              background:`${color}18`,color,fontFamily:"sans-serif"}}>{e}</span>
          ))}
        </div>
      </div>
      <p style={{fontSize:12,color:"#475569",lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>{tip}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [showSplash,setShowSplash] = useState(true);
  const [loading,setLoading]       = useState(true);
  const [authOpen,setAuthOpen]     = useState(false);
  const [menuOpen,setMenuOpen]     = useState(false);
  const router   = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = user.user_metadata?.role;
        if (role==="ADMIN") router.push("/admin");
        else if (role==="DRIVER") router.push("/driver");
        else router.push("/dashboard");
      }
      setLoading(false);
    };
    check();
    const t = setTimeout(()=>setShowSplash(false), 3500);
    return ()=>clearTimeout(t);
  }, [router, supabase.auth]);

  useEffect(()=>{
    if (!authOpen && !menuOpen) return;
    const close = ()=>{ setAuthOpen(false); setMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    return ()=>document.removeEventListener("pointerdown", close);
  }, [authOpen, menuOpen]);

  if (showSplash || loading) return <SplashScreen loading={loading} />;

  const NAV = [{href:"#about",l:"About"},{href:"#how",l:"How It Works"},{href:"#ra9003",l:"RA 9003"},{href:"#awareness",l:"Awareness"}];

  return (
    <div style={{fontFamily:"Georgia,'Times New Roman',serif",color:"#0f172a",overflowX:"hidden"}}>
      <style>{GLOBAL_CSS}</style>

      {/* NAVBAR */}
      <nav className="nav">
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:34,height:34,borderRadius:9,overflow:"hidden",
            background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src="/icons/icon-512x512.png" alt="" style={{width:"100%",height:"100%",objectFit:"cover",padding:6}}/>
          </div>
          <span style={{fontSize:20,fontWeight:900,color:"#fff",fontStyle:"italic",fontFamily:"Georgia,serif"}}>
            Eco<span style={{opacity:.5}}>Route</span>
          </span>
        </div>

        <div className="nav-dlinks">
          {NAV.map(n=><a key={n.href} href={n.href} className="nav-link">{n.l}</a>)}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{position:"relative"}} onPointerDown={e=>e.stopPropagation()}>
            <Link href="/login">
              <button className="abtn" >
              Dashboard
            </button>
            </Link>
          </div>
          <button className="ham" onClick={()=>{setMenuOpen(o=>!o);setAuthOpen(false);}} aria-label="Menu">
            {menuOpen?"✕":"☰"}
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="mmenu slide-down" onPointerDown={e=>e.stopPropagation()}>
          {NAV.map(n=>(
            <a key={n.href} href={n.href} className="mlink" onClick={()=>setMenuOpen(false)}>{n.l}</a>
          ))}
          <div className="mdiv"/>
          <Link href="/login"    className="mlink" style={{color:"#34d399"}}>🔐 Sign In</Link>
          <Link href="/register" className="mlink" style={{color:"#86efac"}}>🌱 Register as Citizen</Link>
        </div>
      )}

      {/* HERO */}
      <section className="hero">
        <div style={{position:"absolute",inset:0,opacity:.035,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='512' height='512' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
        <div className="hero-map"><AnimatedRouteMap /></div>
        <div className="hero-c">
          <div className="anim-1" style={{display:"inline-flex",alignItems:"center",gap:8,
            background:"rgba(52,211,153,.14)",border:"1px solid rgba(52,211,153,.3)",
            borderRadius:20,padding:"5px 14px",marginBottom:20}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#34d399",animation:"pulse 2s infinite"}}/>
            <span style={{fontSize:9,fontWeight:700,color:"#6ee7b7",letterSpacing:".1em",
              textTransform:"uppercase",fontFamily:"sans-serif"}}>Live · Davao Oriental</span>
          </div>
          <h1 className="anim-2" style={{fontSize:"clamp(34px,9vw,62px)",fontWeight:900,color:"#fff",
            lineHeight:1.06,letterSpacing:"-.03em",margin:"0 0 16px"}}>
            Smart Waste<br/>Collection for<br/>
            <span style={{color:"#34d399",fontStyle:"italic"}}>Cleaner Barangays</span>
          </h1>
          <p className="anim-3" style={{fontSize:"clamp(14px,4vw,16px)",color:"rgba(209,250,229,.82)",
            lineHeight:1.72,margin:"0 0 8px",fontFamily:"sans-serif",fontWeight:400,maxWidth:460}}>
            EcoRoute uses A* route optimization and IoT-connected smart bins to guide garbage
            trucks through the most efficient collection path — reducing fuel use, missed pickups,
            and community complaints.
          </p>
          <div className="hero-btns anim-3">
            <Link href="/register" className="cb cp cmd">Get Started 🌱</Link>
            <a href="#how" className="cb cg cmd">See How It Works</a>
          </div>
          <div className="hero-stats anim-3">
            {[{v:"A*",l:"Algorithm",r:true,b:true},{v:"IoT",l:"Smart Bins",r:false,b:true},
              {v:"PWA",l:"Mobile First",r:true,b:false},{v:"RA 9003",l:"Compliant",r:false,b:false}].map(s=>(
              <div key={s.v} className={`hs ${s.r?"hs-r":""} ${s.b?"hs-b":""}`}>
                <div style={{fontSize:16,fontWeight:900,color:"#34d399",lineHeight:1,fontFamily:"Georgia,serif"}}>{s.v}</div>
                <div style={{fontSize:9,color:"rgba(209,250,229,.6)",fontFamily:"sans-serif",fontWeight:700,
                  marginTop:3,letterSpacing:".06em",textTransform:"uppercase"}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",
          display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
          <span style={{fontSize:9,color:"rgba(167,243,208,.4)",fontFamily:"sans-serif",
            letterSpacing:".18em",textTransform:"uppercase",fontWeight:700}}>Scroll</span>
          <div style={{width:1,height:30,background:"linear-gradient(to bottom,rgba(52,211,153,.5),transparent)",
            animation:"pulse 2s infinite"}}/>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="sp" style={{background:"#f0fdf4"}}>
        <div className="si">
          <div className="about-g">
            <div>
              <div className="lbl" style={{color:"#059669"}}>About the Project</div>
              <h2 className="ttl" style={{color:"#022c22"}}>The Barangay's<br/>Eyes on Every Bin</h2>
              <p style={{fontSize:"clamp(14px,3vw,16px)",color:"#374151",lineHeight:1.75,fontFamily:"sans-serif",margin:"0 0 14px"}}>
                EcoRoute is a Progressive Web App built for barangays in Davao Oriental that struggle with
                inefficient garbage collection routes, overflowing bins, and missed pickups.
              </p>
              <p style={{fontSize:"clamp(14px,3vw,16px)",color:"#374151",lineHeight:1.75,fontFamily:"sans-serif",margin:"0 0 24px"}}>
                By connecting IoT-enabled smart bins to a real-time dashboard, barangay admins can see exactly
                which bins need collection — and EcoRoute's A* algorithm automatically calculates the most
                efficient path for garbage trucks.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[["🗑️","IoT sensors report fill level in real time"],["🗺️","A* algorithm optimizes truck collection order"],
                  ["📱","Drivers navigate via mobile — no paper routes"],["👥","Citizens report illegal dumping via the app"]
                ].map(([icon,text])=>(
                  <div key={text as string} style={{display:"flex",alignItems:"center",gap:12,fontFamily:"sans-serif",
                    fontSize:"clamp(13px,3vw,14px)",color:"#374151"}}>
                    <span style={{fontSize:18,flexShrink:0}}>{icon}</span><span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="about-r">
              {[{icon:"🏛️",role:"Admin",color:"#0284c7",bg:"#f0f9ff",desc:"Monitor all bins, dispatch trucks, manage the barangay's collection schedule."},
                {icon:"🚛",role:"Driver",color:"#059669",bg:"#f0fdf4",desc:"Follow the optimized A* route, get proximity alerts, mark stops complete."},
                {icon:"👤",role:"Citizen",color:"#7c3aed",bg:"#faf5ff",desc:"Report overflowing or illegally dumped waste directly through the app."},
                {icon:"📡",role:"IoT Bin",color:"#d97706",bg:"#fffbeb",desc:"Smart bins transmit GPS location and fill level automatically via sensors."},
              ].map(c=>(
                <div key={c.role} style={{background:c.bg,border:`1.5px solid ${c.color}20`,
                  borderRadius:16,padding:"18px 16px",boxShadow:`0 4px 18px ${c.color}0c`}}>
                  <div style={{fontSize:26,marginBottom:10}}>{c.icon}</div>
                  <div style={{fontSize:11,fontWeight:800,color:c.color,textTransform:"uppercase",
                    letterSpacing:".06em",fontFamily:"sans-serif",marginBottom:6}}>{c.role}</div>
                  <p style={{fontSize:12,color:"#475569",lineHeight:1.6,margin:0,fontFamily:"sans-serif"}}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="sp" style={{background:"#fff"}}>
        <div className="si">
          <div style={{textAlign:"center",marginBottom:44}}>
            <div className="lbl" style={{color:"#059669"}}>How It Works</div>
            <h2 className="ttl" style={{color:"#022c22",marginBottom:0}}>From Sensor to Street in Seconds</h2>
          </div>
          <div style={{position:"relative"}}>
            <div className="how-conn"/>
            <div className="how-steps">
              {[{step:"01",icon:"📡",title:"Bins Report",desc:"IoT sensors measure fill level and transmit GPS data to the dashboard in real time."},
                {step:"02",icon:"🧠",title:"A* Optimizes",desc:"The A* algorithm finds the most efficient truck route considering fill level, distance, and heading."},
                {step:"03",icon:"📱",title:"Driver Navigates",desc:"Drivers follow their route on a MapLibre GL map with turn-by-turn guidance and proximity alerts."},
                {step:"04",icon:"✅",title:"Bin Cleared",desc:"After collection, the bin resets and the admin dashboard updates instantly."},
              ].map((s,i)=>(
                <div key={i} className="how-step">
                  <div style={{width:68,height:68,borderRadius:"50%",flexShrink:0,
                    background:"linear-gradient(135deg,#064e3b,#047857)",
                    border:"4px solid #fff",boxShadow:"0 4px 20px rgba(6,78,59,.2)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>
                    {s.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#34d399",letterSpacing:".1em",
                      fontFamily:"sans-serif",marginBottom:4}}>STEP {s.step}</div>
                    <div style={{fontSize:"clamp(14px,3vw,15px)",fontWeight:800,color:"#022c22",marginBottom:5}}>{s.title}</div>
                    <p style={{fontSize:12,color:"#64748b",lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="how-stats">
            {[{v:"40%+",l:"Fill Triggers Route",r:true,b:true},{v:"500m",l:"Main Road Snap",r:false,b:true},
              {v:"12",l:"Max A* Stops",r:true,b:false},{v:"Real-time",l:"IoT Updates",r:false,b:false}].map(s=>(
              <div key={s.v} className={`hws ${s.r?"hws-r":""} ${s.b?"hws-b":""}`}>
                <div style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:900,color:"#34d399",
                  fontFamily:"Georgia,serif",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:9,color:"rgba(167,243,208,.68)",fontFamily:"sans-serif",
                  fontWeight:700,marginTop:5,letterSpacing:".07em",textTransform:"uppercase"}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RA 9003 */}
      <section id="ra9003" className="sp" style={{background:"#022c22",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,opacity:.04,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
        <div className="si" style={{position:"relative",zIndex:1}}>
          <div className="ra-g">
            <div>
              <div className="lbl" style={{color:"#34d399"}}>Legal Framework</div>
              <h2 className="ttl" style={{color:"#fff"}}>
                Republic Act 9003<br/>
                <span style={{color:"#34d399",fontStyle:"italic"}}>Ecological Solid<br/>Waste Management</span>
              </h2>
              <p style={{fontSize:"clamp(14px,3vw,15px)",color:"rgba(209,250,229,.78)",lineHeight:1.75,fontFamily:"sans-serif",margin:"0 0 14px"}}>
                The Philippines' RA 9003, signed in 2001, mandates every barangay to establish an ecological
                solid waste management program — including source reduction, segregation at source,
                composting, and materials recovery.
              </p>
              <p style={{fontSize:"clamp(14px,3vw,15px)",color:"rgba(209,250,229,.78)",lineHeight:1.75,fontFamily:"sans-serif",margin:"0 0 28px"}}>
                EcoRoute directly supports barangay compliance by digitizing collection, enabling waste
                tracking, and educating citizens on proper disposal — aligned with the law's mandate
                for community participation.
              </p>
              <a href="https://emb.gov.ph/laws-and-policies-solid-waste-management-3/"
                target="_blank" rel="noopener" className="cb cp csm" style={{display:"inline-flex"}}>
                Read the Full Law ↗
              </a>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{art:"Art. 21",title:"Mandatory Segregation",desc:"Barangays must enforce waste segregation at source — biodegradable, non-biodegradable, and special wastes must be separately collected."},
                {art:"Art. 22",title:"Collection Schedules",desc:"LGUs shall establish a regular solid waste collection schedule, ensuring no community is left without service."},
                {art:"Art. 32",title:"Prohibited Acts",desc:"Open dumping, burning waste, mixing segregated waste, and littering carry fines and imprisonment under RA 9003."},
                {art:"Art. 40",title:"Barangay Responsibility",desc:"Each barangay captain is responsible for implementing and monitoring the solid waste management plan in their jurisdiction."},
              ].map(a=>(
                <div key={a.art} style={{background:"rgba(255,255,255,.05)",borderRadius:14,padding:"15px 16px",
                  border:"1px solid rgba(52,211,153,.14)",display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{background:"#34d399",color:"#022c22",borderRadius:8,padding:"4px 10px",
                    fontSize:10,fontWeight:900,fontFamily:"sans-serif",letterSpacing:".04em",
                    whiteSpace:"nowrap",flexShrink:0,marginTop:2}}>{a.art}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:"#fff",marginBottom:4,fontFamily:"sans-serif"}}>{a.title}</div>
                    <p style={{fontSize:12,color:"rgba(167,243,208,.72)",lineHeight:1.6,margin:0,fontFamily:"sans-serif"}}>{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WASTE AWARENESS */}
      <section id="awareness" className="sp" style={{background:"#fafafa"}}>
        <div className="si">
          <div style={{textAlign:"center",marginBottom:36}}>
            <div className="lbl" style={{color:"#059669"}}>Waste Segregation Guide</div>
            <h2 className="ttl" style={{color:"#022c22"}}>Know Your Waste.<br/>Protect Your Barangay.</h2>
            <p style={{fontSize:"clamp(14px,3vw,16px)",color:"#475569",lineHeight:1.7,fontFamily:"sans-serif",maxWidth:520,margin:"0 auto"}}>
              Proper waste segregation is the first step in every efficient collection system.
              Follow RA 9003's categories and help your barangay stay clean.
            </p>
          </div>
          <div className="waste-g">
            <WasteCard icon="🍃" type="Biodegradable" color="#16a34a" bg="#f0fdf4"
              examples={["Food Scraps","Leaves","Garden Waste","Paper"]}
              tip="Compost biodegradable waste at home or in your barangay's Materials Recovery Facility (MRF)."/>
            <WasteCard icon="♻️" type="Recyclable" color="#0284c7" bg="#f0f9ff"
              examples={["Plastic Bottles","Cans","Glass","Cardboard"]}
              tip="Clean and dry recyclables before placing in the blue bin. These can be sold or repurposed at the MRF."/>
            <WasteCard icon="🚫" type="Residual" color="#dc2626" bg="#fef2f2"
              examples={["Diapers","Styrofoam","Sachets","Worn Rubber"]}
              tip="Residual waste cannot be composted or recycled. Minimize single-use products to reduce this category."/>
            <WasteCard icon="⚠️" type="Special / Hazardous" color="#d97706" bg="#fffbeb"
              examples={["Batteries","Paint","Medicine","Electronics"]}
              tip="Never mix hazardous waste with regular trash. Bring to designated drop-off points or collection drives."/>
          </div>
          <div className="tip">
            <span style={{fontSize:34,flexShrink:0}}>💡</span>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:"#34d399",fontFamily:"sans-serif",marginBottom:5}}>Barangay Pro Tip</div>
              <p style={{fontSize:"clamp(12px,3vw,14px)",color:"rgba(209,250,229,.88)",lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>
                Segregating waste at home saves your barangay money — sorted waste is faster to collect,
                cheaper to process, and reduces landfill load. The cleaner your source, the more recyclables
                can be sold to fund barangay projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ACCOUNTABILITY */}
      <section className="sp" style={{background:"#fff",borderTop:"1px solid #f1f5f9"}}>
        <div className="si">
          <div style={{textAlign:"center",marginBottom:36}}>
            <div className="lbl" style={{color:"#7c3aed"}}>Community Accountability</div>
            <h2 className="ttl" style={{color:"#022c22",marginBottom:0}}>Everyone Has a Role</h2>
          </div>
          <div className="acct-g">
            {[{who:"Citizens",icon:"👥",color:"#7c3aed",bg:"#faf5ff",duties:["Segregate waste into proper categories at home","Use designated bins — never litter or illegally dump","Report overflowing or damaged bins via EcoRoute","Attend barangay waste management seminars"]},
              {who:"Barangay Officials",icon:"🏛️",color:"#0284c7",bg:"#f0f9ff",duties:["Enforce RA 9003 within the barangay boundary","Maintain the Materials Recovery Facility (MRF)","Monitor the EcoRoute dashboard for bin status","Issue citations for prohibited dumping acts"]},
              {who:"Garbage Collectors",icon:"🚛",color:"#059669",bg:"#f0fdf4",duties:["Follow the A* optimized route without deviation","Collect segregated waste in separate compartments","Mark bins as collected in the driver app","Report damaged bins or suspicious dumping sites"]},
            ].map(r=>(
              <div key={r.who} style={{background:r.bg,borderRadius:18,padding:"22px 20px",
                border:`1.5px solid ${r.color}1c`,boxShadow:`0 4px 18px ${r.color}0a`}}>
                <div style={{fontSize:28,marginBottom:12}}>{r.icon}</div>
                <div style={{fontSize:13,fontWeight:800,color:r.color,marginBottom:14,fontFamily:"sans-serif",letterSpacing:".03em"}}>{r.who}</div>
                <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:9}}>
                  {r.duties.map(d=>(
                    <li key={d} style={{display:"flex",gap:9,alignItems:"flex-start",fontFamily:"sans-serif",
                      fontSize:"clamp(12px,3vw,13px)",color:"#374151",lineHeight:1.5}}>
                      <span style={{color:r.color,fontWeight:900,flexShrink:0,marginTop:1}}>✓</span>{d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="sp" style={{background:"linear-gradient(135deg,#022c22 0%,#064e3b 100%)",
        textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,opacity:.04,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
        <div style={{position:"relative",zIndex:1,maxWidth:540,margin:"0 auto"}}>
          <div style={{fontSize:44,marginBottom:14}}>🌿</div>
          <h2 style={{fontSize:"clamp(28px,8vw,46px)",fontWeight:900,color:"#fff",
            letterSpacing:"-.02em",margin:"0 0 14px",lineHeight:1.1}}>
            Ready to Make Your<br/>Barangay Cleaner?
          </h2>
          <p style={{fontSize:"clamp(14px,3.5vw,16px)",color:"rgba(209,250,229,.75)",lineHeight:1.7,
            fontFamily:"sans-serif",margin:"0 0 32px"}}>
            Join EcoRoute today — whether you're a citizen reporting waste, a driver navigating the route,
            or a barangay official managing the entire collection system.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <Link href="/register" className="cb cp clg">Register as Citizen 🌱</Link>
            <Link href="/login"    className="cb cg clg">Sign In 🔐</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:"#011a12",padding:"32px 20px"}}>
        <div className="si">
          <div className="foot-i">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:17,fontWeight:900,color:"#34d399",fontStyle:"italic",fontFamily:"Georgia,serif"}}>EcoRoute</span>
              <span style={{fontSize:10,color:"rgba(167,243,208,.4)",fontFamily:"sans-serif"}}>· Davao Oriental</span>
            </div>
            <div className="foot-l">
              {["About","How It Works","RA 9003","Awareness"].map(l=>(
                <a key={l} href={`#${l.toLowerCase().replace(/ /g,"")}`}
                  style={{fontSize:10,color:"rgba(167,243,208,.5)",textDecoration:"none",fontFamily:"sans-serif",
                    fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",transition:"color .2s"}}
                  onMouseEnter={e=>(e.currentTarget.style.color="#34d399")}
                  onMouseLeave={e=>(e.currentTarget.style.color="rgba(167,243,208,.5)")}
                >{l}</a>
              ))}
            </div>
            <div style={{fontSize:10,color:"rgba(167,243,208,.3)",fontFamily:"sans-serif",textAlign:"center"}}>
              Built in compliance with RA 9003 · {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}