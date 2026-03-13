import { useMemo } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface DayGroup {
  date: string;
  sessions: BreakSession[];
  total: number;
}

export function HistoryList() {
  const sessions = useAppStore((s) => s.sessions);
  const { formatCurrency } = useSalaryCalc();

  const groupedByDay = useMemo((): DayGroup[] => {
    const groups: Record<string, BreakSession[]> = {};
    const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);
    for (const session of sorted) {
      const dateKey = new Date(session.startTime).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(session);
    }
    return Object.entries(groups).map(([date, sessions]) => ({
      date,
      sessions,
      total: sessions.reduce((sum, s) => sum + s.earnings, 0),
    }));
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-4">
        No break sessions yet. Lock your screen to start tracking.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-h-[240px] overflow-y-auto">
      {groupedByDay.map((group) => (
        <Card key={group.date}>
          <CardHeader className="py-3 px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm">{group.date}</CardTitle>
              <span className="text-sm font-semibold text-green-600">
                {formatCurrency(group.total)}
              </span>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="py-2 px-4">
            {group.sessions.map((session) => {
              const duration = Math.round(
                (session.endTime - session.startTime) / 1000 / 60,
              );
              const time = new Date(session.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={session.id}
                  className="flex justify-between items-center py-1 text-sm"
                >
                  <span className="text-muted-foreground">
                    {time} ({duration}min)
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(session.earnings)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
