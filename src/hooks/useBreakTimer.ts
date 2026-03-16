import { useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, perSecondRate, getDateKey } from "@/store/appStore";

function updateTrayTitle(title: string) {
  invoke("update_tray_title", { title }).catch(() => {});
}

export function useBreakTimer() {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const currentBreakStart = useAppStore((s) => s.currentBreakStart);
  const salary = useAppStore((s) => s.salary);
  const schedule = useAppStore((s) => s.schedule);
  const updateCurrentEarnings = useAppStore((s) => s.updateCurrentEarnings);
  const currentEarnings = useAppStore((s) => s.currentEarnings);
  const sessions = useAppStore((s) => s.sessions);
  const rafRef = useRef<number | null>(null);
  const lastTrayUpdate = useRef(0);

  const completedTodayEarnings = useMemo(() => {
    const todayKey = getDateKey(Date.now());
    return sessions
      .filter((s) => getDateKey(s.startTime) === todayKey)
      .reduce((sum, s) => sum + s.earnings, 0);
  }, [sessions]);

  const tick = useCallback(() => {
    if (!currentBreakStart) return;
    const now = Date.now();
    const elapsedSec = (now - currentBreakStart) / 1000;
    const earnings = elapsedSec * perSecondRate(salary, schedule);
    updateCurrentEarnings(earnings);

    // Throttle tray title updates to ~1/sec
    if (now - lastTrayUpdate.current >= 1000) {
      lastTrayUpdate.current = now;
      const sym = new Intl.NumberFormat("en-US", { style: "currency", currency: salary.currency }).formatToParts(0).find(p => p.type === "currency")?.value ?? "$";
      updateTrayTitle(`${sym}${(completedTodayEarnings + earnings).toFixed(2)}`);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [currentBreakStart, salary, schedule, updateCurrentEarnings, completedTodayEarnings]);

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

  // Reset tray title when break ends
  useEffect(() => {
    if (!isOnBreak) {
      updateTrayTitle("");
    }
  }, [isOnBreak]);

  const elapsedSeconds = currentBreakStart
    ? Math.floor((Date.now() - currentBreakStart) / 1000)
    : 0;

  return { isOnBreak, currentEarnings, currentBreakStart, elapsedSeconds };
}
