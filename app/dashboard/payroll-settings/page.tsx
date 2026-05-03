"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";

type PayrollSettings = {
  overtimeMultiplier: number;
  enableLateDeduction: boolean;
  enableAbsenceDeduction: boolean;
  absenceDeductionDays: number;
  graceMinutes: number;
  halfDayThreshold: number;
};

export default function PayrollSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const data = await apiRequest<PayrollSettings>("/payroll-settings", {
        auth: true,
      });
      setSettings(data);
    } catch (e) {
      if (handleAuthError(e, router)) return;
      setError(getErrorMessage(e, "Failed to load payroll settings"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  async function save() {
    if (!settings) return;

    try {
      setSaving(true);
      setMessage("");
      setError("");

      await apiRequest("/payroll-settings", {
        method: "PATCH",
        auth: true,
        body: settings,
      });

      setMessage("Saved successfully");
    } catch (e) {
      if (handleAuthError(e, router)) return;
      setError(getErrorMessage(e, "Failed to save payroll settings"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !settings) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Payroll Settings</h1>
          <p style={styles.subtitle}>
            Configure overtime, deductions, and payroll calculation rules.
          </p>
        </div>
      </header>

      {message ? <div style={styles.alert}>{message}</div> : null}
      {error ? <div style={styles.errorAlert}>{error}</div> : null}

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Overtime Settings</h3>

          <label style={styles.label}>Overtime Multiplier</label>
          <input
            type="number"
            value={settings.overtimeMultiplier}
            onChange={(e) =>
              setSettings({
                ...settings,
                overtimeMultiplier: Number(e.target.value),
              })
            }
            style={styles.input}
          />
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Late Deduction</h3>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.enableLateDeduction}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  enableLateDeduction: e.target.checked,
                })
              }
            />
            <span>Enable Late Deduction</span>
          </label>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Absence Settings</h3>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.enableAbsenceDeduction}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  enableAbsenceDeduction: e.target.checked,
                })
              }
            />
            <span>Enable Absence Deduction</span>
          </label>

          <label style={styles.label}>Deduction Days Multiplier</label>
          <input
            type="number"
            value={settings.absenceDeductionDays}
            onChange={(e) =>
              setSettings({
                ...settings,
                absenceDeductionDays: Number(e.target.value),
              })
            }
            style={styles.input}
          />
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>General Rules</h3>

          <label style={styles.label}>Grace Minutes</label>
          <input
            type="number"
            value={settings.graceMinutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                graceMinutes: Number(e.target.value),
              })
            }
            style={styles.input}
          />

          <label style={styles.label}>Half Day Threshold (0.5 = 50%)</label>
          <input
            type="number"
            step="0.1"
            value={settings.halfDayThreshold}
            onChange={(e) =>
              setSettings({
                ...settings,
                halfDayThreshold: Number(e.target.value),
              })
            }
            style={styles.input}
          />
        </div>
      </div>

      <button onClick={save} style={styles.button}>
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    background: "#f5f7fb",
    minHeight: "100%",
  },
  loading: {
    padding: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    color: "#111827",
  },
  subtitle: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 20,
    marginBottom: 20,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "1px solid #e5e7eb",
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
    marginTop: 6,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#374151",
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },
  button: {
    padding: "14px 20px",
    background: "#111827",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },
  alert: {
    background: "#e0f2fe",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    color: "#0f172a",
    border: "1px solid #bae6fd",
  },
  errorAlert: {
    background: "#fef2f2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },
};
