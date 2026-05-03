"use client";

import { useEffect, useEffectEvent } from "react";

type UseVisibilityPollingOptions = {
  intervalMs: number;
  onPoll: () => void;
  onVisible?: () => void;
  enabled?: boolean;
};

export function useVisibilityPolling({
  intervalMs,
  onPoll,
  onVisible,
  enabled = true,
}: UseVisibilityPollingOptions) {
  const handlePoll = useEffectEvent(onPoll);
  const handleVisible = useEffectEvent(() => {
    (onVisible || onPoll)();
  });

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      handlePoll();
    };

    const interval = window.setInterval(poll, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      handleVisible();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
