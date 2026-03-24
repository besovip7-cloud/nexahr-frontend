"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import { clearAuthTokens, getAccessToken } from "../../../lib/auth";

type AIHRResponse = {
  summary: {
    periodStart: string;
    periodEnd: string;
    employeesAnalyzed: number;
    companyAttendanceRate: number;
    totalLateIncidents: number;
    totalAbsentIncidents: number;
    totalMissingPunchIncidents: number;
  };
  topLateEmployees: Array<{
    employeeId: number;
    employeeName: string;
    lateCount: number;
    lateMinutes: number;
    absentCount: number;
    missingPunchCount: number;
    halfDayCount: number;
    presentCount: number;
    totalRecords: number;
    attendanceRate: number;
    riskScore: number;
  }>;
  topAbsentEmployees: Array<{
    employeeId: number;
    employeeName: string;
    lateCount: number;
    lateMinutes: number;
    absentCount: number;
    missingPunchCount: number;
    halfDayCount: number;
    presentCount: number;
    totalRecords: number;
    attendanceRate: number;
    riskScore: number;
  }>;
  topMissingPunchEmployees: Array<{
    employeeId: number;
    employeeName: string;
    lateCount: number;
    lateMinutes: number;
    absentCount: number;
    missingPunchCount: number;
    halfDayCount: number;
    presentCount: number;
    totalRecords: number;
    attendanceRate: number;
    riskScore: number;
  }>;
  topRiskEmployees: Array<{
    employeeId: number;
    employeeName: string;
    lateCount: number;
    lateMinutes: number;
    absentCount: number;
    missingPunchCount: number;
    halfDayCount: number;
    presentCount: number;
    totalRecords: number;
    attendanceRate: number;
    riskScore: number;
  }>;
  alerts: string[];
};

export default function AIHRDashboard() {
  const router = useRouter();

  const [data, setData] = useState<AIHRResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await apiRequest<AIHRResponse>("/dashboard/ai-hr", {
        method: "GET",
        auth: true,
      });

      setData(res);
    } catch (e: any) {
      setMessage(e?.message || "Failed to load AI HR dashboard");
    } finally {
      setLoading(false);
    }
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
              style={{ ...styles.navItem, ...styles.navItemActive }}
            >
              🧠 AI HR
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
              Attendance
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard/payroll")}
            >
              Payroll
            </button>
          </nav>
        </div>

        <button type="button" onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <h1 style={styles.title}>🧠 AI HR Dashboard</h1>

        {message ? <div style={styles.alert}>{message}</div> : null}

        {loading || !data ? (
          <div style={styles.card}>Loading...</div>
        ) : (
          <>
            <div style={styles.summaryGrid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Employees Analyzed</h3>
                <div style={styles.bigValue}>{data.summary.employeesAnalyzed}</div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Attendance Rate</h3>
                <div style={styles.bigValue}>
                  {data.summary.companyAttendanceRate}%
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Late Incidents</h3>
                <div style={styles.bigValue}>{data.summary.totalLateIncidents}</div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Absent Incidents</h3>
                <div style={styles.bigValue}>{data.summary.totalAbsentIncidents}</div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Missing Punch</h3>
                <div style={styles.bigValue}>
                  {data.summary.totalMissingPunchIncidents}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Smart Alerts</h2>
              {data.alerts.length > 0 ? (
                data.alerts.map((x, i) => (
                  <div key={i} style={styles.insight}>
                    {x}
                  </div>
                ))
              ) : (
                <div>No alerts</div>
              )}
            </div>

            <div style={styles.grid}>
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Top Late Employees</h2>
                {data.topLateEmployees.length > 0 ? (
                  data.topLateEmployees.map((e, i) => (
                    <div key={i} style={styles.row}>
                      <div>
                        <div style={styles.name}>{e.employeeName}</div>
                        <div style={styles.sub}>
                          Late days: {e.lateCount} | Late minutes: {e.lateMinutes}
                        </div>
                      </div>
                      <strong>{e.riskScore}</strong>
                    </div>
                  ))
                ) : (
                  <div>No data</div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Top Absent Employees</h2>
                {data.topAbsentEmployees.length > 0 ? (
                  data.topAbsentEmployees.map((e, i) => (
                    <div key={i} style={styles.row}>
                      <div>
                        <div style={styles.name}>{e.employeeName}</div>
                        <div style={styles.sub}>
                          Absences: {e.absentCount} | Attendance: {e.attendanceRate}%
                        </div>
                      </div>
                      <strong>{e.riskScore}</strong>
                    </div>
                  ))
                ) : (
                  <div>No data</div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Top Missing Punch</h2>
                {data.topMissingPunchEmployees.length > 0 ? (
                  data.topMissingPunchEmployees.map((e, i) => (
                    <div key={i} style={styles.row}>
                      <div>
                        <div style={styles.name}>{e.employeeName}</div>
                        <div style={styles.sub}>
                          Missing punch: {e.missingPunchCount}
                        </div>
                      </div>
                      <strong>{e.riskScore}</strong>
                    </div>
                  ))
                ) : (
                  <div>No data</div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Top Risk Employees</h2>
                {data.topRiskEmployees.length > 0 ? (
                  data.topRiskEmployees.map((e, i) => (
                    <div key={i} style={styles.row}>
                      <div>
                        <div style={styles.name}>{e.employeeName}</div>
                        <div style={styles.sub}>
                          Risk score: {e.riskScore} | Attendance: {e.attendanceRate}%
                        </div>
                      </div>
                      <strong>{e.riskScore}</strong>
                    </div>
                  ))
                ) : (
                  <div>No data</div>
                )}
              </div>
            </div>
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
    background: "#f5f7fb",
  },
  sidebar: {
    background: "#111827",
    color: "#fff",
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
    background: "#fff",
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
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  logoutButton: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600,
  },
  main: {
    padding: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#111827",
  },
  alert: {
    background: "#e0f2fe",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    color: "#0c4a6e",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 16,
    color: "#6b7280",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 20,
    color: "#111827",
  },
  bigValue: {
    fontSize: 30,
    fontWeight: 800,
    color: "#111827",
  },
  insight: {
    padding: 10,
    background: "#eef2ff",
    borderRadius: 8,
    marginBottom: 8,
    color: "#312e81",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #eee",
    gap: 12,
  },
  name: {
    fontWeight: 700,
    color: "#111827",
  },
  sub: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
};