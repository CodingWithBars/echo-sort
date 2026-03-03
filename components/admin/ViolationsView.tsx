"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import AddViolationForm from "./AddViolationForm";
import {
  Search,
  ChevronDown,
  Calendar,
  MapPin,
  AlertCircle,
  Archive,
  History,
  Plus,
  ArrowUpDown,
} from "lucide-react";

const supabase = createClient();

export default function ViolationsView() {
  const [viewMode, setViewMode] = useState<"active" | "deleted">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("All");
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
      .select(
        `
        *,
        profiles:citizen_id (
          full_name,
          email,
          warning_count,
          citizen_details (barangay)
        )
      `,
      )
      .order("created_at", { ascending: sortOrder === "asc" });

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
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Under Review":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-red-50 text-red-700 border-red-100";
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case "Resolved":
        return "border-emerald-500";
      case "Under Review":
        return "border-amber-400";
      default:
        return "border-red-500";
    }
  };

  const getResidentBarangay = (v: any) => {
    return v.barangay && v.barangay !== "Unassigned"
      ? v.barangay
      : v.profiles?.citizen_details?.[0]?.barangay || "Unassigned";
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("violations")
      .update({ status: newStatus })
      .eq("id", id);
    if (!error) {
      fetchViolations();
      setSelectedViolation(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteReason.trim()) return;
    setIsDeleting(true);
    await supabase.from("audit_logs").insert([
      {
        action_type: "DELETE_VIOLATION",
        target_id: selectedViolation.citizen_id,
        reason: deleteReason,
        metadata: {
          resident: selectedViolation.profiles?.full_name,
          type: selectedViolation.type,
          description: selectedViolation.description,
          barangay: getResidentBarangay(selectedViolation),
        },
      },
    ]);
    const { error } = await supabase
      .from("violations")
      .delete()
      .eq("id", selectedViolation.id);
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
    const { error: insertError } = await supabase.from("violations").insert([
      {
        citizen_id: log.target_id,
        type: type,
        description: description,
        barangay: barangay,
        status: "Pending",
      },
    ]);
    if (!insertError) {
      await supabase.from("audit_logs").delete().eq("id", log.id);
      setAuditLogs((prev) => prev.filter((a) => a.id !== log.id));
      fetchViolations();
    }
    setIsRestoring(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* --- HEADER --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
        <div>
          <p className="text-[10px] font-black text-slate-400 tracking-[0.4em] uppercase mt-2">
            EcoRoute Regulatory Control
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full lg:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
        >
          <Plus size={16} strokeWidth={3} />
          Report Incident
        </button>
      </div>

      {/* --- DETACHED NAVIGATION & SEARCH --- */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch px-2">
        {/* COMBINED SEARCH & SORT BLOCK */}
        <div className="relative flex items-center group w-full bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:border-emerald-500 focus-within:ring-4 ring-emerald-500/5 transition-all duration-300">
          {/* SEARCH ICON */}
          <div className="pl-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <Search size={18} strokeWidth={2.5} />
          </div>

          {/* INPUT FIELD */}
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 h-14 pl-4 pr-2 bg-transparent text-[11px] font-bold uppercase tracking-widest outline-none placeholder:text-slate-300 text-slate-900"
          />

          {/* VERTICAL DIVIDER */}
          <div className="h-8 w-[1px] bg-slate-100 mx-2" />

          {/* INTEGRATED SORT TOGGLE */}
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="h-14 px-5 flex items-center gap-3 hover:bg-slate-50 rounded-r-2xl transition-all active:scale-95 border-l border-transparent"
          >
            <ArrowUpDown
              size={14}
              strokeWidth={3}
              className={
                sortOrder === "desc" ? "text-emerald-600" : "text-slate-400"
              }
            />
            <span className="text-[9px] font-black uppercase text-slate-600 hidden sm:inline tracking-tighter">
              {sortOrder === "desc" ? "Newest" : "Oldest"}
            </span>
          </button>
        </div>

        {/* TAB SWITCHER BLOCK */}
        <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm shrink-0 items-stretch h-14">
          <button
            onClick={() => setViewMode("active")}
            className={`flex-1 lg:flex-none px-8 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-3 ${
              viewMode === "active"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <History size={14} />
            <span>Active</span>
          </button>

          <button
            onClick={() => setViewMode("deleted")}
            className={`flex-1 lg:flex-none px-8 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-3 ${
              viewMode === "deleted"
                ? "bg-slate-900 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Archive size={14} />
            <span>Archive</span>
          </button>
        </div>
      </div>

      {/* --- STATUS FILTER CHIPS (ONLY FOR ACTIVE) --- */}
      {viewMode === "active" && (
        <div className="flex gap-2 overflow-x-auto px-2 no-scrollbar">
          {["All", "Pending", "Under Review", "Resolved"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                filterStatus === status
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100"
                  : "bg-white border-slate-200 text-slate-400 hover:border-emerald-300"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {/* --- GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
        {isLoading
          ? [...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-slate-50 rounded-[2.5rem] animate-pulse border border-slate-100"
              />
            ))
          : viewMode === "active"
            ? violations
                .filter((v) =>
                  (v.profiles?.full_name || "")
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()),
                )
                .map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedViolation(v)}
                    className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 hover:shadow-2xl hover:border-emerald-100 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <span
                        className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border ${getStatusStyle(v.status)}`}
                      >
                        {v.status}
                      </span>
                      <AlertCircle
                        size={18}
                        className="text-slate-200 group-hover:text-red-500 transition-colors"
                      />
                    </div>
                    <h3 className="font-black text-xl text-slate-900 group-hover:text-emerald-600 italic uppercase leading-tight">
                      {v.profiles?.full_name}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                      {v.type}
                    </p>

                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-emerald-500" />
                        <span>Brgy. {getResidentBarangay(v)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={12} />
                        <span>
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            : auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-xl"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-white font-black text-lg uppercase italic leading-tight">
                      {log.metadata?.resident}
                    </h4>
                    <Archive size={18} className="text-emerald-500/50" />
                  </div>
                  <p className="text-emerald-400 text-[10px] font-bold uppercase mb-8 italic opacity-80 leading-relaxed">
                    "{log.reason}"
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(log);
                    }}
                    disabled={isRestoring}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50"
                  >
                    {isRestoring ? "Restoring..." : "Restore Record"}
                  </button>
                </div>
              ))}
      </div>

      {/* --- MODAL: VIOLATION DETAILS (CLEAN DETACHED STYLE) --- */}
      {selectedViolation && !showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          {/* Clean backdrop with light blur */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedViolation(null)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-400 flex flex-col max-h-[90vh]">
            {/* 1. STATUS HEADER STRIP */}
            <div
              className={`h-1.5 w-full ${selectedViolation.status === "Resolved" ? "bg-emerald-500" : "bg-amber-500"}`}
            />

            <div className="p-6 md:p-10 overflow-y-auto no-scrollbar">
              {/* 2. TOP ALIGNMENT: NAME & ARCHIVE */}
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                    {selectedViolation.profiles?.full_name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-black rounded border ${getStatusStyle(selectedViolation.status)} uppercase tracking-widest`}
                    >
                      {selectedViolation.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-l pl-2 border-slate-200">
                      Ref: #{selectedViolation.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-100 shadow-sm"
                >
                  <Archive size={20} />
                </button>
              </div>

              {/* 3. CORE DATA GRID (DETACHED STYLE) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Violation Type
                  </p>
                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate">
                    {selectedViolation.type}
                  </p>
                </div>
                <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Jurisdiction
                  </p>
                  <p className="text-[11px] font-bold text-slate-900 uppercase">
                    Brgy. {getResidentBarangay(selectedViolation)}
                  </p>
                </div>
                <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Total Warnings
                  </p>
                  <p className="text-[11px] font-bold text-slate-900 uppercase">
                    {selectedViolation.profiles?.warning_count || 0} Record/s
                  </p>
                </div>
              </div>

              {/* 4. INCIDENT DESCRIPTION (UNIFIED BOX) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-10">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={14} className="text-slate-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Incident Narrative
                  </span>
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-700 leading-relaxed italic border-l-2 border-emerald-500 pl-4">
                  {selectedViolation.description ||
                    "No specific details provided for this entry."}
                </p>
              </div>

              {/* 5. PROFESSIONAL ACTION TRAY */}
              <div className="flex flex-col gap-3">
                {/* Primary Actions Grid - Side by Side even on Mobile */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      handleUpdateStatus(selectedViolation.id, "Under Review")
                    }
                    className="h-14 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:border-amber-400 transition-all active:scale-95 shadow-sm flex items-center justify-center text-center px-2"
                  >
                    Move to Review
                  </button>

                  <button
                    onClick={() =>
                      handleUpdateStatus(selectedViolation.id, "Resolved")
                    }
                    className="h-14 bg-emerald-600 text-white rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center text-center px-2"
                  >
                    Mark Resolved
                  </button>
                </div>

                {/* Close Button - Full width on mobile for easy dismissal */}
                <button
                  onClick={() => setSelectedViolation(null)}
                  className="w-full sm:w-auto sm:self-end h-12 px-10 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE/ARCHIVE CONFIRMATION (DETACHED STYLE) --- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Darker backdrop for higher stakes action */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowDeleteConfirm(false)}
          />

          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            {/* Visual Danger Indicator */}
            <div className="h-1.5 w-full bg-red-600" />

            <div className="p-8 md:p-10">
              <div className="text-center mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">
                  Archive Incident
                </h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Fleet Database Neutralization
                </p>
              </div>

              <div className="relative group mb-8">
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="STATE REASON FOR ARCHIVAL..."
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider outline-none resize-none focus:bg-white focus:border-red-500 focus:ring-4 ring-red-500/5 transition-all placeholder:text-slate-300"
                  rows={3}
                />
              </div>

              {/* ACTION TRAY: Grid ensures inline buttons on mobile */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="h-14 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="h-14 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                >
                  {isDeleting ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddViolationForm
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchViolations}
        />
      )}
    </div>
  );
}
