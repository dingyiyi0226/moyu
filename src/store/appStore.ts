import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { getDateKey } from "@/lib/timeUtils";
import { DEFAULT_SCHEDULE, perSecondRate } from "@/lib/scheduleUtils";

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

export type BreakReason = "manual" | "screen-lock" | "idle" | "custom";

export interface BreakSession {
  id: string;
  startTime: number; // Unix timestamp ms
  endTime: number;
  earnings: number;
  reason?: BreakReason;
}

export interface WorkInterval {
  start: number; // Unix timestamp ms
  end: number | null; // null = currently clocked in
}

export interface PauseInterval {
  start: number; // Unix timestamp ms
  end: number | null; // null = currently paused
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

  pauseIntervals: PauseInterval[];
  startPause: () => void;
  endPause: () => void;
  removePauseInterval: (start: number) => void;
  updatePauseInterval: (oldStart: number, newStart: number, newEnd: number | null) => void;

  isOnBreak: boolean;
  currentBreakStart: number | null;
  currentBreakReason: BreakReason | null;
  currentEarnings: number;
  setBreakStarted: (timestamp: number, reason?: BreakReason) => void;
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

const STORE_FILE = "moyu-data.json";
const DB_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(saveFn: () => Promise<void>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveFn();
  }, SAVE_DEBOUNCE_MS);
}

export const useAppStore = create<AppState>((set, get) => ({
  salary: { amount: 0, period: "annual", currency: "USD" },
  schedule: DEFAULT_SCHEDULE,
  dailySchedules: {},
  workIntervals: [],
  pauseIntervals: [],
  isOnBreak: false,
  currentBreakStart: null,
  currentBreakReason: null,
  currentEarnings: 0,
  sessions: [],
  idleTimeoutSec: 60,

  setSalary: (salary) => {
    set({ salary });
    debouncedSave(() => get().saveToDisk());
  },

  setSchedule: (schedule) => {
    set({ schedule });
    debouncedSave(() => get().saveToDisk());
  },

  setIdleTimeoutSec: (sec) => {
    set({ idleTimeoutSec: sec });
    invoke("set_idle_timeout", { seconds: sec });
    debouncedSave(() => get().saveToDisk());
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
      invoke("set_clocked_in", { clocked: true });
      debouncedSave(() => get().saveToDisk());
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
      // Also end any active pause
      const pauses = state.pauseIntervals;
      const pauseUpdates: Partial<AppState> = {};
      if (pauses.length > 0 && pauses[pauses.length - 1].end === null) {
        const updatedPauses = [...pauses];
        updatedPauses[updatedPauses.length - 1] = { ...updatedPauses[updatedPauses.length - 1], end: ts };
        pauseUpdates.pauseIntervals = updatedPauses;
      }
      set({ workIntervals: updated, ...pauseUpdates });
      invoke("set_clocked_in", { clocked: false });
      debouncedSave(() => get().saveToDisk());
    }
  },

  startPause: () => {
    const state = get();
    const pauses = state.pauseIntervals;
    const isPaused = pauses.length > 0 && pauses[pauses.length - 1].end === null;
    if (isPaused) return;
    set({ pauseIntervals: [...pauses, { start: Date.now(), end: null }] });
    debouncedSave(() => get().saveToDisk());
  },

  endPause: () => {
    const pauses = get().pauseIntervals;
    if (pauses.length === 0 || pauses[pauses.length - 1].end !== null) return;
    const updated = [...pauses];
    updated[updated.length - 1] = { ...updated[updated.length - 1], end: Date.now() };
    set({ pauseIntervals: updated });
    debouncedSave(() => get().saveToDisk());
  },

  removePauseInterval: (start) => {
    set((prev) => ({ pauseIntervals: prev.pauseIntervals.filter((iv) => iv.start !== start) }));
    debouncedSave(() => get().saveToDisk());
  },

  updatePauseInterval: (oldStart, newStart, newEnd) => {
    set((prev) => ({
      pauseIntervals: prev.pauseIntervals.map((iv) =>
        iv.start === oldStart ? { ...iv, start: newStart, end: newEnd } : iv,
      ),
    }));
    debouncedSave(() => get().saveToDisk());
  },

  setBreakStarted: (timestamp, reason) => {
    const state = get();
    const pauses = state.pauseIntervals;
    const isPaused = pauses.length > 0 && pauses[pauses.length - 1].end === null;
    if (state.isOnBreak || isPaused) return;
    set({
      isOnBreak: true,
      currentBreakStart: timestamp,
      currentBreakReason: reason ?? "manual",
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
        reason: state.currentBreakReason ?? undefined,
      };
      set((prev) => ({
        isOnBreak: false,
        currentBreakStart: null,
        currentBreakReason: null,
        currentEarnings: 0,
        sessions: [...prev.sessions, session],
      }));
      debouncedSave(() => get().saveToDisk());
    } else {
      set({ isOnBreak: false, currentBreakStart: null, currentBreakReason: null, currentEarnings: 0 });
    }
  },

  updateCurrentEarnings: (earnings) => {
    set({ currentEarnings: earnings });
  },

  addSession: (session) => {
    set((prev) => ({ sessions: [...prev.sessions, session] }));
    debouncedSave(() => get().saveToDisk());
  },

  removeSession: (id) => {
    set((prev) => ({ sessions: prev.sessions.filter((s) => s.id !== id) }));
    debouncedSave(() => get().saveToDisk());
  },

  removeWorkInterval: (start) => {
    set((prev) => ({ workIntervals: prev.workIntervals.filter((iv) => iv.start !== start) }));
    debouncedSave(() => get().saveToDisk());
  },

  updateWorkIntervalStart: (oldStart, newStart) => {
    set((prev) => ({
      workIntervals: prev.workIntervals.map((iv) =>
        iv.start === oldStart ? { ...iv, start: newStart } : iv,
      ),
    }));
    debouncedSave(() => get().saveToDisk());
  },

  updateWorkIntervalEnd: (oldEnd, newEnd) => {
    set((prev) => ({
      workIntervals: prev.workIntervals.map((iv) =>
        iv.end === oldEnd ? { ...iv, end: newEnd } : iv,
      ),
    }));
    debouncedSave(() => get().saveToDisk());
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
    debouncedSave(() => get().saveToDisk());
  },

  setDailySchedule: (dateKey, schedule) => {
    set((prev) => ({ dailySchedules: { ...prev.dailySchedules, [dateKey]: schedule } }));
    debouncedSave(() => get().saveToDisk());
  },

  loadFromDisk: async () => {
    try {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      const rawSalary = await store.get<Partial<SalaryConfig>>("salary");
      const sessions = await store.get<BreakSession[]>("sessions");
      const schedule = await store.get<WorkSchedule>("schedule");
      const workIntervals = await store.get<WorkInterval[]>("workIntervals");
      const pauseIntervals = await store.get<PauseInterval[]>("pauseIntervals");
      const dailySchedules = await store.get<Record<string, DaySchedule>>("dailySchedules");
      const idleTimeoutSec = await store.get<number>("idleTimeoutSec");
      const salary: SalaryConfig = {
        amount: rawSalary?.amount ?? 0,
        period: rawSalary?.period ?? "annual",
        currency: rawSalary?.currency ?? "USD",
      };
      const resolvedIdleTimeout = idleTimeoutSec ?? 60;
      set({
        salary,
        sessions: sessions ?? [],
        schedule: schedule ?? DEFAULT_SCHEDULE,
        dailySchedules: dailySchedules ?? {},
        workIntervals: workIntervals ?? [],
        pauseIntervals: pauseIntervals ?? [],
        idleTimeoutSec: resolvedIdleTimeout,
      });
      invoke("set_idle_timeout", { seconds: resolvedIdleTimeout });
      const intervals = workIntervals ?? [];
      const isClockedIn = intervals.length > 0 && intervals[intervals.length - 1].end === null;
      invoke("set_clocked_in", { clocked: isClockedIn });
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
      await store.set("pauseIntervals", state.pauseIntervals);
      await store.set("idleTimeoutSec", state.idleTimeoutSec);
      await store.set("dbVersion", DB_VERSION);
      await store.save();
    } catch (e) {
      console.error("Failed to save store:", e);
    }
  },
}));
