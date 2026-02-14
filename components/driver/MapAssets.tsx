import L from "leaflet";

export const LUPON_CENTER: [number, number] = [6.8906, 126.0241];

export const getDistance = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const φ1 = (p1[0] * Math.PI) / 180;
  const φ2 = (p2[0] * Math.PI) / 180;
  const Δφ = ((p2[0] - p1[0]) * Math.PI) / 180;
  const Δλ = ((p2[1] - p1[1]) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const createBinIcon = (fillLevel: number) => {
  let color = "#10b981"; 
  if (fillLevel > 90) color = "#ef4444"; 
  else if (fillLevel > 70) color = "#f97316"; 
  else if (fillLevel > 40) color = "#f59e0b"; 

  return L.divIcon({
    html: `<div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" fill="${color}" style="width: 30px; height: 30px; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.2));">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <div style="position: absolute; top: -2px; right: -2px; background: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 2px solid ${color}; font-size: 8px; font-weight: 900; color: #1e293b;">${fillLevel}%</div>
      </div>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
};