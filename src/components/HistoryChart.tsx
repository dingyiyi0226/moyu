import { useMemo, useState } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";

type ViewMode = "daily" | "weekly";

function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  if (mode === "weekly") {
    // Build 7 bars for the current week (Sun-Sat), including empty days
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const sunday = new Date(today);
    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(today.getDate() - dayOfWeek);

    return WEEK_DAY_LABELS.map((label, i) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const dateKey = getDateKey(date.getTime());

      let durationSec = 0;
      let earnings = 0;
      for (const s of sessions) {
        if (getDateKey(s.startTime) === dateKey) {
          durationSec += Math.round((s.endTime - s.startTime) / 1000);
          earnings += s.earnings;
        }
      }
      return { key: dateKey, label, durationSec, earnings };
    });
  }

  // Daily mode
  const groups: Record<string, { durationSec: number; earnings: number }> = {};
  for (const s of sessions) {
    const key = getDateKey(s.startTime);
    if (!groups[key]) groups[key] = { durationSec: 0, earnings: 0 };
    groups[key].durationSec += Math.round((s.endTime - s.startTime) / 1000);
    groups[key].earnings += s.earnings;
  }

  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([key, data]) => {
    const [, m, d] = key.split("-");
    return { key, label: `${parseInt(m)}/${parseInt(d)}`, ...data };
  });
}

const MAX_BARS = 14;
const BAR_HEIGHT = 80;

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

      <div className="flex items-end justify-center gap-1.5" style={{ height: BAR_HEIGHT }}>
        {bars.map((bar) => {
          const h = Math.max(Math.round((bar.durationSec / maxDuration) * BAR_HEIGHT), 3);
          return (
            <div key={bar.key} className="group relative" style={{ width: 30 }}>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-foreground text-background text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                  {formatDuration(bar.durationSec)} &middot; {formatCurrency(bar.earnings)}
                </div>
              </div>
              <div
                className="w-full rounded-sm bg-emerald-400/80 dark:bg-emerald-500/60"
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-1.5 mt-1">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="text-center text-[9px] text-muted-foreground truncate"
            style={{ width: 30 }}
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}
