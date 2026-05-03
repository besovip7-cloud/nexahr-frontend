"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { logoutAndRedirectToLogin } from "@/lib/auth";

type DashboardShellProps = {
  children: ReactNode;
};

function formatTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/dashboard/ai-hr") return "AI HR";
  if (pathname === "/dashboard/employees") return "Employees";
  if (pathname === "/dashboard/branches") return "Branches";
  if (pathname === "/dashboard/shifts") return "Shifts";
  if (pathname === "/dashboard/shift-assignments") return "Shift Assignments";
  if (pathname === "/dashboard/attendance") return "Attendance Daily";
  if (pathname === "/dashboard/attendance/monthly") return "Monthly Attendance";
  if (pathname.startsWith("/dashboard/attendance/history")) {
    return "Attendance History";
  }
  if (pathname === "/dashboard/payroll") return "Payroll";
  if (pathname === "/dashboard/payroll-settings") return "Payroll Settings";
  return "NexaHR Dashboard";
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logoutAndRedirectToLogin(router);
  }

  const pageTitle = formatTitle(pathname);

  return (
    <div style={styles.page}>
      <DashboardSidebar onLogout={handleLogout} />

      <main style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <div style={styles.breadcrumb}>NexaHR / Admin Workspace</div>
            <h1 style={styles.topBarTitle}>{pageTitle}</h1>
          </div>

          <div style={styles.topBarRight}>
            <div style={styles.quickStat}>
              <span style={styles.quickStatDot} />
              <span>Live workspace</span>
            </div>

            <div style={styles.profileChip}>
              <div style={styles.profileAvatar}>A</div>
              <div>
                <div style={styles.profileName}>Admin</div>
                <div style={styles.profileRole}>System Access</div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top right, rgba(99,102,241,0.08), transparent 20%), #eef3f8",
    color: "#111827",
  },
  main: {
    padding: 24,
    marginLeft: 300,
    minHeight: "100vh",
  },
  topBar: {
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,23,42,0.06)",
    backdropFilter: "blur(12px)",
    borderRadius: 24,
    padding: "18px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
    flexWrap: "wrap",
  },
  breadcrumb: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  topBarTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },
  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  quickStat: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
  },
  quickStatDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
  },
  profileChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "8px 12px",
    minWidth: 180,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "linear-gradient(135deg, #111827, #334155)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  },
  profileName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },
  profileRole: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  content: {
    minHeight: "calc(100vh - 120px)",
  },
};
