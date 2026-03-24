"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearAuthTokens, getAccessToken } from "@/lib/auth";

type Employee = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string;
  branchId?: number | null;
  monthlySalary?: number | null;
  isActive?: boolean;

  location?: string | null;
  entity?: string | null;
  unit?: string | null;
  department?: string | null;
  section?: string | null;
  hireDate?: string | null;
  jobTitle?: string | null;
  level?: string | null;
  grade?: string | null;
  functionalReportingTo?: string | null;
  branch?: string | null;
  shift?: string | null;
  companyPhoneNumber?: string | null;
  education?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  ss?: string | null;
  gender?: string | null;
  telegramUser?: string | null;

  createdAt?: string;
};

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function formatShiftDisplay(value?: string | null) {
  if (!value || !value.trim()) return "--";
  return value;
}

export default function EmployeesPage() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadEmployees(showRefreshState = false) {
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

      const data = await apiRequest<Employee[]>("/employees", {
        method: "GET",
        auth: true,
      });

      setEmployees(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to load employees");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, [router]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return employees;

    return employees.filter((emp) => {
      return (
        normalizeText(emp.fullName).includes(q) ||
        normalizeText(emp.email).includes(q) ||
        normalizeText(emp.phone).includes(q) ||
        normalizeText(emp.department).includes(q) ||
        normalizeText(emp.jobTitle).includes(q) ||
        normalizeText(emp.location).includes(q) ||
        normalizeText(emp.shift).includes(q) ||
        String(emp.id).includes(q)
      );
    });
  }, [employees, search]);

  const employeesWithShift = useMemo(() => {
    return employees.filter((emp) => !!emp.shift?.trim()).length;
  }, [employees]);

  const handleDeleteEmployee = async (id: number) => {
    const confirmed = window.confirm("Delete this employee?");
    if (!confirmed) return;

    try {
      setMessage("");

      await apiRequest(`/employees/${id}`, {
        method: "DELETE",
        auth: true,
      });

      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      setMessage("Employee deleted successfully");
    } catch (error: any) {
      setMessage(error?.message || "Failed to delete employee");
    }
  };

  const handleOpenEmployee = (id: number) => {
    router.push(`/employees/${id}`);
  };

  const handleEditEmployee = (id: number) => {
    router.push(`/employees/${id}/edit`);
  };

  const handleCreateEmployee = () => {
    router.push("/employees/create");
  };

  const handleRefresh = () => {
    loadEmployees(true);
  };

  const handleLogout = () => {
    clearAuthTokens();
    router.replace("/login");
  };

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
    style={styles.navItem}
    onClick={() => router.push("/dashboard")}
  >
    Dashboard
  </button>

  <button
    style={styles.navItem}
    onClick={() => router.push("/dashboard/ai-hr")}
  >
    🧠 AI HR
  </button>

  <button style={styles.navItem}>Employees</button>
  <button style={styles.navItem}>Attendance</button>
  <button style={styles.navItem}>Branches</button>
  <button style={styles.navItem}>Payroll</button>
  <button style={styles.navItem}>Settings</button>
</nav>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Employees Management</h1>
            <p style={styles.pageSubtitle}>
              View, search, and manage employee records in NexaHR.
            </p>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.headerBadge}>
              Total Employees: <strong>{employees.length}</strong>
            </div>

            <button onClick={handleRefresh} style={styles.secondaryButton}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button onClick={handleCreateEmployee} style={styles.primaryButton}>
              + Create Employee
            </button>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Employees</div>
            <div style={styles.statValue}>{employees.length}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Filtered Results</div>
            <div style={styles.statValue}>{filteredEmployees.length}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Employees With Shift</div>
            <div style={styles.statValue}>{employeesWithShift}</div>
          </div>
        </section>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Employees List</h2>
              <p style={styles.cardSubtitle}>
                Click any employee name to open the profile.
              </p>
            </div>

            <input
              type="text"
              placeholder="Search by name, email, phone, department, shift..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div style={styles.emptyState}>
              {search.trim()
                ? "No matching employees found."
                : "No employees found yet."}
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Full Name</th>
                    <th style={styles.th}>Location</th>
                    <th style={styles.th}>Department</th>
                    <th style={styles.th}>Job Title</th>
                    <th style={styles.th}>Shift</th>
                    <th style={styles.th}>Salary</th>
                    <th style={styles.th}>Gender</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td style={styles.td}>{emp.id}</td>

                      <td style={styles.tdStrong}>
                        <button
                          onClick={() => handleOpenEmployee(emp.id)}
                          style={styles.nameButton}
                        >
                          {emp.fullName}
                        </button>
                      </td>

                      <td style={styles.td}>{emp.location || "--"}</td>
                      <td style={styles.td}>{emp.department || "--"}</td>
                      <td style={styles.td}>{emp.jobTitle || "--"}</td>
                      <td style={styles.td}>
                        <span style={styles.shiftBadge}>
                          {formatShiftDisplay(emp.shift)}
                        </span>
                      </td>
                      <td style={styles.td}>{formatMoney(emp.monthlySalary)}</td>
                      <td style={styles.td}>{emp.gender || "--"}</td>
                      <td style={styles.td}>
                        <span
                          style={
                            emp.isActive === false
                              ? styles.inactiveBadge
                              : styles.activeBadge
                          }
                        >
                          {emp.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionsWrap}>
                          <button
                            onClick={() => handleOpenEmployee(emp.id)}
                            style={styles.viewButton}
                          >
                            View
                          </button>

                          <button
                            onClick={() => handleEditEmployee(emp.id)}
                            style={styles.editButton}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
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
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
    minHeight: 220,
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

  searchInput: {
    minWidth: 320,
    maxWidth: 420,
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

  nameButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 14,
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

  activeBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: 700,
  },

  inactiveBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 700,
  },

  actionsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  viewButton: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
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

  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
    textAlign: "center",
  },
};