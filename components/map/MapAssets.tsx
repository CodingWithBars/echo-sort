import L from "leaflet";

// Lupon, Davao Oriental Center Point
export const LUPON_CENTER: [number, number] = [6.8906, 126.0241];

/**
 * Haversine Formula for Mathematical Distance
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
 * Updated with Zoom-Aware scaling (isMini) and performance-focused SVG rendering.
 */
export const createBinIcon = (
  fillLevel: number, 
  isSelected: boolean = false, 
  batteryLevel: number = 100, 
  isMini: boolean = false // Added zoom-awareness parameter
) => {
  // 1. Color Logic
  let color = "#10b981"; // Emerald
  if (fillLevel > 90) color = "#ef4444"; 
  else if (fillLevel > 75) color = "#f97316"; 
  else if (fillLevel > 45) color = "#f59e0b"; 

  const isLowBattery = batteryLevel < 20;
  
  // 2. Dynamic Scaling based on zoom (isMini)
  const baseSize = isMini ? 24 : 44;
  const iconActualSize = isSelected ? baseSize * 1.2 : baseSize;
  
  // 3. Selection/Status Style
  const selectionStyle = isSelected 
    ? `filter: drop-shadow(0px 0px 8px ${color}88); z-index: 1000;` 
    : `filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1));`;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${iconActualSize}px; height: ${iconActualSize}px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; ${selectionStyle}">
        
        <svg viewBox="0 0 24 24" style="width: 100%; height: 100%;">
          <path fill="${color}" d="M15,2H9C7.89,2,7,2.89,7,4v1h10V4C17,2.89,16.11,2,15,2z M19,6H5v1h14V6z M6,8v11c0,1.1,0.9,2,2,2h8c1.1,0,2-0.9,2-2V8H6z M15,18H9v-2h6V18z M15,14H9v-2h6V14z"/>
        </svg>
        
        ${!isMini ? `
          <div style="
            position: absolute; 
            bottom: -2px; 
            right: -6px; 
            background: white; 
            border-radius: 6px; 
            padding: 1px 4px;
            border: 1px solid ${color}; 
            font-size: 8px; 
            font-weight: 900; 
            color: #0f172a;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 2;
          ">
            ${fillLevel}%
          </div>
        ` : ''}

        <div style="
          position: absolute;
          top: 0px;
          left: 0px;
          width: ${isMini ? '6px' : '10px'};
          height: ${isMini ? '6px' : '10px'};
          background: ${isLowBattery ? '#ef4444' : '#10b981'};
          border: 1.5px solid white;
          border-radius: 50%;
          display: ${isLowBattery || isSelected ? 'flex' : 'none'};
          ${isLowBattery ? 'animation: eco-pulse 1.5s infinite;' : ''}
        "></div>

        <style>
          @keyframes eco-pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      </div>`,
    className: "eco-bin-marker",
    iconSize: [iconActualSize, iconActualSize],
    iconAnchor: [iconActualSize / 2, iconActualSize],
  });
};