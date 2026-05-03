"use client";

import type { CSSProperties } from "react";

type SelectOption = {
  label: string;
  value: string;
};

type Props = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
};

export default function SettingsSelectField({
  label,
  value,
  onChange,
  options,
}: Props) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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