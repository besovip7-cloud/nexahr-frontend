"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import {
  formatDateTimeSafe,
  formatMinutesCompact,
  getMonthStartDateInputValue,
  getTodayDateInputValue,
  isValidDateInputRange,
} from "@/lib/date";
import { withSearch } from "@/lib/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type MissingPunchRow = {
  id: string;
  employeeId: number;
  employeeName: string | null;
  date: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: "MISSING_PUNCH";
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
};

type MissingPunchResponse = {
  total: number;
  rows: MissingPunchRow[];
};

function formatMinutes(minutes?: number | null) {
  return formatMinutesCompact(minutes);
}

function formatDateTime(value?: string | null) {
  return formatDateTimeSafe(value, "-");
}

export default function MissingPunchPage() {
  const router = useRouter();

  const [from, setFrom] = useState(getMonthStartDateInputValue());
  const [to, setTo] = useState(getTodayDateInputValue());
  const [data, setData] = useState<MissingPunchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRows = useCallback(async (targetFrom: string, targetTo: string) => {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const result = await apiRequest<MissingPunchResponse>(
        withSearch("/attendance/missing-punch", {
          from: targetFrom,
          to: targetTo,
        }),
        {
          auth: true,
        },
      );

      setData(result || { total: 0, rows: [] });
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error("Failed to load missing punch rows", err);
      setError(getErrorMessage(err, "Failed to load missing punch rows."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadRows(getMonthStartDateInputValue(), getTodayDateInputValue());
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (!q) return true;

      return (
        String(row.employeeId).includes(q) ||
        (row.employeeName || "").toLowerCase().includes(q) ||
        row.date.toLowerCase().includes(q) ||
        (row.remarks || "").toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  async function handleApplyFilter() {
    if (!isValidDateInputRange(from, to)) {
      setError('Please select a valid date range where "From" is before "To".');
      setMessage("");
      return;
    }

    await loadRows(from, to);
  }

  async function handleRecalculate(row: MissingPunchRow) {
    const confirmed = window.confirm(
      `Recalculate attendance for employee ${row.employeeId} on ${row.date}?`,
    );

    if (!confirmed) return;

    try {
      setRecalculatingId(row.id);
      setMessage("");
      setError("");

      await apiRequest("/attendance/recalculate-day", {
        method: "POST",
        auth: true,
        body: {
          date: row.date,
          employeeId: row.employeeId,
        },
      });

      setMessage("Attendance recalculated successfully.");
      await loadRows(from, to);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      console.error("Failed to recalculate row", err);
      setError(getErrorMessage(err, "Failed to recalculate attendance."));
    } finally {
      setRecalculatingId(null);
    }
  }

  function openHistory(row: MissingPunchRow) {
    router.push(
      withSearch(`/dashboard/attendance/history/${row.employeeId}`, {
        from: row.date,
        to: row.date,
      }),
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Missing Punch Review"
        subtitle="Review and fix attendance rows that are missing check-in or check-out."
      />

      <SectionCard title="Filters">
        <div style={styles.filters}>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={styles.input}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={styles.input}
          />
          <input
            type="text"
            placeholder="Search employee, date, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.input}
          />
          <button type="button" onClick={handleApplyFilter} style={styles.primaryButton}>
            Load
          </button>
        </div>
      </SectionCard>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      <SectionCard title={`Missing Punch Rows (${filteredRows.length})`}>
        {loading ? (
          <div style={styles.emptyState}>Loading rows...</div>
        ) : filteredRows.length === 0 ? (
          <div style={styles.emptyState}>No missing punch rows found.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Scheduled</th>
                  <th style={styles.th}>Check In</th>
                  <th style={styles.th}>Check Out</th>
                  <th style={styles.th}>Late</th>
                  <th style={styles.th}>Worked</th>
                  <th style={styles.th}>Remarks</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>
                      <div style={styles.cellTitle}>
                        {row.employeeName || `Employee #${row.employeeId}`}
                      </div>
                      <div style={styles.cellSub}>{row.employeeId}</div>
                    </td>
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}>
                      {formatDateTime(row.scheduledStart)} <br />
                      {formatDateTime(row.scheduledEnd)}
                    </td>
                    <td style={styles.td}>{formatDateTime(row.checkIn)}</td>
                    <td style={styles.td}>{formatDateTime(row.checkOut)}</td>
                    <td style={styles.td}>{formatMinutes(row.lateMinutes)}</td>
                    <td style={styles.td}>{formatMinutes(row.workedMinutes)}</td>
                    <td style={styles.td}>{row.remarks || "-"}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => openHistory(row)}
                        >
                          History
                        </button>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => handleRecalculate(row)}
                          disabled={recalculatingId === row.id}
                        >
                          {recalculatingId === row.id
                            ? "Recalculating..."
                            : "Recalculate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 24,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "180px 180px minmax(220px, 1fr) auto",
    gap: 12,
  },
  input: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #dbe2ea",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  primaryButton: {
    minHeight: 44,
    padding: "0 18px",
    border: "none",
    borderRadius: 12,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 13,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
  },
  cellTitle: {
    fontWeight: 700,
    color: "#0f172a",
  },
  cellSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid #dbe2ea",
    borderRadius: 10,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  },
  success: {
    borderRadius: 12,
    padding: "12px 14px",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 14,
    border: "1px solid #bbf7d0",
  },
  error: {
    borderRadius: 12,
    padding: "12px 14px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 14,
    border: "1px solid #fecaca",
  },
  emptyState: {
    padding: 24,
    color: "#64748b",
    textAlign: "center",
  },
};
