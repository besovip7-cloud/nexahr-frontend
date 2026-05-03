"use client";

import type { CSSProperties } from "react";

type Props = {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  saving?: boolean;
};

export default function SettingsTopbar({
  title,
  subtitle,
  query,
  onQueryChange,
  onRefresh,
  onSave,
  saving = false,
}: Props) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.left}>
        <div style={styles.badge}>NexaHR {"\u2022"} System Control Center</div>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      <div style={styles.right}>
        <div style={styles.searchWrap}>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search settings..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={onRefresh} style={styles.secondaryBtn}>
            Refresh
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              ...styles.primaryBtn,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  left: {
    minWidth: 0,
    flex: 1,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: "999px",
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "14px",
    letterSpacing: "0.03em",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.15,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "12px 0 0",
    maxWidth: "820px",
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.75,
  },
  right: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  searchWrap: {
    minWidth: "260px",
  },
  searchInput: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid #dbe5f0",
    background: "#ffffff",
    color: "#0f172a",
    padding: "13px 14px",
    fontSize: "14px",
    outline: "none",
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },
  actions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  secondaryBtn: {
    border: "1px solid #d7e3f3",
    borderRadius: "14px",
    padding: "13px 18px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
  },
  primaryBtn: {
    border: "none",
    borderRadius: "14px",
    padding: "13px 18px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "14px",
    boxShadow: "0 10px 24px rgba(37,99,235,0.16)",
  },
};
