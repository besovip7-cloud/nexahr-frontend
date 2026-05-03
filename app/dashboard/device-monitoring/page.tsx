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
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type Device = {
  id: number;
  name: string;
  companyId: string;
  branchId?: number | null;
  serialNumber?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  deviceType?: string | null;
  connectionMode?: string | null;
  status?: string | null;
  timezone?: string | null;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  notes?: string | null;
  branch?: {
    id: number;
    name: string;
  } | null;
};

type RawLog = {
  id: number;
  companyId: string;
  branchId?: number | null;
  deviceId: number;
  externalLogId?: string | null;
  externalEmployeeCode?: string | null;
  externalUserId?: string | null;
  logTime?: string | null;
  punchTypeRaw?: string | null;
  verificationRaw?: string | null;
  source?: string | null;
  rawPayload?: unknown;
  normalized?: boolean;
  processed?: boolean;
  status?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
};

type SyncHistory = {
  id: number;
  companyId: string;
  deviceId: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  status?: string | null;
  triggeredBy?: string | null;
  receivedCount?: number | null;
  insertedCount?: number | null;
  duplicateCount?: number | null;
  failedCount?: number | null;
  errorMessage?: string | null;
  createdAt?: string | null;
};

function DeviceMonitoringFallback() {
  return (
    <div style={styles.page}>
      <PageHeader
        title="Device Monitoring"
        subtitle="Monitor raw logs, sync history, and device activity across your biometric infrastructure."
      />

      <SectionCard title="Status">
        <div style={styles.muted}>Loading device monitoring...</div>
      </SectionCard>
    </div>
  );
}

export default function DeviceMonitoringPage() {
  return (
    <Suspense fallback={<DeviceMonitoringFallback />}>
      <DeviceMonitoringPageContent />
    </Suspense>
  );
}

function DeviceMonitoringPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialDeviceId = searchParams.get("deviceId") || "";

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDeviceId);

  const [deviceLogs, setDeviceLogs] = useState<RawLog[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [unprocessedLogs, setUnprocessedLogs] = useState<RawLog[]>([]);

  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const initializedRef = useRef(false);

  const loadDevices = useCallback(async (currentSelectedDeviceId: string) => {
    try {
      setLoadingDevices(true);
      setError("");

      const [devicesRes, unprocessedRes] = await Promise.all([
        apiRequest("/devices", { auth: true }),
        apiRequest(withSearch("/devices/raw-logs/unprocessed", { take: 500 }), {
          auth: true,
        }),
      ]);

      const devicesList = Array.isArray(devicesRes) ? devicesRes : [];
      setDevices(devicesList);
      setUnprocessedLogs(Array.isArray(unprocessedRes) ? unprocessedRes : []);

      if (!currentSelectedDeviceId && devicesList.length > 0) {
        setSelectedDeviceId(String(devicesList[0].id));
      }
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to load device monitoring page."));
    } finally {
      setLoadingDevices(false);
    }
  }, [router]);

  const loadDeviceDetails = useCallback(async (deviceId: string) => {
    try {
      setLoadingDetails(true);
      setError("");

      const [logsRes, historyRes] = await Promise.all([
        apiRequest(withSearch(`/devices/${deviceId}/logs`, { take: 200 }), {
          auth: true,
        }),
        apiRequest(`/devices/${deviceId}/sync-history`, { auth: true }),
      ]);

      setDeviceLogs(Array.isArray(logsRes) ? logsRes : []);
      setSyncHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to load selected device details."));
    } finally {
      setLoadingDetails(false);
    }
  }, [router]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void loadDevices(selectedDeviceId);
  }, [loadDevices, selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setDeviceLogs([]);
      setSyncHistory([]);
      return;
    }

    void loadDeviceDetails(selectedDeviceId);
  }, [loadDeviceDetails, selectedDeviceId]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setMessage("");
      setError("");

      await loadDevices(selectedDeviceId);

      if (selectedDeviceId) {
        await loadDeviceDetails(selectedDeviceId);
      }

      setMessage("Monitoring data refreshed successfully.");
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to refresh monitoring data."));
    } finally {
      setRefreshing(false);
    }
  }

  const selectedDevice = useMemo(() => {
    return devices.find((item) => String(item.id) === String(selectedDeviceId)) || null;
  }, [devices, selectedDeviceId]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return deviceLogs.filter((log) => {
      if (!keyword) return true;

      return (
        String(log.id).toLowerCase().includes(keyword) ||
        (log.externalUserId || "").toLowerCase().includes(keyword) ||
        (log.externalEmployeeCode || "").toLowerCase().includes(keyword) ||
        (log.punchTypeRaw || "").toLowerCase().includes(keyword) ||
        (log.verificationRaw || "").toLowerCase().includes(keyword) ||
        (log.status || "").toLowerCase().includes(keyword) ||
        (log.source || "").toLowerCase().includes(keyword) ||
        (log.errorMessage || "").toLowerCase().includes(keyword)
      );
    });
  }, [deviceLogs, search]);

  const selectedDeviceUnprocessedCount = useMemo(() => {
    if (!selectedDeviceId) return 0;

    return unprocessedLogs.filter(
      (log) => String(log.deviceId) === String(selectedDeviceId),
    ).length;
  }, [selectedDeviceId, unprocessedLogs]);

  const counters = useMemo(() => {
    const totalLogs = deviceLogs.length;
    const processed = deviceLogs.filter((x) => x.processed).length;
    const pending = deviceLogs.filter((x) => !x.processed).length;
    const errors = deviceLogs.filter(
      (x) =>
        x.status === "FAILED" ||
        x.status === "ERROR" ||
        Boolean(x.errorMessage),
    ).length;

    return {
      totalLogs,
      processed,
      pending,
      errors,
    };
  }, [deviceLogs]);

  function formatDateTime(value?: string | null) {
    return formatDateTimeSafe(value, "-");
  }

  function formatDuration(start?: string | null, end?: string | null) {
    if (!start || !end) return "-";

    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();

    if (Number.isNaN(startDate) || Number.isNaN(endDate)) return "-";

    const seconds = Math.max(0, Math.floor((endDate - startDate) / 1000));

    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;

    if (minutes < 60) return `${minutes}m ${remSeconds}s`;

    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;

    return `${hours}h ${remMinutes}m`;
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Device Monitoring"
        subtitle="Monitor raw logs, sync history, and device activity across your biometric infrastructure."
      />

      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            style={styles.select}
          >
            <option value="">Select device</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
                {device.branch?.name ? ` \u2022 ${device.branch.name}` : ""}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search raw logs..."
            style={styles.input}
          />
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          style={styles.primaryButton}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      {loadingDevices ? (
        <SectionCard title="Status">
          <div style={styles.muted}>Loading devices...</div>
        </SectionCard>
      ) : (
        <>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Devices</div>
              <div style={styles.statValue}>{devices.length}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Selected Device Logs</div>
              <div style={styles.statValue}>{counters.totalLogs}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Processed Logs</div>
              <div style={styles.statValue}>{counters.processed}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Pending Logs</div>
              <div style={styles.statValue}>{counters.pending}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Selected Device Unprocessed</div>
              <div style={styles.statValue}>{selectedDeviceUnprocessedCount}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Logs With Errors</div>
              <div style={styles.statValue}>{counters.errors}</div>
            </div>
          </div>

          <div style={styles.grid}>
            <SectionCard title="Selected Device Overview">
              {!selectedDevice ? (
                <div style={styles.muted}>Select a device to view monitoring details.</div>
              ) : (
                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Name</div>
                    <div style={styles.infoValue}>{selectedDevice.name || "-"}</div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Branch</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.branch?.name || "-"}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Type</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.deviceType || "-"}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Mode</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.connectionMode || "-"}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Status</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.status || "-"}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Serial Number</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.serialNumber || "-"}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>IP Address</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.ipAddress || "-"}
                      {selectedDevice.port ? `:${selectedDevice.port}` : ""}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Timezone</div>
                    <div style={styles.infoValue}>
                      {selectedDevice.timezone || "-"}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Last Seen</div>
                    <div style={styles.infoValue}>
                      {formatDateTime(selectedDevice.lastSeenAt)}
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Last Sync</div>
                    <div style={styles.infoValue}>
                      {formatDateTime(selectedDevice.lastSyncAt)}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Recent Sync History">
              {loadingDetails ? (
                <div style={styles.muted}>Loading sync history...</div>
              ) : syncHistory.length === 0 ? (
                <div style={styles.muted}>No sync history found for this device.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Started</th>
                        <th style={styles.th}>Finished</th>
                        <th style={styles.th}>Duration</th>
                        <th style={styles.th}>Received</th>
                        <th style={styles.th}>Inserted</th>
                        <th style={styles.th}>Duplicates</th>
                        <th style={styles.th}>Failed</th>
                        <th style={styles.th}>Triggered By</th>
                        <th style={styles.th}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistory.map((row) => (
                        <tr key={row.id}>
                          <td style={styles.td}>{row.status || "-"}</td>
                          <td style={styles.td}>{formatDateTime(row.startedAt)}</td>
                          <td style={styles.td}>{formatDateTime(row.finishedAt)}</td>
                          <td style={styles.td}>
                            {formatDuration(row.startedAt, row.finishedAt)}
                          </td>
                          <td style={styles.td}>{row.receivedCount ?? 0}</td>
                          <td style={styles.td}>{row.insertedCount ?? 0}</td>
                          <td style={styles.td}>{row.duplicateCount ?? 0}</td>
                          <td style={styles.td}>{row.failedCount ?? 0}</td>
                          <td style={styles.td}>{row.triggeredBy || "-"}</td>
                          <td style={styles.td}>{row.errorMessage || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          <div style={styles.grid}>
            <SectionCard title="Recent Raw Logs">
              {loadingDetails ? (
                <div style={styles.muted}>Loading raw logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div style={styles.muted}>No raw logs found for this device.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Log ID</th>
                        <th style={styles.th}>Log Time</th>
                        <th style={styles.th}>External User ID</th>
                        <th style={styles.th}>Employee Code</th>
                        <th style={styles.th}>Punch Type</th>
                        <th style={styles.th}>Verification</th>
                        <th style={styles.th}>Source</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Processed</th>
                        <th style={styles.th}>Processed At</th>
                        <th style={styles.th}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={styles.td}>{log.id}</td>
                          <td style={styles.td}>{formatDateTime(log.logTime)}</td>
                          <td style={styles.td}>{log.externalUserId || "-"}</td>
                          <td style={styles.td}>{log.externalEmployeeCode || "-"}</td>
                          <td style={styles.td}>{log.punchTypeRaw || "-"}</td>
                          <td style={styles.td}>{log.verificationRaw || "-"}</td>
                          <td style={styles.td}>{log.source || "-"}</td>
                          <td style={styles.td}>{log.status || "-"}</td>
                          <td style={styles.td}>{log.processed ? "YES" : "NO"}</td>
                          <td style={styles.td}>{formatDateTime(log.processedAt)}</td>
                          <td style={styles.td}>{log.errorMessage || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Unprocessed Raw Logs Across Company">
              {unprocessedLogs.length === 0 ? (
                <div style={styles.muted}>No unprocessed raw logs found.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Log ID</th>
                        <th style={styles.th}>Device ID</th>
                        <th style={styles.th}>Time</th>
                        <th style={styles.th}>External User ID</th>
                        <th style={styles.th}>Employee Code</th>
                        <th style={styles.th}>Source</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unprocessedLogs.slice(0, 300).map((log) => (
                        <tr key={log.id}>
                          <td style={styles.td}>{log.id}</td>
                          <td style={styles.td}>{log.deviceId}</td>
                          <td style={styles.td}>{formatDateTime(log.logTime)}</td>
                          <td style={styles.td}>{log.externalUserId || "-"}</td>
                          <td style={styles.td}>{log.externalEmployeeCode || "-"}</td>
                          <td style={styles.td}>{log.source || "-"}</td>
                          <td style={styles.td}>{log.status || "-"}</td>
                          <td style={styles.td}>{log.errorMessage || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 24,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  topBarLeft: {
    display: "grid",
    gridTemplateColumns: "280px minmax(260px, 1fr)",
    gap: 12,
    flex: 1,
    minWidth: 320,
  },
  grid: {
    display: "grid",
    gap: 24,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.05)",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  infoItem: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  input: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  select: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  primaryButton: {
    minHeight: 44,
    padding: "0 18px",
    border: "none",
    borderRadius: 12,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  success: {
    borderRadius: 12,
    padding: "12px 14px",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 14,
    border: "1px solid #bbf7d0",
  },
  error: {
    borderRadius: 12,
    padding: "12px 14px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 14,
    border: "1px solid #fecaca",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 13,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
};
