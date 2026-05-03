"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatDateSafe } from "@/lib/date";
import { parsePositiveInt } from "@/lib/number";

type BranchStatus = "ACTIVE" | "INACTIVE";

type Branch = {
  id: number;
  name: string;
  location: string | null;
  managerName: string | null;
  companyId: string | null;
  logoUrl: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: BranchStatus;
  createdAt?: string;
  updatedAt?: string;
  employeeCount?: number;
};

type BranchOption = {
  id: number;
  name: string;
};

type Employee = {
  id: number;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  isActive?: boolean | null;
  branchId?: number | null;
};

type BranchFormData = {
  name: string;
  location: string;
  managerName: string;
  logoUrl: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  status: BranchStatus;
};

const emptyForm: BranchFormData = {
  name: "",
  location: "",
  managerName: "",
  logoUrl: "",
  description: "",
  phone: "",
  email: "",
  address: "",
  status: "ACTIVE",
};

function formatDate(value?: string) {
  return formatDateSafe(value, "Not available", "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getBranchInitial(name?: string | null) {
  return (name || "B").trim().charAt(0).toUpperCase() || "B";
}

function getImageUrl(url?: string | null) {
  return resolveAssetUrl(url);
}

function getEmployeeName(employee: Employee) {
  return employee.fullName || employee.name || `Employee #${employee.id}`;
}

export default function BranchDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();

  const branchId = parsePositiveInt(params?.id);

  const [branch, setBranch] = useState<Branch | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [transferEmployee, setTransferEmployee] = useState<Employee | null>(null);
  const [transferBranchId, setTransferBranchId] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [form, setForm] = useState<BranchFormData>(emptyForm);

  const loadPageData = useCallback(async () => {
    if (!branchId) {
      setBranch(null);
      setEmployees([]);
      setAllBranches([]);
      setError("Invalid branch ID.");
      setLoading(false);
      setEmployeesLoading(false);
      return;
    }

    try {
      setLoading(true);
      setEmployeesLoading(true);
      setError("");
      setSuccess("");

      const [branchData, employeesData, branchesData] = await Promise.all([
        apiRequest<Branch>(`/branches/${branchId}`),
        apiRequest<Employee[]>(`/branches/${branchId}/employees`),
        apiRequest<BranchOption[]>(`/branches`),
      ]);

      setBranch(branchData || null);
      setEmployees(Array.isArray(employeesData) ? employeesData : []);
      setAllBranches(Array.isArray(branchesData) ? branchesData : []);

      if (branchData) {
        setForm({
          name: branchData.name || "",
          location: branchData.location || "",
          managerName: branchData.managerName || "",
          logoUrl: branchData.logoUrl || "",
          description: branchData.description || "",
          phone: branchData.phone || "",
          email: branchData.email || "",
          address: branchData.address || "",
          status: branchData.status || "ACTIVE",
        });
      }
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to load branch details"));
    } finally {
      setLoading(false);
      setEmployeesLoading(false);
    }
  }, [branchId, router]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function openEditModal() {
    if (!branch) return;

    resetMessages();
    setForm({
      name: branch.name || "",
      location: branch.location || "",
      managerName: branch.managerName || "",
      logoUrl: branch.logoUrl || "",
      description: branch.description || "",
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
      status: branch.status || "ACTIVE",
    });
    setIsEditOpen(true);
  }

  function closeEditModal() {
    setIsEditOpen(false);
  }

  function openDeleteModal() {
    resetMessages();
    setIsDeleteOpen(true);
  }

  function closeDeleteModal() {
    setIsDeleteOpen(false);
  }

  function openTransferModal(employee: Employee, isUnassign = false) {
    resetMessages();
    setTransferEmployee(employee);

    if (isUnassign) {
      setTransferBranchId("UNASSIGN");
    } else {
      setTransferBranchId("");
    }
  }

  function closeTransferModal() {
    setTransferEmployee(null);
    setTransferBranchId("");
  }

  function onFieldChange<K extends keyof BranchFormData>(
    key: K,
    value: BranchFormData[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      setError("Branch name is required.");
      return false;
    }

    if (form.name.trim().length < 2) {
      setError("Branch name must be at least 2 characters.");
      return false;
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return false;
    }

    return true;
  }

  async function handleLogoUpload(file: File) {
    try {
      setUploadingLogo(true);
      resetMessages();

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiRequest<{ logoUrl: string; message?: string }>(
        "/branches/upload-image",
        {
          method: "POST",
          body: formData,
        },
      );

      setForm((prev) => ({
        ...prev,
        logoUrl: (data.logoUrl || "").trim(),
      }));

      setSuccess(data?.message || "Logo uploaded successfully.");
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to upload logo"));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleUpdate() {
    if (!branch) return;
    if (!validateForm()) return;

    try {
      setSaving(true);
      resetMessages();

      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || undefined,
        managerName: form.managerName.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        status: form.status,
      };

      const result = await apiRequest<{ message?: string; data?: Branch }>(
        `/branches/${branch.id}`,
        {
          method: "PATCH",
          body: payload,
        },
      );

      setSuccess(result?.message || "Branch updated successfully.");
      closeEditModal();
      await loadPageData();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to update branch"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!branch) return;

    try {
      setSaving(true);
      resetMessages();

      const result = await apiRequest<{ message?: string }>(
        `/branches/${branch.id}`,
        {
          method: "DELETE",
        },
      );

      setSuccess(result?.message || "Branch deleted successfully.");
      closeDeleteModal();
      router.push("/dashboard/branches");
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to delete branch"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferEmployee() {
    if (!transferEmployee) return;

    if (!transferBranchId) {
      setError("Please select a target branch.");
      return;
    }

    const targetBranchId =
      transferBranchId === "UNASSIGN"
        ? null
        : parsePositiveInt(transferBranchId);

    if (transferBranchId !== "UNASSIGN" && !targetBranchId) {
      setError("Please select a valid target branch.");
      return;
    }

    try {
      setTransferring(true);
      resetMessages();

      const result = await apiRequest<{ message?: string }>(
        `/employees/${transferEmployee.id}/transfer-branch`,
        {
          method: "PATCH",
          body: {
            branchId: targetBranchId,
          },
        },
      );

      setSuccess(result?.message || "Employee transfer updated successfully.");
      closeTransferModal();
      await loadPageData();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to transfer employee"));
    } finally {
      setTransferring(false);
    }
  }

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((employee) => {
      return (
        (employee.fullName || "").toLowerCase().includes(q) ||
        (employee.name || "").toLowerCase().includes(q) ||
        (employee.email || "").toLowerCase().includes(q) ||
        (employee.phone || "").toLowerCase().includes(q) ||
        (employee.employeeCode || "").toLowerCase().includes(q) ||
        (employee.department || "").toLowerCase().includes(q) ||
        (employee.jobTitle || "").toLowerCase().includes(q)
      );
    });
  }, [employees, employeeSearch]);

  const activeEmployees = useMemo(() => {
    return employees.filter((employee) => employee.isActive !== false).length;
  }, [employees]);

  const inactiveEmployees = useMemo(() => {
    return employees.filter((employee) => employee.isActive === false).length;
  }, [employees]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrapper}>
          <div style={styles.loadingCard}>Loading branch details...</div>
        </div>
      </div>
    );
  }

  if (error && !branch) {
    return (
      <div style={styles.page}>
        <div style={styles.wrapper}>
          <div style={styles.errorCard}>
            <div style={styles.errorTitle}>Failed to load branch details</div>
            <div style={styles.errorText}>{error}</div>

            <div style={styles.topActions}>
              <button style={styles.secondaryButton} onClick={() => router.back()}>
                Go Back
              </button>
              <button style={styles.primaryButton} onClick={loadPageData}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div style={styles.page}>
        <div style={styles.wrapper}>
          <div style={styles.errorCard}>
            <div style={styles.errorTitle}>Branch not found</div>
            <div style={styles.errorText}>
              The requested branch record could not be found.
            </div>
          <button
            style={styles.primaryButton}
            onClick={() => router.push("/dashboard/branches")}
          >
              Back to Branches
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        {(error || success) && (
          <div
            style={{
              ...styles.alert,
              ...(error ? styles.alertError : styles.alertSuccess),
            }}
          >
            {error || success}
          </div>
        )}

        <div style={styles.topActions}>
          <button
            style={styles.secondaryButton}
            onClick={() => router.push("/dashboard/branches")}
          >
            {"Back to Branches"}
            {/*
            ← Back to Branches
            */}
          </button>

          <div style={styles.topActionsRight}>
            <button style={styles.secondaryButton} onClick={loadPageData}>
              Refresh
            </button>
            <button style={styles.secondaryButton} onClick={openEditModal}>
              Edit Branch
            </button>
            <button style={styles.dangerButton} onClick={openDeleteModal}>
              Delete Branch
            </button>
          </div>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroLeft}>
            <div style={styles.logoCard}>
              {branch.logoUrl ? (
                <Image
                  src={getImageUrl(branch.logoUrl)}
                  alt={branch.name}
                  width={320}
                  height={320}
                  unoptimized
                  style={styles.logoImage}
                />
              ) : (
                <div style={styles.logoFallback}>
                  {getBranchInitial(branch.name)}
                </div>
              )}
            </div>

            <div style={styles.heroText}>
              <div style={styles.kicker}>Branch Profile</div>
              <h1 style={styles.title}>{branch.name}</h1>
              <p style={styles.subtitle}>
                Full branch summary including branding, contact details,
                operational status, and assigned employees.
              </p>

              <div style={styles.badgesRow}>
                <div
                  style={{
                    ...styles.statusBadge,
                    ...(branch.status === "ACTIVE"
                      ? styles.statusActive
                      : styles.statusInactive),
                  }}
                >
                  {branch.status}
                </div>

                <div style={styles.countBadge}>
                  {branch.employeeCount ?? employees.length} Employees
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <StatCard
            label="Total Employees"
            value={String(branch.employeeCount ?? employees.length)}
            hint="All employees assigned to this branch"
          />
          <StatCard
            label="Active Employees"
            value={String(activeEmployees)}
            hint="Currently active team members"
          />
          <StatCard
            label="Inactive Employees"
            value={String(inactiveEmployees)}
            hint="Inactive employee records"
          />
          <StatCard
            label="Created"
            value={formatDate(branch.createdAt)}
            hint="Branch creation date"
          />
        </div>

        <div style={styles.contentGrid}>
          <div style={styles.leftColumn}>
            <SectionCard title="Branch Information">
              <div style={styles.infoGrid}>
                <InfoItem label="Branch ID" value={String(branch.id)} />
                <InfoItem label="Manager" value={branch.managerName} />
                <InfoItem label="Location" value={branch.location} />
                <InfoItem label="Phone" value={branch.phone} />
                <InfoItem label="Email" value={branch.email} />
                <InfoItem label="Address" value={branch.address} />
                <InfoItem label="Created At" value={formatDate(branch.createdAt)} />
                <InfoItem label="Updated At" value={formatDate(branch.updatedAt)} />
              </div>
            </SectionCard>

            <SectionCard title="Description">
              {branch.description ? (
                <div style={styles.descriptionBox}>{branch.description}</div>
              ) : (
                <div style={styles.mutedBox}>No description available for this branch.</div>
              )}
            </SectionCard>
          </div>

          <div style={styles.rightColumn}>
            <SectionCard title="Employee Directory">
              <div style={styles.employeeToolbar}>
                <input
                  style={styles.searchInput}
                  placeholder="Search employees by name, email, phone, department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />
              </div>

              {employeesLoading ? (
                <div style={styles.mutedBox}>Loading employees...</div>
              ) : filteredEmployees.length === 0 ? (
                <div style={styles.mutedBox}>
                  {employeeSearch.trim()
                    ? "No employees match your search."
                    : "No employees assigned to this branch."}
                </div>
              ) : (
                <div style={styles.employeeList}>
                  {filteredEmployees.map((employee) => (
                    <div key={employee.id} style={styles.employeeCard}>
                      <div style={styles.employeeTop}>
                        <div>
                          <div style={styles.employeeName}>
                            {getEmployeeName(employee)}
                          </div>
                          <div style={styles.employeeMeta}>
                            Employee ID: {employee.id}
                            {employee.employeeCode ? ` \u2022 Code: ${employee.employeeCode}` : ""}
                          </div>
                        </div>

                        <div
                          style={{
                            ...styles.employeeStatus,
                            ...(employee.isActive === false
                              ? styles.employeeStatusInactive
                              : styles.employeeStatusActive),
                          }}
                        >
                          {employee.isActive === false ? "INACTIVE" : "ACTIVE"}
                        </div>
                      </div>

                      <div style={styles.employeeInfoGrid}>
                        <MiniInfo label="Job Title" value={employee.jobTitle} />
                        <MiniInfo label="Department" value={employee.department} />
                        <MiniInfo label="Email" value={employee.email} />
                        <MiniInfo label="Phone" value={employee.phone} />
                      </div>

                      <div style={styles.employeeActions}>
                        <button
                          style={styles.secondaryButtonSmall}
                          onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                        >
                          View Employee
                        </button>

                        <button
                          style={styles.secondaryButtonSmall}
                          onClick={() => openTransferModal(employee)}
                        >
                          Transfer
                        </button>

                        <button
                          style={styles.dangerButtonSmall}
                          onClick={() => openTransferModal(employee, true)}
                        >
                          Unassign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {isEditOpen && (
          <Modal
            title="Edit Branch"
            subtitle="Update branch branding, contact details, address, and operational status."
            onClose={closeEditModal}
          >
            <div style={styles.formGrid}>
              <div style={styles.twoColumns}>
                <div style={styles.field}>
                  <label style={styles.label}>Branch Name</label>
                  <input
                    style={styles.input}
                    value={form.name}
                    onChange={(e) => onFieldChange("name", e.target.value)}
                    placeholder="Enter branch name"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Status</label>
                  <select
                    style={styles.input}
                    value={form.status}
                    onChange={(e) =>
                      onFieldChange("status", e.target.value as BranchStatus)
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Branch Logo / Image</label>

                <input
                  type="file"
                  accept="image/*"
                  style={styles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />

                <input
                  style={styles.input}
                  value={form.logoUrl}
                  onChange={(e) => onFieldChange("logoUrl", e.target.value)}
                  placeholder="Uploaded image URL will appear here"
                />

                <div style={styles.uploadHint}>
                  {uploadingLogo
                    ? "Uploading image..."
                    : "Upload a clean logo or branch image."}
                </div>
              </div>

              {form.logoUrl ? (
                <div style={styles.logoPreviewSection}>
                  <div style={styles.logoPreviewCard}>
                    <div style={styles.logoPreviewWrap}>
                      <Image
                        src={getImageUrl(form.logoUrl)}
                        alt="Branch preview"
                        width={240}
                        height={240}
                        unoptimized
                        style={styles.logoPreview}
                      />
                    </div>
                    <div style={styles.logoPreviewText}>Branch Image Preview</div>
                  </div>
                </div>
              ) : null}

              <div style={styles.twoColumns}>
                <div style={styles.field}>
                  <label style={styles.label}>Location</label>
                  <input
                    style={styles.input}
                    value={form.location}
                    onChange={(e) => onFieldChange("location", e.target.value)}
                    placeholder="Enter location"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Manager Name</label>
                  <input
                    style={styles.input}
                    value={form.managerName}
                    onChange={(e) => onFieldChange("managerName", e.target.value)}
                    placeholder="Enter manager name"
                  />
                </div>
              </div>

              <div style={styles.twoColumns}>
                <div style={styles.field}>
                  <label style={styles.label}>Phone</label>
                  <input
                    style={styles.input}
                    value={form.phone}
                    onChange={(e) => onFieldChange("phone", e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    style={styles.input}
                    value={form.email}
                    onChange={(e) => onFieldChange("email", e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Address</label>
                <input
                  style={styles.input}
                  value={form.address}
                  onChange={(e) => onFieldChange("address", e.target.value)}
                  placeholder="Enter full address"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={styles.textarea}
                  value={form.description}
                  onChange={(e) => onFieldChange("description", e.target.value)}
                  placeholder="Write branch description"
                />
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={closeEditModal}>
                Cancel
              </button>

              <button
                style={styles.primaryButton}
                onClick={handleUpdate}
                disabled={saving || uploadingLogo}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </Modal>
        )}

        {isDeleteOpen && (
          <Modal
            title="Delete Branch"
            subtitle="This action cannot be undone."
            onClose={closeDeleteModal}
          >
            <div style={styles.deleteBox}>
              Are you sure you want to delete <strong>{branch.name}</strong>?
            </div>

            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={closeDeleteModal}>
                Cancel
              </button>

              <button
                style={styles.dangerButton}
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete Branch"}
              </button>
            </div>
          </Modal>
        )}

        {transferEmployee && (
          <Modal
            title={
              transferBranchId === "UNASSIGN"
                ? "Unassign Employee"
                : "Transfer Employee"
            }
            subtitle="Move this employee to another branch or remove branch assignment."
            onClose={closeTransferModal}
          >
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Employee</label>
                <input
                  style={styles.input}
                  value={getEmployeeName(transferEmployee)}
                  readOnly
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Target Branch</label>
                <select
                  style={styles.input}
                  value={transferBranchId}
                  onChange={(e) => setTransferBranchId(e.target.value)}
                >
                  <option value="">Select target branch</option>
                  <option value="UNASSIGN">🚫 Remove from any branch</option>

                  {allBranches
                    .filter((item) => item.id !== branch.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={closeTransferModal}>
                Cancel
              </button>

              <button
                style={styles.primaryButton}
                onClick={handleTransferEmployee}
                disabled={transferring}
              >
                {transferring
                  ? "Processing..."
                  : transferBranchId === "UNASSIGN"
                    ? "Unassign Employee"
                    : "Transfer Employee"}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statHint}>{hint}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.sectionCard}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "Not set"}</div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div style={styles.miniInfo}>
      <div style={styles.miniInfoLabel}>{label}</div>
      <div style={styles.miniInfoValue}>{value || "Not set"}</div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{title}</h2>
            {subtitle ? <p style={styles.modalSubtitle}>{subtitle}</p> : null}
          </div>

          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 24,
  },
  wrapper: {
    maxWidth: 1400,
    margin: "0 auto",
  },
  alert: {
    borderRadius: 16,
    padding: "14px 16px",
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 700,
  },
  alertError: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },
  alertSuccess: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },
  topActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  topActionsRight: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  heroCard: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
    borderRadius: 28,
    padding: 28,
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
    marginBottom: 20,
  },
  heroLeft: {
    display: "flex",
    gap: 22,
    alignItems: "center",
    flexWrap: "wrap",
  },
  logoCard: {
    width: 170,
    height: 170,
    borderRadius: 24,
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  logoFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 64,
    fontWeight: 900,
    color: "#fff",
    background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
  },
  heroText: {
    flex: 1,
    minWidth: 260,
  },
  kicker: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    opacity: 0.78,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 36,
    fontWeight: 900,
    lineHeight: 1.05,
  },
  subtitle: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    lineHeight: 1.8,
    maxWidth: 760,
  },
  badgesRow: {
    display: "flex",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },
  statusBadge: {
    height: 34,
    padding: "0 14px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
  },
  statusActive: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusInactive: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  countBadge: {
    height: 34,
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  statHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#94a3b8",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.2fr)",
    gap: 18,
  },
  leftColumn: {
    display: "grid",
    gap: 18,
  },
  rightColumn: {
    display: "grid",
    gap: 18,
  },
  sectionCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 16,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  infoItem: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },
  infoValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  descriptionBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.8,
  },
  mutedBox: {
    background: "#f8fafc",
    border: "1px dashed #e2e8f0",
    borderRadius: 16,
    padding: 14,
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.7,
  },
  employeeToolbar: {
    marginBottom: 14,
  },
  searchInput: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    border: "1px solid #dbe4ee",
    background: "#fff",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
  },
  employeeList: {
    display: "grid",
    gap: 12,
  },
  employeeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    padding: 14,
  },
  employeeTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
  },
  employeeMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 700,
  },
  employeeStatus: {
    height: 30,
    padding: "0 12px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
  },
  employeeStatusActive: {
    background: "#dcfce7",
    color: "#166534",
  },
  employeeStatusInactive: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  employeeInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  miniInfo: {
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: 10,
    display: "grid",
    gap: 4,
  },
  miniInfoLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
  },
  miniInfoValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  employeeActions: {
    display: "flex",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  primaryButton: {
    height: 46,
    border: "none",
    borderRadius: 14,
    padding: "0 18px",
    background: "#111827",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    height: 46,
    border: "1px solid #d1d5db",
    borderRadius: 14,
    padding: "0 18px",
    background: "#fff",
    color: "#111827",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    height: 46,
    border: "none",
    borderRadius: 14,
    padding: "0 18px",
    background: "#dc2626",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButtonSmall: {
    height: 40,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "0 14px",
    background: "#fff",
    color: "#111827",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButtonSmall: {
    height: 40,
    border: "none",
    borderRadius: 12,
    padding: "0 14px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  loadingCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: "48px 24px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },
  errorCard: {
    background: "#fff",
    border: "1px solid #fecaca",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#991b1b",
    marginBottom: 10,
  },
  errorText: {
    color: "#7f1d1d",
    lineHeight: 1.7,
    marginBottom: 18,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 9999,
  },
  modalCard: {
    width: "100%",
    maxWidth: 880,
    background: "#fff",
    borderRadius: 26,
    border: "1px solid #e2e8f0",
    boxShadow: "0 24px 70px rgba(0,0,0,0.18)",
    padding: 24,
    maxHeight: "92vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
  },
  modalTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
  },
  modalSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.7,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
    fontSize: 22,
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gap: 16,
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    border: "1px solid #dbe4ee",
    padding: "0 14px",
    fontSize: 14,
    background: "#fff",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 130,
    borderRadius: 14,
    border: "1px solid #dbe4ee",
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
  },
  fileInput: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #dbe4ee",
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },
  uploadHint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.7,
  },
  logoPreviewSection: {
    display: "flex",
    justifyContent: "flex-start",
  },
  logoPreviewCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 14,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
    justifyItems: "center",
    minWidth: 170,
  },
  logoPreviewWrap: {
    width: 120,
    height: 120,
    borderRadius: 20,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    background: "#fff",
  },
  logoPreview: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  logoPreviewText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 24,
    flexWrap: "wrap",
  },
  deleteBox: {
    padding: "12px 0",
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.7,
  },
};
