"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "MISSING_PUNCH";

type AttendanceRow = {
  employeeId: number;
  employeeName: string | null;
  shiftName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
};

type DaySheetResponse = {
  date: string;
  total: number;
  rows: AttendanceRow[];
};

type SummaryResponse = {
  date: string;
  present: number;
  halfDay: number;
  absent: number;
  missingPunch: number;
  totalWorkedMinutes: number;
};

const COMPANY_ID = "85d95627-08dc-47c9-9c08-3dca4b18205d";

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTimeLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
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

export default function AttendancePage() {
  const router = useRouter();

  const [date, setDate] = useState(formatDateInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sheet, setSheet] = useState<DaySheetResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AttendanceStatus>("ALL");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [manualType, setManualType] = useState<"IN" | "OUT">("IN");
  const [manualPunchTime, setManualPunchTime] = useState(formatDateTimeLocal(new Date()));

  const showMessage = (text: string, type: "success" | "error" | "info" = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setMessage("");

      const [sheetData, summaryData] = await Promise.all([
        apiRequest(`/attendance/day-sheet?date=${date}&companyId=${COMPANY_ID}`),
        apiRequest(`/attendance/summary?date=${date}&companyId=${COMPANY_ID}`),
      ]);

      setSheet(sheetData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load attendance:", error);
      showMessage("Failed to load attendance data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [date]);

  const filteredRows = useMemo(() => {
    if (!sheet?.rows) return [];

    const q = search.trim().toLowerCase();

    return sheet.rows.filter((row) => {
      const matchesSearch =
        !q ||
        String(row.employeeId).includes(q) ||
        (row.employeeName || "").toLowerCase().includes(q) ||
        (row.shiftName || "").toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sheet, search, statusFilter]);

  const handleFinalizeDay = async () => {
    try {
      setActionLoading(true);
      setMessage("");

      const result = await apiRequest("/attendance/finalize-day", {
        method: "POST",
        body: JSON.stringify({
          companyId: COMPANY_ID,
          date,
        }),
      });

      showMessage(
        `Finalized ${date}. Present: ${result.present ?? 0}, Half Day: ${result.halfDay ?? 0}, Missing: ${result.missingPunch ?? 0}, Absent: ${result.createdAbsent ?? 0}`,
        "success",
      );

      await loadAttendance();
    } catch (error) {
      console.error("Failed to finalize day:", error);
      showMessage("Failed to finalize day", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickPunch = async (employeeId: number, type: "IN" | "OUT") => {
    try {
      setActionLoading(true);
      setMessage("");

      await apiRequest("/attendance/logs", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          punchTime: new Date().toISOString(),
          type,
        }),
      });

      showMessage(`Manual ${type} log added for employee #${employeeId}`, "success");
      await loadAttendance();
    } catch (error) {
      console.error(`Failed to add ${type} log:`, error);
      showMessage(`Failed to add ${type} log`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openManualModal = (employeeId: number, type: "IN" | "OUT") => {
    setSelectedEmployeeId(employeeId);
    setManualType(type);
    setManualPunchTime(formatDateTimeLocal(new Date()));
    setManualModalOpen(true);
  };

  const submitManualPunch = async () => {
    if (!selectedEmployeeId) return;

    try {
      setActionLoading(true);
      setMessage("");

      await apiRequest("/attendance/logs", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          punchTime: new Date(manualPunchTime).toISOString(),
          type: manualType,
        }),
      });

      showMessage(
        `Manual ${manualType} log added for employee #${selectedEmployeeId}`,
        "success",
      );
      setManualModalOpen(false);
      await loadAttendance();
    } catch (error) {
      console.error("Failed to submit manual punch:", error);
      showMessage("Failed to submit manual punch", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const exportCsv = () => {
    const rows = filteredRows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName || "",
      shiftName: row.shiftName || "",
      checkIn: row.checkIn || "",
      checkOut: row.checkOut || "",
      workedMinutes: row.workedMinutes,
      lateMinutes: row.lateMinutes,
      earlyLeaveMinutes: row.earlyLeaveMinutes,
      overtimeMinutes: row.overtimeMinutes,
      status: row.status,
    }));

    const headers = [
      "employeeId",
      "employeeName",
      "shiftName",
      "checkIn",
      "checkOut",
      "workedMinutes",
      "lateMinutes",
      "earlyLeaveMinutes",
      "overtimeMinutes",
      "status",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header as keyof typeof row] ?? "");
            return `"${value.replace(/"/g, '""')}"`
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `attendance-${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const messageStyles =
    messageType === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : messageType === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Attendance Center
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Monitor attendance, finalize the day, add manual punches, and export records.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />

              <input
                type="text"
                placeholder="Search employee, shift, status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
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
                onClick={loadAttendance}
                disabled={loading || actionLoading}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>

              <button
                onClick={exportCsv}
                disabled={loading || actionLoading || filteredRows.length === 0}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Export CSV
              </button>

              <button
                onClick={handleFinalizeDay}
                disabled={loading || actionLoading}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Finalize Day
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${messageStyles}`}>
            {message}
          </div>
        ) : null}

        {summary ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Present" value={summary.present} valueClassName="text-emerald-600" />
            <StatCard title="Half Day" value={summary.halfDay} valueClassName="text-amber-600" />
            <StatCard title="Absent" value={summary.absent} valueClassName="text-rose-600" />
            <StatCard title="Missing Punch" value={summary.missingPunch} valueClassName="text-orange-600" />
            <StatCard title="Worked Time" value={formatMinutes(summary.totalWorkedMinutes)} />
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Day Sheet</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredRows.length} of {sheet?.total ?? 0} assigned employees
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Selected date: <span className="font-medium text-slate-700">{date}</span>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading attendance...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No attendance records found for this date.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Shift</th>
                    <th className="px-4 py-3 font-semibold">Check In</th>
                    <th className="px-4 py-3 font-semibold">Check Out</th>
                    <th className="px-4 py-3 font-semibold">Worked</th>
                    <th className="px-4 py-3 font-semibold">Late</th>
                    <th className="px-4 py-3 font-semibold">Early Leave</th>
                    <th className="px-4 py-3 font-semibold">Overtime</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={`${row.employeeId}-${date}`}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="font-medium text-slate-900">
                          {row.employeeName || `Employee #${row.employeeId}`}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          ID: {row.employeeId}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <div className="font-medium text-slate-800">
                          {row.shiftName || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-middle">{formatTime(row.checkIn)}</td>
                      <td className="px-4 py-4 align-middle">{formatTime(row.checkOut)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(row.workedMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(row.lateMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(row.earlyLeaveMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{formatMinutes(row.overtimeMinutes)}</td>
                      <td className="px-4 py-4 align-middle">{statusBadge(row.status)}</td>

                      <td className="px-4 py-4 align-middle">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleQuickPunch(row.employeeId, "IN")}
                            disabled={actionLoading}
                            className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Quick IN
                          </button>

                          <button
                            onClick={() => handleQuickPunch(row.employeeId, "OUT")}
                            disabled={actionLoading}
                            className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Quick OUT
                          </button>

                          <button
                            onClick={() => openManualModal(row.employeeId, "IN")}
                            className="rounded-lg bg-cyan-100 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-200"
                          >
                            Timed IN
                          </button>

                          <button
                            onClick={() => openManualModal(row.employeeId, "OUT")}
                            className="rounded-lg bg-fuchsia-100 px-3 py-1.5 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-200"
                          >
                            Timed OUT
                          </button>

                          <button
                            onClick={() =>
                              router.push(
                                `/attendance/history/${row.employeeId}?from=${date.slice(0, 8)}01&to=${date.slice(0, 8)}31`,
                              )
                            }
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {manualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900">Manual Punch</h3>
              <p className="mt-1 text-sm text-slate-500">
                Employee #{selectedEmployeeId} — {manualType}
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Punch Type
                  </label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as "IN" | "OUT")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-slate-400"
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Punch Time
                  </label>
                  <input
                    type="datetime-local"
                    value={manualPunchTime}
                    onChange={(e) => setManualPunchTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setManualModalOpen(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>

                <button
                  onClick={submitManualPunch}
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Save Punch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}