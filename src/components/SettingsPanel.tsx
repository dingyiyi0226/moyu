import { useState } from "react";
import { useAppStore, type SalaryPeriod } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Settings</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Back
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="salary">Salary Amount</Label>
        <Input
          id="salary"
          type="number"
          placeholder="e.g. 100000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Pay Period</Label>
        <div className="flex gap-2">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.value)}
              className="flex-1"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={handleSave}>
        Save
      </Button>
    </div>
  );
}
