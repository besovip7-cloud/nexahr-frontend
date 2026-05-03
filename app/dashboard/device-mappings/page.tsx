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
import { formatDateTimeSafe } from "@/lib/date";
import { withSearch } from "@/lib/navigation";
import { parsePositiveInt } from "@/lib/number";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type DeviceOption = {
  id: number;
  name: string;
  serialNumber?: string | null;
  branchId?: number | null;
  branch?: {
    id: number;
    name: string;
  } | null;
};

type EmployeeOption = {
  id: number;
  fullName: string;
  employeeCode?: string | null;
};

type Mapping = {
  id: number;
  companyId: string;
  deviceId: number;
  employeeId: number;
  externalUserId?: string | null;
  externalEmployeeCode?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  employee?: {
    id: number;
    fullName: string;
    employeeCode?: string | null;
  } | null;
  device?: {
    id: number;
    name: string;
    serialNumber?: string | null;
    branch?: {
      id: number;
      name: string;
    } | null;
  } | null;
};

type MappingForm = {
  deviceId: string;
  employeeId: string;
  externalUserId: string;
  externalEmployeeCode: string;
  isActive: boolean;
  notes: string;
};

const emptyForm: MappingForm = {
  deviceId: "",
  employeeId: "",
  externalUserId: "",
  externalEmployeeCode: "",
  isActive: true,
  notes: "",
};

function DeviceMappingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialDeviceId = useMemo(() => {
    const raw = searchParams.get("deviceId");
    const parsed = parsePositiveInt(raw);
    return parsed ? String(parsed) : "";
  }, [searchParams]);

  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  const [form, setForm] = useState<MappingForm>({
    ...emptyForm,
    deviceId: initialDeviceId,
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState(initialDeviceId || "ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((prev) => ({ ...prev, deviceId: initialDeviceId }));
    setDeviceFilter(initialDeviceId || "ALL");
  }, [initialDeviceId]);

  const loadPage = useCallback(async (deviceId?: string) => {
    try {
      setLoading(true);
      setError("");

      const mappingUrl = withSearch("/device-mappings", { deviceId });

      const [devicesRes, employeesRes, mappingsRes] = await Promise.all([
        apiRequest("/devices", { auth: true }),
        apiRequest("/employees", { auth: true }),
        apiRequest(mappingUrl, { auth: true }),
      ]);

      setDevices(Array.isArray(devicesRes) ? devicesRes : []);
      setEmployees(Array.isArray(employeesRes) ? employeesRes : []);
      setMappings(Array.isArray(mappingsRes) ? mappingsRes : []);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to load device mappings page."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPage(initialDeviceId || undefined);
  }, [initialDeviceId, loadPage]);

  const filteredMappings = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return mappings.filter((mapping) => {
      const matchesSearch =
        !keyword ||
        mapping.employee?.fullName?.toLowerCase().includes(keyword) ||
        mapping.employee?.employeeCode?.toLowerCase().includes(keyword) ||
        mapping.device?.name?.toLowerCase().includes(keyword) ||
        mapping.externalUserId?.toLowerCase().includes(keyword) ||
        mapping.externalEmployeeCode?.toLowerCase().includes(keyword) ||
        mapping.device?.branch?.name?.toLowerCase().includes(keyword);

      const matchesDevice =
        deviceFilter === "ALL" || String(mapping.deviceId) === deviceFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && mapping.isActive) ||
        (statusFilter === "INACTIVE" && !mapping.isActive);

      return matchesSearch && matchesDevice && matchesStatus;
    });
  }, [mappings, search, deviceFilter, statusFilter]);

  function updateForm<K extends keyof MappingForm>(
    key: K,
    value: MappingForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      deviceId: initialDeviceId || "",
    });
    setEditingId(null);
    setMessage("");
    setError("");
  }

  function startEdit(mapping: Mapping) {
    setEditingId(mapping.id);
    setMessage("");
    setError("");

    setForm({
      deviceId: String(mapping.deviceId),
      employeeId: String(mapping.employeeId),
      externalUserId: mapping.externalUserId || "",
      externalEmployeeCode: mapping.externalEmployeeCode || "",
      isActive: mapping.isActive,
      notes: mapping.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.deviceId || !form.employeeId) {
      setError("Device and employee are required.");
      return;
    }

    const deviceId = parsePositiveInt(form.deviceId);
    const employeeId = parsePositiveInt(form.employeeId);

    if (!deviceId || !employeeId) {
      setError("Please select valid device and employee values.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = {
        deviceId,
        employeeId,
        externalUserId: form.externalUserId.trim() || null,
        externalEmployeeCode: form.externalEmployeeCode.trim() || null,
        isActive: form.isActive,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        await apiRequest(`/device-mappings/${editingId}`, {
          method: "PATCH",
          auth: true,
          body: payload,
        });

        setMessage("Mapping updated successfully.");
      } else {
        await apiRequest("/device-mappings", {
          method: "POST",
          auth: true,
          body: payload,
        });

        setMessage("Mapping created successfully.");
      }

      resetForm();
      await loadPage(initialDeviceId || undefined);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to save mapping."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mapping: Mapping) {
    const confirmed = window.confirm(
      `Are you sure you want to delete mapping for "${mapping.employee?.fullName || "employee"}"?`,
    );
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      await apiRequest(`/device-mappings/${mapping.id}`, {
        method: "DELETE",
        auth: true,
      });

      setMessage("Mapping deleted successfully.");
      if (editingId === mapping.id) {
        resetForm();
      }

      await loadPage(initialDeviceId || undefined);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error(err);
      setError(getErrorMessage(err, "Failed to delete mapping."));
    }
  }

  function formatDateTime(value?: string) {
    return formatDateTimeSafe(value, "-");
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Device Mappings"
        subtitle="Map device users to employees so raw logs can be converted into attendance data."
      />

      <div style={styles.grid}>
        <SectionCard title={editingId ? "Edit Mapping" : "Create Mapping"}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Device</label>
              <select
                value={form.deviceId}
                onChange={(e) => updateForm("deviceId", e.target.value)}
                style={styles.select}
              >
                <option value="">Select device</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                    {device.serialNumber ? ` \u2022 ${device.serialNumber}` : ""}
                    {device.branch?.name ? ` \u2022 ${device.branch.name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Employee</label>
              <select
                value={form.employeeId}
                onChange={(e) => updateForm("employeeId", e.target.value)}
                style={styles.select}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                    {employee.employeeCode ? ` \u2022 ${employee.employeeCode}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>External User ID</label>
                <input
                  value={form.externalUserId}
                  onChange={(e) => updateForm("externalUserId", e.target.value)}
                  placeholder="1001"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>External Employee Code</label>
                <input
                  value={form.externalEmployeeCode}
                  onChange={(e) =>
                    updateForm("externalEmployeeCode", e.target.value)
                  }
                  placeholder="EMP-1001"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateForm("isActive", e.target.checked)}
                />
                <span>Active mapping</span>
              </label>
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
                {saving ? "Saving..." : editingId ? "Update Mapping" : "Create Mapping"}
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

        <SectionCard title="Mappings List">
          <div style={styles.toolbar}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mappings..."
              style={styles.input}
            />

            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Devices</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          {loading ? (
            <div style={styles.muted}>Loading mappings...</div>
          ) : filteredMappings.length === 0 ? (
            <div style={styles.muted}>No mappings found.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Device</th>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>External User ID</th>
                    <th style={styles.th}>External Employee Code</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td style={styles.td}>
                        <div style={styles.cellTitle}>
                          {mapping.device?.name || "-"}
                        </div>
                        <div style={styles.cellSub}>
                          {mapping.device?.branch?.name || "No branch"}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.cellTitle}>
                          {mapping.employee?.fullName || "-"}
                        </div>
                        <div style={styles.cellSub}>
                          {mapping.employee?.employeeCode || "No employee code"}
                        </div>
                      </td>
                      <td style={styles.td}>{mapping.externalUserId || "-"}</td>
                      <td style={styles.td}>
                        {mapping.externalEmployeeCode || "-"}
                      </td>
                      <td style={styles.td}>
                        {mapping.isActive ? "ACTIVE" : "INACTIVE"}
                      </td>
                      <td style={styles.td}>{formatDateTime(mapping.createdAt)}</td>
                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.smallButton}
                            onClick={() => startEdit(mapping)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            style={styles.dangerButton}
                            onClick={() => handleDelete(mapping)}
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

export default function DeviceMappingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <DeviceMappingsPageContent />
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
  row2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
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
    minHeight: 100,
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
    gridTemplateColumns: "minmax(220px, 1fr) 220px 200px",
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
