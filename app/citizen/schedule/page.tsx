"use client";

export default function SchedulePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-emerald-800">Collection Schedule</h1>
      <p>Check when the waste collection truck is arriving in your Barangay.</p>
    
        <button 
  onClick={() => window.location.href = '/login'}
  className="mt-4 text-sm text-red-500 underline"
>
  Logout and Switch User
</button>
    </div>
  );
}
