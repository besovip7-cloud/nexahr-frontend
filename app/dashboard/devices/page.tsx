"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatDateTimeSafe } from "@/lib/date";
import { parseJsonOrThrow } from "@/lib/json";
import { withSearch } from "@/lib/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type BranchOption = {
  id: number;
  name: string;
};

type Device = {
  id: number;
  companyId: string;
  branchId: number | null;
  name: string;
  deviceType: string;
  connectionMode: string;
  status: string;
  serialNumber?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  apiUrl?: string | null;
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  timezone?: string | null;
  cloudHttpMethod?: string | null;
  cloudLogsPath?: string | null;
  cloudAuthType?: string | null;
  cloudRequestBody?: unknown;
  lastSyncAt?: string | null;
  lastSeenAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  branch?: {
    id: number;
    name: string;
  } | null;
};

type DeviceFormState = {
  name: string;
  branchId: string;
  deviceType: string;
  connectionMode: string;
  status: string;
  serialNumber: string;
  ipAddress: string;
  port: string;
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  timezone: string;
  cloudHttpMethod: string;
  cloudLogsPath: string;
  cloudAuthType: string;
  cloudRequestBody: string;
  notes: string;
};

const emptyForm: DeviceFormState = {
  name: "",
  branchId: "",
  deviceType: "GENERIC",
  connectionMode: "PUSH",
  status: "ACTIVE",
  serialNumber: "",
  ipAddress: "",
  port: "",
  apiUrl: "",
  apiKey: "",
  username: "",
  password: "",
  timezone: "",
  cloudHttpMethod: "",
  cloudLogsPath: "",
  cloudAuthType: "",
  cloudRequestBody: "",
  notes: "",
};

export default function DevicesPage() {
  const router = useRouter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [form, setForm] = useState<DeviceFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [devicesRes, branchesRes] = await Promise.all([
        apiRequest("/devices", { auth: true }),
        apiRequest("/branches", { auth: true }),
      ]);

      setDevices(Array.isArray(devicesRes) ? devicesRes : []);
      setBranches(Array.isArray(branchesRes) ? branchesRes : []);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to load devices page."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesSearch =
        !keyword ||
        device.name?.toLowerCase().includes(keyword) ||
        device.serialNumber?.toLowerCase().includes(keyword) ||
        device.ipAddress?.toLowerCase().includes(keyword) ||
        device.deviceType?.toLowerCase().includes(keyword) ||
        device.connectionMode?.toLowerCase().includes(keyword) ||
        device.branch?.name?.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || device.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [devices, search, statusFilter]);

  function updateForm<K extends keyof DeviceFormState>(
    key: K,
    value: DeviceFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  function startEdit(device: Device) {
    setEditingId(device.id);
    setMessage("");
    setError("");

    setForm({
      name: device.name || "",
      branchId:
        device.branchId !== null && device.branchId !== undefined
          ? String(device.branchId)
          : "",
      deviceType: device.deviceType || "GENERIC",
      connectionMode: device.connectionMode || "PUSH",
      status: device.status || "ACTIVE",
      serialNumber: device.serialNumber || "",
      ipAddress: device.ipAddress || "",
      port:
        device.port !== null && device.port !== undefined
          ? String(device.port)
          : "",
      apiUrl: device.apiUrl || "",
      apiKey: "",
      username: "",
      password: "",
      timezone: device.timezone || "",
      cloudHttpMethod: device.cloudHttpMethod || "",
      cloudLogsPath: device.cloudLogsPath || "",
      cloudAuthType: device.cloudAuthType || "",
      cloudRequestBody: device.cloudRequestBody
        ? JSON.stringify(device.cloudRequestBody, null, 2)
        : "",
      notes: device.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload() {
    let parsedRequestBody: unknown = null;

    if (form.cloudRequestBody.trim()) {
      parsedRequestBody = parseJsonOrThrow(
        form.cloudRequestBody,
        "Cloud request body must be valid JSON.",
      );
    }

    return {
      name: form.name.trim(),
      branchId: form.branchId ? Number(form.branchId) : null,
      deviceType: form.deviceType,
      connectionMode: form.connectionMode,
      status: form.status,
      serialNumber: form.serialNumber.trim() || null,
      ipAddress: form.ipAddress.trim() || null,
      port: form.port ? Number(form.port) : null,
      apiUrl: form.apiUrl.trim() || null,
      apiKey: form.apiKey.trim() || null,
      username: form.username.trim() || null,
      password: form.password.trim() || null,
      timezone: form.timezone.trim() || null,
      cloudHttpMethod: form.cloudHttpMethod.trim() || null,
      cloudLogsPath: form.cloudLogsPath.trim() || null,
      cloudAuthType: form.cloudAuthType.trim() || null,
      cloudRequestBody: parsedRequestBody,
      notes: form.notes.trim() || null,
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = buildPayload();

      if (!payload.name) {
        setError("Device name is required.");
        return;
      }

      if (editingId) {
        await apiRequest(`/devices/${editingId}`, {
          method: "PATCH",
          auth: true,
          body: payload,
        });

        setMessage("Device updated successfully.");
      } else {
        await apiRequest("/devices", {
          method: "POST",
          auth: true,
          body: payload,
        });

        setMessage("Device created successfully.");
      }

      resetForm();
      await loadPage();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to save device."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(device: Device) {
    const confirmed = window.confirm(
      `Are you sure you want to delete device "${device.name}"?`,
    );
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      await apiRequest(`/devices/${device.id}`, {
        method: "DELETE",
        auth: true,
      });

      setMessage("Device deleted successfully.");
      if (editingId === device.id) {
        resetForm();
      }

      await loadPage();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to delete device."));
    }
  }

  function handleOpenMappings(deviceId: number) {
    router.push(
      withSearch("/dashboard/device-mappings", { deviceId }),
    );
  }

  function formatDateTime(value?: string | null) {
    return formatDateTimeSafe(value, "-");
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Devices"
        subtitle="Manage biometric and attendance devices connected to your company."
      />

      <div style={styles.grid}>
        <SectionCard title={editingId ? "Edit Device" : "Create Device"}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>Device Name</label>
                <input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Main Entrance Device"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Branch</label>
                <select
                  value={form.branchId}
                  onChange={(e) => updateForm("branchId", e.target.value)}
                  style={styles.select}
                >
                  <option value="">No branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.row3}>
              <div style={styles.field}>
                <label style={styles.label}>Device Type</label>
                <select
                  value={form.deviceType}
                  onChange={(e) => updateForm("deviceType", e.target.value)}
                  style={styles.select}
                >
                  <option value="GENERIC">GENERIC</option>
                  <option value="ZKTECO">ZKTECO</option>
                  <option value="HIKVISION">HIKVISION</option>
                  <option value="SUPREMA">SUPREMA</option>
                  <option value="CLOUD_API">CLOUD_API</option>
                  <option value="CSV_IMPORT">CSV_IMPORT</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Connection Mode</label>
                <select
                  value={form.connectionMode}
                  onChange={(e) => updateForm("connectionMode", e.target.value)}
                  style={styles.select}
                >
                  <option value="PUSH">PUSH</option>
                  <option value="PULL">PULL</option>
                  <option value="CLOUD">CLOUD</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateForm("status", e.target.value)}
                  style={styles.select}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>
            </div>

            <div style={styles.row3}>
              <div style={styles.field}>
                <label style={styles.label}>Serial Number</label>
                <input
                  value={form.serialNumber}
                  onChange={(e) => updateForm("serialNumber", e.target.value)}
                  placeholder="SN-1001"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>IP Address</label>
                <input
                  value={form.ipAddress}
                  onChange={(e) => updateForm("ipAddress", e.target.value)}
                  placeholder="192.168.1.10"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Port</label>
                <input
                  value={form.port}
                  onChange={(e) => updateForm("port", e.target.value)}
                  placeholder="4370"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>API URL</label>
                <input
                  value={form.apiUrl}
                  onChange={(e) => updateForm("apiUrl", e.target.value)}
                  placeholder="https://api.vendor.com"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Timezone</label>
                <input
                  value={form.timezone}
                  onChange={(e) => updateForm("timezone", e.target.value)}
                  placeholder="Asia/Baghdad"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.row3}>
              <div style={styles.field}>
                <label style={styles.label}>API Key</label>
                <input
                  value={form.apiKey}
                  onChange={(e) => updateForm("apiKey", e.target.value)}
                  placeholder="Optional"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <input
                  value={form.username}
                  onChange={(e) => updateForm("username", e.target.value)}
                  placeholder="Optional"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  value={form.password}
                  onChange={(e) => updateForm("password", e.target.value)}
                  placeholder="Optional"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.row3}>
              <div style={styles.field}>
                <label style={styles.label}>Cloud HTTP Method</label>
                <input
                  value={form.cloudHttpMethod}
                  onChange={(e) => updateForm("cloudHttpMethod", e.target.value)}
                  placeholder="GET / POST"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Cloud Logs Path</label>
                <input
                  value={form.cloudLogsPath}
                  onChange={(e) => updateForm("cloudLogsPath", e.target.value)}
                  placeholder="/logs"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Cloud Auth Type</label>
                <input
                  value={form.cloudAuthType}
                  onChange={(e) => updateForm("cloudAuthType", e.target.value)}
                  placeholder="bearer / basic / custom"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Cloud Request Body (JSON)</label>
              <textarea
                value={form.cloudRequestBody}
                onChange={(e) => updateForm("cloudRequestBody", e.target.value)}
                placeholder='{"page":1,"limit":100}'
                style={styles.textarea}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Optional notes"
                style={styles.textarea}
              />
            </div>

            {message ? <div style={styles.success}>{message}</div> : null}
            {error ? <div style={styles.error}>{error}</div> : null}

            <div style={styles.actions}>
              <button type="submit" style={styles.primaryButton} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Device" : "Create Device"}
              </button>

              {editingId ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Devices List">
          <div style={styles.toolbar}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search devices..."
              style={styles.input}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DISABLED">DISABLED</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          {loading ? (
            <div style={styles.muted}>Loading devices...</div>
          ) : filteredDevices.length === 0 ? (
            <div style={styles.muted}>No devices found.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Branch</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Mode</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>IP</th>
                    <th style={styles.th}>Last Seen</th>
                    <th style={styles.th}>Last Sync</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => (
                    <tr key={device.id}>
                      <td style={styles.td}>
                        <div style={styles.cellTitle}>{device.name}</div>
                        <div style={styles.cellSub}>
                          {device.serialNumber || "No serial number"}
                        </div>
                      </td>
                      <td style={styles.td}>{device.branch?.name || "-"}</td>
                      <td style={styles.td}>{device.deviceType || "-"}</td>
                      <td style={styles.td}>{device.connectionMode || "-"}</td>
                      <td style={styles.td}>{device.status || "-"}</td>
                      <td style={styles.td}>
                        {device.ipAddress || "-"}
                        {device.port ? `:${device.port}` : ""}
                      </td>
                      <td style={styles.td}>{formatDateTime(device.lastSeenAt)}</td>
                      <td style={styles.td}>{formatDateTime(device.lastSyncAt)}</td>
                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.smallButton}
                            onClick={() => startEdit(device)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            style={styles.smallButton}
                            onClick={() => handleOpenMappings(device.id)}
                          >
                            Mappings
                          </button>

                          <button
                            type="button"
                            style={styles.dangerButton}
                            onClick={() => handleDelete(device)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
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
  row2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  row3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
  textarea: {
    width: "100%",
    minHeight: 110,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: 14,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    resize: "vertical",
    fontFamily: "inherit",
  },
  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryButton: {
    minHeight: 46,
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
    minHeight: 46,
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
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) 220px",
    gap: 12,
    marginBottom: 18,
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
  cellTitle: {
    fontWeight: 700,
    color: "#0f172a",
  },
  cellSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  rowActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid #dbe2ea",
    borderRadius: 10,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid #fecaca",
    borderRadius: 10,
    background: "#fff5f5",
    color: "#b91c1c",
    fontWeight: 700,
    cursor: "pointer",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
};
