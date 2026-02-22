import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock } from "lucide-react";

const getInputClass = (val: string) =>
  `w-full p-3.5 bg-slate-50 border rounded-2xl outline-none transition-all text-sm font-bold ${
    val ? "text-slate-950 border-slate-300" : "text-slate-400 border-slate-200"
  } focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`;

// --- STEP 1 ---
export function Step1({
  formData,
  setFormData,
  showErrors,
  onNext,
  setShowErrors,
}: any) {
  // Validation Logic
  const isFirstNameValid = formData.firstName.trim().length > 0;
  const isLastNameValid = formData.lastName.trim().length > 0;
  const isContactValid = formData.contactNumber.length === 11;

  const isValid = isFirstNameValid && isLastNameValid && isContactValid;

  // Helper for error messages to keep code clean
  const ErrorMsg = ({ text }: { text: string }) => (
    <p className="text-[9px] font-black text-red-500 mt-1 ml-1 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
      ⚠️ {text}
    </p>
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-2 gap-3">
        {/* First Name */}
        <div className="col-span-2">
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            First Name
          </label>
          <input
            placeholder="Juan"
            className={`${getInputClass(formData.firstName)} ${showErrors && !isFirstNameValid ? "border-red-400 bg-red-50/30" : ""}`}
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
          />
          {showErrors && !isFirstNameValid && (
            <ErrorMsg text="First name is required" />
          )}
        </div>

        {/* Middle Name - Optional, so no error here */}
        <div className="col-span-2">
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            Middle Name
          </label>
          <input
            placeholder="Optional"
            className={getInputClass(formData.middleName)}
            value={formData.middleName}
            onChange={(e) =>
              setFormData({ ...formData, middleName: e.target.value })
            }
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            Last Name
          </label>
          <input
            placeholder="Dela Cruz"
            className={`${getInputClass(formData.lastName)} ${showErrors && !isLastNameValid ? "border-red-400 bg-red-50/30" : ""}`}
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
          />
          {showErrors && !isLastNameValid && <ErrorMsg text="Required" />}
        </div>

        {/* Extension */}
        <div>
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            Ext.
          </label>
          <input
            placeholder="Jr / III"
            className={getInputClass(formData.nameExt)}
            value={formData.nameExt}
            onChange={(e) =>
              setFormData({ ...formData, nameExt: e.target.value })
            }
          />
        </div>

        {/* Contact Number */}
        <div className="col-span-2">
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            Contact Number
          </label>
          <input
            type="tel"
            maxLength={11}
            placeholder="09123456789"
            className={`${getInputClass(formData.contactNumber)} ${showErrors && !isContactValid ? "border-red-400 bg-red-50/30" : ""}`}
            value={formData.contactNumber}
            onChange={(e) =>
              setFormData({
                ...formData,
                contactNumber: e.target.value.replace(/\D/g, ""),
              })
            }
          />
          {showErrors && !isContactValid && (
            <ErrorMsg
              text={
                formData.contactNumber.length === 0
                  ? "Contact number required"
                  : "Must be exactly 11 digits"
              }
            />
          )}
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <button
          onClick={() => {
            if (isValid) onNext();
            else setShowErrors(true);
          }}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-100/50"
        >
          Continue
        </button>

        <div className="flex flex-col items-center gap-1 py-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Already have an account?
          </p>
          <Link
            href="/login"
            className="text-[11px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors underline underline-offset-4"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- STEP 2 ---
export function Step2({
  formData,
  setFormData,
  showErrors,
  onNext,
  onBack,
  setShowErrors,
}: any) {
  const municipalities: any = {
    Lupon: [
      "Bagumbayan",
      "Cabadiangan",
      "Calapagan",
      "Cocornon",
      "Corporacion",
      "Don Mariano Marcos",
      "Ilangay",
      "Lantawan",
      "Limbahan",
      "Macangao",
      "Magsaysay",
      "Mahayahay",
      "Maragatas",
      "Marayag",
      "New Visayas",
      "Poblacion",
      "San Isidro",
      "San Jose",
      "Tagboa",
      "Tagugpo",
    ],
    Banaybanay: [
      "Cabangcalan",
      "Caganganan",
      "Calubihan",
      "Causwagan",
      "Mahayag",
      "Maputi",
      "Mogoc",
      "Panikian",
      "Pintatagan",
      "Piso",
      "Poblacion",
      "Punta Linao",
      "San Vicente",
      "Sayon",
    ],
  };

  // Specific Validation States
  const isMuniValid = !!formData.municipality;
  const isBrgyValid = !!formData.barangay;
  const isStreetValid = formData.address.trim().length > 0;
  const isPurokValid = formData.purok.trim().length > 0;
  const isHouseValid = formData.houseLotNumber.trim().length > 0;

  const isValid =
    isMuniValid && isBrgyValid && isStreetValid && isPurokValid && isHouseValid;

  // Reusable Error Component
  const ErrorLabel = ({ text }: { text: string }) => (
    <p className="text-[9px] font-black text-red-500 mt-1 ml-1 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
      ⚠️ {text}
    </p>
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Municipality */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
          Municipality
        </label>
        <select
          className={`${getInputClass(formData.municipality)} ${showErrors && !isMuniValid ? "border-red-400 bg-red-50/30" : ""}`}
          value={formData.municipality}
          onChange={(e) =>
            setFormData({
              ...formData,
              municipality: e.target.value,
              barangay: "",
            })
          }
        >
          <option value="">Select Municipality...</option>
          <option value="Lupon">Lupon</option>
          <option value="Banaybanay">Banaybanay</option>
        </select>
        {showErrors && !isMuniValid && (
          <ErrorLabel text="Please select a municipality" />
        )}
      </div>

      {/* Barangay */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
          Barangay
        </label>
        <select
          disabled={!formData.municipality}
          className={`${getInputClass(formData.barangay)} ${showErrors && !isBrgyValid ? "border-red-400 bg-red-50/30" : ""} disabled:opacity-50`}
          value={formData.barangay}
          onChange={(e) =>
            setFormData({ ...formData, barangay: e.target.value })
          }
        >
          <option value="">Select Barangay...</option>
          {formData.municipality &&
            municipalities[formData.municipality].map((brgy: string) => (
              <option key={brgy} value={brgy}>
                {brgy}
              </option>
            ))}
        </select>
        {showErrors && !isBrgyValid && (
          <ErrorLabel text="Please select your barangay" />
        )}
      </div>

      {/* Street / Sitio */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
          Street / Sitio
        </label>
        <input
          className={`${getInputClass(formData.address)} ${showErrors && !isStreetValid ? "border-red-400 bg-red-50/30" : ""}`}
          placeholder="e.g. Magsaysay St."
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
        />
        {showErrors && !isStreetValid && (
          <ErrorLabel text="Street address is required | N/A" />
        )}
      </div>

      {/* Purok & House # */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            Purok
          </label>
          <input
            className={`${getInputClass(formData.purok)} ${showErrors && !isPurokValid ? "border-red-400 bg-red-50/30" : ""}`}
            placeholder="Purok #"
            value={formData.purok}
            onChange={(e) =>
              setFormData({ ...formData, purok: e.target.value })
            }
          />
          {showErrors && !isPurokValid && <ErrorLabel text="Required | N/A" />}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
            House #
          </label>
          <input
            className={`${getInputClass(formData.houseLotNumber)} ${showErrors && !isHouseValid ? "border-red-400 bg-red-50/30" : ""}`}
            placeholder="Lot/Blk"
            value={formData.houseLotNumber}
            onChange={(e) =>
              setFormData({ ...formData, houseLotNumber: e.target.value })
            }
          />
          {showErrors && !isHouseValid && <ErrorLabel text="Required | N/A" />}
        </div>
      </div>

      <div className="pt-4 space-y-2">
        <button
          onClick={() => {
            if (isValid) onNext();
            else setShowErrors(true);
          }}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-100/50"
        >
          Continue
        </button>
        <button
          onClick={onBack}
          className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
        >
          Back to Personal Info
        </button>
      </div>
    </div>
  );
}

// --- STEP 3 ---
export function Step3({
  formData,
  setFormData,
  showErrors,
  onNext,
  onBack,
  setShowErrors,
}: any) {
  const [showPass, setShowPass] = useState(false);

  // Specific Validation Checks
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPassLength = formData.password.length >= 6;
  const isMatch =
    formData.password === formData.confirmPassword && formData.password !== "";

  const isValid = isEmailValid && isPassLength && isMatch;

  // Reusable Error Component
  const ErrorLabel = ({ text }: { text: string }) => (
    <p className="text-[9px] font-black text-red-500 mt-1 ml-1 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
      ⚠️ {text}
    </p>
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Email Field */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
          Login Email
        </label>
        <input
          type="email"
          className={`${getInputClass(formData.email)} ${showErrors && !isEmailValid ? "border-red-400 bg-red-50/30" : ""}`}
          placeholder="email@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        {showErrors && !isEmailValid && (
          <ErrorLabel
            text={
              formData.email === ""
                ? "Email is required to receive email and verify account"
                : "Enter a valid email address to verify your account"
            }
          />
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
          Password
        </label>
        <div className="relative group">
          <input
            type={showPass ? "text" : "password"}
            className={`${getInputClass(formData.password)} pr-12 ${showErrors && !isPassLength ? "border-red-400 bg-red-50/30" : ""}`}
            placeholder="Min. 6 characters"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {showErrors && !isPassLength && (
          <ErrorLabel text="Password must be at least 6 characters" />
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">
          Confirm Password
        </label>
        <div className="relative group">
          <input
            type={showPass ? "text" : "password"}
            className={`${getInputClass(formData.confirmPassword)} pr-12 ${showErrors && !isMatch ? "border-red-400 bg-red-50/30" : ""}`}
            placeholder="Repeat password"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isMatch && (
              <span className="text-emerald-500 text-[10px] font-bold animate-in zoom-in">
                MATCH
              </span>
            )}
            <Lock
              size={16}
              className={isMatch ? "text-emerald-500" : "text-slate-300"}
            />
          </div>
        </div>
        {showErrors && !isMatch && (
          <ErrorLabel
            text={
              formData.confirmPassword === ""
                ? "Please confirm your password"
                : "Passwords do not match"
            }
          />
        )}
      </div>

      <div className="pt-4 space-y-2">
        <button
          onClick={() => {
            if (isValid) onNext();
            else setShowErrors(true);
          }}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
        >
          Review & Register
        </button>
        <button
          onClick={onBack}
          className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
        >
          Back to Address
        </button>
      </div>
    </div>
  );
}
