"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import { clearAuthTokens, getAccessToken } from "../../../lib/auth";

type AssignmentRow = {
  id: number;
  employeeId: number;
  employeeName: string | null;
  shiftId: number;
  shiftName: string | null;
  shiftDate: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AssignmentsResponse = {
  total: number;
  data: AssignmentRow[];
};

type EmployeeOption = {
  id: number;
  fullName: string;
};

type ShiftOption = {
  id: number;
  name: string;
};

type OptionsResponse = {
  employees: EmployeeOption[];
  shifts: ShiftOption[];
};

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ShiftAssignmentsPage() {
  const router = useRouter();

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [shiftDate, setShiftDate] = useState(getTodayDate());

  const [editingId, setEditingId] = useState<number | null>(null);

  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterShiftId, setFilterShiftId] = useState("");
  const [filterShiftDate, setFilterShiftDate] = useState("");
  const [search, setSearch] = useState("");

  async function loadOptions() {
    const data = await apiRequest<OptionsResponse>("/shift-assignments/options", {
      method: "GET",
      auth: true,
    });

    setEmployees(Array.isArray(data?.employees) ? data.employees : []);
    setShifts(Array.isArray(data?.shifts) ? data.shifts : []);
  }

  async function loadAssignments(showRefreshState = false) {
    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const params = new URLSearchParams();

      if (filterEmployeeId) params.set("employeeId", filterEmployeeId);
      if (filterShiftId) params.set("shiftId", filterShiftId);
      if (filterShiftDate) params.set("shiftDate", filterShiftDate);

      const query = params.toString();
      const endpoint = query
        ? `/shift-assignments?${query}`
        : "/shift-assignments";

      const data = await apiRequest<AssignmentsResponse>(endpoint, {
        method: "GET",
        auth: true,
      });

      setAssignments(Array.isArray(data?.data) ? data.data : []);
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to load shift assignments");
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
      await loadOptions();
      await loadAssignments();
    } catch (error: any) {
      setMessage(error?.message || "Failed to initialize page");
      setLoading(false);
    }
  }

  useEffect(() => {
    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return assignments;

    return assignments.filter((item) => {
      return (
        (item.employeeName || "").toLowerCase().includes(q) ||
        (item.shiftName || "").toLowerCase().includes(q) ||
        String(item.employeeId).includes(q) ||
        String(item.shiftId).includes(q) ||
        (item.shiftDate || "").toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });
  }, [assignments, search]);

  const stats = useMemo(() => {
    const uniqueEmployees = new Set(assignments.map((x) => x.employeeId)).size;
    const uniqueShifts = new Set(assignments.map((x) => x.shiftId)).size;

    return {
      totalAssignments: assignments.length,
      filteredAssignments: filteredAssignments.length,
      employeesCovered: uniqueEmployees,
      shiftsUsed: uniqueShifts,
    };
  }, [assignments, filteredAssignments]);

  function resetForm() {
    setEmployeeId("");
    setShiftId("");
    setShiftDate(getTodayDate());
    setEditingId(null);
  }

  function handleEditAssignment(item: AssignmentRow) {
    setEditingId(item.id);
    setEmployeeId(String(item.employeeId));
    setShiftId(String(item.shiftId));
    setShiftDate(item.shiftDate || getTodayDate());
    setMessage(`Editing assignment #${item.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveAssignment() {
    if (!employeeId || !shiftId || !shiftDate) {
      setMessage("Please select employee, shift, and date");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await apiRequest("/shift-assignments", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          employeeId: Number(employeeId),
          shiftId: Number(shiftId),
          shiftDate,
        }),
      });

      setMessage(
        editingId
          ? "Shift assignment updated successfully"
          : "Shift assignment saved successfully",
      );

      resetForm();
      await loadAssignments();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save shift assignment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAssignment(id: number) {
    const confirmed = window.confirm("Delete this shift assignment?");
    if (!confirmed) return;

    try {
      setMessage("");

      await apiRequest(`/shift-assignments/${id}`, {
        method: "DELETE",
        auth: true,
      });

      setAssignments((prev) => prev.filter((item) => item.id !== id));

      if (editingId === id) {
        resetForm();
      }

      setMessage("Shift assignment deleted successfully");
    } catch (error: any) {
      setMessage(error?.message || "Failed to delete shift assignment");
    }
  }

  function handleRefresh() {
    loadAssignments(true);
  }

  function handleResetFilters() {
    setFilterEmployeeId("");
    setFilterShiftId("");
    setFilterShiftDate("");
    setSearch("");
    setTimeout(() => {
      loadAssignments();
    }, 0);
  }

  function handleLogout() {
    clearAuthTokens();
    router.replace("/login");
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
              style={{ ...styles.navItem, ...styles.navItemActive }}
            >
              Shift Assignments
            </button>

            <button type="button" style={styles.navItem}>
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
            <h1 style={styles.pageTitle}>Shift Assignments</h1>
            <p style={styles.pageSubtitle}>
              Assign daily shifts to employees and manage scheduling records.
            </p>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.headerBadge}>
              Total Assignments: <strong>{assignments.length}</strong>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              style={styles.secondaryButton}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Assignments</div>
            <div style={styles.statValue}>{stats.totalAssignments}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Filtered Results</div>
            <div style={styles.statValue}>{stats.filteredAssignments}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Employees Covered</div>
            <div style={styles.statValue}>{stats.employeesCovered}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Shifts Used</div>
            <div style={styles.statValue}>{stats.shiftsUsed}</div>
          </div>
        </section>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>
                {editingId ? `Edit Assignment #${editingId}` : "Create Shift Assignment"}
              </h2>
              <p style={styles.cardSubtitle}>
                Select employee, shift, and date. If a record already exists for
                the same employee and date, it will be updated automatically.
              </p>
            </div>

            {editingId ? (
              <button type="button" onClick={resetForm} style={styles.secondaryButton}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div style={styles.formGrid}>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={styles.input}
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>

            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              style={styles.input}
            >
              <option value="">Select Shift</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              style={styles.input}
            />

            <button
              type="button"
              onClick={handleSaveAssignment}
              style={styles.primaryButton}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Assignment"
                  : "Save Assignment"}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Assignments List</h2>
              <p style={styles.cardSubtitle}>
                Filter and manage daily shift assignments.
              </p>
            </div>
          </div>

          <div style={styles.filterGrid}>
            <input
              type="text"
              placeholder="Search by employee, shift, date, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />

            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              style={styles.input}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>

            <select
              value={filterShiftId}
              onChange={(e) => setFilterShiftId(e.target.value)}
              style={styles.input}
            >
              <option value="">All Shifts</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterShiftDate}
              onChange={(e) => setFilterShiftDate(e.target.value)}
              style={styles.input}
            />

            <button
              type="button"
              onClick={() => loadAssignments()}
              style={styles.secondaryButton}
            >
              Apply Filters
            </button>
          </div>

          <div style={styles.filterActions}>
            <button
              type="button"
              onClick={handleResetFilters}
              style={styles.resetButton}
            >
              Reset Filters
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading shift assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div style={styles.emptyState}>
              {search.trim() || filterEmployeeId || filterShiftId || filterShiftDate
                ? "No matching assignments found."
                : "No shift assignments found yet."}
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Shift</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Created At</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.id}</td>
                      <td style={styles.tdStrong}>{item.employeeName || "--"}</td>
                      <td style={styles.td}>
                        <span style={styles.shiftBadge}>
                          {item.shiftName || "--"}
                        </span>
                      </td>
                      <td style={styles.td}>{item.shiftDate || "--"}</td>
                      <td style={styles.td}>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : "--"}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionsWrap}>
                          <button
                            type="button"
                            onClick={() => handleEditAssignment(item)}
                            style={styles.editButton}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(item.id)}
                            style={styles.deleteButton}
                          >
                            Delete
                          </button>
                        </div>
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
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
    gap: 12,
    marginBottom: 10,
  },
  filterActions: {
    display: "flex",
    justifyContent: "flex-end",
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
  searchInput: {
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
  resetButton: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    cursor: "pointer",
    fontWeight: 700,
  },
  editButton: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  deleteButton: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
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
  shiftBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
    fontSize: 12,
    fontWeight: 700,
  },
  actionsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
    textAlign: "center",
  },
};