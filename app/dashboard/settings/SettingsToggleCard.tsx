"use client";

import type { CSSProperties } from "react";

type Props = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

export default function SettingsToggleCard({
  label,
  description,
  checked,
  onChange,
}: Props) {
  return (
    <div style={styles.card}>
      <div style={{ minWidth: 0 }}>
        <div style={styles.title}>{label}</div>
        <div style={styles.description}>{description}</div>
      </div>

      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        style={{
          ...styles.toggle,
          justifyContent: checked ? "flex-end" : "flex-start",
          background: checked ? "#2563eb" : "#dbe4f0",
        }}
      >
        <span style={styles.knob} />
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    borderRadius: "20px",
    padding: "18px",
    background: "#f8fbff",
    border: "1px solid #e8eef6",
  },
  title: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: "6px",
  },
  description: {
    fontSize: "13px",
    lineHeight: 1.65,
    color: "#64748b",
  },
  toggle: {
    width: "62px",
    height: "34px",
    borderRadius: "999px",
    border: "none",
    display: "flex",
    alignItems: "center",
    padding: "4px",
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 0.2s ease",
  },
  knob: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    background: "#ffffff",
    boxShadow: "0 3px 10px rgba(15,23,42,0.18)",
    display: "block",
  },
};