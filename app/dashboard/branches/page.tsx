"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatDateSafe } from "@/lib/date";
import { toFiniteNumber } from "@/lib/number";

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

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getBranchInitial(name?: string | null) {
  return (name || "B").trim().charAt(0).toUpperCase() || "B";
}

function getImageUrl(url?: string | null) {
  return resolveAssetUrl(url);
}

function extractBranchItems(data: unknown): Branch[] {
  if (Array.isArray(data)) {
    return data as Branch[];
  }

  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;

    if (Array.isArray(record.items)) {
      return record.items as Branch[];
    }

    if (Array.isArray(record.data)) {
      return record.data as Branch[];
    }
  }

  return [];
}

export default function BranchesPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BranchStatus>("ALL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const [form, setForm] = useState<BranchFormData>(emptyForm);

  const loadBranches = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setPageLoading(true);

      setError("");

      const data = await apiRequest<unknown>("/branches");
      const items = extractBranchItems(data);

      setBranches(items);
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to load branches"));
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBranches(true);
  }, [loadBranches]);

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setForm(emptyForm);
  }

  function closeAllModals() {
    setIsCreateOpen(false);
    setEditingBranch(null);
    setDeletingBranch(null);
    resetForm();
  }

  function openCreateModal() {
    resetMessages();
    resetForm();
    setIsCreateOpen(true);
  }

  function openEditModal(branch: Branch) {
    resetMessages();
    setEditingBranch(branch);
    setForm({
      name: branch.name || "",
      location: branch.location || "",
      managerName: branch.managerName || "",
      logoUrl: (branch.logoUrl || "").trim(),
      description: branch.description || "",
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
      status: branch.status || "ACTIVE",
    });
  }

  function openDeleteModal(branch: Branch) {
    resetMessages();
    setDeletingBranch(branch);
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

  async function handleCreate() {
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

      const result = await apiRequest<{ message?: string; data?: Branch }>("/branches", {
        method: "POST",
        body: payload,
      });

      closeAllModals();
      setSuccess(result?.message || "Branch created successfully.");
      await loadBranches();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to create branch"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingBranch) return;
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
        `/branches/${editingBranch.id}`,
        {
          method: "PATCH",
          body: payload,
        },
      );

      closeAllModals();
      setSuccess(result?.message || "Branch updated successfully.");
      await loadBranches();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to update branch"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingBranch) return;

    try {
      setSaving(true);
      resetMessages();

      const result = await apiRequest<{ message?: string }>(
        `/branches/${deletingBranch.id}`,
        {
          method: "DELETE",
        },
      );

      closeAllModals();
      setSuccess(result?.message || "Branch deleted successfully.");
      await loadBranches();
    } catch (err) {
      if (handleAuthError(err, router)) return;
      setError(getErrorMessage(err, "Failed to delete branch"));
    } finally {
      setSaving(false);
    }
  }

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();

    return branches.filter((branch) => {
      const matchesSearch =
        !q ||
        normalizeText(branch.name).includes(q) ||
        normalizeText(branch.location).includes(q) ||
        normalizeText(branch.managerName).includes(q) ||
        normalizeText(branch.email).includes(q) ||
        normalizeText(branch.phone).includes(q) ||
        normalizeText(branch.address).includes(q) ||
        normalizeText(branch.description).includes(q) ||
        normalizeText(branch.status).includes(q);

      const matchesStatus =
        statusFilter === "ALL" ? true : branch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);

  const totalEmployees = useMemo(() => {
    return branches.reduce((sum, item) => sum + toFiniteNumber(item.employeeCount), 0);
  }, [branches]);

  const activeBranches = useMemo(() => {
    return branches.filter((item) => item.status === "ACTIVE").length;
  }, [branches]);

  const inactiveBranches = useMemo(() => {
    return branches.filter((item) => item.status === "INACTIVE").length;
  }, [branches]);

  const branchesWithLogos = useMemo(() => {
    return branches.filter((item) => !!item.logoUrl?.trim()).length;
  }, [branches]);

  return (
    <div style={styles.page}>
      <div style={styles.heroCard}>
        <div style={styles.heroContent}>
          <div style={styles.heroTextWrap}>
            <div style={styles.heroKicker}>Organization Structure</div>
            <h1 style={styles.heroTitle}>Branches Directory</h1>
            <p style={styles.heroSubtitle}>
              Manage branch identity, branding, contact details, location data,
              operational status, and workforce allocation from one premium workspace.
            </p>

            <div style={styles.heroButtons}>
              <button
                style={styles.secondaryButton}
                onClick={() => loadBranches()}
                disabled={pageLoading}
              >
                {pageLoading ? "Refreshing..." : "Refresh"}
              </button>

              <button style={styles.primaryButton} onClick={openCreateModal}>
                + Add Branch
              </button>
            </div>
          </div>

          <div style={styles.heroPanel}>
            <div style={styles.heroPanelLabel}>Directory Health</div>
            <div style={styles.heroPanelValue}>{branches.length}</div>
            <div style={styles.heroPanelHint}>Total branch records</div>
          </div>
        </div>
      </div>

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

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Branches</div>
          <div style={styles.statValue}>{branches.length}</div>
          <div style={styles.statHint}>All registered branches</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active Branches</div>
          <div style={styles.statValue}>{activeBranches}</div>
          <div style={styles.statHint}>Operational branch locations</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Inactive Branches</div>
          <div style={styles.statValue}>{inactiveBranches}</div>
          <div style={styles.statHint}>Archived or paused branches</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Assigned Employees</div>
          <div style={styles.statValue}>{totalEmployees}</div>
          <div style={styles.statHint}>Employees linked to branches</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Branches With Logo</div>
          <div style={styles.statValue}>{branchesWithLogos}</div>
          <div style={styles.statHint}>Brand identity coverage</div>
        </div>
      </div>

      <div style={styles.toolbarCard}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>⌕</span>
          <input
            style={styles.searchInput}
            placeholder="Search by name, manager, phone, email, address, location, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          style={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | BranchStatus)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>

        <div style={styles.resultsBadge}>
          Showing <strong>{filteredBranches.length}</strong>
        </div>
      </div>

      {loading ? (
        <div style={styles.emptyBox}>Loading branches...</div>
      ) : filteredBranches.length === 0 ? (
        <div style={styles.emptyBox}>
          {search.trim() || statusFilter !== "ALL"
            ? "No matching branches found."
            : "No branches created yet."}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredBranches.map((branch) => (
            <div key={branch.id} style={styles.branchCard}>
              <div style={styles.branchBanner}>
                {branch.logoUrl ? (
                  <Image
                    src={getImageUrl(branch.logoUrl)}
                    alt={branch.name}
                    width={640}
                    height={360}
                    unoptimized
                    style={styles.branchBannerImage}
                  />
                ) : (
                  <div style={styles.branchBannerFallback}>
                    {getBranchInitial(branch.name)}
                  </div>
                )}
              </div>

              <div style={styles.branchBody}>
                <div style={styles.branchTop}>
                  <div>
                    <h3 style={styles.branchName}>{branch.name}</h3>
                    <div style={styles.branchSubMeta}>Branch ID: {branch.id}</div>
                  </div>

                  <div style={styles.topBadges}>
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

                    <div style={styles.employeeBadge}>
                      {branch.employeeCount || 0} Employees
                    </div>
                  </div>
                </div>

                <div style={styles.infoGrid}>
                  <InfoCard label="Manager" value={branch.managerName} />
                  <InfoCard label="Location" value={branch.location} />
                  <InfoCard label="Phone" value={branch.phone} />
                  <InfoCard label="Email" value={branch.email} />
                  <InfoCard label="Address" value={branch.address} wide />
                  <InfoCard label="Created" value={formatDate(branch.createdAt)} />
                </div>

                <div style={styles.descriptionSection}>
                  <div style={styles.sectionMiniTitle}>Description</div>
                  {branch.description ? (
                    <div style={styles.descriptionBox}>{branch.description}</div>
                  ) : (
                    <div style={styles.descriptionMuted}>
                      No description added yet.
                    </div>
                  )}
                </div>

                <div style={styles.cardActions}>
                  <button
                    style={styles.secondaryButtonSmall}
                    onClick={() => router.push(`/dashboard/branches/${branch.id}`)}
                  >
                    View Details
                  </button>

                  <button
                    style={styles.secondaryButtonSmall}
                    onClick={() => openEditModal(branch)}
                  >
                    Edit
                  </button>

                  <button
                    style={styles.dangerButtonSmall}
                    onClick={() => openDeleteModal(branch)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(isCreateOpen || editingBranch) && (
        <Modal
          title={editingBranch ? "Edit Branch" : "Create Branch"}
          subtitle={
            editingBranch
              ? "Update branding, branch profile, contact details, and operational status."
              : "Create a complete branch profile with logo, contact details, and business identity."
          }
          onClose={closeAllModals}
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
                  : "Upload a professional branch image or logo. Best results: square image, clear background, clean branding."}
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
                  placeholder="Enter city or area"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Manager Name</label>
                <input
                  style={styles.input}
                  value={form.managerName}
                  onChange={(e) => onFieldChange("managerName", e.target.value)}
                  placeholder="Enter branch manager name"
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
                placeholder="Write a clear description of the branch, services, scope, or business notes"
              />
            </div>
          </div>

          <div style={styles.modalActions}>
            <button style={styles.secondaryButton} onClick={closeAllModals}>
              Cancel
            </button>

            <button
              style={styles.primaryButton}
              onClick={editingBranch ? handleUpdate : handleCreate}
              disabled={saving || uploadingLogo}
            >
              {saving
                ? "Saving..."
                : editingBranch
                  ? "Save Changes"
                  : "Create Branch"}
            </button>
          </div>
        </Modal>
      )}

      {deletingBranch && (
        <Modal
          title="Delete Branch"
          subtitle="This action cannot be undone."
          onClose={closeAllModals}
        >
          <div style={styles.deleteBox}>
            Are you sure you want to delete <strong>{deletingBranch.name}</strong>?
          </div>

          <div style={styles.modalActions}>
            <button style={styles.secondaryButton} onClick={closeAllModals}>
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
    </div>
  );
}

function InfoCard({
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
        ...styles.infoCard,
        ...(wide ? styles.infoCardWide : {}),
      }}
    >
      <div style={styles.infoCardLabel}>{label}</div>
      <div style={styles.infoCardValue}>{value || "Not set"}</div>
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
    padding: "24px",
  },
  heroCard: {
    marginBottom: "20px",
    borderRadius: "28px",
    padding: "26px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
  },
  heroContent: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "stretch",
    flexWrap: "wrap",
  },
  heroTextWrap: {
    flex: 1,
    minWidth: "320px",
  },
  heroKicker: {
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    opacity: 0.8,
    marginBottom: "12px",
  },
  heroTitle: {
    margin: 0,
    fontSize: "36px",
    fontWeight: 900,
    lineHeight: 1.05,
  },
  heroSubtitle: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.82)",
    fontSize: "15px",
    lineHeight: 1.8,
    maxWidth: "760px",
  },
  heroButtons: {
    display: "flex",
    gap: "12px",
    marginTop: "22px",
    flexWrap: "wrap",
  },
  heroPanel: {
    minWidth: "220px",
    borderRadius: "22px",
    padding: "20px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(8px)",
    display: "grid",
    alignContent: "start",
    gap: "8px",
  },
  heroPanelLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.78)",
  },
  heroPanelValue: {
    fontSize: "40px",
    fontWeight: 900,
    lineHeight: 1,
  },
  heroPanelHint: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.75)",
  },
  alert: {
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "16px",
    fontSize: "14px",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 700,
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "30px",
    fontWeight: 900,
    color: "#0f172a",
  },
  statHint: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#94a3b8",
  },
  toolbarCard: {
    marginBottom: "18px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "16px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.03)",
  },
  searchWrap: {
    position: "relative",
    flex: 1,
    minWidth: "280px",
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    fontSize: "14px",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    height: "48px",
    borderRadius: "14px",
    border: "1px solid #dbe4ee",
    background: "#fff",
    padding: "0 14px 0 38px",
    fontSize: "14px",
    outline: "none",
  },
  filterSelect: {
    height: "48px",
    borderRadius: "14px",
    border: "1px solid #dbe4ee",
    background: "#fff",
    padding: "0 14px",
    fontSize: "14px",
    outline: "none",
    minWidth: "180px",
  },
  resultsBadge: {
    height: "44px",
    padding: "0 14px",
    borderRadius: "999px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "inline-flex",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: "18px",
  },
  branchCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "26px",
    overflow: "hidden",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
  },
  branchBanner: {
    height: "200px",
    background: "linear-gradient(135deg, #e2e8f0, #f8fafc)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderBottom: "1px solid #e2e8f0",
  },
  branchBannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  branchBannerFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "64px",
    color: "#334155",
    background: "linear-gradient(135deg, #dbeafe, #ede9fe)",
  },
  branchBody: {
    padding: "20px",
  },
  branchTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  branchName: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 900,
    color: "#0f172a",
  },
  branchSubMeta: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: 700,
  },
  topBadges: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  statusBadge: {
    height: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
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
  employeeBadge: {
    height: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "14px",
  },
  infoCard: {
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: "12px",
    display: "grid",
    gap: "6px",
  },
  infoCardWide: {
    gridColumn: "1 / -1",
  },
  infoCardLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 800,
  },
  infoCardValue: {
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  sectionMiniTitle: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 800,
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  descriptionSection: {
    marginTop: "6px",
  },
  descriptionBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "12px",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.75,
  },
  descriptionMuted: {
    background: "#f8fafc",
    border: "1px dashed #e2e8f0",
    borderRadius: "14px",
    padding: "12px",
    color: "#94a3b8",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  cardActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  primaryButton: {
    height: "46px",
    border: "none",
    borderRadius: "14px",
    padding: "0 18px",
    background: "#111827",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    height: "46px",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "14px",
    padding: "0 18px",
    background: "#fff",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    height: "46px",
    border: "none",
    borderRadius: "14px",
    padding: "0 18px",
    background: "#dc2626",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButtonSmall: {
    height: "40px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "0 14px",
    background: "#fff",
    color: "#111827",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButtonSmall: {
    height: "40px",
    border: "none",
    borderRadius: "12px",
    padding: "0 14px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  emptyBox: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "48px 24px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 9999,
  },
  modalCard: {
    width: "100%",
    maxWidth: "880px",
    background: "#fff",
    borderRadius: "26px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 24px 70px rgba(0,0,0,0.18)",
    padding: "24px",
    maxHeight: "92vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "18px",
  },
  modalTitle: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 900,
    color: "#0f172a",
  },
  modalSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  closeButton: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    fontSize: "22px",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gap: "16px",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    height: "48px",
    borderRadius: "14px",
    border: "1px solid #dbe4ee",
    padding: "0 14px",
    fontSize: "14px",
    background: "#fff",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: "130px",
    borderRadius: "14px",
    border: "1px solid #dbe4ee",
    padding: "12px 14px",
    fontSize: "14px",
    background: "#fff",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
  },
  fileInput: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid #dbe4ee",
    padding: "10px 12px",
    fontSize: "14px",
    background: "#fff",
  },
  uploadHint: {
    fontSize: "12px",
    color: "#64748b",
    lineHeight: 1.7,
  },
  logoPreviewSection: {
    display: "flex",
    justifyContent: "flex-start",
  },
  logoPreviewCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "14px",
    background: "#f8fafc",
    display: "grid",
    gap: "10px",
    justifyItems: "center",
    minWidth: "170px",
  },
  logoPreviewWrap: {
    width: "120px",
    height: "120px",
    borderRadius: "20px",
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
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 700,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
  deleteBox: {
    padding: "12px 0",
    color: "#0f172a",
    fontSize: "15px",
    lineHeight: 1.7,
  },
};
