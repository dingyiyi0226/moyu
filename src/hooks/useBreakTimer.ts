import { useEffect, useRef, useCallback } from "react";
import { useAppStore, perSecondRate } from "@/store/appStore";

export function useBreakTimer() {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const currentBreakStart = useAppStore((s) => s.currentBreakStart);
  const salary = useAppStore((s) => s.salary);
  const updateCurrentEarnings = useAppStore((s) => s.updateCurrentEarnings);
  const currentEarnings = useAppStore((s) => s.currentEarnings);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (!currentBreakStart) return;
    const now = Date.now();
    const elapsedSec = (now - currentBreakStart) / 1000;
    const earnings = elapsedSec * perSecondRate(salary);
    updateCurrentEarnings(earnings);
    rafRef.current = requestAnimationFrame(tick);
  }, [currentBreakStart, salary, updateCurrentEarnings]);

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
