import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { perSecondRate } from "@/lib/scheduleUtils";

export function useBreakTimer() {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const currentBreakStart = useAppStore((s) => s.currentBreakStart);
  const salary = useAppStore((s) => s.salary);
  const schedule = useAppStore((s) => s.schedule);
  const updateCurrentEarnings = useAppStore((s) => s.updateCurrentEarnings);
  const currentEarnings = useAppStore((s) => s.currentEarnings);
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

  const elapsedSeconds = currentBreakStart
    ? Math.floor((Date.now() - currentBreakStart) / 1000)
    : 0;

  return { isOnBreak, currentEarnings, currentBreakStart, elapsedSeconds };
}
