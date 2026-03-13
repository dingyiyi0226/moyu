import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useSystemEvents } from "@/hooks/useSystemEvents";
import { BreakView } from "@/components/BreakView";
import { WorkingView } from "@/components/WorkingView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HistoryList } from "@/components/HistoryList";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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
    <div className="w-[320px] p-4">
      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold">Moyu</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </Button>
          </div>

          {salary.amount === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No salary configured</p>
              <Button onClick={() => setShowSettings(true)}>Set Salary</Button>
            </div>
          ) : isOnBreak ? (
            <BreakView />
          ) : (
            <WorkingView />
          )}

          <Separator className="my-4" />
          <HistoryList />
        </>
      )}
    </div>
  );
}

export default App;
