import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, isCurrentlyWorking, type BreakReason } from "@/store/appStore";

interface BreakStartPayload {
  ts: number;
  reason: BreakReason;
}

export function useSystemEvents() {
  const setBreakStarted = useAppStore((s) => s.setBreakStarted);
  const setBreakEnded = useAppStore((s) => s.setBreakEnded);
  const schedule = useAppStore((s) => s.schedule);
  const workIntervals = useAppStore((s) => s.workIntervals);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const unlisten1 = await listen<BreakStartPayload>("break:started", (event) => {
        if (isCurrentlyWorking(workIntervals, schedule)) {
          setBreakStarted(event.payload.ts, event.payload.reason);
        }
      });
      unlisteners.push(unlisten1);

      const unlisten2 = await listen<number>("break:ended", (event) => {
        setBreakEnded(event.payload);
      });
      unlisteners.push(unlisten2);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [setBreakStarted, setBreakEnded, schedule, workIntervals]);
}
