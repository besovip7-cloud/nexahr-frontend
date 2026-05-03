"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatDateTimeSafe } from "@/lib/date";
import { withSearch } from "@/lib/navigation";

type RawLog = {
  id: number;
  companyId: string;
  branchId?: number | null;
  deviceId: number;
  externalLogId?: string | null;
  externalEmployeeCode?: string | null;
  externalUserId?: string | null;
  logTime: string;
  punchTypeRaw?: string | null;
  verificationRaw?: string | null;
  source: string;
  status: string;
  normalized: boolean;
  processed: boolean;
  processedAt?: string | null;
  errorMessage?: string | null;
  rawPayload?: unknown;
  createdAt?: string;
};

type Device = {
  id: number;
  name: string;
  status?: string | null;
  deviceType?: string | null;
  connectionMode?: string | null;
};

export default function DeviceLogsPage() {
  return (
    <Suspense fallback={<div style={styles.loading}>Loading device logs...</div>}>
      <DeviceLogsPageContent />
    </Suspense>
  );
}

function DeviceLogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedDeviceId = searchParams.get("deviceId") || "";

  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<RawLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [processingAll, setProcessingAll] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [deviceId, setDeviceId] = useState(preselectedDeviceId);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const pageInitializedRef = useRef(false);
  const skipFirstDeviceRefreshRef = useRef(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    const data = await apiRequest<Device[]>("/devices", {
      method: "GET",
      auth: true,
    });
    setDevices(Array.isArray(data) ? data : []);
  }, []);

  const loadLogs = useCallback(async (selectedDeviceId: string) => {
    setError("");

    if (selectedDeviceId) {
      const data = await apiRequest<RawLog[]>(
        withSearch(`/devices/${selectedDeviceId}/logs`, { take: 500 }),
        {
          method: "GET",
          auth: true,
        },
      );
      setLogs(Array.isArray(data) ? data : []);
      return;
    }

    const data = await apiRequest<RawLog[]>(
      withSearch("/devices/logs/unprocessed", { take: 500 }),
      {
        method: "GET",
        auth: true,
      },
    );
    setLogs(Array.isArray(data) ? data : []);
  }, []);

  const loadPage = useCallback(async (selectedDeviceId: string) => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([loadDevices(), loadLogs(selectedDeviceId)]);
    } catch (err) {
      const errorMessage = getErrorMessage(err, "Failed to load device logs.");

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loadDevices, loadLogs, router]);

  useEffect(() => {
    if (pageInitializedRef.current) {
      return;
    }

    pageInitializedRef.current = true;
    void loadPage(deviceId);
  }, [deviceId, loadPage]);

  useEffect(() => {
    if (skipFirstDeviceRefreshRef.current) {
      skipFirstDeviceRefreshRef.current = false;
      return;
    }

    void loadLogs(deviceId).catch((err) => {
      const errorMessage = getErrorMessage(err, "Failed to refresh logs.");

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    });
  }, [deviceId, loadLogs, router]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesStatus =
        statusFilter === "ALL" || log.status === statusFilter;

      const matchesSearch =
        !term ||
        String(log.id).includes(term) ||
        String(log.deviceId).includes(term) ||
        (log.externalLogId || "").toLowerCase().includes(term) ||
        (log.externalUserId || "").toLowerCase().includes(term) ||
        (log.externalEmployeeCode || "").toLowerCase().includes(term) ||
        (log.punchTypeRaw || "").toLowerCase().includes(term) ||
        (log.source || "").toLowerCase().includes(term) ||
        (log.errorMessage || "").toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [logs, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      pending: logs.filter((x) => x.status === "PENDING").length,
      processed: logs.filter((x) => x.status === "PROCESSED").length,
      failed: logs.filter((x) => x.status === "FAILED").length,
      skipped: logs.filter((x) => x.status === "SKIPPED").length,
      duplicates: logs.filter((x) => x.status === "DUPLICATE").length,
    };
  }, [logs]);

  const currentDevice = useMemo(() => {
    if (!deviceId) return null;
    return devices.find((device) => String(device.id) === deviceId) || null;
  }, [devices, deviceId]);

  const formatDateTime = (value?: string | null) => {
    return formatDateTimeSafe(value, "--");
  };

  const processOne = async (rawLogId: number) => {
    try {
      setProcessingId(rawLogId);
      setMessage("");
      setError("");

      await apiRequest(`/devices/process/${rawLogId}`, {
        method: "POST",
        auth: true,
      });

      setMessage(`Raw log #${rawLogId} processed successfully.`);
      await loadLogs(deviceId);
    } catch (err) {
      const errorMessage = getErrorMessage(
        err,
        `Failed to process raw log #${rawLogId}.`,
      );

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    } finally {
      setProcessingId(null);
    }
  };

  const processPending = async () => {
    try {
      setProcessingAll(true);
      setMessage("");
      setError("");

      await apiRequest(withSearch("/devices/process/pending", { limit: 500 }), {
        method: "POST",
        auth: true,
      });

      setMessage("Pending raw logs processed successfully.");
      await loadLogs(deviceId);
    } catch (err) {
      const errorMessage = getErrorMessage(err, "Failed to process pending logs.");

      if (handleAuthError(err, router)) return;

      setError(errorMessage);
    } finally {
      setProcessingAll(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading device logs...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Raw Logs Pipeline</div>
          <h1 style={styles.title}>Device Logs</h1>
          <p style={styles.subtitle}>
            Inspect raw device logs, review payloads, monitor processing status,
            and resolve pending or failed log entries.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push("/dashboard/device-command-center")}
          >
            Command Center
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push("/dashboard/device-monitoring")}
          >
            Monitoring
          </button>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={processPending}
            disabled={processingAll}
          >
            {processingAll ? "Processing..." : "Process Pending"}
          </button>
        </div>
      </div>

      {message ? <div style={styles.successBox}>{message}</div> : null}
      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.statsGrid}>
        <MetricCard label="Total Logs" value={stats.total} />
        <MetricCard label="Pending" value={stats.pending} />
        <MetricCard label="Processed" value={stats.processed} />
        <MetricCard label="Failed" value={stats.failed} />
        <MetricCard label="Skipped" value={stats.skipped} />
        <MetricCard label="Duplicates" value={stats.duplicates} />
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <select
            style={styles.select}
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">All Unprocessed Logs</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                #{device.id} - {device.name}
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSED">PROCESSED</option>
            <option value="FAILED">FAILED</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="DUPLICATE">DUPLICATE</option>
          </select>

          <input
            style={styles.input}
            placeholder="Search by ID, user, code, error, source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {currentDevice ? (
          <div style={styles.deviceInfoBar}>
            <strong>{currentDevice.name}</strong>
            <span>Type: {currentDevice.deviceType || "--"}</span>
            <span>Mode: {currentDevice.connectionMode || "--"}</span>
            <span>Status: {currentDevice.status || "--"}</span>
          </div>
        ) : null}
      </div>

      <section style={styles.panel}>
        {filteredLogs.length === 0 ? (
          <div style={styles.emptyState}>No logs found.</div>
        ) : (
          <div style={styles.logList}>
            {filteredLogs.map((log) => {
              const expanded = expandedLogId === log.id;

              return (
                <div key={log.id} style={styles.logCard}>
                  <div style={styles.logTopRow}>
                    <div style={styles.logMain}>
                      <div style={styles.logTitle}>
                        Raw Log #{log.id}
                        <span
                          style={{
                            ...styles.badge,
                            ...(log.status === "PROCESSED"
                              ? styles.badgeSuccess
                              : log.status === "FAILED"
                                ? styles.badgeDanger
                                : log.status === "PENDING"
                                  ? styles.badgeWarning
                                  : styles.badgeNeutral),
                          }}
                        >
                          {log.status}
                        </span>
                      </div>

                      <div style={styles.logMeta}>
                        Device #{log.deviceId} {"\u2022"} {formatDateTime(log.logTime)} {"\u2022"}{" "}
                        {log.source}
                      </div>
                    </div>

                    <div style={styles.logActions}>
                      <button
                        type="button"
                        style={styles.actionButton}
                        onClick={() =>
                          setExpandedLogId(expanded ? null : log.id)
                        }
                      >
                        {expanded ? "Hide Payload" : "Show Payload"}
                      </button>

                      {(log.status === "PENDING" ||
                        log.status === "FAILED" ||
                        log.status === "SKIPPED") && (
                        <button
                          type="button"
                          style={styles.primaryButtonDark}
                          onClick={() => processOne(log.id)}
                          disabled={processingId === log.id}
                        >
                          {processingId === log.id ? "Processing..." : "Process"}
                        </button>
                      )}

                      <button
                        type="button"
                        style={styles.secondaryButtonDark}
                        onClick={() =>
                          router.push(
                            withSearch("/dashboard/device-mappings", {
                              deviceId: String(log.deviceId),
                            }),
                          )
                        }
                      >
                        Open Mapping
                      </button>
                    </div>
                  </div>

                  <div style={styles.logGrid}>
                    <InfoItem label="External Log ID" value={log.externalLogId || "--"} />
                    <InfoItem label="External User ID" value={log.externalUserId || "--"} />
                    <InfoItem
                      label="External Employee Code"
                      value={log.externalEmployeeCode || "--"}
                    />
                    <InfoItem label="Punch Type" value={log.punchTypeRaw || "--"} />
                    <InfoItem
                      label="Verification"
                      value={log.verificationRaw || "--"}
                    />
                    <InfoItem
                      label="Processed At"
                      value={formatDateTime(log.processedAt)}
                    />
                  </div>

                  {log.errorMessage ? (
                    <div style={styles.inlineError}>{log.errorMessage}</div>
                  ) : null}

                  {expanded ? (
                    <pre style={styles.payloadBox}>
                      {JSON.stringify(log.rawPayload ?? {}, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
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
  header: {
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
  headerActions: {
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
  primaryButtonDark: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
  },
  secondaryButtonDark: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 800,
  },
  actionButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  metricCard: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
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
  filterCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 1.4fr",
    gap: 12,
  },
  deviceInfoBar: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "12px 14px",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
  },
  logList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  logCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    background: "#ffffff",
  },
  logTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  logMain: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  logTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  logMeta: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
  logActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  logGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  infoItem: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  infoValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  inlineError: {
    marginTop: 14,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: 700,
  },
  payloadBox: {
    marginTop: 14,
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    overflowX: "auto",
    fontSize: 12,
    lineHeight: 1.6,
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
  emptyState: {
    padding: 30,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 600,
  },
};
