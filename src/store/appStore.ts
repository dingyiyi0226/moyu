import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";

export type SalaryPeriod = "annual" | "monthly" | "hourly";

export const CURRENCIES = ["USD", "EUR", "TWD", "GBP", "JPY", "KRW", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface SalaryConfig {
  amount: number;
  period: SalaryPeriod;
  currency: Currency;
}

export interface DaySchedule {
  enabled: boolean;
  startMinute: number; // minutes from midnight, e.g. 540 = 09:00
  endMinute: number; // minutes from midnight, e.g. 1080 = 18:00
}

export interface WorkSchedule {
  days: Record<number, DaySchedule>; // keys 0-6 (0=Sun, 1=Mon, ..., 6=Sat)
}

const defaultDay = (enabled: boolean): DaySchedule => ({
  enabled,
  startMinute: 540, // 09:00
  endMinute: 1080, // 18:00
});

export const DEFAULT_SCHEDULE: WorkSchedule = {
  days: {
    0: defaultDay(false), // Sun
    1: defaultDay(true), // Mon
    2: defaultDay(true), // Tue
    3: defaultDay(true), // Wed
    4: defaultDay(true), // Thu
    5: defaultDay(true), // Fri
    6: defaultDay(false), // Sat
  },
};

export interface BreakSession {
  id: string;
  startTime: number; // Unix timestamp ms
  endTime: number;
  earnings: number;
}

export interface WorkInterval {
  start: number; // Unix timestamp ms
  end: number | null; // null = currently clocked in
}

export interface AppState {
  salary: SalaryConfig;
  setSalary: (salary: SalaryConfig) => void;

  schedule: WorkSchedule;
  setSchedule: (schedule: WorkSchedule) => void;

  /** Per-date schedule snapshots, keyed by "YYYY-MM-DD". */
  dailySchedules: Record<string, DaySchedule>;

  workIntervals: WorkInterval[]; // today's clock-in/out intervals
  clockIn: (at?: number) => void;
  clockOut: (at?: number) => void;

  isOnBreak: boolean;
  currentBreakStart: number | null;
  currentEarnings: number;
  setBreakStarted: (timestamp: number) => void;
  setBreakEnded: (timestamp: number) => void;
  updateCurrentEarnings: (earnings: number) => void;

  idleTimeoutSec: number;
  setIdleTimeoutSec: (sec: number) => void;

  sessions: BreakSession[];
  addSession: (session: BreakSession) => void;
  removeSession: (id: string) => void;
  removeWorkInterval: (start: number) => void;
  updateWorkIntervalStart: (oldStart: number, newStart: number) => void;
  updateWorkIntervalEnd: (oldEnd: number, newEnd: number) => void;
  updateSession: (id: string, startTime: number, endTime: number) => void;
  setDailySchedule: (dateKey: string, schedule: DaySchedule) => void;

  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
}

/** Total work hours per week based on the schedule */
export function weeklyWorkHours(schedule: WorkSchedule): number {
  return Object.values(schedule.days)
    .filter((d) => d.enabled)
    .reduce((sum, d) => sum + (d.endMinute - d.startMinute) / 60, 0);
}

export function perSecondRate(salary: SalaryConfig, schedule?: WorkSchedule): number {
  const { amount, period } = salary;
  const s = schedule ?? DEFAULT_SCHEDULE;
  const hoursPerWeek = weeklyWorkHours(s);
  const hoursPerYear = hoursPerWeek * 52;
  switch (period) {
    case "annual":
      return hoursPerYear > 0 ? amount / (hoursPerYear * 3600) : 0;
    case "monthly":
      return hoursPerYear > 0 ? (amount * 12) / (hoursPerYear * 3600) : 0;
    case "hourly":
      return amount / 3600;
  }
}

export function isWithinWorkSchedule(schedule: WorkSchedule): boolean {
  const now = new Date();
  const day = now.getDay();
  const daySchedule = schedule.days[day];
  if (!daySchedule?.enabled) return false;
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  return minuteOfDay >= daySchedule.startMinute && minuteOfDay < daySchedule.endMinute;
}

/** Returns true if the user is currently working: clocked in (last interval open), or within schedule. */
export function isCurrentlyWorking(
  workIntervals: WorkInterval[],
  schedule: WorkSchedule,
): boolean {
  if (workIntervals.length > 0) {
    return workIntervals[workIntervals.length - 1].end === null;
  }
  return isWithinWorkSchedule(schedule);
}

export function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get the schedule for a specific date: use daily snapshot if available, else fall back to weekday template. */
export function getDayScheduleForDate(
  date: Date,
  schedule: WorkSchedule,
  dailySchedules: Record<string, DaySchedule>,
): DaySchedule {
  const key = getDateKey(date.getTime());
  if (dailySchedules[key]) return dailySchedules[key];
  return schedule.days[date.getDay()] ?? DEFAULT_SCHEDULE.days[date.getDay()];
}

const STORE_FILE = "moyu-data.json";

export const useAppStore = create<AppState>((set, get) => ({
  salary: { amount: 0, period: "annual", currency: "USD" },
  schedule: DEFAULT_SCHEDULE,
  dailySchedules: {},
  workIntervals: [],
  isOnBreak: false,
  currentBreakStart: null,
  currentEarnings: 0,
  sessions: [],
  idleTimeoutSec: 30,

  setSalary: (salary) => {
    set({ salary });
    get().saveToDisk();
  },

  setSchedule: (schedule) => {
    set({ schedule });
    get().saveToDisk();
  },

  setIdleTimeoutSec: (sec) => {
    set({ idleTimeoutSec: sec });
    invoke("set_idle_timeout", { seconds: sec });
    get().saveToDisk();
  },

  clockIn: (at?: number) => {
    const state = get();
    const ts = at ?? Date.now();
    const intervals = state.workIntervals;
    // Only add new interval if not currently clocked in
    if (intervals.length === 0 || intervals[intervals.length - 1].end !== null) {
      const dateKey = getDateKey(ts);
      const updates: Partial<AppState> = {
        workIntervals: [...intervals, { start: ts, end: null }],
      };
      // Snapshot today's schedule on first clock-in
      if (!state.dailySchedules[dateKey]) {
        const day = new Date(ts).getDay();
        const template = state.schedule.days[day] ?? DEFAULT_SCHEDULE.days[day];
        updates.dailySchedules = { ...state.dailySchedules, [dateKey]: { ...template } };
      }
      set(updates);
      get().saveToDisk();
    }
  },

  clockOut: (at?: number) => {
    const state = get();
    const ts = at ?? Date.now();
    const intervals = state.workIntervals;
    // Close the last open interval
    if (intervals.length > 0 && intervals[intervals.length - 1].end === null) {
      const updated = [...intervals];
      updated[updated.length - 1] = { ...updated[updated.length - 1], end: ts };
      set({ workIntervals: updated });
      get().saveToDisk();
    }
  },

  setBreakStarted: (timestamp) => {
    if (get().isOnBreak) return;
    set({
      isOnBreak: true,
      currentBreakStart: timestamp,
      currentEarnings: 0,
    });
  },

  setBreakEnded: (timestamp) => {
    const state = get();
    if (state.currentBreakStart) {
      const durationSec = (timestamp - state.currentBreakStart) / 1000;
      const earnings = durationSec * perSecondRate(state.salary, state.schedule);
      const session: BreakSession = {
        id: `${state.currentBreakStart}-${timestamp}`,
        startTime: state.currentBreakStart,
        endTime: timestamp,
        earnings,
      };
      set((prev) => ({
        isOnBreak: false,
        currentBreakStart: null,
        currentEarnings: 0,
        sessions: [...prev.sessions, session],
      }));
      get().saveToDisk();
    } else {
      set({ isOnBreak: false, currentBreakStart: null, currentEarnings: 0 });
    }
  },

  updateCurrentEarnings: (earnings) => {
    set({ currentEarnings: earnings });
  },

  addSession: (session) => {
    set((prev) => ({ sessions: [...prev.sessions, session] }));
    get().saveToDisk();
  },

  removeSession: (id) => {
    set((prev) => ({ sessions: prev.sessions.filter((s) => s.id !== id) }));
    get().saveToDisk();
  },

  removeWorkInterval: (start) => {
    set((prev) => ({ workIntervals: prev.workIntervals.filter((iv) => iv.start !== start) }));
    get().saveToDisk();
  },

  updateWorkIntervalStart: (oldStart, newStart) => {
    set((prev) => ({
      workIntervals: prev.workIntervals.map((iv) =>
        iv.start === oldStart ? { ...iv, start: newStart } : iv,
      ),
    }));
    get().saveToDisk();
  },

  updateWorkIntervalEnd: (oldEnd, newEnd) => {
    set((prev) => ({
      workIntervals: prev.workIntervals.map((iv) =>
        iv.end === oldEnd ? { ...iv, end: newEnd } : iv,
      ),
    }));
    get().saveToDisk();
  },

  updateSession: (id, startTime, endTime) => {
    const state = get();
    const durationSec = (endTime - startTime) / 1000;
    const earnings = durationSec * perSecondRate(state.salary, state.schedule);
    set((prev) => ({
      sessions: prev.sessions.map((s) =>
        s.id === id ? { ...s, startTime, endTime, earnings } : s,
      ),
    }));
    get().saveToDisk();
  },

  setDailySchedule: (dateKey, schedule) => {
    set((prev) => ({ dailySchedules: { ...prev.dailySchedules, [dateKey]: schedule } }));
    get().saveToDisk();
  },

  loadFromDisk: async () => {
    try {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      const rawSalary = await store.get<Partial<SalaryConfig>>("salary");
      const sessions = await store.get<BreakSession[]>("sessions");
      const schedule = await store.get<WorkSchedule>("schedule");
      const workIntervals = await store.get<WorkInterval[]>("workIntervals");
      const dailySchedules = await store.get<Record<string, DaySchedule>>("dailySchedules");
      const idleTimeoutSec = await store.get<number>("idleTimeoutSec");
      const salary: SalaryConfig = {
        amount: rawSalary?.amount ?? 0,
        period: rawSalary?.period ?? "annual",
        currency: rawSalary?.currency ?? "USD",
      };
      const resolvedIdleTimeout = idleTimeoutSec ?? 30;
      set({
        salary,
        sessions: sessions ?? [],
        schedule: schedule ?? DEFAULT_SCHEDULE,
        dailySchedules: dailySchedules ?? {},
        workIntervals: workIntervals ?? [],
        idleTimeoutSec: resolvedIdleTimeout,
      });
      invoke("set_idle_timeout", { seconds: resolvedIdleTimeout });
    } catch (e) {
      console.error("Failed to load store:", e);
    }
  },

  saveToDisk: async () => {
    try {
      const state = get();
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      await store.set("salary", state.salary);
      await store.set("sessions", state.sessions);
      await store.set("schedule", state.schedule);
      await store.set("dailySchedules", state.dailySchedules);
      await store.set("workIntervals", state.workIntervals);
      await store.set("idleTimeoutSec", state.idleTimeoutSec);
      await store.save();
    } catch (e) {
      console.error("Failed to save store:", e);
    }
  },
}));
