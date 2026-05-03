"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatDateTimeSafe } from "@/lib/date";
import { withSearch } from "@/lib/navigation";

type Device = {
  id: number;
  name: string;
  status?: string | null;
  deviceType?: string | null;
  connectionMode?: string | null;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  branch?: {
    id: number;
    name: string;
  } | null;
};

type SyncHistoryItem = {
  id: number;
  companyId: string;
  deviceId: number;
  startedAt: string;
  finishedAt?: string | null;
  status: string;
  receivedCount: number;
  insertedCount: number;
  duplicateCount: number;
  failedCount: number;
  triggeredBy?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
};

type FailedRawLog = {
  id: number;
  deviceId: number;
  status: string;
  errorMessage?: string | null;
  logTime: string;
  externalUserId?: string | null;
  externalEmployeeCode?: string | null;
};

type MonitoringOverviewResponse = {
  kpis: {
    totalDevices: number;
    activeDevices: number;
    errorDevices: number;
    totalPendingLogs: number;
    totalFailedLogs: number;
    totalProcessedLogs: number;
  };
  latestSyncs: SyncHistoryItem[];
};

type FailuresResponse = {
  failedSyncs: SyncHistoryItem[];
  failedLogs: FailedRawLog[];
};

type UnprocessedCountResponse = {
  pending: number;
  skipped: number;
  duplicates: number;
  totalUnresolved: number;
};

export default function DeviceCommandCenterPage() {
  const router = useRouter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [overview, setOverview] = useState<MonitoringOverviewResponse | null>(null);
  const [failures, setFailures] = useState<FailuresResponse | null>(null);
  const [unprocessed, setUnprocessed] = useState<UnprocessedCountResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [processingPending, setProcessingPending] = useState(false);

  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const loadPage = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setMessage("");
      setError("");

      const [devicesData, overviewData, failuresData, unprocessedData] =
        await Promise.all([
          apiRequest<Device[]>("/devices", {
            method: "GET",
            auth: true,
          }).catch(() => []),
          apiRequest<MonitoringOverviewResponse>("/devices/monitoring/overview", {
            method: "GET",
            auth: true,
          }).catch(() => null),
          apiRequest<FailuresResponse>("/devices/monitoring/failures", {
            method: "GET",
            auth: true,
          }).catch(() => ({ failedSyncs: [], failedLogs: [] })),
          apiRequest<UnprocessedCountResponse>("/devices/monitoring/unprocessed-count", {
            method: "GET",
            auth: true,
          }).catch(() => ({
            pending: 0,
            skipped: 0,
            duplicates: 0,
            totalUnresolved: 0,
          })),
        ]);

      setDevices(Array.isArray(devicesData) ? devicesData : []);
      setOverview(overviewData || null);
      setFailures(
        failuresData || {
          failedSyncs: [],
          failedLogs: [],
        },
      );
      setUnprocessed(
        unprocessedData || {
          pending: 0,
          skipped: 0,
          duplicates: 0,
          totalUnresolved: 0,
        },
      );
    } catch (err) {
      const errorMessage = getErrorMessage(
        err,
        "Failed to load devices command center.",
      );

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const deviceStats = useMemo(() => {
    let inactiveDevices = 0;

    for (const device of devices) {
      const status = String(device.status || "").toUpperCase();
      if (status !== "ACTIVE" && status !== "ERROR") {
        inactiveDevices += 1;
      }
    }

    return {
      totalDevices: overview?.kpis?.totalDevices ?? devices.length,
      activeDevices: overview?.kpis?.activeDevices ?? 0,
      errorDevices: overview?.kpis?.errorDevices ?? 0,
      inactiveDevices,
      pendingLogs: overview?.kpis?.totalPendingLogs ?? 0,
      failedLogs: overview?.kpis?.totalFailedLogs ?? 0,
      processedLogs: overview?.kpis?.totalProcessedLogs ?? 0,
      unresolved: unprocessed?.totalUnresolved ?? 0,
      skipped: unprocessed?.skipped ?? 0,
      duplicates: unprocessed?.duplicates ?? 0,
    };
  }, [devices, overview, unprocessed]);

  const topProblemDevices = useMemo(() => {
    return devices
      .filter((device) => String(device.status || "").toUpperCase() === "ERROR")
      .slice(0, 6);
  }, [devices]);

  const latestSyncs = useMemo(() => {
    return overview?.latestSyncs?.slice(0, 8) || [];
  }, [overview]);

  const failedSyncs = useMemo(() => {
    return failures?.failedSyncs?.slice(0, 6) || [];
  }, [failures]);

  const failedLogs = useMemo(() => {
    return failures?.failedLogs?.slice(0, 8) || [];
  }, [failures]);

  const syncAllDevices = async () => {
    try {
      setSyncingAll(true);
      setMessage("");
      setError("");

      await apiRequest("/devices/sync-all", {
        method: "POST",
        auth: true,
      });

      setMessage("All active devices synced successfully.");
      await loadPage(true);
    } catch (err) {
      const errorMessage = getErrorMessage(err, "Failed to sync all devices.");

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    } finally {
      setSyncingAll(false);
    }
  };

  const processPendingLogs = async () => {
    try {
      setProcessingPending(true);
      setMessage("");
      setError("");

      await apiRequest(withSearch("/devices/process/pending", { limit: 500 }), {
        method: "POST",
        auth: true,
      });

      setMessage("Pending device logs processed successfully.");
      await loadPage(true);
    } catch (err) {
      const errorMessage = getErrorMessage(
        err,
        "Failed to process pending logs.",
      );

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    } finally {
      setProcessingPending(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    return formatDateTimeSafe(value, "--");
  };

  if (loading) {
    return <div style={styles.loading}>Loading devices command center...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.kicker}>Devices Operations</div>
          <h1 style={styles.title}>Devices Command Center</h1>
          <p style={styles.subtitle}>
            Monitor device health, manage sync operations, process pending logs,
            review failures, and move quickly across the entire devices workflow.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => loadPage(true)}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={processPendingLogs}
            disabled={processingPending}
          >
            {processingPending ? "Processing..." : "Process Pending"}
          </button>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={syncAllDevices}
            disabled={syncingAll}
          >
            {syncingAll ? "Syncing..." : "Sync All Devices"}
          </button>
        </div>
      </div>

      {message ? <div style={styles.successBox}>{message}</div> : null}
      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.statsGrid}>
        <MetricCard label="Total Devices" value={deviceStats.totalDevices} tone="primary" />
        <MetricCard label="Active Devices" value={deviceStats.activeDevices} tone="success" />
        <MetricCard label="Inactive Devices" value={deviceStats.inactiveDevices} tone="default" />
        <MetricCard label="Error Devices" value={deviceStats.errorDevices} tone="danger" />
        <MetricCard label="Pending Logs" value={deviceStats.pendingLogs} tone="warning" />
        <MetricCard label="Processed Logs" value={deviceStats.processedLogs} tone="success" />
        <MetricCard label="Failed Logs" value={deviceStats.failedLogs} tone="danger" />
        <MetricCard label="Unresolved" value={deviceStats.unresolved} tone="danger" />
        <MetricCard label="Skipped" value={deviceStats.skipped} tone="warning" />
        <MetricCard label="Duplicates" value={deviceStats.duplicates} tone="default" />
      </div>

      <section style={styles.quickActionsSection}>
        <ActionCard
          icon="📡"
          title="Devices"
          text="Manage devices, edit connection settings, and review device status."
          onClick={() => router.push("/dashboard/devices")}
        />
        <ActionCard
          icon="🧾"
          title="Device Logs"
          text="Inspect raw logs, payloads, and processing state."
          onClick={() => router.push("/dashboard/device-logs")}
        />
        <ActionCard
          icon="🔗"
          title="Device Mappings"
          text="Map external users and employee codes to internal employees."
          onClick={() => router.push("/dashboard/device-mappings")}
        />
        <ActionCard
          icon="📈"
          title="Device Monitoring"
          text="Review sync health, failed logs, and overall device visibility."
          onClick={() => router.push("/dashboard/device-monitoring")}
        />
      </section>

      <div style={styles.mainGrid}>
        <PanelCard
          title="Latest Sync Activity"
          subtitle="Most recent sync operations across devices."
        >
          {latestSyncs.length === 0 ? (
            <div style={styles.emptyState}>No recent sync activity found.</div>
          ) : (
            <div style={styles.list}>
              {latestSyncs.map((sync) => (
                <div key={sync.id} style={styles.listCard}>
                  <div style={styles.listTopRow}>
                    <div style={styles.listTitle}>
                      Device #{sync.deviceId}
                      <span
                        style={{
                          ...styles.badge,
                          ...(sync.status === "SUCCESS"
                            ? styles.badgeSuccess
                            : sync.status === "FAILED"
                              ? styles.badgeDanger
                              : sync.status === "PARTIAL"
                                ? styles.badgeWarning
                                : styles.badgeNeutral),
                        }}
                      >
                        {sync.status}
                      </span>
                    </div>
                    <div style={styles.listMeta}>
                      Started: {formatDateTime(sync.startedAt)}
                    </div>
                  </div>

                  <div style={styles.metricsInline}>
                    <MiniMetric label="Received" value={sync.receivedCount} />
                    <MiniMetric label="Inserted" value={sync.insertedCount} />
                    <MiniMetric label="Duplicates" value={sync.duplicateCount} />
                    <MiniMetric label="Failed" value={sync.failedCount} />
                  </div>

                  <div style={styles.listSubMeta}>
                    Finished: {formatDateTime(sync.finishedAt)} {"\u2022"} Triggered by:{" "}
                    {sync.triggeredBy || "-"}
                  </div>

                  {sync.errorMessage ? (
                    <div style={styles.inlineError}>{sync.errorMessage}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Devices Requiring Attention"
          subtitle="Devices currently in error status."
        >
          {topProblemDevices.length === 0 ? (
            <div style={styles.emptyState}>No device errors found.</div>
          ) : (
            <div style={styles.list}>
              {topProblemDevices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  style={styles.clickableCard}
                  onClick={() => router.push("/dashboard/devices")}
                >
                  <div style={styles.deviceCardHeader}>
                    <div style={styles.deviceCardTitle}>{device.name}</div>
                    <span style={{ ...styles.badge, ...styles.badgeDanger }}>
                      {device.status || "ERROR"}
                    </span>
                  </div>

                  <div style={styles.deviceCardText}>
                    Type: {device.deviceType || "-"} {"\u2022"} Mode: {device.connectionMode || "-"}
                  </div>

                  <div style={styles.deviceCardText}>
                    Last Sync: {formatDateTime(device.lastSyncAt)}
                  </div>

                  <div style={styles.deviceCardText}>
                    Last Seen: {formatDateTime(device.lastSeenAt)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <div style={styles.mainGrid}>
        <PanelCard
          title="Failed Syncs"
          subtitle="Latest sync failures that need inspection."
        >
          {failedSyncs.length === 0 ? (
            <div style={styles.emptyState}>No failed syncs found.</div>
          ) : (
            <div style={styles.list}>
              {failedSyncs.map((sync) => (
                <button
                  key={sync.id}
                  type="button"
                  style={styles.clickableCard}
                  onClick={() => router.push("/dashboard/device-monitoring")}
                >
                  <div style={styles.deviceCardHeader}>
                    <div style={styles.deviceCardTitle}>Device #{sync.deviceId}</div>
                    <span style={{ ...styles.badge, ...styles.badgeDanger }}>
                      {sync.status}
                    </span>
                  </div>

                  <div style={styles.deviceCardText}>
                    Started: {formatDateTime(sync.startedAt)}
                  </div>

                  <div style={styles.deviceCardText}>
                    Finished: {formatDateTime(sync.finishedAt)}
                  </div>

                  <div style={styles.inlineError}>
                    {sync.errorMessage || "Unknown sync error"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Failed Raw Logs"
          subtitle="Latest raw logs that failed processing."
        >
          {failedLogs.length === 0 ? (
            <div style={styles.emptyState}>No failed raw logs found.</div>
          ) : (
            <div style={styles.list}>
              {failedLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  style={styles.clickableCard}
                  onClick={() => router.push("/dashboard/device-logs")}
                >
                  <div style={styles.deviceCardHeader}>
                    <div style={styles.deviceCardTitle}>Raw Log #{log.id}</div>
                    <span style={{ ...styles.badge, ...styles.badgeDanger }}>
                      {log.status}
                    </span>
                  </div>

                  <div style={styles.deviceCardText}>
                    Device #{log.deviceId} {"\u2022"} {formatDateTime(log.logTime)}
                  </div>

                  <div style={styles.deviceCardText}>
                    User: {log.externalUserId || "-"} {"\u2022"} Code:{" "}
                    {log.externalEmployeeCode || "-"}
                  </div>

                  <div style={styles.inlineError}>
                    {log.errorMessage || "Processing failed"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <PanelCard
        title="Command Shortcuts"
        subtitle="Fast movement across the devices workflow."
      >
        <div style={styles.shortcutsGrid}>
          <ShortcutButton
            icon="➕"
            label="Add Device"
            onClick={() => router.push("/dashboard/devices")}
          />
          <ShortcutButton
            icon="📡"
            label="Manage Devices"
            onClick={() => router.push("/dashboard/devices")}
          />
          <ShortcutButton
            icon="🧾"
            label="Open Logs"
            onClick={() => router.push("/dashboard/device-logs")}
          />
          <ShortcutButton
            icon="🔗"
            label="Open Mappings"
            onClick={() => router.push("/dashboard/device-mappings")}
          />
          <ShortcutButton
            icon="📈"
            label="Open Monitoring"
            onClick={() => router.push("/dashboard/device-monitoring")}
          />
          <ShortcutButton
            icon="🏠"
            label="Back to Dashboard"
            onClick={() => router.push("/dashboard")}
          />
        </div>
      </PanelCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "danger" | "default";
}) {
  const toneStyle =
    tone === "primary"
      ? styles.metricPrimary
      : tone === "success"
        ? styles.metricSuccess
        : tone === "warning"
          ? styles.metricWarning
          : tone === "danger"
            ? styles.metricDanger
            : styles.metricDefault;

  return (
    <div style={{ ...styles.metricCard, ...toneStyle }}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.miniMetric}>
      <div style={styles.miniMetricLabel}>{label}</div>
      <div style={styles.miniMetricValue}>{value}</div>
    </div>
  );
}

const ACTION_ICON_BY_TITLE: Record<string, string> = {
  Devices: "\u{1f4bb}",
  "Device Logs": "\u{1f4dc}",
  "Device Mappings": "\u{1f517}",
  "Device Monitoring": "\u{1f50e}",
};

function ActionCard({
  icon,
  title,
  text,
  onClick,
}: {
  icon: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  const displayIcon = ACTION_ICON_BY_TITLE[title] ?? icon;

  return (
    <button type="button" style={styles.actionCard} onClick={onClick}>
      <div style={styles.actionIcon}>{displayIcon}</div>
      <div>
        <div style={styles.actionTitle}>{title}</div>
        <div style={styles.actionText}>{text}</div>
      </div>
    </button>
  );
}

const SHORTCUT_ICON_BY_LABEL: Record<string, string> = {
  "Add Device": "\u2795",
  "Manage Devices": "\u{1f4bb}",
  "Open Logs": "\u{1f4dc}",
  "Open Mappings": "\u{1f517}",
  "Open Monitoring": "\u{1f50e}",
  "Back to Dashboard": "\u{1f3e0}",
};

function ShortcutButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  const displayIcon = SHORTCUT_ICON_BY_LABEL[label] ?? icon;

  return (
    <button type="button" style={styles.shortcutButton} onClick={onClick}>
      <span style={styles.shortcutIcon}>{displayIcon}</span>
      <span>{label}</span>
    </button>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        <div style={styles.panelSubtitle}>{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    color: "#111827",
  },
  loading: {
    padding: 40,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
    borderRadius: 28,
    padding: 26,
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
  },
  kicker: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 14,
    marginBottom: 0,
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 1.7,
    maxWidth: 760,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 800,
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
  },
  successBox: {
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #a7f3d0",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: 700,
  },
  errorBox: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: 700,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  metricCard: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
    background: "#ffffff",
  },
  metricPrimary: {
    background: "linear-gradient(180deg, #eef2ff 0%, #ffffff 100%)",
  },
  metricSuccess: {
    background: "linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)",
  },
  metricWarning: {
    background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)",
  },
  metricDanger: {
    background: "linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)",
  },
  metricDefault: {
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 10,
  },
  metricValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 900,
  },
  quickActionsSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  actionCard: {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 6,
  },
  actionText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(420px, 1.4fr) minmax(340px, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  panel: {
    borderRadius: 24,
    padding: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15,23,42,0.05)",
  },
  panelHeader: {
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 900,
  },
  panelSubtitle: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 600,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  listCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    background: "#ffffff",
  },
  clickableCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    background: "#ffffff",
    textAlign: "left",
    cursor: "pointer",
  },
  listTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  listTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    color: "#111827",
    fontSize: 15,
    fontWeight: 800,
  },
  listMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  listSubMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    marginTop: 10,
  },
  metricsInline: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  miniMetric: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
  },
  miniMetricLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 6,
  },
  miniMetricValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  badgeSuccess: {
    background: "#dcfce7",
    color: "#166534",
  },
  badgeDanger: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  badgeWarning: {
    background: "#fef3c7",
    color: "#92400e",
  },
  badgeNeutral: {
    background: "#e2e8f0",
    color: "#334155",
  },
  deviceCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  deviceCardTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: 800,
  },
  deviceCardText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.7,
  },
  inlineError: {
    marginTop: 10,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: 700,
  },
  shortcutsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  shortcutButton: {
    border: "1px solid #e2e8f0",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    borderRadius: 16,
    padding: "14px 16px",
    cursor: "pointer",
    fontWeight: 800,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  shortcutIcon: {
    fontSize: 18,
  },
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 16,
    color: "#6b7280",
    textAlign: "center",
    border: "1px dashed #cbd5e1",
  },
};
