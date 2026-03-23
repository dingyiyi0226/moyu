import { useMemo, useState } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { ChevronLeft, ChevronRight, ChartLine } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { formatDuration, formatHour, getWeekSunday, getIntervalsForDate, getBreakSessionsForDate } from "@/lib/timeUtils";
import { getDayScheduleForDate } from "@/lib/scheduleUtils";
import { navBtnClass } from "@/lib/utils";
import { aggregateWeekStats } from "@/lib/statsUtils";
import { buildDayTimeline, computeMovingAverage } from "@/components/DailyChart";

function formatWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return "This Week";
  const sunday = getWeekSunday(weekOffset);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${fmt(sunday)} – ${fmt(saturday)}`;
}

// ── Chart config ──────────────────────────────────────────────────────

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

function makeTickFormatter(maxSec: number): (sec: number) => string {
  if (maxSec > 2 * 3600) {
    return (sec) => `${Math.round(sec / 3600)}h`;
  }
  return (sec) => `${Math.round(sec / 60)}m`;
}

const weeklyLineChartConfig = {
  percent: {
    label: "Working %",
    color: "oklch(0.707 0.165 254.624)",
  },
} satisfies ChartConfig;

function WeeklyLineTooltip({ active, payload }: {
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

// ── Component ──────────────────────────────────────────────────────────

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
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const schedule = useAppStore((s) => s.schedule);
  const dailySchedules = useAppStore((s) => s.dailySchedules);
  const setWeekOffset = onWeekOffsetChange;
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [showLineChart, setShowLineChart] = useState(false);

  const bars = useMemo(
    () => aggregateWeekStats(sessions, allWorkIntervals, weekOffset, pauseIntervals),
    [sessions, allWorkIntervals, weekOffset, pauseIntervals],
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
    let step =
      maxSec > 4 * 3600 ? 3600 :
      maxSec > 2 * 3600 ? 1800 :
      600;
    while (Math.ceil(maxSec / step) + 1 > MAX_TICKS) {
      step *= 2;
    }
    const ceil = Math.ceil(maxSec / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= ceil; v += step) ticks.push(v);
    return { ticks, domain: [0, ceil] as [number, number], tickFormatter: makeTickFormatter(maxSec) };
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

  const weeklyLineData = useMemo(() => {
    if (!showLineChart) return [];

    const sunday = getWeekSunday(weekOffset);
    const dailyAverages: { hour: number; percent: number }[][] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const dayIntervals = getIntervalsForDate(allWorkIntervals, date);
      if (dayIntervals.length === 0) continue;

      const daySessions = getBreakSessionsForDate(sessions, date);
      const daySchedule = getDayScheduleForDate(date, schedule, dailySchedules);
      const schedStart = daySchedule.startMinute / 60;
      const schedEnd = daySchedule.endMinute / 60;
      const timeline = buildDayTimeline(schedStart, schedEnd, dayIntervals, daySessions);
      dailyAverages.push(computeMovingAverage(timeline, 0.5, 5));
    }

    if (dailyAverages.length === 0) return [];

    // Average across working days at each time point
    const hourMap = new Map<number, { total: number; count: number }>();
    for (const dayPoints of dailyAverages) {
      for (const pt of dayPoints) {
        const key = Math.round(pt.hour * 1000) / 1000;
        const existing = hourMap.get(key);
        if (existing) {
          existing.total += pt.percent;
          existing.count += 1;
        } else {
          hourMap.set(key, { total: pt.percent, count: 1 });
        }
      }
    }

    return Array.from(hourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, { total, count }]) => ({
        hour,
        label: formatHour(hour),
        percent: Math.round((total / count) * 10) / 10,
      }));
  }, [showLineChart, weekOffset, allWorkIntervals, sessions, schedule, dailySchedules]);

  const lineXTicks = useMemo(() => {
    if (!showLineChart || weeklyLineData.length === 0) return [];
    const minH = weeklyLineData[0].hour;
    const maxH = weeklyLineData[weeklyLineData.length - 1].hour;
    const range = maxH - minH;
    const step = range > 6 ? 2 : 1;
    const start = Math.ceil(minH / step) * step;
    const ticks: number[] = [];
    for (let h = start; h <= maxH; h += step) ticks.push(h);
    return ticks;
  }, [showLineChart, weeklyLineData]);

  return (
    <div className="px-4 py-3 shrink-0">
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

      {showLineChart ? (
        <>
          <ChartContainer config={weeklyLineChartConfig} className="h-[100px] w-full">
            <AreaChart data={weeklyLineData}>
              <defs>
                <linearGradient id="weeklyWorkGradient" x1="0" y1="0" x2="0" y2="1">
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
                ticks={lineXTicks}
                domain={weeklyLineData.length > 0 ? [weeklyLineData[0].hour, weeklyLineData[weeklyLineData.length - 1].hour] : undefined}
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
              <Tooltip content={<WeeklyLineTooltip />} />
              <Area
                dataKey="percent"
                type="monotone"
                stroke="var(--color-percent)"
                fill="url(#weeklyWorkGradient)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ChartContainer>
          <div className="flex items-center gap-3 -mt-1 pl-3">
            <div className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm" style={{ background: weeklyLineChartConfig.percent.color }} />
              <span className="text-[9px] text-muted-foreground">Avg working % (30m avg)</span>
            </div>
            <button
              className="ml-auto p-0.5 rounded transition-colors text-foreground bg-muted"
              onClick={() => setShowLineChart(false)}
              title="Show bar chart"
            >
              <ChartLine className="size-3" />
            </button>
          </div>
        </>
      ) : (
        <>
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
                tickFormatter={yTicks.tickFormatter}
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
          <div className="flex items-center gap-3 -mt-1 pl-3">
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
            <button
              className="ml-auto p-0.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setShowLineChart(true)}
              title="Show activity chart"
            >
              <ChartLine className="size-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
