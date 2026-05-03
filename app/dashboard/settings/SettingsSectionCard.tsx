"use client";

import type { CSSProperties, ReactNode } from "react";

export default function SettingsSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.description}>{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: "26px",
    padding: "22px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 30px rgba(15,23,42,0.05)",
  },
  header: {
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  description: {
    margin: "8px 0 0",
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#64748b",
  },
};