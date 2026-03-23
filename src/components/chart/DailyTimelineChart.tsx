import { useState } from "react";
import { ChartLine, Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatDuration, formatHour } from "@/lib/timeUtils";
import { type DayTimeline, toPercent } from "./utils";

export function DailyTimelineChart({
  timeline,
  isToday,
  nowH,
  onToggleLineChart,
}: {
  timeline: DayTimeline;
  isToday: boolean;
  nowH: number;
  onToggleLineChart: () => void;
}) {
  const [zoomMode, setZoomMode] = useState(false);
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);

  const viewStart = zoomRange ? zoomRange[0] : timeline.axisStart;
  const viewEnd = zoomRange ? zoomRange[1] : timeline.axisEnd;
  const pct = (h: number) => toPercent(h, viewStart, viewEnd);

  return (
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
          onClick={onToggleLineChart}
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
  );
}
