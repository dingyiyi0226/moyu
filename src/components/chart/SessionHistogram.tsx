import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

interface BinData {
  binSec: number; // upper bound in seconds
  label: string;
  count: number;
}

function formatBinLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m${s}s`;
}

function buildBins(durationsMs: number[], binSeconds: number): BinData[] {
  const secs = durationsMs.map((ms) => ms / 1000).filter((s) => s > 0);
  if (secs.length === 0) return [];

  const maxSec = Math.max(...secs);
  const binCount = Math.max(1, Math.ceil(maxSec / binSeconds));

  const bins: BinData[] = [];
  for (let i = 0; i < binCount; i++) {
    const hi = (i + 1) * binSeconds;
    bins.push({ binSec: hi, label: formatBinLabel(hi), count: 0 });
  }

  for (const s of secs) {
    const idx = Math.min(Math.floor(s / binSeconds), binCount - 1);
    bins[idx].count++;
  }

  return bins;
}

export function SessionHistogram({
  title,
  durationsMs,
  binSeconds,
  config,
  dataKey,
  tickIntervalSec,
}: {
  title: string;
  durationsMs: number[];
  binSeconds: number;
  config: ChartConfig;
  dataKey: string;
  tickIntervalSec: number;
}) {
  const bins = useMemo(
    () => buildBins(durationsMs, binSeconds),
    [durationsMs, binSeconds],
  );

  if (bins.length === 0) return null;

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const step = Math.max(1, Math.ceil(maxCount / 4));
  const yMax = Math.ceil(maxCount / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);

  const maxBinSec = bins[bins.length - 1].binSec;
  const xTicks: number[] = [];
  for (let v = tickIntervalSec; v <= maxBinSec; v += tickIntervalSec)
    xTicks.push(v);

  return (
    <div data-chart-type="histogram">
      <div className="text-[10px] text-muted-foreground text-center mb-2">
        {title}
      </div>
      <ChartContainer config={config} className="h-[100px] w-full">
        <BarChart data={bins} barSize={10}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="binSec"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 8 }}
            ticks={xTicks}
            tickFormatter={(v: number) => formatBinLabel(v)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 8 }}
            width={20}
            domain={[0, yMax]}
            ticks={ticks}
            allowDecimals={false}
          />
          <Bar
            dataKey="count"
            fill={`var(--color-${dataKey})`}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

