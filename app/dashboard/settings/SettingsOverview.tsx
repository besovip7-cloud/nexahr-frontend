"use client";

import type { CSSProperties, ReactNode } from "react";

type OverviewItem = {
  label: string;
  value: ReactNode;
  note: string;
};

type Props = {
  items: OverviewItem[];
};

export default function SettingsOverview({ items }: Props) {
  return (
    <div style={styles.grid}>
      {items.map((item) => (
        <div key={item.label} style={styles.card}>
          <div style={styles.label}>{item.label}</div>
          <div style={styles.value}>{item.value ?? "-"}</div>
          <div style={styles.note}>{item.note}</div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  card: {
    borderRadius: "22px",
    padding: "18px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  label: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "10px",
  },
  value: {
    color: "#0f172a",
    fontSize: "24px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    marginBottom: "8px",
  },
  note: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};