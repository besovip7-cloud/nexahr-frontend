"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearAuthTokens, getAccessToken } from "@/lib/auth";

type Employee = {
  id: number;
  fullName: string;
  role?: string;
  isActive?: boolean;
  monthlySalary?: number | null;
  companyId?: string;

  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;

  location?: string | null;
  entity?: string | null;
  unit?: string | null;
  department?: string | null;
  section?: string | null;
  hireDate?: string | null;
  jobTitle?: string | null;
  level?: string | null;
  grade?: string | null;
  functionalReportingTo?: string | null;
  shift?: string | null;
  companyPhoneNumber?: string | null;
  education?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  ss?: string | null;
  gender?: string | null;
  telegramUser?: string | null;

  createdAt?: string;
  updatedAt?: string;
};

type Shift = {
  id: number;
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  crossesMidnight: boolean;
  graceMinutes: number;
  workHoursPerDay: number;
  minuteRate: number;
};

type EmployeeProfileResponse = {
  employee: Employee;
};

type EmployeeFormState = {
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  monthlySalary: string;
  location: string;
  entity: string;
  unit: string;
  department: string;
  section: string;
  hireDate: string;
  jobTitle: string;
  level: string;
  grade: string;
  functionalReportingTo: string;
  shift: string;
  shiftId: string;
  companyPhoneNumber: string;
  education: string;
  birthDate: string;
  nationality: string;
  ss: string;
  gender: string;
  telegramUser: string;
  isActive: boolean;
};

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function formatShiftTime(hour?: number, minute?: number) {
  if (hour === undefined || minute === undefined) return "--";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createInitialForm(): EmployeeFormState {
  return {
    fullName: "",
    email: "",
    phone: "",
    employeeCode: "",
    monthlySalary: "",
    location: "",
    entity: "",
    unit: "",
    department: "",
    section: "",
    hireDate: "",
    jobTitle: "",
    level: "",
    grade: "",
    functionalReportingTo: "",
    shift: "",
    shiftId: "",
    companyPhoneNumber: "",
    education: "",
    birthDate: "",
    nationality: "",
    ss: "",
    gender: "",
    telegramUser: "",
    isActive: true,
  };
}

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params?.id as string;

  const [form, setForm] = useState<EmployeeFormState>(createInitialForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    async function loadEmployee() {
      const token = getAccessToken();

      if (!token) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      try {
        setLoading(true);
        setMessage("");

        const data = await apiRequest<EmployeeProfileResponse>(
          `/employees/${employeeId}/profile`,
          {
            method: "GET",
            auth: true,
          }
        );

        const employee = data.employee;

        setEmployeeName(employee.fullName || "");

        setForm({
          fullName: employee.fullName || "",
          email: employee.email || "",
          phone: employee.phone || "",
          employeeCode: employee.employeeCode || "",
          monthlySalary:
            employee.monthlySalary !== null &&
            employee.monthlySalary !== undefined
              ? String(employee.monthlySalary)
              : "",
          location: employee.location || "",
          entity: employee.entity || "",
          unit: employee.unit || "",
          department: employee.department || "",
          section: employee.section || "",
          hireDate: toDateInputValue(employee.hireDate),
          jobTitle: employee.jobTitle || "",
          level: employee.level || "",
          grade: employee.grade || "",
          functionalReportingTo: employee.functionalReportingTo || "",
          shift: employee.shift || "",
          shiftId: "",
          companyPhoneNumber: employee.companyPhoneNumber || "",
          education: employee.education || "",
          birthDate: toDateInputValue(employee.birthDate),
          nationality: employee.nationality || "",
          ss: employee.ss || "",
          gender: employee.gender || "",
          telegramUser: employee.telegramUser || "",
          isActive: employee.isActive ?? true,
        });
      } catch (error: any) {
        const text = String(error?.message || "").toLowerCase();

        if (text.includes("unauthorized") || text.includes("forbidden")) {
          clearAuthTokens();
          router.replace("/login");
          return;
        }

        setMessage(error?.message || "Failed to load employee data");
      } finally {
        setLoading(false);
      }
    }

    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId, router]);

  useEffect(() => {
    async function loadShifts() {
      try {
        const data = await apiRequest<Shift[]>("/shifts", {
          method: "GET",
          auth: true,
        });

        setShifts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load shifts", error);
      }
    }

    loadShifts();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const token = getAccessToken();

    if (!token) {
      clearAuthTokens();
      router.replace("/login");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        employeeCode: form.employeeCode.trim() || null,
        monthlySalary: form.monthlySalary.trim()
          ? Number(form.monthlySalary)
          : null,
        location: form.location.trim() || null,
        entity: form.entity.trim() || null,
        unit: form.unit.trim() || null,
        department: form.department.trim() || null,
        section: form.section.trim() || null,
        hireDate: form.hireDate || null,
        jobTitle: form.jobTitle.trim() || null,
        level: form.level.trim() || null,
        grade: form.grade.trim() || null,
        functionalReportingTo: form.functionalReportingTo.trim() || null,
        shift: form.shift.trim() || null,
        shiftId: form.shiftId ? Number(form.shiftId) : null,
        companyPhoneNumber: form.companyPhoneNumber.trim() || null,
        education: form.education.trim() || null,
        birthDate: form.birthDate || null,
        nationality: form.nationality.trim() || null,
        ss: form.ss.trim() || null,
        gender: form.gender.trim() || null,
        telegramUser: form.telegramUser.trim() || null,
        isActive: form.isActive,
      };

      await apiRequest(`/employees/${employeeId}`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify(payload),
      });

      router.push(`/employees/${employeeId}`);
    } catch (error: any) {
      const text = String(error?.message || "").toLowerCase();

      if (text.includes("unauthorized") || text.includes("forbidden")) {
        clearAuthTokens();
        router.replace("/login");
        return;
      }

      setMessage(error?.message || "Failed to update employee");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    router.push(`/employees/${employeeId}`);
  }

  function handleLogout() {
    clearAuthTokens();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <h2 style={styles.loadingTitle}>Loading employee form...</h2>
          <p style={styles.loadingText}>Please wait a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.logoBox}>
            <div style={styles.logoBadge}>N</div>
            <div>
              <div style={styles.logoTitle}>NexaHR</div>
              <div style={styles.logoSub}>HR & Attendance SaaS</div>
            </div>
          </div>

          <nav style={styles.nav}>
            <button
              style={styles.navItem}
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </button>

            <button
              style={styles.navItem}
              onClick={() => router.push("/employees")}
            >
              Employees
            </button>

            <button style={styles.navItem}>Attendance</button>
            <button style={styles.navItem}>Branches</button>
            <button style={styles.navItem}>Payroll</button>
            <button style={styles.navItem}>Settings</button>
          </nav>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <button onClick={handleCancel} style={styles.backButton}>
              ← Back to Profile
            </button>

            <h1 style={styles.pageTitle}>Edit Employee</h1>
            <p style={styles.pageSubtitle}>
              Update employee information for {employeeName || "this employee"}
            </p>
          </div>

          <div style={styles.headerBadge}>Employee ID: {employeeId}</div>
        </header>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <form onSubmit={handleSubmit} style={styles.formWrapper}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Basic Information</h2>

            <div style={styles.formGrid}>
              <FormField
                label="Full Name"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
              />

              <FormField
                label="Email"
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
              />

              <FormField
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />

              <FormField
                label="Employee Code"
                name="employeeCode"
                value={form.employeeCode}
                onChange={handleChange}
              />

              <FormField
                label="Company Phone Number"
                name="companyPhoneNumber"
                value={form.companyPhoneNumber}
                onChange={handleChange}
              />

              <FormField
                label="Telegram User"
                name="telegramUser"
                value={form.telegramUser}
                onChange={handleChange}
              />

              <FormField
                label="Gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
              />

              <FormField
                label="Nationality"
                name="nationality"
                value={form.nationality}
                onChange={handleChange}
              />

              <FormField
                label="Birth Date"
                name="birthDate"
                value={form.birthDate}
                onChange={handleChange}
                type="date"
              />

              <FormField
                label="S.S"
                name="ss"
                value={form.ss}
                onChange={handleChange}
              />
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Organization Structure</h2>

            <div style={styles.formGrid}>
              <FormField
                label="Location"
                name="location"
                value={form.location}
                onChange={handleChange}
              />

              <FormField
                label="Entity"
                name="entity"
                value={form.entity}
                onChange={handleChange}
              />

              <FormField
                label="Unit"
                name="unit"
                value={form.unit}
                onChange={handleChange}
              />

              <FormField
                label="Department"
                name="department"
                value={form.department}
                onChange={handleChange}
              />

              <FormField
                label="Section"
                name="section"
                value={form.section}
                onChange={handleChange}
              />

              <FormField
                label="Functional Reporting To"
                name="functionalReportingTo"
                value={form.functionalReportingTo}
                onChange={handleChange}
              />
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Job Details</h2>

            <div style={styles.formGrid}>
              <FormField
                label="Job Title"
                name="jobTitle"
                value={form.jobTitle}
                onChange={handleChange}
              />

              <FormField
                label="Level"
                name="level"
                value={form.level}
                onChange={handleChange}
              />

              <FormField
                label="Grade"
                name="grade"
                value={form.grade}
                onChange={handleChange}
              />

              <div style={styles.fieldWrap}>
                <label htmlFor="shiftId" style={styles.fieldLabel}>
                  Shift
                </label>

                <select
                  id="shiftId"
                  name="shiftId"
                  value={form.shiftId}
                  onChange={handleChange}
                  style={styles.input}
                >
                  <option value="">Select Shift</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} (
                      {formatShiftTime(shift.startHour, shift.startMinute)} -{" "}
                      {formatShiftTime(shift.endHour, shift.endMinute)})
                    </option>
                  ))}
                </select>
              </div>

              <FormField
                label="Monthly Salary"
                name="monthlySalary"
                value={form.monthlySalary}
                onChange={handleChange}
                type="number"
              />

              <FormField
                label="Hire Date"
                name="hireDate"
                value={form.hireDate}
                onChange={handleChange}
                type="date"
              />
            </div>

            <div style={styles.toggleRow}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                <span>Employee is active</span>
              </label>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Additional Information</h2>

            <div style={styles.formGrid}>
              <FormField
                label="Education"
                name="education"
                value={form.education}
                onChange={handleChange}
              />
            </div>
          </section>

          <div style={styles.actionsBar}>
            <button
              type="button"
              onClick={handleCancel}
              style={styles.secondaryButton}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div style={styles.fieldWrap}>
      <label htmlFor={name} style={styles.fieldLabel}>
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    background: "#f3f6fb",
    color: "#111827",
  },

  sidebar: {
    background: "#111827",
    color: "#ffffff",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "100vh",
  },

  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },

  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#ffffff",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 20,
  },

  logoTitle: {
    fontSize: 20,
    fontWeight: 700,
  },

  logoSub: {
    fontSize: 12,
    opacity: 0.75,
  },

  nav: {
    display: "grid",
    gap: 10,
  },

  navItem: {
    background: "transparent",
    color: "#d1d5db",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 14,
  },

  logoutButton: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600,
  },

  main: {
    padding: 28,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },

  backButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    padding: 0,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: 600,
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

  headerBadge: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
  },

  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },

  formWrapper: {
    display: "grid",
    gap: 18,
  },

  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
    border: "1px solid #eef2f7",
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 18,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },

  fieldWrap: {
    display: "grid",
    gap: 8,
  },

  fieldLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 600,
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    outline: "none",
    fontSize: 14,
    background: "#ffffff",
    color: "#111827",
  },

  toggleRow: {
    marginTop: 18,
    paddingTop: 18,
    borderTop: "1px solid #f3f4f6",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
  },

  actionsBar: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 4,
    flexWrap: "wrap",
  },

  primaryButton: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },

  secondaryButton: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
  },

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f6fb",
    padding: 24,
  },

  loadingCard: {
    background: "#ffffff",
    padding: 32,
    borderRadius: 20,
    boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
    textAlign: "center",
    minWidth: 320,
  },

  loadingTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 8,
  },

  loadingText: {
    color: "#6b7280",
    marginBottom: 16,
  },
};