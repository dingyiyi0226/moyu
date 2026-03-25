import { useRef } from "react";
import { Input } from "@/components/ui/input";

export interface TimeFields {
  h: string;
  m: string;
  s?: string;
}

interface TimeInputProps {
  value: TimeFields;
  onChange: (v: TimeFields) => void;
  /** Show seconds field (default: true) */
  showSeconds?: boolean;
  className?: string;
}

export function TimeInput({
  value,
  onChange,
  showSeconds = true,
  className,
}: TimeInputProps) {
  const mRef = useRef<HTMLInputElement>(null);
  const sRef = useRef<HTMLInputElement>(null);

  function handleChange(field: keyof TimeFields, raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const next = { ...value, [field]: digits };
    onChange(next);
    if (digits.length === 2) {
      if (field === "h") mRef.current?.focus();
      else if (field === "m" && showSeconds) sRef.current?.focus();
    }
  }

  const cls = "h-6 w-7 px-0 text-center text-[12px] tabular-nums";

  return (
    <div className={`flex items-center ${className ?? ""}`}>
      <Input
        value={value.h}
        onChange={(e) => handleChange("h", e.target.value)}
        className={cls}
      />
      <span className="text-muted-foreground text-[12px] mx-px">:</span>
      <Input
        ref={mRef}
        value={value.m}
        onChange={(e) => handleChange("m", e.target.value)}
        className={cls}
      />
      {showSeconds && (
        <>
          <span className="text-muted-foreground text-[12px] mx-px">:</span>
          <Input
            ref={sRef}
            value={value.s ?? "00"}
            onChange={(e) => handleChange("s", e.target.value)}
            className={cls}
          />
        </>
      )}
    </div>
  );
}
