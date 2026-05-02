import React from 'react';
// app/lgu/dashboard/_constants.ts
// Shared constants, palette, style objects, and utility helpers.

// ── THEME CONSTANTS ──────────────────────────────────────────────────────────
export const THEME = {
  bg: "#f4f7f5",
  surface: "#ffffff",
  primary: "#1c4532",
  primaryHover: "#2d5a45",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  accent: "#f0fdf4"
};

export const VIOLATION_TYPES = [
  "Improper Disposal","Open Burning","Littering",
  "Illegal Dumping","Mixed Waste","Overflowing Bin",
  "Prohibited Area Dumping","Hazardous Waste Mishandling",
];

export const BROADCAST_TYPES = [
  {id:"AWARENESS",     icon:"🌿", label:"Awareness"},
  {id:"SCHEDULE_CHANGE",icon:"📅",label:"Schedule Change"},
  {id:"NOTICE",        icon:"📋", label:"Notice"},
  {id:"WARNING",       icon:"⚠️", label:"Warning"},
  {id:"EVENT",         icon:"🎪", label:"Event"},
];

export const BROADCAST_TEMPLATES = [
  {id:"b1",type:"AWARENESS",     icon:"🌿",title:"Segregation Reminder",      body:"Please separate biodegradable and non-biodegradable waste before collection day."},
  {id:"b2",type:"SCHEDULE_CHANGE",icon:"📅",title:"Collection Schedule Change",body:"Due to the upcoming holiday, collection in your area is moved to Wednesday."},
  {id:"b3",type:"WARNING",       icon:"⚠️",title:"Littering Warning",          body:"Multiple littering incidents reported. Violators may be fined under RA 9003."},
  {id:"b4",type:"EVENT",         icon:"♻️",title:"Composting Workshop",         body:"Join us this Saturday 9AM at the Barangay Hall for a free composting seminar."},
];

export const STATUS_CFG: Record<string, {dot:string;text:string;bg:string;label:string}> = {
  Pending:        {dot:"#f59e0b",text:"#92400e",bg:"#fef3c7",label:"Pending"},
  "Under Review": {dot:"#3b82f6",text:"#1e40af",bg:"#eff6ff",label:"Under Review"},
  Resolved:       {dot:THEME.primary,  text:THEME.primary,  bg:THEME.accent,   label:"Resolved"},
  Submitted:      {dot:"#8b5cf6",text:"#5b21b6",bg:"#f5f3ff",label:"Submitted"},
  Escalated:      {dot:"#ef4444",text:"#991b1b",bg:"#fef2f2",label:"Escalated"},
  Dismissed:      {dot:"#6b7280",text:"#374151",bg:"#f1f5f9",label:"Dismissed"},
};

export const REPORT_STATUSES = ["Submitted","Under Review","Escalated","Dismissed","Resolved"];

export const DAYS     = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export const VEHICLE_TYPES = [
  "Dump Truck","Compactor Truck","Open Truck",
  "Utility Vehicle","Motorcycle w/ Cart","Trike",
];

export const INP: React.CSSProperties = {
  padding:"10px 14px",
  borderRadius:10,
  border:`1px solid ${THEME.border}`,
  background:THEME.surface,
  color:THEME.text,
  fontSize:13,
  outline:"none",
  width:"100%",
  boxSizing:"border-box",
  transition: "border-color 0.2s"
};

// ── Utility helpers ────────────────────────────────────────────────────────────

export const timeAgo = (iso: string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";

export const fmtTime = (t: string | null) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

export const scoreColor = (s: number) =>
  s >= 90 ? THEME.primary : s >= 70 ? "#16a34a" : s >= 50 ? "#d97706" : s >= 30 ? "#ea580c" : "#dc2626";

export const SLIDE_IN_RIGHT = `@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes spin{to{transform:rotate(360deg)}}`;
export const FADE_IN_UP = `@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`;