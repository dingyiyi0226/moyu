import { useAppStore, perSecondRate } from "@/store/appStore";

export function useSalaryCalc() {
  const salary = useAppStore((s) => s.salary);
  const schedule = useAppStore((s) => s.schedule);
  const rate = perSecondRate(salary, schedule);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: salary.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatRate = (perSec: number): string => {
    return `${formatCurrency(perSec)}/sec`;
  };

  return { rate, formatCurrency, formatRate };
}
