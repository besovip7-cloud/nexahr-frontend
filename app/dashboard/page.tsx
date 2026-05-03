"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatDateTimeSafe } from "@/lib/date";
import { withSearch } from "@/lib/navigation";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";
import { toFiniteNumber } from "@/lib/number";
import styles from "./dashboard-page.module.css";

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

type RankedEmployee = {
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
};

type AiInsightsResponse = {
  summary: {
    periodStart: string;
    periodEnd: string;
    employeesAnalyzed: number;
    companyAttendanceRate: number;
    totalLateIncidents: number;
    totalAbsentIncidents: number;
    totalMissingPunchIncidents: number;
  };
  topLateEmployees: RankedEmployee[];
  topAbsentEmployees: RankedEmployee[];
  topMissingPunchEmployees: RankedEmployee[];
  topRiskEmployees: RankedEmployee[];
  alerts: string[];
};

type Device = {
  id: number;
  name: string;
  status?: string | null;
  deviceType?: string | null;
  connectionMode?: string | null;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
};

type CountResponse = {
  count?: number;
  total?: number;
  value?: number;
};

type EmployeeListItem = {
  id: number;
  fullName?: string | null;
  name?: string | null;
  employeeName?: string | null;
  gender?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  birthDate?: string | null;
  dob?: string | null;
};

type DashboardExtraStats = {
  devicesCount: number;
  newJoins7d: number;
  resignedCount: number;
  earlyDepartureToday: number;
  verifiedCount: number;
  onLeaveToday: number;
};

type LoadDashboardOptions = {
  showRefresh?: boolean;
  silent?: boolean;
};

type WorkforceDemographics = {
  maleCount: number;
  femaleCount: number;
  malePercentage: number;
  femalePercentage: number;
  averageAge: number;
  birthdaysThisMonth: number;
  ageDistribution: Array<{
    label: string;
    value: number;
  }>;
};

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  return formatDateTimeSafe(value, "--");
}

function getHealthLabel(rate?: number | null) {
  const value = toFiniteNumber(rate);
  if (value >= 90) return "Strong";
  if (value >= 75) return "Stable";
  return "Needs Attention";
}

function getHealthTone(rate?: number | null) {
  const value = toFiniteNumber(rate);
  if (value >= 90) return styles.healthStrong;
  if (value >= 75) return styles.healthStable;
  return styles.healthWeak;
}

function readCount(value: CountResponse | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  if (typeof value.count === "number") return value.count;
  if (typeof value.total === "number") return value.total;
  if (typeof value.value === "number") return value.value;
  return 0;
}

function normalizeGender(input?: string | null) {
  const value = String(input || "").trim().toLowerCase();

  if (!value) return "";

  const arabicMale = "\u0630\u0643\u0631";
  const arabicFemale = "\u0623\u0646\u062b\u0649";
  const arabicFemaleAlt = "\u0627\u0646\u062b\u0649";

  if (["male", "m", "man", arabicMale].includes(value)) return "male";
  if (["female", "f", "woman", arabicFemale, arabicFemaleAlt].includes(value)) {
    return "female";
  }

  return "";
}

function readEmployeeGender(employee: EmployeeListItem) {
  return normalizeGender(employee.gender || employee.sex || "");
}

function readEmployeeBirthDate(employee: EmployeeListItem) {
  return employee.dateOfBirth || employee.birthDate || employee.dob || null;
}

function calculateAge(dateValue?: string | null) {
  if (!dateValue) return null;

  const birthDate = new Date(dateValue);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  if (age < 0 || age > 100) return null;

  return age;
}

function calculateDemographics(
  employees: EmployeeListItem[],
): WorkforceDemographics {
  let maleCount = 0;
  let femaleCount = 0;
  let birthdaysThisMonth = 0;

  const validAges: number[] = [];
  const ageBuckets = {
    "18-25": 0,
    "26-35": 0,
    "36-45": 0,
    "46-55": 0,
    "56+": 0,
  };

  const currentMonth = new Date().getMonth();

  for (const employee of employees) {
    const gender = readEmployeeGender(employee);
    if (gender === "male") maleCount += 1;
    if (gender === "female") femaleCount += 1;

    const birthDateValue = readEmployeeBirthDate(employee);
    if (birthDateValue) {
      const birthDate = new Date(birthDateValue);
      if (
        !Number.isNaN(birthDate.getTime()) &&
        birthDate.getMonth() === currentMonth
      ) {
        birthdaysThisMonth += 1;
      }
    }

    const age = calculateAge(birthDateValue);
    if (age !== null) {
      validAges.push(age);

      if (age >= 18 && age <= 25) ageBuckets["18-25"] += 1;
      else if (age >= 26 && age <= 35) ageBuckets["26-35"] += 1;
      else if (age >= 36 && age <= 45) ageBuckets["36-45"] += 1;
      else if (age >= 46 && age <= 55) ageBuckets["46-55"] += 1;
      else if (age >= 56) ageBuckets["56+"] += 1;
    }
  }

  const genderTotal = maleCount + femaleCount;
  const averageAge =
    validAges.length > 0
      ? Math.round(validAges.reduce((sum, age) => sum + age, 0) / validAges.length)
      : 0;

  return {
    maleCount,
    femaleCount,
    malePercentage: genderTotal > 0 ? Math.round((maleCount / genderTotal) * 100) : 0,
    femalePercentage:
      genderTotal > 0 ? Math.round((femaleCount / genderTotal) * 100) : 0,
    averageAge,
    birthdaysThisMonth,
    ageDistribution: [
      { label: "18-25", value: ageBuckets["18-25"] },
      { label: "26-35", value: ageBuckets["26-35"] },
      { label: "36-45", value: ageBuckets["36-45"] },
      { label: "46-55", value: ageBuckets["46-55"] },
      { label: "56+", value: ageBuckets["56+"] },
    ],
  };
}

const GENDER_COLORS = ["#6366f1", "#ec4899"];
const UI_ICONS = {
  employees: "\u{1f465}",
  attendance: "\u2705",
  branches: "\u{1f3e2}",
  devices: "\u{1f4e1}",
  payroll: "\u{1f4b0}",
  settings: "\u2699",
  newJoins: "\u2795",
  resigned: "\u2715",
  verified: "\u2714",
  present: "\u{1f9cd}",
  absent: "\u{1f4c5}",
  late: "\u23f0",
  earlyDeparture: "\u2197",
  onLeave: "\u263c",
  generalStats: "\u25d4",
} as const;

export default function DashboardPage() {
  const router = useRouter();

  const [executive, setExecutive] = useState<ExecutiveDashboardResponse | null>(null);
  const [ai, setAi] = useState<AiInsightsResponse | null>(null);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [extraStats, setExtraStats] = useState<DashboardExtraStats>({
    devicesCount: 0,
    newJoins7d: 0,
    resignedCount: 0,
    earlyDepartureToday: 0,
    verifiedCount: 0,
    onLeaveToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async (options: LoadDashboardOptions = {}) => {
    const { showRefresh = false, silent = false } = options;

    try {
      if (showRefresh && !silent) setRefreshing(true);
      else if (!showRefresh) setLoading(true);

      if (!silent) setMessage("");

      const [
        executiveData,
        aiData,
        employeesData,
        devicesData,
        newJoinsData,
        resignedData,
        earlyDepartureData,
        verifiedData,
        onLeaveData,
      ] = await Promise.all([
        apiRequest<ExecutiveDashboardResponse>("/dashboard/executive", {
          method: "GET",
          auth: true,
        }),
        apiRequest<AiInsightsResponse>("/dashboard/ai-insights", {
          method: "GET",
          auth: true,
        }).catch(() => null),
        apiRequest<EmployeeListItem[]>("/employees", {
          method: "GET",
          auth: true,
        }).catch(() => []),
        apiRequest<Device[]>("/devices", {
          method: "GET",
          auth: true,
        }).catch(() => []),
        apiRequest<CountResponse | number>(
          withSearch("/employees", { recent: 7 }),
          {
            method: "GET",
            auth: true,
          },
        ).catch(() => 0),
        apiRequest<CountResponse | number>("/employees/resigned/count", {
          method: "GET",
          auth: true,
        }).catch(() => 0),
        apiRequest<CountResponse | number>("/attendance/early-departures/today", {
          method: "GET",
          auth: true,
        }).catch(() => 0),
        apiRequest<CountResponse | number>("/devices/verified/count", {
          method: "GET",
          auth: true,
        }).catch(() => 0),
        apiRequest<CountResponse | number>("/employees/on-leave/today", {
          method: "GET",
          auth: true,
        }).catch(() => 0),
      ]);

      setExecutive(executiveData || null);
      setAi(aiData || null);
      setEmployees(Array.isArray(employeesData) ? employeesData : []);
      setExtraStats({
        devicesCount: Array.isArray(devicesData) ? devicesData.length : 0,
        newJoins7d: readCount(newJoinsData),
        resignedCount: readCount(resignedData),
        earlyDepartureToday: readCount(earlyDepartureData),
        verifiedCount: readCount(verifiedData),
        onLeaveToday: readCount(onLeaveData),
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to load dashboard");

      if (handleAuthError(error, router)) return;

      if (!silent) {
        setMessage(errorMessage);
      }
    } finally {
      setLoading(false);
      if (showRefresh && !silent) {
        setRefreshing(false);
      }
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleSilentRefresh = useCallback(() => {
    void loadDashboard({ showRefresh: true, silent: true });
  }, [loadDashboard]);

  useVisibilityPolling({
    intervalMs: 30000,
    onPoll: handleSilentRefresh,
  });

  const demographics = useMemo(() => calculateDemographics(employees), [employees]);

  const workforceHealth = getHealthLabel(executive?.kpis?.attendanceRateToday);
  const workforceHealthTone = getHealthTone(executive?.kpis?.attendanceRateToday);
  const trend = executive?.trends?.attendanceTrend || [];

  const genderPieData = useMemo(() => {
    return [
      { name: "Male", value: demographics.maleCount },
      { name: "Female", value: demographics.femaleCount },
    ];
  }, [demographics]);

  const quickStats = useMemo(() => {
    return [
      {
        title: "Employees",
        value: executive?.kpis?.totalEmployees ?? 0,
        note: "Total workforce",
      },
      {
        title: "Attendance",
        value: `${executive?.kpis?.attendanceRateToday ?? 0}%`,
        note: "Today rate",
      },
      {
        title: "Late Avg",
        value: executive?.kpis?.avgLateMinutes ?? 0,
        note: "Minutes",
      },
      {
        title: "Payroll",
        value: formatMoney(executive?.kpis?.monthlyPayroll ?? 0),
        note: "Monthly",
      },
    ];
  }, [executive]);

  const demographicStats = useMemo(() => {
    return [
      {
        title: "Male",
        value: `${demographics.malePercentage}%`,
        note: `${demographics.maleCount} employees`,
      },
      {
        title: "Female",
        value: `${demographics.femalePercentage}%`,
        note: `${demographics.femaleCount} employees`,
      },
      {
        title: "Average Age",
        value: demographics.averageAge || "--",
        note: "Years",
      },
      {
        title: "Birthdays",
        value: demographics.birthdaysThisMonth,
        note: "This month",
      },
    ];
  }, [demographics]);

  const aiHighlights = useMemo(() => {
    return [
      {
        title: "Late",
        value: ai?.summary?.totalLateIncidents ?? 0,
      },
      {
        title: "Absent",
        value: ai?.summary?.totalAbsentIncidents ?? 0,
      },
      {
        title: "Missing Punch",
        value: ai?.summary?.totalMissingPunchIncidents ?? 0,
      },
      {
        title: "Analyzed",
        value: ai?.summary?.employeesAnalyzed ?? 0,
      },
    ];
  }, [ai]);

  const topRiskCompact = useMemo(() => {
    return (ai?.topRiskEmployees || []).slice(0, 4);
  }, [ai]);

  const compactAlerts = useMemo(() => {
    return (ai?.alerts || []).slice(0, 4);
  }, [ai]);

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingBox}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={styles.compactPage}>
      <section className={styles.compactHero}>
        <div className={styles.compactHeroLeft}>
          <div className={styles.compactKicker}>NexaHR Workspace</div>
          <h1 className={styles.compactTitle}>Executive Dashboard</h1>
          <p className={styles.compactSub}>
            Clear view of workforce, attendance, AI signals, demographics, and key
            actions.
          </p>
        </div>

        <div className={styles.compactHeroRight}>
          <div className={`${styles.healthBadge} ${workforceHealthTone}`}>
            {workforceHealth}
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadDashboard({ showRefresh: true })}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {message ? <div className={styles.alert}>{message}</div> : null}

      <section className={styles.compactStatsGrid}>
        {quickStats.map((item) => (
          <CompactStatCard
            key={item.title}
            title={item.title}
            value={item.value}
            note={item.note}
          />
        ))}
      </section>

      <section className={styles.compactStatsGrid}>
        {demographicStats.map((item) => (
          <CompactStatCard
            key={item.title}
            title={item.title}
            value={item.value}
            note={item.note}
          />
        ))}
      </section>

      <div className={styles.compactMainLayout}>
        <div className={styles.compactMainContent}>
          <Panel title="Attendance Trend" subtitle="Last 7 days">
            {trend.length === 0 ? (
              <EmptyState text="No trend data available." />
            ) : (
              <div className={styles.chartPanel}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend}
                    margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="compactAttendanceArea"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="rgba(148,163,184,0.16)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(19, 24, 34, 0.88)",
                        color: "#fff",
                        backdropFilter: "blur(12px)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#compactAttendanceArea)"
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <div className={styles.compactTwoCol}>
            <Panel title="Gender Ratio" subtitle="Male vs Female">
              {genderPieData.every((item) => item.value === 0) ? (
                <EmptyState text="No gender data available." />
              ) : (
                <div className={styles.pulseCard}>
                  <div className={styles.pieWrap}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={genderPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={82}
                          paddingAngle={3}
                        >
                          {genderPieData.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(19, 24, 34, 0.88)",
                            color: "#fff",
                            backdropFilter: "blur(12px)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className={styles.compactLegend}>
                    <div className={styles.compactLegendRow}>
                      <div className={styles.compactLegendLeft}>
                        <span
                          className={styles.legendDot}
                          style={{ backgroundColor: GENDER_COLORS[0] }}
                        />
                        <span>Male</span>
                      </div>
                      <strong>{demographics.malePercentage}%</strong>
                    </div>

                    <div className={styles.compactLegendRow}>
                      <div className={styles.compactLegendLeft}>
                        <span
                          className={styles.legendDot}
                          style={{ backgroundColor: GENDER_COLORS[1] }}
                        />
                        <span>Female</span>
                      </div>
                      <strong>{demographics.femalePercentage}%</strong>
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Employees Age Distribution" subtitle="Age groups">
              {demographics.ageDistribution.every((item) => item.value === 0) ? (
                <EmptyState text="No age data available." />
              ) : (
                <div className={styles.chartPanel}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={demographics.ageDistribution}
                      margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="rgba(148,163,184,0.16)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "currentColor", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "currentColor", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(19, 24, 34, 0.88)",
                          color: "#fff",
                          backdropFilter: "blur(12px)",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[12, 12, 0, 0]}
                        fill="#0ea5e9"
                        maxBarSize={46}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <div className={styles.compactThreeCol}>
            <Panel title="AI Summary" subtitle="30 days">
              <div className={styles.miniStatGrid}>
                {aiHighlights.map((item) => (
                  <div key={item.title} className={styles.miniStat}>
                    <span>{item.title}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Top Risk" subtitle="Highest risk score">
              {topRiskCompact.length === 0 ? (
                <EmptyState text="No risk data." />
              ) : (
                <div className={styles.simpleList}>
                  {topRiskCompact.map((item, index) => (
                    <button
                      key={`${item.employeeId}-${index}`}
                      type="button"
                      className={styles.simpleRow}
                      onClick={() => router.push(`/dashboard/employees/${item.employeeId}`)}
                    >
                      <div className={styles.simpleRowLeft}>
                        <span className={styles.simpleIndex}>#{index + 1}</span>
                        <span className={styles.simpleName}>{item.employeeName}</span>
                      </div>
                      <strong className={styles.simpleValue}>{item.riskScore}</strong>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Alerts" subtitle="Important notes">
              {compactAlerts.length === 0 ? (
                <EmptyState text="No alerts." />
              ) : (
                <div className={styles.simpleAlerts}>
                  {compactAlerts.map((alert, index) => (
                    <div key={index} className={styles.simpleAlertItem}>
                      {alert}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <section className={styles.compactActionsSection}>
            <div className={styles.blockTitle}>Quick Actions</div>
            <div className={styles.compactActionsGrid}>
              <QuickLink
                icon={UI_ICONS.employees}
                title="Employees"
                onClick={() => router.push("/dashboard/employees")}
              />
              <QuickLink
                icon={UI_ICONS.attendance}
                title="Attendance"
                onClick={() => router.push("/dashboard/attendance")}
              />
              <QuickLink
                icon={UI_ICONS.branches}
                title="Branches"
                onClick={() => router.push("/dashboard/branches")}
              />
              <QuickLink
                icon={UI_ICONS.devices}
                title="Devices"
                onClick={() => router.push("/dashboard/devices")}
              />
              <QuickLink
                icon={UI_ICONS.payroll}
                title="Payroll"
                onClick={() => router.push("/dashboard/payroll")}
              />
              <QuickLink
                icon={UI_ICONS.settings}
                title="Settings"
                onClick={() => router.push("/dashboard/settings")}
              />
            </div>
          </section>

          <section className={styles.footerMeta}>
            <span>Last update</span>
            <strong>{formatDateTime(executive?.meta?.generatedAt)}</strong>
          </section>
        </div>

        <GeneralStatsCard executive={executive} ai={ai} extraStats={extraStats} />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>{title}</div>
        {subtitle ? <div className={styles.panelSubtitle}>{subtitle}</div> : null}
      </div>
      {children}
    </section>
  );
}

function CompactStatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className={styles.compactStatCard}>
      <div className={styles.compactStatTitle}>{title}</div>
      <div className={styles.compactStatValue}>{value}</div>
      <div className={styles.compactStatNote}>{note}</div>
    </div>
  );
}

function QuickLink({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.compactActionCard} onClick={onClick}>
      <div className={styles.compactActionIcon}>{icon}</div>
      <div className={styles.compactActionTitle}>{title}</div>
    </button>
  );
}

function GeneralStatsCard({
  executive,
  ai,
  extraStats,
}: {
  executive: ExecutiveDashboardResponse | null;
  ai: AiInsightsResponse | null;
  extraStats: DashboardExtraStats;
}) {
  const leftStats = [
    {
      label: "Employees",
      value: executive?.kpis?.totalEmployees ?? 0,
      icon: UI_ICONS.employees,
    },
    {
      label: "New Joins (7d)",
      value: extraStats.newJoins7d,
      icon: UI_ICONS.newJoins,
    },
    {
      label: "Resigned",
      value: extraStats.resignedCount,
      icon: UI_ICONS.resigned,
    },
    {
      label: "Devices",
      value: extraStats.devicesCount,
      icon: UI_ICONS.devices,
    },
    {
      label: "Verified",
      value: extraStats.verifiedCount,
      icon: UI_ICONS.verified,
    },
  ];

  const rightStats = [
    {
      label: "Present",
      value: executive?.meta?.presentToday ?? 0,
      icon: UI_ICONS.present,
    },
    {
      label: "Absent",
      value: executive?.meta?.absentToday ?? 0,
      icon: UI_ICONS.absent,
    },
    {
      label: "Late Arrival",
      value: ai?.summary?.totalLateIncidents ?? 0,
      icon: UI_ICONS.late,
    },
    {
      label: "Early Departure",
      value: extraStats.earlyDepartureToday,
      icon: UI_ICONS.earlyDeparture,
    },
    {
      label: "On Leave",
      value: extraStats.onLeaveToday,
      icon: UI_ICONS.onLeave,
    },
  ];

  return (
    <aside className={styles.generalCard}>
      <div className={styles.generalHeader}>
        <div className={styles.generalHeaderIcon}>{UI_ICONS.generalStats}</div>
        <div className={styles.generalHeaderText}>General Statistics</div>
      </div>

      <div className={styles.generalTwoCols}>
        <div className={styles.generalColumn}>
          {leftStats.map((item) => (
            <div key={item.label} className={styles.generalItem}>
              <div className={styles.generalLeft}>
                <div className={styles.generalCircle}>{item.icon}</div>
                <span className={styles.generalLabel}>{item.label}</span>
              </div>
              <strong className={styles.generalValue}>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className={styles.generalColumn}>
          {rightStats.map((item) => (
            <div key={item.label} className={styles.generalItem}>
              <div className={styles.generalLeft}>
                <div className={styles.generalCircle}>{item.icon}</div>
                <span className={styles.generalLabel}>{item.label}</span>
              </div>
              <strong className={styles.generalValue}>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}
