"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Initialize the "God Mode" Admin Client
// This stays on the server and is never sent to the browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Ensure this is in your .env.local
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Creates a new Driver in Supabase Auth.
 * The Database Trigger 'on_auth_user_created' will automatically
 * handle inserting data into 'profiles' and 'driver_details'.
 */
export async function createDriverAccount(data: any) {
  try {
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: `${data.first_name} ${data.last_name}`,
        role: "DRIVER",
        // MATCH THESE TO YOUR SQL TRIGGER:
        license_number: data.license_number,
        vehicle_plate_number: data.truck_plate, // Mapping 'truck_plate' from UI to 'vehicle_plate_number' in DB
      },
    });

    if (error) throw error;

    revalidatePath("/admin/drivers");
    return { success: true };
  } catch (error: any) {
    console.error("Admin Create Error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes the user from Supabase Auth.
 * Because of our SQL 'ON DELETE CASCADE', deleting the Auth user
 * automatically wipes their row in 'profiles' and 'driver_details'.
 */
export async function deleteDriverAccount(userId: string) {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw error;

    revalidatePath("/admin/drivers");
    return { success: true };
  } catch (error: any) {
    console.error("Admin Delete Error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Soft delete: Changes status to REMOVED so they don't show in the active list
 * but the data stays in the database for safety.
 */
export async function archiveDriverAccount(userId: string) {
  try {
    // We update the employment_status to 'REMOVED'
    const { data, error } = await supabaseAdmin
      .from("driver_details")
      .update({
        employment_status: "REMOVED",
      })
      .eq("id", userId)
      .select(); // Returning data helps confirm it worked

    if (error) throw error;

    // Optional: You could also update the profile role if you wanted
    // to completely strip driver permissions, but keeping it 'REMOVED'
    // in driver_details is usually enough for an archive.

    revalidatePath("/admin/drivers");

    return {
      success: true,
      message: "Driver moved to archive",
    };
  } catch (error: any) {
    console.error("Archive Action Error:", error.message);
    return { success: false, error: error.message };
  }
}

export async function restoreDriverAccount(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("driver_details")
      .update({ employment_status: "ACTIVE" })
      .eq("id", userId);

    if (error) throw error;
    revalidatePath("/admin/drivers");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
