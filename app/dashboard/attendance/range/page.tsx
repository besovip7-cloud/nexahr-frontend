"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import {
  formatMinutesCompact,
  formatTimeSafe,
  getMonthStartDateInputValue,
  getTodayDateInputValue,
  isValidDateInputRange,
  isValidDateInputValue,
} from "@/lib/date";
import { triggerFileDownload } from "@/lib/download";
import { toFiniteNumber } from "@/lib/number";
import { withSearch } from "@/lib/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type EmployeeOption = {
  id: number;
  fullName: string;
  employeeCode?: string | null;
};

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "MISSING_PUNCH";

type AttendanceRecord = {
  id?: string;
  companyId?: string | null;
  employeeId: number;
  shiftId?: number | null;
  date: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  status: AttendanceStatus;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type HistoryResponse = {
  employeeId: number;
  from: string;
  to: string;
  total?: number;
  records: AttendanceRecord[];
};

function formatMinutes(minutes?: number | null) {
  return formatMinutesCompact(minutes);
}

function formatTime(value?: string | null) {
  return formatTimeSafe(value, "--");
}

function AttendanceRangePageFallback() {
  return (
    <div style={styles.page}>
      <PageHeader
        title="Attendance by Date Range"
        subtitle="Review employee attendance for any custom period using From and To dates."
      />

      <SectionCard title="Loading">
        <div style={styles.emptyState}>Loading attendance page...</div>
      </SectionCard>
    </div>
  );
}

export default function AttendanceRangePage() {
  return (
    <Suspense fallback={<AttendanceRangePageFallback />}>
      <AttendanceRangePageContent />
    </Suspense>
  );
}

function AttendanceRangePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmployeeId = searchParams.get("employeeId") || "";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const initialFrom = isValidDateInputValue(fromParam)
    ? fromParam
    : getMonthStartDateInputValue();
  const initialTo = isValidDateInputValue(toParam)
    ? toParam
    : getTodayDateInputValue();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | AttendanceStatus>("");
  const initializedRef = useRef(false);

  const loadEmployees = useCallback(async (selectedEmployeeId?: string) => {
    const result = await apiRequest<EmployeeOption[]>("/employees", {
      method: "GET",
      auth: true,
    });

    const list = Array.isArray(result) ? result : [];
    setEmployees(list);

    const candidateId = (selectedEmployeeId || "").trim();
    const hasCandidate = candidateId
      ? list.some((employee) => String(employee.id) === candidateId)
      : false;

    if (hasCandidate) {
      setEmployeeId(candidateId);
      return candidateId;
    }

    if (list.length > 0) {
      const firstId = String(list[0].id);
      setEmployeeId(firstId);
      return firstId;
    }

    setEmployeeId("");
    return "";
  }, []);

  const loadAttendanceRange = useCallback(
    async (
      targetEmployeeId?: string,
      targetFrom?: string,
      targetTo?: string,
      showRefreshState = false,
    ) => {
    const selectedEmployeeId = targetEmployeeId || employeeId;
    const selectedFrom = targetFrom || from;
    const selectedTo = targetTo || to;

    if (!selectedEmployeeId || !selectedFrom || !selectedTo) {
      setData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isValidDateInputRange(selectedFrom, selectedTo)) {
      setMessage('Please select a valid date range where "From" is before "To".');
      setData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const result = await apiRequest<HistoryResponse>(
        withSearch(`/attendance/employee/${selectedEmployeeId}/history`, {
          from: selectedFrom,
          to: selectedTo,
        }),
        {
          method: "GET",
          auth: true,
        },
      );

      setData(result || null);
    } catch (error) {
      if (handleAuthError(error, router)) return;
      console.error("Failed to load attendance range:", error);
      setMessage(getErrorMessage(error, "Failed to load attendance records"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    },
    [employeeId, from, router, to],
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const initializePage = async () => {
      try {
        setLoading(true);
        setMessage("");

        const firstEmployeeId = await loadEmployees(employeeId || initialEmployeeId);
        if (firstEmployeeId) {
          await loadAttendanceRange(firstEmployeeId, from, to);
        } else {
          setLoading(false);
        }
      } catch (error) {
        if (handleAuthError(error, router)) return;
        console.error("Failed to initialize page:", error);
        setMessage(getErrorMessage(error, "Failed to initialize page"));
        setData(null);
        setLoading(false);
      }
    };

    void initializePage();
  }, [employeeId, from, initialEmployeeId, loadAttendanceRange, loadEmployees, router, to]);

  const filteredRecords = useMemo(() => {
    const records = data?.records || [];
    const q = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !q ||
        record.date.toLowerCase().includes(q) ||
        record.status.toLowerCase().includes(q) ||
        String(record.employeeId).includes(q) ||
        (record.remarks || "").toLowerCase().includes(q);

      const matchesStatus = !statusFilter || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const summary = useMemo(() => {
    const records = filteredRecords;

    return {
      totalDays: records.length,
      presentDays: records.filter((r) => r.status === "PRESENT").length,
      halfDayDays: records.filter((r) => r.status === "HALF_DAY").length,
      missingPunchDays: records.filter((r) => r.status === "MISSING_PUNCH").length,
      absentDays: records.filter((r) => r.status === "ABSENT").length,
      totalWorkedMinutes: records.reduce((sum, r) => sum + toFiniteNumber(r.workedMinutes), 0),
      totalLateMinutes: records.reduce((sum, r) => sum + toFiniteNumber(r.lateMinutes), 0),
      totalEarlyLeaveMinutes: records.reduce(
        (sum, r) => sum + toFiniteNumber(r.earlyLeaveMinutes),
        0,
      ),
      totalOvertimeMinutes: records.reduce((sum, r) => sum + toFiniteNumber(r.overtimeMinutes), 0),
    };
  }, [filteredRecords]);

  function handleApplyFilters() {
    if (!isValidDateInputRange(from, to)) {
      setMessage('Please select a valid date range where "From" is before "To".');
      return;
    }

    void loadAttendanceRange(employeeId, from, to);
  }

  function handleRefresh() {
    void loadAttendanceRange(employeeId, from, to, true);
  }

  function handleResetFilters() {
    setSearch("");
    setStatusFilter("");
  }

  function handleOpenEmployeeHistory() {
    if (!employeeId) return;
    if (!isValidDateInputRange(from, to)) {
      setMessage('Please select a valid date range where "From" is before "To".');
      return;
    }

    router.push(
      withSearch(`/dashboard/attendance/history/${employeeId}`, {
        from,
        to,
      }),
    );
  }

  async function handleExportCsv() {
    if (!employeeId) {
      setMessage("Select employee and date range first.");
      return;
    }

    if (!isValidDateInputRange(from, to)) {
      setMessage('Please select a valid date range where "From" is before "To".');
      return;
    }

    try {
      setExportingCsv(true);
      setMessage("");

      const blob = await apiRequest<Blob>(
        withSearch(
          `/attendance/employee/${encodeURIComponent(employeeId)}/history/export`,
          {
            from,
            to,
          },
        ),
        {
          method: "GET",
          auth: true,
          responseType: "blob",
        },
      );
      triggerFileDownload(blob, `attendance-range-${employeeId}-${from}-to-${to}.csv`);

      setMessage("CSV exported successfully.");
    } catch (error) {
      if (handleAuthError(error, router)) return;
      console.error("Failed to export CSV:", error);
      setMessage(getErrorMessage(error, "Failed to export CSV"));
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleExportExcel() {
    if (!employeeId) {
      setMessage("Select employee and date range first.");
      return;
    }

    if (!isValidDateInputRange(from, to)) {
      setMessage('Please select a valid date range where "From" is before "To".');
      return;
    }

    try {
      setExportingExcel(true);
      setMessage("");

      const blob = await apiRequest<Blob>(
        withSearch(
          `/attendance/employee/${encodeURIComponent(employeeId)}/history/export-excel`,
          {
            from,
            to,
          },
        ),
        {
          method: "GET",
          auth: true,
          responseType: "blob",
        },
      );
      triggerFileDownload(blob, `attendance-range-${employeeId}-${from}-to-${to}.xlsx`);

      setMessage("Excel exported successfully.");
    } catch (error) {
      if (handleAuthError(error, router)) return;
      console.error("Failed to export Excel:", error);
      setMessage(getErrorMessage(error, "Failed to export Excel"));
    } finally {
      setExportingExcel(false);
    }
  }

  function getStatusStyle(status: AttendanceStatus): CSSProperties {
    if (status === "PRESENT") {
      return {
        ...styles.statusBadge,
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (status === "HALF_DAY") {
      return {
        ...styles.statusBadge,
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    if (status === "MISSING_PUNCH") {
      return {
        ...styles.statusBadge,
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      ...styles.statusBadge,
      background: "#f3f4f6",
      color: "#374151",
    };
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Attendance by Date Range"
        subtitle="Review employee attendance for any custom period using From and To dates."
      />

      <div style={styles.headerActions}>
        <button
          type="button"
          onClick={handleOpenEmployeeHistory}
          style={styles.secondaryButton}
          disabled={!employeeId}
        >
          Open History
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          style={styles.secondaryButton}
          disabled={exportingCsv || !employeeId}
        >
          {exportingCsv ? "Exporting CSV..." : "Export CSV"}
        </button>

        <button
          type="button"
          onClick={handleExportExcel}
          style={styles.secondaryButton}
          disabled={exportingExcel || !employeeId}
        >
          {exportingExcel ? "Exporting Excel..." : "Export Excel"}
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          style={styles.secondaryButton}
          disabled={refreshing || !employeeId}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <SectionCard title="Filters">
        <div style={styles.filterGrid}>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={styles.input}
          >
            <option value="">Select Employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
                {employee.employeeCode ? ` \u2022 ${employee.employeeCode}` : ""}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={styles.input}
          />

          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={styles.input}
          />

          <button
            type="button"
            onClick={handleApplyFilters}
            style={styles.primaryButton}
            disabled={!employeeId}
          >
            Load Attendance
          </button>
        </div>
      </SectionCard>

      {message ? <div style={styles.alert}>{message}</div> : null}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Days</div>
          <div style={styles.statValue}>{summary.totalDays}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Present</div>
          <div style={styles.statValue}>{summary.presentDays}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Half Day</div>
          <div style={styles.statValue}>{summary.halfDayDays}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Absent</div>
          <div style={styles.statValue}>{summary.absentDays}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Missing Punch</div>
          <div style={styles.statValue}>{summary.missingPunchDays}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Worked</div>
          <div style={styles.statValueSmall}>
            {formatMinutes(summary.totalWorkedMinutes)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Late</div>
          <div style={styles.statValueSmall}>
            {formatMinutes(summary.totalLateMinutes)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Early Leave</div>
          <div style={styles.statValueSmall}>
            {formatMinutes(summary.totalEarlyLeaveMinutes)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Overtime</div>
          <div style={styles.statValueSmall}>
            {formatMinutes(summary.totalOvertimeMinutes)}
          </div>
        </div>
      </section>

      <SectionCard title="Daily Records">
        <div style={styles.recordFilterGrid}>
          <input
            type="text"
            placeholder="Search by date, status, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.input}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | AttendanceStatus)}
            style={styles.input}
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ABSENT">Absent</option>
            <option value="MISSING_PUNCH">Missing Punch</option>
          </select>

          <button
            type="button"
            onClick={handleResetFilters}
            style={styles.secondaryButton}
          >
            Reset Filters
          </button>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Loading attendance...</div>
        ) : filteredRecords.length === 0 ? (
          <div style={styles.emptyState}>
            No attendance records found for the selected filters.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Scheduled</th>
                  <th style={styles.th}>Check In</th>
                  <th style={styles.th}>Check Out</th>
                  <th style={styles.th}>Worked</th>
                  <th style={styles.th}>Late</th>
                  <th style={styles.th}>Early Leave</th>
                  <th style={styles.th}>Overtime</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id || `${record.date}-${record.employeeId}`}>
                    <td style={styles.tdStrong}>{record.date}</td>
                    <td style={styles.td}>
                      {formatTime(record.scheduledStart)} - {formatTime(record.scheduledEnd)}
                    </td>
                    <td style={styles.td}>{formatTime(record.checkIn)}</td>
                    <td style={styles.td}>{formatTime(record.checkOut)}</td>
                    <td style={styles.td}>{formatMinutes(record.workedMinutes)}</td>
                    <td style={styles.td}>{formatMinutes(record.lateMinutes)}</td>
                    <td style={styles.td}>{formatMinutes(record.earlyLeaveMinutes)}</td>
                    <td style={styles.td}>{formatMinutes(record.overtimeMinutes)}</td>
                    <td style={styles.td}>
                      <span style={getStatusStyle(record.status)}>
                        {record.status}
                      </span>
                    </td>
                    <td style={styles.td}>{record.remarks || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100%",
    background: "#f3f6fb",
    color: "#111827",
    display: "grid",
    gap: 18,
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr auto",
    gap: 12,
  },
  recordFilterGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 12,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#111827",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
  },
  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
  },
  statValueSmall: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1150,
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#374151",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "14px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#111827",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
    textAlign: "center",
  },
};
