"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function CitizenRegister() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "", // Added for Supabase Auth
    password: "", // Added for Supabase Auth
    name: "",
    barangay: "",
    address: "",
    houseLotNumber: "",
    serviceType: "General",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Sign up user in Supabase
    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        // 2. Store extra fields in user_metadata
        data: {
          full_name: formData.name,
          role: "CITIZEN", // Hardcoded for this specific page
          barangay: formData.barangay,
          address: formData.address,
          house_lot_number: formData.houseLotNumber,
          service_type: formData.serviceType,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // 3. Success! Redirect to login or a "Check Email" page
    // If you turned off "Email Confirmation" in Supabase settings, 
    // the user is logged in automatically here.
    alert("Registration successful!");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-100">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Join EcoRoute</h1>
          <p className="text-slate-500 text-sm mt-1">Help us optimize collection in your area.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Auth Fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 ml-1">Email</label>
              <input 
                type="email"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                placeholder="juan@email.com"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 ml-1">Password</label>
              <input 
                type="password"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                placeholder="••••••••"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <hr className="border-slate-100 my-2" />

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 ml-1">Full Name</label>
            <input 
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
              placeholder="Juan Dela Cruz"
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          {/* Barangay Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 ml-1">Barangay</label>
            <select 
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
              onChange={(e) => setFormData({...formData, barangay: e.target.value})}
            >
              <option value="">Select your Barangay</option>
              <option value="Poblacion">Poblacion</option>
              <option value="Ilangay">Ilangay</option>
            </select>
          </div>

          {/* Address Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 ml-1">Street</label>
              <input 
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                placeholder="Nicanor St."
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 ml-1">House/Lot #</label>
              <input 
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                placeholder="B-12 L-4"
                onChange={(e) => setFormData({...formData, houseLotNumber: e.target.value})}
              />
            </div>
          </div>

          {/* Collection Type */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
            <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 ml-1">Collection Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-emerald-900 cursor-pointer">
                <input type="radio" name="type" value="General" defaultChecked onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="accent-emerald-600" />
                Residential
              </label>
              <label className="flex items-center gap-2 text-sm text-emerald-900 cursor-pointer">
                <input type="radio" name="type" value="Commercial" onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="accent-emerald-600" />
                Commercial
              </label>
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create EcoRoute Account"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-600 font-bold hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}