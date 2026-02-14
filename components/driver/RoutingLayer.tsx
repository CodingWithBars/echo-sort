import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getDistance } from "./MapAssets"; 

const MAPBOX_TOKEN = "pk.eyJ1Ijoiam9obmJhcnJvIiwiYSI6ImNtbG15aWJ2djBtcWwzZXF4dndoZmdpbTEifQ.zsfUhUu93WZki4ipeVZhXw";

export default function RoutingLayer({ driverPos, bins, routeKey, onRouteUpdate }: any) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);
  const fallbackLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map || !driverPos) return;

    const updateRoute = async () => {
      if (routingControlRef.current) map.removeControl(routingControlRef.current);
      if (fallbackLayerRef.current) map.removeLayer(fallbackLayerRef.current);

      let targets = bins.filter((b: any) => b.fillLevel > 50);
      if (targets.length === 0) return;

      // --- BALANCED EFFICIENCY ALGORITHM ---
      const optimizedWaypoints: L.LatLng[] = [L.latLng(driverPos[0], driverPos[1])];
      let currentPos = { lat: driverPos[0], lng: driverPos[1] };
      let remainingBins = [...targets];

      while (remainingBins.length > 0) {
        remainingBins.sort((a, b) => {
          const distA = getDistance([currentPos.lat, currentPos.lng], [a.lat, a.lng]);
          const distB = getDistance([currentPos.lat, currentPos.lng], [b.lat, b.lng]);
          
          /**
           * BALANCE FORMULA:
           * We use FillLevel / 100 to get a percentage.
           * We divide distance by this percentage.
           * A higher fill level "reduces" the perceived distance in the eyes of the algorithm.
           */
          const scoreA = distA / (a.fillLevel / 100);
          const scoreB = distB / (b.fillLevel / 100);
          
          return scoreA - scoreB;
        });

        const nextBin = remainingBins.shift()!;
        optimizedWaypoints.push(L.latLng(nextBin.lat, nextBin.lng));
        currentPos = { lat: nextBin.lat, lng: nextBin.lng };
      }
      // --------------------------------------

      if (navigator.onLine) {
        try {
          // @ts-ignore
          await import("leaflet-routing-machine");
          const LeafletAny = L as any;

          routingControlRef.current = LeafletAny.Routing.control({
            waypoints: optimizedWaypoints,
            router: LeafletAny.Routing.mapbox(MAPBOX_TOKEN),
            lineOptions: {
              styles: [{ color: '#10b981', weight: 8, opacity: 0.8 }], // Emerald Path
              extendToWaypoints: true,
              missingRouteTolerance: 0
            },
            show: false,
            addWaypoints: false,
            createMarker: () => null
          })
          .on('routesfound', (e: any) => {
            const summary = e.routes[0].summary;
            onRouteUpdate?.({ distance: summary.totalDistance, time: summary.totalTime });
          })
          .on('routingerror', () => drawOfflinePath(optimizedWaypoints))
          .addTo(map);

          return;
        } catch (e) {
          drawOfflinePath(optimizedWaypoints);
        }
      } else {
        drawOfflinePath(optimizedWaypoints);
      }
    };

    const drawOfflinePath = (points: L.LatLng[]) => {
      const coords = points.map(p => [p.lat, p.lng]);
      fallbackLayerRef.current = L.polyline(coords as any, {
        color: '#10b981',
        weight: 6,
        dashArray: '10, 15',
        opacity: 0.6,
        lineCap: 'round'
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