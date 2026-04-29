/**
 * Bypass Route Utilities
 *
 * Handles:
 * - GPS waypoint tracking and validation
 * - U-turn detection based on heading changes
 * - Distance and duration calculations
 * - Fuel consumption estimation
 * - Route comparison logic
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GPSWaypoint {
  lat: number;
  lng: number;
  heading: number;
  speed: number; // m/s
  accuracy: number;
  timestamp: number; // unix ms
}

export interface UTurn {
  waypointIndex: number;
  heading: number;
  angleDiff: number;
  timestamp: number;
}

export interface BypassRouteData {
  fromBinId: number;
  toBinId: number;
  driverId: string;
  routeGeojson: GeoJSON.LineString;
  waypoints: GPSWaypoint[];
  uturns: UTurn[];
  distanceM: number;
  durationS: number;
  fuelConsumptionL: number;
  fuelEfficiencyKmPerL: number;
  estimatedCO2EmissionsKg: number;
  vehicleType: string;
  roadType?: string;
  surfaceType?: string;
  trafficLevel?: string;
  weatherCondition?: string;
  roadNotes?: string;
}

export interface RouteComparison {
  algorithmDistanceM: number;
  algorithmDurationS: number;
  algorithmUturnCount: number;
  bypassDistanceM: number;
  bypassDurationS: number;
  bypassUturnCount: number;
  distanceSavedM: number;
  timeSavedS: number;
  efficiencyScore: number; // 0-100
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;
const HEADING_TOLERANCE_DEGREES = 15; // Smoothing threshold
const UTURN_ANGLE_THRESHOLD = 120; // > 120° = U-turn
const SIDE_TURN_THRESHOLD = 60; // 60-120° = side turn
const MIN_WAYPOINT_SPACING_M = 5; // Filter out GPS jitter
const VEHICLE_FUEL_CONSUMPTION: Record<string, number> = {
  tricycle: 8, // km/L
  truck: 6,
  "6-wheeler": 5,
  van: 7,
  motorcycle: 25,
};

// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE & BEARING
// ─────────────────────────────────────────────────────────────────────────────

export function haversineDistance(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function calculateBearing(from: [number, number], to: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLon = toRad(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(toRad(to[0]));
  const x = Math.cos(toRad(from[0])) * Math.sin(toRad(to[0])) - Math.sin(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAYPOINT PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean waypoints by removing duplicates and GPS jitter
 */
export function cleanWaypoints(waypoints: GPSWaypoint[]): GPSWaypoint[] {
  if (waypoints.length < 2) return waypoints;

  const cleaned: GPSWaypoint[] = [waypoints[0]];

  for (let i = 1; i < waypoints.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = waypoints[i];
    const dist = haversineDistance([prev.lat, prev.lng], [curr.lat, curr.lng]);

    // Only add if far enough from last point (filter GPS jitter)
    if (dist >= MIN_WAYPOINT_SPACING_M) {
      cleaned.push(curr);
    }
  }

  return cleaned;
}

/**
 * Smooth heading values to reduce noise
 */
export function smoothHeading(headings: number[], windowSize: number = 3): number[] {
  if (headings.length < windowSize) return headings;

  const smoothed: number[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < headings.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(headings.length, i + half + 1);
    const window = headings.slice(start, end);

    // Circular mean for headings
    let sinSum = 0,
      cosSum = 0;
    for (const h of window) {
      const rad = (h * Math.PI) / 180;
      sinSum += Math.sin(rad);
      cosSum += Math.cos(rad);
    }
    const avgHeading = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
    smoothed.push((avgHeading + 360) % 360);
  }

  return smoothed;
}

// ─────────────────────────────────────────────────────────────────────────────
// U-TURN DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect U-turns based on heading changes
 * Returns array of U-turns with their characteristics
 */
export function detectUturns(waypoints: GPSWaypoint[]): UTurn[] {
  if (waypoints.length < 2) return [];

  const headings = waypoints.map((w) => w.heading);
  const smoothedHeadings = smoothHeading(headings, 5);

  const uturns: UTurn[] = [];

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prevHeading = smoothedHeadings[i - 1];
    const currHeading = smoothedHeadings[i];
    const nextHeading = smoothedHeadings[i + 1];

    // Calculate turn angle between arrival and departure
    const arrivalHeading = prevHeading;
    const departureHeading = nextHeading;
    const turnAngle = angleDifference(arrivalHeading, departureHeading);

    // U-turn: > 120° turn
    if (turnAngle > UTURN_ANGLE_THRESHOLD) {
      uturns.push({
        waypointIndex: i,
        heading: currHeading,
        angleDiff: turnAngle,
        timestamp: waypoints[i].timestamp,
      });
    }
  }

  return uturns;
}

/**
 * Classify waypoints by turn type
 */
export function classifyTurns(waypoints: GPSWaypoint[]): { straight: number; left: number; right: number; uturn: number } {
  const headings = waypoints.map((w) => w.heading);
  const smoothedHeadings = smoothHeading(headings, 5);

  let straight = 0,
    left = 0,
    right = 0,
    uturn = 0;

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prevHead = smoothedHeadings[i - 1];
    const currHead = smoothedHeadings[i];
    const nextHead = smoothedHeadings[i + 1];

    const turn = nextHead - prevHead;
    const normTurn = ((turn + 180) % 360) - 180; // Normalize to -180 to 180
    const angle = Math.abs(normTurn);

    if (angle <= HEADING_TOLERANCE_DEGREES) {
      straight++;
    } else if (angle > UTURN_ANGLE_THRESHOLD) {
      uturn++;
    } else if (normTurn > 0) {
      left++;
    } else {
      right++;
    }
  }

  return { straight, left, right, uturn };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTANCE & DURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate total distance traveled
 */
export function calculateTotalDistance(waypoints: GPSWaypoint[]): number {
  if (waypoints.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dist = haversineDistance([waypoints[i - 1].lat, waypoints[i - 1].lng], [waypoints[i].lat, waypoints[i].lng]);
    total += dist;
  }

  return total;
}

/**
 * Calculate duration in seconds
 */
export function calculateDuration(waypoints: GPSWaypoint[]): number {
  if (waypoints.length < 2) return 0;
  return (waypoints[waypoints.length - 1].timestamp - waypoints[0].timestamp) / 1000;
}

/**
 * Calculate average speed
 */
export function calculateAverageSpeed(waypoints: GPSWaypoint[]): number {
  const distance = calculateTotalDistance(waypoints);
  const duration = calculateDuration(waypoints);
  if (duration === 0) return 0;
  return distance / duration; // m/s
}

// ─────────────────────────────────────────────────────────────────────────────
// FUEL CONSUMPTION ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate fuel consumption based on distance and vehicle type
 * Factors:
 * - Base fuel efficiency
 * - Idle time (stops at bins)
 * - Traffic/congestion
 * - Terrain (estimated from elevation changes if available)
 * - U-turn inefficiency
 */
export function estimateFuelConsumption(
  distanceM: number,
  vehicleType: string,
  durationS: number,
  uturnCount: number = 0,
  trafficLevel: "light" | "moderate" | "heavy" = "light"
): { consumptionL: number; efficiencyKmPerL: number; co2EmissionsKg: number } {
  const distanceKm = distanceM / 1000;
  const baseFuelEfficiency = VEHICLE_FUEL_CONSUMPTION[vehicleType] || 6; // Default 6 km/L

  // Traffic penalty: reduces efficiency
  const trafficPenalty = trafficLevel === "heavy" ? 0.75 : trafficLevel === "moderate" ? 0.85 : 1.0;

  // U-turn penalty: additional fuel consumption per U-turn
  const uturnPenalty = 1 + uturnCount * 0.05; // 5% penalty per U-turn

  // Idle time penalty: ~0.5L per 10 min of idling (bin collection, waiting)
  const idleTimeMins = durationS / 60;
  const idleConsumption = idleTimeMins > 60 ? (idleTimeMins / 60) * 0.5 : 0;

  // Effective efficiency
  const effectiveEfficiency = (baseFuelEfficiency * trafficPenalty) / uturnPenalty;

  // Total fuel consumption
  const drivingConsumption = distanceKm / effectiveEfficiency;
  const totalConsumption = drivingConsumption + idleConsumption;

  // CO2 emissions: ~2.31 kg per liter of fuel
  const co2EmissionsKg = totalConsumption * 2.31;

  return {
    consumptionL: Math.max(0, totalConsumption),
    efficiencyKmPerL: effectiveEfficiency,
    co2EmissionsKg: Math.max(0, co2EmissionsKg),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOJSON CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert waypoints to GeoJSON LineString
 */
export function waypointsToGeoJSON(waypoints: GPSWaypoint[]): GeoJSON.LineString {
  return {
    type: "LineString",
    coordinates: waypoints.map((w) => [w.lng, w.lat]),
  };
}

/**
 * Convert GeoJSON back to coordinates
 */
export function geoJSONToCoordinates(lineString: GeoJSON.LineString): Array<[number, number]> {
  return lineString.coordinates as Array<[number, number]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare algorithm route with bypass route
 * Returns efficiency score (0-100)
 * - 50 = equal
 * - >50 = bypass is better
 * - <50 = algorithm is better
 */
export function compareRoutes(
  algorithmDistanceM: number,
  algorithmDurationS: number,
  algorithmUturnCount: number,
  bypassDistanceM: number,
  bypassDurationS: number,
  bypassUturnCount: number
): RouteComparison {
  const distanceSaved = algorithmDistanceM - bypassDistanceM;
  const timeSaved = algorithmDurationS - bypassDurationS;

  // Efficiency score: weighted comparison
  // 40% distance, 40% time, 20% U-turns
  const distanceScore = Math.min(100, Math.max(0, 50 + (distanceSaved / algorithmDistanceM) * 50));
  const timeScore = Math.min(100, Math.max(0, 50 + (timeSaved / algorithmDurationS) * 50));
  const uturnScore = algorithmUturnCount === bypassUturnCount ? 50 : bypassUturnCount < algorithmUturnCount ? 75 : 25;

  const efficiencyScore = distanceScore * 0.4 + timeScore * 0.4 + uturnScore * 0.2;

  return {
    algorithmDistanceM,
    algorithmDurationS,
    algorithmUturnCount,
    bypassDistanceM,
    bypassDurationS,
    bypassUturnCount,
    distanceSavedM: distanceSaved,
    timeSavedS: timeSaved,
    efficiencyScore: Math.round(efficiencyScore * 10) / 10,
  };
}

/**
 * Determine if bypass route should be preferred
 */
export function shouldPreferBypassRoute(comparison: RouteComparison): boolean {
  // Prefer bypass if:
  // - Significantly shorter distance (>5%)
  // - Significantly faster (>5%)
  // - Fewer U-turns
  const distanceDiff = (comparison.distanceSavedM / comparison.algorithmDistanceM) * 100;
  const timeDiff = (comparison.timeSavedS / comparison.algorithmDurationS) * 100;
  const uturnSavings = comparison.algorithmUturnCount - comparison.bypassUturnCount;

  return distanceDiff > 5 || timeDiff > 5 || (uturnSavings > 0 && distanceDiff > -3);
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate bypass route data before saving
 */
export function validateBypassRoute(data: Partial<BypassRouteData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.fromBinId || !data.toBinId) {
    errors.push("From and To bin IDs are required");
  }

  if (!data.driverId) {
    errors.push("Driver ID is required");
  }

  if (!data.waypoints || data.waypoints.length < 2) {
    errors.push("At least 2 waypoints required");
  }

  if (!data.routeGeojson || data.routeGeojson.coordinates.length < 2) {
    errors.push("Invalid GeoJSON route");
  }

  if ((data.distanceM || 0) <= 0) {
    errors.push("Distance must be greater than 0");
  }

  if ((data.durationS || 0) <= 0) {
    errors.push("Duration must be greater than 0");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}