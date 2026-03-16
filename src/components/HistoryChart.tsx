import { useMemo, useState } from "react";
import { useAppStore, getDayScheduleForDate, type BreakSession, type WorkInterval } from "@/store/appStore";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

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
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
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
 *
 * @param schedStart  scheduled start hour (e.g. 9)
 * @param schedEnd    scheduled end hour (e.g. 18)
 * @param workIntervals  clock in/out intervals for this day (timestamps)
 * @param breakSessions  break sessions for this day (timestamps)
 * @param nowH  current fractional hour — used to cap open (clocked-in) intervals
 */
export function buildDayTimeline(
  schedStart: number,
  schedEnd: number,
  workIntervals: WorkInterval[],
  breakSessions: BreakSession[],
  nowH?: number,
): DayTimeline {
  // 1. Convert work intervals to fractional hours, clip to schedule range
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

  // 2. Convert breaks to fractional hours, clip to work bands
  //    A break only counts where it intersects a work band.
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

// ── Per-day stats ─────────────────────────────────────────────────────

export function computeDayStats(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
  date: Date,
): { breakSec: number; workSec: number; earnings: number; breakCount: number } {
  const dateKey = getDateKey(date.getTime());

  let breakSec = 0;
  let earnings = 0;
  let breakCount = 0;
  for (const s of sessions) {
    if (getDateKey(s.startTime) === dateKey) {
      breakSec += Math.round((s.endTime - s.startTime) / 1000);
      earnings += s.earnings;
      breakCount++;
    }
  }

  let workSec = 0;
  const dayIntervals = getWorkIntervalsForDate(workIntervals, date);
  for (const iv of dayIntervals) {
    const end = iv.end ?? Date.now();
    workSec += Math.round((end - iv.start) / 1000);
  }
  workSec = Math.max(0, workSec - breakSec);

  return { breakSec, workSec, earnings, breakCount };
}

// ── Weekly aggregation ─────────────────────────────────────────────────

interface BarData {
  key: string;
  label: string;
  breakSec: number;
  workSec: number;
  earnings: number;
}

function aggregateWeekly(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
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
    const stats = computeDayStats(sessions, workIntervals, date);
    return { key: getDateKey(date.getTime()), label, ...stats };
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

// ── Helpers for filtering store data to a specific day ──────────────────

/** Filter work intervals that overlap with a given date (midnight to midnight). */
function getWorkIntervalsForDate(
  allIntervals: WorkInterval[],
  date: Date,
): WorkInterval[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const dsMs = dayStart.getTime();
  const deMs = dayEnd.getTime();

  return allIntervals.filter((iv) => {
    const end = iv.end ?? Date.now();
    // interval overlaps with this day
    return iv.start <= deMs && end >= dsMs;
  });
}

function getBreakSessionsForDate(
  allSessions: BreakSession[],
  date: Date,
): BreakSession[] {
  const key = getDateKey(date.getTime());
  return allSessions
    .filter((s) => getDateKey(s.startTime) === key)
    .sort((a, b) => a.startTime - b.startTime);
}

// ── Shared UI constants ────────────────────────────────────────────────

const navBtnClass =
  "p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none";

/** Convert fractional hour to % position within the schedule bar */
function toPercent(hour: number, schedStart: number, schedEnd: number): number {
  const total = schedEnd - schedStart;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((hour - schedStart) / total) * 100));
}

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

const weeklyChartConfig = {
  work: {
    label: "Work",
    color: "oklch(0.707 0.165 254.624)",
  },
  break: {
    label: "Break",
    color: "oklch(0.765 0.177 163.223)",
  },
} satisfies ChartConfig;

function WeeklyTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter(p => p.value > 0);
  if (visible.length === 0) return null;
  return (
    <div className="rounded-lg bg-foreground text-background text-[10px] px-2 py-1.5 shadow-md space-y-0.5">
      {visible.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-sm"
            style={{ background: p.color }}
          />
          <span>{p.dataKey === "work" ? "Work" : "Break"}</span>
          <span className="font-medium">{formatDuration(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function formatTickDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function WeeklyChart({
  sessions,
  onBarClick,
  weekOffset,
  onWeekOffsetChange,
}: {
  sessions: BreakSession[];
  onBarClick?: (date: Date) => void;
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
}) {
  const allWorkIntervals = useAppStore((s) => s.workIntervals);
  const setWeekOffset = onWeekOffsetChange;
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const bars = useMemo(
    () => aggregateWeekly(sessions, allWorkIntervals, weekOffset),
    [sessions, allWorkIntervals, weekOffset],
  );

  const yTicks = useMemo(() => {
    const MAX_TICKS = 5;
    const maxSec = Math.max(
      ...bars.map((b) =>
        (hiddenKeys.has("work") ? 0 : b.workSec) +
        (hiddenKeys.has("break") ? 0 : b.breakSec)
      ),
      1,
    );
    // Base step: 1h if >4h, 30m if >2h, 10m otherwise
    let step =
      maxSec > 4 * 3600 ? 3600 :
      maxSec > 2 * 3600 ? 1800 :
      600;
    // If too many ticks, double the step until it fits
    while (Math.ceil(maxSec / step) + 1 > MAX_TICKS) {
      step *= 2;
    }
    const ceil = Math.ceil(maxSec / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= ceil; v += step) ticks.push(v);
    return { ticks, domain: [0, ceil] as [number, number] };
  }, [bars, hiddenKeys]);

  const chartData = useMemo(
    () =>
      bars.map((bar) => ({
        label: bar.label,
        key: bar.key,
        work: hiddenKeys.has("work") ? 0 : bar.workSec,
        break: hiddenKeys.has("break") ? 0 : bar.breakSec,
      })),
    [bars, hiddenKeys],
  );

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className={navBtnClass}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatWeekLabel(weekOffset)}
        </span>
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          disabled={weekOffset >= 0}
          className={navBtnClass}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <ChartContainer config={weeklyChartConfig} className="h-[100px] w-full">
        <BarChart
          data={chartData}
          barSize={14}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(state: any) => {
            const key = state?.activePayload?.[0]?.payload?.key as string | undefined;
            if (key && onBarClick) {
              const [y, m, d] = key.split("-").map(Number);
              onBarClick(new Date(y, m - 1, d));
            }
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" syncWithTicks />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 8 }}
            tickFormatter={formatTickDuration}
            width={28}
            domain={yTicks.domain}
            ticks={yTicks.ticks}
            interval={0}
          />
          <Tooltip
            content={<WeeklyTooltip />}
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
          />
          <Bar
            dataKey="work"
            stackId="a"
            fill="var(--color-work)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="break"
            stackId="a"
            fill="var(--color-break)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ChartContainer>

      {/* Legend toggles */}
      <div className="flex items-center gap-3 -mt-1">
        {(["work", "break"] as const).map((key) => (
          <button
            key={key}
            className={`flex items-center gap-1 transition-opacity ${
              hiddenKeys.has(key) ? "opacity-40" : "opacity-100"
            }`}
            onClick={() => toggleKey(key)}
          >
            <span
              className="inline-block size-2 rounded-sm"
              style={{ background: weeklyChartConfig[key].color }}
            />
            <span className="text-[9px] text-muted-foreground">
              {weeklyChartConfig[key].label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}