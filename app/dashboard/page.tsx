"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { clearAuthTokens, getAccessToken } from "../../lib/auth";

type ExecutiveDashboardResponse = {
  kpis: {
    totalEmployees: number;
    attendanceRateToday: number;
    avgLateMinutes: number;
    monthlyPayroll: number;
  };
  trends: {
    attendanceTrend: Array<{
      label: string;
      value: number;
    }>;
  };
  meta: {
    presentToday: number;
    halfDayToday: number;
    absentToday: number;
    missingPunchToday: number;
    generatedAt: string;
  };
};

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDashboard(showRefreshState = false) {
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

      const result = await apiRequest<ExecutiveDashboardResponse>(
        "/dashboard/executive",
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

      setMessage(error?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRefresh() {
    loadDashboard(true);
  }

  function handleLogout() {
    clearAuthTokens();
    router.replace("/login");
  }

  const trend = data?.trends?.attendanceTrend || [];
  const maxTrendValue = Math.max(...trend.map((item) => item.value), 100);

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
              style={{ ...styles.navItem, ...styles.navItemActive }}
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
              style={styles.navItem}
              onClick={() => router.push("/dashboard/attendance")}
            >
              Attendance Daily
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard/attendance/monthly")}
            >
              Monthly Attendance
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
            <h1 style={styles.pageTitle}>Executive Dashboard</h1>
            <p style={styles.pageSubtitle}>
              Overview of workforce, attendance performance, and daily trends.
            </p>
          </div>

          <div style={styles.headerActions}>
            {data?.meta?.generatedAt ? (
              <div style={styles.headerBadge}>
                Updated:{" "}
                <strong>
                  {new Date(data.meta.generatedAt).toLocaleString()}
                </strong>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleRefresh}
              style={styles.secondaryButton}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {message ? <div style={styles.alert}>{message}</div> : null}

        {loading ? (
          <div style={styles.emptyState}>Loading dashboard...</div>
        ) : (
          <>
            <section style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Employees</div>
                <div style={styles.statValue}>
                  {data?.kpis?.totalEmployees ?? 0}
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Attendance Rate Today</div>
                <div style={styles.statValue}>
                  {data?.kpis?.attendanceRateToday ?? 0}%
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Average Late Minutes</div>
                <div style={styles.statValue}>
                  {data?.kpis?.avgLateMinutes ?? 0}
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Monthly Payroll</div>
                <div style={styles.statValueSmall}>
                  {formatMoney(data?.kpis?.monthlyPayroll ?? 0)}
                </div>
              </div>
            </section>

            <section style={styles.statsGridSecondary}>
  <div style={styles.statCard}>
    <div style={styles.statLabel}>Present Today</div>
    <div style={styles.statValue}>{data?.meta?.presentToday ?? 0}</div>
  </div>

             <div style={styles.statCard}>
                  <div style={styles.statLabel}>Half Day Today</div>
                  <div style={styles.statValue}>{data?.meta?.halfDayToday ?? 0}</div>
                      </div>

                     <div style={styles.statCard}>
                     <div style={styles.statLabel}>Absent Today</div>
                     <div style={styles.statValue}>{data?.meta?.absentToday ?? 0}</div>
                      </div>

                           <div style={styles.statCard}>
                          <div style={styles.statLabel}>Missing Punch Today</div>
                        <div style={styles.statValue}>{data?.meta?.missingPunchToday ?? 0}</div>
                   </div>

            </section>

            <section style={styles.card}>
              <div style={styles.toolbar}>
                <div>
                  <h2 style={styles.cardTitle}>Attendance Trend</h2>
                  <p style={styles.cardSubtitle}>
                    Last 7 days attendance performance percentage.
                  </p>
                </div>
              </div>

              {trend.length === 0 ? (
                <div style={styles.emptyState}>No trend data available.</div>
              ) : (
                <div style={styles.chartCard}>
                  {trend.map((item) => {
                    const barHeight = Math.max(
                      16,
                      Math.round((item.value / maxTrendValue) * 220),
                    );

                    return (
                      <div key={item.label} style={styles.barColumn}>
                        <div style={styles.barValue}>{item.value}%</div>
                        <div style={styles.barTrack}>
                          <div
                            style={{
                              ...styles.barFill,
                              height: `${barHeight}px`,
                            }}
                          />
                        </div>
                        <div style={styles.barLabel}>{item.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={styles.quickLinksGrid}>
              <button
                type="button"
                style={styles.linkCard}
                onClick={() => router.push("/dashboard/attendance")}
              >
                <div style={styles.linkTitle}>Open Daily Attendance</div>
                <div style={styles.linkText}>
                  Review attendance for the selected day.
                </div>
              </button>

              <button
                type="button"
                style={styles.linkCard}
                onClick={() => router.push("/dashboard/attendance/monthly")}
              >
                <div style={styles.linkTitle}>Open Monthly Attendance</div>
                <div style={styles.linkText}>
                  Review employee monthly attendance history.
                </div>
              </button>

              <button
                type="button"
                style={styles.linkCard}
                onClick={() => router.push("/dashboard/shifts")}
              >
                <div style={styles.linkTitle}>Manage Shifts</div>
                <div style={styles.linkText}>
                  Create and update shift definitions.
                </div>
              </button>

              <button
                type="button"
                style={styles.linkCard}
                onClick={() => router.push("/dashboard/shift-assignments")}
              >
                <div style={styles.linkTitle}>Manage Shift Assignments</div>
                <div style={styles.linkText}>
                  Assign shifts to employees by date.
                </div>
              </button>
            </section>
          </>
        )}
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
    marginBottom: 16,
  },
  statsGridSecondary: {
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
  chartCard: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 16,
    alignItems: "end",
    minHeight: 320,
    paddingTop: 10,
  },
  barColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  barValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111827",
  },
  barTrack: {
    width: "100%",
    maxWidth: 60,
    height: 240,
    borderRadius: 16,
    background: "#e5e7eb",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    background: "#111827",
    borderRadius: 16,
  },
  barLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 700,
  },
  quickLinksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  linkCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(15,23,42,0.04)",
  },
  linkTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 8,
  },
  linkText: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 1.5,
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
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
    textAlign: "center",
  },
};