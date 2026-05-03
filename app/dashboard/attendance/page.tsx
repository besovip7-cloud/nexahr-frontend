"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import {
  formatDateTimeSafe,
  formatMinutesCompact,
  getTodayDateInputValue,
  isValidDateInputRange,
  isValidDateInputValue,
} from "@/lib/date";
import { triggerFileDownload } from "@/lib/download";
import { withSearch } from "@/lib/navigation";
import { parsePositiveInt } from "@/lib/number";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "MISSING_PUNCH";

type DaySummaryResponse = {
  date: string;
  present: number;
  halfDay: number;
  absent: number;
  missingPunch: number;
  totalWorkedMinutes: number;
  totalLateMinutes?: number;
  totalEarlyLeaveMinutes?: number;
  totalOvertimeMinutes?: number;
};

type DaySheetRow = {
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
  rows: DaySheetRow[];
};

type EmployeeOption = {
  id: number;
  fullName: string;
  employeeCode?: string | null;
};

type ManualLogForm = {
  employeeId: string;
  punchTime: string;
  type: "IN" | "OUT";
  source: string;
};

const defaultDate = getTodayDateInputValue();

function getMonthRange(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth() + 1;
  const monthString = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();

  return {
    from: `${year}-${monthString}-01`,
    to: `${year}-${monthString}-${String(lastDay).padStart(2, "0")}`,
  };
}

const initialManualLogForm: ManualLogForm = {
  employeeId: "",
  punchTime: "",
  type: "IN",
  source: "MANUAL",
};

export default function AttendancePage() {
  const router = useRouter();

  const [date, setDate] = useState(defaultDate);
  const monthRange = getMonthRange(defaultDate);

  const [from, setFrom] = useState(monthRange.from);
  const [to, setTo] = useState(monthRange.to);

  const [summary, setSummary] = useState<DaySummaryResponse | null>(null);
  const [sheet, setSheet] = useState<DaySheetResponse | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [manualLogForm, setManualLogForm] =
    useState<ManualLogForm>(initialManualLogForm);

  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [creatingLog, setCreatingLog] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AttendanceStatus>("ALL");

  useEffect(() => {
    const range = getMonthRange(date);
    setFrom(range.from);
    setTo(range.to);
  }, [date]);

  const loadPage = useCallback(async (targetDate: string) => {
    if (!isValidDateInputValue(targetDate)) {
      setSummary(null);
      setSheet(null);
      setError("Please select a valid attendance date.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [summaryRes, sheetRes, employeesRes] = await Promise.all([
        apiRequest<DaySummaryResponse>(withSearch("/attendance/summary", { date: targetDate }), {
          auth: true,
        }),
        apiRequest<DaySheetResponse>(withSearch("/attendance/day-sheet", { date: targetDate }), {
          auth: true,
        }),
        apiRequest<EmployeeOption[]>("/employees", { auth: true }),
      ]);

      setSummary(summaryRes || null);
      setSheet(sheetRes || null);
      setEmployees(Array.isArray(employeesRes) ? employeesRes : []);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error("Attendance page load failed", err);
      setError(getErrorMessage(err, "Failed to load attendance page."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPage(date);
  }, [date, loadPage]);

  function updateManualLogForm<K extends keyof ManualLogForm>(
    key: K,
    value: ManualLogForm[K],
  ) {
    setManualLogForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinalizeDay() {
    const confirmed = window.confirm(
      `Are you sure you want to finalize attendance for ${date}?`,
    );
    if (!confirmed) return;

    try {
      setFinalizing(true);
      setMessage("");
      setError("");

      await apiRequest("/attendance/finalize-day", {
        method: "POST",
        auth: true,
        body: { date },
      });

      setMessage("Attendance day finalized successfully.");
      await loadPage(date);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error("Finalize day failed", err);
      setError(getErrorMessage(err, "Failed to finalize attendance day."));
    } finally {
      setFinalizing(false);
    }
  }

  async function handleRecalculateDay() {
    const confirmed = window.confirm(
      `Recalculate attendance for ${date}? This will rebuild daily attendance from logs.`,
    );

    if (!confirmed) return;

    try {
      setRecalculating(true);
      setMessage("");
      setError("");

      await apiRequest("/attendance/recalculate-day", {
        method: "POST",
        auth: true,
        body: { date },
      });

      setMessage("Attendance recalculated successfully.");
      await loadPage(date);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error("Recalculate day failed", err);
      setError(getErrorMessage(err, "Failed to recalculate attendance day."));
    } finally {
      setRecalculating(false);
    }
  }

  async function handleCreateManualLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!manualLogForm.employeeId || !manualLogForm.punchTime) {
      setError("Employee and punch time are required.");
      setMessage("");
      return;
    }

    const employeeId = parsePositiveInt(manualLogForm.employeeId);
    if (!employeeId) {
      setError("Please select a valid employee.");
      setMessage("");
      return;
    }

    try {
      setCreatingLog(true);
      setMessage("");
      setError("");

      await apiRequest("/attendance/logs", {
        method: "POST",
        auth: true,
        body: {
          employeeId,
          punchTime: manualLogForm.punchTime,
          type: manualLogForm.type,
          source: manualLogForm.source || "MANUAL",
        },
      });

      setMessage("Attendance log created successfully.");
      setManualLogForm(initialManualLogForm);
      await loadPage(date);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error("Manual log failed", err);
      setError(getErrorMessage(err, "Failed to create attendance log."));
    } finally {
      setCreatingLog(false);
    }
  }

  async function handleExportCsv() {
    if (!isValidDateInputValue(date)) {
      setError("Please select a valid attendance date.");
      setMessage("");
      return;
    }

    try {
      setExportingCsv(true);
      setError("");
      setMessage("");

      const blob = await apiRequest<Blob>(
        withSearch("/attendance/day-sheet/export", { date }),
        {
          method: "GET",
          auth: true,
          responseType: "blob",
        },
      );
      triggerFileDownload(blob, `attendance-day-sheet-${date}.csv`);

      setMessage("CSV exported successfully.");
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to export CSV."));
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleExportExcel() {
    if (!isValidDateInputValue(date)) {
      setError("Please select a valid attendance date.");
      setMessage("");
      return;
    }

    try {
      setExportingExcel(true);
      setError("");
      setMessage("");

      const blob = await apiRequest<Blob>(
        withSearch("/attendance/day-sheet/export-excel", { date }),
        {
          method: "GET",
          auth: true,
          responseType: "blob",
        },
      );
      triggerFileDownload(blob, `attendance-${date}.xlsx`);

      setMessage("Excel exported successfully.");
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to export Excel."));
    } finally {
      setExportingExcel(false);
    }
  }

  function handleOpenRange(employeeId: number) {
    if (!isValidDateInputRange(from, to)) {
      setError('Please select a valid date range where "From" is before "To".');
      setMessage("");
      return;
    }

    router.push(
      withSearch("/dashboard/attendance/range", {
        employeeId: String(employeeId),
        from,
        to,
      }),
    );
  }

  function handleOpenHistory(employeeId: number) {
    if (!isValidDateInputRange(from, to)) {
      setError('Please select a valid date range where "From" is before "To".');
      setMessage("");
      return;
    }

    router.push(
      withSearch(`/dashboard/attendance/history/${employeeId}`, {
        from,
        to,
      }),
    );
  }

  const filteredRows = useMemo(() => {
    const rows = sheet?.rows || [];
    const keyword = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        String(row.employeeId).includes(keyword) ||
        (row.employeeName || "").toLowerCase().includes(keyword) ||
        (row.shiftName || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sheet, search, statusFilter]);

  function formatDateTime(value?: string | Date | null) {
    return formatDateTimeSafe(value, "-");
  }

  function formatMinutes(minutes?: number | null) {
    return formatMinutesCompact(minutes);
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Attendance"
        subtitle="Track daily attendance, create manual punches, recalculate or finalize the day, export reports, and open detailed employee attendance views."
      />

      <div style={styles.topBar}>
        <div style={styles.dateWrap}>
          <label style={styles.label}>Attendance Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.rangeWrap}>
          <div style={styles.field}>
            <label style={styles.label}>From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.topActions}>
          <button
            type="button"
            onClick={handleExportCsv}
            style={styles.secondaryButton}
            disabled={exportingCsv}
          >
            {exportingCsv ? "Exporting CSV..." : "Export CSV"}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={styles.secondaryButton}
            disabled={exportingExcel}
          >
            {exportingExcel ? "Exporting Excel..." : "Export Excel"}
          </button>

          <button
            type="button"
            onClick={handleRecalculateDay}
            style={styles.secondaryButton}
            disabled={recalculating}
          >
            {recalculating ? "Recalculating..." : "Recalculate Day"}
          </button>

          <button
            type="button"
            onClick={handleFinalizeDay}
            style={styles.primaryButton}
            disabled={finalizing}
          >
            {finalizing ? "Finalizing..." : "Finalize Day"}
          </button>
        </div>
      </div>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Present</div>
          <div style={styles.statValue}>{summary?.present ?? 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Half Day</div>
          <div style={styles.statValue}>{summary?.halfDay ?? 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Absent</div>
          <div style={styles.statValue}>{summary?.absent ?? 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Missing Punch</div>
          <div style={styles.statValue}>{summary?.missingPunch ?? 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Worked Time</div>
          <div style={styles.statValueSmall}>
            {formatMinutes(summary?.totalWorkedMinutes)}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Overtime</div>
          <div style={styles.statValueSmall}>
            {formatMinutes(summary?.totalOvertimeMinutes)}
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        <SectionCard title="Manual Attendance Log">
          <form onSubmit={handleCreateManualLog} style={styles.form}>
            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>Employee</label>
                <select
                  value={manualLogForm.employeeId}
                  onChange={(e) =>
                    updateManualLogForm("employeeId", e.target.value)
                  }
                  style={styles.select}
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                      {employee.employeeCode ? ` \u2022 ${employee.employeeCode}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Punch Time</label>
                <input
                  type="datetime-local"
                  value={manualLogForm.punchTime}
                  onChange={(e) =>
                    updateManualLogForm("punchTime", e.target.value)
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>Type</label>
                <select
                  value={manualLogForm.type}
                  onChange={(e) =>
                    updateManualLogForm("type", e.target.value as "IN" | "OUT")
                  }
                  style={styles.select}
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Source</label>
                <input
                  value={manualLogForm.source}
                  onChange={(e) =>
                    updateManualLogForm("source", e.target.value)
                  }
                  placeholder="MANUAL"
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={creatingLog}
            >
              {creatingLog ? "Saving..." : "Create Log"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Attendance Day Sheet">
          <div style={styles.toolbar}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              style={styles.input}
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | AttendanceStatus)
              }
              style={styles.select}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="HALF_DAY">HALF_DAY</option>
              <option value="ABSENT">ABSENT</option>
              <option value="MISSING_PUNCH">MISSING_PUNCH</option>
            </select>
          </div>

          {loading ? (
            <div style={styles.muted}>Loading attendance...</div>
          ) : filteredRows.length === 0 ? (
            <div style={styles.muted}>No attendance rows found.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Shift</th>
                    <th style={styles.th}>Check In</th>
                    <th style={styles.th}>Check Out</th>
                    <th style={styles.th}>Worked</th>
                    <th style={styles.th}>Late</th>
                    <th style={styles.th}>Early Leave</th>
                    <th style={styles.th}>Overtime</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.employeeId}-${date}`}>
                      <td style={styles.td}>
                        <div style={styles.cellTitle}>
                          {row.employeeName || `Employee #${row.employeeId}`}
                        </div>
                        <div style={styles.cellSub}>{row.employeeId}</div>
                      </td>
                      <td style={styles.td}>{row.shiftName || "-"}</td>
                      <td style={styles.td}>{formatDateTime(row.checkIn)}</td>
                      <td style={styles.td}>{formatDateTime(row.checkOut)}</td>
                      <td style={styles.td}>{formatMinutes(row.workedMinutes)}</td>
                      <td style={styles.td}>{formatMinutes(row.lateMinutes)}</td>
                      <td style={styles.td}>
                        {formatMinutes(row.earlyLeaveMinutes)}
                      </td>
                      <td style={styles.td}>{formatMinutes(row.overtimeMinutes)}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(row.status === "PRESENT"
                              ? styles.badgePresent
                              : row.status === "HALF_DAY"
                                ? styles.badgeHalfDay
                                : row.status === "MISSING_PUNCH"
                                  ? styles.badgeMissing
                                  : styles.badgeAbsent),
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.smallButton}
                            onClick={() => handleOpenRange(row.employeeId)}
                          >
                            Range
                          </button>

                          <button
                            type="button"
                            style={styles.smallButton}
                            onClick={() => handleOpenHistory(row.employeeId)}
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
        </SectionCard>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 24,
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "220px 1fr auto",
    alignItems: "end",
    gap: 16,
  },
  dateWrap: {
    display: "grid",
    gap: 8,
  },
  rangeWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  topActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },
  statValueSmall: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  grid: {
    display: "grid",
    gap: 24,
  },
  form: {
    display: "grid",
    gap: 16,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },
  input: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  select: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) 220px",
    gap: 12,
    marginBottom: 18,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 13,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  cellTitle: {
    fontWeight: 700,
    color: "#0f172a",
  },
  cellSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  badgePresent: {
    background: "#ecfdf3",
    color: "#166534",
  },
  badgeHalfDay: {
    background: "#fff7ed",
    color: "#c2410c",
  },
  badgeMissing: {
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  badgeAbsent: {
    background: "#fef2f2",
    color: "#b91c1c",
  },
  rowActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid #dbe2ea",
    borderRadius: 10,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  },
  primaryButton: {
    minHeight: 44,
    padding: "0 18px",
    border: "none",
    borderRadius: 12,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 44,
    padding: "0 18px",
    border: "1px solid #dbe2ea",
    borderRadius: 12,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  success: {
    borderRadius: 12,
    padding: "12px 14px",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 14,
    border: "1px solid #bbf7d0",
  },
  error: {
    borderRadius: 12,
    padding: "12px 14px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 14,
    border: "1px solid #fecaca",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
};
