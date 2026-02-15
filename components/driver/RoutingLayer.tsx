"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "./MapAssets"; 

const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function RoutingLayer({ driverPos, bins, routeKey, onRouteUpdate }: any) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);
  const fallbackLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map || !driverPos) return;

    const updateRoute = async () => {
      // 1. Cleanup previous routes
      if (routingControlRef.current) map.removeControl(routingControlRef.current);
      if (fallbackLayerRef.current) map.removeLayer(fallbackLayerRef.current);

      let targets = bins.filter((b: any) => b.fillLevel > 50);
      if (targets.length === 0) return;

      // 2. Balanced Efficiency Logic (Score = Distance / FillLevel)
      const sequence: L.LatLng[] = [L.latLng(driverPos[0], driverPos[1])];
      let currentPos = { lat: driverPos[0], lng: driverPos[1] };
      let remainingBins = [...targets];

      while (remainingBins.length > 0) {
        remainingBins.sort((a, b) => {
          const distA = getDistance([currentPos.lat, currentPos.lng], [a.lat, a.lng]);
          const distB = getDistance([currentPos.lat, currentPos.lng], [b.lat, b.lng]);
          const scoreA = distA / (a.fillLevel / 100);
          const scoreB = distB / (b.fillLevel / 100);
          return scoreA - scoreB;
        });
        const next = remainingBins.shift()!;
        sequence.push(L.latLng(next.lat, next.lng));
        currentPos = { lat: next.lat, lng: next.lng };
      }

      // 3. ROAD-SNAP EXECUTION (Requires valid token)
      if (navigator.onLine && token) {
        try {
          // @ts-ignore
          await import("leaflet-routing-machine");
          const LeafletAny = L as any;

          routingControlRef.current = LeafletAny.Routing.control({
            waypoints: sequence.map(latlng => LeafletAny.Routing.waypoint(latlng)),
            router: LeafletAny.Routing.mapbox(token, {
              profile: 'mapbox/driving',
              options: {
                overview: 'full',      // Forces high-detail road geometry
                geometries: 'polyline6'
              }
            }),
            lineOptions: {
              styles: [{ 
                color: '#10b981', // EcoRoute Emerald
                weight: 8, 
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }],
              extendToWaypoints: true,
              missingRouteTolerance: 100 // Snaps bin locations to the nearest road
            },
            show: false,
            addWaypoints: false,
            createMarker: () => null
          })
          .on('routesfound', (e: any) => {
            const summary = e.routes[0].summary;
            onRouteUpdate?.({ distance: summary.totalDistance, time: summary.totalTime });
          })
          .on('routingerror', (err: any) => {
            console.error("Mapbox Route Failed (Check Token):", err);
            drawOfflinePath(sequence);
          })
          .addTo(map);

        } catch (e) {
          drawOfflinePath(sequence);
        }
      } else {
        drawOfflinePath(sequence);
      }
    };

    const drawOfflinePath = (points: L.LatLng[]) => {
      // This only shows if Mapbox fails
      fallbackLayerRef.current = L.polyline(points as any, {
        color: '#10b981',
        weight: 6,
        dashArray: '10, 15',
        opacity: 0.5,
      }).addTo(map);
      onRouteUpdate?.({ distance: 0, time: 0 }); 
    };


    
    updateRoute();
    return () => {
      if (routingControlRef.current) map.removeControl(routingControlRef.current);
      if (fallbackLayerRef.current) map.removeLayer(fallbackLayerRef.current);
    };
  }, [map, driverPos, bins, routeKey]);

  return null;
}