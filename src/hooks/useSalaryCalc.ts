import { useAppStore, perSecondRate } from "@/store/appStore";

export function useSalaryCalc() {
  const salary = useAppStore((s) => s.salary);
  const rate = perSecondRate(salary);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatRate = (perSec: number): string => {
    return `${formatCurrency(perSec)}/sec`;
  };

  return { rate, formatCurrency, formatRate };
}
