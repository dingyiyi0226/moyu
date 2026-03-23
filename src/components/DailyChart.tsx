import { useMemo, useState } from "react";
import { useAppStore, type BreakSession, type WorkInterval } from "@/store/appStore";
import { getDayScheduleForDate } from "@/lib/scheduleUtils";
import { ChevronLeft, ChevronRight, ChartLine, Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  formatDuration,
  formatHour,
  getIntervalsForDate,
} from "@/lib/timeUtils";
import { getBreakSessionsForDate, toPercent } from "@/components/chart/utils";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { navBtnClass } from "@/lib/utils";

// ── Timeline construction ──────────────────────────────────────────────

interface TimeRange {
  startH: number; // fractional hour (e.g. 9.5 = 09:30)
  endH: number;
}

export interface DayTimeline {
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

// ── Moving average chart ─────────────────────────────────────────────

export function computeMovingAverage(
  timeline: DayTimeline,
  windowHours: number,
  stepMinutes: number,
  maxHour?: number,
): { hour: number; label: string; percent: number }[] {
  const halfWindow = windowHours / 2;
  const points: { hour: number; label: string; percent: number }[] = [];
  const endH = maxHour != null ? Math.min(maxHour, timeline.axisEnd) : timeline.axisEnd;

  for (let h = timeline.axisStart; h <= endH + 0.001; h += stepMinutes / 60) {
    // If this point is outside all work bands, force to 0
    const isClockedIn = timeline.workBands.some(
      (band) => h >= band.startH && h <= band.endH,
    );

    let percent = 0;
    if (isClockedIn) {
      const wStart = h - halfWindow;
      const wEnd = h + halfWindow;

      let workTime = 0;
      for (const band of timeline.workBands) {
        const s = Math.max(band.startH, wStart);
        const e = Math.min(band.endH, wEnd);
        if (s < e) workTime += e - s;
      }

      let breakTime = 0;
      for (const band of timeline.breakBands) {
        const s = Math.max(band.startH, wStart);
        const e = Math.min(band.endH, wEnd);
        if (s < e) breakTime += e - s;
      }

      const netWork = Math.max(0, workTime - breakTime);
      percent = workTime > 0 ? Math.round((netWork / workTime) * 1000) / 10 : 0;
    }

    points.push({ hour: h, label: formatHour(h), percent });
  }

  return points;
}

function DailyLineTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; percent: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { label, percent } = payload[0].payload;
  return (
    <div className="rounded-lg bg-foreground text-background text-[10px] px-2 py-1.5 shadow-md">
      <div>{label}</div>
      <div className="font-medium">{percent}%</div>
    </div>
  );
}

const dailyLineChartConfig = {
  percent: {
    label: "Working %",
    color: "oklch(0.707 0.165 254.624)",
  },
} satisfies ChartConfig;

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
  const [showLineChart, setShowLineChart] = useState(false);

  const effectiveOffset = todayOnly ? 0 : dayOffset;
  const targetDate = fixedDate ?? getOffsetDate(effectiveOffset);

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const isToday = targetDate.toDateString() === now.toDateString();

  const timeline = useMemo(() => {
    const dayIntervals = getIntervalsForDate(allWorkIntervals, targetDate);
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

  const lineChartData = useMemo(() => {
    if (!showLineChart) return [];
    return computeMovingAverage(timeline, 0.5, 5, isToday ? nowH : undefined);
  }, [showLineChart, timeline, isToday, nowH]);

  const xTicks = useMemo(() => {
    if (!showLineChart) return [];
    const ticks: number[] = [];
    const range = timeline.axisEnd - timeline.axisStart;
    const step = range > 6 ? 2 : 1;
    const start = Math.ceil(timeline.axisStart / step) * step;
    for (let h = start; h <= timeline.axisEnd; h += step) {
      ticks.push(h);
    }
    return ticks;
  }, [showLineChart, timeline]);

  return (
    <div className="px-4 py-3 shrink-0">
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

      {showLineChart ? (
        <>
          <ChartContainer config={dailyLineChartConfig} className="h-[100px] w-full">
            <AreaChart data={lineChartData}>
              <defs>
                <linearGradient id="dailyWorkGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-percent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-percent)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9 }}
                tickFormatter={(h: number) => formatHour(h)}
                ticks={xTicks}
                domain={[timeline.axisStart, timeline.axisEnd]}
                type="number"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 8 }}
                tickFormatter={(v: number) => `${v}%`}
                width={32}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip content={<DailyLineTooltip />} />
              <Area
                dataKey="percent"
                type="monotone"
                stroke="var(--color-percent)"
                fill="url(#dailyWorkGradient)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ChartContainer>
          <div className="flex items-center gap-3 -mt-1">
            <div className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm" style={{ background: dailyLineChartConfig.percent.color }} />
              <span className="text-[9px] text-muted-foreground">Working % (30m avg)</span>
            </div>
            <button
              className="ml-auto p-0.5 rounded transition-colors text-foreground bg-muted"
              onClick={() => setShowLineChart(false)}
              title="Show timeline"
            >
              <ChartLine className="size-3" />
            </button>
          </div>
        </>
      ) : (
        <>
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

              return (
                <div
                  key={band.id}
                  className="group absolute inset-y-0 bg-emerald-400/80 dark:bg-emerald-500/60"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                    <div className="bg-foreground text-background text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                      {formatHour(band.startH)}–{formatHour(band.endH)}
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
            {isToday && nowH >= timeline.axisStart && nowH <= timeline.axisEnd &&
              pct(nowH) > 10 && pct(nowH) < 90 && (
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
            <button
              className="p-0.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setShowLineChart(true)}
              title="Show activity chart"
            >
              <ChartLine className="size-3" />
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
        </>
      )}
    </div>
  );
}
