import { useState } from "react";
import { Check, X } from "lucide-react";

interface RangePickerProps {
  confirmClassName?: string;
  onConfirm: (startH: number, startM: number, endH: number, endM: number) => void;
  onCancel: () => void;
  initialStartH?: number;
  initialStartM?: number;
  initialEndH?: number;
  initialEndM?: number;
}

export function RangePicker({ confirmClassName, onConfirm, onCancel, initialStartH, initialStartM, initialEndH, initialEndM }: RangePickerProps) {
  const now = new Date();
  const [startH, setStartH] = useState(initialStartH ?? now.getHours());
  const [startM, setStartM] = useState(initialStartM ?? 0);
  const [endH, setEndH] = useState(initialEndH ?? now.getHours());
  const [endM, setEndM] = useState(initialEndM ?? now.getMinutes());

  const numInput = (value: number, max: number, onChange: (v: number) => void) => (
    <input
      type="number"
      min={0}
      max={max}
      value={String(value).padStart(2, "0")}
      onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value))))}
      className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
    />
  );

  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        {numInput(startH, 23, setStartH)}
        <span className="text-[11px] text-muted-foreground">:</span>
        {numInput(startM, 59, setStartM)}
        <span className="text-[11px] text-muted-foreground/50">–</span>
        {numInput(endH, 23, setEndH)}
        <span className="text-[11px] text-muted-foreground">:</span>
        {numInput(endM, 59, setEndM)}
        <button
          onClick={() => onConfirm(startH, startM, endH, endM)}
          className={`ml-auto size-6 rounded flex items-center justify-center transition-colors ${confirmClassName ?? "bg-foreground text-background hover:bg-foreground/90"}`}
        >
          <Check className="size-3" />
        </button>
        <button
          onClick={onCancel}
          className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}
