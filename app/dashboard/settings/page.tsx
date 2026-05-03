"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage, handleAuthError } from "@/lib/api";
import styles from "./settings-page.module.css";

type SettingsTab =
  | "overview"
  | "company"
  | "branding"
  | "attendance"
  | "devices"
  | "security"
  | "notifications"
  | "payroll"
  | "leaves"
  | "branches"
  | "roles"
  | "employeeFields"
  | "ai"
  | "dashboard";

type CompanyLanguage = "en" | "ar";
type WorkWeekStart = "Saturday" | "Sunday" | "Monday";
type PayrollCycle = "monthly" | "biweekly" | "weekly";
type BranchStatus = "active" | "inactive";
type DashboardDensity = "comfortable" | "compact";
type DashboardDefaultPage =
  | "executive"
  | "attendance"
  | "employees"
  | "devices";
type AiTone = "formal" | "neutral" | "friendly";

type SettingsState = {
  company: {
    companyName: string;
    legalName: string;
    domain: string;
    supportEmail: string;
    phone: string;
    timezone: string;
    currency: string;
    language: CompanyLanguage;
    address: string;
    city: string;
    country: string;
    logoUrl: string;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    companySlogan: string;
    loginHeadline: string;
    loginSubheadline: string;
    showCompanyLogoInSidebar: boolean;
    showCompanyLogoOnLogin: boolean;
    enableCustomFavicon: boolean;
    faviconUrl: string;
  };
  attendance: {
    defaultGraceMinutes: number;
    allowManualAttendance: boolean;
    requireCheckOut: boolean;
    autoProcessBiometricLogs: boolean;
    overtimeEnabled: boolean;
    latePenaltyEnabled: boolean;
    workWeekStartsOn: WorkWeekStart;
    defaultShiftName: string;
  };
  devices: {
    biometricModuleEnabled: boolean;
    allowPushMode: boolean;
    allowManualImport: boolean;
    unresolvedLogsAlert: boolean;
    offlineDeviceAlert: boolean;
    retryFailedJobs: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    forceStrongPasswords: boolean;
    enableTwoFactorLater: boolean;
    allowSingleSessionOnly: boolean;
    auditLogsEnabled: boolean;
    ipWhitelistEnabled: boolean;
    ipWhitelist: string;
  };
  notifications: {
    emailNotificationsEnabled: boolean;
    attendanceAlertsEnabled: boolean;
    payrollRemindersEnabled: boolean;
    employeeEventsEnabled: boolean;
    systemHealthAlertsEnabled: boolean;
    dailyDigestEnabled: boolean;
    recipients: string;
  };
  payroll: {
    payrollCycle: PayrollCycle;
    payrollDay: number;
    enableAllowances: boolean;
    enableDeductions: boolean;
    enableOvertimeInPayroll: boolean;
    enablePayslipGeneration: boolean;
    autoClosePayrollPeriod: boolean;
    baseWorkingDays: number;
  };
  leaves: {
    annualLeaveDays: number;
    sickLeaveDays: number;
    casualLeaveDays: number;
    requireManagerApproval: boolean;
    allowNegativeBalance: boolean;
    enableHalfDayLeave: boolean;
    carryForwardUnusedLeave: boolean;
    maxCarryForwardDays: number;
  };
  branches: {
    requireBranchAssignment: boolean;
    allowBranchTransfers: boolean;
    autoAssignByDevice: boolean;
    branchCodePrefix: string;
    defaultBranchStatus: BranchStatus;
    enableBranchManagers: boolean;
  };
  roles: {
    enableRoleBasedAccess: boolean;
    allowCustomRoles: boolean;
    adminsCanEditPermissions: boolean;
    managersCanApproveLeave: boolean;
    managersCanViewPayroll: boolean;
    employeesCanViewOwnProfile: boolean;
    employeesCanViewOwnPayslip: boolean;
    employeesCanRequestLeave: boolean;
  };
  employeeFields: {
    requireEmployeeCode: boolean;
    requireDepartment: boolean;
    requireJobTitle: boolean;
    requireHireDate: boolean;
    enableNationalId: boolean;
    enableEmergencyContact: boolean;
    enableBankInfo: boolean;
    enableDocumentsUpload: boolean;
  };
  ai: {
    aiInsightsEnabled: boolean;
    aiAttendanceRiskDetection: boolean;
    aiPayrollAnomalyDetection: boolean;
    aiSummaryTone: AiTone;
    aiWeeklyDigestEnabled: boolean;
    aiRecommendationsEnabled: boolean;
    aiAutoHighlightTopRisks: boolean;
  };
  dashboard: {
    defaultLandingPage: DashboardDefaultPage;
    density: DashboardDensity;
    showExecutiveCards: boolean;
    showAttendanceChart: boolean;
    showBranchBreakdown: boolean;
    showAiInsightsWidget: boolean;
    showDeviceStatusWidget: boolean;
    stickySidebarInDashboard: boolean;
  };
};

type Option = { label: string; value: string };
type SettingsSectionKey = Exclude<SettingsTab, "overview">;

type BaseField<K extends string> = {
  key: K;
  label: string;
  description?: string;
};

type TextFieldDef<K extends string> = BaseField<K> & {
  kind: "text" | "number" | "select";
  placeholder?: string;
  options?: Option[];
};

type ToggleFieldDef<K extends string> = BaseField<K> & {
  kind: "toggle";
};

type FieldDef<K extends string> = TextFieldDef<K> | ToggleFieldDef<K>;

type SectionGroup<S extends SettingsSectionKey> = {
  title: string;
  description: string;
  fields: FieldDef<Extract<keyof SettingsState[S], string>>[];
};

type SectionConfig<S extends SettingsSectionKey = SettingsSectionKey> = {
  key: S;
  title: string;
  description: string;
  badge: string;
  icon: string;
  accent: "blue" | "green" | "purple" | "orange" | "indigo";
  groups: SectionGroup<S>[];
};

function defineSection<S extends SettingsSectionKey>(
  config: SectionConfig<S>
): SectionConfig<S> {
  return config;
}

const DEFAULT_SETTINGS: SettingsState = {
  company: {
    companyName: "NexaHR",
    legalName: "NexaHR Company",
    domain: "getnexhr.com",
    supportEmail: "support@getnexhr.com",
    phone: "",
    timezone: "Asia/Baghdad",
    currency: "IQD",
    language: "en",
    address: "",
    city: "Baghdad",
    country: "Iraq",
    logoUrl: "",
  },
  branding: {
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    accentColor: "#0ea5e9",
    companySlogan: "Smarter HR Operations",
    loginHeadline: "Welcome back to NexaHR",
    loginSubheadline: "Manage your workforce from one secure workspace.",
    showCompanyLogoInSidebar: true,
    showCompanyLogoOnLogin: true,
    enableCustomFavicon: false,
    faviconUrl: "",
  },
  attendance: {
    defaultGraceMinutes: 10,
    allowManualAttendance: true,
    requireCheckOut: true,
    autoProcessBiometricLogs: true,
    overtimeEnabled: true,
    latePenaltyEnabled: false,
    workWeekStartsOn: "Saturday",
    defaultShiftName: "General Shift",
  },
  devices: {
    biometricModuleEnabled: true,
    allowPushMode: true,
    allowManualImport: true,
    unresolvedLogsAlert: true,
    offlineDeviceAlert: true,
    retryFailedJobs: true,
  },
  security: {
    sessionTimeoutMinutes: 120,
    forceStrongPasswords: true,
    enableTwoFactorLater: false,
    allowSingleSessionOnly: false,
    auditLogsEnabled: true,
    ipWhitelistEnabled: false,
    ipWhitelist: "",
  },
  notifications: {
    emailNotificationsEnabled: true,
    attendanceAlertsEnabled: true,
    payrollRemindersEnabled: true,
    employeeEventsEnabled: true,
    systemHealthAlertsEnabled: true,
    dailyDigestEnabled: false,
    recipients: "",
  },
  payroll: {
    payrollCycle: "monthly",
    payrollDay: 30,
    enableAllowances: true,
    enableDeductions: true,
    enableOvertimeInPayroll: true,
    enablePayslipGeneration: true,
    autoClosePayrollPeriod: false,
    baseWorkingDays: 26,
  },
  leaves: {
    annualLeaveDays: 20,
    sickLeaveDays: 10,
    casualLeaveDays: 5,
    requireManagerApproval: true,
    allowNegativeBalance: false,
    enableHalfDayLeave: true,
    carryForwardUnusedLeave: true,
    maxCarryForwardDays: 10,
  },
  branches: {
    requireBranchAssignment: true,
    allowBranchTransfers: true,
    autoAssignByDevice: false,
    branchCodePrefix: "BR",
    defaultBranchStatus: "active",
    enableBranchManagers: true,
  },
  roles: {
    enableRoleBasedAccess: true,
    allowCustomRoles: true,
    adminsCanEditPermissions: true,
    managersCanApproveLeave: true,
    managersCanViewPayroll: false,
    employeesCanViewOwnProfile: true,
    employeesCanViewOwnPayslip: true,
    employeesCanRequestLeave: true,
  },
  employeeFields: {
    requireEmployeeCode: true,
    requireDepartment: false,
    requireJobTitle: false,
    requireHireDate: true,
    enableNationalId: true,
    enableEmergencyContact: true,
    enableBankInfo: true,
    enableDocumentsUpload: true,
  },
  ai: {
    aiInsightsEnabled: true,
    aiAttendanceRiskDetection: true,
    aiPayrollAnomalyDetection: false,
    aiSummaryTone: "neutral",
    aiWeeklyDigestEnabled: true,
    aiRecommendationsEnabled: true,
    aiAutoHighlightTopRisks: true,
  },
  dashboard: {
    defaultLandingPage: "executive",
    density: "comfortable",
    showExecutiveCards: true,
    showAttendanceChart: true,
    showBranchBreakdown: true,
    showAiInsightsWidget: true,
    showDeviceStatusWidget: true,
    stickySidebarInDashboard: true,
  },
};

const SETTINGS_READ_ENDPOINT = "/company-settings/system";
const SETTINGS_SAVE_ENDPOINT = "/company-settings/system";

const SECTION_CONFIGS = [
  defineSection({
    key: "company",
    title: "Company Profile",
    description: "Core identity and contact information.",
    badge: "Organization",
    icon: "🏢",
    accent: "blue",
    groups: [
      {
        title: "Identity",
        description: "Primary brand and legal information.",
        fields: [
          { kind: "text", key: "companyName", label: "Company Name" },
          { kind: "text", key: "legalName", label: "Legal Name" },
          { kind: "text", key: "domain", label: "Domain" },
          { kind: "text", key: "logoUrl", label: "Logo URL" },
        ],
      },
      {
        title: "Regional Settings",
        description: "Language, timezone, and currency preferences.",
        fields: [
          { kind: "text", key: "timezone", label: "Timezone" },
          { kind: "text", key: "currency", label: "Currency" },
          {
            kind: "select",
            key: "language",
            label: "Language",
            options: [
              { label: "English", value: "en" },
              { label: "Arabic", value: "ar" },
            ],
          },
        ],
      },
      {
        title: "Contact Information",
        description: "Support and office contact details.",
        fields: [
          { kind: "text", key: "supportEmail", label: "Support Email" },
          { kind: "text", key: "phone", label: "Phone" },
          { kind: "text", key: "address", label: "Address" },
          { kind: "text", key: "city", label: "City" },
          { kind: "text", key: "country", label: "Country" },
        ],
      },
    ],
  }),

  defineSection({
    key: "branding",
    title: "Branding",
    description: "Colors, slogan, and login branding.",
    badge: "Visual Identity",
    icon: "🎨",
    accent: "indigo",
    groups: [
      {
        title: "Color System",
        description: "Main brand colors used across the platform.",
        fields: [
          { kind: "text", key: "primaryColor", label: "Primary Color" },
          { kind: "text", key: "secondaryColor", label: "Secondary Color" },
          { kind: "text", key: "accentColor", label: "Accent Color" },
          { kind: "text", key: "companySlogan", label: "Company Slogan" },
        ],
      },
      {
        title: "Login Branding",
        description: "Text and asset customization for login.",
        fields: [
          { kind: "text", key: "loginHeadline", label: "Login Headline" },
          { kind: "text", key: "loginSubheadline", label: "Login Subheadline" },
          { kind: "text", key: "faviconUrl", label: "Favicon URL" },
        ],
      },
      {
        title: "Brand Visibility",
        description: "Choose where branding assets should appear.",
        fields: [
          {
            kind: "toggle",
            key: "showCompanyLogoInSidebar",
            label: "Show Company Logo In Sidebar",
          },
          {
            kind: "toggle",
            key: "showCompanyLogoOnLogin",
            label: "Show Company Logo On Login",
          },
          {
            kind: "toggle",
            key: "enableCustomFavicon",
            label: "Enable Custom Favicon",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "attendance",
    title: "Attendance",
    description: "Rules and work settings.",
    badge: "Workforce Rules",
    icon: "🕒",
    accent: "green",
    groups: [
      {
        title: "Core Attendance Setup",
        description: "Default shift and timing policies.",
        fields: [
          {
            kind: "number",
            key: "defaultGraceMinutes",
            label: "Default Grace Minutes",
          },
          { kind: "text", key: "defaultShiftName", label: "Default Shift Name" },
          {
            kind: "select",
            key: "workWeekStartsOn",
            label: "Work Week Starts On",
            options: [
              { label: "Saturday", value: "Saturday" },
              { label: "Sunday", value: "Sunday" },
              { label: "Monday", value: "Monday" },
            ],
          },
        ],
      },
      {
        title: "Automation & Policy",
        description: "How the platform should process attendance.",
        fields: [
          {
            kind: "toggle",
            key: "allowManualAttendance",
            label: "Allow Manual Attendance",
          },
          { kind: "toggle", key: "requireCheckOut", label: "Require Check-Out" },
          {
            kind: "toggle",
            key: "autoProcessBiometricLogs",
            label: "Auto Process Biometric Logs",
          },
          { kind: "toggle", key: "overtimeEnabled", label: "Enable Overtime" },
          {
            kind: "toggle",
            key: "latePenaltyEnabled",
            label: "Enable Late Penalty",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "devices",
    title: "Devices",
    description: "Biometric integration settings.",
    badge: "Biometric Control",
    icon: "📡",
    accent: "purple",
    groups: [
      {
        title: "Device Controls",
        description: "Control how device-based data enters the platform.",
        fields: [
          {
            kind: "toggle",
            key: "biometricModuleEnabled",
            label: "Biometric Module Enabled",
          },
          { kind: "toggle", key: "allowPushMode", label: "Allow Push Mode" },
          { kind: "toggle", key: "allowManualImport", label: "Allow Manual Import" },
          {
            kind: "toggle",
            key: "unresolvedLogsAlert",
            label: "Unresolved Logs Alert",
          },
          {
            kind: "toggle",
            key: "offlineDeviceAlert",
            label: "Offline Device Alert",
          },
          { kind: "toggle", key: "retryFailedJobs", label: "Retry Failed Jobs" },
        ],
      },
    ],
  }),

  defineSection({
    key: "security",
    title: "Security",
    description: "Access and protection rules.",
    badge: "Protection",
    icon: "🛡️",
    accent: "orange",
    groups: [
      {
        title: "Session & Access",
        description: "Control timeouts and network restrictions.",
        fields: [
          {
            kind: "number",
            key: "sessionTimeoutMinutes",
            label: "Session Timeout (Minutes)",
          },
          {
            kind: "text",
            key: "ipWhitelist",
            label: "IP Whitelist",
            placeholder: "192.168.1.10, 10.0.0.5",
          },
        ],
      },
      {
        title: "Security Policy Switches",
        description: "Enable or disable protection controls.",
        fields: [
          {
            kind: "toggle",
            key: "forceStrongPasswords",
            label: "Force Strong Passwords",
          },
          {
            kind: "toggle",
            key: "enableTwoFactorLater",
            label: "Enable Two-Factor Later",
          },
          {
            kind: "toggle",
            key: "allowSingleSessionOnly",
            label: "Allow Single Session Only",
          },
          {
            kind: "toggle",
            key: "auditLogsEnabled",
            label: "Audit Logs Enabled",
          },
          {
            kind: "toggle",
            key: "ipWhitelistEnabled",
            label: "IP Whitelist Enabled",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "notifications",
    title: "Notifications",
    description: "Alerts and delivery rules.",
    badge: "Alerts",
    icon: "✉️",
    accent: "indigo",
    groups: [
      {
        title: "Recipients",
        description: "Define where operational notifications should be sent.",
        fields: [
          {
            kind: "text",
            key: "recipients",
            label: "Recipients",
            placeholder: "hr@getnexhr.com, ops@getnexhr.com",
          },
        ],
      },
      {
        title: "Notification Switches",
        description: "Choose which events generate alerts.",
        fields: [
          {
            kind: "toggle",
            key: "emailNotificationsEnabled",
            label: "Email Notifications Enabled",
          },
          {
            kind: "toggle",
            key: "attendanceAlertsEnabled",
            label: "Attendance Alerts",
          },
          {
            kind: "toggle",
            key: "payrollRemindersEnabled",
            label: "Payroll Reminders",
          },
          {
            kind: "toggle",
            key: "employeeEventsEnabled",
            label: "Employee Events",
          },
          {
            kind: "toggle",
            key: "systemHealthAlertsEnabled",
            label: "System Health Alerts",
          },
          { kind: "toggle", key: "dailyDigestEnabled", label: "Daily Digest" },
        ],
      },
    ],
  }),

  defineSection({
    key: "payroll",
    title: "Payroll",
    description: "Salary and payroll controls.",
    badge: "Compensation",
    icon: "💵",
    accent: "green",
    groups: [
      {
        title: "Payroll Cycle",
        description: "Define how and when payroll is generated.",
        fields: [
          {
            kind: "select",
            key: "payrollCycle",
            label: "Payroll Cycle",
            options: [
              { label: "Monthly", value: "monthly" },
              { label: "Biweekly", value: "biweekly" },
              { label: "Weekly", value: "weekly" },
            ],
          },
          { kind: "number", key: "payrollDay", label: "Payroll Day" },
          { kind: "number", key: "baseWorkingDays", label: "Base Working Days" },
        ],
      },
      {
        title: "Payroll Components",
        description: "Choose which compensation modules are active.",
        fields: [
          { kind: "toggle", key: "enableAllowances", label: "Enable Allowances" },
          { kind: "toggle", key: "enableDeductions", label: "Enable Deductions" },
          {
            kind: "toggle",
            key: "enableOvertimeInPayroll",
            label: "Enable Overtime In Payroll",
          },
          {
            kind: "toggle",
            key: "enablePayslipGeneration",
            label: "Enable Payslip Generation",
          },
          {
            kind: "toggle",
            key: "autoClosePayrollPeriod",
            label: "Auto Close Payroll Period",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "leaves",
    title: "Leaves",
    description: "Time off policies.",
    badge: "Time Off",
    icon: "🌴",
    accent: "orange",
    groups: [
      {
        title: "Leave Balances",
        description: "Default annual leave allocations.",
        fields: [
          { kind: "number", key: "annualLeaveDays", label: "Annual Leave Days" },
          { kind: "number", key: "sickLeaveDays", label: "Sick Leave Days" },
          { kind: "number", key: "casualLeaveDays", label: "Casual Leave Days" },
          {
            kind: "number",
            key: "maxCarryForwardDays",
            label: "Max Carry Forward Days",
          },
        ],
      },
      {
        title: "Leave Workflow",
        description: "Control approval rules and balance behavior.",
        fields: [
          {
            kind: "toggle",
            key: "requireManagerApproval",
            label: "Require Manager Approval",
          },
          {
            kind: "toggle",
            key: "allowNegativeBalance",
            label: "Allow Negative Balance",
          },
          {
            kind: "toggle",
            key: "enableHalfDayLeave",
            label: "Enable Half Day Leave",
          },
          {
            kind: "toggle",
            key: "carryForwardUnusedLeave",
            label: "Carry Forward Unused Leave",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "branches",
    title: "Branches",
    description: "Branch structure rules.",
    badge: "Structure",
    icon: "🏬",
    accent: "blue",
    groups: [
      {
        title: "Branch Defaults",
        description: "Standard branch behavior and naming logic.",
        fields: [
          { kind: "text", key: "branchCodePrefix", label: "Branch Code Prefix" },
          {
            kind: "select",
            key: "defaultBranchStatus",
            label: "Default Branch Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ],
      },
      {
        title: "Branch Workflow",
        description:
          "Control assignment, transfer, and branch leadership options.",
        fields: [
          {
            kind: "toggle",
            key: "requireBranchAssignment",
            label: "Require Branch Assignment",
          },
          {
            kind: "toggle",
            key: "allowBranchTransfers",
            label: "Allow Branch Transfers",
          },
          {
            kind: "toggle",
            key: "autoAssignByDevice",
            label: "Auto Assign By Device",
          },
          {
            kind: "toggle",
            key: "enableBranchManagers",
            label: "Enable Branch Managers",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "roles",
    title: "Roles",
    description: "Permissions and access behavior.",
    badge: "Access Control",
    icon: "👥",
    accent: "purple",
    groups: [
      {
        title: "Core Permission System",
        description: "Global access and role structure.",
        fields: [
          {
            kind: "toggle",
            key: "enableRoleBasedAccess",
            label: "Enable Role-Based Access",
          },
          { kind: "toggle", key: "allowCustomRoles", label: "Allow Custom Roles" },
          {
            kind: "toggle",
            key: "adminsCanEditPermissions",
            label: "Admins Can Edit Permissions",
          },
        ],
      },
      {
        title: "Manager Access",
        description: "What managers are allowed to do.",
        fields: [
          {
            kind: "toggle",
            key: "managersCanApproveLeave",
            label: "Managers Can Approve Leave",
          },
          {
            kind: "toggle",
            key: "managersCanViewPayroll",
            label: "Managers Can View Payroll",
          },
        ],
      },
      {
        title: "Employee Self-Service",
        description: "What employees can see and request themselves.",
        fields: [
          {
            kind: "toggle",
            key: "employeesCanViewOwnProfile",
            label: "Employees Can View Own Profile",
          },
          {
            kind: "toggle",
            key: "employeesCanViewOwnPayslip",
            label: "Employees Can View Own Payslip",
          },
          {
            kind: "toggle",
            key: "employeesCanRequestLeave",
            label: "Employees Can Request Leave",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "employeeFields",
    title: "Employee Fields",
    description: "Profile and data structure.",
    badge: "Profile Structure",
    icon: "🧾",
    accent: "indigo",
    groups: [
      {
        title: "Required Fields",
        description: "Fields that must exist for every employee.",
        fields: [
          {
            kind: "toggle",
            key: "requireEmployeeCode",
            label: "Require Employee Code",
          },
          {
            kind: "toggle",
            key: "requireDepartment",
            label: "Require Department",
          },
          { kind: "toggle", key: "requireJobTitle", label: "Require Job Title" },
          { kind: "toggle", key: "requireHireDate", label: "Require Hire Date" },
        ],
      },
      {
        title: "Optional Extended Fields",
        description: "Enable more detailed employee records.",
        fields: [
          { kind: "toggle", key: "enableNationalId", label: "Enable National ID" },
          {
            kind: "toggle",
            key: "enableEmergencyContact",
            label: "Enable Emergency Contact",
          },
          { kind: "toggle", key: "enableBankInfo", label: "Enable Bank Info" },
          {
            kind: "toggle",
            key: "enableDocumentsUpload",
            label: "Enable Documents Upload",
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "ai",
    title: "AI Settings",
    description: "Insights and automation.",
    badge: "Smart HR",
    icon: "🧠",
    accent: "purple",
    groups: [
      {
        title: "AI Core Features",
        description: "Enable or disable AI services.",
        fields: [
          { kind: "toggle", key: "aiInsightsEnabled", label: "AI Insights Enabled" },
          {
            kind: "toggle",
            key: "aiAttendanceRiskDetection",
            label: "Attendance Risk Detection",
          },
          {
            kind: "toggle",
            key: "aiPayrollAnomalyDetection",
            label: "Payroll Anomaly Detection",
          },
          {
            kind: "toggle",
            key: "aiWeeklyDigestEnabled",
            label: "AI Weekly Digest Enabled",
          },
          {
            kind: "toggle",
            key: "aiRecommendationsEnabled",
            label: "AI Recommendations Enabled",
          },
          {
            kind: "toggle",
            key: "aiAutoHighlightTopRisks",
            label: "Auto Highlight Top Risks",
          },
        ],
      },
      {
        title: "AI Communication Style",
        description: "Choose the tone of AI-generated summaries.",
        fields: [
          {
            kind: "select",
            key: "aiSummaryTone",
            label: "AI Summary Tone",
            options: [
              { label: "Formal", value: "formal" },
              { label: "Neutral", value: "neutral" },
              { label: "Friendly", value: "friendly" },
            ],
          },
        ],
      },
    ],
  }),

  defineSection({
    key: "dashboard",
    title: "Dashboard",
    description: "Widget and landing preferences.",
    badge: "Workspace View",
    icon: "📊",
    accent: "green",
    groups: [
      {
        title: "Default View",
        description: "Choose how users first land in the dashboard.",
        fields: [
          {
            kind: "select",
            key: "defaultLandingPage",
            label: "Default Landing Page",
            options: [
              { label: "Executive", value: "executive" },
              { label: "Attendance", value: "attendance" },
              { label: "Employees", value: "employees" },
              { label: "Devices", value: "devices" },
            ],
          },
          {
            kind: "select",
            key: "density",
            label: "Dashboard Density",
            options: [
              { label: "Comfortable", value: "comfortable" },
              { label: "Compact", value: "compact" },
            ],
          },
        ],
      },
      {
        title: "Visible Widgets",
        description: "Choose which dashboard blocks are visible by default.",
        fields: [
          {
            kind: "toggle",
            key: "showExecutiveCards",
            label: "Show Executive Cards",
          },
          {
            kind: "toggle",
            key: "showAttendanceChart",
            label: "Show Attendance Chart",
          },
          {
            kind: "toggle",
            key: "showBranchBreakdown",
            label: "Show Branch Breakdown",
          },
          {
            kind: "toggle",
            key: "showAiInsightsWidget",
            label: "Show AI Insights Widget",
          },
          {
            kind: "toggle",
            key: "showDeviceStatusWidget",
            label: "Show Device Status Widget",
          },
          {
            kind: "toggle",
            key: "stickySidebarInDashboard",
            label: "Sticky Sidebar In Dashboard",
          },
        ],
      },
    ],
  }),
] as const;

export default function SettingsSystemPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] =
    useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings]
  );

  const visibleTabs = useMemo(() => {
    const tabs = [
      {
        key: "overview" as SettingsTab,
        title: "Overview",
        subtitle: "System summary",
        keywords: ["overview", "summary", "system"],
      },
      ...SECTION_CONFIGS.map((section) => ({
        key: section.key as SettingsTab,
        title: section.title,
        subtitle: section.description,
        keywords: [
          section.title.toLowerCase(),
          section.key.toLowerCase(),
          ...section.groups.flatMap((g) =>
            g.fields.map((f) => f.label.toLowerCase())
          ),
        ],
      })),
    ];

    if (!query.trim()) return tabs;

    const q = query.toLowerCase();

    return tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(q) ||
        tab.subtitle.toLowerCase().includes(q) ||
        tab.keywords.some((keyword) => keyword.includes(q))
    );
  }, [query]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab) && visibleTabs[0]) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      setSaveMessage("");

      const response = await apiRequest<Partial<SettingsState>>(
        SETTINGS_READ_ENDPOINT,
        {
          method: "GET",
          auth: true,
        }
      );

      const merged = mergeSettings(DEFAULT_SETTINGS, response || {});
      setSettings(merged);
      setInitialSettings(merged);
    } catch (error) {
      if (handleAuthError(error, router)) return;

      setSettings(DEFAULT_SETTINGS);
      setInitialSettings(DEFAULT_SETTINGS);
      setLoadError(
        getErrorMessage(
          error,
          "Unable to load settings from the server. Showing default values for now."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    try {
      setSaving(true);
      setSaveMessage("");

      await apiRequest<void>(SETTINGS_SAVE_ENDPOINT, {
        method: "PATCH",
        auth: true,
        body: settings,
      });

      setInitialSettings(structuredClone(settings));
      setSaveMessage("Settings saved successfully.");
    } catch (error) {
      if (handleAuthError(error, router)) return;

      setSaveMessage(getErrorMessage(error, "Failed to save settings. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function resetChanges() {
    setSettings(structuredClone(initialSettings));
    setSaveMessage("");
  }

  function updateSection<
    S extends keyof SettingsState,
    K extends keyof SettingsState[S]
  >(section: S, key: K, value: SettingsState[S][K]) {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  }

  const topStats = [
    {
      label: "Timezone",
      value: settings.company.timezone || "-",
      note: "Regional setting",
      icon: "🌍",
    },
    {
      label: "Payroll Cycle",
      value: settings.payroll.payrollCycle,
      note: "Compensation rhythm",
      icon: "💵",
    },
    {
      label: "AI Insights",
      value: settings.ai.aiInsightsEnabled ? "Enabled" : "Disabled",
      note: "Smart assistance",
      icon: "🧠",
    },
    {
      label: "Dashboard",
      value: settings.dashboard.defaultLandingPage,
      note: "Default workspace",
      icon: "📊",
    },
  ];

  const quickSummary = [
    {
      title: "Company",
      value: settings.company.companyName || "NexaHR",
      sub: settings.company.domain || "-",
    },
    {
      title: "Payroll",
      value: settings.payroll.payrollCycle,
      sub: `Day ${settings.payroll.payrollDay}`,
    },
    {
      title: "AI",
      value: settings.ai.aiInsightsEnabled ? "Enabled" : "Disabled",
      sub: settings.ai.aiSummaryTone,
    },
    {
      title: "Dashboard",
      value: settings.dashboard.defaultLandingPage,
      sub: settings.dashboard.density,
    },
  ];

  const categoryCards = SECTION_CONFIGS.map((section) => ({
    key: section.key,
    title: section.title,
    subtitle: section.description,
    accent: section.accent,
    icon: section.icon,
    value: readCategoryValue(section.key, settings),
  }));

  const selectedSection =
    activeTab === "overview"
      ? null
      : SECTION_CONFIGS.find((s) => s.key === activeTab) || null;

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingSpinner} />
            <h2 className={styles.loadingTitle}>Loading Settings System</h2>
            <p className={styles.loadingText}>
              Preparing your NexaHR configuration workspace...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backgroundOrbOne} />
      <div className={styles.backgroundOrbTwo} />

      <SettingsTopbar
        title="Settings System"
        subtitle="Manage company identity, branding, attendance behavior, devices, security, payroll, leaves, branches, roles, AI features, dashboard preferences, and employee profile settings from one professional workspace."
        query={query}
        onQueryChange={setQuery}
        onRefresh={() => void loadSettings()}
        onSave={() => void saveSettings()}
        saving={saving}
        dirty={isDirty}
      />

      <QuickSummaryBar items={quickSummary} />

      {loadError ? (
        <div className={styles.warningBanner}>
          <div className={styles.warningTitle}>Backend response issue</div>
          <div className={styles.warningText}>{loadError}</div>
        </div>
      ) : null}

      {saveMessage ? (
        <div
          className={`${styles.messageBanner} ${
            saveMessage === "Settings saved successfully."
              ? styles.messageSuccess
              : styles.messageWarning
          }`}
        >
          {saveMessage}
        </div>
      ) : null}

      <SettingsOverview items={topStats} />

      <div className={styles.layout}>
        <SettingsSidebar
          tabs={visibleTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <main className={styles.main}>
          {activeTab === "overview" ? (
            <div className={styles.sectionsWrap}>
              <SettingsSectionCard
                title="Configuration Overview"
                description="A management-level summary of your current settings structure."
                badge="Executive View"
                actions={
                  <div className={styles.sectionToolbar}>
                    <MiniAction
                      label="Refresh Data"
                      onClick={() => void loadSettings()}
                    />
                    <MiniAction
                      label="Save Current"
                      onClick={() => void saveSettings()}
                    />
                  </div>
                }
              >
                <div className={styles.overviewGrid}>
                  <OverviewItem
                    label="Company Name"
                    value={settings.company.companyName}
                  />
                  <OverviewItem
                    label="Primary Color"
                    value={settings.branding.primaryColor}
                  />
                  <OverviewItem
                    label="Payroll Cycle"
                    value={settings.payroll.payrollCycle}
                  />
                  <OverviewItem
                    label="Annual Leave"
                    value={`${settings.leaves.annualLeaveDays} days`}
                  />
                  <OverviewItem
                    label="Branch Prefix"
                    value={settings.branches.branchCodePrefix}
                  />
                  <OverviewItem
                    label="RBAC"
                    value={
                      settings.roles.enableRoleBasedAccess ? "Enabled" : "Disabled"
                    }
                  />
                  <OverviewItem
                    label="AI Insights"
                    value={settings.ai.aiInsightsEnabled ? "Enabled" : "Disabled"}
                  />
                  <OverviewItem
                    label="Dashboard Landing"
                    value={settings.dashboard.defaultLandingPage}
                  />
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Settings Categories"
                description="Jump quickly into each configuration domain."
                badge="Quick Navigation"
              >
                <div className={styles.categoryGrid}>
                  {categoryCards.map((card) => (
                    <CategoryCard
                      key={card.key}
                      title={card.title}
                      subtitle={card.subtitle}
                      value={card.value}
                      accent={card.accent}
                      icon={card.icon}
                      onClick={() => setActiveTab(card.key)}
                    />
                  ))}
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Operational Readiness"
                description="Quick checks for system configuration quality."
                badge="Health Check"
              >
                <div className={styles.checkList}>
                  <CheckLine
                    good={Boolean(settings.company.supportEmail)}
                    text="Support email is configured"
                  />
                  <CheckLine
                    good={settings.payroll.enablePayslipGeneration}
                    text="Payslip generation is active"
                  />
                  <CheckLine
                    good={settings.leaves.requireManagerApproval}
                    text="Leave approval workflow is active"
                  />
                  <CheckLine
                    good={settings.roles.enableRoleBasedAccess}
                    text="Role-based access is enabled"
                  />
                  <CheckLine
                    good={settings.employeeFields.enableDocumentsUpload}
                    text="Employee documents upload is active"
                  />
                  <CheckLine
                    good={settings.ai.aiInsightsEnabled}
                    text="AI insights are enabled"
                  />
                </div>
              </SettingsSectionCard>
            </div>
          ) : selectedSection ? (
            <div className={styles.sectionsWrap}>
              <RenderSection
                section={selectedSection as SectionConfig}
                settings={settings}
                updateSection={updateSection}
              />
            </div>
          ) : (
            <div className={styles.sectionsWrap}>
              <SettingsSectionCard
                title="Section not found"
                description="The requested settings section could not be loaded."
                badge="Warning"
              >
                <div className={styles.warningBanner}>
                  <div className={styles.warningTitle}>Invalid tab</div>
                  <div className={styles.warningText}>
                    Please choose another section from the sidebar.
                  </div>
                </div>
              </SettingsSectionCard>
            </div>
          )}
        </main>
      </div>

      <div
        className={styles.bottomSaveBar}
        style={{
          transform: isDirty ? "translateY(0)" : "translateY(140%)",
          opacity: isDirty ? 1 : 0,
          pointerEvents: isDirty ? "auto" : "none",
        }}
      >
        <div>
          <div className={styles.bottomSaveTitle}>Unsaved changes</div>
          <div className={styles.bottomSaveText}>
            You have updated settings that are not saved yet.
          </div>
        </div>

        <div className={styles.bottomSaveActions}>
          <button type="button" onClick={resetChanges} className={styles.resetBtn}>
            Reset
          </button>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? "Saving..." : "Save Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenderSection<S extends SettingsSectionKey>({
  section,
  settings,
  updateSection,
}: {
  section: SectionConfig<S>;
  settings: SettingsState;
  updateSection: <
    X extends keyof SettingsState,
    K extends keyof SettingsState[X]
  >(
    section: X,
    key: K,
    value: SettingsState[X][K]
  ) => void;
}) {
  const sectionState = settings[section.key];

  return (
    <SettingsSectionCard
      title={section.title}
      description={section.description}
      badge={section.badge}
    >
      {section.key === "company" ? (
        <div className={styles.companyLayout}>
          <div className={styles.brandPreviewCard}>
            <div className={styles.brandPreviewHeader}>
              <div className={styles.brandPreviewBadge}>Brand Preview</div>
            </div>

              <div className={styles.brandLogoArea}>
                {settings.company.logoUrl ? (
                  <Image
                    src={settings.company.logoUrl}
                    alt="Company logo"
                    className={styles.brandLogoImage}
                    width={160}
                    height={160}
                    unoptimized
                  />
                ) : (
                <div className={styles.brandLogoFallback}>
                  {(settings.company.companyName || "N")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div className={styles.brandCompanyName}>
              {settings.company.companyName || "Company Name"}
            </div>
            <div className={styles.brandCompanySub}>
              {settings.company.domain || "company-domain.com"}
            </div>

            <div className={styles.brandMetaList}>
              <BrandMeta
                label="Language"
                value={settings.company.language.toUpperCase()}
              />
              <BrandMeta label="Currency" value={settings.company.currency} />
              <BrandMeta label="Timezone" value={settings.company.timezone} />
            </div>
          </div>

          <div className={styles.companyFormsWrap}>
            {section.groups.map((group) => (
              <SettingsGroup
                key={group.title}
                title={group.title}
                description={group.description}
              >
                <FieldGrid
                  sectionKey={section.key}
                  fields={group.fields}
                  values={sectionState}
                  updateSection={updateSection}
                />
              </SettingsGroup>
            ))}
          </div>
        </div>
      ) : (
        section.groups.map((group) => (
          <SettingsGroup
            key={group.title}
            title={group.title}
            description={group.description}
          >
            <FieldGrid
              sectionKey={section.key}
              fields={group.fields}
              values={sectionState}
              updateSection={updateSection}
            />
          </SettingsGroup>
        ))
      )}
    </SettingsSectionCard>
  );
}

function FieldGrid<S extends SettingsSectionKey>({
  sectionKey,
  fields,
  values,
  updateSection,
}: {
  sectionKey: S;
  fields: FieldDef<Extract<keyof SettingsState[S], string>>[];
  values: SettingsState[S];
  updateSection: <
    X extends keyof SettingsState,
    K extends keyof SettingsState[X]
  >(
    section: X,
    key: K,
    value: SettingsState[X][K]
  ) => void;
}) {
  const hasToggleOnly = fields.every((f) => f.kind === "toggle");

  if (hasToggleOnly) {
    return (
      <div className={styles.toggleGrid}>
        {fields.map((field) => (
          <SettingsToggleCard
            key={field.key}
            label={field.label}
            description={field.description || ""}
            checked={Boolean(values[field.key])}
            onChange={(value) =>
              updateSection(
                sectionKey,
                field.key,
                value as SettingsState[S][typeof field.key]
              )
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.formGrid}>
      {fields.map((field) => {
        const value = values[field.key];

        if (field.kind === "toggle") {
          return (
            <div key={field.key} className={styles.fullWidth}>
              <SettingsToggleCard
                label={field.label}
                description={field.description || ""}
                checked={Boolean(value)}
                onChange={(next) =>
                  updateSection(
                    sectionKey,
                    field.key,
                    next as SettingsState[S][typeof field.key]
                  )
                }
              />
            </div>
          );
        }

        if (field.kind === "select") {
          return (
            <SettingsSelectField
              key={field.key}
              label={field.label}
              value={String(value ?? "")}
              options={field.options || []}
              onChange={(next) =>
                updateSection(
                  sectionKey,
                  field.key,
                  next as SettingsState[S][typeof field.key]
                )
              }
            />
          );
        }

        if (field.kind === "number") {
          return (
            <SettingsNumberField
              key={field.key}
              label={field.label}
              value={typeof value === "number" ? value : 0}
              onChange={(next) =>
                updateSection(
                  sectionKey,
                  field.key,
                  next as SettingsState[S][typeof field.key]
                )
              }
            />
          );
        }

        return (
          <SettingsTextField
            key={field.key}
            label={field.label}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(next) =>
              updateSection(
                sectionKey,
                field.key,
                next as SettingsState[S][typeof field.key]
              )
            }
          />
        );
      })}
    </div>
  );
}

function mergeSettings(
  defaults: SettingsState,
  incoming: Partial<SettingsState>
): SettingsState {
  return {
    company: { ...defaults.company, ...(incoming.company || {}) },
    branding: { ...defaults.branding, ...(incoming.branding || {}) },
    attendance: { ...defaults.attendance, ...(incoming.attendance || {}) },
    devices: { ...defaults.devices, ...(incoming.devices || {}) },
    security: { ...defaults.security, ...(incoming.security || {}) },
    notifications: {
      ...defaults.notifications,
      ...(incoming.notifications || {}),
    },
    payroll: { ...defaults.payroll, ...(incoming.payroll || {}) },
    leaves: { ...defaults.leaves, ...(incoming.leaves || {}) },
    branches: { ...defaults.branches, ...(incoming.branches || {}) },
    roles: { ...defaults.roles, ...(incoming.roles || {}) },
    employeeFields: {
      ...defaults.employeeFields,
      ...(incoming.employeeFields || {}),
    },
    ai: { ...defaults.ai, ...(incoming.ai || {}) },
    dashboard: { ...defaults.dashboard, ...(incoming.dashboard || {}) },
  };
}

function readCategoryValue(
  key: Exclude<SettingsTab, "overview">,
  settings: SettingsState
) {
  switch (key) {
    case "company":
      return settings.company.companyName || "Not configured";
    case "branding":
      return settings.branding.primaryColor;
    case "attendance":
      return `${settings.attendance.defaultGraceMinutes} min grace`;
    case "devices":
      return settings.devices.biometricModuleEnabled ? "Enabled" : "Disabled";
    case "security":
      return `${settings.security.sessionTimeoutMinutes} min`;
    case "notifications":
      return settings.notifications.emailNotificationsEnabled
        ? "Enabled"
        : "Disabled";
    case "payroll":
      return settings.payroll.payrollCycle;
    case "leaves":
      return `${settings.leaves.annualLeaveDays} annual`;
    case "branches":
      return settings.branches.defaultBranchStatus;
    case "roles":
      return settings.roles.enableRoleBasedAccess ? "RBAC active" : "RBAC off";
    case "employeeFields":
      return settings.employeeFields.requireEmployeeCode
        ? "Code required"
        : "Flexible";
    case "ai":
      return settings.ai.aiInsightsEnabled ? "AI enabled" : "AI off";
    case "dashboard":
      return settings.dashboard.defaultLandingPage;
    default:
      return "-";
  }
}

function SettingsTopbar({
  title,
  subtitle,
  query,
  onQueryChange,
  onRefresh,
  onSave,
  saving = false,
  dirty = false,
}: {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  saving?: boolean;
  dirty?: boolean;
}) {
  return (
    <div className={styles.heroCard}>
      <div className={styles.heroHeader}>
        <div className={styles.heroTextWrap}>
          <div className={styles.badge}>NexaHR {"\u2022"} System Control Center</div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>

          <div className={styles.heroMetaRow}>
            <StatusPill label="Workspace" value="Active" good />
            <StatusPill
              label="Changes"
              value={dirty ? "Unsaved" : "Synced"}
              good={!dirty}
            />
            <StatusPill label="Mode" value="Theme Aware" />
          </div>
        </div>

        <div className={styles.heroActionsBlock}>
          <div className={styles.searchWrap}>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search settings..."
              className={styles.searchInput}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onRefresh}
              className={styles.secondaryBtn}
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={styles.primaryBtn}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickSummaryBar({
  items,
}: {
  items: Array<{ title: string; value: string; sub: string }>;
}) {
  return (
    <div className={styles.quickSummaryGrid}>
      {items.map((item) => (
        <div key={item.title} className={styles.quickSummaryCard}>
          <div className={styles.quickSummaryTitle}>{item.title}</div>
          <div className={styles.quickSummaryValue}>{item.value}</div>
          <div className={styles.quickSummarySub}>{item.sub}</div>
        </div>
      ))}
    </div>
  );
}

function SettingsSidebar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ key: SettingsTab; title: string; subtitle: string }>;
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarInner}>
        <div className={styles.sidebarHead}>
          <div className={styles.sidebarHeadTitle}>Settings Menu</div>
          <div className={styles.sidebarHeadSub}>
            Navigate across system controls
          </div>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`${styles.sidebarButton} ${
              activeTab === tab.key ? styles.sidebarButtonActive : ""
            }`}
          >
            <div className={styles.sidebarButtonTitle}>{tab.title}</div>
            <div className={styles.sidebarButtonSubtitle}>{tab.subtitle}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SettingsOverview({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; note: string; icon: string }>;
}) {
  return (
    <div className={styles.topStatsGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statIcon}>{item.icon}</div>
            <div className={styles.statLabel}>{item.label}</div>
          </div>
          <div className={styles.statValue}>{item.value ?? "-"}</div>
          <div className={styles.statNote}>{item.note}</div>
        </div>
      ))}
    </div>
  );
}

function SettingsSectionCard({
  title,
  description,
  children,
  badge,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          {badge ? <div className={styles.sectionBadge}>{badge}</div> : null}
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionDescription}>{description}</p>
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.groupCard}>
      <div className={styles.groupHeader}>
        <div className={styles.groupTitle}>{title}</div>
        <div className={styles.groupDescription}>{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsTextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      />
    </label>
  );
}

function SettingsSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SettingsNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const nextValue =
            e.target.value.trim() === "" ? 0 : Number(e.target.value);
          onChange(Number.isFinite(nextValue) ? nextValue : 0);
        }}
        className={styles.input}
      />
    </label>
  );
}

function SettingsToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.toggleCard}>
      <div className={styles.toggleText}>
        <div className={styles.toggleTitle}>{label}</div>
        <div className={styles.toggleDescription}>{description}</div>
      </div>

      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`${styles.toggleButton} ${
          checked ? styles.toggleButtonOn : ""
        }`}
      >
        <span className={styles.toggleKnob} />
      </button>
    </div>
  );
}

function OverviewItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={styles.overviewItem}>
      <div className={styles.overviewLabel}>{label}</div>
      <div className={styles.overviewValue}>{value ?? "-"}</div>
    </div>
  );
}

function CheckLine({
  good,
  text,
}: {
  good: boolean;
  text: string;
}) {
  return (
    <div
      className={`${styles.checkLine} ${
        good ? styles.checkGood : styles.checkWarn
      }`}
    >
      <div
        className={`${styles.checkDot} ${
          good ? styles.checkDotGood : styles.checkDotWarn
        }`}
      />
      <span>{text}</span>
    </div>
  );
}

function StatusPill({
  label,
  value,
  good = false,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div
      className={`${styles.statusPill} ${good ? styles.statusPillGood : ""}`}
    >
      <span className={styles.statusPillLabel}>{label}</span>
      <span className={styles.statusPillValue}>{value}</span>
    </div>
  );
}

function CategoryCard({
  title,
  subtitle,
  value,
  accent,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  value: string;
  accent: "blue" | "green" | "purple" | "orange" | "indigo";
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.categoryCard} ${styles[`accent_${accent}`]}`}
    >
      <div className={styles.categoryTop}>
        <div className={styles.categoryIcon}>{icon}</div>
      </div>
      <div className={styles.categoryTitle}>{title}</div>
      <div className={styles.categorySubtitle}>{subtitle}</div>
      <div className={styles.categoryValue}>{value}</div>
    </button>
  );
}

function BrandMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.brandMetaItem}>
      <span className={styles.brandMetaLabel}>{label}</span>
      <span className={styles.brandMetaValue}>{value}</span>
    </div>
  );
}

function MiniAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={styles.miniAction}>
      {label}
    </button>
  );
}
