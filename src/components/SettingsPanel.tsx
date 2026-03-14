import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import {
  useAppStore,
  DEFAULT_SCHEDULE,
  type SalaryPeriod,
  type DaySchedule,
} from "@/store/appStore";

const periods: { value: SalaryPeriod; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const selectClass =
  "h-7 rounded-md border border-input bg-transparent px-1 text-xs outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 appearance-none text-center";

export function SettingsPanel() {
  const salary = useAppStore((s) => s.salary);
  const setSalary = useAppStore((s) => s.setSalary);
  const schedule = useAppStore((s) => s.schedule);
  const setSchedule = useAppStore((s) => s.setSchedule);

  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState<Record<number, DaySchedule>>(() => ({
    ...DEFAULT_SCHEDULE.days,
    ...schedule.days,
  }));

  const handleAmountChange = (value: string) => {
    const numAmount = parseFloat(value) || 0;
    setSalary({ amount: numAmount, period: salary.period });
  };

  const handlePeriodChange = (period: SalaryPeriod) => {
    setSalary({ amount: salary.amount, period });
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
          defaultValue={salary.amount || ""}
          onChange={(e) => handleAmountChange(e.target.value)}
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
              onClick={() => handlePeriodChange(p.value)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                salary.period === p.value
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

      {/* ── Work Schedule ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Work Schedule
          </label>
          {editing ? (
            <button
              onClick={saveSchedule}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Save"
            >
              <Check className="size-3.5" />
            </button>
          ) : (
            <button
              onClick={startEditing}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                    className={`w-10 shrink-0 rounded-md py-1 text-[11px] font-medium transition-all ${
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
                      {formatTime(day.startMinute)} – {formatTime(day.endMinute)}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground/40 italic">Off</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
