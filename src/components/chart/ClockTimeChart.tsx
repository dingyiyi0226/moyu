import { formatFractionalHour } from "@/lib/timeUtils";

export function ClockTimeChart({
  earliestClockInH,
  latestClockOutH,
}: {
  earliestClockInH: number;
  latestClockOutH: number;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground text-center mb-2">
        Clock In &amp; Out Extremes
      </div>
      {/* Description labels above bar */}
      <div className="relative h-4 mb-0.5">
        <span
          className="absolute text-[9px] text-muted-foreground -translate-x-1/2 whitespace-nowrap"
          style={{ left: "20%" }}
        >
          Earliest clock in
        </span>
        <span
          className="absolute text-[9px] text-muted-foreground -translate-x-1/2 whitespace-nowrap"
          style={{ left: "80%" }}
        >
          Latest clock out
        </span>
      </div>
      {/* Timeline bar */}
      <div className="relative h-5 rounded-full bg-muted/80 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/70"
          style={{ left: "20%" }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/70"
          style={{ left: "80%" }}
        />
      </div>
      {/* Time labels below bar */}
      <div className="relative h-4 mt-0.5">
        <span
          className="absolute text-[9px] font-medium text-foreground/70 -translate-x-1/2"
          style={{ left: "20%" }}
        >
          {formatFractionalHour(earliestClockInH)}
        </span>
        <span
          className="absolute text-[9px] font-medium text-foreground/70 -translate-x-1/2"
          style={{ left: "80%" }}
        >
          {formatFractionalHour(latestClockOutH)}
        </span>
      </div>
    </div>
  );
}
