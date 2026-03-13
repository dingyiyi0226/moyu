import { useEffect, useState } from "react";
import { useBreakTimer } from "@/hooks/useBreakTimer";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";

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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-emerald-600">
          On Break &middot; {formatDuration(elapsed)}
        </span>
      </div>

      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 mb-1">
          Earned
        </p>
        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums tracking-tight">
          {formatCurrency(currentEarnings)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-2">
          {formatRate(rate)}
        </p>
      </div>
    </div>
  );
}
