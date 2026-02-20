import L from "leaflet";

// Lupon, Davao Oriental Center Point
export const LUPON_CENTER: [number, number] = [6.8906, 126.0241];

/**
 * Haversine Formula for Mathematical Distance
 * Returns distance in meters between two [lat, lng] points.
 */
export const getDistance = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (p1[0] * Math.PI) / 180;
  const φ2 = (p2[0] * Math.PI) / 180;
  const Δφ = ((p2[0] - p1[0]) * Math.PI) / 180;
  const Δλ = ((p2[1] - p1[1]) * Math.PI) / 180;

  const a = 
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + 
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};


/**
 * EcoRoute Styled Bin Icons
 * Follows the emerald color scheme and bold typography constraints.
 */
export const createBinIcon = (fillLevel: number, isSelected: boolean = false) => {
  let color = "#10b981"; // Default Emerald
  if (fillLevel > 90) color = "#ef4444"; // Red
  else if (fillLevel > 70) color = "#f97316"; // Orange
  else if (fillLevel > 40) color = "#f59e0b"; // Amber

  // Selection Glow Effect
  const glow = isSelected ? `filter: drop-shadow(0px 0px 8px ${color}); transform: scale(1.2);` : "";

  return L.divIcon({
    html: `
      <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; ${glow}">
        <svg viewBox="0 0 24 24" fill="${color}" style="width: 32px; height: 32px; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.15));">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        
        <div style="
          position: absolute; 
          top: -4px; 
          right: -4px; 
          background: white; 
          border-radius: 8px; /* Massive rounded corners */
          padding: 2px 4px;
          min-width: 22px;
          height: 16px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: 2px solid ${color}; 
          font-size: 9px; 
          font-family: sans-serif;
          font-weight: 900; /* Bold typography */
          color: #1e293b;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
          ${fillLevel}%
        </div>
      </div>`,
    className: "eco-bin-marker",
    iconSize: [42, 42],
    iconAnchor: [21, 42],
  });
};