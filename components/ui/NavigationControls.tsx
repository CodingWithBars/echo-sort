"use client";

interface NavProps {
  // Made these optional with "?" to fix the TypeScript error
  isEditMode?: boolean;
  setIsEditMode?: (val: boolean) => void;
  isNavMode: boolean;
  setIsNavMode: (val: boolean) => void;
  heading: number;
}

export default function NavigationControls({ 
  isEditMode = false, 
  setIsEditMode, 
  isNavMode, 
  setIsNavMode, 
  heading 
}: NavProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
      
      {/* BRAND LOGO */}
      <div className="bg-white/80 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-white pointer-events-auto">
        <h1 className="text-sm font-black text-emerald-600 tracking-tighter uppercase italic leading-none">
          EcoRoute
        </h1>
        {isNavMode && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Nav</span>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        
        {/* Only show Edit/Settings button if setIsEditMode is provided (Admin Mode) */}
        {setIsEditMode && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-2.5 rounded-full shadow-lg transition-all border-[3px] flex items-center justify-center w-10 h-10 ${
              isEditMode 
                ? "bg-red-500 text-white border-red-200 rotate-90" 
                : "bg-white text-emerald-600 border-emerald-50 active:bg-slate-50"
            }`}
          >
            {isEditMode ? <span className="text-xs font-bold">✕</span> : <span className="text-sm">⚙️</span>}
          </button>
        )}

        <button
          onClick={() => setIsNavMode(!isNavMode)}
          className={`p-2.5 rounded-full shadow-lg transition-all border-[3px] flex items-center justify-center w-10 h-10 ${
            isNavMode 
              ? "bg-blue-600 text-white border-blue-200" 
              : "bg-white text-slate-400 border-slate-50 active:bg-slate-50"
          }`}
        >
          <div 
            style={{ transform: `rotate(${isNavMode ? 0 : heading}deg)` }} 
            className="transition-transform duration-500 text-sm"
          >
            🧭
          </div>
        </button>
      </div>
    </div>
  );
}