"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, MapPin, User, Smartphone, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

const getInputClass = (val: string, hasError: boolean) =>
  `w-full pl-11 pr-4 py-3 bg-white border rounded-xl outline-none transition-all text-sm font-semibold ${
    hasError
      ? "border-red-300 bg-red-50/30 focus:ring-red-500/10 focus:border-red-500"
      : "border-slate-200 focus:ring-emerald-500/10 focus:border-emerald-500"
  } ${val ? "text-slate-900" : "text-slate-400 placeholder:text-slate-300"}`;

// --- STEP 1 ---
export function Step1({
  formData,
  setFormData,
  showErrors,
  onNext,
  setShowErrors,
}: any) {
  // Validation Logic (Unchanged)
  const isFirstNameValid = formData.firstName.trim().length > 0;
  const isLastNameValid = formData.lastName.trim().length > 0;
  const isContactValid = formData.contactNumber.length === 11;

  const isValid = isFirstNameValid && isLastNameValid && isContactValid;

  // Updated Professional Error Message
  const ErrorMsg = ({ text }: { text: string }) => (
    <div className="flex items-center gap-1.5 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
      <AlertCircle size={10} className="text-red-500" />
      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
        {text}
      </p>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-2 gap-4">
        {/* First Name */}
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            First Name
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
              <User size={18} />
            </div>
            <input
              placeholder="e.g. Juan"
              className={getInputClass(formData.firstName, showErrors && !isFirstNameValid)}
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />
          </div>
          {showErrors && !isFirstNameValid && (
            <ErrorMsg text="First name is required" />
          )}
        </div>

        {/* Middle Name */}
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            Middle Name <span className="text-slate-400 font-medium lowercase italic">(Optional)</span>
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
              <User size={18} className="opacity-40" />
            </div>
            <input
              placeholder="e.g. Santos"
              className={getInputClass(formData.middleName, false)}
              value={formData.middleName}
              onChange={(e) =>
                setFormData({ ...formData, middleName: e.target.value })
              }
            />
          </div>
        </div>

        {/* Last Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            Last Name
          </label>
          <input
            placeholder="Dela Cruz"
            className={getInputClass(formData.lastName, showErrors && !isLastNameValid)}
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
          />
          {showErrors && !isLastNameValid && <ErrorMsg text="Required" />}
        </div>

        {/* Extension */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            Ext.
          </label>
          <input
            placeholder="Jr / III"
            className={getInputClass(formData.nameExt, false)}
            value={formData.nameExt}
            onChange={(e) =>
              setFormData({ ...formData, nameExt: e.target.value })
            }
          />
        </div>

        {/* Contact Number */}
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            Contact Number
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
              <Smartphone size={18} />
            </div>
            <input
              type="tel"
              maxLength={11}
              placeholder="09123456789"
              className={getInputClass(formData.contactNumber, showErrors && !isContactValid)}
              value={formData.contactNumber}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactNumber: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </div>
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

      {/* Navigation Buttons */}
      <div className="space-y-4 pt-4">
        <button
          onClick={() => {
            if (isValid) onNext();
            else setShowErrors(true);
          }}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
        >
          Continue Registration
          <ArrowRight size={18} />
        </button>
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

  // Specific Validation States (Functions kept exactly as provided)
  const isMuniValid = !!formData.municipality;
  const isBrgyValid = !!formData.barangay;
  const isStreetValid = true; 
  const isPurokValid = formData.purok.trim().length > 0;
  const isHouseValid = true;

  const isValid =
    isMuniValid && isBrgyValid && isStreetValid && isPurokValid && isHouseValid;

  // Professional Error Label
  const ErrorLabel = ({ text }: { text: string }) => (
    <div className="flex items-center gap-1.5 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
      <AlertCircle size={10} className="text-red-500" />
      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
        {text}
      </p>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Municipality */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          Municipality
        </label>
        <select
          className={getInputClass(formData.municipality, showErrors && !isMuniValid)}
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
          <ErrorLabel text="Selection required" />
        )}
      </div>

      {/* Barangay */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          Barangay
        </label>
        <select
          disabled={!formData.municipality}
          className={`${getInputClass(formData.barangay, showErrors && !isBrgyValid)} disabled:bg-slate-50 disabled:cursor-not-allowed`}
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
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          Street / Sitio
        </label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <MapPin size={18} />
          </div>
          <input
            className={`pl-11 ${getInputClass(formData.address_street, showErrors && !isStreetValid)}`}
            placeholder="e.g. Magsaysay St."
            value={formData.address_street}
            onChange={(e) =>
              setFormData({ ...formData, address_street: e.target.value })
            }
          />
        </div>
        {showErrors && !isStreetValid && (
          <ErrorLabel text="Street address required | N/A" />
        )}
      </div>

      {/* Purok & House # */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            Purok
          </label>
          <input
            className={getInputClass(formData.purok, showErrors && !isPurokValid)}
            placeholder="Purok #"
            value={formData.purok}
            onChange={(e) =>
              setFormData({ ...formData, purok: e.target.value })
            }
          />
          {showErrors && !isPurokValid && <ErrorLabel text="Required | N/A" />}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
            House #
          </label>
          <input
            className={getInputClass(formData.house_lot_number, showErrors && !isHouseValid)}
            placeholder="Lot/Blk"
            value={formData.house_lot_number}
            onChange={(e) =>
              setFormData({ ...formData, house_lot_number: e.target.value })
            }
          />
          {showErrors && !isHouseValid && <ErrorLabel text="Required | N/A" />}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-6 space-y-3">
        <button
          onClick={() => {
            if (isValid) onNext();
            else setShowErrors(true);
          }}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
        >
          Next Step
          <ArrowRight size={18} />
        </button>
        <button
          onClick={onBack}
          className="w-full py-2 flex items-center justify-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={16} />
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

  // Specific Validation Checks (Logically Unchanged)
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPassLength = formData.password.length >= 6;
  const isMatch =
    formData.password === formData.confirmPassword && formData.password !== "";

  const isValid = isEmailValid && isPassLength && isMatch;

  // Reusable Professional Error Component
  const ErrorLabel = ({ text }: { text: string }) => (
    <div className="flex items-center gap-1.5 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
      <AlertCircle size={10} className="text-red-500" />
      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
        {text}
      </p>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Email Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          Login Email
        </label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <Mail size={18} />
          </div>
          <input
            type="email"
            className={getInputClass(formData.email, showErrors && !isEmailValid)}
            placeholder="email@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        {showErrors && !isEmailValid && (
          <ErrorLabel
            text={
              formData.email === ""
                ? "Email is required for verification"
                : "Enter a valid email address"
            }
          />
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          Password
        </label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <Lock size={18} />
          </div>
          <input
            type={showPass ? "text" : "password"}
            className={`${getInputClass(formData.password, showErrors && !isPassLength)} pr-12`}
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
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          Confirm Password
        </label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <ShieldCheck size={18} className={isMatch ? "text-emerald-500" : ""} />
          </div>
          <input
            type={showPass ? "text" : "password"}
            className={`${getInputClass(formData.confirmPassword, showErrors && !isMatch)} pr-20`}
            placeholder="Repeat password"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isMatch && (
              <span className="text-[10px] font-black text-emerald-600 tracking-tighter animate-in zoom-in">
                MATCHED
              </span>
            )}
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

      {/* Action Buttons */}
      <div className="pt-6 space-y-3">
        <button
          onClick={() => {
            if (isValid) onNext();
            else setShowErrors(true);
          }}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
        >
          Review & Register
          <ArrowLeft size={18} className="rotate-180" />
        </button>
        <button
          onClick={onBack}
          className="w-full py-2 flex items-center justify-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Address
        </button>
      </div>
    </div>
  );
}