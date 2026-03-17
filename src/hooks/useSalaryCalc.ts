import { useAppStore, perSecondRate } from "@/store/appStore";

export function useSalaryCalc() {
  const salary = useAppStore((s) => s.salary);
  const schedule = useAppStore((s) => s.schedule);
  const rate = perSecondRate(salary, schedule);

  const formatCurrency = (amount: number, maxFractionDigits = 2): string => {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: salary.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits,
    }).formatToParts(amount);
    return parts.map((p) => (p.type === "currency" ? p.value + " " : p.value)).join("");
  };

  const formatRate = (perSec: number): string => {
    return `${formatCurrency(perSec)}/sec`;
  };

  return { rate, formatCurrency, formatRate };
}
