import { useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { isCurrentlyWorking, perSecondRate, getDayScheduleForDate } from "@/lib/scheduleUtils";
import { getDateKey } from "@/lib/timeUtils";
import { useNow } from "@/hooks/useNow";
import { LogIn, LogOut, PenLine, Coffee, Clock, CalendarClock, Presentation } from "lucide-react";
import { RangePicker } from "@/components/ui/range-picker";
import { formatDuration } from "@/lib/timeUtils";
import { computeDayStats } from "@/lib/statsUtils";
import { useCurrency } from "@/hooks/useCurrency";

function dateAt(date: Date, hour: number, minute: number): number {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function WorkingView({ date }: { date: Date }) {
  const sessions = useAppStore((s) => s.sessions);
  const setBreakStarted = useAppStore((s) => s.setBreakStarted);
  const schedule = useAppStore((s) => s.schedule);
  const dailySchedules = useAppStore((s) => s.dailySchedules);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const clockIn = useAppStore((s) => s.clockIn);
  const clockOut = useAppStore((s) => s.clockOut);
  const addSession = useAppStore((s) => s.addSession);
  const setDailySchedule = useAppStore((s) => s.setDailySchedule);
  const salary = useAppStore((s) => s.salary);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const startPause = useAppStore((s) => s.startPause);
  const endPause = useAppStore((s) => s.endPause);
  const { formatCurrency } = useCurrency();
  const now = useNow();
  const isToday = date.toDateString() === now.toDateString();
  const isWorking = isCurrentlyWorking(workIntervals);

  const isPaused = pauseIntervals.length > 0 && pauseIntervals[pauseIntervals.length - 1].end === null;

  const [customPicker, setCustomPicker] = useState<"choose" | "break" | "work" | "schedule" | null>(null);

  const daySchedule = useMemo(() => {
    return getDayScheduleForDate(date, schedule, dailySchedules);
  }, [date, schedule, dailySchedules]);

  const dayStats = useMemo(() => {
    const statsDate = isToday ? now : date;
    const stats = computeDayStats(sessions, workIntervals, statsDate, pauseIntervals);
    return { earnings: stats.earnings, breakDuration: stats.breakSec, workDuration: stats.workSec };
  }, [sessions, workIntervals, pauseIntervals, now, date, isToday]);

  return (
    <div className="space-y-4">
      {isToday && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex size-2 rounded-full ${
                isWorking
                  ? "bg-emerald-400 dark:bg-emerald-500"
                  : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {isWorking ? "Working" : "Off hours"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isWorking ? (
              <button
                onClick={() => clockOut()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/60 transition-colors"
              >
                <LogOut className="size-3" />
                Clock Out
              </button>
            ) : (
              <button
                onClick={() => clockIn()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 transition-colors"
              >
                <LogIn className="size-3" />
                Clock In
              </button>
            )}
            {isWorking && (
              <button
                onClick={() => (isPaused ? endPause() : startPause())}
                className={`self-stretch flex items-center px-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isPaused
                    ? "text-amber-600 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-950/80"
                    : "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
                }`}
                title={isPaused ? "Resume" : "Meeting"}
              >
                <Presentation className="size-3" />
              </button>
            )}
            {isWorking && !isPaused && (
              <button
                onClick={() => setBreakStarted(Date.now(), "manual")}
                className="self-stretch flex items-center px-1.5 rounded-lg text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 transition-colors"
                title="Break"
              >
                <Coffee className="size-3" />
              </button>
            )}
            <button
              onClick={() => setCustomPicker((v) => (v ? null : "choose"))}
              className="self-stretch flex items-center px-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Add custom entry"
            >
              <PenLine className="size-3" />
            </button>
          </div>
        </div>
      )}

      {isToday && customPicker === "choose" && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCustomPicker("break")}
            className="flex-1 h-7 rounded-lg text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 transition-colors flex items-center justify-center gap-1"
          >
            <Coffee className="size-3" />
            Break
          </button>
          <button
            onClick={() => setCustomPicker("work")}
            className="flex-1 h-7 rounded-lg text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 transition-colors flex items-center justify-center gap-1"
          >
            <Clock className="size-3" />
            Work
          </button>
          <button
            onClick={() => setCustomPicker("schedule")}
            className="flex-1 h-7 rounded-lg text-[11px] font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-950/60 transition-colors flex items-center justify-center gap-1"
          >
            <CalendarClock className="size-3" />
            Schedule
          </button>
        </div>
      )}

      {isToday && customPicker === "break" && (
        <RangePicker
          confirmClassName="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
          onConfirm={(sH, sM, eH, eM) => {
            const startTime = dateAt(date, sH, sM);
            const endTime = dateAt(date, eH, eM);
            if (endTime > startTime) {
              const durationSec = (endTime - startTime) / 1000;
              const earnings = durationSec * perSecondRate(salary, schedule);
              addSession({
                id: `${startTime}-${endTime}`,
                startTime,
                endTime,
                earnings,
                reason: "custom",
              });
            }
            setCustomPicker(null);
          }}
          onCancel={() => setCustomPicker(null)}
        />
      )}

      {isToday && customPicker === "work" && (
        <RangePicker
          confirmClassName="text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
          onConfirm={(sH, sM, eH, eM) => {
            clockIn(dateAt(date, sH, sM));
            clockOut(dateAt(date, eH, eM));
            setCustomPicker(null);
          }}
          onCancel={() => setCustomPicker(null)}
        />
      )}

      {isToday && customPicker === "schedule" && (
        <RangePicker
          confirmClassName="text-violet-600 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-950/60"
          initialStartH={Math.floor(daySchedule.startMinute / 60)}
          initialStartM={daySchedule.startMinute % 60}
          initialEndH={Math.floor(daySchedule.endMinute / 60)}
          initialEndM={daySchedule.endMinute % 60}
          onConfirm={(sH, sM, eH, eM) => {
            setDailySchedule(getDateKey(Date.now()), {
              enabled: true,
              startMinute: sH * 60 + sM,
              endMinute: eH * 60 + eM,
            });
            setCustomPicker(null);
          }}
          onCancel={() => setCustomPicker(null)}
        />
      )}

      <div className="text-center">
        <div className="text-[10px] text-muted-foreground">
          {isToday
            ? "Your earnings today"
            : `Your earnings on ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`}
        </div>
        <div className="text-2xl font-semibold mt-0.5">
          {formatCurrency(dayStats.earnings)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Work {formatDuration(dayStats.workDuration)} &middot; Break {formatDuration(dayStats.breakDuration)}
        </div>
      </div>
    </div>
  );
}
