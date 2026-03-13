import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

export type SalaryPeriod = "annual" | "monthly" | "hourly";

export interface SalaryConfig {
  amount: number;
  period: SalaryPeriod;
}

export interface BreakSession {
  id: string;
  startTime: number; // Unix timestamp ms
  endTime: number;
  earnings: number;
}

export interface AppState {
  salary: SalaryConfig;
  setSalary: (salary: SalaryConfig) => void;

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

export function perSecondRate(salary: SalaryConfig): number {
  const { amount, period } = salary;
  switch (period) {
    case "annual":
      return amount / (260 * 8 * 3600);
    case "monthly":
      return (amount * 12) / (260 * 8 * 3600);
    case "hourly":
      return amount / 3600;
  }
}

const STORE_FILE = "moyu-data.json";

export const useAppStore = create<AppState>((set, get) => ({
  salary: { amount: 0, period: "annual" },
  isOnBreak: false,
  currentBreakStart: null,
  currentEarnings: 0,
  sessions: [],

  setSalary: (salary) => {
    set({ salary });
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
      const earnings = durationSec * perSecondRate(state.salary);
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
      const store = await load(STORE_FILE, { autoSave: false });
      const salary = await store.get<SalaryConfig>("salary");
      const sessions = await store.get<BreakSession[]>("sessions");
      set({
        salary: salary ?? { amount: 0, period: "annual" },
        sessions: sessions ?? [],
      });
    } catch (e) {
      console.error("Failed to load store:", e);
    }
  },

  saveToDisk: async () => {
    try {
      const state = get();
      const store = await load(STORE_FILE, { autoSave: false });
      await store.set("salary", state.salary);
      await store.set("sessions", state.sessions);
      await store.save();
    } catch (e) {
      console.error("Failed to save store:", e);
    }
  },
}));
