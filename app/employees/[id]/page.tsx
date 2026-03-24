"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearAuthTokens, getAccessToken } from "@/lib/auth";

type AttendanceSummary = {
  todayStatus?: string | null;
  lastCheckIn?: string | null;
  lastCheckOut?: string | null;
  lateMinutesThisMonth?: number | null;
  overtimeHoursThisMonth?: number | null;
  attendanceRate?: number | null;
};

type PayrollSummary = {
  basicSalary?: number | null;
  allowances?: number | null;
  deductions?: number | null;
  netSalary?: number | null;
};

type OvertimeBankSummary = {
  totalHours: number;
  totalEntries: number;
  lastEntryDate: string | null;
};

type LeaveBalanceSummary = {
  annualTotal: number;
  annualUsed: number;
  annualRemaining: number;
  sickTotal: number;
  sickUsed: number;
  sickRemaining: number;
};

type RecentActivityItem = {
  id: number | string;
  title: string;
  date?: string | null;
  description?: string | null;
};

type Employee = {
  id: number;
  fullName: string;
  role?: string;
  isActive?: boolean;
  monthlySalary?: number | null;
  companyId?: string;

  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;

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
  shift?: string | null;
  companyPhoneNumber?: string | null;
  education?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  ss?: string | null;
  gender?: string | null;
  telegramUser?: string | null;

  createdAt?: string;
  updatedAt?: string;
};

type EmployeeProfileResponse = {
  employee: Employee;
  attendanceSummary: AttendanceSummary;
  payrollSummary: PayrollSummary;
  overtimeBank: OvertimeBankSummary;
  leaveBalance: LeaveBalanceSummary;
  recentActivity: RecentActivityItem[];
};

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params?.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceSummary, setAttendanceSummary] =
    useState<AttendanceSummary | null>(null);
  const [payrollSummary, setPayrollSummary] =
    useState<PayrollSummary | null>(null);
  const [overtimeBank, setOvertimeBank] =
    useState<OvertimeBankSummary | null>(null);
  const [leaveBalance, setLeaveBalance] =
    useState<LeaveBalanceSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadEmployee() {
      const token = getAccessToken();

      if (!token) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      try {
        setLoading(true);
        setMessage("");

        const data = await apiRequest<EmployeeProfileResponse>(
          `/employees/${employeeId}/profile`,
          {
            method: "GET",
            auth: true,
          }
        );

        setEmployee(data.employee);
        setAttendanceSummary(data.attendanceSummary || null);
        setPayrollSummary(data.payrollSummary || null);
        setOvertimeBank(data.overtimeBank || null);
        setLeaveBalance(data.leaveBalance || null);
        setRecentActivity(data.recentActivity || []);
      } catch (error: any) {
        const text = String(error?.message || "").toLowerCase();

        if (text.includes("unauthorized") || text.includes("forbidden")) {
          clearAuthTokens();
          router.replace("/login");
          return;
        }

        setMessage(error?.message || "Failed to load employee profile");
      } finally {
        setLoading(false);
      }
    }

    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId, router]);

  const handleLogout = () => {
    clearAuthTokens();
    router.replace("/login");
  };

  const handleEdit = () => {
    router.push(`/employees/${employeeId}/edit`);
  };

  const handleDelete = async () => {
    if (!employee) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.fullName}?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setMessage("");

      await apiRequest(`/employees/${employeeId}`, {
        method: "DELETE",
        auth: true,
      });

      router.push("/employees");
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to delete employee");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <h2 style={styles.loadingTitle}>Loading employee profile...</h2>
          <p style={styles.loadingText}>Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <h2 style={styles.loadingTitle}>Employee not found</h2>
          <p style={styles.loadingText}>
            {message || "No employee data available."}
          </p>
          <button
            onClick={() => router.push("/employees")}
            style={styles.primaryButton}
          >
            ← Back to Employees
          </button>
        </div>
      </div>
    );
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
              style={styles.navItem}
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </button>
            <button
              style={styles.navItem}
              onClick={() => router.push("/employees")}
            >
              Employees
            </button>
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
            <button
              onClick={() => router.push("/employees")}
              style={styles.backButton}
            >
              ← Back to Employees
            </button>

            <h1 style={styles.pageTitle}>{employee.fullName}</h1>
            <p style={styles.pageSubtitle}>
              Complete employee profile and HR record
            </p>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.statusBadge}>
              {employee.isActive ? "Active Employee" : "Inactive Employee"}
            </div>

            <div style={styles.headerActions}>
              <button onClick={handleEdit} style={styles.editButton}>
                Edit Employee
              </button>

              <button
                onClick={handleDelete}
                style={styles.deleteButton}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Employee"}
              </button>
            </div>
          </div>
        </header>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <section style={styles.topGrid}>
          <div style={styles.heroCard}>
            <div style={styles.avatarCircle}>
              {employee.fullName?.charAt(0)?.toUpperCase() || "E"}
            </div>

            <div style={{ flex: 1 }}>
              <h2 style={styles.heroName}>{employee.fullName}</h2>
              <p style={styles.heroMeta}>
                {employee.jobTitle || "No job title"} •{" "}
                {employee.department || "No department"}
              </p>
              <p style={styles.heroMeta}>
                Role: {employee.role || "--"} | Employee ID: {employee.id}
              </p>

              <div style={styles.heroActions}>
                <button onClick={handleEdit} style={styles.editButton}>
                  Edit Profile
                </button>

                <button
                  onClick={() => router.push("/employees")}
                  style={styles.secondaryButton}
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Today Status</span>
              <span style={styles.summaryValue}>
                {attendanceSummary?.todayStatus || "--"}
              </span>
            </div>

            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Attendance Rate</span>
              <span style={styles.summaryValue}>
                {attendanceSummary?.attendanceRate ?? 0}%
              </span>
            </div>

            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Overtime Bank</span>
              <span style={styles.summaryValue}>
                {overtimeBank?.totalHours ?? 0} hrs
              </span>
            </div>

            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Net Salary</span>
              <span style={styles.summaryValue}>
                {formatMoney(
                  payrollSummary?.netSalary ?? employee.monthlySalary ?? 0
                )}
              </span>
            </div>

            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Overtime This Month</span>
              <span style={styles.summaryValue}>
                {attendanceSummary?.overtimeHoursThisMonth ?? 0} hrs
              </span>
            </div>
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Basic Information</h2>
            <InfoRow label="Full Name" value={employee.fullName} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow
              label="Company Phone Number"
              value={employee.companyPhoneNumber}
            />
            <InfoRow label="Gender" value={employee.gender} />
            <InfoRow label="Birth Date" value={formatDate(employee.birthDate)} />
            <InfoRow label="Nationality" value={employee.nationality} />
            <InfoRow label="S.S" value={employee.ss} />
            <InfoRow label="Telegram User" value={employee.telegramUser} />
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Organization Structure</h2>
            <InfoRow label="Location" value={employee.location} />
            <InfoRow label="Entity" value={employee.entity} />
            <InfoRow label="Unit" value={employee.unit} />
            <InfoRow label="Department" value={employee.department} />
            <InfoRow label="Section" value={employee.section} />
            <InfoRow
              label="Functional Reporting To"
              value={employee.functionalReportingTo}
            />
            <InfoRow label="Company ID" value={employee.companyId} />
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Job Details</h2>
            <InfoRow label="Job Title" value={employee.jobTitle} />
            <InfoRow label="Level" value={employee.level} />
            <InfoRow label="Grade" value={employee.grade} />
            <InfoRow label="Shift" value={employee.shift} />
            <InfoRow
              label="Monthly Salary"
              value={formatMoney(employee.monthlySalary)}
            />
            <InfoRow label="Hire Date" value={formatDate(employee.hireDate)} />
            <InfoRow
              label="Status"
              value={employee.isActive ? "Active" : "Inactive"}
            />
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Attendance & Payroll Snapshot</h2>

            <InfoRow
              label="Last Check In"
              value={formatDateTime(attendanceSummary?.lastCheckIn)}
            />
            <InfoRow
              label="Last Check Out"
              value={formatDateTime(attendanceSummary?.lastCheckOut)}
            />
            <InfoRow
              label="Late Minutes This Month"
              value={attendanceSummary?.lateMinutesThisMonth?.toString() || "0"}
            />
            <InfoRow
              label="Overtime This Month"
              value={`${attendanceSummary?.overtimeHoursThisMonth ?? 0} hrs`}
            />
            <InfoRow
              label="Basic Salary"
              value={formatMoney(payrollSummary?.basicSalary)}
            />
            <InfoRow
              label="Allowances"
              value={formatMoney(payrollSummary?.allowances)}
            />
            <InfoRow
              label="Deductions"
              value={formatMoney(payrollSummary?.deductions)}
            />
            <InfoRow
              label="Overtime Bank Entries"
              value={overtimeBank?.totalEntries?.toString() || "0"}
            />
            <InfoRow
              label="Last Overtime Entry"
              value={formatDate(overtimeBank?.lastEntryDate)}
            />
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Leave Balance</h2>

            <InfoRow
              label="Annual Leave Total"
              value={leaveBalance?.annualTotal?.toString() || "0"}
            />
            <InfoRow
              label="Annual Leave Used"
              value={leaveBalance?.annualUsed?.toString() || "0"}
            />
            <InfoRow
              label="Annual Leave Remaining"
              value={leaveBalance?.annualRemaining?.toString() || "0"}
            />
            <InfoRow
              label="Sick Leave Total"
              value={leaveBalance?.sickTotal?.toString() || "0"}
            />
            <InfoRow
              label="Sick Leave Used"
              value={leaveBalance?.sickUsed?.toString() || "0"}
            />
            <InfoRow
              label="Sick Leave Remaining"
              value={leaveBalance?.sickRemaining?.toString() || "0"}
            />
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Additional Information</h2>
            <InfoRow label="Education" value={employee.education} />
            <InfoRow label="Employee Code" value={employee.employeeCode} />
            <InfoRow
              label="Created At"
              value={formatDateTime(employee.createdAt)}
            />
            <InfoRow
              label="Updated At"
              value={formatDateTime(employee.updatedAt)}
            />
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Recent Activity</h2>

            {recentActivity.length === 0 ? (
              <div style={styles.emptyStateLike}>No recent activity found.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {recentActivity.map((item) => (
                  <div key={item.id} style={styles.activityItem}>
                    <div>
                      <div style={styles.activityTitle}>{item.title}</div>
                      <div style={styles.activityDescription}>
                        {item.description || "System activity"}
                      </div>
                    </div>

                    <div style={styles.activityDate}>
                      {formatDateTime(item.date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value || "--"}</span>
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
    marginBottom: 24,
    flexWrap: "wrap",
  },

  headerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 12,
  },

  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  backButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    padding: 0,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: 600,
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

  statusBadge: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
  },

  editButton: {
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
    fontWeight: 600,
  },

  deleteButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
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

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: 18,
    marginBottom: 18,
  },

  heroCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
    display: "flex",
    alignItems: "center",
    gap: 20,
  },

  heroActions: {
    display: "flex",
    gap: 10,
    marginTop: 16,
    flexWrap: "wrap",
  },

  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 800,
    flexShrink: 0,
  },

  heroName: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    marginBottom: 8,
  },

  heroMeta: {
    margin: "4px 0",
    color: "#6b7280",
  },

  summaryCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
    display: "grid",
    gap: 14,
  },

  summaryItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 10,
    borderBottom: "1px solid #f3f4f6",
  },

  summaryLabel: {
    color: "#6b7280",
    fontSize: 14,
  },

  summaryValue: {
    fontWeight: 700,
    color: "#111827",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },

  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 16,
  },

  infoRow: {
    display: "grid",
    gap: 6,
    padding: "12px 0",
    borderBottom: "1px solid #f3f4f6",
  },

  infoLabel: {
    fontSize: 13,
    color: "#6b7280",
  },

  infoValue: {
    fontSize: 15,
    fontWeight: 600,
    wordBreak: "break-word",
  },

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f6fb",
    padding: 24,
  },

  loadingCard: {
    background: "#ffffff",
    padding: 32,
    borderRadius: 20,
    boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
    textAlign: "center",
    minWidth: 320,
  },

  loadingTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 8,
  },

  loadingText: {
    color: "#6b7280",
    marginBottom: 16,
  },

  primaryButton: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  },

  emptyStateLike: {
    padding: 16,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
  },

  activityItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: 14,
    border: "1px solid #eef2f7",
    borderRadius: 14,
    background: "#ffffff",
  },

  activityTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 4,
  },

  activityDescription: {
    fontSize: 13,
    color: "#6b7280",
  },

  activityDate: {
    fontSize: 12,
    color: "#6b7280",
    whiteSpace: "nowrap",
  },
};