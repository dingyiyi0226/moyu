import { useState } from "react";
import { useAppStore, type SalaryPeriod } from "@/store/appStore";

interface SettingsPanelProps {
  onClose: () => void;
}

const periods: { value: SalaryPeriod; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const salary = useAppStore((s) => s.salary);
  const setSalary = useAppStore((s) => s.setSalary);
  const schedule = useAppStore((s) => s.schedule);
  const setSchedule = useAppStore((s) => s.setSchedule);

  const [amount, setAmount] = useState(String(salary.amount || ""));
  const [period, setPeriod] = useState<SalaryPeriod>(salary.period);
  const [workDays, setWorkDays] = useState<number[]>(schedule.workDays);
  const [startHour, setStartHour] = useState(schedule.startHour);
  const [endHour, setEndHour] = useState(schedule.endHour);

  const toggleDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount) || 0;
    setSalary({ amount: numAmount, period });
    setSchedule({ workDays, startHour, endHour });
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

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Work Days
        </label>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, idx) => (
            <button
              key={idx}
              onClick={() => toggleDay(idx)}
              className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-all ${
                workDays.includes(idx)
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Work Hours
        </label>
        <div className="flex items-center gap-2">
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="flex-1 h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatHour(i)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">to</span>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="flex-1 h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatHour(i)}
              </option>
            ))}
          </select>
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
