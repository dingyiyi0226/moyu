import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useAppStore, type BreakSession, type PauseInterval, type WorkInterval } from "@/store/appStore";
import { formatTimeSec } from "@/lib/timeUtils";
import { useCurrency } from "@/hooks/useCurrency";
import { LogIn, LogOut, Check, X, Presentation } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TimeFields { h: string; m: string; s: string }

function tsToFields(ts: number): TimeFields {
  const d = new Date(ts);
  return {
    h: String(d.getHours()).padStart(2, "0"),
    m: String(d.getMinutes()).padStart(2, "0"),
    s: String(d.getSeconds()).padStart(2, "0"),
  };
}

function fieldsToTs(fields: TimeFields, refTs: number): number {
  const d = new Date(refTs);
  d.setHours(Number(fields.h), Number(fields.m), Number(fields.s), 0);
  return d.getTime();
}

function TimeInput({ value, onChange }: { value: TimeFields; onChange: (v: TimeFields) => void }) {
  const mRef = useRef<HTMLInputElement>(null);
  const sRef = useRef<HTMLInputElement>(null);

  function handleChange(field: keyof TimeFields, raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const next = { ...value, [field]: digits };
    onChange(next);
    if (digits.length === 2) {
      if (field === "h") mRef.current?.focus();
      else if (field === "m") sRef.current?.focus();
    }
  }

  const cls = "h-6 w-7 px-0 text-center text-[12px] tabular-nums";

  return (
    <div className="flex items-center">
      <Input value={value.h} onChange={(e) => handleChange("h", e.target.value)} className={cls} />
      <span className="text-muted-foreground text-[12px] mx-px">:</span>
      <Input ref={mRef} value={value.m} onChange={(e) => handleChange("m", e.target.value)} className={cls} />
      <span className="text-muted-foreground text-[12px] mx-px">:</span>
      <Input ref={sRef} value={value.s} onChange={(e) => handleChange("s", e.target.value)} className={cls} />
    </div>
  );
}

type TimelineEntry =
  | { kind: "clock-in"; time: number; id: string }
  | { kind: "clock-out"; time: number; id: string }
  | { kind: "break"; session: BreakSession }
  | { kind: "pause"; pause: PauseInterval };

function buildTimelineEntries(
  workIntervals: WorkInterval[],
  sessions: BreakSession[],
  pauseIntervals: PauseInterval[],
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

  for (const p of pauseIntervals) {
    entries.push({ kind: "pause", pause: p });
  }

  // Sort newest first
  entries.sort((a, b) => {
    const ta = entryTime(a);
    const tb = entryTime(b);
    return tb - ta;
  });

  return entries;
}

function entryTime(e: TimelineEntry): number {
  if (e.kind === "break") return e.session.startTime;
  if (e.kind === "pause") return e.pause.start;
  return e.time;
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

type CtxMenu = { x: number; y: number; entry: TimelineEntry } | null;

export function HistoryList({ todayOnly = false, filterDate, filterWeekStart }: { todayOnly?: boolean; filterDate?: Date; filterWeekStart?: Date } = {}) {
  const allSessions = useAppStore((s) => s.sessions);
  const allWorkIntervals = useAppStore((s) => s.workIntervals);
  const allPauseIntervals = useAppStore((s) => s.pauseIntervals);
  const removeSession = useAppStore((s) => s.removeSession);
  const removeWorkInterval = useAppStore((s) => s.removeWorkInterval);
  const removePauseInterval = useAppStore((s) => s.removePauseInterval);
  const updateWorkIntervalStart = useAppStore((s) => s.updateWorkIntervalStart);
  const updateWorkIntervalEnd = useAppStore((s) => s.updateWorkIntervalEnd);
  const updateSession = useAppStore((s) => s.updateSession);
  const updatePauseInterval = useAppStore((s) => s.updatePauseInterval);
  const { formatCurrency } = useCurrency();
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [editing, setEditing] = useState<{
    entry: TimelineEntry;
    time: TimeFields;
    endTime: TimeFields;
  } | null>(null);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => closeCtxMenu();
    window.addEventListener("click", handler);
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("contextmenu", handler);
    };
  }, [ctxMenu, closeCtxMenu]);

  function handleContextMenu(e: React.MouseEvent, entry: TimelineEntry) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  }

  function handleDelete() {
    if (!ctxMenu) return;
    const { entry } = ctxMenu;
    if (entry.kind === "break") {
      removeSession(entry.session.id);
    } else if (entry.kind === "pause") {
      removePauseInterval(entry.pause.start);
    } else {
      // clock-in and clock-out both belong to the same WorkInterval
      const start = entry.kind === "clock-in" ? entry.time : allWorkIntervals.find((iv) => iv.end === entry.time)?.start;
      if (start != null) removeWorkInterval(start);
    }
    closeCtxMenu();
  }

  function handleEdit() {
    if (!ctxMenu) return;
    const { entry } = ctxMenu;
    const zero: TimeFields = { h: "00", m: "00", s: "00" };
    if (entry.kind === "break") {
      setEditing({
        entry,
        time: tsToFields(entry.session.startTime),
        endTime: tsToFields(entry.session.endTime),
      });
    } else if (entry.kind === "pause") {
      setEditing({
        entry,
        time: tsToFields(entry.pause.start),
        endTime: entry.pause.end ? tsToFields(entry.pause.end) : zero,
      });
    } else {
      setEditing({
        entry,
        time: tsToFields(entry.time),
        endTime: zero,
      });
    }
    closeCtxMenu();
  }

  function handleEditConfirm() {
    if (!editing) return;
    const { entry, time, endTime } = editing;
    if (entry.kind === "clock-in") {
      updateWorkIntervalStart(entry.time, fieldsToTs(time, entry.time));
    } else if (entry.kind === "clock-out") {
      updateWorkIntervalEnd(entry.time, fieldsToTs(time, entry.time));
    } else if (entry.kind === "pause") {
      const newEnd = entry.pause.end ? fieldsToTs(endTime, entry.pause.end) : null;
      updatePauseInterval(entry.pause.start, fieldsToTs(time, entry.pause.start), newEnd);
    } else {
      updateSession(
        entry.session.id,
        fieldsToTs(time, entry.session.startTime),
        fieldsToTs(endTime, entry.session.endTime),
      );
    }
    setEditing(null);
  }

  const groupedByDay = useMemo((): DayGroup[] => {
    const today = new Date();
    const refDate = filterDate ?? (todayOnly ? today : null);

    let sessions: BreakSession[];
    let workIntervals: WorkInterval[];
    let pauseIntervals: PauseInterval[];

    if (refDate) {
      sessions = allSessions.filter((s) => isSameDay(s.startTime, refDate));
      workIntervals = allWorkIntervals.filter((iv) => isSameDay(iv.start, refDate));
      pauseIntervals = allPauseIntervals.filter((iv) => isSameDay(iv.start, refDate));
    } else if (filterWeekStart) {
      const weekEnd = new Date(filterWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const start = filterWeekStart.getTime();
      const end = weekEnd.getTime();
      sessions = allSessions.filter((s) => s.startTime >= start && s.startTime < end);
      workIntervals = allWorkIntervals.filter((iv) => iv.start >= start && iv.start < end);
      pauseIntervals = allPauseIntervals.filter((iv) => iv.start >= start && iv.start < end);
    } else {
      sessions = allSessions;
      workIntervals = allWorkIntervals;
      pauseIntervals = allPauseIntervals;
    }

    const entries = buildTimelineEntries(workIntervals, sessions, pauseIntervals);
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
  }, [allSessions, allWorkIntervals, allPauseIntervals, todayOnly, filterDate, filterWeekStart]);

  if (allSessions.length === 0 && allWorkIntervals.length === 0) {
    return (
      <div className="flex-1 min-h-0">
        <p className="text-center text-[11px] text-muted-foreground py-5">
          Lock your screen to start tracking breaks.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {groupedByDay.map((group, groupIdx) => (
          <div key={group.date}>
            {groupIdx > 0 && <div className="h-px bg-border mx-4" />}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {group.date}
                </span>
                {group.breakTotal > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-600">
                    {formatCurrency(group.breakTotal)}
                  </span>
                )}
              </div>
              {group.entries.map((entry) => {
                if (entry.kind === "clock-in") {
                  const isEditing = editing?.entry.kind === "clock-in" && editing.entry.id === entry.id;
                  return (
                    <div
                      key={entry.id}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                      className="flex items-center gap-1.5 py-1 text-[12px] text-blue-600 dark:text-blue-400 cursor-default"
                    >
                      <LogIn className="size-3" />
                      {isEditing ? (
                        <>
                          <TimeInput value={editing.time} onChange={(v) => setEditing({ ...editing, time: v })} />
                          <button onClick={handleEditConfirm} className="text-emerald-600 hover:text-emerald-500"><Check className="size-3" /></button>
                          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
                        </>
                      ) : (
                        <>
                          <span>{formatTimeSec(entry.time)}</span>
                          <span className="text-muted-foreground">Clock In</span>
                        </>
                      )}
                    </div>
                  );
                }

                if (entry.kind === "clock-out") {
                  const isEditing = editing?.entry.kind === "clock-out" && editing.entry.id === entry.id;
                  return (
                    <div
                      key={entry.id}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                      className="flex items-center gap-1.5 py-1 text-[12px] text-orange-600 dark:text-orange-400 cursor-default"
                    >
                      <LogOut className="size-3" />
                      {isEditing ? (
                        <>
                          <TimeInput value={editing.time} onChange={(v) => setEditing({ ...editing, time: v })} />
                          <button onClick={handleEditConfirm} className="text-emerald-600 hover:text-emerald-500"><Check className="size-3" /></button>
                          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
                        </>
                      ) : (
                        <>
                          <span>{formatTimeSec(entry.time)}</span>
                          <span className="text-muted-foreground">Clock Out</span>
                        </>
                      )}
                    </div>
                  );
                }

                if (entry.kind === "pause") {
                  const { pause } = entry;
                  const isEditing = editing?.entry.kind === "pause" && editing.entry.pause.start === pause.start;
                  const isOngoing = pause.end === null;
                  let duration: string | null = null;
                  if (!isOngoing && pause.end !== null) {
                    const totalSec = Math.round((pause.end - pause.start) / 1000);
                    const m = Math.floor(totalSec / 60);
                    const s = totalSec % 60;
                    duration = m > 0 ? `${m}m ${s}s` : `${s}s`;
                  }

                  return (
                    <div
                      key={`pause-${pause.start}`}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                      className="flex items-center justify-between py-1 text-[12px] cursor-default"
                    >
                      {isEditing ? (
                        <>
                          <div className="flex items-center gap-1">
                            <TimeInput value={editing.time} onChange={(v) => setEditing({ ...editing, time: v })} />
                            <span className="text-muted-foreground">–</span>
                            <TimeInput value={editing.endTime} onChange={(v) => setEditing({ ...editing, endTime: v })} />
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={handleEditConfirm} className="text-emerald-600 hover:text-emerald-500"><Check className="size-3" /></button>
                            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
                          </div>
                        </>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <Presentation className="size-3" />
                          {formatTimeSec(pause.start)}{duration && <>&nbsp;&middot; {duration}</>}
                          {isOngoing && (
                            <span className="text-[10px] px-1 py-px rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600/70 leading-none">
                              ongoing
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                }

                const { session } = entry;
                const isEditing = editing?.entry.kind === "break" && editing.entry.session.id === session.id;
                const totalSec = Math.round(
                  (session.endTime - session.startTime) / 1000,
                );
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                const duration = m > 0 ? `${m}m ${s}s` : `${s}s`;

                const reasonLabel: Record<string, string> = {
                  manual: "manual",
                  "screen-lock": "lock",
                  idle: "idle",
                  custom: "custom",
                };
                const label = session.reason ? reasonLabel[session.reason] : null;

                return (
                  <div
                    key={session.id}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    className="flex items-center justify-between py-1 text-[12px] cursor-default"
                  >
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-1">
                          <TimeInput value={editing.time} onChange={(v) => setEditing({ ...editing, time: v })} />
                          <span className="text-muted-foreground">–</span>
                          <TimeInput value={editing.endTime} onChange={(v) => setEditing({ ...editing, endTime: v })} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={handleEditConfirm} className="text-emerald-600 hover:text-emerald-500"><Check className="size-3" /></button>
                          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          {formatTimeSec(session.startTime)} &middot; {duration}
                          {label && (
                            <span className="text-[10px] px-1 py-px rounded bg-muted text-muted-foreground/70 leading-none">
                              {label}
                            </span>
                          )}
                        </span>
                        <span className="text-foreground/80">
                          {formatCurrency(session.earnings)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[100px] rounded-md border bg-popover shadow-md py-1"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            onClick={handleEdit}
            className="w-full px-3 py-1 text-left text-[12px] hover:bg-accent cursor-default"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1 text-left text-[12px] text-destructive hover:bg-accent cursor-default"
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}
