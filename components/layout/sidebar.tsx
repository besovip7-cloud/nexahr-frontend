"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col p-4">

      <h1 className="text-2xl font-bold mb-10">
        NexaHR
      </h1>

      <nav className="flex flex-col gap-4">

        <Link href="/dashboard" className="hover:text-blue-400">
          Dashboard
        </Link>

        <Link href="/employees" className="hover:text-blue-400">
          Employees
        </Link>

        <Link href="/attendance" className="hover:text-blue-400">
          Attendance
        </Link>

        <Link href="/branches" className="hover:text-blue-400">
          Branches
        </Link>

        <Link href="/payroll" className="hover:text-blue-400">
          Payroll
        </Link>

        <Link href="/settings" className="hover:text-blue-400">
          Settings
        </Link>

      </nav>

    </div>
  );
}