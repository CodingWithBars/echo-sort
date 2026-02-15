"use client";

interface NavProps {
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  isNavMode: boolean;
  setIsNavMode: (val: boolean) => void;
  heading: number;
}

export default function NavigationControls({ isEditMode, setIsEditMode, isNavMode, setIsNavMode, heading }: NavProps) {
  return (
    <div className="absolute top-6 left-6 right-6 z-[1000] flex justify-between items-start pointer-events-none">
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white pointer-events-auto">
        <h1 className="text-xl font-black text-emerald-600 tracking-tighter uppercase italic leading-none">
          EcoRoute
        </h1>
        {isNavMode && <span className="text-[10px] font-bold text-blue-500 animate-pulse">📡 NAV ACTIVE</span>}
      </div>

      <div className="flex flex-col gap-3 pointer-events-auto">
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`p-4 rounded-full shadow-2xl transition-all border-4 ${
            isEditMode ? "bg-red-500 text-white border-red-200 rotate-90" : "bg-white text-emerald-600 border-emerald-50"
          }`}
        >
          {isEditMode ? <span className="font-bold">✕</span> : "⚙️"}
        </button>

        <button
          onClick={() => setIsNavMode(!isNavMode)}
          className={`p-4 rounded-full shadow-2xl transition-all border-4 ${
            isNavMode ? "bg-blue-600 text-white border-blue-200" : "bg-white text-slate-400 border-slate-50"
          }`}
        >
          <div style={{ transform: `rotate(${isNavMode ? 0 : heading}deg)` }} className="transition-transform duration-500">
            🧭
          </div>
        </button>
      </div>
    </div>
  );
}