import { useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { isCurrentlyWorking, perSecondRate, getDayScheduleForDate } from "@/lib/scheduleUtils";
import { getDateKey } from "@/lib/timeUtils";
import { LogIn, LogOut, PenLine, Coffee, Clock, CalendarClock } from "lucide-react";
import { RangePicker } from "@/components/BreakPicker";
import { computeDayStats, formatDuration } from "@/lib/timeUtils";
import { useCurrency } from "@/hooks/useCurrency";

function todayAt(hour: number, minute: number): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function WorkingView() {
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
  const { formatCurrency } = useCurrency();
  const working = isCurrentlyWorking(workIntervals, schedule);
  const isClocked = workIntervals.length > 0 && workIntervals[workIntervals.length - 1].end === null;

  const [customPicker, setCustomPicker] = useState<"choose" | "break" | "work" | "schedule" | null>(null);

  const todaySchedule = useMemo(() => {
    return getDayScheduleForDate(new Date(), schedule, dailySchedules);
  }, [schedule, dailySchedules]);

  const pauseIntervals = useAppStore((s) => s.pauseIntervals);

  const todayStats = useMemo(() => {
    const today = new Date();
    const stats = computeDayStats(sessions, workIntervals, today, pauseIntervals);
    return { earnings: stats.earnings, breakDuration: stats.breakSec, workDuration: stats.workSec };
  }, [sessions, workIntervals, pauseIntervals]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex size-2 rounded-full ${
              working
                ? "bg-emerald-400 dark:bg-emerald-500"
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          />
          <span className="text-xs font-medium text-muted-foreground">
            {working ? "Working" : "Off hours"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isClocked ? (
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
          {working && (
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

      {customPicker === "choose" && (
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

      {customPicker === "break" && (
        <RangePicker
          confirmClassName="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
          onConfirm={(sH, sM, eH, eM) => {
            const startTime = todayAt(sH, sM);
            const endTime = todayAt(eH, eM);
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

      {customPicker === "work" && (
        <RangePicker
          confirmClassName="text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
          onConfirm={(sH, sM, eH, eM) => {
            clockIn(todayAt(sH, sM));
            clockOut(todayAt(eH, eM));
            setCustomPicker(null);
          }}
          onCancel={() => setCustomPicker(null)}
        />
      )}

      {customPicker === "schedule" && (
        <RangePicker
          confirmClassName="text-violet-600 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-950/60"
          initialStartH={Math.floor(todaySchedule.startMinute / 60)}
          initialStartM={todaySchedule.startMinute % 60}
          initialEndH={Math.floor(todaySchedule.endMinute / 60)}
          initialEndM={todaySchedule.endMinute % 60}
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
          Your earnings today
        </div>
        <div className="text-2xl font-semibold mt-0.5">
          {formatCurrency(todayStats.earnings)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Work {formatDuration(todayStats.workDuration)} &middot; Break {formatDuration(todayStats.breakDuration)}
        </div>
      </div>
    </div>
  );
}
