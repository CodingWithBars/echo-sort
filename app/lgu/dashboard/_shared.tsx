"use client";
// app/lgu/dashboard/_shared.tsx
// Reusable UI primitives used across all LGU dashboard modals and panels.

import React from "react";
import { X } from "lucide-react";
import { EM, INP } from "./_constants";

// ── MODAL WRAPPER ─────────────────────────────────────────────────────────────

export function Modal({ onClose, children, wide = false }: {
  onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(6,78,59,.22)",backdropFilter:"blur(4px)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <style>{`
        @media(min-width:640px){
          .modal-sheet{align-self:center!important;border-radius:20px!important;max-height:90vh!important;margin:16px!important;}
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="modal-sheet"
        style={{background:"#fff",borderRadius:"20px 20px 0 0",border:`1.5px solid ${EM[200]}`,width:"100%",maxWidth:wide?800:520,boxShadow:`0 -8px 40px rgba(6,78,59,.18)`,animation:"modalIn .22s ease both",maxHeight:"92vh",overflowY:"auto",WebkitOverflowScrolling:"touch"}}
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
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"15px 18px",borderBottom:`1px solid ${EM[100]}`,background:EM[50],borderRadius:"18px 18px 0 0",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
        {Icon && (
          <div style={{width:36,height:36,borderRadius:10,background:EM[100],display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Icon size={17} color={EM[700]} />
          </div>
        )}
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,fontWeight:800,color:EM[900],fontFamily:"Georgia,serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          {sub && <div style={{fontSize:11,color:EM[600],marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
        </div>
      </div>
      <button onClick={onClose} style={{width:32,height:32,borderRadius:9,border:`1px solid ${EM[200]}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <X size={14} color={EM[700]} />
      </button>
    </div>
  );
}

// ── MODAL FOOTER ──────────────────────────────────────────────────────────────

export function MFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,padding:"14px 22px",borderTop:`1px solid ${EM[100]}`,background:EM[50],borderRadius:"0 0 18px 18px",flexWrap:"wrap"}}>
      {children}
    </div>
  );
}

// ── BUTTONS ───────────────────────────────────────────────────────────────────

export const BtnCancel = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{padding:"8px 16px",borderRadius:9,border:`1.5px solid ${EM[200]}`,background:"#fff",color:EM[700],fontSize:13,fontWeight:600,cursor:"pointer"}}>
    Cancel
  </button>
);

export const BtnPrimary = ({ onClick, disabled, children, danger = false }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled} style={{padding:"8px 20px",borderRadius:9,background:danger?"#dc2626":EM[600],color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1,display:"flex",alignItems:"center",gap:7}}>
    {children}
  </button>
);

// ── STAT CARD ─────────────────────────────────────────────────────────────────

export function StatCard({ icon: Icon, label, value, sub, accent, delay = 0, warn = false }: {
  icon: any; label: string; value: string | number; sub?: string;
  accent: string; delay?: number; warn?: boolean;
}) {
  return (
    <div style={{background:"#fff",borderRadius:16,padding:"18px 20px",border:warn?`1.5px solid ${accent}55`:`1.5px solid ${EM[100]}`,boxShadow:warn?`0 4px 20px ${accent}15`:"0 2px 12px rgba(6,78,59,.06)",display:"flex",flexDirection:"column",gap:10,animation:`fadeUp .5s ease ${delay}s both`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:10,fontWeight:800,color:"#6b7280",letterSpacing:".1em",textTransform:"uppercase"}}>{label}</span>
        <div style={{width:36,height:36,borderRadius:10,background:`${accent}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon size={18} style={{color:accent}} />
        </div>
      </div>
      <div style={{fontSize:30,fontWeight:900,color:warn?accent:EM[900],lineHeight:1,fontFamily:"Georgia,serif"}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"#9ca3af"}}>{sub}</div>}
      <div style={{height:3,borderRadius:2,background:`${accent}18`}}>
        <div style={{height:"100%",width:"60%",borderRadius:2,background:accent}} />
      </div>
    </div>
  );
}