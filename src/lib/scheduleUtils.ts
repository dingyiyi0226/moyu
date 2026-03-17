import type { SalaryConfig, WorkSchedule, DaySchedule, WorkInterval } from "@/store/appStore";
import { getDateKey } from "@/lib/timeUtils";

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
