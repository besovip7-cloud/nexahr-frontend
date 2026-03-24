"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { clearAuthTokens, getAccessToken } from "../../../../lib/auth";

type EmployeeOption = {
  id: number;
  fullName: string;
};

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "MISSING_PUNCH";

type MonthlyRecord = {
  id?: number;
  companyId?: string;
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

type MonthlyResponse = {
  employeeId: number;
  month: string;
  summary: {
    totalDays: number;
    presentDays: number;
    halfDayDays: number;
    missingPunchDays: number;
    absentDays: number;
    totalWorkedMinutes: number;
    totalLateMinutes: number;
    totalEarlyLeaveMinutes: number;
    totalOvertimeMinutes: number;
  };
  records: MonthlyRecord[];
};

function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMinutes(minutes?: number | null) {
  const value = Number(minutes || 0);
  const hrs = Math.floor(value / 60);
  const mins = value % 60;
  return `${hrs}h ${mins}m`;
}

function formatTime(value?: string | null) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MonthlyAttendancePage() {
  const router = useRouter();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(getCurrentMonth());

  const [data, setData] = useState<MonthlyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function loadEmployees() {
    const result = await apiRequest<EmployeeOption[]>("/employees", {
      method: "GET",
      auth: true,
    });

    const list = Array.isArray(result) ? result : [];
    setEmployees(list);

    if (!employeeId && list.length > 0) {
      setEmployeeId(String(list[0].id));
      return String(list[0].id);
    }

    return employeeId;
  }

  async function loadMonthlyAttendance(
    targetEmployeeId?: string,
    targetMonth?: string,
    showRefreshState = false,
  ) {
    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    const selectedEmployeeId = targetEmployeeId || employeeId;
    const selectedMonth = targetMonth || month;

    if (!selectedEmployeeId || !selectedMonth) {
      setLoading(false);
      return;
    }

    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const result = await apiRequest<MonthlyResponse>(
        `/attendance/monthly/${selectedEmployeeId}?month=${selectedMonth}`,
        {
          method: "GET",
          auth: true,
        },
      );

      setData(result || null);
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to load monthly attendance");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function initializePage() {
    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const firstEmployeeId = await loadEmployees();
      if (firstEmployeeId) {
        await loadMonthlyAttendance(firstEmployeeId, month);
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      setMessage(error?.message || "Failed to initialize page");
      setLoading(false);
    }
  }

  useEffect(() => {
    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleApplyFilters() {
    loadMonthlyAttendance();
  }

  function handleRefresh() {
    loadMonthlyAttendance(employeeId, month, true);
  }

  function handleResetFilters() {
    setSearch("");
    setStatusFilter("");
  }

  function handleLogout() {
    clearAuthTokens();
    router.replace("/login");
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
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.logoBox}>
            <div style={styles.logoBadge}>N</div>
            <div>
              <div style={styles.logoTitle}>NexaHR</div>
              <div style={styles.logoSub}>HR & Attendance SaaS</div>
            </div>
          </div>

          <nav style={styles.nav}>
            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/employees")}
            >
              Employees
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard/attendance")}
            >
              Attendance Daily
            </button>

            <button
              type="button"
              style={{ ...styles.navItem, ...styles.navItemActive }}
            >
              Monthly Attendance
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard/shifts")}
            >
              Shifts
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard/shift-assignments")}
            >
              Shift Assignments
            </button>

            <button type="button" style={styles.navItem}>
              Branches
            </button>
            <button type="button" style={styles.navItem}>
              Payroll
            </button>
            <button type="button" style={styles.navItem}>
              Settings
            </button>
          </nav>
        </div>

        <button type="button" onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Monthly Attendance</h1>
            <p style={styles.pageSubtitle}>
              Review employee monthly attendance summary and daily records.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={handleRefresh}
              style={styles.secondaryButton}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Filters</h2>
              <p style={styles.cardSubtitle}>
                Select employee and month to load attendance.
              </p>
            </div>
          </div>

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
                </option>
              ))}
            </select>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={styles.input}
            />

            <button
              type="button"
              onClick={handleApplyFilters}
              style={styles.primaryButton}
            >
              Load Attendance
            </button>
          </div>
        </section>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Days</div>
            <div style={styles.statValue}>{data?.summary?.totalDays ?? 0}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Present</div>
            <div style={styles.statValue}>{data?.summary?.presentDays ?? 0}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Half Day</div>
            <div style={styles.statValue}>{data?.summary?.halfDayDays ?? 0}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Absent</div>
            <div style={styles.statValue}>{data?.summary?.absentDays ?? 0}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Missing Punch</div>
            <div style={styles.statValue}>{data?.summary?.missingPunchDays ?? 0}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Worked</div>
            <div style={styles.statValueSmall}>
              {formatMinutes(data?.summary?.totalWorkedMinutes ?? 0)}
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Late</div>
            <div style={styles.statValueSmall}>
              {formatMinutes(data?.summary?.totalLateMinutes ?? 0)}
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Early Leave</div>
            <div style={styles.statValueSmall}>
              {formatMinutes(data?.summary?.totalEarlyLeaveMinutes ?? 0)}
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Overtime</div>
            <div style={styles.statValueSmall}>
              {formatMinutes(data?.summary?.totalOvertimeMinutes ?? 0)}
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Daily Records</h2>
              <p style={styles.cardSubtitle}>
                Review daily attendance behavior for the selected employee and month.
              </p>
            </div>
          </div>

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
              onChange={(e) => setStatusFilter(e.target.value)}
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
            <div style={styles.emptyState}>Loading monthly attendance...</div>
          ) : filteredRecords.length === 0 ? (
            <div style={styles.emptyState}>
              No monthly attendance records found for the selected filters.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
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
                    <tr key={`${record.date}-${record.employeeId}`}>
                      <td style={styles.tdStrong}>{record.date}</td>
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
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    background: "#f3f6fb",
    color: "#111827",
  },
  sidebar: {
    background: "#111827",
    color: "#ffffff",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "100vh",
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#ffffff",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 20,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  logoSub: {
    fontSize: 12,
    opacity: 0.75,
  },
  nav: {
    display: "grid",
    gap: 10,
  },
  navItem: {
    background: "transparent",
    color: "#d1d5db",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 14,
  },
  navItemActive: {
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  logoutButton: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600,
  },
  main: {
    padding: 28,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 800,
    margin: 0,
  },
  pageSubtitle: {
    marginTop: 8,
    color: "#6b7280",
  },
  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
    minHeight: 180,
    marginBottom: 18,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 6,
  },
  cardSubtitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: 14,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
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
    marginBottom: 18,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 18,
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
    minWidth: 1100,
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