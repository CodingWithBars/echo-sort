import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Trash2 } from "lucide-react";

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

export const createBinIcon = (
  fillLevel: number, 
  isSelected: boolean = false, 
  batteryLevel: number = 100, 
  isMini: boolean = false 
) => {
  let color = "#10b981"; // Emerald
  if (fillLevel > 90) color = "#ef4444"; 
  else if (fillLevel > 75) color = "#f97316"; 
  else if (fillLevel > 45) color = "#f59e0b"; 

  const isLowBattery = batteryLevel < 20;
  const baseSize = isMini ? 24 : 44;
  const iconActualSize = isSelected ? baseSize * 1.2 : baseSize;
  
  const selectionStyle = isSelected 
    ? `filter: drop-shadow(0px 0px 12px ${color}aa); z-index: 1000; transform: translateY(-5px);` 
    : `filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.15));`;

  const iconMarkup = renderToStaticMarkup(
    <Trash2 
      size={iconActualSize} 
      color={color} 
      strokeWidth={isSelected ? 3 : 2.5}
      fill={fillLevel > 5 ? `${color}33` : "none"} 
    />
  );

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${iconActualSize}px; height: ${iconActualSize}px; display: flex; align-items: center; justify-content: center; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); ${selectionStyle}">
        
        ${!isMini ? `
          <div style="
            position: absolute;
            bottom: -5px;
            width: 60%;
            height: 4px;
            background: rgba(0,0,0,0.1);
            border-radius: 50%;
            filter: blur(2px);
            z-index: -1;
          "></div>
        ` : ''}

        ${!isMini ? `
          <div style="
            position: absolute; 
            top: -18px; 
            left: 50%;
            transform: translateX(-50%);
            background: ${color}; 
            border-radius: 20px; 
            padding: 2px 8px;
            font-size: 10px; 
            font-weight: 900; 
            color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            z-index: 10;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span style="opacity: 0.8; font-size: 8px;">LEVEL</span>
            ${fillLevel}%
          </div>
        ` : ''}

        ${iconMarkup}

        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: ${isMini ? '8px' : '12px'};
          height: ${isMini ? '8px' : '12px'};
          background: ${isLowBattery ? '#ef4444' : '#10b981'};
          border: 2px solid white;
          border-radius: 50%;
          display: ${isLowBattery || isSelected ? 'block' : 'none'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ${isLowBattery ? 'animation: eco-pulse 1.5s infinite;' : ''}
        "></div>

        <style>
          @keyframes eco-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0px rgba(239, 68, 68, 0.4); }
            70% { transform: scale(1.2); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0px rgba(239, 68, 68, 0); }
          }
        </style>
      </div>`,
    className: "eco-bin-marker",
    iconSize: [iconActualSize, iconActualSize],
    iconAnchor: [iconActualSize / 2, iconActualSize],
  });
};