import { useState, useMemo } from "react";
import { Pencil, Check } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { perSecondRate, weeklyWorkHours, DEFAULT_SCHEDULE } from "@/lib/scheduleUtils";
import {
  useAppStore,
  CURRENCIES,
  type Currency,
  type SalaryPeriod,
  type DaySchedule,
} from "@/store/appStore";
import { formatMinutes } from "@/lib/timeUtils";

const periods: { value: SalaryPeriod; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


const selectClass =
  "h-7 rounded-md border border-input bg-transparent px-1 text-xs outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 appearance-none text-center";

export function SettingsPanel() {
  const salary = useAppStore((s) => s.salary);
  const { formatCurrency } = useCurrency();
  const setSalary = useAppStore((s) => s.setSalary);
  const schedule = useAppStore((s) => s.schedule);
  const setSchedule = useAppStore((s) => s.setSchedule);
  const storeIdleTimeoutSec = useAppStore((s) => s.idleTimeoutSec);
  const setIdleTimeoutSec = useAppStore((s) => s.setIdleTimeoutSec);
  const [idleInputValue, setIdleInputValue] = useState(storeIdleTimeoutSec);

  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState<Record<number, DaySchedule>>(() => ({
    ...DEFAULT_SCHEDULE.days,
    ...schedule.days,
  }));

  const preview = useMemo(() => {
    const rate = perSecondRate(salary, schedule);
    const hoursPerWeek = weeklyWorkHours(schedule);
    const totalSecondsPerYear = hoursPerWeek * 52 * 3600;
    const workDaysPerWeek = Object.values(schedule.days).filter((d) => d.enabled).length;
    const avgDailyHours = workDaysPerWeek > 0 ? hoursPerWeek / workDaysPerWeek : 0;
    return {
      annual: rate * totalSecondsPerYear,
      monthly: (rate * totalSecondsPerYear) / 12,
      daily: rate * avgDailyHours * 3600,
      hourly: rate * 3600,
      perSecond: rate,
    };
  }, [salary, schedule]);

  const handleAmountChange = (value: string) => {
    const numAmount = parseFloat(value) || 0;
    setSalary({ ...salary, amount: numAmount });
  };

  const handlePeriodChange = (period: SalaryPeriod) => {
    setSalary({ ...salary, period });
  };

  const handleCurrencyChange = (currency: Currency) => {
    setSalary({ ...salary, currency });
  };

  const toggleDay = (day: number) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const updateDayTime = (
    day: number,
    field: "startMinute" | "endMinute",
    value: number,
  ) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const startEditing = () => {
    setDays({ ...DEFAULT_SCHEDULE.days, ...schedule.days });
    setEditing(true);
  };

  const saveSchedule = () => {
    setSchedule({ days });
    setEditing(false);
  };

  return (
    <div className="space-y-5">
      {/* ── Salary ─────────────────────────────────────────── */}
      {/* Row 1: Large annual salary */}
      <div className="text-center">
        <div className="text-2xl font-semibold">
          {formatCurrency(preview.annual, 0)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">annual salary</div>
      </div>

      {/* Rows 2+3: monthly/hourly | daily/per-second */}
      <div className="flex justify-center gap-5">
        <div className="grid grid-cols-[auto_auto] items-baseline gap-x-1 gap-y-0.5">
          <span className="text-xs font-medium text-right">{formatCurrency(preview.monthly, 0)}</span>
          <span className="text-[10px] text-muted-foreground">/ month</span>
          <span className="text-xs font-medium text-right">{formatCurrency(preview.hourly, 0)}</span>
          <span className="text-[10px] text-muted-foreground">/ hour</span>
        </div>
        <div className="grid grid-cols-[auto_auto] items-baseline gap-x-1 gap-y-0.5">
          <span className="text-xs font-medium text-right">{formatCurrency(preview.daily, 0)}</span>
          <span className="text-[10px] text-muted-foreground">/ day</span>
          <span className="text-xs font-medium text-right">{formatCurrency(preview.perSecond)}</span>
          <span className="text-[10px] text-muted-foreground">/ second</span>
        </div>
      </div>

      {/* Row 3: Input + currency + period */}
      <div className="flex items-center justify-center gap-2">
        <input
          id="salary"
          type="number"
          placeholder="100000"
          defaultValue={salary.amount || ""}
          onChange={(e) => handleAmountChange(e.target.value)}
          className="w-24 shrink-0 h-9 rounded-sm  border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
        />
        <select
          value={salary.currency}
          onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
          className="h-9 rounded-sm border border-input bg-transparent px-2 text-sm outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={salary.period}
          onChange={(e) => handlePeriodChange(e.target.value as SalaryPeriod)}
          className="h-9 rounded-sm border border-input bg-transparent px-2 text-sm outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="h-px bg-border" />

      {/* ── Work Schedule ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Work Schedule
          </label>
          {editing ? (
            <button
              onClick={saveSchedule}
              className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Save"
            >
              <Check className="size-3.5" />
            </button>
          ) : (
            <button
              onClick={startEditing}
              className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {DAY_LABELS.map((label, idx) => {
            const day = editing ? days[idx] : schedule.days[idx];
            if (!day) return null;

            return (
              <div key={idx} className="flex items-center gap-2">
                {/* Day label / toggle */}
                {editing ? (
                  <button
                    onClick={() => toggleDay(idx)}
                    className={`w-10 shrink-0 rounded-sm py-1 text-[11px] font-medium transition-all ${
                      day.enabled
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ) : (
                  <span
                    className={`w-10 shrink-0 text-[11px] font-medium ${
                      day.enabled ? "text-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    {label}
                  </span>
                )}

                {/* Time display / editors */}
                {day.enabled ? (
                  editing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <select
                        value={Math.floor(day.startMinute / 60)}
                        onChange={(e) => {
                          const h = Number(e.target.value);
                          updateDayTime(idx, "startMinute", h * 60 + (day.startMinute % 60));
                        }}
                        className={selectClass}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {String(i).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">:</span>
                      <select
                        value={day.startMinute % 60}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          updateDayTime(idx, "startMinute", Math.floor(day.startMinute / 60) * 60 + m);
                        }}
                        className={selectClass}
                      >
                        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                          <option key={m} value={m}>
                            {String(m).padStart(2, "0")}
                          </option>
                        ))}
                      </select>

                      <span className="text-[10px] text-muted-foreground mx-0.5">–</span>

                      <select
                        value={Math.floor(day.endMinute / 60)}
                        onChange={(e) => {
                          const h = Number(e.target.value);
                          updateDayTime(idx, "endMinute", h * 60 + (day.endMinute % 60));
                        }}
                        className={selectClass}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {String(i).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">:</span>
                      <select
                        value={day.endMinute % 60}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          updateDayTime(idx, "endMinute", Math.floor(day.endMinute / 60) * 60 + m);
                        }}
                        className={selectClass}
                      >
                        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                          <option key={m} value={m}>
                            {String(m).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatMinutes(day.startMinute)} – {formatMinutes(day.endMinute)}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground/40">
                    {formatMinutes(day.startMinute)} – {formatMinutes(day.endMinute)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* ── Idle Detection ─────────────────────────────────── */}
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Idle Timeout
        </label>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            value={idleInputValue}
            onChange={(e) => {
              const val = Number(e.target.value);
              setIdleInputValue(val);
              if (val >= 10 && val <= 3600) {
                setIdleTimeoutSec(val);
              }
            }}
            className={`w-10 h-7 rounded-sm border px-1 text-xs outline-none transition-colors focus:ring-1 focus:ring-foreground/10 text-center bg-transparent ${
              idleInputValue >= 10 && idleInputValue <= 3600
                ? "border-input focus:border-foreground/30"
                : "border-red-500 text-red-400"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {idleInputValue >= 10 && idleInputValue <= 3600
              ? "seconds without input starts a break"
              : "must be between 10 and 3600"}
          </span>
        </div>
      </div>
    </div>
  );
}
