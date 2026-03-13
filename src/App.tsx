import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useSystemEvents } from "@/hooks/useSystemEvents";
import { BreakView } from "@/components/BreakView";
import { WorkingView } from "@/components/WorkingView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HistoryList } from "@/components/HistoryList";
import { Settings, ChevronLeft } from "lucide-react";

function App() {
  const loadFromDisk = useAppStore((s) => s.loadFromDisk);
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const salary = useAppStore((s) => s.salary);
  const [showSettings, setShowSettings] = useState(false);

  useSystemEvents();

  useEffect(() => {
    loadFromDisk();
  }, [loadFromDisk]);

  return (
    <div className="w-[320px] min-h-0 select-none">
      {showSettings ? (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => setShowSettings(false)}
              className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
              Back
            </button>
          </div>
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h1 className="text-[13px] font-semibold tracking-tight text-foreground/80">
              Moyu
            </h1>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="size-3.5" />
            </button>
          </div>

          <div className="px-4 pb-4">
            {salary.amount === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground mb-3">
                  No salary configured
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-sm font-medium text-foreground hover:text-foreground/70 underline underline-offset-4 transition-colors"
                >
                  Set up salary
                </button>
              </div>
            ) : isOnBreak ? (
              <BreakView />
            ) : (
              <WorkingView />
            )}
          </div>

          <div className="h-px bg-border mx-4" />
          <HistoryList />
        </>
      )}
    </div>
  );
}

export default App;
