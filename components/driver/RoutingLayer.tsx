"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "./MapAssets";

interface RoutingLayerProps {
  // Fix: Allow null here to match your DriverMap state
  driverPos: [number, number] | null; 
  bins: any[];
  selectedBinId: number | null;
  routeKey: number;
  onRouteUpdate: (summary: { distance: number; time: number }) => void;
  mode: 'fastest' | 'priority';
  maxDetour: number;
  useFence: boolean;
}

export default function RoutingLayer({ 
  driverPos, bins, selectedBinId, routeKey, onRouteUpdate, mode, maxDetour, useFence 
}: RoutingLayerProps) {
  const map = useMap();
  const pathLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    // GUARD: If driverPos is null, we can't calculate a route. 
    // We also clear the existing path if there is one.
    if (!map || !driverPos || bins.length === 0) {
      if (pathLayerRef.current) map.removeLayer(pathLayerRef.current);
      return;
    }

    // --- 1. RADIUS FENCING ---
    const GLOBAL_MAX_RANGE = 2500; 
    const nearbyBins = bins.filter(b => {
      if (!useFence) return true;
      // TS now knows driverPos is not null because of the guard above
      const distFromDriver = getDistance(driverPos, [b.lat, b.lng]);
      return distFromDriver <= GLOBAL_MAX_RANGE || b.id === selectedBinId;
    });

    // --- 2. TIERING ---
    let urgentRemaining = nearbyBins.filter(b => b.fillLevel >= 70 || b.id === selectedBinId);
    let optRemaining = nearbyBins.filter(b => b.fillLevel >= 40 && b.fillLevel < 70 && b.id !== selectedBinId && b.fillLevel > 0);

    if (urgentRemaining.length === 0 && optRemaining.length === 0) {
      if (pathLayerRef.current) map.removeLayer(pathLayerRef.current);
      onRouteUpdate({ distance: 0, time: 0 });
      return;
    }

    let currentPos: [number, number] = driverPos;
    const waypointOrder: [number, number][] = [driverPos];
    if (urgentRemaining.length === 0) urgentRemaining = [...optRemaining];

    // --- 3. ALGORITHM WITH STRICT DETOUR ---
    while (urgentRemaining.length > 0) {
      let closestIdx = 0;
      let minDist = getDistance(currentPos, [urgentRemaining[0].lat, urgentRemaining[0].lng]);

      for (let i = 1; i < urgentRemaining.length; i++) {
        const d = getDistance(currentPos, [urgentRemaining[i].lat, urgentRemaining[i].lng]);
        if (d < minDist) { minDist = d; closestIdx = i; }
      }

      const nextUrgent = urgentRemaining.splice(closestIdx, 1)[0];
      const nextUrgentPos: [number, number] = [nextUrgent.lat, nextUrgent.lng];

      const validDetours = optRemaining.filter(opt => {
        const dToOpt = getDistance(currentPos, [opt.lat, opt.lng]);
        const dOptToUrgent = getDistance([opt.lat, opt.lng], nextUrgentPos);
        const deviation = (dToOpt + dOptToUrgent) - minDist;
        return deviation <= maxDetour; 
      });

      validDetours.sort((a, b) => getDistance(currentPos, [a.lat, a.lng]) - getDistance(currentPos, [b.lat, b.lng]));
      
      validDetours.forEach(opt => {
        waypointOrder.push([opt.lat, opt.lng]);
        optRemaining = optRemaining.filter(o => o.id !== opt.id);
      });

      waypointOrder.push(nextUrgentPos);
      currentPos = nextUrgentPos;
    }

    // --- 4. RENDER ROAD PATH ---
    const fetchRoads = async () => {
      const coordsString = waypointOrder.map(p => `${p[1]},${p[0]}`).join(';');
      const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

      try {
        const response = await fetch(query);
        const data = await response.json();
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          if (pathLayerRef.current) map.removeLayer(pathLayerRef.current);
          pathLayerRef.current = L.polyline(coords, {
            color: mode === 'priority' ? '#f97316' : '#10b981',
            weight: 6, opacity: 0.8, lineJoin: "round", lineCap: "round"
          }).addTo(map);
          onRouteUpdate({ distance: route.distance, time: route.duration });
        }
      } catch (e) { console.error("Routing error", e); }
    };

    fetchRoads();
    return () => { if (pathLayerRef.current) map.removeLayer(pathLayerRef.current); };
  }, [map, driverPos, bins, selectedBinId, routeKey, mode, maxDetour, useFence]);

  return null;
}