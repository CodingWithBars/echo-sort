"use client";
// app/lgu/dashboard/_shared.tsx
// Reusable UI primitives used across all LGU dashboard modals and panels.

import React from "react";
import { X } from "lucide-react";
import { THEME, INP } from "./_constants";

// ── MODAL WRAPPER ─────────────────────────────────────────────────────────────

export function Modal({ onClose, children, wide = false }: {
  onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.4)",backdropFilter:"blur(12px)",zIndex:3000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <style>{`
        @media(min-width:640px){
          .modal-sheet{align-self:center!important;border-radius:24px!important;max-height:90vh!important;margin:24px!important;}
        }
        @keyframes modalIn {from{opacity:0;transform:scale(.97) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="modal-sheet"
        style={{background:"#fff",borderRadius:"24px 24px 0 0",border:`1px solid ${THEME.border}`,width:"100%",maxWidth:wide?840:520,boxShadow:`0 25px 50px -12px rgba(0, 0, 0, 0.25)`,animation:"modalIn .3s cubic-bezier(0.16, 1, 0.3, 1) both",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch", position: "relative"}}
      >
        {children}
      </div>
    </div>
  );
}

// ── MODAL HEADER ──────────────────────────────────────────────────────────────

export function MHead({ title, sub, icon: Icon, onClose }: {
  title: string; sub?: string; icon?: any; onClose: () => void;
}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"20px 24px",borderBottom:`1px solid ${THEME.border}`,background:"#f9fafb",borderRadius:"24px 24px 0 0",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0,flex:1}}>
        {Icon && (
          <div style={{width:40,height:40,borderRadius:12,background:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0, border: `1px solid ${THEME.primary}10`}}>
            <Icon size={18} className="text-[#1c4532]" />
          </div>
        )}
        <div style={{minWidth:0}}>
          <div style={{fontSize:15,fontWeight:900,color:THEME.text,textTransform: "uppercase", letterSpacing: "-0.02em", overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          {sub && <div style={{fontSize:11,fontWeight: 700, color:THEME.textMuted,textTransform: "uppercase", letterSpacing: "0.05em", marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
        </div>
      </div>
      <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0, transition: "all 0.2s"}}>
        <X size={16} color={THEME.textMuted} />
      </button>
    </div>
  );
}

// ── MODAL FOOTER ──────────────────────────────────────────────────────────────

export function MFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,padding:"16px 24px",borderTop:`1px solid ${THEME.border}`,background:"#f9fafb",borderRadius:"0 0 24px 24px",flexWrap:"wrap"}}>
      {children}
    </div>
  );
}

// ── BUTTONS ───────────────────────────────────────────────────────────────────

export const BtnCancel = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{padding:"10px 18px",borderRadius:10,border:`1px solid ${THEME.border}`,background:"#fff",color:THEME.text,fontSize:12,fontWeight:700,textTransform: "uppercase", cursor:"pointer", transition: "all 0.2s"}}>
    Cancel
  </button>
);

export const BtnPrimary = ({ onClick, disabled, children, danger = false }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled} style={{padding:"10px 22px",borderRadius:10,background:danger?"#dc2626":THEME.primary,color:"#fff",border:"none",fontSize:12,fontWeight:900,textTransform: "uppercase", cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1,display:"flex",alignItems:"center",gap:8, transition: "all 0.2s", boxShadow: danger ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "0 4px 12px rgba(28, 69, 50, 0.2)"}}>
    {children}
  </button>
);

// ── STAT CARD ─────────────────────────────────────────────────────────────────

export function StatCard({ icon: Icon, label, value, sub, accent, delay = 0, warn = false, className = "" }: {
  icon: any; label: string; value: string | number; sub?: string;
  accent: string; delay?: number; warn?: boolean; className?: string;
}) {
  return (
    <div 
      className={className}
      style={{
        background:"#fff",
        borderRadius:20,
        padding:"20px 24px",
        border: warn ? `2px solid ${accent}40` : `1px solid ${THEME.border}`,
        boxShadow: warn ? `0 10px 25px -5px ${accent}20` : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        display:"flex",
        flexDirection:"column",
        gap:12,
        animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both`,
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between", position: "relative", zIndex: 2}}>
        <span style={{fontSize:10,fontWeight:900,color:THEME.textMuted,letterSpacing:".1em",textTransform:"uppercase"}}>{label}</span>
        <div style={{width:40,height:40,borderRadius:12,background:`${accent}10`,display:"flex",alignItems:"center",justifyContent:"center", border: `1px solid ${accent}20`}}>
          <Icon size={20} style={{color:accent}} />
        </div>
      </div>
      <div style={{fontSize:32,fontWeight:900,color: warn ? accent : THEME.text,lineHeight:1, letterSpacing: "-0.04em", position: "relative", zIndex: 2}}>{value}</div>
      {sub && <div style={{fontSize:11,fontWeight: 700, color:"#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", position: "relative", zIndex: 2}}>{sub}</div>}
      
      {/* Visual background indicator */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: `${accent}10` }}>
        <div style={{ height: "100%", width: "100%", background: accent, opacity: 0.6 }} />
      </div>
    </div>
  );
}