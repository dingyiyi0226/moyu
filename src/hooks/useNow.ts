import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * Returns a Date that refreshes whenever the panel becomes visible.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<void>("panel:shown", () => {
      setNow(new Date());
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  return now;
}
