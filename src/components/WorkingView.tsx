import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function WorkingView() {
  const sessions = useAppStore((s) => s.sessions);
  const { formatCurrency } = useSalaryCalc();

  const todayStats = useMemo(() => {
    const today = new Date();
    const todaySessions = sessions.filter((s) => {
      const d = new Date(s.startTime);
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    });
    const earnings = todaySessions.reduce((sum, s) => sum + s.earnings, 0);
    const duration = todaySessions.reduce(
      (sum, s) => sum + (s.endTime - s.startTime) / 1000,
      0,
    );
    return { earnings, duration, count: todaySessions.length };
  }, [sessions]);

  const monthStats = useMemo(() => {
    const now = new Date();
    const monthSessions = sessions.filter((s) => {
      const d = new Date(s.startTime);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });
    return monthSessions.reduce((sum, s) => sum + s.earnings, 0);
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        <span className="text-xs font-medium text-muted-foreground">Working</span>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-muted/60 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Today
            </span>
            <span className="text-xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(todayStats.earnings)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {todayStats.count} break{todayStats.count !== 1 ? "s" : ""} &middot; {formatDuration(todayStats.duration)}
          </p>
        </div>

        <div className="rounded-xl bg-muted/60 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              This month
            </span>
            <span className="text-base font-semibold tabular-nums tracking-tight">
              {formatCurrency(monthStats)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
