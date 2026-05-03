"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatMinutesCompact, toMonthInputValue } from "@/lib/date";
import { triggerFileDownload } from "@/lib/download";
import { withSearch } from "@/lib/navigation";
import { toFiniteNumber } from "@/lib/number";

type PayrollRow = {
  id: number;
  employeeId: number;
  companyId: string;
  month: string;
  baseSalary: number;
  overtimeAmount: number;
  lateDeduction: number;
  absenceDeduction: number;
  finalSalary: number;
  totalWorkedMinutes: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  totalAbsentDays: number;
  createdAt: string;
};

function getCurrentMonth() {
  return toMonthInputValue(new Date());
}

function formatMoney(value?: number | string | null) {
  if (value === null || value === undefined) return "--";

  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return "--";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(normalized);
}

function formatMinutes(minutes?: number | string | null) {
  return formatMinutesCompact(minutes, { fallback: "--" });
}

export default function PayrollPage() {
  const router = useRouter();

  const [month, setMonth] = useState(getCurrentMonth());
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadPayroll = useCallback(async (targetMonth: string, showRefreshState = false) => {
    const selectedMonth = targetMonth;

    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      const result = await apiRequest<PayrollRow[]>(
        withSearch("/payroll", { month: selectedMonth }),
        {
          method: "GET",
          auth: true,
        },
      );

      setRows(Array.isArray(result) ? result : []);
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to load payroll");

      if (handleAuthError(error, router)) return;

      setMessage(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPayroll(getCurrentMonth());
  }, [loadPayroll]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((row) => {
      return (
        String(row.id).includes(q) ||
        String(row.employeeId).includes(q) ||
        row.month.toLowerCase().includes(q) ||
        String(row.baseSalary).includes(q) ||
        String(row.finalSalary).includes(q)
      );
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    return {
      totalRecords: rows.length,
      totalBaseSalary: rows.reduce(
        (sum, row) => sum + toFiniteNumber(row.baseSalary),
        0,
      ),
      totalOvertime: rows.reduce(
        (sum, row) => sum + toFiniteNumber(row.overtimeAmount),
        0,
      ),
      totalDeductions: rows.reduce(
        (sum, row) =>
          sum +
          toFiniteNumber(row.lateDeduction) +
          toFiniteNumber(row.absenceDeduction),
        0,
      ),
      totalNetSalary: rows.reduce(
        (sum, row) => sum + toFiniteNumber(row.finalSalary),
        0,
      ),
    };
  }, [rows]);

  async function handleGeneratePayroll() {
    try {
      setGenerating(true);
      setMessage("");

      await apiRequest("/payroll/generate", {
        method: "POST",
        auth: true,
        body: {
          month,
        },
      });

      setMessage(`Payroll generated successfully for ${month}`);
      await loadPayroll(month);
    } catch (error) {
      if (handleAuthError(error, router)) return;
      setMessage(getErrorMessage(error, "Failed to generate payroll"));
    } finally {
      setGenerating(false);
    }
  }

  function handleRefresh() {
    void loadPayroll(month, true);
  }

  function handleApplyMonth() {
    void loadPayroll(month);
  }

  async function handleDownloadPayslip(id: number) {
    try {
      const blob = await apiRequest<Blob>(`/payroll/payslip/${id}`, {
        method: "GET",
        auth: true,
        responseType: "blob",
      });

      triggerFileDownload(blob, `payslip-${id}.pdf`);
    } catch (error) {
      if (handleAuthError(error, router)) return;
      setMessage(getErrorMessage(error, "Failed to download payslip"));
    }
  }

  async function handleExportExcel() {
    try {
      const blob = await apiRequest<Blob>(
        withSearch("/payroll/export/excel", { month }),
        {
          method: "GET",
          auth: true,
          responseType: "blob",
        },
      );

      triggerFileDownload(blob, `payroll-${month}.xlsx`);
    } catch (error) {
      if (handleAuthError(error, router)) return;
      setMessage(getErrorMessage(error, "Failed to export payroll excel"));
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Payroll Management</h1>
          <p style={styles.pageSubtitle}>
            Generate monthly payroll, review salary calculations, and download
            payslips.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={handleRefresh}
            style={styles.secondaryButton}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={styles.primaryButton}
          >
            Export Excel
          </button>
        </div>
      </header>

      {message ? <div style={styles.alert}>{message}</div> : null}

      <section style={styles.card}>
        <div style={styles.toolbar}>
          <div>
            <h2 style={styles.cardTitle}>Payroll Actions</h2>
            <p style={styles.cardSubtitle}>
              Choose month, generate payroll, and load salary results.
            </p>
          </div>
        </div>

        <div style={styles.filterGrid}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={styles.input}
          />

          <button
            type="button"
            onClick={handleApplyMonth}
            style={styles.secondaryButton}
          >
            Load Payroll
          </button>

          <button
            type="button"
            onClick={handleGeneratePayroll}
            style={styles.primaryButton}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate Payroll"}
          </button>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Records</div>
          <div style={styles.statValue}>{stats.totalRecords}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Base Salaries</div>
          <div style={styles.statValueSmall}>
            {formatMoney(stats.totalBaseSalary)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Overtime</div>
          <div style={styles.statValueSmall}>
            {formatMoney(stats.totalOvertime)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Deductions</div>
          <div style={styles.statValueSmall}>
            {formatMoney(stats.totalDeductions)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Net Salaries</div>
          <div style={styles.statValueSmall}>
            {formatMoney(stats.totalNetSalary)}
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.toolbar}>
          <div>
            <h2 style={styles.cardTitle}>Payroll Records</h2>
            <p style={styles.cardSubtitle}>
              Search and review payroll records for the selected month.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search by employee ID, salary, month..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {loading ? (
          <div style={styles.emptyState}>Loading payroll...</div>
        ) : filteredRows.length === 0 ? (
          <div style={styles.emptyState}>
            No payroll records found for the selected month.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Employee ID</th>
                  <th style={styles.th}>Month</th>
                  <th style={styles.th}>Base Salary</th>
                  <th style={styles.th}>Overtime</th>
                  <th style={styles.th}>Late Deduction</th>
                  <th style={styles.th}>Absence Deduction</th>
                  <th style={styles.th}>Worked Time</th>
                  <th style={styles.th}>Late Time</th>
                  <th style={styles.th}>Overtime Time</th>
                  <th style={styles.th}>Absent Days</th>
                  <th style={styles.th}>Final Salary</th>
                  <th style={styles.th}>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{row.id}</td>
                    <td style={styles.tdStrong}>{row.employeeId}</td>
                    <td style={styles.td}>{row.month}</td>
                    <td style={styles.td}>{formatMoney(row.baseSalary)}</td>
                    <td style={styles.td}>{formatMoney(row.overtimeAmount)}</td>
                    <td style={styles.td}>{formatMoney(row.lateDeduction)}</td>
                    <td style={styles.td}>{formatMoney(row.absenceDeduction)}</td>
                    <td style={styles.td}>{formatMinutes(row.totalWorkedMinutes)}</td>
                    <td style={styles.td}>{formatMinutes(row.totalLateMinutes)}</td>
                    <td style={styles.td}>
                      {formatMinutes(row.totalOvertimeMinutes)}
                    </td>
                    <td style={styles.td}>{row.totalAbsentDays}</td>
                    <td style={styles.tdStrong}>
                      {formatMoney(row.finalSalary)}
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => handleDownloadPayslip(row.id)}
                        style={styles.payslipButton}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100%",
    background: "#f3f6fb",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 800,
    margin: 0,
  },
  pageSubtitle: {
    marginTop: 8,
    color: "#6b7280",
  },
  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
    minHeight: 180,
    marginBottom: 18,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 6,
  },
  cardSubtitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: 14,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#111827",
  },
  searchInput: {
    minWidth: 320,
    maxWidth: 420,
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#111827",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
  },
  payslipButton: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  statCard: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
  },
  statValueSmall: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1500,
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#374151",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "14px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#111827",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 14,
    color: "#6b7280",
    textAlign: "center",
  },
};
