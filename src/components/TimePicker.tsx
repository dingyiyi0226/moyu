import { useState } from "react";

interface TimePickerProps {
  label: string;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

export function TimePicker({ label, onConfirm, onCancel }: TimePickerProps) {
  const now = new Date();
  const [hour, setHour] = useState(now.getHours());
  const [minute, setMinute] = useState(now.getMinutes());

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={23}
        value={String(hour).padStart(2, "0")}
        onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value))))}
        className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
      />
      <span className="text-[11px] text-muted-foreground">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={String(minute).padStart(2, "0")}
        onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value))))}
        className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
      />
      <button
        onClick={() => onConfirm(hour, minute)}
        className="h-6 px-2 rounded text-[10px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
      >
        OK
      </button>
      <button
        onClick={onCancel}
        className="h-6 px-1.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
