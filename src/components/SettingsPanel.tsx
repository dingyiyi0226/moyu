import { useState } from "react";
import {
  useAppStore,
  DEFAULT_SCHEDULE,
  type SalaryPeriod,
  type DaySchedule,
} from "@/store/appStore";

interface SettingsPanelProps {
  onClose: () => void;
}

const periods: { value: SalaryPeriod; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const selectClass =
  "h-7 rounded-md border border-input bg-transparent px-1 text-xs outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 appearance-none text-center";

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const salary = useAppStore((s) => s.salary);
  const setSalary = useAppStore((s) => s.setSalary);
  const schedule = useAppStore((s) => s.schedule);
  const setSchedule = useAppStore((s) => s.setSchedule);

  const [amount, setAmount] = useState(String(salary.amount || ""));
  const [period, setPeriod] = useState<SalaryPeriod>(salary.period);
  const [days, setDays] = useState<Record<number, DaySchedule>>(() => ({
    ...DEFAULT_SCHEDULE.days,
    ...schedule.days,
  }));

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

  const handleSave = () => {
    const numAmount = parseFloat(amount) || 0;
    setSalary({ amount: numAmount, period });
    setSchedule({ days });
    onClose();
  };

  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="salary"
          className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Salary Amount
        </label>
        <input
          id="salary"
          type="number"
          placeholder="e.g. 100000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Pay Period
        </label>
        <div className="flex rounded-lg bg-muted p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* ── Work Schedule (per-day) ────────────────────────── */}
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Work Schedule
        </label>
        <div className="space-y-1.5">
          {DAY_LABELS.map((label, idx) => {
            const day = days[idx];
            return (
              <div key={idx} className="flex items-center gap-2">
                {/* Day toggle */}
                <button
                  onClick={() => toggleDay(idx)}
                  className={`w-10 shrink-0 rounded-md py-1 text-[11px] font-medium transition-all ${
                    day.enabled
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>

                {day.enabled ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {/* Start hour */}
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
                    {/* Start minute */}
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

                    {/* End hour */}
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
                    {/* End minute */}
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
                  <span className="text-xs text-muted-foreground italic">Off</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full h-9 rounded-lg bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90"
      >
        Save
      </button>
    </div>
  );
}
