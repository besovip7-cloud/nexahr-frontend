"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function PayrollSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      const data = await apiRequest("/payroll-settings");
      setSettings(data);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setMessage("");

      await apiRequest("/payroll-settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });

      setMessage("✅ Saved successfully");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !settings) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Payroll Settings</h1>

      {message && <div style={styles.alert}>{message}</div>}

      <div style={styles.grid}>
        {/* OVERTIME */}
        <div style={styles.card}>
          <h3>Overtime Settings</h3>

          <label>Overtime Multiplier</label>
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

        {/* LATE */}
        <div style={styles.card}>
          <h3>Late Deduction</h3>

          <label>
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
            Enable Late Deduction
          </label>
        </div>

        {/* ABSENCE */}
        <div style={styles.card}>
          <h3>Absence Settings</h3>

          <label>
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
            Enable Absence Deduction
          </label>

          <label>Deduction Days Multiplier</label>
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

        {/* GENERAL */}
        <div style={styles.card}>
          <h3>General Rules</h3>

          <label>Grace Minutes</label>
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

          <label>Half Day Threshold (0.5 = 50%)</label>
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

const styles: any = {
  page: {
    padding: 40,
    background: "#f5f7fb",
    minHeight: "100vh",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 20,
    marginBottom: 20,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
  },
  button: {
    padding: "14px 20px",
    background: "#111827",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
  },
  alert: {
    background: "#e0f2fe",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
};