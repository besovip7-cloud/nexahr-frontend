"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { toDateInputValue } from "@/lib/date";
import { parsePositiveInt, toFiniteNumber } from "@/lib/number";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";

type AppRole = "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";

type Branch = {
  id: number;
  name: string;
};

type EmployeeApiResponse =
  | Employee
  | {
      employee?: Employee | null;
      data?: Employee | null;
    }
  | null;

type BranchesApiResponse =
  | Branch[]
  | {
      data?: Branch[];
    }
  | null;

type Employee = {
  id: number;
  fullName: string;
  role?: AppRole;
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

  branchId?: number | null;

  companyPhoneNumber?: string | null;
  education?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  ss?: string | null;
  gender?: string | null;
  telegramUser?: string | null;
};

type EmployeeFormData = {
  fullName: string;
  role: AppRole;
  isActive: boolean;
  monthlySalary: string;

  email: string;
  phone: string;
  employeeCode: string;

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

  branchId: string;

  companyPhoneNumber: string;
  education: string;
  birthDate: string;
  nationality: string;
  ss: string;
  gender: string;
  telegramUser: string;
};

const emptyForm: EmployeeFormData = {
  fullName: "",
  role: "EMPLOYEE",
  isActive: true,
  monthlySalary: "",

  email: "",
  phone: "",
  employeeCode: "",

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

  branchId: "",

  companyPhoneNumber: "",
  education: "",
  birthDate: "",
  nationality: "",
  ss: "",
  gender: "",
  telegramUser: "",
};

function normalizeDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : "";
  }
  return toDateInputValue(date);
}

export default function EditEmployeePage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const employeeId = parsePositiveInt(params?.id);

  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const redirectTimeoutRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    if (!employeeId) {
      setMessage("Invalid employee ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const [employeeResult, branchesResult] = await Promise.all([
        apiRequest<EmployeeApiResponse>(`/employees/${employeeId}`, {
          method: "GET",
          auth: true,
        }),
        apiRequest<BranchesApiResponse>(`/branches`, {
          method: "GET",
          auth: true,
        }),
      ]);

      const employeeCandidate =
        employeeResult &&
        typeof employeeResult === "object" &&
        !Array.isArray(employeeResult)
          ? "employee" in employeeResult
            ? employeeResult.employee
            : "data" in employeeResult
              ? employeeResult.data
              : employeeResult
          : null;

      const employee = (employeeCandidate as Employee | null) ?? null;

      const branchItems = Array.isArray(branchesResult)
        ? branchesResult
        : Array.isArray(branchesResult?.data)
          ? branchesResult.data
          : [];

      if (!employee || typeof employee !== "object") {
        setMessage("Employee not found.");
        return;
      }

      setBranches(branchItems);

      setForm({
        fullName: employee.fullName || "",
        role: employee.role || "EMPLOYEE",
        isActive: employee.isActive !== false,
        monthlySalary:
          employee.monthlySalary === null || employee.monthlySalary === undefined
            ? ""
            : String(employee.monthlySalary),

        email: employee.email || "",
        phone: employee.phone || "",
        employeeCode: employee.employeeCode || "",

        location: employee.location || "",
        entity: employee.entity || "",
        unit: employee.unit || "",
        department: employee.department || "",
        section: employee.section || "",
        hireDate: normalizeDateInput(employee.hireDate),
        jobTitle: employee.jobTitle || "",
        level: employee.level || "",
        grade: employee.grade || "",
        functionalReportingTo: employee.functionalReportingTo || "",
        shift: employee.shift || "",

        branchId:
          employee.branchId === null || employee.branchId === undefined
            ? ""
            : String(employee.branchId),

        companyPhoneNumber: employee.companyPhoneNumber || "",
        education: employee.education || "",
        birthDate: normalizeDateInput(employee.birthDate),
        nationality: employee.nationality || "",
        ss: employee.ss || "",
        gender: employee.gender || "",
        telegramUser: employee.telegramUser || "",
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to load employee data");

      if (handleAuthError(error, router)) return;

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [employeeId, router]);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      setMessage("Invalid employee ID.");
      return;
    }

    void loadData();
  }, [employeeId, loadData]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  function setField<K extends keyof EmployeeFormData>(
    key: K,
    value: EmployeeFormData[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const selectedBranchInfo = useMemo(() => {
    return branches.find((branch) => String(branch.id) === form.branchId) || null;
  }, [branches, form.branchId]);

  function validate() {
    if (!form.fullName.trim()) {
      setMessage("Full name is required.");
      return false;
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setMessage("Please enter a valid email address.");
      return false;
    }

    const monthlySalaryRaw = form.monthlySalary.trim();
    const monthlySalary =
      monthlySalaryRaw === "" ? 0 : toFiniteNumber(monthlySalaryRaw, Number.NaN);

    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      setMessage("Please enter a valid monthly salary.");
      return false;
    }

    if (form.branchId && !parsePositiveInt(form.branchId)) {
      setMessage("Please select a valid branch.");
      return false;
    }

    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    const monthlySalaryRaw = form.monthlySalary.trim();
    const monthlySalary =
      monthlySalaryRaw === "" ? 0 : toFiniteNumber(monthlySalaryRaw);
    const branchId = form.branchId ? parsePositiveInt(form.branchId) : null;

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        fullName: form.fullName.trim(),
        role: form.role,
        isActive: form.isActive,
        monthlySalary,

        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        employeeCode: form.employeeCode.trim() || null,

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

        branchId,

        companyPhoneNumber: form.companyPhoneNumber.trim() || null,
        education: form.education.trim() || null,
        birthDate: form.birthDate || null,
        nationality: form.nationality.trim() || null,
        ss: form.ss.trim() || null,
        gender: form.gender.trim() || null,
        telegramUser: form.telegramUser.trim() || null,
      };

      const result = await apiRequest<{ message?: string }>(
        `/employees/${employeeId}`,
        {
          method: "PATCH",
          auth: true,
          body: payload,
        },
      );

      setMessage(result?.message || "Employee updated successfully.");

      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      redirectTimeoutRef.current = window.setTimeout(() => {
        router.push(`/dashboard/employees/${employeeId}`);
      }, 700);
    } catch (error) {
      if (handleAuthError(error, router)) return;
      setMessage(getErrorMessage(error, "Failed to update employee"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading employee form...</div>;
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Edit Employee"
        subtitle="Update employee information, organizational placement, and branch assignment."
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/employees/${employeeId}`)}
              style={styles.secondaryButton}
            >
              Back to Profile
            </button>

            <button
              type="button"
              onClick={loadData}
              style={styles.secondaryButton}
            >
              Refresh
            </button>
          </>
        }
      />

      {message ? <div style={styles.alert}>{message}</div> : null}

      <form onSubmit={handleSubmit} style={styles.formLayout}>
        <SectionCard
          title="Basic Information"
          subtitle="Core employee identity and contact details."
        >
          <div style={styles.grid}>
            <Field label="Full Name">
              <input
                style={styles.input}
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                placeholder="Enter full name"
              />
            </Field>

            <Field label="Role">
              <select
                style={styles.input}
                value={form.role}
                onChange={(e) => setField("role", e.target.value as AppRole)}
              >
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
              </select>
            </Field>

            <Field label="Email">
              <input
                style={styles.input}
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="Enter email"
              />
            </Field>

            <Field label="Phone">
              <input
                style={styles.input}
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="Enter phone"
              />
            </Field>

            <Field label="Employee Code">
              <input
                style={styles.input}
                value={form.employeeCode}
                onChange={(e) => setField("employeeCode", e.target.value)}
                placeholder="Enter employee code"
              />
            </Field>

            <Field label="Monthly Salary">
              <input
                style={styles.input}
                type="number"
                value={form.monthlySalary}
                onChange={(e) => setField("monthlySalary", e.target.value)}
                placeholder="Enter monthly salary"
              />
            </Field>

            <Field label="Company Phone">
              <input
                style={styles.input}
                value={form.companyPhoneNumber}
                onChange={(e) => setField("companyPhoneNumber", e.target.value)}
                placeholder="Enter company phone"
              />
            </Field>

            <Field label="Active Status">
              <select
                style={styles.input}
                value={form.isActive ? "true" : "false"}
                onChange={(e) => setField("isActive", e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Employment Information"
          subtitle="Department, role level, branch, and assignment structure."
        >
          <div style={styles.grid}>
            <Field label="Branch">
              <div style={styles.branchFieldWrap}>
                <select
                  style={styles.input}
                  value={form.branchId}
                  onChange={(e) => setField("branchId", e.target.value)}
                >
                  <option value="">No Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </option>
                  ))}
                </select>

                <div style={styles.helperText}>
                  Selected branch: {selectedBranchInfo?.name || "No Branch"}
                </div>
              </div>
            </Field>

            <Field label="Department">
              <input
                style={styles.input}
                value={form.department}
                onChange={(e) => setField("department", e.target.value)}
                placeholder="Enter department"
              />
            </Field>

            <Field label="Section">
              <input
                style={styles.input}
                value={form.section}
                onChange={(e) => setField("section", e.target.value)}
                placeholder="Enter section"
              />
            </Field>

            <Field label="Unit">
              <input
                style={styles.input}
                value={form.unit}
                onChange={(e) => setField("unit", e.target.value)}
                placeholder="Enter unit"
              />
            </Field>

            <Field label="Entity">
              <input
                style={styles.input}
                value={form.entity}
                onChange={(e) => setField("entity", e.target.value)}
                placeholder="Enter entity"
              />
            </Field>

            <Field label="Job Title">
              <input
                style={styles.input}
                value={form.jobTitle}
                onChange={(e) => setField("jobTitle", e.target.value)}
                placeholder="Enter job title"
              />
            </Field>

            <Field label="Level">
              <input
                style={styles.input}
                value={form.level}
                onChange={(e) => setField("level", e.target.value)}
                placeholder="Enter level"
              />
            </Field>

            <Field label="Grade">
              <input
                style={styles.input}
                value={form.grade}
                onChange={(e) => setField("grade", e.target.value)}
                placeholder="Enter grade"
              />
            </Field>

            <Field label="Functional Reporting To">
              <input
                style={styles.input}
                value={form.functionalReportingTo}
                onChange={(e) =>
                  setField("functionalReportingTo", e.target.value)
                }
                placeholder="Enter reporting manager"
              />
            </Field>

            <Field label="Shift">
              <input
                style={styles.input}
                value={form.shift}
                onChange={(e) => setField("shift", e.target.value)}
                placeholder="Enter shift"
              />
            </Field>

            <Field label="Hire Date">
              <input
                style={styles.input}
                type="date"
                value={form.hireDate}
                onChange={(e) => setField("hireDate", e.target.value)}
              />
            </Field>

            <Field label="Location">
              <input
                style={styles.input}
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="Enter location"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Additional Details"
          subtitle="Personal and secondary HR details."
        >
          <div style={styles.grid}>
            <Field label="Education">
              <input
                style={styles.input}
                value={form.education}
                onChange={(e) => setField("education", e.target.value)}
                placeholder="Enter education"
              />
            </Field>

            <Field label="Birth Date">
              <input
                style={styles.input}
                type="date"
                value={form.birthDate}
                onChange={(e) => setField("birthDate", e.target.value)}
              />
            </Field>

            <Field label="Nationality">
              <input
                style={styles.input}
                value={form.nationality}
                onChange={(e) => setField("nationality", e.target.value)}
                placeholder="Enter nationality"
              />
            </Field>

            <Field label="SS">
              <input
                style={styles.input}
                value={form.ss}
                onChange={(e) => setField("ss", e.target.value)}
                placeholder="Enter SS"
              />
            </Field>

            <Field label="Gender">
              <input
                style={styles.input}
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
                placeholder="Enter gender"
              />
            </Field>

            <Field label="Telegram User">
              <input
                style={styles.input}
                value={form.telegramUser}
                onChange={(e) => setField("telegramUser", e.target.value)}
                placeholder="Enter Telegram username"
              />
            </Field>
          </div>
        </SectionCard>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push(`/dashboard/employees/${employeeId}`)}
          >
            Cancel
          </button>

          <button type="submit" style={styles.primaryButton} disabled={saving}>
            {saving ? "Saving..." : "Save Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100%",
    background: "transparent",
    color: "#111827",
  },
  loading: {
    padding: 40,
  },
  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  formLayout: {
    display: "grid",
    gap: 18,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },
  branchFieldWrap: {
    display: "grid",
    gap: 8,
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.7,
  },
  input: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    border: "1px solid #dbe4ee",
    padding: "0 14px",
    fontSize: 14,
    background: "#fff",
    outline: "none",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
};
