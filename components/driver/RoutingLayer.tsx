"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface RoutingLayerProps {
  driverPos: [number, number];
  bins: any[];
  selectedBinId: number | null;
  routeKey: number;
  onRouteUpdate: (summary: { distance: number; time: number }) => void;
  mode: 'fastest' | 'priority';
}

export default function RoutingLayer({ 
  driverPos, 
  bins, 
  selectedBinId, 
  routeKey, 
  onRouteUpdate, 
  mode 
}: RoutingLayerProps) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !driverPos || !token) return;

    const getOptimizedRoute = async () => {
      // 1. Cleanup old routing
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }

      // 2. Filter target bins (Full enough or very close)
      const targetBins = bins.filter((b: any) => 
        b.fillLevel > 50 || (selectedBinId === b.id)
      );

      if (targetBins.length === 0) {
        onRouteUpdate({ distance: 0, time: 0 });
        return;
      }

      // 3. Prepare coordinates for Optimization API
      // Mapbox expects: lon,lat;lon,lat...
      const truckCoord = `${driverPos[1]},${driverPos[0]}`;
      
      // If a bin is manually selected, we prioritize it
      let sortedTargets = [...targetBins];
      if (selectedBinId) {
        sortedTargets = [
          ...targetBins.filter(b => b.id === selectedBinId),
          ...targetBins.filter(b => b.id !== selectedBinId)
        ];
      }

      const binCoords = sortedTargets.map(b => `${b.lng},${b.lat}`).join(';');
      const allCoords = `${truckCoord};${binCoords}`;

      try {
        // 4. CALL OPTIMIZATION API (Dijkstra/TSP Logic)
        // 'source=first' keeps the truck at the start. 
        // 'destination=any' allows the last bin to be wherever is most efficient.
        const response = await fetch(
          `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${allCoords}?source=first&access_token=${token}&geometries=geojson&overview=full`
        );
        const data = await response.json();

        if (data.code !== 'Ok') throw new Error("Optimization API Error");

        // 5. Extract the optimized sequence of waypoints
        const optimizedWaypoints = data.waypoints
          .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index)
          .map((w: any) => L.latLng(w.location[1], w.location[0]));

        // 6. Use Leaflet Routing Machine only for DISPLAYING the calculated path
        // @ts-ignore
        await import("leaflet-routing-machine");
        const LeafletAny = L as any;

        routingControlRef.current = LeafletAny.Routing.control({
          waypoints: optimizedWaypoints,
          router: LeafletAny.Routing.mapbox(token, { profile: 'mapbox/driving' }),
          lineOptions: {
            styles: [{ 
              color: selectedBinId ? '#3b82f6' : '#10b981', 
              weight: 9, 
              opacity: 0.85,
              lineCap: 'round'
            }],
            extendToWaypoints: true,
          },
          show: false,
          addWaypoints: false,
          createMarker: () => null
        })
        .on('routesfound', (e: any) => {
          const summary = e.routes[0].summary;
          onRouteUpdate({ distance: summary.totalDistance, time: summary.totalTime });
        })
        .addTo(map);

      } catch (error) {
        console.error("Optimization failed, falling back to simple routing:", error);
      }
    };

    getOptimizedRoute();
    
    return () => {
      if (routingControlRef.current) map.removeControl(routingControlRef.current);
    };
  }, [map, driverPos, bins, selectedBinId, routeKey, mode]);

  return null;
}