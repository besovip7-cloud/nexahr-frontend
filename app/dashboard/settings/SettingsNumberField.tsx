"use client";

import type { CSSProperties } from "react";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export default function SettingsNumberField({
  label,
  value,
  onChange,
}: Props) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.input}
      />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    width: "100%",
    borderRadius: "16px",
    border: "1px solid #dbe5f0",
    background: "#ffffff",
    color: "#0f172a",
    padding: "14px 15px",
    fontSize: "14px",
    outline: "none",
  },
};