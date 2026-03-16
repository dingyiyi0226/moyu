import { useMemo, useState } from "react";
import { useAppStore, getDayScheduleForDate, type BreakSession, type WorkInterval } from "@/store/appStore";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  formatDuration,
  formatHour,
  navBtnClass,
  getWorkIntervalsForDate,
  getBreakSessionsForDate,
  toPercent,
} from "@/lib/timeUtils";

// ── Timeline construction ──────────────────────────────────────────────

interface TimeRange {
  startH: number; // fractional hour (e.g. 9.5 = 09:30)
  endH: number;
}

interface DayTimeline {
  axisStart: number; // schedule start hour
  axisEnd: number;   // schedule end hour
  workBands: TimeRange[];
  breakBands: (TimeRange & { id: string })[];
}

function toFractionalHour(timestamp: number): number {
  const d = new Date(timestamp);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Clip [start, end] to [rangeStart, rangeEnd]. Returns null if no overlap. */
function clipRange(
  start: number,
  end: number,
  rangeStart: number,
  rangeEnd: number,
): { start: number; end: number } | null {
  const s = Math.max(start, rangeStart);
  const e = Math.min(end, rangeEnd);
  return s < e ? { start: s, end: e } : null;
}

/**
 * Build the timeline for a single day.
 *
 * Priority: clock in/out > breaks > schedule.
 * - Work bands = work intervals clipped to schedule range
 * - Break bands = break sessions clipped to the intersection of work bands AND schedule range
 */
export function buildDayTimeline(
  schedStart: number,
  schedEnd: number,
  workIntervals: WorkInterval[],
  breakSessions: BreakSession[],
  nowH?: number,
): DayTimeline {
  const workBands: TimeRange[] = [];
  for (const iv of workIntervals) {
    const startH = toFractionalHour(iv.start);
    const endH = iv.end != null
      ? toFractionalHour(iv.end)
      : (nowH != null ? Math.min(nowH, schedEnd) : schedEnd);
    const clipped = clipRange(startH, endH, schedStart, schedEnd);
    if (clipped) {
      workBands.push({ startH: clipped.start, endH: clipped.end });
    }
  }

  const breakBands: (TimeRange & { id: string })[] = [];
  for (const brk of breakSessions) {
    const bStartH = toFractionalHour(brk.startTime);
    const bEndH = toFractionalHour(brk.endTime);
    for (const work of workBands) {
      const clipped = clipRange(bStartH, bEndH, work.startH, work.endH);
      if (clipped) {
        breakBands.push({ startH: clipped.start, endH: clipped.end, id: brk.id });
      }
    }
  }

  return { axisStart: schedStart, axisEnd: schedEnd, workBands, breakBands };
}

// ── Helpers ────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────

export function DailyChart({
  sessions,
  todayOnly = false,
  fixedDate,
  onPrev,
  onNext,
}: {
  sessions: BreakSession[];
  todayOnly?: boolean;
  fixedDate?: Date;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const schedule = useAppStore((s) => s.schedule);
  const dailySchedules = useAppStore((s) => s.dailySchedules);
  const allWorkIntervals = useAppStore((s) => s.workIntervals);
  const [dayOffset, setDayOffset] = useState(0);
  const [zoomMode, setZoomMode] = useState(false);
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);

  const effectiveOffset = todayOnly ? 0 : dayOffset;
  const targetDate = fixedDate ?? getOffsetDate(effectiveOffset);

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const isToday = targetDate.toDateString() === now.toDateString();

  const timeline = useMemo(() => {
    const dayIntervals = getWorkIntervalsForDate(allWorkIntervals, targetDate);
    const daySessions = getBreakSessionsForDate(sessions, targetDate);
    const daySchedule = getDayScheduleForDate(targetDate, schedule, dailySchedules);
    const schedStart = daySchedule.startMinute / 60;
    const schedEnd = daySchedule.endMinute / 60;
    return buildDayTimeline(
      schedStart,
      schedEnd,
      dayIntervals,
      daySessions,
      isToday ? nowH : undefined,
    );
  }, [allWorkIntervals, sessions, targetDate, schedule, dailySchedules, isToday, nowH]);

  const viewStart = zoomRange ? zoomRange[0] : timeline.axisStart;
  const viewEnd = zoomRange ? zoomRange[1] : timeline.axisEnd;
  const pct = (h: number) => toPercent(h, viewStart, viewEnd);

  return (
    <div className="px-4 py-3">
      {todayOnly ? (
        <div className="flex items-center justify-center mb-3">
          <span className="text-[11px] font-medium text-muted-foreground">Today</span>
        </div>
      ) : fixedDate ? (
        <div className="flex items-center justify-between mb-3">
          <button onClick={onPrev} className={navBtnClass}>
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {isToday ? "Today" : fixedDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <button onClick={onNext} disabled={isToday} className={navBtnClass}>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : (
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
      )}

      {/* Timeline bar */}
      <div className="relative h-5 rounded-full bg-muted/80 overflow-hidden">
        {/* Layer 1: Working region bands */}
        {timeline.workBands.map((band, i) => (
          <div
            key={i}
            className="absolute inset-y-0 bg-blue-400/50 dark:bg-blue-500/30"
            style={{
              left: `${pct(band.startH)}%`,
              width: `${pct(band.endH) - pct(band.startH)}%`,
            }}
          />
        ))}

        {/* Layer 2: Break segments (clipped to work bands) */}
        {timeline.breakBands.map((band) => {
          const left = pct(band.startH);
          const width = pct(band.endH) - left;
          if (width <= 0) return null;

          const fmtTime = (h: number) => {
            const hours = Math.floor(h);
            const mins = Math.round((h - hours) * 60);
            return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
          };

          return (
            <div
              key={band.id}
              className="group absolute inset-y-0 bg-emerald-400/80 dark:bg-emerald-500/60"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-foreground text-background text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                  {fmtTime(band.startH)}–{fmtTime(band.endH)}
                </div>
              </div>
            </div>
          );
        })}

        {/* "Now" marker (today only) */}
        {isToday && nowH >= timeline.axisStart && nowH <= timeline.axisEnd && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/70"
            style={{ left: `${pct(nowH)}%` }}
          />
        )}
      </div>

      {/* Time labels below the bar */}
      <div className="relative h-4 mt-0.5">
        <span className="absolute left-0 text-[9px] text-muted-foreground">
          {formatHour(viewStart)}
        </span>
        <span className="absolute right-0 text-[9px] text-muted-foreground">
          {formatHour(viewEnd)}
        </span>
        {isToday && nowH >= timeline.axisStart && nowH <= timeline.axisEnd && (
          <span
            className="absolute text-[9px] font-medium text-foreground/70 -translate-x-1/2"
            style={{ left: `${pct(nowH)}%` }}
          >
            now
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-blue-400/50 dark:bg-blue-500/30" />
          <span className="text-[9px] text-muted-foreground">Working</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-emerald-400/80 dark:bg-emerald-500/60" />
          <span className="text-[9px] text-muted-foreground">Break</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {timeline.breakBands.length} break{timeline.breakBands.length !== 1 ? "s" : ""}
          {timeline.breakBands.length > 0 &&
            ` · ${formatDuration(
              Math.round(
                timeline.breakBands.reduce(
                  (sum, b) => sum + (b.endH - b.startH) * 3600,
                  0,
                ),
              ),
            )}`}
        </span>
        <button
          className={`ml-auto p-0.5 rounded transition-colors ${
            zoomMode
              ? "text-foreground bg-muted"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          onClick={() => {
            if (zoomMode) {
              setZoomMode(false);
              setZoomRange(null);
            } else {
              setZoomMode(true);
              setZoomRange([timeline.axisStart, timeline.axisEnd]);
            }
          }}
          title="Zoom time range"
        >
          <Search className="size-3" />
        </button>
      </div>

      {/* Zoom range slider */}
      {zoomMode && zoomRange && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px] text-muted-foreground w-8 text-right shrink-0">
            {formatHour(zoomRange[0])}
          </span>
          <Slider
            min={timeline.axisStart * 60}
            max={timeline.axisEnd * 60}
            step={5}
            minStepsBetweenValues={3}
            value={[zoomRange[0] * 60, zoomRange[1] * 60]}
            onValueChange={(v) => {
              const arr = v as number[];
              setZoomRange([arr[0] / 60, arr[1] / 60]);
            }}
          />
          <span className="text-[9px] text-muted-foreground w-8 shrink-0">
            {formatHour(zoomRange[1])}
          </span>
        </div>
      )}
    </div>
  );
}
