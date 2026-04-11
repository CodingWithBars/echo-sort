"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import AdminBinMarker from "./AdminBinMarker";
import BinPlacementSimulator from "./BinPlacementSimulator";           // ← NEW
import { LUPON_CENTER } from "@/components/map/MapAssets";
import { createClient } from "@/utils/supabase/client";
import "leaflet/dist/leaflet.css";
import AddBinModal from "./AddBinModal";
import DeleteBinModal from "./DeleteBinModal";

const supabase = createClient();

interface Bin {
  id: number;
  device_id: string;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
  battery_level?: number;
}

function MapClickHandler({ onMapDoubleClick }: { onMapDoubleClick: (latlng: L.LatLng) => void }) {
  useMapEvents({ dblclick(e) { onMapDoubleClick(e.latlng); } });
  return null;
}

export default function BinMapView() {
  const [bins, setBins]               = useState<Bin[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [isMounted, setIsMounted]     = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // ── NEW: tab state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<"live" | "simulate">("live");

  const [mapStyle, setMapStyle] = useState<
    "navigation-night-v1" | "satellite-streets-v12" | "outdoors-v12"
  >("satellite-streets-v12");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [binToDelete, setBinToDelete] = useState<Bin | null>(null);
  const [tempCoords, setTempCoords]   = useState<L.LatLng | null>(null);
  const [toast, setToast]             = useState<{ message: string; type: "error" | "success" } | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const styles: { id: typeof mapStyle; label: string; icon: string }[] = [
    { id: "satellite-streets-v12", label: "Satellite", icon: "🛰️" },
    { id: "navigation-night-v1",   label: "Night",     icon: "🌙" },
    { id: "outdoors-v12",          label: "Terrain",   icon: "🏔️" },
  ];

  const showToast = (message: string, type: "error" | "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBins = useCallback(async () => {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) { console.error("❌ Fetch Error:", error.message); showToast("Failed to load bins", "error"); return; }
    if (data) {
      setBins(data.map((b: any) => ({
        id: b.id, device_id: b.device_id, name: b.name,
        lat: b.lat, lng: b.lng, fillLevel: b.fill_level, battery_level: b.battery_level,
      })));
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchBins();
    const channel = supabase.channel("live-bins")
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, (payload: any) => {
        const { eventType, new: n, old: o } = payload;
        if (eventType === "INSERT") setBins(prev => prev.find(b => b.id === n.id) ? prev : [...prev, { ...n, fillLevel: n.fill_level }]);
        else if (eventType === "UPDATE") setBins(prev => prev.map(b => b.device_id === n.device_id ? { ...b, lat: n.lat, lng: n.lng, fillLevel: n.fill_level, battery_level: n.battery_level } : b));
        else if (eventType === "DELETE") setBins(prev => prev.filter(b => b.id !== o.id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBins]);

  const handleMapDoubleClick = (latlng: L.LatLng) => { setTempCoords(latlng); setIsModalOpen(true); };

  const handleConfirmAdd = async (deviceId: string, binName: string) => {
    if (!tempCoords) return;
    const { data, error } = await supabase.from("bins").insert([{
      device_id: deviceId, name: binName, lat: tempCoords.lat, lng: tempCoords.lng, fill_level: 0, battery_level: 100,
    }]).select();
    if (error) { showToast(error.message, "error"); }
    else if (data?.[0]) {
      const nb: Bin = { id: data[0].id, device_id: data[0].device_id, name: data[0].name, lat: data[0].lat, lng: data[0].lng, fillLevel: data[0].fill_level, battery_level: data[0].battery_level };
      setBins(prev => prev.find(b => b.id === nb.id) ? prev : [...prev, nb]);
      setIsModalOpen(false); setTempCoords(null);
      showToast(`${binName} successfully deployed!`, "success");
      setTimeout(() => mapRef.current?.flyTo([nb.lat, nb.lng], 18, { duration: 1.5 }), 100);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!binToDelete) return;
    const { error } = await supabase.from("bins").delete().eq("id", binToDelete.id);
    if (error) showToast("Delete failed: " + error.message, "error");
    else { showToast(`${binToDelete.name} removed`, "success"); setBinToDelete(null); }
  };

  const handleRecenter = () => mapRef.current?.flyTo(LUPON_CENTER, 17, { duration: 1.5 });

  if (!isMounted) return null;

  return (
    <div className="h-full w-full relative bg-slate-900 overflow-hidden flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: `.leaflet-container { height: 100% !important; width: 100% !important; z-index: 1; } .leaflet-control-attribution { display: none !important; }` }} />

      {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 z-[50] flex-shrink-0">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "live"
              ? "bg-emerald-500 text-white shadow-lg"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          🗺 Live Map
        </button>
        <button
          onClick={() => setActiveTab("simulate")}
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "simulate"
              ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          🧪 Simulate Route
        </button>
        <div className="flex-1" />
        <span className="text-[9px] font-bold text-slate-500 uppercase">
          {activeTab === "simulate" ? "Tap to place test bins • Run A* to preview route" : `${bins.length} bins · ${bins.filter(b => b.fillLevel > 90).length} critical`}
        </span>
      </div>

      {/* ── SIMULATE TAB ────────────────────────────────────────────────── */}
      {activeTab === "simulate" && (
        <div className="flex-1 relative">
          <BinPlacementSimulator/>
        </div>
      )}

      {/* ── LIVE MAP TAB ────────────────────────────────────────────────── */}
      {activeTab === "live" && (
        <div className="flex-1 relative">
          {toast && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[999] animate-in fade-in slide-in-from-top-8 duration-500">
              <div className={`px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border flex items-center gap-4 ${toast.type === "error" ? "bg-red-500/95 border-red-400 text-white shadow-red-500/20" : "bg-slate-900/95 border-emerald-500/50 text-emerald-400 shadow-emerald-500/20"}`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20 text-lg">{toast.type === "error" ? "⚠️" : "🍀"}</div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] leading-none">{toast.message}</p>
              </div>
            </div>
          )}

          <AddBinModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} suggestedName={`Station ${bins.length + 1}`} onConfirm={handleConfirmAdd} />
          <DeleteBinModal isOpen={!!binToDelete} onClose={() => setBinToDelete(null)} onConfirm={handleDeleteConfirm} binName={binToDelete?.name || ""} />

          <MapContainer center={LUPON_CENTER} zoom={18} maxZoom={22} doubleClickZoom={false} className="h-full w-full" ref={mapRef}>
            <TileLayer
              key={mapStyle}
              url={`https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
              maxZoom={22}
              maxNativeZoom={mapStyle === "satellite-streets-v12" ? 18 : 20}
            />
            <MapClickHandler onMapDoubleClick={handleMapDoubleClick} />
            {bins.map((bin: Bin) => (
              <AdminBinMarker
                key={bin.id} bin={bin}
                isSelected={selectedBinId === bin.id}
                onSelect={(b: Bin) => setSelectedBinId(b.id)}
                onMove={async (id, lat, lng) => {
                  const { error } = await supabase.from("bins").update({ lat, lng }).eq("id", id);
                  if (error) showToast("Move failed: Check RLS", "error");
                }}
                onDelete={() => setBinToDelete(bin)}
              />
            ))}
          </MapContainer>

          {/* Controls */}
          <div className={`absolute bottom-8 right-8 z-[10] flex flex-col items-end gap-3 transition-all duration-500 ${isSheetOpen ? "opacity-0 pointer-events-none scale-90 translate-y-10" : "opacity-100 scale-100 translate-y-0"}`}>
            <button onClick={handleRecenter} className="w-12 h-12 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl flex items-center justify-center hover:bg-white active:scale-95 transition-all">
              <span className="text-lg">📍</span>
            </button>
            <button onClick={() => setIsSheetOpen(true)} className="w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center border-4 border-white bg-emerald-500 hover:bg-emerald-600 active:scale-90 transition-all">
              <span className="text-xl">⚙️</span>
            </button>
          </div>

          {/* Settings sheet */}
          <div className={`absolute bottom-0 left-0 right-0 z-[20] transition-all duration-700 ${isSheetOpen ? "translate-y-0 p-4 md:p-8" : "translate-y-full"}`}>
            <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-2xl max-w-4xl mx-auto p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div className="space-y-4">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Status</h2>
                  <div className="flex items-center gap-8">
                    <div className="flex items-baseline gap-2"><p className="text-3xl font-black text-slate-900">{bins.length}</p><p className="text-[9px] font-bold text-slate-500 uppercase">Stations</p></div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="flex items-baseline gap-2"><p className="text-3xl font-black text-red-600">{bins.filter((b: Bin) => b.fillLevel > 90).length}</p><p className="text-[9px] font-bold text-slate-500 uppercase">Critical</p></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Map Style</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {styles.map(s => (
                      <button key={s.id} onClick={() => setMapStyle(s.id)} className={`flex flex-col items-center py-2.5 rounded-xl border-2 transition-all ${mapStyle === s.id ? "bg-slate-900 border-slate-900 text-white" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
                        <span className="text-sm">{s.icon}</span>
                        <span className="text-[8px] font-black uppercase">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsSheetOpen(false)} className="mt-6 text-[9px] font-black uppercase text-slate-900 hover:text-emerald-600">Close Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}