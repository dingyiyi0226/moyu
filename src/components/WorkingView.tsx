import { useMemo, useState } from "react";
import { useAppStore, isCurrentlyWorking, perSecondRate, getDayScheduleForDate, getDateKey } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { Play, LogIn, LogOut, Plus, Coffee, Clock, CalendarClock } from "lucide-react";
import { RangePicker } from "@/components/BreakPicker";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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
  const { formatCurrency } = useSalaryCalc();

  const working = isCurrentlyWorking(workIntervals, schedule);
  const isClocked = workIntervals.length > 0 && workIntervals[workIntervals.length - 1].end === null;

  const [customPicker, setCustomPicker] = useState<"choose" | "break" | "work" | "schedule" | null>(null);

  const todaySchedule = useMemo(() => {
    return getDayScheduleForDate(new Date(), schedule, dailySchedules);
  }, [schedule, dailySchedules]);

  const todayStats = useMemo(() => {
    const today = new Date();
    const todaySessions = sessions.filter((s) => {
      const d = new Date(s.startTime);
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    });
    const earnings = todaySessions.reduce((sum, s) => sum + s.earnings, 0);
    const duration = todaySessions.reduce(
      (sum, s) => sum + (s.endTime - s.startTime) / 1000,
      0,
    );
    return { earnings, duration, count: todaySessions.length };
  }, [sessions]);

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
              onClick={() => setBreakStarted(Date.now())}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 transition-colors"
            >
              <Play className="size-3" />
              Break
            </button>
          )}
          <button
            onClick={() => setCustomPicker((v) => (v ? null : "choose"))}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Add custom entry"
          >
            <Plus className="size-3" />
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

      <div className="rounded-xl bg-muted/60 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Today
          </span>
          <span className="text-xl font-semibold tabular-nums tracking-tight">
            {formatCurrency(todayStats.earnings)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {todayStats.count} break{todayStats.count !== 1 ? "s" : ""} &middot; {formatDuration(todayStats.duration)}
        </p>
      </div>
    </div>
  );
}
