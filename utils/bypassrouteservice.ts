/**
 * Bypass Route Database Service
 *
 * Handles all Supabase operations for:
 * - Saving driver-recorded bypass routes
 * - Retrieving and comparing routes
 * - Updating route preferences
 * - Recording route usage statistics
 */

import { createClient } from "@/utils/supabase/client";
import type { BypassRouteData, RouteComparison } from "./bypassrouteutils";

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────────
// BYPASS ROUTE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a new bypass route to the database
 */
export async function saveBypassRoute(routeData: BypassRouteData, scheduleId?: string) {
  try {
    const { data, error } = await supabase.from("bypass_routes").insert([
      {
        original_schedule_id: scheduleId || null,
        from_bin_id: routeData.fromBinId,
        to_bin_id: routeData.toBinId,
        driver_id: routeData.driverId,
        route_geojson: routeData.routeGeojson,
        waypoints: routeData.waypoints,
        uturns: routeData.uturns,
        distance_m: routeData.distanceM,
        duration_s: routeData.durationS,
        fuel_consumption_l: routeData.fuelConsumptionL,
        fuel_efficiency_km_per_l: routeData.fuelEfficiencyKmPerL,
        estimated_co2_emissions_kg: routeData.estimatedCO2EmissionsKg,
        vehicle_type: routeData.vehicleType,
        road_type: routeData.roadType || null,
        surface_type: routeData.surfaceType || null,
        estimated_traffic_level: routeData.trafficLevel || null,
        weather_condition: routeData.weatherCondition || null,
        road_notes: routeData.roadNotes || null,
        recorded_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Error saving bypass route:", error);
      return { success: false, error: error.message };
    }

    return { success: true, routeId: data?.[0]?.id };
  } catch (err: any) {
    console.error("Exception saving bypass route:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get bypass routes between two bins
 */
export async function getBypassRoutes(
  fromBinId: number,
  toBinId: number,
  options: { onlyVerified?: boolean; onlyPreferred?: boolean } = {}
) {
  try {
    let query = supabase
      .from("bypass_routes")
      .select(
        `
        id,
        from_bin_id,
        to_bin_id,
        driver_id,
        distance_m,
        duration_s,
        fuel_consumption_l,
        fuel_efficiency_km_per_l,
        estimated_co2_emissions_kg,
        uturns,
        vehicle_type,
        road_type,
        surface_type,
        estimated_traffic_level,
        weather_condition,
        road_notes,
        is_verified,
        is_preferred,
        recorded_at,
        created_at,
        profiles:driver_id(full_name)
      `
      )
      .eq("from_bin_id", fromBinId)
      .eq("to_bin_id", toBinId)
      .order("created_at", { ascending: false });

    if (options.onlyVerified) {
      query = query.eq("is_verified", true);
    }

    if (options.onlyPreferred) {
      query = query.eq("is_preferred", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching bypass routes:", error);
      return { success: false, error: error.message, routes: [] };
    }

    return { success: true, routes: data || [] };
  } catch (err: any) {
    console.error("Exception fetching bypass routes:", err);
    return { success: false, error: err.message, routes: [] };
  }
}

/**
 * Get bypass route by ID (includes full geojson)
 */
export async function getBypassRoute(bypassRouteId: string) {
  try {
    const { data, error } = await supabase
      .from("bypass_routes")
      .select(
        `
        *,
        profiles:driver_id(full_name, avatar_url)
      `
      )
      .eq("id", bypassRouteId)
      .single();

    if (error) {
      console.error("Error fetching bypass route:", error);
      return { success: false, error: error.message, route: null };
    }

    return { success: true, route: data };
  } catch (err: any) {
    console.error("Exception fetching bypass route:", err);
    return { success: false, error: err.message, route: null };
  }
}

/**
 * Get bypass routes recorded by a driver
 */
export async function getDriverBypassRoutes(driverId: string) {
  try {
    const { data, error } = await supabase
      .from("bypass_routes")
      .select(
        `
        id,
        from_bin_id,
        to_bin_id,
        distance_m,
        duration_s,
        fuel_consumption_l,
        uturns,
        vehicle_type,
        is_verified,
        is_preferred,
        recorded_at,
        created_at
      `
      )
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching driver routes:", error);
      return { success: false, error: error.message, routes: [] };
    }

    return { success: true, routes: data || [] };
  } catch (err: any) {
    console.error("Exception fetching driver routes:", err);
    return { success: false, error: err.message, routes: [] };
  }
}

/**
 * Update bypass route preference status
 * (Admin/LGU operation)
 */
export async function updateBypassRoutePreference(bypassRouteId: string, isPreferred: boolean, isVerified: boolean = true) {
  try {
    const { data, error } = await supabase
      .from("bypass_routes")
      .update({
        is_preferred: isPreferred,
        is_verified: isVerified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bypassRouteId);

    if (error) {
      console.error("Error updating bypass route preference:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Exception updating bypass route:", err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE COMPARISON OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a route comparison (algorithm vs bypass)
 */
export async function saveRouteComparison(
  driverId: string,
  bypassRouteId: string | null,
  scheduleId: string | null,
  comparison: RouteComparison,
  routeUsed: "ALGORITHM" | "BYPASS" | "HYBRID" = "ALGORITHM",
  reason: string = ""
) {
  try {
    const { data, error } = await supabase
      .from("route_comparisons")
      .insert([
        {
          driver_id: driverId,
          bypass_route_id: bypassRouteId,
          schedule_id: scheduleId,
          algorithm_distance_m: comparison.algorithmDistanceM,
          algorithm_duration_s: comparison.algorithmDurationS,
          algorithm_uturn_count: comparison.algorithmUturnCount,
          bypass_distance_m: comparison.bypassDistanceM,
          bypass_duration_s: comparison.bypassDurationS,
          bypass_uturn_count: comparison.bypassUturnCount,
          distance_saved_m: comparison.distanceSavedM,
          time_saved_s: comparison.timeSavedS,
          efficiency_score: comparison.efficiencyScore,
          route_used: routeUsed,
          selected_reason: reason,
          created_at: new Date().toISOString(),
        },
      ])
      .select("id");

    if (error) {
      console.error("Error saving route comparison:", error);
      return { success: false, error: error.message, comparisonId: null };
    }

    return { success: true, comparisonId: data?.[0]?.id };
  } catch (err: any) {
    console.error("Exception saving route comparison:", err);
    return { success: false, error: err.message, comparisonId: null };
  }
}

/**
 * Update route comparison with actual results
 */
export async function updateRouteComparisonResults(
  comparisonId: string,
  actualDistanceM: number,
  actualDurationS: number,
  actualUturnCount: number,
  driverRating?: number,
  driverFeedback?: string
) {
  try {
    const { error } = await supabase
      .from("route_comparisons")
      .update({
        actual_distance_m: actualDistanceM,
        actual_duration_s: actualDurationS,
        actual_uturn_count: actualUturnCount,
        driver_feedback_rating: driverRating || null,
        driver_feedback_text: driverFeedback || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", comparisonId);

    if (error) {
      console.error("Error updating route comparison:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Exception updating route comparison:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get route comparison history for a driver
 */
export async function getRouteComparisonHistory(driverId: string, limit: number = 20) {
  try {
    const { data, error } = await supabase
      .from("route_comparisons")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching route comparison history:", error);
      return { success: false, error: error.message, comparisons: [] };
    }

    return { success: true, comparisons: data || [] };
  } catch (err: any) {
    console.error("Exception fetching route comparison history:", err);
    return { success: false, error: err.message, comparisons: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION LOG OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Link a collection to the route that was used
 */
export async function linkCollectionToRoute(
  collectionId: string,
  routeUsed: "ALGORITHM" | "BYPASS" | "HYBRID",
  bypassRouteId?: string,
  comparisonId?: string
) {
  try {
    const { error } = await supabase
      .from("collections")
      .update({
        route_used: routeUsed,
        bypass_route_id: bypassRouteId || null,
        route_comparison_id: comparisonId || null,
      })
      .eq("id", collectionId);

    if (error) {
      console.error("Error linking collection to route:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Exception linking collection to route:", err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS & ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get route statistics for a driver
 */
export async function getDriverRouteStatistics(driverId: string) {
  try {
    // Query the route_statistics view
    const { data, error } = await supabase.rpc("get_driver_route_stats", {
      driver_id_param: driverId,
    });

    if (error) {
      // Fallback to manual calculation
      const [routesResult, comparisonsResult] = await Promise.all([
        getDriverBypassRoutes(driverId),
        getRouteComparisonHistory(driverId, 100),
      ]);

      if (routesResult.success && comparisonsResult.success) {
        const routes = routesResult.routes;
        const comparisons = comparisonsResult.comparisons;

        return {
          success: true,
          stats: {
            totalBypassRoutes: routes.length,
            avgDistanceM: routes.reduce((sum: number, r: any) => sum + r.distance_m, 0) / routes.length || 0,
            avgDurationS: routes.reduce((sum: number, r: any) => sum + r.duration_s, 0) / routes.length || 0,
            avgFuelConsumptionL: routes.reduce((sum: number, r: any) => sum + r.fuel_consumption_l, 0) / routes.length || 0,
            avgEfficiencyImprovement: comparisons.reduce((sum: number, c: any) => sum + c.efficiency_score, 0) / comparisons.length || 0,
          },
        };
      }

      return { success: false, error: error?.message || "Failed to fetch statistics" };
    }

    return { success: true, stats: data };
  } catch (err: any) {
    console.error("Exception fetching route statistics:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get the best bypass route between two bins
 * (Most verified, preferred, and efficient)
 */
export async function getBestBypassRoute(fromBinId: number, toBinId: number) {
  try {
    const { data, error } = await supabase
      .from("bypass_routes")
      .select(
        `
        *,
        profiles:driver_id(full_name)
      `
      )
      .eq("from_bin_id", fromBinId)
      .eq("to_bin_id", toBinId)
      .eq("is_verified", true)
      .eq("is_preferred", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (not an error)
      console.error("Error fetching best bypass route:", error);
      return { success: false, error: error.message, route: null };
    }

    return { success: true, route: data || null };
  } catch (err: any) {
    console.error("Exception fetching best bypass route:", err);
    return { success: false, error: err.message, route: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a bypass route (admin/driver)
 */
export async function deleteBypassRoute(bypassRouteId: string) {
  try {
    const { error } = await supabase.from("bypass_routes").delete().eq("id", bypassRouteId);

    if (error) {
      console.error("Error deleting bypass route:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Exception deleting bypass route:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Bulk update routes after verification
 */
export async function bulkUpdateRouteVerification(bypassRouteIds: string[], isVerified: boolean, isPreferred: boolean) {
  try {
    const { error } = await supabase
      .from("bypass_routes")
      .update({
        is_verified: isVerified,
        is_preferred: isPreferred,
        updated_at: new Date().toISOString(),
      })
      .in("id", bypassRouteIds);

    if (error) {
      console.error("Error bulk updating routes:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Exception bulk updating routes:", err);
    return { success: false, error: err.message };
  }
}