import { ChartLine } from "lucide-react";
import { formatFractionalHour } from "@/lib/timeUtils";
import { Area, AreaChart, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

// ── Tooltip ──────────────────────────────────────────────────────────

function LineTooltip({ active, payload }: {
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

// ── Config ───────────────────────────────────────────────────────────

const lineChartConfig = {
  percent: {
    label: "Working %",
    color: "oklch(0.707 0.165 254.624)",
  },
} satisfies ChartConfig;

// ── Component ────────────────────────────────────────────────────────

export function ActivityLineChart({
  data,
  xTicks,
  domain,
  legendLabel,
  gradientId,
  onToggle,
}: {
  data: { hour: number; label: string; percent: number }[];
  xTicks: number[];
  domain: [number, number];
  legendLabel: string;
  gradientId: string;
  onToggle: () => void;
}) {
  return (
    <>
      <ChartContainer config={lineChartConfig} className="h-[100px] w-full">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-percent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-percent)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          {[25, 50, 75, 100].map((v) => (
            <ReferenceLine key={v} y={v} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
          ))}
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9 }}
            tickFormatter={(h: number) => formatFractionalHour(h)}
            ticks={xTicks}
            domain={domain}
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
          <Tooltip content={<LineTooltip />} />
          <Area
            dataKey="percent"
            type="monotone"
            stroke="var(--color-percent)"
            fill={`url(#${gradientId})`}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ChartContainer>
      <div className="flex items-center gap-3 -mt-1">
        <div className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm" style={{ background: lineChartConfig.percent.color }} />
          <span className="text-[9px] text-muted-foreground">{legendLabel}</span>
        </div>
        <button
          className="ml-auto p-0.5 rounded transition-colors text-foreground bg-muted"
          onClick={onToggle}
          title="Switch chart type"
        >
          <ChartLine className="size-3" />
        </button>
      </div>
    </>
  );
}
