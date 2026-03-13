import { useMemo } from "react";
import { useAppStore, type BreakSession, type WorkInterval } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { LogIn, LogOut } from "lucide-react";

type TimelineEntry =
  | { kind: "clock-in"; time: number; id: string }
  | { kind: "clock-out"; time: number; id: string }
  | { kind: "break"; session: BreakSession };

function buildTimelineEntries(
  workIntervals: WorkInterval[],
  sessions: BreakSession[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const iv of workIntervals) {
    entries.push({ kind: "clock-in", time: iv.start, id: `ci-${iv.start}` });
    if (iv.end != null) {
      entries.push({ kind: "clock-out", time: iv.end, id: `co-${iv.end}` });
    }
  }

  for (const s of sessions) {
    entries.push({ kind: "break", session: s });
  }

  // Sort newest first
  entries.sort((a, b) => {
    const ta = a.kind === "break" ? a.session.startTime : a.time;
    const tb = b.kind === "break" ? b.session.startTime : b.time;
    return tb - ta;
  });

  return entries;
}

function entryTime(e: TimelineEntry): number {
  return e.kind === "break" ? e.session.startTime : e.time;
}

interface DayGroup {
  date: string;
  entries: TimelineEntry[];
  breakTotal: number;
}

function isSameDay(ts: number, ref: Date): boolean {
  const d = new Date(ts);
  return (
    d.getDate() === ref.getDate() &&
    d.getMonth() === ref.getMonth() &&
    d.getFullYear() === ref.getFullYear()
  );
}

export function HistoryList({ todayOnly = false }: { todayOnly?: boolean } = {}) {
  const allSessions = useAppStore((s) => s.sessions);
  const allWorkIntervals = useAppStore((s) => s.workIntervals);
  const { formatCurrency } = useSalaryCalc();

  const groupedByDay = useMemo((): DayGroup[] => {
    const today = new Date();
    const sessions = todayOnly
      ? allSessions.filter((s) => isSameDay(s.startTime, today))
      : allSessions;
    const workIntervals = todayOnly
      ? allWorkIntervals.filter((iv) => isSameDay(iv.start, today))
      : allWorkIntervals;

    const entries = buildTimelineEntries(workIntervals, sessions);
    const groups: Record<string, TimelineEntry[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entryTime(entry)).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    }

    return Object.entries(groups).map(([date, entries]) => ({
      date,
      entries,
      breakTotal: entries.reduce(
        (sum, e) => sum + (e.kind === "break" ? e.session.earnings : 0),
        0,
      ),
    }));
  }, [allSessions, allWorkIntervals, todayOnly]);

  if (allSessions.length === 0 && allWorkIntervals.length === 0) {
    return (
      <p className="text-center text-[11px] text-muted-foreground py-5">
        Lock your screen to start tracking breaks.
      </p>
    );
  }

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <div className="max-h-[240px] overflow-y-auto">
      {groupedByDay.map((group, groupIdx) => (
        <div key={group.date}>
          {groupIdx > 0 && <div className="h-px bg-border mx-4" />}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                {group.date}
              </span>
              {group.breakTotal > 0 && (
                <span className="text-[11px] font-semibold tabular-nums text-emerald-600">
                  {formatCurrency(group.breakTotal)}
                </span>
              )}
            </div>
            {group.entries.map((entry) => {
              if (entry.kind === "clock-in") {
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-1.5 py-1 text-[12px] text-blue-600 dark:text-blue-400"
                  >
                    <LogIn className="size-3" />
                    <span>{fmtTime(entry.time)}</span>
                    <span className="text-muted-foreground">Clock In</span>
                  </div>
                );
              }

              if (entry.kind === "clock-out") {
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-1.5 py-1 text-[12px] text-orange-600 dark:text-orange-400"
                  >
                    <LogOut className="size-3" />
                    <span>{fmtTime(entry.time)}</span>
                    <span className="text-muted-foreground">Clock Out</span>
                  </div>
                );
              }

              const { session } = entry;
              const totalSec = Math.round(
                (session.endTime - session.startTime) / 1000,
              );
              const m = Math.floor(totalSec / 60);
              const s = totalSec % 60;
              const duration = m > 0 ? `${m}m ${s}s` : `${s}s`;

              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-1 text-[12px]"
                >
                  <span className="text-muted-foreground">
                    {fmtTime(session.startTime)} &middot; {duration}
                  </span>
                  <span className="tabular-nums text-foreground/80">
                    {formatCurrency(session.earnings)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
