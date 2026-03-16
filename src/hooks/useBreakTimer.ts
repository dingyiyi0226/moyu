import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, perSecondRate, getDateKey } from "@/store/appStore";

export function useBreakTimer() {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const currentBreakStart = useAppStore((s) => s.currentBreakStart);
  const salary = useAppStore((s) => s.salary);
  const schedule = useAppStore((s) => s.schedule);
  const updateCurrentEarnings = useAppStore((s) => s.updateCurrentEarnings);
  const currentEarnings = useAppStore((s) => s.currentEarnings);
  const sessions = useAppStore((s) => s.sessions);
  const rafRef = useRef<number | null>(null);

  // RAF loop: updates currentEarnings for UI display only
  const tick = useCallback(() => {
    if (!currentBreakStart) return;
    const elapsedSec = (Date.now() - currentBreakStart) / 1000;
    updateCurrentEarnings(elapsedSec * perSecondRate(salary, schedule));
    rafRef.current = requestAnimationFrame(tick);
  }, [currentBreakStart, salary, schedule, updateCurrentEarnings]);

  useEffect(() => {
    if (isOnBreak && currentBreakStart) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isOnBreak, currentBreakStart, tick]);

  // Start/stop the Rust-side tray timer (works even when panel is hidden)
  useEffect(() => {
    if (!isOnBreak || !currentBreakStart) return;

    const todayKey = getDateKey(Date.now());
    const completedToday = sessions
      .filter((s) => getDateKey(s.startTime) === todayKey)
      .reduce((sum, s) => sum + s.earnings, 0);
    const sym =
      new Intl.NumberFormat("en-US", { style: "currency", currency: salary.currency })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? "$";

    invoke("start_break_timer", {
      perSecondRate: perSecondRate(salary, schedule),
      completedToday,
      currencySymbol: sym,
      breakStartMs: currentBreakStart,
    }).catch(() => {});

    return () => {
      invoke("stop_break_timer").catch(() => {});
    };
  }, [isOnBreak, currentBreakStart, salary, schedule, sessions]);

  const elapsedSeconds = currentBreakStart
    ? Math.floor((Date.now() - currentBreakStart) / 1000)
    : 0;

  return { isOnBreak, currentEarnings, currentBreakStart, elapsedSeconds };
}
