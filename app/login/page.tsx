"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setAuthTokens } from "@/lib/auth";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { withSearch } from "@/lib/navigation";
import styles from "./login.module.css";

type PublicBranding = {
  brandingAppName?: string;
  brandingPrimaryColor?: string;
  brandingSidebarCompact?: boolean;
  brandingShowLogoOnly?: boolean;
  logoUrl?: string | null;
  companyName?: string | null;
};

const INPUT_ICONS = {
  company: "\u25a6",
  email: "\u2709",
  password: "\u25cf",
} as const;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function LoginPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState("admin@nexahr.com");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const deferredCompanyId = useDeferredValue(companyId.trim());

  const [branding, setBranding] = useState<PublicBranding>({
    brandingAppName: "NexaHR",
    brandingPrimaryColor: "#2563eb",
    logoUrl: null,
    companyName: null,
  });

  const brandName = branding.brandingAppName?.trim() || "NexaHR";
  const primaryColor = branding.brandingPrimaryColor?.trim() || "#2563eb";
  const logoUrl = resolveAssetUrl(branding.logoUrl);
  const displayTitle = branding.companyName?.trim() || brandName;
  const pageVars = {
    "--brand-color": primaryColor,
    "--brand-color-soft": `${primaryColor}22`,
  } as CSSProperties;

  const messageClassName = useMemo(() => {
    if (!message) return styles.hidden;

    const success = message.toLowerCase().includes("success");
    return `${styles.messageBox} ${
      success ? styles.successBox : styles.errorBox
    }`;
  }, [message]);

  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await apiRequest<PublicBranding>(
            withSearch("/company-settings/public-branding", {
              companyId: deferredCompanyId || undefined,
            }),
            {
              method: "GET",
              auth: false,
              signal: abortController.signal,
            },
          );

          setBranding({
            brandingAppName: data?.brandingAppName || "NexaHR",
            brandingPrimaryColor: data?.brandingPrimaryColor || "#2563eb",
            brandingSidebarCompact: !!data?.brandingSidebarCompact,
            brandingShowLogoOnly: !!data?.brandingShowLogoOnly,
            logoUrl: data?.logoUrl || null,
            companyName: data?.companyName || null,
          });
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }

          // keep fallback branding
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [deferredCompanyId]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const data = await apiRequest<{
        access_token?: string;
        refresh_token?: string;
      }>("/auth/login", {
        method: "POST",
        auth: false,
        body: {
          email,
          password,
          companyId: companyId.trim() || undefined,
          rememberMe,
        },
      });

      if (!data?.access_token || !data?.refresh_token) {
        setMessage("Login failed");
        return;
      }

      setAuthTokens(data.access_token, data.refresh_token);
      setMessage("Login success");
      router.push("/dashboard");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to connect to server"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page} style={pageVars}>
      <div className={styles.pageGlowTop} />
      <div className={styles.pageGlowBottom} />
      <div className={styles.gridPattern} />

      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brandWrap}>
            <div className={styles.brandBadgeOuter}>
              <div className={styles.brandBadgeInner}>
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`${brandName} logo`}
                    className={styles.brandLogoImage}
                    width={80}
                    height={80}
                    unoptimized
                  />
                ) : (
                  <span className={styles.brandBadgeText}>
                    {brandName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.brandText}>
              <div className={styles.brandTitle}>{brandName}</div>
              <div className={styles.brandSub}>Enterprise Workforce Platform</div>
            </div>
          </div>

          <div className={styles.topActions}>
            <a href="#" className={styles.topActionLink}>
              Product Tour
            </a>
            <a href="#" className={styles.topActionLink}>
              Documentation
            </a>
            <a href="#" className={styles.topActionLink}>
              Help Center
            </a>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.heroShell}>
          <div className={styles.card}>
            <section className={styles.visualPanel}>
              <div className={styles.visualGradient} />
              <div className={styles.visualLines} />
              <div className={styles.visualDots} />

              <div className={styles.visualContent}>
                <div className={styles.visualTopTag}>
                  Next-Generation HR Operations
                </div>

                <div className={styles.visualTextBlock}>
                  <h1 className={styles.visualTitle}>{brandName}</h1>
                  <p className={styles.visualDescription}>
                    The premium HR, attendance, payroll, and device operations
                    platform built to run your workforce with precision.
                  </p>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>24/7</div>
                    <div className={styles.statLabel}>Operations Visibility</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>Smart</div>
                    <div className={styles.statLabel}>Attendance Rules</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>Live</div>
                    <div className={styles.statLabel}>Device Monitoring</div>
                  </div>
                </div>

                <div className={styles.featureList}>
                  <div className={styles.featureItem}>
                    <span className={styles.featureDot} />
                    <span>Executive dashboards and KPI insights</span>
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureDot} />
                    <span>Shift-based attendance and payroll automation</span>
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureDot} />
                    <span>Biometric and device operations control center</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.formPanel}>
              <div className={styles.formPanelHeader}>
                <h2 className={styles.formTitle}>Welcome Back</h2>
                <p className={styles.formSubtitle}>
                  Sign in to access {displayTitle} workspace.
                </p>
              </div>

              <form onSubmit={handleLogin} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Company ID</label>
                  <div className={styles.inputShell}>
                    <span className={styles.inputShellIcon}>{INPUT_ICONS.company}</span>
                    <input
                      type="text"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      placeholder="Company ID"
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Username / Email</label>
                  <div className={styles.inputShell}>
                    <span className={styles.inputShellIcon}>{INPUT_ICONS.email}</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Password</label>
                  <div className={styles.inputShell}>
                    <span className={styles.inputShellIcon}>{INPUT_ICONS.password}</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={styles.input}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className={styles.inlineActionButton}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`${styles.submitButton} ${
                    loading ? styles.submitButtonDisabled : ""
                  }`}
                >
                  {loading ? "Signing in..." : "Login"}
                </button>

                <div className={styles.rowBetween}>
                  <label className={styles.checkWrap}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() =>
                      setMessage("Forgot password flow is not connected yet.")
                    }
                  >
                    Forgot password?
                  </button>
                </div>

                <div className={messageClassName}>{message}</div>
              </form>
            </section>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a href="#" className={styles.footerLink}>
            Privacy Policy
          </a>
          <a href="#" className={styles.footerLink}>
            Terms & Conditions
          </a>
          <a href="#" className={styles.footerLink}>
            Support
          </a>
        </div>

        <div className={styles.footerCopy}>
          Copyright (c) 2026 {brandName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
