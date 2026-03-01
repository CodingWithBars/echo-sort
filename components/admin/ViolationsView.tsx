"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import AddViolationForm from "./AddViolationForm";

const supabase = createClient();

export default function ViolationsView() {
  const [viewMode, setViewMode] = useState<"active" | "deleted">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("All"); // Status Filter State
  const [selectedViolation, setSelectedViolation] = useState<any | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchViolations = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("violations")
      .select(`
        *,
        profiles:citizen_id (
          full_name,
          email,
          warning_count,
          citizen_details (barangay)
        )
      `)
      .order("created_at", { ascending: sortOrder === "asc" });

    // Apply Server-side Status Filter
    if (filterStatus !== "All") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;
    if (!error && data) setViolations(data);
    setIsLoading(false);
  }, [sortOrder, filterStatus]);

  const fetchAuditLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action_type", "DELETE_VIOLATION")
      .order("created_at", { ascending: false });
    
    if (!error && data) setAuditLogs(data);
  }, []);

  useEffect(() => {
    fetchViolations();
    fetchAuditLogs();
  }, [fetchViolations, fetchAuditLogs]);

  // --- STYLING HELPERS ---
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Resolved": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "Under Review": return "bg-amber-50 text-amber-600 border-amber-200";
      default: return "bg-red-50 text-red-600 border-red-100";
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case "Resolved": return "border-emerald-500";
      case "Under Review": return "border-amber-400";
      default: return "border-red-500";
    }
  };

  const getResidentBarangay = (v: any) => {
    return v.barangay && v.barangay !== "Unassigned"
      ? v.barangay
      : v.profiles?.citizen_details?.[0]?.barangay || "Unassigned";
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("violations").update({ status: newStatus }).eq("id", id);
    if (!error) {
      fetchViolations(); // Refresh to apply current filters
      setSelectedViolation(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteReason.trim()) return;
    setIsDeleting(true);
    await supabase.from("audit_logs").insert([{
      action_type: "DELETE_VIOLATION",
      target_id: selectedViolation.citizen_id,
      reason: deleteReason,
      metadata: {
          resident: selectedViolation.profiles?.full_name,
          type: selectedViolation.type,
          description: selectedViolation.description,
          barangay: getResidentBarangay(selectedViolation)
      }
    }]);
    const { error } = await supabase.from("violations").delete().eq("id", selectedViolation.id);
    if (!error) {
      setShowDeleteConfirm(false);
      setSelectedViolation(null);
      setDeleteReason("");
      fetchViolations();
      fetchAuditLogs();
    }
    setIsDeleting(false);
  };

  const handleRestore = async (log: any) => {
    setIsRestoring(true);
    const { type, description, barangay } = log.metadata;
    const { error: insertError } = await supabase.from("violations").insert([{
      citizen_id: log.target_id,
      type: type,
      description: description,
      barangay: barangay,
      status: 'Pending'
    }]);
    if (!insertError) {
      await supabase.from("audit_logs").delete().eq("id", log.id);
      setAuditLogs(prev => prev.filter(a => a.id !== log.id));
      fetchViolations();
    }
    setIsRestoring(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Enforcement Hub</h1>
          <p className="text-[10px] font-black text-slate-400 tracking-[0.4em] uppercase mt-1 leading-none">EcoRoute Regulatory Control</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setViewMode(viewMode === "active" ? "deleted" : "active")}
                className={`flex-1 md:flex-none px-4 md:px-6 py-4 rounded-[1.2rem] md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black uppercase transition-all border-2 ${
                    viewMode === "deleted" ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-inner" : "bg-white border-slate-100 text-slate-400"
                }`}>
                {viewMode === "active" ? "📜 Archive" : "🔙 Active"}
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none px-6 md:px-8 py-4 bg-emerald-600 text-white rounded-[1.2rem] md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100">
                + Incident
            </button>
        </div>
      </div>

      {/* --- SEARCH, SORT & STATUS FILTERS --- */}
      <div className="px-2 space-y-4">
        <div className="flex gap-2 items-center">
            <div className="relative flex-1 group">
                <input 
                    type="text" 
                    placeholder="Search residents..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-4 md:p-5 bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-sm"
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">🔍</div>
            </div>

            {/* NEWEST / OLDEST TOGGLE */}
            <button 
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="p-4 md:p-5 bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] hover:border-emerald-500 transition-all shadow-sm flex items-center gap-2 group"
            >
                <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-emerald-600 hidden md:block">
                    {sortOrder === "desc" ? "Newest" : "Oldest"}
                </span>
                <span className="text-lg">{sortOrder === "desc" ? "🔽" : "🔼"}</span>
            </button>
        </div>

        {/* STATUS FILTER CHIPS */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {["All", "Pending", "Under Review", "Resolved"].map((status) => (
                <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`whitespace-nowrap px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                        filterStatus === status 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200"
                    }`}
                >
                    {status}
                </button>
            ))}
        </div>
      </div>

      {/* --- GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2">
        {viewMode === "active" ? (
          violations.filter(v => (v.profiles?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())).map((v) => (
            <div key={v.id} onClick={() => setSelectedViolation(v)} className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm p-6 md:p-8 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden">
              <span className={`text-[7px] md:text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getStatusStyle(v.status)}`}>
                {v.status}
              </span>
              <h3 className="font-black text-lg md:text-xl mt-4 text-slate-900 group-hover:text-emerald-600 italic uppercase leading-none">{v.profiles?.full_name}</h3>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{v.type}</p>
              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-300 uppercase">
                <span>📍 Brgy. {getResidentBarangay(v)}</span>
                <span className="text-[7px] font-bold opacity-60">
                    {new Date(v.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} className="bg-slate-900 rounded-[2rem] p-6 md:p-8 border border-slate-800">
                <h4 className="text-white font-black text-lg uppercase italic mb-1">{log.metadata?.resident}</h4>
                <p className="text-emerald-500 text-[10px] font-bold uppercase mb-4 italic opacity-80">"{log.reason}"</p>
                <button onClick={() => handleRestore(log)} disabled={isRestoring} className="w-full py-4 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Restore
                </button>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL: VIOLATION DETAILS --- */}
      {selectedViolation && !showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-sm" onClick={() => setSelectedViolation(null)} />
          <div className={`relative w-full max-w-2xl bg-white rounded-t-[2.5rem] md:rounded-[4rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 border-t-[10px] ${getStatusBorder(selectedViolation.status)} max-h-[90vh] flex flex-col`}>
            <div className="p-6 md:p-14 overflow-y-auto">
              <div className="flex justify-between items-start mb-8 md:mb-12">
                <div>
                  <span className={`px-2 py-1 text-[7px] md:text-[8px] font-black rounded-full uppercase tracking-widest border ${getStatusStyle(selectedViolation.status)}`}>
                    {selectedViolation.status}
                  </span>
                  <h2 className="text-2xl md:text-5xl font-black text-slate-900 italic uppercase leading-none mt-4">{selectedViolation.profiles?.full_name}</h2>
                  <p className="text-emerald-500 font-black text-[10px] md:text-[12px] uppercase tracking-widest mt-1 italic">{selectedViolation.type}</p>
                </div>
                <button onClick={() => setShowDeleteConfirm(true)} className="p-4 md:p-6 bg-emerald-50 text-emerald-600 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm active:scale-90 transition-transform">🗑️</button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
                <div className="bg-emerald-50/50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-emerald-100">
                    <p className="text-[7px] md:text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Barangay</p>
                    <p className="text-xs md:text-sm font-black uppercase text-slate-900 truncate">Brgy. {getResidentBarangay(selectedViolation)}</p>
                </div>
                <div className="bg-emerald-50/50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-emerald-100">
                    <p className="text-[7px] md:text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Warnings</p>
                    <p className="text-xs md:text-sm font-black uppercase text-slate-900">{selectedViolation.profiles?.warning_count || 0}</p>
                </div>
              </div>

              <div className="relative mb-8 md:mb-12 group">
                <div className="absolute -top-2.5 left-6 px-3 py-0.5 bg-slate-900 text-white text-[7px] md:text-[8px] font-black rounded-full uppercase tracking-widest z-10">Incident Notes</div>
                <div className="p-6 md:p-10 bg-slate-50 rounded-[2rem] md:rounded-[3rem] border-2 border-slate-100 shadow-inner">
                  <p className="text-xs md:text-base font-bold text-slate-700 italic leading-relaxed uppercase">
                    "{selectedViolation.description || "No specific incident notes recorded."}"
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <button onClick={() => handleUpdateStatus(selectedViolation.id, "Under Review")} className="flex-1 py-4 md:py-6 bg-amber-400 text-white rounded-[1.2rem] md:rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-amber-100 active:scale-95 transition-all">Review</button>
                <button onClick={() => handleUpdateStatus(selectedViolation.id, "Resolved")} className="flex-1 py-4 md:py-6 bg-emerald-600 text-white rounded-[1.2rem] md:rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 active:scale-95 transition-all">Resolve</button>
                <button onClick={() => setSelectedViolation(null)} className="flex-1 py-4 md:py-6 bg-slate-900 text-white rounded-[1.2rem] md:rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION --- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in zoom-in-95 border border-emerald-100">
            <h3 className="text-lg md:text-xl font-black text-slate-900 text-center mb-6 uppercase italic tracking-tighter text-emerald-700">Audit Reason</h3>
            <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Why is this record being archived?"
                className="w-full p-5 bg-emerald-50/30 border-2 border-emerald-100 rounded-[1.5rem] text-xs font-bold outline-none mb-6 resize-none shadow-inner" rows={3}
            />
            <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleConfirmDelete} disabled={isDeleting} className="flex-[2] py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase shadow-lg shadow-emerald-100">
                    {isDeleting ? "..." : "Archive"}
                </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && <AddViolationForm onClose={() => setShowAddModal(false)} onSuccess={fetchViolations} />}
    </div>
  );
}