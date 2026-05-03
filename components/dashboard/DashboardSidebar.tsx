"use client";

import { useRouter, usePathname } from "next/navigation";
import type { CSSProperties } from "react";

type DashboardSidebarProps = {
  onLogout: () => void;
};

type NavItem = {
  label: string;
  path: string;
  icon: string;
  section: "main" | "workforce" | "attendance" | "payroll";
};

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: "\u25c8", section: "main" },
  { label: "AI HR", path: "/dashboard/ai-hr", icon: "\u2728", section: "main" },

  {
    label: "Employees",
    path: "/dashboard/employees",
    icon: "\u{1f465}",
    section: "workforce",
  },
  {
    label: "Branches",
    path: "/dashboard/branches",
    icon: "\u{1f3e2}",
    section: "workforce",
  },
  {
    label: "Shifts",
    path: "/dashboard/shifts",
    icon: "\u{1f552}",
    section: "workforce",
  },
  {
    label: "Shift Assignments",
    path: "/dashboard/shift-assignments",
    icon: "\u{1f517}",
    section: "workforce",
  },

  {
    label: "Attendance Daily",
    path: "/dashboard/attendance",
    icon: "\u2705",
    section: "attendance",
  },
  {
    label: "Monthly Attendance",
    path: "/dashboard/attendance/monthly",
    icon: "\u{1f4c5}",
    section: "attendance",
  },

  {
    label: "Payroll",
    path: "/dashboard/payroll",
    icon: "\u{1f4b0}",
    section: "payroll",
  },
  {
    label: "Payroll Settings",
    path: "/dashboard/payroll-settings",
    icon: "\u2699\ufe0f",
    section: "payroll",
  },
];

const sectionTitles: Record<NavItem["section"], string> = {
  main: "Overview",
  workforce: "Workforce",
  attendance: "Attendance",
  payroll: "Payroll",
};

export default function DashboardSidebar({
  onLogout,
}: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  function isActive(path: string) {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  const groupedItems = {
    main: navItems.filter((item) => item.section === "main"),
    workforce: navItems.filter((item) => item.section === "workforce"),
    attendance: navItems.filter((item) => item.section === "attendance"),
    payroll: navItems.filter((item) => item.section === "payroll"),
  };

  return (
    <aside style={styles.sidebar}>
      <div>
        <div style={styles.topCard}>
          <div style={styles.logoBox}>
            <div style={styles.logoBadge}>N</div>
            <div>
              <div style={styles.logoTitle}>NexaHR</div>
              <div style={styles.logoSub}>HR & Attendance Platform</div>
            </div>
          </div>

          <div style={styles.workspaceCard}>
            <div style={styles.workspaceLabel}>Workspace</div>
            <div style={styles.workspaceName}>Admin Dashboard</div>
          </div>
        </div>

        <div style={styles.navWrap}>
          {(["main", "workforce", "attendance", "payroll"] as const).map(
            (sectionKey) => (
              <div key={sectionKey} style={styles.sectionBlock}>
                <div style={styles.sectionTitle}>
                  {sectionTitles[sectionKey]}
                </div>

                <nav style={styles.nav}>
                  {groupedItems[sectionKey].map((item) => {
                    const active = isActive(item.path);

                    return (
                      <button
                        key={item.label}
                        type="button"
                        style={{
                          ...styles.navItem,
                          ...(active ? styles.navItemActive : {}),
                        }}
                        onClick={() => router.push(item.path)}
                      >
                        <span style={styles.navIcon}>{item.icon}</span>
                        <span style={styles.navText}>{item.label}</span>
                        {active ? <span style={styles.activeDot} /> : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ),
          )}
        </div>
      </div>

      <div style={styles.footerArea}>
        <div style={styles.footerCard}>
          <div style={styles.footerTitle}>System Status</div>
          <div style={styles.footerSub}>All core modules are available</div>
        </div>

        <button type="button" onClick={onLogout} style={styles.logoutButton}>
          <span style={styles.logoutIcon}>{"\u21a9"}</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    width: 300,
    height: "100vh",
    background:
      "linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
    color: "#ffffff",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    zIndex: 1000,
    overflowY: "auto",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "20px 0 50px rgba(2, 6, 23, 0.35)",
  },
  topCard: {
    marginBottom: 22,
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 22,
    flexShrink: 0,
    boxShadow: "0 10px 25px rgba(255,255,255,0.15)",
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  logoSub: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 4,
  },
  workspaceCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: "14px 16px",
    backdropFilter: "blur(10px)",
  },
  workspaceLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.65,
    marginBottom: 6,
  },
  workspaceName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f8fafc",
  },
  navWrap: {
    display: "grid",
    gap: 20,
  },
  sectionBlock: {
    display: "grid",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.45)",
    paddingLeft: 4,
    fontWeight: 700,
  },
  nav: {
    display: "grid",
    gap: 8,
  },
  navItem: {
    position: "relative",
    background: "transparent",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: "13px 14px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    transition: "all 0.2s ease",
  },
  navItemActive: {
    background: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.08))",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.25)",
  },
  navIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    background: "rgba(255,255,255,0.08)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  navText: {
    flex: 1,
    fontWeight: 600,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
    flexShrink: 0,
  },
  footerArea: {
    marginTop: 24,
    display: "grid",
    gap: 12,
  },
  footerCard: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 4,
  },
  footerSub: {
    fontSize: 12,
    color: "#cbd5e1",
    opacity: 0.72,
  },
  logoutButton: {
    padding: "13px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
  },
  logoutIcon: {
    fontSize: 14,
  },
};
