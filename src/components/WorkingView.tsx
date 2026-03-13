import { useMemo, useState, useRef, useCallback } from "react";
import { useAppStore, isCurrentlyWorking, perSecondRate } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { Play, LogIn, LogOut, Plus } from "lucide-react";
import { TimePicker } from "@/components/TimePicker";
import { BreakPicker } from "@/components/BreakPicker";

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

function useLongHover(onLongHover: () => void, delay = 1000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = useCallback(() => {
    timerRef.current = setTimeout(onLongHover, delay);
  }, [onLongHover, delay]);

  const onLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onMouseEnter: onEnter, onMouseLeave: onLeave };
}

export function WorkingView() {
  const sessions = useAppStore((s) => s.sessions);
  const setBreakStarted = useAppStore((s) => s.setBreakStarted);
  const schedule = useAppStore((s) => s.schedule);
  const clockedInAt = useAppStore((s) => s.clockedInAt);
  const clockedOutAt = useAppStore((s) => s.clockedOutAt);
  const clockIn = useAppStore((s) => s.clockIn);
  const clockOut = useAppStore((s) => s.clockOut);
  const addSession = useAppStore((s) => s.addSession);
  const salary = useAppStore((s) => s.salary);
  const { formatCurrency } = useSalaryCalc();

  const working = isCurrentlyWorking(clockedInAt, clockedOutAt, schedule);

  const [showPicker, setShowPicker] = useState<"in" | "out" | null>(null);
  const [showBreakPicker, setShowBreakPicker] = useState(false);

  const clockInHover = useLongHover(
    useCallback(() => setShowPicker("in"), []),
  );
  const clockOutHover = useLongHover(
    useCallback(() => setShowPicker("out"), []),
  );

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

  const monthStats = useMemo(() => {
    const now = new Date();
    const monthSessions = sessions.filter((s) => {
      const d = new Date(s.startTime);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });
    return monthSessions.reduce((sum, s) => sum + s.earnings, 0);
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
          {clockedInAt && !clockedOutAt ? (
            <button
              onClick={() => clockOut()}
              {...clockOutHover}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/60 transition-colors"
            >
              <LogOut className="size-3" />
              Clock Out
            </button>
          ) : !clockedInAt ? (
            <button
              onClick={() => clockIn()}
              {...clockInHover}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 transition-colors"
            >
              <LogIn className="size-3" />
              Clock In
            </button>
          ) : null}
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
            onClick={() => setShowBreakPicker((v) => !v)}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Add custom break"
          >
            <Plus className="size-3" />
          </button>
        </div>
      </div>

      {showPicker === "in" && (
        <TimePicker
          label="Clock in at"
          onConfirm={(h, m) => {
            clockIn(todayAt(h, m));
            setShowPicker(null);
          }}
          onCancel={() => setShowPicker(null)}
        />
      )}
      {showPicker === "out" && (
        <TimePicker
          label="Clock out at"
          onConfirm={(h, m) => {
            clockOut(todayAt(h, m));
            setShowPicker(null);
          }}
          onCancel={() => setShowPicker(null)}
        />
      )}

      {showBreakPicker && (
        <BreakPicker
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
            setShowBreakPicker(false);
          }}
          onCancel={() => setShowBreakPicker(false)}
        />
      )}

      <div className="space-y-3">
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

        <div className="rounded-xl bg-muted/60 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              This month
            </span>
            <span className="text-base font-semibold tabular-nums tracking-tight">
              {formatCurrency(monthStats)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
