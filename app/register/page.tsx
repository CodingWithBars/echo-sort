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

  const [formData, setFormData] = useState({
    email: "", password: "", confirmPassword: "",
    firstName: "", middleName: "", lastName: "", nameExt: "",
    contactNumber: "", barangay: "", purok: "",
    address: "", houseLotNumber: "", serviceType: "General",
  });

  const handleRegistration = async () => {
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
          barangay: formData.barangay,
          purok: formData.purok,
          address_street: formData.address,
          house_lot_number: formData.houseLotNumber,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push("/login?message=Check your email to confirm registration");
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 py-12 font-sans">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl w-full max-w-lg border border-emerald-100 relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 flex">
          <div className={`h-full bg-emerald-500 transition-all duration-500 ${step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"}`} />
        </div>

        <Header step={step} />

        {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-xl font-bold">⚠️ {error}</div>}

        {step === 1 && <Step1 formData={formData} setFormData={setFormData} showErrors={showErrors} onNext={() => setStep(2)} setShowErrors={setShowErrors} />}
        {step === 2 && <Step2 formData={formData} setFormData={setFormData} showErrors={showErrors} onNext={() => setStep(3)} onBack={() => setStep(1)} setShowErrors={setShowErrors} />}
        {step === 3 && <Step3 formData={formData} setFormData={setFormData} showErrors={showErrors} onNext={() => setShowTerms(true)} onBack={() => setStep(2)} setShowErrors={setShowErrors} />}
      </div>

      {showTerms && <TermsModal barangay={formData.barangay} onAccept={handleRegistration} onClose={() => setShowTerms(false)} />}
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
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Step {step} of 3</p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{titles[step - 1]}</h1>
      </div>
      <span className="text-3xl">{icons[step - 1]}</span>
    </div>
  );
}