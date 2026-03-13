import { useState } from "react";

interface BreakPickerProps {
  onConfirm: (startH: number, startM: number, endH: number, endM: number) => void;
  onCancel: () => void;
}

export function BreakPicker({ onConfirm, onCancel }: BreakPickerProps) {
  const now = new Date();
  const [startH, setStartH] = useState(now.getHours());
  const [startM, setStartM] = useState(0);
  const [endH, setEndH] = useState(now.getHours());
  const [endM, setEndM] = useState(now.getMinutes());

  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground w-8">From</span>
        <input
          type="number"
          min={0}
          max={23}
          value={String(startH).padStart(2, "0")}
          onChange={(e) => setStartH(Math.min(23, Math.max(0, Number(e.target.value))))}
          className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
        />
        <span className="text-[11px] text-muted-foreground">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={String(startM).padStart(2, "0")}
          onChange={(e) => setStartM(Math.min(59, Math.max(0, Number(e.target.value))))}
          className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground w-8">To</span>
        <input
          type="number"
          min={0}
          max={23}
          value={String(endH).padStart(2, "0")}
          onChange={(e) => setEndH(Math.min(23, Math.max(0, Number(e.target.value))))}
          className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
        />
        <span className="text-[11px] text-muted-foreground">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={String(endM).padStart(2, "0")}
          onChange={(e) => setEndM(Math.min(59, Math.max(0, Number(e.target.value))))}
          className="w-8 h-6 rounded border border-input bg-transparent px-1 text-[11px] text-center tabular-nums outline-none focus:border-foreground/30"
        />
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={() => onConfirm(startH, startM, endH, endM)}
          className="h-6 px-2.5 rounded text-[10px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          Add Break
        </button>
        <button
          onClick={onCancel}
          className="h-6 px-2 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
