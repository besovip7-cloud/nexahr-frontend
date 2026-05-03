"use client";

import type { CSSProperties } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
};

export default function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  const toneStyles = getToneStyles(tone);

  return (
    <div
      style={{
        ...styles.card,
        ...toneStyles.card,
      }}
    >
      <div
        style={{
          ...styles.topRow,
        }}
      >
        <div style={styles.label}>{label}</div>
        <div
          style={{
            ...styles.dot,
            ...toneStyles.dot,
          }}
        />
      </div>

      <div style={styles.value}>{value}</div>

      {hint ? (
        <div
          style={{
            ...styles.hint,
            ...toneStyles.hint,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function getToneStyles(tone: StatCardProps["tone"]) {
  switch (tone) {
    case "success":
      return {
        card: {
          background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)",
          border: "1px solid #bbf7d0",
        },
        dot: { background: "#22c55e" },
        hint: { color: "#166534" },
      };

    case "warning":
      return {
        card: {
          background: "linear-gradient(180deg, #ffffff 0%, #fffbeb 100%)",
          border: "1px solid #fde68a",
        },
        dot: { background: "#f59e0b" },
        hint: { color: "#92400e" },
      };

    case "danger":
      return {
        card: {
          background: "linear-gradient(180deg, #ffffff 0%, #fff1f2 100%)",
          border: "1px solid #fecdd3",
        },
        dot: { background: "#ef4444" },
        hint: { color: "#9f1239" },
      };

    case "primary":
      return {
        card: {
          background: "linear-gradient(180deg, #ffffff 0%, #eef2ff 100%)",
          border: "1px solid #c7d2fe",
        },
        dot: { background: "#4f46e5" },
        hint: { color: "#3730a3" },
      };

    default:
      return {
        card: {
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          border: "1px solid #e2e8f0",
        },
        dot: { background: "#334155" },
        hint: { color: "#94a3b8" },
      };
  }
}

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 16px 35px rgba(15,23,42,0.06)",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
    boxShadow: "0 0 0 6px rgba(15,23,42,0.05)",
  },
  value: {
    fontSize: 32,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.8,
    lineHeight: 1.05,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: 600,
  },
};