"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { 
  User, 
  MapPin, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  MailCheck,
  AlertCircle,
  Loader2
} from "lucide-react";

// Assuming these are updated to the professional style as well
import { Step1, Step2, Step3 } from "./RegistrationSteps";
import TermsModal from "./TermsModal";

export default function CitizenRegister() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    middleName: "",
    lastName: "",
    nameExt: "",
    contactNumber: "",
    municipality: "Lupon",
    barangay: "",
    purok: "",
    address_street: "",
    house_lot_number: "",
    serviceType: "General",
  });

  const handleRegistration = async () => {
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please check your security credentials.");
      return;
    }

    setShowTerms(false);
    setLoading(true);

    const fullName = `${formData.firstName} ${formData.middleName ? formData.middleName + " " : ""}${formData.lastName}${formData.nameExt ? " " + formData.nameExt : ""}`.trim();

    const { error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: fullName,
          role: "CITIZEN",
          municipality: formData.municipality,
          barangay: formData.barangay || "Unassigned",
          purok: formData.purok || "N/A",
          address_street: formData.address_street || "N/A",
          house_lot_number: formData.house_lot_number || "N/A",
          contact_number: formData.contactNumber,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setLoading(false);
      setIsSuccess(true);
    }
  };

  // SUCCESS STATE
  if (isSuccess) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-center p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MailCheck size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Check your email</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            We've sent a verification link to <br />
            <span className="text-emerald-600 font-bold">{formData.email}</span>.
            Please verify your account to start using EcoRoute.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-md shadow-emerald-100"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4 py-12 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
          <div
            className="h-full bg-emerald-600 transition-all duration-700 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-8 md:p-10">
          <Header step={step} />

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-xs font-bold text-red-800">{error}</p>
            </div>
          )}

          {/* Step Rendering */}
          <div className="min-h-[300px]">
            {step === 1 && (
              <Step1
                formData={formData}
                setFormData={setFormData}
                showErrors={showErrors}
                onNext={() => setStep(2)}
                setShowErrors={setShowErrors}
              />
            )}
            {step === 2 && (
              <Step2
                formData={formData}
                setFormData={setFormData}
                showErrors={showErrors}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
                setShowErrors={setShowErrors}
              />
            )}
            {step === 3 && (
              <Step3
                formData={formData}
                setFormData={setFormData}
                showErrors={showErrors}
                onNext={() => setShowTerms(true)}
                onBack={() => setStep(2)}
                setShowErrors={setShowErrors}
              />
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-emerald-600 font-bold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showTerms && (
        <TermsModal
          barangay={formData.barangay}
          onAccept={handleRegistration}
          onClose={() => setShowTerms(false)}
        />
      )}

      {/* Modern Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            Processing Application
          </p>
        </div>
      )}
    </div>
  );
}

function Header({ step }: { step: number }) {
  const titles = ["Personal Details", "Service Address", "Account Security"];
  const icons = [
    <User className="text-emerald-600" size={24} />,
    <MapPin className="text-emerald-600" size={24} />,
    <Lock className="text-emerald-600" size={24} />
  ];

  return (
    <div className="mb-8 flex justify-between items-start">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
            {step}
          </span>
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
            Registration Phase
          </p>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {titles[step - 1]}
        </h1>
      </div>
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
        {icons[step - 1]}
      </div>
    </div>
  );
}