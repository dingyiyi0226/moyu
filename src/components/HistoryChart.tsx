import { useMemo, useState } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";

type ViewMode = "daily" | "weekly";

function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekKey(timestamp: number): string {
  const d = new Date(timestamp);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getWeekRange(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  const jan1 = new Date(year, 0, 1);
  const startDay = new Date(jan1.getTime() + ((week - 1) * 7 - jan1.getDay()) * 86400000);
  const endDay = new Date(startDay.getTime() + 6 * 86400000);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(startDay)}-${fmt(endDay)}`;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface BarData {
  key: string;
  label: string;
  durationSec: number;
  earnings: number;
}

function aggregateSessions(
  sessions: BreakSession[],
  mode: ViewMode,
): BarData[] {
  const groups: Record<string, { durationSec: number; earnings: number }> = {};

  for (const s of sessions) {
    const key = mode === "daily" ? getDateKey(s.startTime) : getWeekKey(s.startTime);
    if (!groups[key]) groups[key] = { durationSec: 0, earnings: 0 };
    groups[key].durationSec += Math.round((s.endTime - s.startTime) / 1000);
    groups[key].earnings += s.earnings;
  }

  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([key, data]) => {
    let label: string;
    if (mode === "daily") {
      const [, m, d] = key.split("-");
      label = `${parseInt(m)}/${parseInt(d)}`;
    } else {
      label = getWeekRange(key);
    }
    return { key, label, ...data };
  });
}

const MAX_BARS = 14;

export function HistoryChart() {
  const sessions = useAppStore((s) => s.sessions);
  const { formatCurrency } = useSalaryCalc();
  const [mode, setMode] = useState<ViewMode>("daily");

  const bars = useMemo(() => {
    const all = aggregateSessions(sessions, mode);
    return all.slice(-MAX_BARS);
  }, [sessions, mode]);

  if (sessions.length === 0) return null;

  const maxDuration = Math.max(...bars.map((b) => b.durationSec), 1);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          History
        </span>
        <div className="flex rounded-md bg-muted p-0.5">
          {(["daily", "weekly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                mode === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "daily" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-1" style={{ height: 100 }}>
        {bars.map((bar) => {
          const height = Math.max((bar.durationSec / maxDuration) * 100, 4);
          return (
            <div
              key={bar.key}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                <div className="bg-foreground text-background text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                  {formatDuration(bar.durationSec)} &middot; {formatCurrency(bar.earnings)}
                </div>
              </div>
              <div
                className="w-full rounded-sm bg-emerald-400/80 dark:bg-emerald-500/60 transition-all"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 mt-1">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="flex-1 text-center text-[9px] text-muted-foreground truncate"
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}
