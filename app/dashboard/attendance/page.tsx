"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import { clearAuthTokens, getAccessToken } from "../../../lib/auth";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "MISSING_PUNCH";

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

type SummaryResponse = {
  date: string;
  present: number;
  halfDay: number;
  absent: number;
  missingPunch: number;
  totalWorkedMinutes: number;
};

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMinutes(minutes?: number | null) {
  const value = Number(minutes || 0);
  const hrs = Math.floor(value / 60);
  const mins = value % 60;
  return `${hrs}h ${mins}m`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AttendancePage() {
  const router = useRouter();

  const [date, setDate] = useState(getTodayDate());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [rows, setRows] = useState<DaySheetRow[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadAttendance(showRefreshState = false, selectedDate?: string) {
    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    const targetDate = selectedDate || date;

    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const [sheetData, summaryData] = await Promise.all([
        apiRequest<DaySheetResponse>(`/attendance/day-sheet?date=${targetDate}`, {
          method: "GET",
          auth: true,
        }),
        apiRequest<SummaryResponse>(`/attendance/summary?date=${targetDate}`, {
          method: "GET",
          auth: true,
        }),
      ]);

      setRows(Array.isArray(sheetData?.rows) ? sheetData.rows : []);
      setSummary(summaryData || null);
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to load attendance day sheet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAttendance(false, getTodayDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        (row.employeeName || "").toLowerCase().includes(q) ||
        (row.shiftName || "").toLowerCase().includes(q) ||
        String(row.employeeId).includes(q) ||
        row.status.toLowerCase().includes(q);

      const matchesStatus = !statusFilter || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    return {
      totalRows: rows.length,
      filteredRows: filteredRows.length,
      present: rows.filter((r) => r.status === "PRESENT").length,
      absent: rows.filter((r) => r.status === "ABSENT").length,
      missingPunch: rows.filter((r) => r.status === "MISSING_PUNCH").length,
    };
  }, [rows, filteredRows]);

  function handleRefresh() {
    loadAttendance(true);
  }

    async function handleFinalizeDay() {
    const confirmed = window.confirm(
      `Finalize attendance for ${date}? This will mark absences and complete day status.`,
    );

    if (!confirmed) return;

    try {
      setFinalizing(true);
      setMessage("");

      await apiRequest("/attendance/finalize-day", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          date,
        }),
      });

      setMessage(`Attendance finalized successfully for ${date}`);
      await loadAttendance();
    } catch (error: any) {
      setMessage(error?.message || "Failed to finalize attendance day");
    } finally {
      setFinalizing(false);
    }
  }

  function handleApplyDate() {
    loadAttendance(false);
  }

  function handleResetFilters() {
    setSearch("");
    setStatusFilter("");
  }

  function handleLogout() {
    clearAuthTokens();
    router.replace("/login");
  }

   async function handleExportExcel() {
  const token = getAccessToken();

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://api.getnexhr.com/api";

  const res = await fetch(
    `${baseUrl}/attendance/day-sheet/export-excel?date=${date}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const blob = await res.blob();

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${date}.xlsx`;
  a.click();
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

            <button
              type="button"
              style={{ ...styles.navItem, ...styles.navItemActive }}
            >
              Attendance
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
            <h1 style={styles.pageTitle}>Attendance Daily Sheet</h1>
            <p style={styles.pageSubtitle}>
              View daily attendance, shift allocation, and attendance outcomes by date.
            </p>
          </div>

          <div style={styles.headerActions}>
          <div style={styles.headerBadge}>
           Date: <strong>{date}</strong>
          </div> 

          <button onClick={handleExportExcel} style={styles.primaryButton}>
            Export Excel
                </button>

          <button
           type="button"
            onClick={handleRefresh}
            style={styles.secondaryButton}
            >
         {refreshing ? "Refreshing..." : "Refresh"}
          </button>

                <button
              type="button"
               onClick={handleFinalizeDay}
               style={styles.finalizeButton}
               disabled={finalizing}
              >
                {finalizing ? "Finalizing..." : "Finalize Day"}
               </button>
            </div>
        </header>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Assigned</div>
            <div style={styles.statValue}>{summary?.present !== undefined ? rows.length : totals.totalRows}</div>
          </div>

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
              {formatMinutes(summary?.totalWorkedMinutes ?? 0)}
            </div>
          </div>
        </section>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Filters</h2>
              <p style={styles.cardSubtitle}>
                Choose date and filter the day sheet results.
              </p>
            </div>
          </div>

          <div style={styles.filterGrid}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.input}
            />

            <input
              type="text"
              placeholder="Search by employee, shift, status..."
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
              onClick={handleApplyDate}
              style={styles.primaryButton}
            >
              Apply Date
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              style={styles.secondaryButton}
            >
              Reset Filters
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Day Sheet</h2>
              <p style={styles.cardSubtitle}>
                Daily attendance results for assigned employees on the selected date.
              </p>
            </div>

            <div style={styles.headerBadge}>
              Filtered: <strong>{filteredRows.length}</strong>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading attendance sheet...</div>
          ) : filteredRows.length === 0 ? (
            <div style={styles.emptyState}>
              No attendance records found for the selected filters.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Employee ID</th>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Shift</th>
                    <th style={styles.th}>Check In</th>
                    <th style={styles.th}>Check Out</th>
                    <th style={styles.th}>Worked</th>
                    <th style={styles.th}>Late</th>
                    <th style={styles.th}>Early Leave</th>
                    <th style={styles.th}>Overtime</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.employeeId}-${row.shiftName}-${row.checkIn}-${row.checkOut}`}>
                      <td style={styles.td}>{row.employeeId}</td>
                      <td style={styles.tdStrong}>{row.employeeName || "--"}</td>
                      <td style={styles.td}>{row.shiftName || "--"}</td>
                      <td style={styles.td}>{formatDateTime(row.checkIn)}</td>
                      <td style={styles.td}>{formatDateTime(row.checkOut)}</td>
                      <td style={styles.td}>{formatMinutes(row.workedMinutes)}</td>
                      <td style={styles.td}>{formatMinutes(row.lateMinutes)}</td>
                      <td style={styles.td}>{formatMinutes(row.earlyLeaveMinutes)}</td>
                      <td style={styles.td}>{formatMinutes(row.overtimeMinutes)}</td>
                      <td style={styles.td}>
                        <span style={getStatusStyle(row.status)}>{row.status}</span>
                      </td>
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
  headerBadge: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 14,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
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
  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
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
    gridTemplateColumns: "1fr 2fr 1fr auto auto",
    gap: 12,
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
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1200,
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

    finalizeButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#166534",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
};