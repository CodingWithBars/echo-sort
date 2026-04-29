"use client";

/**
 * BypassRoutePanel
 *
 * UI component that allows drivers to:
 * 1. See when a bypass option is available
 * 2. Enter "bypass mode" to record an alternative route
 * 3. Review comparisons between algorithm and bypass routes
 * 4. Save their bypass route to the database
 * 5. Provide feedback on route quality
 */

import React, { useState, useEffect, useRef } from "react";
import type { GPSWaypoint, BypassRouteData } from "@/utils/bypassrouteutils";
import {
  cleanWaypoints,
  detectUturns,
  calculateTotalDistance,
  calculateDuration,
  estimateFuelConsumption,
  waypointsToGeoJSON,
  compareRoutes,
  shouldPreferBypassRoute,
  validateBypassRoute,
} from "@/utils/bypassrouteutils";
import { saveBypassRoute, saveRouteComparison, updateRouteComparisonResults } from "@/utils/bypassrouteservice";

interface BypassRoutePanelProps {
  isActive: boolean;
  driverPos: [number, number] | null;
  heading: number;
  currentBin: any;
  nextBins: any[];
  algorithmRoute: {
    distance: string;
    time: string;
    uturnCount: number;
  } | null;
  onBypassModeToggle: (enabled: boolean) => void;
  onBypassRouteRecorded: (routeId: string) => void;
  vehicleType: string;
  scheduleId?: string;
  driverId: string;
}

export default function BypassRoutePanel({
  isActive,
  driverPos,
  heading,
  currentBin,
  nextBins,
  algorithmRoute,
  onBypassModeToggle,
  onBypassRouteRecorded,
  vehicleType,
  scheduleId,
  driverId,
}: BypassRoutePanelProps) {
  // State
  const [bypassMode, setBypassMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [waypoints, setWaypoints] = useState<GPSWaypoint[]>([]);
  const [recordingStats, setRecordingStats] = useState({
    distanceM: 0,
    durationMs: 0,
    uturnCount: 0,
  });
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [feedback, setFeedback] = useState({
    rating: 0,
    roadNotes: "",
    roadType: "residential",
    trafficLevel: "light" as const,
  });

  // Refs
  const recordingStartRef = useRef<number>(0);
  const geoWatchIdRef = useRef<number | null>(null);
  const lastWaypointRef = useRef<GPSWaypoint | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  const startBypassRecording = () => {
    if (!driverPos) {
      alert("GPS position required to start recording");
      return;
    }

    setBypassMode(true);
    setIsRecording(true);
    setWaypoints([]);
    recordingStartRef.current = Date.now();

    // Start GPS tracking with high accuracy
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const waypoint: GPSWaypoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? heading,
          speed: pos.coords.speed ?? 0,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        };

        setWaypoints((prev) => {
          // Filter out GPS jitter (within 5m of last waypoint)
          if (prev.length > 0) {
            const lastWp = prev[prev.length - 1];
            const dist = Math.hypot(
              (waypoint.lat - lastWp.lat) * 111000,
              (waypoint.lng - lastWp.lng) * 111000 * Math.cos((lastWp.lat * Math.PI) / 180)
            );
            if (dist < 5) return prev; // Skip if too close
          }
          return [...prev, waypoint];
        });

        // Update recording stats
        if (waypoints.length > 0) {
          const cleanedWps = cleanWaypoints([...waypoints, waypoint]);
          const dist = calculateTotalDistance(cleanedWps);
          const dur = Date.now() - recordingStartRef.current;
          const uturns = detectUturns(cleanedWps).length;

          setRecordingStats({
            distanceM: dist,
            durationMs: dur,
            uturnCount: uturns,
          });
        }
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    geoWatchIdRef.current = id;
  };

  const stopBypassRecording = async () => {
    setIsRecording(false);

    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }

    if (waypoints.length < 2) {
      alert("Need at least 2 waypoints to save a route");
      return;
    }

    // Process the recorded data
    const cleanedWps = cleanWaypoints(waypoints);
    const distanceM = calculateTotalDistance(cleanedWps);
    const durationS = calculateDuration(cleanedWps);
    const uturns = detectUturns(cleanedWps);
    const geojson = waypointsToGeoJSON(cleanedWps);

    // Estimate fuel
    const { consumptionL, efficiencyKmPerL, co2EmissionsKg } = estimateFuelConsumption(
      distanceM,
      vehicleType,
      durationS,
      uturns.length,
      feedback.trafficLevel
    );

    // Prepare bypass route data
    const bypassRouteData: BypassRouteData = {
      fromBinId: currentBin.id,
      toBinId: nextBins[0]?.id || currentBin.id,
      driverId,
      routeGeojson: geojson,
      waypoints: cleanedWps,
      uturns,
      distanceM,
      durationS,
      fuelConsumptionL: consumptionL,
      fuelEfficiencyKmPerL: efficiencyKmPerL,
      estimatedCO2EmissionsKg: co2EmissionsKg,
      vehicleType,
      roadType: feedback.roadType,
      trafficLevel: feedback.trafficLevel,
      weatherCondition: "clear", // TODO: integrate with weather API
      roadNotes: feedback.roadNotes,
    };

    // Validate
    const validation = validateBypassRoute(bypassRouteData);
    if (!validation.valid) {
      alert(`Invalid route: ${validation.errors.join(", ")}`);
      return;
    }

    // Compare with algorithm route
    if (algorithmRoute) {
      const comparison = compareRoutes(
        parseInt(algorithmRoute.distance) * 1000, // km to m
        parseInt(algorithmRoute.time) * 60, // min to s
        algorithmRoute.uturnCount,
        distanceM,
        durationS,
        uturns.length
      );

      setComparisonData(comparison);
      setShowComparison(true);
      return;
    }

    // No algorithm route to compare, save directly
    await saveRoute(bypassRouteData);
  };

  const saveRoute = async (bypassRouteData: BypassRouteData) => {
    setSaving(true);

    try {
      // Save bypass route
      const saveResult = await saveBypassRoute(bypassRouteData, scheduleId);

      if (!saveResult.success) {
        alert(`Failed to save route: ${saveResult.error}`);
        setSaving(false);
        return;
      }

      // Record comparison if available
      if (comparisonData && algorithmRoute) {
        await saveRouteComparison(
          driverId,
          saveResult.routeId,
          scheduleId || null,
          comparisonData,
          shouldPreferBypassRoute(comparisonData) ? "BYPASS" : "ALGORITHM",
          feedback.roadNotes
        );
      }

      setSavedSuccess(true);
      onBypassRouteRecorded(saveResult.routeId!);

      // Reset
      setTimeout(() => {
        setBypassMode(false);
        setShowComparison(false);
        setComparisonData(null);
        setSavedSuccess(false);
        setWaypoints([]);
        setFeedback({
          rating: 0,
          roadNotes: "",
          roadType: "residential",
          trafficLevel: "light",
        });
      }, 2000);
    } catch (err) {
      console.error("Error saving route:", err);
      alert("Error saving route");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UI STATES
  // ─────────────────────────────────────────────────────────────────────────

  const renderBypassButton = () => (
    <div className="fixed bottom-24 right-6 z-[950] flex flex-col gap-3">
      {!bypassMode ? (
        <button
          onClick={() => {
            setBypassMode(true);
            onBypassModeToggle(true);
          }}
          className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110 flex items-center justify-center font-black text-lg"
          title="Record alternative route"
        >
          🛣️
        </button>
      ) : null}
    </div>
  );

  const renderRecordingUI = () => {
    if (!bypassMode || !isRecording) return null;

    return (
      <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-slate-900">🎯 Recording Route</h3>
            <div className="animate-pulse">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Distance</span>
              <span className="text-lg font-black text-emerald-600">{(recordingStats.distanceM / 1000).toFixed(2)} km</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Duration</span>
              <span className="text-lg font-black text-emerald-600">{Math.floor(recordingStats.durationMs / 1000)} s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">U-turns</span>
              <span className={`text-lg font-black ${recordingStats.uturnCount > 0 ? "text-orange-500" : "text-slate-400"}`}>
                {recordingStats.uturnCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Waypoints</span>
              <span className="text-lg font-black text-blue-600">{waypoints.length}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsRecording(false);
                setBypassMode(false);
                if (geoWatchIdRef.current !== null) {
                  navigator.geolocation.clearWatch(geoWatchIdRef.current);
                }
                setWaypoints([]);
              }}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={stopBypassRecording}
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all"
            >
              ✓ Stop & Save
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center">
            Drive your preferred route. We'll save your path and compare it with the calculated route.
          </p>
        </div>
      </div>
    );
  };

  const renderComparisonUI = () => {
    if (!showComparison || !comparisonData) return null;

    const bypass = comparisonData;
    const isBypassBetter = bypass.efficiencyScore > 50;

    return (
      <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 sticky top-0">
            <h2 className="text-3xl font-black mb-2">Route Comparison</h2>
            <p className="text-slate-300">Algorithm vs Your Route</p>
          </div>

          {/* Comparison Table */}
          <div className="p-8 space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <ComparisonMetric
                label="Distance"
                algorithm={`${(bypass.algorithmDistanceM / 1000).toFixed(2)} km`}
                bypass={`${(bypass.bypassDistanceM / 1000).toFixed(2)} km`}
                saved={`${Math.abs(bypass.distanceSavedM / 1000).toFixed(2)} km`}
                better={isBypassBetter}
              />
              <ComparisonMetric
                label="Time"
                algorithm={`${Math.round(bypass.algorithmDurationS / 60)} min`}
                bypass={`${Math.round(bypass.bypassDurationS / 60)} min`}
                saved={`${Math.abs(bypass.timeSavedS / 60).toFixed(1)} min`}
                better={isBypassBetter}
              />
              <ComparisonMetric
                label="U-turns"
                algorithm={bypass.algorithmUturnCount.toString()}
                bypass={bypass.bypassUturnCount.toString()}
                saved={Math.abs(bypass.algorithmUturnCount - bypass.bypassUturnCount).toString()}
                better={isBypassBetter}
              />
            </div>

            {/* Efficiency Score */}
            <div className={`p-6 rounded-2xl border-2 ${isBypassBetter ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-700">Efficiency Score</span>
                <span className={`text-3xl font-black ${isBypassBetter ? "text-emerald-600" : "text-amber-600"}`}>
                  {bypass.efficiencyScore.toFixed(1)}%
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {isBypassBetter
                  ? "Your route is more efficient! 🎉"
                  : "Algorithm route is more efficient, but your local knowledge is valuable"}
              </p>
            </div>

            {/* Feedback Form */}
            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl">
              <h4 className="font-black text-slate-900">Your Feedback</h4>

              {/* Rating */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Route Quality (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFeedback({ ...feedback, rating: star })}
                      className={`w-10 h-10 rounded-lg font-bold transition-all ${
                        feedback.rating >= star
                          ? "bg-yellow-400 text-white scale-110"
                          : "bg-slate-200 text-slate-400 hover:bg-slate-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Road Type */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Road Type</label>
                <select
                  value={feedback.roadType}
                  onChange={(e) => setFeedback({ ...feedback, roadType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="highway">Highway</option>
                  <option value="alley">Alley/Narrow</option>
                </select>
              </div>

              {/* Traffic Level */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Traffic Level</label>
                <select
                  value={feedback.trafficLevel}
                  onChange={(e) => setFeedback({ ...feedback, trafficLevel: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Additional Notes</label>
                <textarea
                  value={feedback.roadNotes}
                  onChange={(e) => setFeedback({ ...feedback, roadNotes: e.target.value })}
                  placeholder="e.g., 'Better for large vehicles', 'More scenic route'"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  rows={3}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowComparison(false);
                  setBypassMode(false);
                  setWaypoints([]);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all"
              >
                Discard
              </button>
              <button
                onClick={() => {
                  // Generate full bypass route data with feedback
                  const cleanedWps = cleanWaypoints(waypoints);
                  const distanceM = calculateTotalDistance(cleanedWps);
                  const durationS = calculateDuration(cleanedWps);
                  const uturns = detectUturns(cleanedWps);
                  const geojson = waypointsToGeoJSON(cleanedWps);
                  const { consumptionL, efficiencyKmPerL, co2EmissionsKg } = estimateFuelConsumption(
                    distanceM,
                    vehicleType,
                    durationS,
                    uturns.length,
                    feedback.trafficLevel
                  );

                  const bypassRouteData: BypassRouteData = {
                    fromBinId: currentBin.id,
                    toBinId: nextBins[0]?.id || currentBin.id,
                    driverId,
                    routeGeojson: geojson,
                    waypoints: cleanedWps,
                    uturns,
                    distanceM,
                    durationS,
                    fuelConsumptionL: consumptionL,
                    fuelEfficiencyKmPerL: efficiencyKmPerL,
                    estimatedCO2EmissionsKg: co2EmissionsKg,
                    vehicleType,
                    roadType: feedback.roadType,
                    trafficLevel: feedback.trafficLevel,
                    weatherCondition: "clear",
                    roadNotes: feedback.roadNotes,
                  };

                  saveRoute(bypassRouteData);
                }}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all"
              >
                {saving ? "Saving..." : "💾 Save Route"}
              </button>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="fixed top-8 left-8 z-[1400] bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold shadow-xl animate-in slide-in-from-top">
            ✓ Route saved successfully!
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isActive && !bypassMode && renderBypassButton()}
      {renderRecordingUI()}
      {renderComparisonUI()}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function ComparisonMetric({
  label,
  algorithm,
  bypass,
  saved,
  better,
}: {
  label: string;
  algorithm: string;
  bypass: string;
  saved: string;
  better: boolean;
}) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
      <h4 className="font-black text-slate-900 text-sm mb-3">{label}</h4>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-600">Algorithm</span>
          <span className="font-bold text-slate-900">{algorithm}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Your Route</span>
          <span className={`font-bold ${better ? "text-emerald-600" : "text-slate-900"}`}>{bypass}</span>
        </div>
        <div className={`flex justify-between pt-2 border-t ${better ? "border-emerald-200" : "border-slate-200"}`}>
          <span className={`${better ? "text-emerald-600" : "text-orange-600"} font-bold`}>
            {better ? "Saves" : "Costs"}
          </span>
          <span className={`font-black ${better ? "text-emerald-600" : "text-orange-600"}`}>{saved}</span>
        </div>
      </div>
    </div>
  );
}