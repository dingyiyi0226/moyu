import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, perSecondRate } from "@/store/appStore";

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
  const rafRef = useRef<number | null>(null);
  const lastTrayUpdate = useRef(0);

  const tick = useCallback(() => {
    if (!currentBreakStart) return;
    const now = Date.now();
    const elapsedSec = (now - currentBreakStart) / 1000;
    const earnings = elapsedSec * perSecondRate(salary, schedule);
    updateCurrentEarnings(earnings);

    // Throttle tray title updates to ~1/sec
    if (now - lastTrayUpdate.current >= 1000) {
      lastTrayUpdate.current = now;
      updateTrayTitle(`$${earnings.toFixed(2)}`);
    }

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
