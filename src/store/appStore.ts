import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

export type SalaryPeriod = "annual" | "monthly" | "hourly";

export interface SalaryConfig {
  amount: number;
  period: SalaryPeriod;
}

export interface WorkSchedule {
  workDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export const DEFAULT_SCHEDULE: WorkSchedule = {
  workDays: [1, 2, 3, 4, 5], // Mon-Fri
  startHour: 9,
  endHour: 18,
};

export interface BreakSession {
  id: string;
  startTime: number; // Unix timestamp ms
  endTime: number;
  earnings: number;
}

export interface AppState {
  salary: SalaryConfig;
  setSalary: (salary: SalaryConfig) => void;

  schedule: WorkSchedule;
  setSchedule: (schedule: WorkSchedule) => void;

  clockedInAt: number | null; // Unix timestamp ms, first clock-in of the day
  clockedOutAt: number | null; // Unix timestamp ms, last clock-out of the day
  clockIn: (at?: number) => void;
  clockOut: (at?: number) => void;

  isOnBreak: boolean;
  currentBreakStart: number | null;
  currentEarnings: number;
  setBreakStarted: (timestamp: number) => void;
  setBreakEnded: (timestamp: number) => void;
  updateCurrentEarnings: (earnings: number) => void;

  sessions: BreakSession[];
  addSession: (session: BreakSession) => void;

  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
}

export function perSecondRate(salary: SalaryConfig, schedule?: WorkSchedule): number {
  const { amount, period } = salary;
  const s = schedule ?? DEFAULT_SCHEDULE;
  const hoursPerDay = s.endHour - s.startHour;
  const workDaysPerYear = s.workDays.length * 52;
  switch (period) {
    case "annual":
      return amount / (workDaysPerYear * hoursPerDay * 3600);
    case "monthly":
      return (amount * 12) / (workDaysPerYear * hoursPerDay * 3600);
    case "hourly":
      return amount / 3600;
  }
}

export function isWithinWorkSchedule(schedule: WorkSchedule): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return schedule.workDays.includes(day) && hour >= schedule.startHour && hour < schedule.endHour;
}

/** Returns true if the user is currently working: clocked in (and not yet clocked out), or within schedule. */
export function isCurrentlyWorking(
  clockedInAt: number | null,
  clockedOutAt: number | null,
  schedule: WorkSchedule,
): boolean {
  if (clockedInAt !== null && clockedOutAt === null) return true;
  if (clockedInAt === null) return isWithinWorkSchedule(schedule);
  return false; // clocked in and clocked out = done for the day
}

const STORE_FILE = "moyu-data.json";

export const useAppStore = create<AppState>((set, get) => ({
  salary: { amount: 0, period: "annual" },
  schedule: DEFAULT_SCHEDULE,
  clockedInAt: null,
  clockedOutAt: null,
  isOnBreak: false,
  currentBreakStart: null,
  currentEarnings: 0,
  sessions: [],

  setSalary: (salary) => {
    set({ salary });
    get().saveToDisk();
  },

  setSchedule: (schedule) => {
    set({ schedule });
    get().saveToDisk();
  },

  clockIn: (at?: number) => {
    const state = get();
    const ts = at ?? Date.now();
    // Keep the first clock-in of the day
    if (state.clockedInAt === null) {
      set({ clockedInAt: ts, clockedOutAt: null });
      get().saveToDisk();
    }
  },

  clockOut: (at?: number) => {
    const ts = at ?? Date.now();
    // Always update to the latest clock-out
    set({ clockedOutAt: ts });
    get().saveToDisk();
  },

  setBreakStarted: (timestamp) => {
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

  loadFromDisk: async () => {
    try {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      const salary = await store.get<SalaryConfig>("salary");
      const sessions = await store.get<BreakSession[]>("sessions");
      const schedule = await store.get<WorkSchedule>("schedule");
      const clockedInAt = await store.get<number | null>("clockedInAt");
      const clockedOutAt = await store.get<number | null>("clockedOutAt");
      set({
        salary: salary ?? { amount: 0, period: "annual" },
        sessions: sessions ?? [],
        schedule: schedule ?? DEFAULT_SCHEDULE,
        clockedInAt: clockedInAt ?? null,
        clockedOutAt: clockedOutAt ?? null,
      });
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
      await store.set("clockedInAt", state.clockedInAt);
      await store.set("clockedOutAt", state.clockedOutAt);
      await store.save();
    } catch (e) {
      console.error("Failed to save store:", e);
    }
  },
}));
