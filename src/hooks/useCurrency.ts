import { useAppStore } from "@/store/appStore";

export function useCurrency() {
  const currency = useAppStore((s) => s.salary.currency);

  const formatCurrency = (amount: number, maxFractionDigits = 2): string => {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits,
    }).formatToParts(amount);
    return parts.map((p) => (p.type === "currency" ? p.value + " " : p.value)).join("");
  };

  return { formatCurrency };
}
