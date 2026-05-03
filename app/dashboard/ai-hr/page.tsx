"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatDateSafe } from "@/lib/date";
import { withSearch } from "@/lib/navigation";
import { toFiniteNumber } from "@/lib/number";
import { sanitizeUiText as sanitizeAppText } from "@/lib/ui-text";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";
import styles from "./ai-hr-page.module.css";

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
  topLateEmployees: RankedEmployee[];
  topAbsentEmployees: RankedEmployee[];
  topMissingPunchEmployees: RankedEmployee[];
  topRiskEmployees: RankedEmployee[];
  alerts: string[];
};

type InsightItem = {
  label: string;
  value: string | number;
  tone: "neutral" | "good" | "warn" | "danger";
};

type RecommendationItem = {
  title: string;
  text: string;
  tone: "good" | "warn" | "danger" | "neutral";
};

type PeriodOption = 7 | 30 | 90;
type LoadAiHrOptions = {
  showRefresh?: boolean;
  silent?: boolean;
};

function formatDate(value?: string | null) {
  return formatDateSafe(value, "--");
}

function getRiskLevel(score?: number) {
  const value = toFiniteNumber(score);
  if (value >= 80) return "High";
  if (value >= 50) return "Medium";
  return "Low";
}

function getRiskTone(score?: number) {
  const value = toFiniteNumber(score);
  if (value >= 80) return styles.riskHigh;
  if (value >= 50) return styles.riskMedium;
  return styles.riskLow;
}

function getInitials(name?: string | null) {
  const text = String(name || "").trim();
  if (!text) return "NA";

  const parts = text.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function sanitizeUiText(value: string) {
  return sanitizeAppText(value);
}

export default function AIHRDashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<AIHRResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(30);

  const load = useCallback(
    async (period: PeriodOption, options: LoadAiHrOptions = {}) => {
      const { showRefresh = false, silent = false } = options;

      try {
        if (showRefresh && !silent) setRefreshing(true);
        else if (!showRefresh) setLoading(true);

        if (!silent) setMessage("");

        let res: AIHRResponse;

        try {
          res = await apiRequest<AIHRResponse>(
            withSearch("/dashboard/ai-hr", { days: period }),
            {
              method: "GET",
              auth: true,
            },
          );
        } catch {
          res = await apiRequest<AIHRResponse>("/dashboard/ai-hr", {
            method: "GET",
            auth: true,
          });
        }

        setData(res);
      } catch (e) {
        const errorMessage = getErrorMessage(e, "Failed to load AI HR dashboard");

        if (handleAuthError(e, router)) return;

        if (!silent) {
          setMessage(errorMessage);
        }
      } finally {
        setLoading(false);
        if (showRefresh && !silent) {
          setRefreshing(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    void load(selectedPeriod);
  }, [load, selectedPeriod]);

  const handleSilentRefresh = useCallback(() => {
    void load(selectedPeriod, { showRefresh: true, silent: true });
  }, [load, selectedPeriod]);

  useVisibilityPolling({
    intervalMs: 30000,
    onPoll: handleSilentRefresh,
  });

  const riskDistribution = useMemo(() => {
    const source = data?.topRiskEmployees || [];

    let low = 0;
    let medium = 0;
    let high = 0;

    for (const item of source) {
      const risk = toFiniteNumber(item.riskScore);
      if (risk >= 80) high += 1;
      else if (risk >= 50) medium += 1;
      else low += 1;
    }

    return [
      { label: "Low", value: low },
      { label: "Medium", value: medium },
      { label: "High", value: high },
    ];
  }, [data]);

  const attendanceRiskScatter = useMemo(() => {
    return (data?.topRiskEmployees || []).map((item) => ({
      name: item.employeeName,
      attendance: item.attendanceRate,
      risk: item.riskScore,
      size: Math.max(8, item.absentCount + item.lateCount + item.missingPunchCount),
    }));
  }, [data]);

  const topInsights = useMemo<InsightItem[]>(() => {
    const attendanceRate = data?.summary?.companyAttendanceRate ?? 0;
    const lateIncidents = data?.summary?.totalLateIncidents ?? 0;
    const absentIncidents = data?.summary?.totalAbsentIncidents ?? 0;
    const missingPunch = data?.summary?.totalMissingPunchIncidents ?? 0;
    const highestRisk = data?.topRiskEmployees?.[0]?.riskScore ?? 0;

    return [
      {
        label: "Attendance Health",
        value: `${attendanceRate}%`,
        tone: attendanceRate >= 90 ? "good" : attendanceRate >= 75 ? "warn" : "danger",
      },
      {
        label: "Highest Risk Score",
        value: highestRisk,
        tone: highestRisk >= 80 ? "danger" : highestRisk >= 50 ? "warn" : "good",
      },
      {
        label: "Late Pressure",
        value: lateIncidents,
        tone: lateIncidents >= 20 ? "danger" : lateIncidents >= 10 ? "warn" : "neutral",
      },
      {
        label: "Absence Pressure",
        value: absentIncidents,
        tone: absentIncidents >= 15 ? "danger" : absentIncidents >= 8 ? "warn" : "neutral",
      },
      {
        label: "Missing Punch Load",
        value: missingPunch,
        tone: missingPunch >= 10 ? "danger" : missingPunch >= 5 ? "warn" : "neutral",
      },
    ];
  }, [data]);

  const recommendations = useMemo<RecommendationItem[]>(() => {
    if (!data) return [];

    const items: RecommendationItem[] = [];
    const attendanceRate = data.summary.companyAttendanceRate;
    const lateIncidents = data.summary.totalLateIncidents;
    const absentIncidents = data.summary.totalAbsentIncidents;
    const missingPunch = data.summary.totalMissingPunchIncidents;
    const topRisk = data.topRiskEmployees[0];
    const topLate = data.topLateEmployees[0];

    if (attendanceRate < 80) {
      items.push({
        title: "Urgent attendance review",
        text: "Overall attendance is below target. Review branch-level discipline and late start patterns.",
        tone: "danger",
      });
    } else if (attendanceRate < 90) {
      items.push({
        title: "Stabilize attendance performance",
        text: "Attendance is acceptable but not strong. Target teams with repeated delay and absence behavior.",
        tone: "warn",
      });
    } else {
      items.push({
        title: "Maintain current attendance quality",
        text: "Attendance is in a healthy range. Focus on preventing isolated risk cases from growing.",
        tone: "good",
      });
    }

    if (lateIncidents > absentIncidents && lateIncidents > 0) {
      items.push({
        title: "Lateness is the primary issue",
        text: "The main pressure comes from repeated lateness. Shift start enforcement should be prioritized.",
        tone: "warn",
      });
    }

    if (missingPunch > 0) {
      items.push({
        title: "Reduce punch inconsistencies",
        text: "Missing punch incidents suggest either process gaps or device behavior that needs attention.",
        tone: "neutral",
      });
    }

    if (topRisk) {
      items.push({
        title: "Review highest-risk employee cluster",
        text: `${topRisk.employeeName} leads the risk list. Use this case to detect repeated patterns across similar employees.`,
        tone: topRisk.riskScore >= 80 ? "danger" : "warn",
      });
    }

    if (topLate && topLate.lateMinutes > 0) {
      items.push({
        title: "Target cumulative late minutes",
        text: `${topLate.employeeName} shows the heaviest lateness accumulation. Coaching or schedule review may help.`,
        tone: "warn",
      });
    }

    return items.slice(0, 4);
  }, [data]);

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingBox}>Loading AI HR dashboard...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroKicker}>NexaHR Intelligence</div>
          <h1 className={styles.heroTitle}>AI HR Dashboard</h1>
          <p className={styles.heroSub}>
            Smart attendance insights, workforce risks, employee behavior trends,
            and decision-ready HR analytics.
          </p>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => router.push("/dashboard/employees")}
            >
              Open Employees
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void load(selectedPeriod, { showRefresh: true })}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.periodCard}>
            <span>Analysis Window</span>
            <strong>
              {formatDate(data?.summary?.periodStart)} - {formatDate(data?.summary?.periodEnd)}
            </strong>
          </div>

          <div
            className={`${styles.riskBadge} ${getRiskTone(
              100 - (data?.summary?.companyAttendanceRate ?? 0),
            )}`}
          >
            {getRiskLevel(100 - (data?.summary?.companyAttendanceRate ?? 0))} Risk
          </div>
        </div>
      </section>

      {message ? <div className={styles.alert}>{message}</div> : null}

      <section className={styles.periodFilterWrap}>
        <div className={styles.periodFilterLabel}>Analysis Period</div>
        <div className={styles.periodFilterGroup}>
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              type="button"
              className={`${styles.periodChip} ${
                selectedPeriod === period ? styles.periodChipActive : ""
              }`}
              onClick={() => setSelectedPeriod(period as PeriodOption)}
            >
              Last {period} Days
            </button>
          ))}
        </div>
      </section>

      <section className={styles.insightStrip}>
        {topInsights.map((item) => (
          <div
            key={item.label}
            className={`${styles.insightPill} ${
              item.tone === "good"
                ? styles.insightGood
                : item.tone === "warn"
                ? styles.insightWarn
                : item.tone === "danger"
                ? styles.insightDanger
                : styles.insightNeutral
            }`}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>

      <section className={styles.kpiGrid}>
        <KpiCard
          title="Employees Analyzed"
          value={data?.summary?.employeesAnalyzed ?? 0}
          note="Coverage across the analysis period"
        />
        <KpiCard
          title="Attendance Rate"
          value={`${data?.summary?.companyAttendanceRate ?? 0}%`}
          note="Overall company attendance"
        />
        <KpiCard
          title="Late Incidents"
          value={data?.summary?.totalLateIncidents ?? 0}
          note="Detected lateness in the period"
        />
        <KpiCard
          title="Absent Incidents"
          value={data?.summary?.totalAbsentIncidents ?? 0}
          note="Recorded absence cases"
        />
        <KpiCard
          title="Missing Punch"
          value={data?.summary?.totalMissingPunchIncidents ?? 0}
          note="Punch inconsistencies found"
        />
      </section>

      <div className={styles.topLayout}>
        <Panel title="Smart Alerts" subtitle="Priority HR signals generated by AI">
          {data?.alerts?.length ? (
            <div className={styles.alertList}>
              {data.alerts.map((item, index) => (
                <div key={`${item}-${index}`} className={styles.smartAlert}>
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No alerts available." />
          )}
        </Panel>

        <Panel title="Risk Score Distribution" subtitle="Top risk employees grouped by severity">
          {riskDistribution.every((item) => item.value === 0) ? (
            <EmptyState text="No risk distribution data." />
          ) : (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={riskDistribution}
                  margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.16)" />
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
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#6366f1" maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="AI Recommendations"
        subtitle="Practical actions inferred from current attendance behavior"
      >
        {recommendations.length ? (
          <div className={styles.recommendationsGrid}>
            {recommendations.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className={`${styles.recommendationCard} ${
                  item.tone === "good"
                    ? styles.recommendationGood
                    : item.tone === "warn"
                    ? styles.recommendationWarn
                    : item.tone === "danger"
                    ? styles.recommendationDanger
                    : styles.recommendationNeutral
                }`}
              >
                <div className={styles.recommendationTitle}>{item.title}</div>
                <div className={styles.recommendationText}>{item.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No recommendations available." />
        )}
      </Panel>

      <Panel
        title="Attendance vs Risk"
        subtitle="Higher risk usually aligns with weaker attendance outcomes"
      >
        {attendanceRiskScatter.length ? (
          <div className={styles.chartWrapLarge}>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.16)" />
                <XAxis
                  type="number"
                  dataKey="attendance"
                  name="Attendance"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="risk"
                  name="Risk"
                  domain={[0, 100]}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="size" range={[80, 420]} />
                <Tooltip
                  cursor={{ strokeDasharray: "4 4" }}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(19, 24, 34, 0.88)",
                    color: "#fff",
                    backdropFilter: "blur(12px)",
                  }}
                />
                <Scatter data={attendanceRiskScatter} fill="#0ea5e9" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="No employee scatter data available." />
        )}
      </Panel>

      <div className={styles.listGrid}>
        <Panel title="Top Late Employees" subtitle="Most repeated lateness in the period">
          <EmployeeRankList
            items={data?.topLateEmployees || []}
            meta={(e) => `Late days: ${e.lateCount} \u2022 Late minutes: ${e.lateMinutes}`}
            router={router}
          />
        </Panel>

        <Panel title="Top Absent Employees" subtitle="Most absence cases in the period">
          <EmployeeRankList
            items={data?.topAbsentEmployees || []}
            meta={(e) => `Absences: ${e.absentCount} \u2022 Attendance: ${e.attendanceRate}%`}
            router={router}
          />
        </Panel>

        <Panel title="Top Missing Punch" subtitle="Highest punch inconsistency cases">
          <EmployeeRankList
            items={data?.topMissingPunchEmployees || []}
            meta={(e) =>
              `Missing punch: ${e.missingPunchCount} \u2022 Records: ${e.totalRecords}`
            }
            router={router}
          />
        </Panel>

        <Panel title="Top Risk Employees" subtitle="Highest AI risk score">
          <EmployeeRankList
            items={data?.topRiskEmployees || []}
            meta={(e) => `Risk score: ${e.riskScore} \u2022 Attendance: ${e.attendanceRate}%`}
            router={router}
          />
        </Panel>
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

function KpiCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiTitle}>{title}</div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiNote}>{note}</div>
    </div>
  );
}

function EmployeeRankList({
  items,
  meta,
  router,
}: {
  items: RankedEmployee[];
  meta: (item: RankedEmployee) => string;
  router: ReturnType<typeof useRouter>;
}) {
  if (!items.length) {
    return <EmptyState text="No data available." />;
  }

  return (
    <div className={styles.rankList}>
      {items.map((employee, index) => (
        <button
          key={`${employee.employeeId}-${index}`}
          type="button"
          className={styles.rankCard}
          onClick={() => router.push(`/dashboard/employees/${employee.employeeId}`)}
        >
          <div className={styles.avatarBadge}>{getInitials(employee.employeeName)}</div>

          <div className={styles.rankBody}>
            <div className={styles.rankTopRow}>
              <div className={styles.rankTitle}>{employee.employeeName}</div>
              <div className={styles.rankPosition}>#{index + 1}</div>
            </div>
            <div className={styles.rankText}>{sanitizeUiText(meta(employee))}</div>
          </div>

          <div className={`${styles.rankRisk} ${getRiskTone(employee.riskScore)}`}>
            {employee.riskScore}
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}
