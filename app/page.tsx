import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-50 px-6 font-sans">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        {/* EcoRoute Logo/Icon Placeholder */}
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-600 shadow-lg shadow-emerald-200">
          <svg
            className="h-12 w-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 20l-5.447-2.724A2 2 0 013 15.487V6a2 2 0 011.106-1.789l6.553-3.277a2 2 0 011.688 0l6.553 3.277A2 2 0 0120 6v9.487a2 2 0 01-1.106 1.789L13.447 20a2 2 0 01-1.894 0L9 20z"
            />
          </svg>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-emerald-900">
          EcoRoute
        </h1>
        <p className="mt-4 text-lg leading-7 text-emerald-700">
          Smart Waste Management for a <br />
          <span className="font-semibold text-emerald-600">Cleaner Barangay</span>
        </p>

        <div className="mt-10 flex w-full flex-col gap-4">
          <Link
            href="/login"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white transition-all hover:bg-emerald-700 active:scale-95 shadow-md"
          >
            Sign In
          </Link>
          
          <Link
            href="/register"
            className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white text-lg font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
          >
            Register as Citizen
          </Link>
        </div>

        <p className="mt-8 text-sm text-emerald-600/60">
          Efficiency • Sustainability • Community
        </p>
      </main>
    </div>
  );
}