"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import { formatDateTimeSafe } from "@/lib/date";
import styles from "./employees-page.module.css";

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

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type GenderFilter = "ALL" | "MALE" | "FEMALE" | "OTHER";
type SortKey =
  | "id"
  | "fullName"
  | "department"
  | "email"
  | "phone"
  | "branch"
  | "status"
  | "updatedAt";
type SortDirection = "asc" | "desc";

type ContextMenuState = {
  employeeId: number | null;
  x: number;
  y: number;
};

type ToolbarMenuKey =
  | "import"
  | "transfer"
  | "app"
  | "settings"
  | null;

const PAGE_SIZE = 12;

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function formatDateTime(value?: string | null) {
  return formatDateTimeSafe(value, "--", "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDepartmentLabel(employee: Employee) {
  return employee.department || employee.section || "--";
}

function getAreaLabel(employee: Employee) {
  return employee.branch || employee.location || "--";
}

function getPositionCode(employee: Employee) {
  return employee.jobTitle || employee.level || employee.grade || "--";
}

function getDevicePrivilege(employee: Employee) {
  return employee.isActive === false ? "User" : "Admin";
}

function getEmployeeRoleName(employee: Employee) {
  return employee.jobTitle || employee.section || employee.level || "--";
}

function getFingerprintValue(employee: Employee) {
  return employee.id ? "Yes" : "No";
}

function getFaceValue(employee: Employee) {
  return employee.photoUrl ? "Yes" : "No";
}

function getPalmValue() {
  return "No";
}

function getMobileValue(employee: Employee) {
  return employee.phone || employee.companyPhoneNumber || "--";
}

export default function EmployeesPage() {
  const router = useRouter();

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [toolbarMenu, setToolbarMenu] = useState<ToolbarMenuKey>(null);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    employeeId: null,
    x: 0,
    y: 0,
  });

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);

      setMessage("");

      const data = await apiRequest<Employee[]>("/employees", {
        method: "GET",
        auth: true,
      });

      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to load employees");

      if (handleAuthError(error, router)) return;

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setToolbarMenu(null);
      }

      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenuState({ employeeId: null, x: 0, y: 0 });
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setToolbarMenu(null);
        setContextMenuState({ employeeId: null, x: 0, y: 0 });
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const uniqueBranches = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((emp) => (emp.branch || emp.location || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = employees.filter((emp) => {
      const matchesSearch =
        !q ||
        normalizeText(emp.fullName).includes(q) ||
        normalizeText(emp.email).includes(q) ||
        normalizeText(emp.phone).includes(q) ||
        normalizeText(emp.department).includes(q) ||
        normalizeText(emp.jobTitle).includes(q) ||
        normalizeText(emp.branch).includes(q) ||
        normalizeText(emp.location).includes(q) ||
        normalizeText(emp.shift).includes(q) ||
        normalizeText(emp.gender).includes(q) ||
        String(emp.id).includes(q);

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
            ? emp.isActive !== false
            : emp.isActive === false;

      const gender = normalizeText(emp.gender);
      const matchesGender =
        genderFilter === "ALL"
          ? true
          : genderFilter === "MALE"
            ? gender === "male"
            : genderFilter === "FEMALE"
              ? gender === "female"
              : gender !== "male" && gender !== "female";

      const branchName = normalizeText(emp.branch || emp.location);
      const matchesBranch =
        branchFilter === "ALL" ? true : branchName === normalizeText(branchFilter);

      return matchesSearch && matchesStatus && matchesGender && matchesBranch;
    });

    return [...list].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      const valueA =
        sortKey === "id"
          ? a.id
          : sortKey === "status"
            ? a.isActive === false
              ? 0
              : 1
            : sortKey === "updatedAt"
              ? new Date(a.updatedAt || a.createdAt || 0).getTime()
              : String(
                  sortKey === "fullName"
                    ? a.fullName
                    : sortKey === "department"
                      ? a.department || a.section || ""
                      : sortKey === "email"
                        ? a.email || ""
                        : sortKey === "phone"
                          ? a.phone || a.companyPhoneNumber || ""
                          : a.branch || a.location || "",
                ).toLowerCase();

      const valueB =
        sortKey === "id"
          ? b.id
          : sortKey === "status"
            ? b.isActive === false
              ? 0
              : 1
            : sortKey === "updatedAt"
              ? new Date(b.updatedAt || b.createdAt || 0).getTime()
              : String(
                  sortKey === "fullName"
                    ? b.fullName
                    : sortKey === "department"
                      ? b.department || b.section || ""
                      : sortKey === "email"
                        ? b.email || ""
                        : sortKey === "phone"
                          ? b.phone || b.companyPhoneNumber || ""
                          : b.branch || b.location || "",
                ).toLowerCase();

      if (valueA < valueB) return -1 * dir;
      if (valueA > valueB) return 1 * dir;
      return 0;
    });
  }, [
    employees,
    search,
    statusFilter,
    genderFilter,
    branchFilter,
    sortKey,
    sortDirection,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, genderFilter, branchFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));

  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, page]);

  const handleDeleteEmployee = async (id: number, name?: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${name || "this employee"}?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setMessage("");

      await apiRequest(`/employees/${id}`, {
        method: "DELETE",
        auth: true,
      });

      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setContextMenuState({ employeeId: null, x: 0, y: 0 });
      setMessage("Employee deleted successfully.");
    } catch (error) {
      if (handleAuthError(error, router)) return;
      setMessage(getErrorMessage(error, "Failed to delete employee"));
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) {
      setMessage("Please select at least one employee.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected employee(s)?`,
    );

    if (!confirmed) return;

    try {
      for (const id of selectedIds) {
        await apiRequest(`/employees/${id}`, {
          method: "DELETE",
          auth: true,
        });
      }

      setEmployees((prev) => prev.filter((emp) => !selectedIds.includes(emp.id)));
      setSelectedIds([]);
      setMessage("Selected employees deleted successfully.");
    } catch (error) {
      if (handleAuthError(error, router)) return;
      setMessage(getErrorMessage(error, "Failed to delete selected employees"));
    }
  };

  const handleOpenEmployee = (id: number) => {
    router.push(`/dashboard/employees/${id}`);
  };

  const handleEditEmployee = (id: number) => {
    router.push(`/dashboard/employees/${id}/edit`);
  };

  const handleCreateEmployee = () => {
    router.push("/dashboard/employees/create");
  };

  const handleRefresh = () => {
    void loadEmployees();
  };

  const handleContextMenuOpen = (
    event: React.MouseEvent<HTMLButtonElement>,
    employeeId: number,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setContextMenuState({
      employeeId,
      x: rect.left,
      y: rect.bottom + 6,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenuState({ employeeId: null, x: 0, y: 0 });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const toggleToolbarMenu = (key: Exclude<ToolbarMenuKey, null>) => {
    setToolbarMenu((prev) => (prev === key ? null : key));
  };

  const toggleSelectEmployee = (employeeId: number) => {
    setSelectedIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  };

  const allVisibleSelected =
    paginatedEmployees.length > 0 &&
    paginatedEmployees.every((emp) => selectedIds.includes(emp.id));

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedEmployees.map((emp) => emp.id);

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const showingTo = Math.min(page * PAGE_SIZE, filteredEmployees.length);

  return (
    <div className={styles.page}>
      <section className={styles.fullCard}>
        <div className={styles.erpToolbarWrap} ref={toolbarRef}>
          <div className={styles.erpToolbarLeft}>
            <button
              type="button"
              className={styles.erpToolbarButton}
              onClick={handleCreateEmployee}
            >
              Add
            </button>

            <button
              type="button"
              className={styles.erpToolbarButton}
              onClick={handleDeleteSelected}
            >
              Delete
            </button>

            <div className={styles.toolbarDropdown}>
              <button
                type="button"
                className={styles.erpToolbarButton}
                onClick={() => toggleToolbarMenu("import")}
              >
                Import <span className={styles.toolbarArrow}>▾</span>
              </button>

              {toolbarMenu === "import" ? (
                <div className={styles.toolbarMenu}>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Import Employee will be connected in the next step.");
                    }}
                  >
                    Import Employee
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Import Document will be connected in the next step.");
                    }}
                  >
                    Import Document
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Import Photo will be connected in the next step.");
                    }}
                  >
                    Import Photo
                  </button>
                </div>
              ) : null}
            </div>

            <div className={styles.toolbarDropdown}>
              <button
                type="button"
                className={styles.erpToolbarButton}
                onClick={() => toggleToolbarMenu("transfer")}
              >
                Personnel Transfer <span className={styles.toolbarArrow}>▾</span>
              </button>

              {toolbarMenu === "transfer" ? (
                <div className={styles.toolbarMenu}>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Department Transfer will be connected in the next step.");
                    }}
                  >
                    Department Transfer
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Position Transfer will be connected in the next step.");
                    }}
                  >
                    Position Transfer
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Move to New Area will be connected in the next step.");
                    }}
                  >
                    Move to New Area
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Copy to New Area will be connected in the next step.");
                    }}
                  >
                    Copy to New Area
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Holiday Transfer will be connected in the next step.");
                    }}
                  >
                    Holiday Transfer
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Pass Probation will be connected in the next step.");
                    }}
                  >
                    Pass Probation
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Resignation will be connected in the next step.");
                    }}
                  >
                    Resignation
                  </button>
                </div>
              ) : null}
            </div>

            <div className={styles.toolbarDropdown}>
              <button
                type="button"
                className={styles.erpToolbarButton}
                onClick={() => toggleToolbarMenu("app")}
              >
                App <span className={styles.toolbarArrow}>▾</span>
              </button>

              {toolbarMenu === "app" ? (
                <div className={styles.toolbarMenu}>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Enable will be connected in the next step.");
                    }}
                  >
                    Enable
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Disable will be connected in the next step.");
                    }}
                  >
                    Disable
                  </button>
                </div>
              ) : null}
            </div>

            <div className={styles.toolbarDropdown}>
              <button
                type="button"
                className={styles.erpToolbarButton}
                onClick={() => toggleToolbarMenu("settings")}
              >
                More settings <span className={styles.toolbarArrow}>▾</span>
              </button>

              {toolbarMenu === "settings" ? (
                <div className={styles.toolbarMenu}>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Resynchronize to device will be connected in the next step.");
                    }}
                  >
                    Resynchronize to device
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Re-upload from device will be connected in the next step.");
                    }}
                  >
                    Re-upload from device
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarMenuItem}
                    onClick={() => {
                      setToolbarMenu(null);
                      setMessage("Delete Biometric Template will be connected in the next step.");
                    }}
                  >
                    Delete Biometric Template
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.erpToolbarRight}>
            <button
              type="button"
              className={styles.erpIconButton}
              title="Refresh"
              onClick={handleRefresh}
            >
              ↺
            </button>
            <button type="button" className={styles.erpIconButton} title="Edit">
              ✎
            </button>
            <button type="button" className={styles.erpIconButton} title="Expand">
              ⤢
            </button>
            <button type="button" className={styles.erpIconButton} title="Split View">
              ☐
            </button>
            <button type="button" className={styles.erpIconButton} title="Share">
              ↗
            </button>
            <button type="button" className={styles.erpIconButton} title="Menu">
              ☷
            </button>
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterControls}>
            <select
              className={styles.controlSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">Status: All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              className={styles.controlSelect}
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="ALL">Area: All</option>
              {uniqueBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>

            <select
              className={styles.controlSelect}
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
            >
              <option value="ALL">Gender: All</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other / Unspecified</option>
            </select>

            <div className={styles.searchBox}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
                placeholder="Search employee"
              />
              <span className={styles.searchIcon}>⌕</span>
            </div>
          </div>
        </div>

        {message ? <div className={styles.messageBanner}>{message}</div> : null}

        {loading ? (
          <div className={styles.emptyState}>Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className={styles.emptyState}>None</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCheckbox}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                      />
                    </th>

                    <th className={styles.thSortable} onClick={() => toggleSort("id")}>
                      Employee Id <span className={styles.sortIcon}>↕</span>
                    </th>

                    <th className={styles.thSortable} onClick={() => toggleSort("fullName")}>
                      First Name <span className={styles.sortIcon}>↕</span>
                    </th>

                    <th className={styles.thSortable} onClick={() => toggleSort("department")}>
                      Department <span className={styles.sortIcon}>↕</span>
                    </th>

                    <th className={styles.th}>Position Code</th>
                    <th className={styles.thSortable} onClick={() => toggleSort("email")}>
                      Email <span className={styles.sortIcon}>↕</span>
                    </th>
                    <th className={styles.th}>Device Privilege</th>

                    <th className={styles.thSortable} onClick={() => toggleSort("branch")}>
                      Area <span className={styles.sortIcon}>↕</span>
                    </th>

                    <th className={styles.th}>Fingerprint</th>
                    <th className={styles.th}>Face</th>
                    <th className={styles.th}>Palm</th>

                    <th className={styles.thSortable} onClick={() => toggleSort("updatedAt")}>
                      Update Time <span className={styles.sortIcon}>↕</span>
                    </th>

                    <th className={styles.th}>Employee Role Name</th>

                    <th className={styles.thSortable} onClick={() => toggleSort("phone")}>
                      Mobile <span className={styles.sortIcon}>↕</span>
                    </th>

                    <th className={styles.thAction}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedEmployees.map((emp) => (
                    <tr key={emp.id} className={styles.tr}>
                      <td className={styles.tdCheckbox}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(emp.id)}
                          onChange={() => toggleSelectEmployee(emp.id)}
                        />
                      </td>

                      <td className={styles.tdCode}>{emp.id}</td>
                      <td className={styles.tdText}>{emp.fullName}</td>
                      <td className={styles.td}>{getDepartmentLabel(emp)}</td>
                      <td className={styles.td}>{getPositionCode(emp)}</td>
                      <td className={styles.td}>{emp.email || "--"}</td>
                      <td className={styles.td}>{getDevicePrivilege(emp)}</td>
                      <td className={styles.td}>{getAreaLabel(emp)}</td>
                      <td className={styles.td}>{getFingerprintValue(emp)}</td>
                      <td className={styles.td}>{getFaceValue(emp)}</td>
                      <td className={styles.td}>{getPalmValue()}</td>
                      <td className={styles.td}>
                        {formatDateTime(emp.updatedAt || emp.createdAt)}
                      </td>
                      <td className={styles.td}>{getEmployeeRoleName(emp)}</td>
                      <td className={styles.td}>{getMobileValue(emp)}</td>

                      <td className={styles.tdAction}>
                        <button
                          type="button"
                          className={styles.menuButton}
                          onClick={(e) => handleContextMenuOpen(e, emp.id)}
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.paginationBar}>
              <div className={styles.paginationInfo}>
                Showing {showingTo} of {filteredEmployees.length} entries
              </div>

              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={styles.paginationButton}
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>

                <span className={styles.pageNumber}>{page}</span>

                <button
                  type="button"
                  className={styles.paginationButton}
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {contextMenuState.employeeId !== null ? (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{
            top: contextMenuState.y,
            left: contextMenuState.x,
          }}
        >
          <button
            type="button"
            className={styles.contextItem}
            onClick={() => {
              handleOpenEmployee(contextMenuState.employeeId!);
              handleCloseContextMenu();
            }}
          >
            Profile
          </button>

          <button
            type="button"
            className={styles.contextItem}
            onClick={() => {
              handleEditEmployee(contextMenuState.employeeId!);
              handleCloseContextMenu();
            }}
          >
            Edit Data
          </button>

          <button
            type="button"
            className={styles.contextItem}
            onClick={() => {
              setMessage("Organization structure management will be connected in the next step.");
              handleCloseContextMenu();
            }}
          >
            Manage Organization Structure
          </button>

          <button
            type="button"
            className={styles.contextItem}
            onClick={() => {
              setMessage("Employee activation toggle will be connected in the next step.");
              handleCloseContextMenu();
            }}
          >
            Activate Employee
          </button>

          <button
            type="button"
            className={`${styles.contextItem} ${styles.contextItemDanger}`}
            onClick={() => {
              const employee = employees.find(
                (item) => item.id === contextMenuState.employeeId,
              );
              void handleDeleteEmployee(
                contextMenuState.employeeId!,
                employee?.fullName,
              );
            }}
          >
            Delete Employee
          </button>
        </div>
      ) : null}
    </div>
  );
}
