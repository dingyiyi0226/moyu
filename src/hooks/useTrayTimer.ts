import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store/appStore";
import { perSecondRate } from "@/lib/scheduleUtils";
import { getDateKey } from "@/lib/timeUtils";

/** Starts/stops the Rust-side tray timer regardless of which tab is active. */
export function useTrayTimer() {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const currentBreakStart = useAppStore((s) => s.currentBreakStart);
  const salary = useAppStore((s) => s.salary);
  const schedule = useAppStore((s) => s.schedule);
  const sessions = useAppStore((s) => s.sessions);

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
}
