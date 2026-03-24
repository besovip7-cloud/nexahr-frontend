"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import { clearAuthTokens, getAccessToken } from "../../../lib/auth";

type Shift = {
  id: number;
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  crossesMidnight: boolean;
  graceMinutes: number;
  workHoursPerDay: number;
  minuteRate: number | string;
};

type ShiftFormState = {
  name: string;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  crossesMidnight: boolean;
  graceMinutes: string;
  workHoursPerDay: string;
  minuteRate: string;
};

const emptyForm: ShiftFormState = {
  name: "",
  startHour: "",
  startMinute: "",
  endHour: "",
  endMinute: "",
  crossesMidnight: false,
  graceMinutes: "10",
  workHoursPerDay: "",
  minuteRate: "",
};

function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

function formatShiftTime(shift: Shift) {
  return `${pad2(shift.startHour)}:${pad2(shift.startMinute)} → ${pad2(
    shift.endHour,
  )}:${pad2(shift.endMinute)}`;
}

export default function ShiftsPage() {
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<ShiftFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadShifts(showRefreshState = false) {
    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const data = await apiRequest<Shift[]>("/shifts", {
        method: "GET",
        auth: true,
      });

      setShifts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to load shifts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredShifts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return shifts;

    return shifts.filter((shift) => {
      return (
        shift.name.toLowerCase().includes(q) ||
        String(shift.id).includes(q) ||
        formatShiftTime(shift).toLowerCase().includes(q) ||
        String(shift.graceMinutes).includes(q) ||
        String(shift.workHoursPerDay).includes(q) ||
        String(shift.minuteRate).includes(q)
      );
    });
  }, [shifts, search]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function fillFormForEdit(shift: Shift) {
    setEditingId(shift.id);
    setForm({
      name: shift.name ?? "",
      startHour: String(shift.startHour ?? ""),
      startMinute: String(shift.startMinute ?? ""),
      endHour: String(shift.endHour ?? ""),
      endMinute: String(shift.endMinute ?? ""),
      crossesMidnight: !!shift.crossesMidnight,
      graceMinutes: String(shift.graceMinutes ?? 10),
      workHoursPerDay: String(shift.workHoursPerDay ?? ""),
      minuteRate: String(shift.minuteRate ?? ""),
    });

    setMessage(`Editing shift #${shift.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateForm() {
    if (!form.name.trim()) return "Shift name is required";
    if (form.startHour === "") return "Start hour is required";
    if (form.startMinute === "") return "Start minute is required";
    if (form.endHour === "") return "End hour is required";
    if (form.endMinute === "") return "End minute is required";
    if (form.workHoursPerDay === "") return "Work hours per day is required";
    if (form.minuteRate === "") return "Minute rate is required";

    const startHour = Number(form.startHour);
    const startMinute = Number(form.startMinute);
    const endHour = Number(form.endHour);
    const endMinute = Number(form.endMinute);
    const graceMinutes = Number(form.graceMinutes);
    const workHoursPerDay = Number(form.workHoursPerDay);
    const minuteRate = Number(form.minuteRate);

    if (Number.isNaN(startHour) || startHour < 0 || startHour > 23) {
      return "Start hour must be between 0 and 23";
    }

    if (Number.isNaN(startMinute) || startMinute < 0 || startMinute > 59) {
      return "Start minute must be between 0 and 59";
    }

    if (Number.isNaN(endHour) || endHour < 0 || endHour > 23) {
      return "End hour must be between 0 and 23";
    }

    if (Number.isNaN(endMinute) || endMinute < 0 || endMinute > 59) {
      return "End minute must be between 0 and 59";
    }

    if (Number.isNaN(graceMinutes) || graceMinutes < 0) {
      return "Grace minutes must be 0 or more";
    }

    if (Number.isNaN(workHoursPerDay) || workHoursPerDay <= 0) {
      return "Work hours per day must be greater than 0";
    }

    if (Number.isNaN(minuteRate) || minuteRate < 0) {
      return "Minute rate must be 0 or more";
    }

    return null;
  }

  async function handleSaveShift() {
    const validationError = validateForm();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        name: form.name.trim(),
        startHour: Number(form.startHour),
        startMinute: Number(form.startMinute),
        endHour: Number(form.endHour),
        endMinute: Number(form.endMinute),
        crossesMidnight: form.crossesMidnight,
        graceMinutes: Number(form.graceMinutes),
        workHoursPerDay: Number(form.workHoursPerDay),
        minuteRate: Number(form.minuteRate),
      };

      if (editingId) {
        await apiRequest(`/shifts/${editingId}`, {
          method: "PATCH",
          auth: true,
          body: JSON.stringify(payload),
        });

        setMessage("Shift updated successfully");
      } else {
        await apiRequest("/shifts", {
          method: "POST",
          auth: true,
          body: JSON.stringify(payload),
        });

        setMessage("Shift created successfully");
      }

      resetForm();
      await loadShifts();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save shift");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShift(id: number) {
    const confirmed = window.confirm("Delete this shift?");
    if (!confirmed) return;

    try {
      setMessage("");

      await apiRequest(`/shifts/${id}`, {
        method: "DELETE",
        auth: true,
      });

      setShifts((prev) => prev.filter((item) => item.id !== id));

      if (editingId === id) {
        resetForm();
      }

      setMessage("Shift deleted successfully");
    } catch (error: any) {
      setMessage(error?.message || "Failed to delete shift");
    }
  }

  function handleRefresh() {
    loadShifts(true);
  }

  function handleLogout() {
    clearAuthTokens();
    router.replace("/login");
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.logoBox}>
            <div style={styles.logoBadge}>N</div>
            <div>
              <div style={styles.logoTitle}>NexaHR</div>
              <div style={styles.logoSub}>HR & Attendance SaaS</div>
            </div>
          </div>

          <nav style={styles.nav}>
            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/employees")}
            >
              Employees
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => router.push("/dashboard/shift-assignments")}
            >
              Shift Assignments
            </button>

            <button
              type="button"
              style={{ ...styles.navItem, ...styles.navItemActive }}
            >
              Shifts
            </button>

            <button type="button" style={styles.navItem}>
              Attendance
            </button>
            <button type="button" style={styles.navItem}>
              Branches
            </button>
            <button type="button" style={styles.navItem}>
              Payroll
            </button>
            <button type="button" style={styles.navItem}>
              Settings
            </button>
          </nav>
        </div>

        <button type="button" onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Shifts Management</h1>
            <p style={styles.pageSubtitle}>
              Create, update, and manage work shifts for employees.
            </p>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.headerBadge}>
              Total Shifts: <strong>{shifts.length}</strong>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              style={styles.secondaryButton}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Shifts</div>
            <div style={styles.statValue}>{shifts.length}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Filtered Results</div>
            <div style={styles.statValue}>{filteredShifts.length}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Cross Midnight</div>
            <div style={styles.statValue}>
              {shifts.filter((s) => s.crossesMidnight).length}
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Standard Shifts</div>
            <div style={styles.statValue}>
              {shifts.filter((s) => !s.crossesMidnight).length}
            </div>
          </div>
        </section>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>
                {editingId ? `Edit Shift #${editingId}` : "Create Shift"}
              </h2>
              <p style={styles.cardSubtitle}>
                Configure shift name, time range, grace period, and payroll rate.
              </p>
            </div>

            {editingId ? (
              <button type="button" onClick={resetForm} style={styles.secondaryButton}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div style={styles.formGrid}>
            <input
              type="text"
              placeholder="Shift name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              style={styles.input}
            />

            <input
              type="number"
              placeholder="Start hour"
              min={0}
              max={23}
              value={form.startHour}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startHour: e.target.value }))
              }
              style={styles.input}
            />

            <input
              type="number"
              placeholder="Start minute"
              min={0}
              max={59}
              value={form.startMinute}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startMinute: e.target.value }))
              }
              style={styles.input}
            />

            <input
              type="number"
              placeholder="End hour"
              min={0}
              max={23}
              value={form.endHour}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, endHour: e.target.value }))
              }
              style={styles.input}
            />

            <input
              type="number"
              placeholder="End minute"
              min={0}
              max={59}
              value={form.endMinute}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, endMinute: e.target.value }))
              }
              style={styles.input}
            />

            <input
              type="number"
              placeholder="Grace minutes"
              min={0}
              value={form.graceMinutes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, graceMinutes: e.target.value }))
              }
              style={styles.input}
            />

            <input
              type="number"
              placeholder="Work hours per day"
              min={1}
              value={form.workHoursPerDay}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, workHoursPerDay: e.target.value }))
              }
              style={styles.input}
            />

            <input
              type="number"
              placeholder="Minute rate"
              min={0}
              step="0.01"
              value={form.minuteRate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, minuteRate: e.target.value }))
              }
              style={styles.input}
            />

            <label style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={form.crossesMidnight}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    crossesMidnight: e.target.checked,
                  }))
                }
              />
              <span>Crosses midnight</span>
            </label>

            <button
              type="button"
              onClick={handleSaveShift}
              style={styles.primaryButton}
              disabled={saving}
            >
              {saving ? "Saving..." : editingId ? "Update Shift" : "Create Shift"}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Shifts List</h2>
              <p style={styles.cardSubtitle}>
                Review shift timings and manage existing shift records.
              </p>
            </div>

            <input
              type="text"
              placeholder="Search by shift name, time, rate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading shifts...</div>
          ) : filteredShifts.length === 0 ? (
            <div style={styles.emptyState}>
              {search.trim() ? "No matching shifts found." : "No shifts found yet."}
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Grace</th>
                    <th style={styles.th}>Work Hours</th>
                    <th style={styles.th}>Minute Rate</th>
                    <th style={styles.th}>Midnight</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((shift) => (
                    <tr key={shift.id}>
                      <td style={styles.td}>{shift.id}</td>
                      <td style={styles.tdStrong}>{shift.name}</td>
                      <td style={styles.td}>
                        <span style={styles.timeBadge}>{formatShiftTime(shift)}</span>
                      </td>
                      <td style={styles.td}>{shift.graceMinutes} min</td>
                      <td style={styles.td}>{shift.workHoursPerDay}</td>
                      <td style={styles.td}>{shift.minuteRate}</td>
                      <td style={styles.td}>
                        <span
                          style={
                            shift.crossesMidnight
                              ? styles.warningBadge
                              : styles.normalBadge
                          }
                        >
                          {shift.crossesMidnight ? "Yes" : "No"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionsWrap}>
                          <button
                            type="button"
                            onClick={() => fillFormForEdit(shift)}
                            style={styles.editButton}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShift(shift.id)}
                            style={styles.deleteButton}
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
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    background: "#f3f6fb",
    color: "#111827",
  },
  sidebar: {
    background: "#111827",
    color: "#ffffff",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "100vh",
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#ffffff",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 20,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  logoSub: {
    fontSize: 12,
    opacity: 0.75,
  },
  nav: {
    display: "grid",
    gap: 10,
  },
  navItem: {
    background: "transparent",
    color: "#d1d5db",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 14,
  },
  navItemActive: {
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  logoutButton: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600,
  },
  main: {
    padding: 28,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 800,
    margin: 0,
  },
  pageSubtitle: {
    marginTop: 8,
    color: "#6b7280",
  },
  headerBadge: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 14,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  statCard: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
  },
  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
    minHeight: 180,
    marginBottom: 18,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 6,
  },
  cardSubtitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: 14,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#111827",
  },
  checkboxWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    background: "#fff",
    minHeight: 48,
  },
  searchInput: {
    minWidth: 320,
    maxWidth: 420,
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#111827",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
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
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#374151",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "14px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#111827",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  timeBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
    fontSize: 12,
    fontWeight: 700,
  },
  normalBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ecfeff",
    color: "#155e75",
    fontSize: 12,
    fontWeight: 700,
  },
  warningBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 700,
  },
  actionsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  editButton: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  deleteButton: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
    textAlign: "center",
  },
};