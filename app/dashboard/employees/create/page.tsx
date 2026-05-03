"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { parsePositiveInt, toFiniteNumber } from "@/lib/number";
import { joinUiSegments } from "@/lib/ui-text";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";
import StatCard from "@/components/dashboard/StatCard";

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

type Branch = {
  id: number;
  name: string;
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
  branchId: string;
  companyPhoneNumber: string;
  education: string;
  birthDate: string;
  nationality: string;
  ss: string;
  gender: string;
  telegramUser: string;
  isActive: boolean;
};

type ArrayResponse<T> = T[] | { data?: T[] };
type CreatedEmployee = { id?: number };
type CreateEmployeeResponse =
  | CreatedEmployee
  | {
      employee?: CreatedEmployee;
      data?: CreatedEmployee;
    };

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
    branchId: "",
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

function formatShiftTime(hour?: number, minute?: number) {
  if (hour === undefined || minute === undefined) return "--";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getInitials(name?: string | null) {
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "NA";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function formatMoney(value?: string | number | null) {
  const num = toFiniteNumber(value, Number.NaN);
  if (Number.isNaN(num)) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(num);
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return getErrorMessage(error, fallback);
}

function toArray<T>(value: ArrayResponse<T>): T[] {
  return Array.isArray(value) ? value : Array.isArray(value.data) ? value.data : [];
}

function getCreatedEmployeeId(value: CreateEmployeeResponse): number | null {
  const directId =
    "id" in value && typeof value.id === "number" ? value.id : null;
  if (directId) return directId;

  if ("employee" in value && typeof value.employee?.id === "number") {
    return value.employee.id;
  }

  if ("data" in value && typeof value.data?.id === "number") {
    return value.data.id;
  }

  return null;
}

export default function CreateEmployeePage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [form, setForm] = useState<EmployeeFormState>(createInitialForm());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingShifts(true);
        setLoadingBranches(true);

        const [shiftsData, branchesData] = await Promise.all([
          apiRequest<ArrayResponse<Shift>>("/shifts", {
            method: "GET",
            auth: true,
          }),
          apiRequest<ArrayResponse<Branch>>("/branches", {
            method: "GET",
            auth: true,
          }),
        ]);

        setShifts(toArray(shiftsData));
        setBranches(toArray(branchesData));
      } catch (error: unknown) {
        if (handleAuthError(error, router)) return;
        setMessage(resolveErrorMessage(error, "Failed to load initial form data"));
      } finally {
        setLoadingShifts(false);
        setLoadingBranches(false);
      }
    }

    loadInitialData();
  }, [router]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const selectedShift = useMemo(() => {
    return shifts.find((shift) => String(shift.id) === form.shiftId) || null;
  }, [shifts, form.shiftId]);

  const selectedBranch = useMemo(() => {
    return branches.find((branch) => String(branch.id) === form.branchId) || null;
  }, [branches, form.branchId]);

  const completion = useMemo(() => {
    const fields = [
      form.fullName,
      form.email,
      form.phone,
      form.employeeCode,
      form.monthlySalary,
      form.location,
      form.department,
      form.jobTitle,
      form.hireDate,
      form.gender,
      form.nationality,
      form.branchId,
      photoFile?.name,
    ];

    const filled = fields.filter((item) => !!String(item || "").trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [form, photoFile]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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

  async function handlePhotoSelect(file: File) {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Only JPG, JPEG, PNG, and WEBP images are allowed.");
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setMessage("");
  }

  async function uploadEmployeePhoto(employeeId: number, file: File) {
    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiRequest<{ message?: string }>(`/employees/${employeeId}/photo`, {
        method: "POST",
        auth: true,
        body: formData,
      });

      return data;
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.fullName.trim()) {
      setMessage("Full Name is required.");
      return;
    }

    const monthlySalaryRaw = form.monthlySalary.trim();
    const monthlySalary =
      monthlySalaryRaw === "" ? 0 : toFiniteNumber(monthlySalaryRaw, Number.NaN);

    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      setMessage("Please enter a valid monthly salary.");
      return;
    }

    const shiftId = form.shiftId ? parsePositiveInt(form.shiftId) : null;
    if (form.shiftId && !shiftId) {
      setMessage("Please select a valid shift.");
      return;
    }

    const branchId = form.branchId ? parsePositiveInt(form.branchId) : null;
    if (form.branchId && !branchId) {
      setMessage("Please select a valid branch.");
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
        monthlySalary,
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
        shiftId,
        branchId,
        companyPhoneNumber: form.companyPhoneNumber.trim() || null,
        education: form.education.trim() || null,
        birthDate: form.birthDate || null,
        nationality: form.nationality.trim() || null,
        ss: form.ss.trim() || null,
        gender: form.gender.trim() || null,
        telegramUser: form.telegramUser.trim() || null,
        isActive: form.isActive,
      };

      const created = await apiRequest<CreateEmployeeResponse>("/employees", {
        method: "POST",
        auth: true,
        body: payload,
      });

      const createdId = getCreatedEmployeeId(created);

      if (createdId && photoFile) {
        await uploadEmployeePhoto(createdId, photoFile);
      }

      if (createdId) {
        router.push(`/dashboard/employees/${createdId}`);
        return;
      }

      router.push("/dashboard/employees");
    } catch (error: unknown) {
      const errorMessage = resolveErrorMessage(error, "Failed to create employee");

      if (handleAuthError(error, router)) return;

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    router.push("/dashboard/employees");
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setMessage("");

      const [shiftsData, branchesData] = await Promise.all([
        apiRequest<ArrayResponse<Shift>>("/shifts", {
          method: "GET",
          auth: true,
        }),
        apiRequest<ArrayResponse<Branch>>("/branches", {
          method: "GET",
          auth: true,
        }),
      ]);

      setShifts(toArray(shiftsData));
      setBranches(toArray(branchesData));
    } catch (error: unknown) {
      if (handleAuthError(error, router)) return;
      setMessage(resolveErrorMessage(error, "Failed to refresh form data"));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Create Employee"
        subtitle="Create a complete employee profile with identity, role, salary, organization details, branch assignment, and profile image."
        actions={
          <>
            <button onClick={handleCancel} style={styles.secondaryButton}>
              Back to Employees
            </button>

            <button onClick={handleRefresh} style={styles.secondaryButton}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              style={styles.primaryButton}
              disabled={saving || uploadingPhoto}
            >
              {saving ? "Creating..." : "Create Employee"}
            </button>
          </>
        }
      />

      {message ? <div style={styles.alert}>{message}</div> : null}

      <section style={styles.heroGrid}>
        <div style={styles.heroCard}>
            <div style={styles.avatarWrap}>
              {photoPreview ? (
                <Image
                  src={photoPreview}
                  alt="Employee Preview"
                  fill
                  sizes="112px"
                  style={styles.avatarImage}
                  unoptimized
                />
              ) : (
              <div style={styles.avatarFallback}>
                {getInitials(form.fullName || "NA")}
              </div>
            )}
          </div>

          <div style={styles.heroBody}>
            <div style={styles.heroKicker}>New Employee Profile</div>
            <h1 style={styles.heroTitle}>{form.fullName || "Employee Name"}</h1>
            <p style={{ ...styles.heroText, display: "none" }} aria-hidden="true">
              {form.jobTitle || "No job title"}
              {form.department ? ` \u2022 ${form.department}` : ""}
              {selectedBranch ? ` \u2022 ${selectedBranch.name}` : ""}
              {form.location ? ` \u2022 ${form.location}` : ""}
            </p>

            <p style={styles.heroText}>
              {joinUiSegments([
                form.jobTitle || "No job title",
                form.department,
                selectedBranch?.name,
                form.location,
              ])}
            </p>

            <div style={styles.heroBadges}>
              <div style={styles.heroBadge}>
                Salary: {formatMoney(form.monthlySalary)}
              </div>
              <div style={styles.heroBadge}>Profile Completion: {completion}%</div>
              <div
                style={
                  form.isActive ? styles.statusActiveBadge : styles.statusInactiveBadge
                }
              >
                {form.isActive ? "Active" : "Inactive"}
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sideCard}>
          <div style={styles.sideTitle}>Creation Snapshot</div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Selected Shift</span>
            <span style={styles.snapshotValue}>
              {selectedShift ? selectedShift.name : "--"}
            </span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Selected Branch</span>
            <span style={styles.snapshotValue}>
              {loadingBranches ? "..." : selectedBranch?.name || "--"}
            </span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Department</span>
            <span style={styles.snapshotValue}>{form.department || "--"}</span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Hire Date</span>
            <span style={styles.snapshotValue}>{form.hireDate || "--"}</span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Salary</span>
            <span style={styles.snapshotValue}>
              {formatMoney(form.monthlySalary)}
            </span>
          </div>
        </div>
      </section>

      <div style={styles.statsGrid}>
        <StatCard
          label="Selected Shift"
          value={selectedShift?.name || "--"}
          hint="Chosen shift assignment"
          tone="primary"
        />
        <StatCard
          label="Selected Branch"
          value={loadingBranches ? "..." : selectedBranch?.name || "--"}
          hint="Initial branch assignment"
          tone="default"
        />
        <StatCard
          label="Monthly Salary"
          value={formatMoney(form.monthlySalary)}
          hint="Salary in current form"
          tone="warning"
        />
        <StatCard
          label="Profile Status"
          value={form.isActive ? "Active" : "Inactive"}
          hint="Initial employee state"
          tone={form.isActive ? "success" : "danger"}
        />
        <StatCard
          label="Available Shifts"
          value={loadingShifts ? "..." : shifts.length}
          hint="Loaded shift definitions"
          tone="default"
        />
      </div>

      <form
        ref={formRef}
        id="employee-create-form"
        onSubmit={handleSubmit}
        style={styles.formWrapper}
      >
        <div style={styles.mainGrid}>
          <SectionCard
            title="Profile Image"
            subtitle="Upload a professional image for this employee profile."
          >
            <div style={styles.imageSection}>
              <div style={styles.imagePreviewCard}>
                <div style={styles.imagePreviewWrap}>
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt="Employee Preview"
                      fill
                      sizes="150px"
                      style={styles.imagePreview}
                      unoptimized
                    />
                  ) : (
                    <div style={styles.imagePreviewFallback}>
                      {getInitials(form.fullName || "NA")}
                    </div>
                  )}
                </div>

                <div style={styles.imagePreviewText}>Preview Image</div>
              </div>

              <div style={styles.imageUploadCard}>
                <div style={styles.uploadTitle}>Upload Employee Photo</div>
                <div style={styles.uploadText}>
                  Allowed formats: JPG, JPEG, PNG, WEBP. Recommended: square portrait,
                  max 5 MB.
                </div>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  style={styles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handlePhotoSelect(file);
                    e.currentTarget.value = "";
                  }}
                />

                <div style={styles.uploadHint}>
                  Photo will upload automatically after employee creation.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Shift Summary"
            subtitle="Preview selected shift details before creating the employee."
          >
            <div style={styles.summaryGrid}>
              <SummaryItem label="Shift Name" value={selectedShift?.name || "--"} />
              <SummaryItem
                label="Time Range"
                value={
                  selectedShift
                    ? `${formatShiftTime(
                        selectedShift.startHour,
                        selectedShift.startMinute,
                      )} - ${formatShiftTime(
                        selectedShift.endHour,
                        selectedShift.endMinute,
                      )}`
                    : "--"
                }
              />
              <SummaryItem
                label="Crosses Midnight"
                value={selectedShift?.crossesMidnight ? "Yes" : "No"}
              />
              <SummaryItem
                label="Grace Minutes"
                value={
                  selectedShift ? String(selectedShift.graceMinutes) : "--"
                }
              />
              <SummaryItem
                label="Work Hours / Day"
                value={
                  selectedShift ? String(selectedShift.workHoursPerDay) : "--"
                }
              />
              <SummaryItem
                label="Minute Rate"
                value={
                  selectedShift ? String(selectedShift.minuteRate) : "--"
                }
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Basic Information"
          subtitle="Main personal identity and communication details."
        >
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
        </SectionCard>

        <SectionCard
          title="Organization Structure"
          subtitle="Define where this employee sits in the business structure."
        >
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

            <div style={styles.fieldWrap}>
              <label htmlFor="branchId" style={styles.fieldLabel}>
                Branch
              </label>

              <select
                id="branchId"
                name="branchId"
                value={form.branchId}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="">No Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Job Details"
          subtitle="Set salary, title, shift, and employment timing."
        >
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
        </SectionCard>

        <SectionCard
          title="Additional Information"
          subtitle="Optional fields to complete the employee profile."
        >
          <div style={styles.formGrid}>
            <FormField
              label="Education"
              name="education"
              value={form.education}
              onChange={handleChange}
            />
          </div>

          <div style={styles.actionsBar}>
            <button
              type="button"
              onClick={handleCancel}
              style={styles.secondaryButton}
              disabled={saving || uploadingPhoto}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={saving || uploadingPhoto}
            >
              {saving ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.summaryItem}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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
    minHeight: "100%",
    background: "transparent",
    color: "#111827",
  },
  alert: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(460px, 2fr) minmax(280px, 1fr)",
    gap: 18,
    marginBottom: 18,
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
    display: "flex",
    gap: 20,
    alignItems: "center",
    flexWrap: "wrap",
  },
  avatarWrap: {
    width: 112,
    height: 112,
    position: "relative",
    borderRadius: 30,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#fff",
    flexShrink: 0,
  },
  avatarImage: {
    objectFit: "cover",
    display: "block",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    background: "linear-gradient(135deg, #4f46e5, #60a5fa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    fontWeight: 900,
    color: "#fff",
  },
  heroBody: {
    flex: 1,
    minWidth: 260,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.78)",
    marginBottom: 10,
  },
  heroTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1.05,
  },
  heroText: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 15,
    lineHeight: 1.8,
    color: "rgba(255,255,255,0.82)",
  },
  heroBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
  },
  sideCard: {
    borderRadius: 28,
    padding: 22,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
  },
  sideTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#64748b",
    marginBottom: 16,
  },
  snapshotRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 0",
    borderBottom: "1px solid #eef2f7",
  },
  snapshotLabel: {
    fontSize: 14,
    color: "#475569",
    fontWeight: 600,
  },
  snapshotValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 800,
    textAlign: "right",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  formWrapper: {
    display: "grid",
    gap: 18,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(420px, 1.35fr) minmax(320px, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  imageSection: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 16,
    alignItems: "start",
  },
  imagePreviewCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 14,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
    justifyItems: "center",
  },
  imagePreviewWrap: {
    width: 150,
    height: 150,
    position: "relative",
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    background: "#fff",
  },
  imagePreview: {
    objectFit: "cover",
    display: "block",
  },
  imagePreviewFallback: {
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #4f46e5, #60a5fa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 42,
    fontWeight: 900,
  },
  imagePreviewText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
  },
  imageUploadCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
  },
  uploadText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.7,
  },
  uploadHint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.7,
  },
  fileInput: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #dbe4ee",
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },
  summaryGrid: {
    display: "grid",
    gap: 12,
  },
  summaryItem: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
    display: "grid",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },
  summaryValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
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
  statusActiveBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    padding: "0 14px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: 800,
  },
  statusInactiveBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    padding: "0 14px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 800,
  },
};
