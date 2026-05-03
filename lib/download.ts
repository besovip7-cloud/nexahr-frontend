export function triggerFileDownload(blob: Blob, filename: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Delay revoke slightly to avoid flaky downloads on some browsers.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
