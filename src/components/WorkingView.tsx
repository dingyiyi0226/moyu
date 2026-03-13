import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
        Working...
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Today's breaks</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatCurrency(todayStats.earnings)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {todayStats.count} break{todayStats.count !== 1 ? "s" : ""} · {formatDuration(todayStats.duration)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">This month</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatCurrency(monthStats)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
