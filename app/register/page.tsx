"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Step1, Step2, Step3 } from "./RegistrationSteps";
import TermsModal from "./TermsModal";
import LoadingOverlay from "./LoadingOverlay";

export default function CitizenRegister() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // New Success State

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    middleName: "",
    lastName: "",
    nameExt: "",
    contactNumber: "",
    municipality: "",
    barangay: "",
    purok: "",
    address: "",
    houseLotNumber: "",
    serviceType: "General",
  });

  const handleRegistration = async () => {
    setError("");

    // 1. Client-side Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please check again.");
      return;
    }

    setShowTerms(false);
    setLoading(true);

    const fullName = `${formData.firstName} ${formData.middleName ? formData.middleName + " " : ""}${formData.lastName}${formData.nameExt ? " " + formData.nameExt : ""}`;

    const { error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: fullName,
          role: "CITIZEN",
          municipality: formData.municipality,
          barangay: formData.barangay,
          purok: formData.purok,
          address_street: formData.address,
          house_lot_number: formData.houseLotNumber,
          contact_number: formData.contactNumber,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setLoading(false);
      setIsSuccess(true); // Show success message instead of redirecting immediately
    }
  };

  // 2. Success Screen View
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 py-12 font-sans">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-lg border border-emerald-100 text-center animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📩</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            We've sent a confirmation link to{" "}
            <span className="text-emerald-600 font-bold">{formData.email}</span>
            . Please check your inbox (and spam) to activate your EcoRoute
            account.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // 3. Main Form View (Your original UI)
  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 py-12 font-sans">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl w-full max-w-lg border border-emerald-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 flex">
          <div
            className={`h-full bg-emerald-500 transition-all duration-500 ${step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"}`}
          />
        </div>

        <Header step={step} />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-r-xl font-bold flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

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

      {showTerms && (
        <TermsModal
          barangay={formData.barangay}
          onAccept={handleRegistration}
          onClose={() => setShowTerms(false)}
        />
      )}
      {loading && <LoadingOverlay />}
    </div>
  );
}

function Header({ step }: { step: number }) {
  const titles = ["Personal Details", "Service Address", "Account Security"];
  const icons = ["👤", "📍", "🔐"];
  return (
    <div className="mb-8 flex justify-between items-end">
      <div>
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">
          Step {step} of 3
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {titles[step - 1]}
        </h1>
      </div>
      <span className="text-3xl">{icons[step - 1]}</span>
    </div>
  );
}
