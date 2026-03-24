"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "MISSING_PUNCH";

type AttendanceRecord = {
  id: string;
  companyId: string | null;
  employeeId: number;
  shiftId: number | null;
  date: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
};

type HistoryResponse = {
  employeeId: number;
  from: string;
  to: string;
  records: AttendanceRecord[];
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMinutes(minutes: number) {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: AttendanceStatus) {
  const map: Record<AttendanceStatus, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    HALF_DAY: "bg-amber-100 text-amber-700 border border-amber-200",
    ABSENT: "bg-rose-100 text-rose-700 border border-rose-200",
    MISSING_PUNCH: "bg-orange-100 text-orange-700 border border-orange-200",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${map[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({
  title,
  value,
  valueClassName = "text-slate-900",
}: {
  title: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

export default function EmployeeAttendanceHistoryPage() {
  const router = useRouter();
  const params = useParams<{ employeeId: string }>();
  const searchParams = useSearchParams();

  const employeeId = Number(params.employeeId);

  const [from, setFrom] = useState(
    searchParams.get("from") || formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [to, setTo] = useState(
    searchParams.get("to") || formatDateInput(new Date()),
  );

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AttendanceStatus>("ALL");

  const loadHistory = async () => {
    try {
      setLoading(true);
      setMessage("");

      const data = await apiRequest(
        `/attendance/employee/${employeeId}/history?from=${from}&to=${to}`,
      );

      setHistory(data);
    } catch (error) {
      console.error("Failed to load employee history:", error);
      setMessage("Failed to load employee attendance history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isNaN(employeeId)) {
      loadHistory();
    }
  }, [employeeId, from, to]);

  const filteredRecords = useMemo(() => {
    if (!history?.records) return [];
    if (statusFilter === "ALL") return history.records;
    return history.records.filter((r) => r.status === statusFilter);
  }, [history, statusFilter]);

  const summary = useMemo(() => {
    const records = filteredRecords;

    return {
      total: records.length,
      present: records.filter((r) => r.status === "PRESENT").length,
      halfDay: records.filter((r) => r.status === "HALF_DAY").length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      missing: records.filter((r) => r.status === "MISSING_PUNCH").length,
      workedMinutes: records.reduce((sum, r) => sum + Number(r.workedMinutes || 0), 0),
      overtimeMinutes: records.reduce((sum, r) => sum + Number(r.overtimeMinutes || 0), 0),
    };
  }, [filteredRecords]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="mb-3 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Back
              </button>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Employee Attendance History
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Employee ID: {employeeId}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />

              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | AttendanceStatus)
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="MISSING_PUNCH">Missing Punch</option>
              </select>

              <button
                onClick={loadHistory}
                disabled={loading}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Records" value={summary.total} />
          <StatCard title="Present" value={summary.present} valueClassName="text-emerald-600" />
          <StatCard title="Half Day" value={summary.halfDay} valueClassName="text-amber-600" />
          <StatCard title="Absent" value={summary.absent} valueClassName="text-rose-600" />
          <StatCard title="Missing Punch" value={summary.missing} valueClassName="text-orange-600" />
          <StatCard title="Worked Time" value={formatMinutes(summary.workedMinutes)} />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">History Records</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredRecords.length} records from {from} to {to}
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Overtime: <span className="font-medium text-slate-700">{formatMinutes(summary.overtimeMinutes)}</span>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading history...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No attendance records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Scheduled</th>
                    <th className="px-4 py-3 font-semibold">Check In</th>
                    <th className="px-4 py-3 font-semibold">Check Out</th>
                    <th className="px-4 py-3 font-semibold">Worked</th>
                    <th className="px-4 py-3 font-semibold">Late</th>
                    <th className="px-4 py-3 font-semibold">Early Leave</th>
                    <th className="px-4 py-3 font-semibold">Overtime</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-4 align-middle font-medium text-slate-900">
                        {record.date}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        {formatTime(record.scheduledStart)} - {formatTime(record.scheduledEnd)}
                      </td>
                      <td className="px-4 py-4 align-middle">{formatTime(record.checkIn)}</td>
                      <td className="px-4 py-4 align-middle">{formatTime(record.checkOut)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(record.workedMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(record.lateMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(record.earlyLeaveMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(record.overtimeMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{statusBadge(record.status)}</td>
                      <td className="px-4 py-4 align-middle text-slate-500">
                        {record.remarks || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}