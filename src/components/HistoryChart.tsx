import { useMemo, useState } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

/** Get a Date offset by `days` from today, at midnight */
function getOffsetDate(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateLabel(dayOffset: number): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === -1) return "Yesterday";
  const d = getOffsetDate(dayOffset);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface BarData {
  key: string;
  label: string;
  durationSec: number;
  earnings: number;
}

function aggregateWeekly(
  sessions: BreakSession[],
  weekOffset: number,
): BarData[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const sunday = new Date(today);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);

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

function formatWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return "This Week";
  const today = new Date();
  const dayOfWeek = today.getDay();
  const sunday = new Date(today);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${fmt(sunday)} – ${fmt(saturday)}`;
}

const navBtnClass =
  "p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none";

const BAR_HEIGHT = 80;

function DailyChart({ sessions }: { sessions: BreakSession[] }) {
  const schedule = useAppStore((s) => s.schedule);
  const clockedInAt = useAppStore((s) => s.clockedInAt);
  const [dayOffset, setDayOffset] = useState(0);

  const targetDate = getOffsetDate(dayOffset);
  const isToday = dayOffset === 0;

  const daySessions = useMemo(() => {
    const key = getDateKey(targetDate.getTime());
    return sessions.filter((s) => getDateKey(s.startTime) === key);
  }, [sessions, targetDate]);

  // Work window: clock-in time only applies to today
  const startHour =
    isToday && clockedInAt
      ? new Date(clockedInAt).getHours() +
        new Date(clockedInAt).getMinutes() / 60
      : schedule.startHour;
  const endHour = schedule.endHour;

  const totalHours = Math.max(endHour - startHour, 1);
  const now = new Date();
  const currentHourFrac = now.getHours() + now.getMinutes() / 60;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setDayOffset((o) => o - 1)}
          className={navBtnClass}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatDateLabel(dayOffset)}
        </span>
        <button
          onClick={() => setDayOffset((o) => o + 1)}
          disabled={dayOffset >= 0}
          className={navBtnClass}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Time labels */}
      <div className="flex justify-between mb-1">
        <span className="text-[9px] text-muted-foreground">
          {formatHour(Math.floor(startHour))}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {formatHour(endHour)}
        </span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-5 rounded-full bg-muted/80 overflow-hidden">
        {/* Current time progress (today only) */}
        {isToday &&
          currentHourFrac > startHour &&
          currentHourFrac < endHour && (
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/10 rounded-full"
              style={{
                width: `${((currentHourFrac - startHour) / totalHours) * 100}%`,
              }}
            />
          )}

        {/* Break segments */}
        {daySessions.map((session) => {
          const sStart = new Date(session.startTime);
          const sEnd = new Date(session.endTime);
          const breakStartH =
            sStart.getHours() + sStart.getMinutes() / 60;
          const breakEndH = sEnd.getHours() + sEnd.getMinutes() / 60;

          const left = Math.max(
            ((breakStartH - startHour) / totalHours) * 100,
            0,
          );
          const right = Math.min(
            ((breakEndH - startHour) / totalHours) * 100,
            100,
          );
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
                  {sStart.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                  –
                  {sEnd.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Current time marker (today only) */}
        {isToday &&
          currentHourFrac >= startHour &&
          currentHourFrac <= endHour && (
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/50"
              style={{
                left: `${((currentHourFrac - startHour) / totalHours) * 100}%`,
              }}
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
          {daySessions.length} break{daySessions.length !== 1 ? "s" : ""}{" "}
          &middot;{" "}
          {formatDuration(
            daySessions.reduce(
              (sum, s) =>
                sum + Math.round((s.endTime - s.startTime) / 1000),
              0,
            ),
          )}
        </span>
      </div>
    </div>
  );
}

function WeeklyChart({
  sessions,
  formatCurrency,
}: {
  sessions: BreakSession[];
  formatCurrency: (n: number) => string;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const bars = useMemo(
    () => aggregateWeekly(sessions, weekOffset),
    [sessions, weekOffset],
  );
  const maxDuration = Math.max(...bars.map((b) => b.durationSec), 1);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className={navBtnClass}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatWeekLabel(weekOffset)}
        </span>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          disabled={weekOffset >= 0}
          className={navBtnClass}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div
        className="flex items-end justify-center gap-1.5"
        style={{ height: BAR_HEIGHT }}
      >
        {bars.map((bar) => {
          const h = Math.max(
            Math.round((bar.durationSec / maxDuration) * BAR_HEIGHT),
            3,
          );
          return (
            <div
              key={bar.key}
              className="group relative"
              style={{ width: 30 }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-foreground text-background text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                  {formatDuration(bar.durationSec)} &middot;{" "}
                  {formatCurrency(bar.earnings)}
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

export function HistoryChart() {
  const sessions = useAppStore((s) => s.sessions);
  const { formatCurrency } = useSalaryCalc();

  if (sessions.length === 0) return null;

  return (
    <>
      <DailyChart sessions={sessions} />
      <div className="h-px bg-border mx-4" />
      <WeeklyChart sessions={sessions} formatCurrency={formatCurrency} />
    </>
  );
}
