"use client";

import { useEffect, useState } from "react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("EcoRoute was installed!");
    }

    // Reset the prompt state
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-80 z-50">
      <div className="bg-white border border-emerald-100 shadow-2xl rounded-2xl p-4 flex items-center justify-between animate-bounce-subtle">
        <div className="flex items-center gap-3">
          <div className="mb-8 flex h-12 w-12 items-center justify-center bg-white shadow-[0_0_50px_rgba(0,0,0,0.2)] overflow-hidden">
              <img
                src="/icons/icon-512x512.png"
                alt="EcoRoute Logo"
                className="h-full w-full object-cover p-5"
              />
            </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Install EcoRoute</p>
            <p className="text-xs text-gray-500">
              Access Your Personal Waste Management Dashboard
            </p>
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  );
}
