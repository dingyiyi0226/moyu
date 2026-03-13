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

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

interface BarData {
  key: string;
  label: string;
  durationSec: number;
  earnings: number;
}

function aggregateWeekly(sessions: BreakSession[]): BarData[] {
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

const BAR_HEIGHT = 80;

function WeeklyChart({
  sessions,
  formatCurrency,
}: {
  sessions: BreakSession[];
  formatCurrency: (n: number) => string;
}) {
  const bars = useMemo(() => aggregateWeekly(sessions), [sessions]);
  const maxDuration = Math.max(...bars.map((b) => b.durationSec), 1);

  return (
    <>
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
    </>
  );
}

function DailyChart({ sessions }: { sessions: BreakSession[] }) {
  const schedule = useAppStore((s) => s.schedule);
  const clockedInAt = useAppStore((s) => s.clockedInAt);

  const todaySessions = useMemo(() => {
    const today = new Date();
    const key = getDateKey(today.getTime());
    return sessions.filter((s) => getDateKey(s.startTime) === key);
  }, [sessions]);

  // Determine work window: use clock-in time if available, else default schedule
  const now = new Date();
  const startHour = clockedInAt
    ? new Date(clockedInAt).getHours() + new Date(clockedInAt).getMinutes() / 60
    : schedule.startHour;
  const endHour = schedule.endHour;

  // The timeline spans from startHour to endHour
  const totalHours = Math.max(endHour - startHour, 1);
  const currentHourFrac = now.getHours() + now.getMinutes() / 60;

  return (
    <div>
      {/* Time labels */}
      <div className="flex justify-between mb-1">
        <span className="text-[9px] text-muted-foreground">{formatHour(Math.floor(startHour))}</span>
        <span className="text-[9px] text-muted-foreground">{formatHour(endHour)}</span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-5 rounded-full bg-muted/80 overflow-hidden">
        {/* Current time progress */}
        {currentHourFrac > startHour && currentHourFrac < endHour && (
          <div
            className="absolute inset-y-0 left-0 bg-muted-foreground/10 rounded-full"
            style={{ width: `${((currentHourFrac - startHour) / totalHours) * 100}%` }}
          />
        )}

        {/* Break segments */}
        {todaySessions.map((session) => {
          const sStart = new Date(session.startTime);
          const sEnd = new Date(session.endTime);
          const breakStartH = sStart.getHours() + sStart.getMinutes() / 60;
          const breakEndH = sEnd.getHours() + sEnd.getMinutes() / 60;

          const left = Math.max(((breakStartH - startHour) / totalHours) * 100, 0);
          const right = Math.min(((breakEndH - startHour) / totalHours) * 100, 100);
          const width = right - left;
          if (width <= 0) return null;

          return (
            <div
              key={session.id}
              className="group absolute inset-y-0 bg-emerald-400/80 dark:bg-emerald-500/60"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-foreground text-background text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                  {sStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                  –
                  {sEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Current time marker */}
        {currentHourFrac >= startHour && currentHourFrac <= endHour && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/50"
            style={{ left: `${((currentHourFrac - startHour) / totalHours) * 100}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-emerald-400/80 dark:bg-emerald-500/60" />
          <span className="text-[9px] text-muted-foreground">Break</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {todaySessions.length} break{todaySessions.length !== 1 ? "s" : ""} &middot;{" "}
          {formatDuration(todaySessions.reduce((sum, s) => sum + Math.round((s.endTime - s.startTime) / 1000), 0))}
        </span>
      </div>
    </div>
  );
}

export function HistoryChart() {
  const sessions = useAppStore((s) => s.sessions);
  const { formatCurrency } = useSalaryCalc();
  const [mode, setMode] = useState<ViewMode>("daily");

  if (sessions.length === 0) return null;

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

      {mode === "weekly" ? (
        <WeeklyChart sessions={sessions} formatCurrency={formatCurrency} />
      ) : (
        <DailyChart sessions={sessions} />
      )}
    </div>
  );
}
