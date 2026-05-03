"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { logoutAndRedirectToLogin } from "@/lib/auth";
import { apiRequest, handleAuthError } from "@/lib/api";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import styles from "./dashboard-layout.module.css";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type NavGroup = {
  key: string;
  title: string;
  icon: string;
  items: NavItem[];
};

type BrandingSettings = {
  brandingAppName?: string;
  brandingPrimaryColor?: string;
  brandingSidebarCompact?: boolean;
  brandingShowLogoOnly?: boolean;
  logoUrl?: string | null;
  companyName?: string | null;
};

type ThemeMode = "light" | "dark";

const ICONS = {
  overviewGroup: "\u25eb",
  dashboard: "\u2302",
  aiHr: "\u2726",
  peopleGroup: "\u25a4",
  employees: "\u{1f465}",
  branches: "\u{1f3e2}",
  settings: "\u2699",
  operationsGroup: "\u25e7",
  attendance: "\u2705",
  shifts: "\u{1f552}",
  assignments: "\u{1f5c2}",
  payroll: "\u{1f4b0}",
  devicesGroup: "\u2b21",
  commandCenter: "\u{1f39b}",
  devices: "\u{1f4e1}",
  deviceLogs: "\u{1f9fe}",
  deviceMappings: "\u{1f517}",
  deviceMonitoring: "\u{1f4c8}",
  menu: "\u2630",
  moon: "\u{1f319}",
  sun: "\u2600",
  user: "\u{1f464}",
  search: "\u2315",
  chevronDown: "\u25be",
  chevronRight: "\u25b8",
} as const;

function normalizeBranding(data?: BrandingSettings | null): BrandingSettings {
  return {
    brandingAppName: data?.brandingAppName || "NexaHR",
    brandingPrimaryColor: data?.brandingPrimaryColor || "#6366f1",
    brandingSidebarCompact: !!data?.brandingSidebarCompact,
    brandingShowLogoOnly: !!data?.brandingShowLogoOnly,
    logoUrl: data?.logoUrl || null,
    companyName: data?.companyName || null,
  };
}

const navGroups: NavGroup[] = [
  {
    key: "overview",
    title: "Overview",
    icon: ICONS.overviewGroup,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: ICONS.dashboard },
      { label: "AI HR", href: "/dashboard/ai-hr", icon: ICONS.aiHr },
    ],
  },
  {
    key: "people",
    title: "People & Structure",
    icon: ICONS.peopleGroup,
    items: [
      { label: "Employees", href: "/dashboard/employees", icon: ICONS.employees },
      { label: "Branches", href: "/dashboard/branches", icon: ICONS.branches },
      { label: "Settings", href: "/dashboard/settings", icon: ICONS.settings },
    ],
  },
  {
    key: "operations",
    title: "Operations Center",
    icon: ICONS.operationsGroup,
    items: [
      { label: "Attendance", href: "/dashboard/attendance", icon: ICONS.attendance },
      { label: "Shifts", href: "/dashboard/shifts", icon: ICONS.shifts },
      { label: "Assignments", href: "/dashboard/shift-assignments", icon: ICONS.assignments },
      { label: "Payroll", href: "/dashboard/payroll", icon: ICONS.payroll },
    ],
  },
  {
    key: "devices",
    title: "Devices Control",
    icon: ICONS.devicesGroup,
    items: [
      {
        label: "Device Command Center",
        href: "/dashboard/device-command-center",
        icon: ICONS.commandCenter,
      },
      { label: "Devices", href: "/dashboard/devices", icon: ICONS.devices },
      { label: "Device Logs", href: "/dashboard/device-logs", icon: ICONS.deviceLogs },
      { label: "Device Mappings", href: "/dashboard/device-mappings", icon: ICONS.deviceMappings },
      { label: "Device Monitoring", href: "/dashboard/device-monitoring", icon: ICONS.deviceMonitoring },
    ],
  },
];

const flatNavItems = navGroups.flatMap((group) => group.items);

function readStoredTheme(): ThemeMode | null {
  const savedTheme = readLocalStorage("nexahr-theme");
  return savedTheme === "dark" || savedTheme === "light" ? savedTheme : null;
}

function persistTheme(nextTheme: ThemeMode) {
  writeLocalStorage("nexahr-theme", nextTheme);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return readStoredTheme() || "light";
  });

  const [branding, setBranding] = useState<BrandingSettings>(() => normalizeBranding());

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    people: true,
    operations: true,
    devices: true,
  });

  const brandName = branding.brandingAppName?.trim() || "NexaHR";
  const primaryColor = branding.brandingPrimaryColor?.trim() || "#6366f1";
  const logoUrl = branding.logoUrl?.trim() || "";
  const companyDisplayName = branding.companyName?.trim() || `${brandName} Enterprise`;
  const brandInitial = brandName.charAt(0).toUpperCase() || "N";

  const currentSection = useMemo(() => {
    const exact = flatNavItems.find((item) => pathname === item.href);
    if (exact) return exact.label;

    const partial = flatNavItems.find(
      (item) => item.href !== "/dashboard" && pathname.startsWith(item.href),
    );

    return partial?.label || "Dashboard";
  }, [pathname]);

  const activeGroupKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const group of navGroups) {
      const hasActiveItem = group.items.some((item) => {
        if (item.href === "/dashboard") {
          return pathname === "/dashboard";
        }

        return pathname === item.href || pathname.startsWith(`${item.href}/`);
      });

      if (hasActiveItem) {
        keys.add(group.key);
      }
    }

    return keys;
  }, [pathname]);

  const filteredGroups = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();

    if (!query) {
      return navGroups;
    }

    return navGroups
      .map((group) => {
        const groupMatches = group.title.toLowerCase().includes(query);

        if (groupMatches) {
          return group;
        }

        const filteredItems = group.items.filter((item) =>
          item.label.toLowerCase().includes(query),
        );

        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [sidebarQuery]);

  const applyTheme = (nextTheme: ThemeMode) => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  useEffect(() => {
    const abortController = new AbortController();

    const loadBranding = async () => {
      try {
        const data = await apiRequest<BrandingSettings>("/company-settings", {
          method: "GET",
          auth: true,
          signal: abortController.signal,
        });

        setBranding(normalizeBranding(data));
      } catch (error) {
        if (isAbortError(error)) return;
        if (handleAuthError(error, router)) return;
        // keep defaults
      }
    };

    void loadBranding();

    return () => {
      abortController.abort();
    };
  }, [router]);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  function handleLogout() {
    logoutAndRedirectToLogin(router);
  }

  const cssVars = {
    "--brand-primary": primaryColor,
  } as CSSProperties;

  const brandLogoStyle: CSSProperties = {
    background: logoUrl
      ? `url(${logoUrl}) center/cover no-repeat`
      : `linear-gradient(135deg, ${primaryColor} 0%, #0ea5e9 100%)`,
  };

  return (
    <div className={styles.shell} style={cssVars}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={() => {
              setSidebarOpen(true);
            }}
            aria-label="Open navigation"
          >
            {ICONS.menu}
          </button>

          <Link
            href="/dashboard"
            className={styles.headerBrandLink}
            aria-label="Go to dashboard home"
            onClick={() => setSidebarOpen(false)}
          >
            <div className={styles.headerBrand}>
              <div className={styles.headerBrandIcon} style={brandLogoStyle}>
                {logoUrl ? "" : brandInitial}
              </div>

              {branding.brandingShowLogoOnly ? null : (
                <div className={styles.headerBrandText}>
                  <div className={styles.headerBrandTitle}>{brandName}</div>
                  <div className={styles.headerBrandSub}>Executive Workspace</div>
                </div>
              )}
            </div>
          </Link>
        </div>

        <div className={styles.headerCenter}>{companyDisplayName}</div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.headerIconButton}
            title="Go to dashboard"
            onClick={() => router.push("/dashboard")}
          >
            {ICONS.dashboard}
          </button>

          <button
            type="button"
            className={styles.themeToggleButton}
            title="Toggle theme"
            aria-label="Toggle theme"
            onClick={toggleTheme}
          >
            <span suppressHydrationWarning>
              {theme === "light" ? ICONS.moon : ICONS.sun}
            </span>
          </button>

          <div className={styles.userBox}>
            <span className={styles.userIcon}>{ICONS.user}</span>
            <span className={styles.userName}>Admin User</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={styles.logoutMiniButton}
          >
            Logout
          </button>
        </div>
      </header>

      {sidebarOpen ? (
        <button
          type="button"
          className={styles.mobileOverlay}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <div className={styles.body}>
        <aside
          className={`${styles.sidebar} ${
            sidebarOpen ? styles.sidebarOpen : ""
          }`}
        >
          <div className={styles.sidebarSearchWrap}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>{ICONS.search}</span>
              <input
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                className={styles.searchInput}
                placeholder="Search module"
              />
            </div>
          </div>

          <div className={styles.sidebarMenu}>
            {filteredGroups.map((group) => {
              const isOpen = (openGroups[group.key] ?? false) || activeGroupKeys.has(group.key);

              return (
                <div key={group.key} className={styles.menuGroup}>
                  <button
                    type="button"
                    className={styles.menuGroupButton}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className={styles.menuGroupButtonLeft}>
                      <span className={styles.menuGroupIcon}>{group.icon}</span>
                      <span className={styles.menuGroupTitle}>{group.title}</span>
                    </div>
                    <span className={styles.menuGroupChevron}>
                      {isOpen ? ICONS.chevronDown : ICONS.chevronRight}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className={styles.menuItems}>
                      {group.items.map((item) => {
                        const active = isActive(item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`${styles.menuItem} ${
                              active ? styles.menuItemActive : ""
                            }`}
                          >
                            <span className={styles.menuItemIcon}>{item.icon}</span>
                            <span className={styles.menuItemLabel}>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.mainContent}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionKicker}>{brandName} Workspace</div>
                <h1 className={styles.sectionTitle}>{currentSection}</h1>
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
