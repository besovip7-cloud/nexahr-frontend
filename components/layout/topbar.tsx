"use client";

export default function Topbar() {
  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-6">

      <h2 className="text-xl font-semibold">
        NexaHR Dashboard
      </h2>

      <div className="flex items-center gap-4">

        <span className="text-gray-600">
          Admin
        </span>

        <div className="w-8 h-8 rounded-full bg-gray-300"></div>

      </div>

    </div>
  );
}