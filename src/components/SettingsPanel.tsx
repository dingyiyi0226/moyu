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

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const salary = useAppStore((s) => s.salary);
  const setSalary = useAppStore((s) => s.setSalary);

  const [amount, setAmount] = useState(String(salary.amount || ""));
  const [period, setPeriod] = useState<SalaryPeriod>(salary.period);

  const handleSave = () => {
    const numAmount = parseFloat(amount) || 0;
    setSalary({ amount: numAmount, period });
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

      <button
        onClick={handleSave}
        className="w-full h-9 rounded-lg bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90"
      >
        Save
      </button>
    </div>
  );
}
