"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { parseJsonOrThrow } from "@/lib/json";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type Device = {
  id: number;
  name: string;
  serialNumber?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  status?: string | null;
  deviceType?: string | null;
  connectionMode?: string | null;
  branch?: {
    id: number;
    name: string;
  } | null;
};

type IngestResult = {
  message?: string;
  deviceId?: number;
  receivedCount?: number;
  insertedCount?: number;
  duplicateCount?: number;
  failedCount?: number;
};

const examplePayloadObject = {
  logs: [
    {
      externalLogId: "log-1001",
      externalUserId: "1001",
      externalEmployeeCode: "EMP-1001",
      timestamp: "2026-04-10T08:15:00+03:00",
      punchType: "CHECK_IN",
      verificationMode: "FINGERPRINT",
      rawPayload: {
        machine: "ZKTeco K40",
        terminalId: "DEV-01",
        note: "Sample test record",
      },
    },
    {
      externalLogId: "log-1002",
      externalUserId: "1001",
      externalEmployeeCode: "EMP-1001",
      timestamp: "2026-04-10T17:05:00+03:00",
      punchType: "CHECK_OUT",
      verificationMode: "FINGERPRINT",
      rawPayload: {
        machine: "ZKTeco K40",
        terminalId: "DEV-01",
        note: "Sample test record",
      },
    },
  ],
};

function DeviceIngestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialDeviceId = useMemo(() => {
    return searchParams.get("deviceId") || "";
  }, [searchParams]);

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDeviceId);
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(examplePayloadObject, null, 2),
  );

  const [loadingDevices, setLoadingDevices] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<IngestResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedDeviceId(initialDeviceId);
  }, [initialDeviceId]);

  const loadDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      setError("");

      const devicesRes = await apiRequest("/devices", { auth: true });
      const devicesList = Array.isArray(devicesRes) ? devicesRes : [];

      setDevices(devicesList);

      if (!initialDeviceId && devicesList.length > 0) {
        setSelectedDeviceId(String(devicesList[0].id));
      }
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to load devices."));
    } finally {
      setLoadingDevices(false);
    }
  }, [initialDeviceId, router]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  function loadExamplePayload() {
    setPayloadText(JSON.stringify(examplePayloadObject, null, 2));
    setMessage("Example payload loaded.");
    setError("");
    setResult(null);
  }

  function clearPayload() {
    setPayloadText('{\n  "logs": []\n}');
    setMessage("");
    setError("");
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedDeviceId) {
      setError("Please select a device.");
      setMessage("");
      setResult(null);
      return;
    }

    try {
      const parsed = parseJsonOrThrow(payloadText, "Payload must be valid JSON.");

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { logs?: unknown }).logs)
      ) {
        setError('Payload must include a "logs" array.');
        setMessage("");
        setResult(null);
        return;
      }

      setSubmitting(true);
      setMessage("");
      setError("");
      setResult(null);

      const response = await apiRequest(`/devices/${selectedDeviceId}/ingest-logs`, {
        method: "POST",
        auth: true,
        body: parsed,
      });

      setResult(response || null);
      setMessage("Logs ingested successfully.");
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to ingest logs."));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDevice = useMemo(() => {
    return devices.find((item) => String(item.id) === String(selectedDeviceId)) || null;
  }, [devices, selectedDeviceId]);

  return (
    <div style={styles.page}>
      <PageHeader
        title="Device Ingest"
        subtitle="Send raw biometric logs manually to validate device integration and raw log ingestion."
      />

      <div style={styles.grid}>
        <SectionCard title="Ingest Logs">
          {loadingDevices ? (
            <div style={styles.muted}>Loading devices...</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Device</label>
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
                      {device.serialNumber ? ` \u2022 ${device.serialNumber}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDevice ? (
                <div style={styles.deviceSummary}>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Type</span>
                    <span style={styles.summaryValue}>
                      {selectedDevice.deviceType || "-"}
                    </span>
                  </div>

                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Mode</span>
                    <span style={styles.summaryValue}>
                      {selectedDevice.connectionMode || "-"}
                    </span>
                  </div>

                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Status</span>
                    <span style={styles.summaryValue}>
                      {selectedDevice.status || "-"}
                    </span>
                  </div>

                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Address</span>
                    <span style={styles.summaryValue}>
                      {selectedDevice.ipAddress || "-"}
                      {selectedDevice.port ? `:${selectedDevice.port}` : ""}
                    </span>
                  </div>
                </div>
              ) : null}

              <div style={styles.field}>
                <label style={styles.label}>Payload JSON</label>
                <textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  placeholder='{"logs":[]}'
                  style={styles.textarea}
                />
              </div>

              <div style={styles.toolbar}>
                <button
                  type="button"
                  onClick={loadExamplePayload}
                  style={styles.secondaryButton}
                >
                  Load Example
                </button>

                <button
                  type="button"
                  onClick={clearPayload}
                  style={styles.secondaryButton}
                >
                  Clear
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={styles.primaryButton}
                >
                  {submitting ? "Sending..." : "Ingest Logs"}
                </button>
              </div>

              {message ? <div style={styles.success}>{message}</div> : null}
              {error ? <div style={styles.error}>{error}</div> : null}
            </form>
          )}
        </SectionCard>

        <SectionCard title="Expected Payload Format">
          <div style={styles.helpBlock}>
            <div style={styles.helpTitle}>Required shape</div>
            <pre style={styles.pre}>
{`{
  "logs": [
    {
      "externalLogId": "log-1001",
      "externalUserId": "1001",
      "externalEmployeeCode": "EMP-1001",
      "timestamp": "2026-04-10T08:15:00+03:00",
      "punchType": "CHECK_IN",
      "verificationMode": "FINGERPRINT",
      "rawPayload": {
        "any": "json"
      }
    }
  ]
}`}
            </pre>
          </div>

          <div style={styles.helpBlock}>
            <div style={styles.helpTitle}>Important notes</div>
            <div style={styles.helpText}>
              The backend expects a top-level <code>logs</code> array. Each log
              should have a valid <code>timestamp</code>. Duplicate records may
              be skipped automatically based on your dedupe logic.
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Last Ingest Result">
          {!result ? (
            <div style={styles.muted}>No ingest result yet.</div>
          ) : (
            <div style={styles.resultGrid}>
              <div style={styles.resultCard}>
                <div style={styles.resultLabel}>Message</div>
                <div style={styles.resultValue}>{result.message || "-"}</div>
              </div>

              <div style={styles.resultCard}>
                <div style={styles.resultLabel}>Device ID</div>
                <div style={styles.resultValue}>{result.deviceId ?? "-"}</div>
              </div>

              <div style={styles.resultCard}>
                <div style={styles.resultLabel}>Received</div>
                <div style={styles.resultValue}>{result.receivedCount ?? 0}</div>
              </div>

              <div style={styles.resultCard}>
                <div style={styles.resultLabel}>Inserted</div>
                <div style={styles.resultValue}>{result.insertedCount ?? 0}</div>
              </div>

              <div style={styles.resultCard}>
                <div style={styles.resultLabel}>Duplicates</div>
                <div style={styles.resultValue}>{result.duplicateCount ?? 0}</div>
              </div>

              <div style={styles.resultCard}>
                <div style={styles.resultLabel}>Failed</div>
                <div style={styles.resultValue}>{result.failedCount ?? 0}</div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function DeviceIngestPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <DeviceIngestPageContent />
    </Suspense>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 24,
  },
  grid: {
    display: "grid",
    gap: 24,
  },
  form: {
    display: "grid",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
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
  textarea: {
    width: "100%",
    minHeight: 360,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: 14,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    resize: "vertical",
    fontFamily: "monospace",
    lineHeight: 1.5,
  },
  toolbar: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
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
  secondaryButton: {
    minHeight: 44,
    padding: "0 18px",
    border: "1px solid #dbe2ea",
    borderRadius: 12,
    background: "#fff",
    color: "#0f172a",
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
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
  deviceSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  summaryItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#f8fafc",
    padding: 14,
    display: "grid",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  helpBlock: {
    display: "grid",
    gap: 10,
    marginBottom: 18,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
  },
  helpText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.7,
  },
  pre: {
    margin: 0,
    padding: 16,
    borderRadius: 14,
    background: "#0f172a",
    color: "#e2e8f0",
    overflowX: "auto",
    fontSize: 13,
    lineHeight: 1.6,
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  resultCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fff",
    padding: 16,
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.05)",
  },
  resultLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    wordBreak: "break-word",
  },
};
