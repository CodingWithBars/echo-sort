// app/lgu/dashboard/_types.ts
// All shared TypeScript interfaces for the LGU dashboard.

export interface ScoreRow    { score: number; score_month: string; }
export interface AvatarRow   { avatar_url: string | null; }
export interface AuditLogRow { id: string; action_type: string; reason: string; created_at: string; }

export interface LGUProfile {
  id: string; full_name: string; email: string;
  barangay: string; municipality: string; position_title: string;
}
export interface Citizen {
  id: string; full_name: string; email: string;
  contact_number: string; warning_count: number;
  is_archived: boolean; purok: string; address_street: string;
  created_at: string; house_lot_number?: string; service_type?: string;
  municipality?: string;
  violations?: Violation[]; score?: number;
}
export interface Violation {
  id: string; citizen_id: string; citizen_name?: string;
  type: string; description: string;
  status: "Pending" | "Under Review" | "Resolved";
  created_at: string; resolved_at: string | null;
}
export interface DBNotif {
  id: string; type: string; title: string; body: string;
  is_read: boolean; created_at: string; metadata?: any;
}
export interface Broadcast {
  id: string; title: string; body: string; type: string;
  is_pinned: boolean; created_at: string; expires_at: string | null;
  created_by: string;
}
export interface Schedule {
  id: string; label: string; barangay: string;
  day_of_week: number | null; scheduled_time: string | null;
  waste_types: string[]; is_active: boolean; notes: string | null;
  next_run_at: string | null;
  driver_id?: string | null; driver_name?: string | null;
  vehicle_type?: string | null; vehicle_plate?: string | null;
  collection_area?: string | null;
  bin_ids?: string[] | null;
  estimated_distance_km?: number | null;
  estimated_duration_min?: number | null;
}
export interface AssignedDriver {
  id: string; full_name: string; duty_status: string;
  vehicle_plate_number: string | null; vehicle_type?: string | null;
  license_number: string | null;
}
export interface AreaBin {
  id: string; name: string; fill_level: number;
  lat: number; lng: number; barangay: string;
  device_id?: string;
}
export interface CitizenReport {
  id: string; reporter_id: string; reported_id: string | null;
  type: string; description: string | null; proof_urls: string[];
  status: string; lgu_notes: string | null;
  created_at: string; reviewed_at: string | null;
  reporter_name?: string; reported_name?: string;
}