import { Marker, Popup } from "react-leaflet";
import { createBinIcon } from "./MapAssets";

interface Bin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

interface BinMarkerProps {
  bin: Bin;
  onCollect?: (id: number) => void;
}

export default function BinMarker({ bin, onCollect }: BinMarkerProps) {
  return (
    <Marker position={[bin.lat, bin.lng]} icon={createBinIcon(bin.fillLevel)}>
      <Popup className="eco-popup">
        <div className="p-2 text-center min-w-[120px]">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
            Lupon Node {bin.id}
          </p>
          <h3 className="text-base font-bold text-slate-800 mb-2">{bin.name}</h3>
          
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
            <div 
              className={`h-full transition-all duration-500 ${
                bin.fillLevel > 90 ? 'bg-red-500' : bin.fillLevel > 70 ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${bin.fillLevel}%` }}
            />
          </div>

          <button 
            onClick={() => onCollect?.(bin.id)}
            className="w-full py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Mark Collected
          </button>
        </div>
      </Popup>
    </Marker>
  );
}