"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import BinMarker from "./BinMarker";
import RoutingLayer from "./RoutingLayer";
import { LUPON_CENTER } from "../map/MapAssets";

// --- Sub-component to handle camera movement ---
function MapController({
  center,
  isTracking,
}: {
  center: [number, number];
  isTracking: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (isTracking && center) {
      // "flyTo" provides a smooth animation perfect for a high-end feel
      map.flyTo(center, map.getZoom(), { animate: true, duration: 1.5 });
    }
  }, [center, isTracking, map]);

  return null;
}

export default function DriverMapDisplay({
  bins,
  driverPos,
  heading,
  selectedBinId,
  setSelectedBinId,
  routeKey,
  mode,
  maxDetour,
  useFence,
  mapStyle,
  onRouteUpdate,
  isTracking, // Pass this from the parent
}: any) {
  return (
    <div className="absolute inset-0 md:relative md:flex-1 h-full order-1 overflow-hidden">
      <MapContainer
        center={LUPON_CENTER}
        zoom={18}
        maxZoom={22}
        zoomControl={false}
        className="h-full w-full"
        // Improvement: Use canvas for smoother marker rendering if bin count grows
        preferCanvas={true}
      >
        {/* Mapbox Layer - Use the 'key' trick to force a re-render when style changes */}
        <TileLayer
          key={mapStyle}
          url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
          maxZoom={22} // Matches MapContainer
          maxNativeZoom={18} // Mapbox usually stops providing new images at 18
          tileSize={512} // Mapbox uses 512px tiles
          zoomOffset={-1}
        />

        {/* Auto-centering Logic */}
        {driverPos && (
          <MapController center={driverPos} isTracking={isTracking} />
        )}

        {/* Driver Marker */}
        {driverPos && (
          <Marker
            position={driverPos}
            icon={L.divIcon({
              html: `<div style="transform: rotate(${heading}deg)" class="transition-transform duration-500">
                      <div class="w-10 h-10 bg-blue-600 border-4 border-white rounded-full shadow-2xl flex items-center justify-center">
                        <div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-white mb-1 shadow-sm"></div>
                      </div>
                    </div>`,
              className: "custom-div-icon", // Avoid Leaflet default background
            })}
          />
        )}

        {/* Bin Markers */}
        {bins.map((bin: any) => (
          <BinMarker
            key={bin.id}
            bin={bin}
            isSelected={selectedBinId === bin.id}
            onClick={() => setSelectedBinId(bin.id)}
          />
        ))}

        {/* The Hybrid Routing Engine */}
        <RoutingLayer
          driverPos={driverPos}
          bins={bins}
          selectedBinId={selectedBinId}
          routeKey={routeKey}
          mode={mode}
          maxDetour={maxDetour}
          useFence={useFence}
          onRouteUpdate={onRouteUpdate}
        />
      </MapContainer>
    </div>
  );
}
