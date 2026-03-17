import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, type BreakReason } from "@/store/appStore";

interface BreakStartPayload {
  ts: number;
  reason: BreakReason;
}

export function useSystemEvents() {
  const setBreakStarted = useAppStore((s) => s.setBreakStarted);
  const setBreakEnded = useAppStore((s) => s.setBreakEnded);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const unlisten1 = await listen<BreakStartPayload>("break:started", (event) => {
        setBreakStarted(event.payload.ts, event.payload.reason);
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
  }, [setBreakStarted, setBreakEnded]);
}
