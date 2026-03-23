import { formatDuration } from "@/lib/timeUtils";

interface DayDurationChartProps {
  mostWorkSec: number;
  leastWorkSec: number;
  mostBreakSec: number;
  leastBreakSec: number;
}

const WORK_COLOR = "oklch(0.707 0.165 254.624)";
const WORK_COLOR_LIGHT = "oklch(0.82 0.10 254.624)";
const BREAK_COLOR = "oklch(0.765 0.177 163.223)";
const BREAK_COLOR_LIGHT = "oklch(0.87 0.10 163.223)";

const BAR_H = 20;
const POSITIONS = [15, 30, 70, 85];

type Kind = "most" | "least";

interface Marker {
  label: string;
  sec: number;
  color: string;
  kind: Kind;
  pct: number;
}

function DurationLabels({ markers, className }: { markers: Marker[]; className?: string }) {
  return (
    <div className={`relative h-3 ${className ?? ""}`}>
      {markers.map((m) => (
        <span
          key={m.label}
          className="absolute text-[9px] font-medium text-foreground/70 -translate-x-1/2"
          style={{ left: `${m.pct}%` }}
        >
          {formatDuration(m.sec)}
        </span>
      ))}
    </div>
  );
}

export function DayDurationChart({
  mostWorkSec,
  leastWorkSec,
  mostBreakSec,
  leastBreakSec,
}: DayDurationChartProps) {
  const markers: Marker[] = [
    { label: "Most work", sec: mostWorkSec, color: WORK_COLOR, kind: "most" as const },
    { label: "Least work", sec: leastWorkSec, color: WORK_COLOR_LIGHT, kind: "least" as const },
    { label: "Most break", sec: mostBreakSec, color: BREAK_COLOR, kind: "most" as const },
    { label: "Least break", sec: leastBreakSec, color: BREAK_COLOR_LIGHT, kind: "least" as const },
  ]
    .filter((m) => m.sec > 0)
    .sort((a, b) => a.sec - b.sec)
    .map((m, i) => ({ ...m, pct: POSITIONS[i] }));

  const mostMarkers = markers.filter((m) => m.kind === "most");
  const leastMarkers = markers.filter((m) => m.kind === "least");

  return (
    <div className="px-4 mb-3">
      <div className="text-[10px] text-muted-foreground text-center mb-2">
        Daily Work &amp; Break Extremes
      </div>

      <DurationLabels markers={mostMarkers} className="mb-0.5" />

      {/* Timeline bar with filled D-shaped markers (largest first, smallest on top) */}
      <div
        className="relative rounded-full bg-muted/80 overflow-hidden"
        style={{ height: BAR_H }}
      >
        {[...markers].reverse().map((m, i) => (
          <div
            key={m.label}
            className="absolute top-0 left-0"
            style={{
              width: `${m.pct}%`,
              height: BAR_H,
              backgroundColor: m.color,
              borderRadius: `0 ${BAR_H / 2}px ${BAR_H / 2}px 0`,
              zIndex: i,
            }}
          />
        ))}
      </div>

      <DurationLabels markers={leastMarkers} className="mt-0.5" />

      {/* Legend – 2×2 grid aligned by dot */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 w-fit mx-auto mt-1.5">
        {[...mostMarkers, ...leastMarkers].map((m) => (
          <span key={m.label} className="text-[9px] text-muted-foreground flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: m.color }}
            />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
