"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatDateSafe, formatDateTimeSafe } from "@/lib/date";
import { parsePositiveInt, toFiniteNumber } from "@/lib/number";
import { joinUiSegments } from "@/lib/ui-text";
import PageHeader from "@/components/dashboard/PageHeader";
import SectionCard from "@/components/dashboard/SectionCard";
import StatCard from "@/components/dashboard/StatCard";

type Branch = {
  id: number;
  name: string;
};

type Employee = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string;
  branchId?: number | null;
  monthlySalary?: number | null;
  isActive?: boolean;
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
  branch?: string | null;
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
  photoUrl?: string | null;
};

type EmployeeDocument = {
  id: number;
  employeeId: number;
  companyId: string;
  title: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  createdAt?: string;
  created_at?: string;
};

type AttendanceSummary = {
  todayStatus?: string | null;
  lastCheckIn?: string | null;
  lastCheckOut?: string | null;
  lateMinutesThisMonth?: number | null;
  overtimeHoursThisMonth?: number | null;
  attendanceRate?: number | null;
};

type PayrollSummary = {
  basicSalary?: number | null;
  allowances?: number | null;
  deductions?: number | null;
  netSalary?: number | null;
};

type OvertimeBankSummary = {
  totalHours?: number | null;
  totalEntries?: number | null;
  lastEntryDate?: string | null;
};

type LeaveBalanceSummary = {
  annualTotal?: number | null;
  annualUsed?: number | null;
  annualRemaining?: number | null;
  sickTotal?: number | null;
  sickUsed?: number | null;
  sickRemaining?: number | null;
};

type RecentActivityItem = {
  id: number | string;
  title: string;
  date?: string | null;
  description?: string | null;
};

type EmployeeProfileResponse = {
  employee: Employee;
  attendanceSummary?: AttendanceSummary;
  payrollSummary?: PayrollSummary;
  overtimeBank?: OvertimeBankSummary;
  leaveBalance?: LeaveBalanceSummary;
  recentActivity?: RecentActivityItem[];
};

type EmployeeApiResponse = Employee | { employee?: Employee; data?: Employee };
type EmployeeProfileApiResponse = EmployeeProfileResponse | { data?: EmployeeProfileResponse };
type EmployeeDocumentsApiResponse = EmployeeDocument[] | { data?: EmployeeDocument[] };
type BranchesApiResponse = Branch[] | { data?: Branch[] };
type UploadResponse = { message?: string };

type TabKey =
  | "overview"
  | "documents"
  | "employment"
  | "attendance"
  | "payroll"
  | "activity";

const UI_ICONS = {
  document: "\u{1f4c4}",
} as const;

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  return formatDateSafe(value, "--", "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  return formatDateTimeSafe(value, "--");
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

function buildFileUrl(url?: string | null) {
  return resolveAssetUrl(url);
}

function formatFileSize(bytes?: number | null) {
  const value = toFiniteNumber(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function getAttendanceTone(rate?: number | null) {
  const value = toFiniteNumber(rate);
  if (value >= 90) return "Excellent";
  if (value >= 75) return "Stable";
  return "Needs attention";
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return getErrorMessage(error, fallback);
}

function isEmployee(value: unknown): value is Employee {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Employee>;
  return typeof candidate.id === "number" && typeof candidate.fullName === "string";
}

function isEmployeeProfileResponse(value: unknown): value is EmployeeProfileResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<EmployeeProfileResponse>;
  return isEmployee(candidate.employee);
}

function getEmployeeFromResponse(value: EmployeeApiResponse): Employee | null {
  if ("employee" in value && isEmployee(value.employee)) {
    return value.employee;
  }

  if ("data" in value && isEmployee(value.data)) {
    return value.data;
  }

  return isEmployee(value) ? value : null;
}

function getProfileFromResponse(
  value: EmployeeProfileApiResponse,
): EmployeeProfileResponse | null {
  if ("data" in value && isEmployeeProfileResponse(value.data)) {
    return value.data;
  }

  return isEmployeeProfileResponse(value) ? value : null;
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const employeeId = parsePositiveInt(params?.id);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [profileData, setProfileData] = useState<EmployeeProfileResponse | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchAll = useCallback(async (showRefreshState = false) => {
    if (!employeeId) {
      setEmployee(null);
      setProfileData(null);
      setDocuments([]);
      setBranches([]);
      setSelectedBranchId("");
      setMessage("Invalid employee ID.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (showRefreshState) setRefreshing(true);
      else setLoading(true);

      setMessage("");

      const [employeeResult, profileResult, documentsResult, branchesResult] =
        await Promise.all([
          apiRequest<EmployeeApiResponse>(`/employees/${employeeId}`, {
            method: "GET",
            auth: true,
          }),
          apiRequest<EmployeeProfileApiResponse>(`/employees/${employeeId}/profile`, {
            method: "GET",
            auth: true,
          }),
          apiRequest<EmployeeDocumentsApiResponse>(`/employees/${employeeId}/documents`, {
            method: "GET",
            auth: true,
          }),
          apiRequest<BranchesApiResponse>(`/branches`, {
            method: "GET",
            auth: true,
          }),
        ]);

      const employeeData = getEmployeeFromResponse(employeeResult);
      const profile = getProfileFromResponse(profileResult);

      const docsData = Array.isArray(documentsResult)
        ? documentsResult
        : Array.isArray(documentsResult.data)
          ? documentsResult.data
          : [];

      const branchesData = Array.isArray(branchesResult)
        ? branchesResult
        : Array.isArray(branchesResult.data)
          ? branchesResult.data
          : [];

      if (!employeeData) {
        setEmployee(null);
        setProfileData(null);
        setDocuments([]);
        setBranches([]);
        setSelectedBranchId("");
        setMessage("Employee not found.");
        return;
      }

      const normalizedEmployee = profile?.employee ?? employeeData;

      setEmployee(normalizedEmployee);
      setProfileData(profile ?? { employee: normalizedEmployee });
      setDocuments(docsData);
      setBranches(branchesData);
      setSelectedBranchId(
        normalizedEmployee.branchId !== null && normalizedEmployee.branchId !== undefined
          ? String(normalizedEmployee.branchId)
          : "",
      );
      setImageLoadFailed(false);
    } catch (error: unknown) {
      const errorMessage = resolveErrorMessage(error, "Failed to load employee profile");

      if (handleAuthError(error, router)) return;

      setMessage(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, router]);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      setMessage("Invalid employee ID.");
      return;
    }

    void fetchAll();
  }, [employeeId, fetchAll]);

  useEffect(() => {
    return () => {
      if (previewPhoto) URL.revokeObjectURL(previewPhoto);
    };
  }, [previewPhoto]);

  const profileCompletion = useMemo(() => {
    if (!employee) return 0;

    const fields = [
      employee.fullName,
      employee.email,
      employee.phone,
      employee.location,
      employee.department,
      employee.jobTitle,
      employee.branch,
      employee.shift,
      employee.education,
      employee.birthDate,
      employee.nationality,
      employee.gender,
      employee.photoUrl,
    ];

    const filled = fields.filter((item) => !!String(item || "").trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [employee]);

  const totalDocuments = documents.length;
  const totalDocumentSize = useMemo(
    () => documents.reduce((sum, doc) => sum + toFiniteNumber(doc.fileSize), 0),
    [documents],
  );

  const selectedBranchInfo = useMemo(() => {
    return branches.find((branch) => String(branch.id) === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  async function handlePhotoUpload(file: File) {
    if (!employee) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Only JPG, JPEG, PNG, and WEBP images are allowed.");
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage("");
      setImageLoadFailed(false);

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiRequest<UploadResponse>(`/employees/${employee.id}/photo`, {
        method: "POST",
        auth: true,
        body: formData,
      });

      setMessage(data?.message || "Employee photo uploaded successfully.");

      if (previewPhoto) URL.revokeObjectURL(previewPhoto);
      setPreviewPhoto(null);

      await fetchAll(true);
    } catch (error: unknown) {
      if (handleAuthError(error, router)) return;
      setMessage(resolveErrorMessage(error, "Failed to upload employee photo"));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePdfUpload(file: File) {
    if (!employee) return;

    if (file.type !== "application/pdf") {
      setMessage("Only PDF files are allowed.");
      return;
    }

    try {
      setUploadingPdf(true);
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", documentTitle.trim() || file.name.replace(/\.pdf$/i, ""));

      const data = await apiRequest<UploadResponse>(`/employees/${employee.id}/documents`, {
        method: "POST",
        auth: true,
        body: formData,
      });

      setDocumentTitle("");
      setMessage(data?.message || "Employee PDF uploaded successfully.");
      await fetchAll(true);
      setActiveTab("documents");
    } catch (error: unknown) {
      if (handleAuthError(error, router)) return;
      setMessage(resolveErrorMessage(error, "Failed to upload employee PDF"));
    } finally {
      setUploadingPdf(false);
    }
  }

  async function handleDeleteDocument(documentId: number) {
    if (!employee) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this document?\n\nThis action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      setDeletingDocumentId(documentId);
      setMessage("");

      await apiRequest(`/employees/${employee.id}/documents/${documentId}`, {
        method: "DELETE",
        auth: true,
      });

      setMessage("Employee document deleted successfully.");
      await fetchAll(true);
    } catch (error: unknown) {
      if (handleAuthError(error, router)) return;
      setMessage(resolveErrorMessage(error, "Failed to delete employee document"));
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function transferBranch() {
    if (!employee) return;

    const targetBranchId = selectedBranchId ? parsePositiveInt(selectedBranchId) : null;
    if (selectedBranchId && !targetBranchId) {
      setMessage("Please select a valid branch.");
      return;
    }

    try {
      setSavingBranch(true);
      setMessage("");

      await apiRequest(`/employees/${employeeId}/branch`, {
        method: "PATCH",
        auth: true,
        body: {
          branchId: targetBranchId,
        },
      });

      setMessage(
        selectedBranchId
          ? "Employee transferred successfully"
          : "Employee unassigned from branch",
      );

      await fetchAll(true);
    } catch (error: unknown) {
      if (handleAuthError(error, router)) return;
      setMessage(resolveErrorMessage(error, "Failed to transfer employee"));
    } finally {
      setSavingBranch(false);
    }
  }

  const imageSrc = previewPhoto
    ? previewPhoto
    : employee?.photoUrl && !imageLoadFailed
      ? buildFileUrl(employee.photoUrl)
      : "";

  const attendance = profileData?.attendanceSummary;
  const payroll = profileData?.payrollSummary;
  const overtimeBank = profileData?.overtimeBank;
  const leaveBalance = profileData?.leaveBalance;
  const recentActivity = profileData?.recentActivity || [];

  if (loading) {
    return <div style={styles.loading}>Loading employee profile...</div>;
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title={employee?.fullName || "Employee Profile"}
        subtitle="Advanced employee profile with identity, attendance, payroll, activity, and documents."
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/dashboard/employees")}
              style={styles.secondaryButton}
            >
              Back to Employees
            </button>

            <button
              type="button"
              onClick={() => fetchAll(true)}
              style={styles.secondaryButton}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {employee ? (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/employees/${employee.id}/edit`)}
                style={styles.primaryButton}
              >
                Edit Employee
              </button>
            ) : null}
          </>
        }
      />

      {message ? <div style={styles.alert}>{message}</div> : null}

      <section style={styles.heroGrid}>
        <div style={styles.heroCard}>
          <div style={styles.heroAvatarWrap}>
            {imageSrc ? (
              <Image
                key={imageSrc}
                src={imageSrc}
                alt={employee?.fullName || "Employee"}
                fill
                sizes="120px"
                style={styles.heroAvatarImage}
                onError={() => setImageLoadFailed(true)}
                unoptimized
              />
            ) : (
              <div style={styles.heroAvatarFallback}>
                {getInitials(employee?.fullName)}
              </div>
            )}
          </div>

          <div style={styles.heroBody}>
            <div style={styles.heroKicker}>Advanced Employee Profile</div>
            <h1 style={styles.heroTitle}>{employee?.fullName || "--"}</h1>
            <p style={{ ...styles.heroText, display: "none" }} aria-hidden="true">
              {employee?.jobTitle || "No job title"}
              {employee?.department ? ` \u2022 ${employee.department}` : ""}
              {employee?.branch ? ` \u2022 ${employee.branch}` : ""}
            </p>

            <p style={styles.heroText}>
              {joinUiSegments([
                employee?.jobTitle || "No job title",
                employee?.department || "",
                employee?.branch || "",
              ])}
            </p>

            <div style={styles.heroBadges}>
              <div style={styles.heroBadge}>
                Salary: {formatMoney(employee?.monthlySalary)}
              </div>
              <div style={styles.heroBadge}>
                Completion: {profileCompletion}%
              </div>
              <div
                style={
                  employee?.isActive === false
                    ? styles.statusInactiveBadge
                    : styles.statusActiveBadge
                }
              >
                {employee?.isActive === false ? "Inactive" : "Active"}
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sideCard}>
          <div style={styles.sideTitle}>Employee Snapshot</div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Attendance</span>
            <span style={styles.snapshotValue}>
              {attendance?.attendanceRate ?? 0}% ({getAttendanceTone(attendance?.attendanceRate)})
            </span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Today Status</span>
            <span style={styles.snapshotValue}>{attendance?.todayStatus || "--"}</span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Shift</span>
            <span style={styles.snapshotValue}>{employee?.shift || "--"}</span>
          </div>

          <div style={styles.snapshotRow}>
            <span style={styles.snapshotLabel}>Hire Date</span>
            <span style={styles.snapshotValue}>{formatDate(employee?.hireDate)}</span>
          </div>
        </div>
      </section>

      <div style={styles.statsGrid}>
        <StatCard
          label="Attendance Rate"
          value={`${attendance?.attendanceRate ?? 0}%`}
          hint="Monthly attendance health"
          tone="success"
        />
        <StatCard
          label="Late Minutes"
          value={attendance?.lateMinutesThisMonth ?? 0}
          hint="Late minutes this month"
          tone="warning"
        />
        <StatCard
          label="Overtime Hours"
          value={overtimeBank?.totalHours ?? 0}
          hint="Accumulated overtime bank"
          tone="primary"
        />
        <StatCard
          label="Net Salary"
          value={formatMoney(payroll?.netSalary)}
          hint="Calculated salary outcome"
          tone="default"
        />
      </div>

      <div style={styles.tabsBar}>
        {[
          ["overview", "Overview"],
          ["documents", "Documents"],
          ["employment", "Employment"],
          ["attendance", "Attendance"],
          ["payroll", "Payroll"],
          ["activity", "Activity"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as TabKey)}
            style={{
              ...styles.tabButton,
              ...(activeTab === key ? styles.tabButtonActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div style={styles.mainGrid}>
          <SectionCard title="Profile Image" subtitle="Upload and manage employee image.">
            <div style={styles.imageSection}>
              <div style={styles.imagePreviewCard}>
                <div style={styles.imagePreviewWrap}>
                  {imageSrc ? (
                    <Image
                      key={`preview-${imageSrc}`}
                      src={imageSrc}
                      alt={employee?.fullName || "Employee"}
                      fill
                      sizes="150px"
                      style={styles.imagePreview}
                      onError={() => setImageLoadFailed(true)}
                      unoptimized
                    />
                  ) : (
                    <div style={styles.imagePreviewFallback}>
                      {getInitials(employee?.fullName)}
                    </div>
                  )}
                </div>

                <div style={styles.imagePreviewText}>Current / Preview Image</div>
              </div>

              <div style={styles.imageUploadCard}>
                <div style={styles.uploadTitle}>Upload Employee Photo</div>
                <div style={styles.uploadText}>
                  Allowed formats: JPG, JPEG, PNG, WEBP. Recommended: square image, max 5 MB.
                </div>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  style={styles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (previewPhoto) URL.revokeObjectURL(previewPhoto);
                    const localPreview = URL.createObjectURL(file);
                    setPreviewPhoto(localPreview);
                    void handlePhotoUpload(file);
                    e.currentTarget.value = "";
                  }}
                />

                <div style={styles.uploadHint}>
                  {uploadingPhoto ? "Uploading photo..." : "Use a professional employee portrait."}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Basic Information" subtitle="Personal and communication profile.">
            <div style={styles.infoGrid}>
              <InfoBox label="Full Name" value={employee?.fullName} />
              <InfoBox label="Email" value={employee?.email} />
              <InfoBox label="Phone" value={employee?.phone} />
              <InfoBox label="Company Phone" value={employee?.companyPhoneNumber} />
              <InfoBox label="Gender" value={employee?.gender} />
              <InfoBox label="Nationality" value={employee?.nationality} />
              <InfoBox label="Birth Date" value={formatDate(employee?.birthDate)} />
              <InfoBox label="Telegram User" value={employee?.telegramUser} />
              <InfoBox label="Location" value={employee?.location} wide />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "documents" && (
        <SectionCard title="Employee Documents" subtitle="Upload, open, and manage PDF files.">
          <div style={styles.documentsTopGrid}>
            <div style={styles.uploadCard}>
              <div style={styles.uploadTitle}>Upload PDF</div>
              <div style={styles.uploadText}>
                Upload contract, CV, certificates, or HR-related PDFs.
              </div>

              <input
                type="text"
                placeholder="Document title (optional)"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                style={styles.input}
              />

              <input
                type="file"
                accept=".pdf,application/pdf"
                style={styles.fileInput}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void handlePdfUpload(file);
                  e.currentTarget.value = "";
                }}
              />

              <div style={styles.uploadHint}>
                {uploadingPdf ? "Uploading PDF..." : "Only PDF files are allowed. Max 10 MB."}
              </div>
            </div>

            <div style={styles.uploadCard}>
              <div style={styles.uploadTitle}>Documents Summary</div>
              <div style={styles.summaryGrid}>
                <SummaryItem label="Total Files" value={String(totalDocuments)} />
                <SummaryItem label="Total Size" value={formatFileSize(totalDocumentSize)} />
                <SummaryItem
                  label="Latest Upload"
                  value={
                    documents[0]
                      ? formatDateTime(documents[0].createdAt || documents[0].created_at)
                      : "--"
                  }
                />
              </div>
            </div>
          </div>

          <div style={styles.documentList}>
            {documents.length === 0 ? (
              <div style={styles.emptyState}>No employee documents uploaded yet.</div>
            ) : (
              documents.map((doc) => {
                const createdAt = doc.createdAt || doc.created_at;

                return (
                  <div key={doc.id} style={styles.documentCard}>
                    <div style={styles.documentInfo}>
                      <div style={styles.documentIconClean}>{UI_ICONS.document}</div>
                      <div style={styles.documentIcon}>📄</div>

                      <div style={styles.documentMeta}>
                        <div style={styles.documentTitle}>{doc.title}</div>
                        <div style={styles.documentSub}>
                          {doc.originalName} {"\u2022"} {formatFileSize(doc.fileSize)} {"\u2022"}{" "}
                          {formatDateTime(createdAt)}
                        </div>
                        <div style={styles.documentSubClean}>
                          {joinUiSegments([
                            doc.originalName,
                            formatFileSize(doc.fileSize),
                            formatDateTime(createdAt),
                          ])}
                        </div>
                      </div>
                    </div>

                    <div style={styles.documentActions}>
                      <a
                        href={buildFileUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.viewLink}
                      >
                        Open
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        style={styles.deleteButton}
                        disabled={deletingDocumentId === doc.id}
                      >
                        {deletingDocumentId === doc.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === "employment" && (
        <div style={styles.mainGrid}>
          <div style={styles.sectionStack}>
            <SectionCard
              title="Employment Information"
              subtitle="Organization placement and job details."
            >
              <div style={styles.infoGrid}>
                <InfoBox label="Branch" value={employee?.branch} />
                <InfoBox label="Department" value={employee?.department} />
                <InfoBox label="Section" value={employee?.section} />
                <InfoBox label="Unit" value={employee?.unit} />
                <InfoBox label="Entity" value={employee?.entity} />
                <InfoBox label="Job Title" value={employee?.jobTitle} />
                <InfoBox label="Level" value={employee?.level} />
                <InfoBox label="Grade" value={employee?.grade} />
                <InfoBox label="Shift" value={employee?.shift} />
                <InfoBox
                  label="Functional Reporting To"
                  value={employee?.functionalReportingTo}
                  wide
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Branch Assignment"
              subtitle="Assign or transfer employee between branches"
            >
              <div style={{ display: "grid", gap: 12 }}>
                <select
                  style={styles.input}
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                >
                  <option value="">No Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
                  Selected branch: {selectedBranchInfo?.name || "No Branch"}
                </div>

                <button
                  onClick={transferBranch}
                  style={styles.primaryButton}
                  disabled={savingBranch}
                  type="button"
                >
                  {savingBranch ? "Saving..." : "Save Branch"}
                </button>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="HR & Record Details" subtitle="Additional HR and record metadata.">
            <div style={styles.infoGrid}>
              <InfoBox label="Hire Date" value={formatDate(employee?.hireDate)} />
              <InfoBox label="Education" value={employee?.education} />
              <InfoBox label="Social Security / SS" value={employee?.ss} />
              <InfoBox label="Created At" value={formatDateTime(employee?.createdAt)} />
              <InfoBox label="Updated At" value={formatDateTime(employee?.updatedAt)} />
              <InfoBox label="Monthly Salary" value={formatMoney(employee?.monthlySalary)} />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "attendance" && (
        <div style={styles.mainGrid}>
          <SectionCard title="Attendance Summary" subtitle="Attendance and punctuality metrics for this employee.">
            <div style={styles.infoGrid}>
              <InfoBox label="Today Status" value={attendance?.todayStatus || "--"} />
              <InfoBox label="Attendance Rate" value={`${attendance?.attendanceRate ?? 0}%`} />
              <InfoBox label="Late Minutes This Month" value={String(attendance?.lateMinutesThisMonth ?? 0)} />
              <InfoBox label="Overtime Hours This Month" value={String(attendance?.overtimeHoursThisMonth ?? 0)} wide />
              <InfoBox label="Last Check In" value={formatDateTime(attendance?.lastCheckIn)} wide />
              <InfoBox label="Last Check Out" value={formatDateTime(attendance?.lastCheckOut)} wide />
            </div>
          </SectionCard>

          <SectionCard title="Overtime & Leave" subtitle="Time bank and leave balance overview.">
            <div style={styles.summaryGrid}>
              <SummaryItem label="Overtime Hours" value={String(overtimeBank?.totalHours ?? 0)} />
              <SummaryItem label="Overtime Entries" value={String(overtimeBank?.totalEntries ?? 0)} />
              <SummaryItem label="Last Overtime Entry" value={formatDate(overtimeBank?.lastEntryDate)} />
              <SummaryItem label="Annual Remaining" value={String(leaveBalance?.annualRemaining ?? 0)} />
              <SummaryItem label="Sick Remaining" value={String(leaveBalance?.sickRemaining ?? 0)} />
              <SummaryItem label="Annual Used" value={String(leaveBalance?.annualUsed ?? 0)} />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "payroll" && (
        <div style={styles.mainGrid}>
          <SectionCard title="Payroll Summary" subtitle="Compensation overview and current salary structure.">
            <div style={styles.infoGrid}>
              <InfoBox label="Basic Salary" value={formatMoney(payroll?.basicSalary)} />
              <InfoBox label="Allowances" value={formatMoney(payroll?.allowances)} />
              <InfoBox label="Deductions" value={formatMoney(payroll?.deductions)} />
              <InfoBox label="Net Salary" value={formatMoney(payroll?.netSalary)} />
              <InfoBox label="Current Monthly Salary" value={formatMoney(employee?.monthlySalary)} wide />
            </div>
          </SectionCard>

          <SectionCard title="Payroll Insights" subtitle="Simple financial view for this employee.">
            <div style={styles.summaryGrid}>
              <SummaryItem label="Salary Record" value={formatMoney(employee?.monthlySalary)} />
              <SummaryItem label="Net Salary" value={formatMoney(payroll?.netSalary)} />
              <SummaryItem
                label="Difference"
                value={formatMoney((payroll?.netSalary ?? 0) - (employee?.monthlySalary ?? 0))}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "activity" && (
        <SectionCard title="Recent Activity" subtitle="Latest audit and profile activity for this employee.">
          {recentActivity.length === 0 ? (
            <div style={styles.emptyState}>No recent activity available.</div>
          ) : (
            <div style={styles.activityList}>
              {recentActivity.map((item) => (
                <div key={item.id} style={styles.activityCard}>
                  <div style={styles.activityDot} />
                  <div style={styles.activityBody}>
                    <div style={styles.activityTitle}>{item.title}</div>
                    <div style={styles.activityDate}>{formatDateTime(item.date)}</div>
                    <div style={styles.activityDescription}>{item.description || "--"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryItem}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function InfoBox({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.infoBox,
        ...(wide ? styles.infoBoxWide : {}),
      }}
    >
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "--"}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100%", background: "transparent", color: "#111827" },
  loading: { padding: 40 },
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
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
    display: "flex",
    gap: 20,
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroAvatarWrap: {
    width: 120,
    height: 120,
    position: "relative",
    borderRadius: 30,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#fff",
    flexShrink: 0,
  },
  heroAvatarImage: {
    objectFit: "cover",
    display: "block",
  },
  heroAvatarFallback: {
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #4f46e5, #60a5fa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 38,
    fontWeight: 900,
  },
  heroBody: { flex: 1, minWidth: 260 },
  heroKicker: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.78)",
    marginBottom: 10,
  },
  heroTitle: { margin: 0, fontSize: 34, fontWeight: 900, lineHeight: 1.05 },
  heroText: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 15,
    lineHeight: 1.8,
    color: "rgba(255,255,255,0.82)",
  },
  heroBadges: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 },
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
  sideTitle: { fontSize: 13, fontWeight: 800, color: "#64748b", marginBottom: 16 },
  snapshotRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 0",
    borderBottom: "1px solid #eef2f7",
  },
  snapshotLabel: { fontSize: 14, color: "#475569", fontWeight: 600 },
  snapshotValue: { fontSize: 14, color: "#0f172a", fontWeight: 800, textAlign: "right" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  tabsBar: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  tabButton: {
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
  },
  tabButtonActive: {
    background: "#111827",
    color: "#fff",
    border: "1px solid #111827",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(420px, 1.35fr) minmax(320px, 1fr)",
    gap: 18,
    alignItems: "start",
    marginBottom: 18,
  },
  sectionStack: {
    display: "grid",
    gap: 18,
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
  imagePreview: { objectFit: "cover", display: "block" },
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
  imagePreviewText: { fontSize: 12, color: "#64748b", fontWeight: 700 },
  imageUploadCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
  },
  uploadCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
  },
  documentsTopGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: 16,
    marginBottom: 18,
  },
  uploadTitle: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  uploadText: { fontSize: 13, color: "#64748b", lineHeight: 1.7 },
  uploadHint: { fontSize: 12, color: "#64748b", lineHeight: 1.7 },
  fileInput: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #dbe4ee",
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
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
  documentList: { display: "grid", gap: 12 },
  documentCard: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  documentInfo: { display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 },
  documentIcon: {
    display: "none",
  },
  documentIconClean: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#fee2e2",
    color: "#b91c1c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 18,
    flexShrink: 0,
  },
  documentMeta: { minWidth: 0 },
  documentTitle: { fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 },
  documentSub: { display: "none" },
  documentSubClean: { fontSize: 12, color: "#64748b", lineHeight: 1.6, wordBreak: "break-word" },
  documentActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  viewLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 38,
    padding: "0 14px",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 13,
  },
  deleteButton: {
    height: 38,
    padding: "0 14px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  infoBox: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  infoBoxWide: { gridColumn: "1 / -1" },
  infoLabel: { fontSize: 12, color: "#64748b", fontWeight: 800 },
  infoValue: { fontSize: 14, color: "#0f172a", fontWeight: 700, lineHeight: 1.7, wordBreak: "break-word" },
  summaryGrid: { display: "grid", gap: 12 },
  summaryItem: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 14,
    display: "grid",
    gap: 6,
  },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: 800 },
  summaryValue: { fontSize: 14, color: "#0f172a", fontWeight: 700 },
  activityList: { display: "grid", gap: 14 },
  activityCard: {
    display: "flex",
    gap: 14,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 16,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#4f46e5",
    marginTop: 8,
    flexShrink: 0,
  },
  activityBody: { display: "grid", gap: 6 },
  activityTitle: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  activityDate: { fontSize: 12, color: "#64748b", fontWeight: 700 },
  activityDescription: { fontSize: 13, color: "#475569", lineHeight: 1.7 },
  emptyState: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 16,
    color: "#6b7280",
    textAlign: "center",
    border: "1px dashed #cbd5e1",
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
