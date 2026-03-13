import { useEffect, useState } from "react";
import { useBreakTimer } from "@/hooks/useBreakTimer";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { Card, CardContent } from "@/components/ui/card";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BreakView() {
  const { currentEarnings, currentBreakStart } = useBreakTimer();
  const { formatCurrency, rate, formatRate } = useSalaryCalc();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!currentBreakStart) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - currentBreakStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentBreakStart]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-600">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        On Break — {formatDuration(elapsed)}
      </div>

      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">Earned this break</p>
          <p className="text-4xl font-bold text-green-700 dark:text-green-400 tabular-nums">
            {formatCurrency(currentEarnings)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Rate: {formatRate(rate)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
