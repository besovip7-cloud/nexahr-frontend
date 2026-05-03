"use client";

import type { CSSProperties, ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
};

export default function SectionCard({
  title,
  subtitle,
  right,
  children,
}: SectionCardProps) {
  return (
    <section style={styles.card}>
      {title || subtitle || right ? (
        <div style={styles.header}>
          <div>
            {title ? <h2 style={styles.title}>{title}</h2> : null}
            {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
          </div>

          {right ? <div>{right}</div> : null}
        </div>
      ) : null}

      <div>{children}</div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.94)",
    borderRadius: 28,
    padding: 22,
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 18px 45px rgba(15,23,42,0.07)",
    marginBottom: 18,
    backdropFilter: "blur(10px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  subtitle: {
    margin: "7px 0 0 0",
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.6,
  },
};