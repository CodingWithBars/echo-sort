"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "./MapAssets";

interface RoutingLayerProps {
  driverPos: [number, number];
  bins: any[];
  selectedBinId: number | null;
  routeKey: number;
  onRouteUpdate: (summary: { distance: number; time: number }) => void;
  mode: 'fastest' | 'priority';
  maxDetour: number;
}

export default function RoutingLayer({ 
  driverPos, bins, selectedBinId, routeKey, onRouteUpdate, mode, maxDetour 
}: RoutingLayerProps) {
  const map = useMap();
  const pathLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map || !driverPos || bins.length === 0) return;

    // 1. ORDERING LOGIC (Same "Hybrid Brain" as before)
    let urgentRemaining = bins.filter(b => b.fillLevel >= 70 || b.id === selectedBinId);
    let optRemaining = bins.filter(b => b.fillLevel >= 40 && b.fillLevel < 70 && b.id !== selectedBinId);

    if (urgentRemaining.length === 0 && optRemaining.length === 0) return;

    let currentPos: [number, number] = driverPos;
    const waypointOrder: [number, number][] = [driverPos];
    if (urgentRemaining.length === 0) urgentRemaining = [...optRemaining];

    while (urgentRemaining.length > 0) {
      let closestIdx = 0;
      let minDist = getDistance(currentPos, [urgentRemaining[0].lat, urgentRemaining[0].lng]);

      for (let i = 1; i < urgentRemaining.length; i++) {
        const d = getDistance(currentPos, [urgentRemaining[i].lat, urgentRemaining[i].lng]);
        if (d < minDist) { minDist = d; closestIdx = i; }
      }

      const nextUrgent = urgentRemaining.splice(closestIdx, 1)[0];
      const nextUrgentPos: [number, number] = [nextUrgent.lat, nextUrgent.lng];

      const onTheWay = optRemaining.filter(opt => {
        const dToOpt = getDistance(currentPos, [opt.lat, opt.lng]);
        const dOptToUrgent = getDistance([opt.lat, opt.lng], nextUrgentPos);
        return (dToOpt + dOptToUrgent) - minDist < maxDetour;
      });

      onTheWay.sort((a, b) => getDistance(currentPos, [a.lat, a.lng]) - getDistance(currentPos, [b.lat, b.lng]));
      
      onTheWay.forEach(opt => {
        waypointOrder.push([opt.lat, opt.lng]);
        optRemaining = optRemaining.filter(o => o.id !== opt.id);
      });

      waypointOrder.push(nextUrgentPos);
      currentPos = nextUrgentPos;
    }

    // 2. FETCH ROAD-SNAPPED GEOMETRY
    const getRoadRoute = async () => {
      // Mapbox expects lng,lat
      const coordsString = waypointOrder.map(p => `${p[1]},${p[0]}`).join(';');
      const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

      try {
        const response = await fetch(query);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
          const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

          if (pathLayerRef.current) map.removeLayer(pathLayerRef.current);

          pathLayerRef.current = L.polyline(coordinates, {
            color: mode === 'priority' ? '#f97316' : '#10b981',
            weight: 6,
            opacity: 0.8,
            lineJoin: "round",
            lineCap: "round"
          }).addTo(map);

          onRouteUpdate({ 
            distance: route.distance, 
            time: route.duration // Mapbox returns duration in seconds
          });
        }
      } catch (error) {
        console.error("Routing error:", error);
      }
    };

    getRoadRoute();

    return () => { if (pathLayerRef.current) map.removeLayer(pathLayerRef.current); };
  }, [map, driverPos, bins, selectedBinId, routeKey, mode, maxDetour]);

  return null;
}