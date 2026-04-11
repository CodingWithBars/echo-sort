// app/api/admin/create-driver/route.ts
//
// ── DEPLOY TO: app/api/admin/create-driver/route.ts ──────────────────────────
//
// Uses SUPABASE_SERVICE_ROLE_KEY (server-only) so:
//   • The admin's browser session is never touched
//   • RLS is bypassed for all INSERT/UPSERT operations
//   • auth.admin.createUser() skips email confirmation
//
// Add to .env.local:
//   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   ← Supabase Dashboard → Settings → API

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email, password, full_name,
      first_name, middle_name, last_name, name_ext,
      contact_number,
      municipality, barangay,
      license_number, license_expiry,
      vehicle_plate_number, vehicle_type,
      assigned_route, employment_status,
      emergency_contact_name, emergency_contact_number,
      notes,
      admin_id,
    } = body;

    // Server-side validation
    if (!email || !password || !first_name || !last_name)
      return NextResponse.json({ error: "First name, last name, email and password are required." }, { status: 400 });
    if (!municipality || !barangay)
      return NextResponse.json({ error: "Municipality and barangay are required." }, { status: 400 });
    if (!license_number)
      return NextResponse.json({ error: "License number is required." }, { status: 400 });

    const sb = adminClient();

    // ── 1. Create auth user — does NOT create a browser session ──────────────
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email:         email.toLowerCase(),
      password,
      email_confirm: true,          // mark confirmed immediately — no email sent
      user_metadata: { full_name, role: "DRIVER" },
    });

    if (authErr) {
      const msg = authErr.message.toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered"))
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    const uid = authData.user?.id;
    if (!uid) return NextResponse.json({ error: "User creation returned no ID." }, { status: 500 });

    // ── 2. profiles ───────────────────────────────────────────────────────────
    const { error: profErr } = await sb.from("profiles").upsert({
      id: uid,
      full_name,
      first_name,
      middle_name:    middle_name    || null,
      last_name,
      name_ext:       name_ext       || null,
      contact_number: contact_number || null,
      email:          email.toLowerCase(),
      role:           "DRIVER",
      is_archived:    false,
    }, { onConflict: "id" });

    if (profErr) {
      await sb.auth.admin.deleteUser(uid).catch(() => {});
      return NextResponse.json({ error: `Profile error: ${profErr.message}` }, { status: 500 });
    }

    // ── 3. driver_details ─────────────────────────────────────────────────────
    const { error: detErr } = await sb.from("driver_details").upsert({
      id:                   uid,
      license_number:       license_number       || null,
      vehicle_plate_number: vehicle_plate_number || null,
      vehicle_type:         vehicle_type         || null,
      assigned_route:       assigned_route        || null,
      employment_status:    employment_status     || "ACTIVE",
      duty_status:          "OFF-DUTY",
    }, { onConflict: "id" });

    if (detErr) {
      await sb.auth.admin.deleteUser(uid).catch(() => {});
      return NextResponse.json({ error: `Driver details error: ${detErr.message}` }, { status: 500 });
    }

    // ── 4. lgu_details — jurisdiction tag for scoping ─────────────────────────
    await sb.from("lgu_details").upsert({
      id:                uid,
      municipality,
      barangay,
      position_title:    "Driver",
      employment_status: employment_status || "ACTIVE",
    }, { onConflict: "id" });

    // ── 5. Welcome notification ───────────────────────────────────────────────
    await sb.from("notifications").insert({
      user_id:    uid,
      type:       "SYSTEM",
      title:      "Welcome to EcoRoute",
      body:       `Your driver account has been created. You are assigned to ${barangay}, ${municipality}. Log in to begin accepting collection routes.`,
      created_by: admin_id || null,
    });

    // ── 6. Audit log ──────────────────────────────────────────────────────────
    if (admin_id) {
      await sb.from("audit_logs").insert({
        admin_id,
        action_type: "ADMIN_CREATE_DRIVER",
        target_id:   uid,
        reason: `Created driver account for ${full_name} (${email}). ` +
                `Jurisdiction: ${barangay}, ${municipality}. ` +
                `License: ${license_number}. ` +
                `Vehicle: ${vehicle_plate_number || "unassigned"}.`,
      });
    }

    return NextResponse.json({ success: true, uid });

  } catch (err: any) {
    console.error("[create-driver]", err);
    return NextResponse.json({ error: err.message ?? "Internal server error." }, { status: 500 });
  }
}