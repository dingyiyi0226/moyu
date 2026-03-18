import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useSystemEvents } from "@/hooks/useSystemEvents";
import { useTrayTimer } from "@/hooks/useTrayTimer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { DailyTab } from "@/components/DailyTab";
import { WeeklyTab } from "@/components/WeeklyTab";
import { SummaryTab } from "@/components/SummaryTab";
import { Settings, ChevronLeft, Clock, BarChart3, Trophy } from "lucide-react";

type Tab = "daily" | "weekly" | "summary";

const tabBtnClass = (active: boolean) =>
  `flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-colors ${
    active
      ? "text-foreground border-b-2 border-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;

function App() {
  const loadFromDisk = useAppStore((s) => s.loadFromDisk);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<Tab>("daily");
  const [dailyInitialDate, setDailyInitialDate] = useState<Date | null>(null);
  const [dailyKey, setDailyKey] = useState(0);
  useSystemEvents();
  useTrayTimer();

  useEffect(() => {
    loadFromDisk();
  }, [loadFromDisk]);

  return (
    <div className="w-[320px] min-h-0 select-none bg-background rounded-xl overflow-hidden">
      {showSettings ? (
        <div className="pt-4 flex flex-col h-screen">
          <div className="flex items-center gap-2 mb-5 shrink-0 px-4">
            <button
              onClick={() => setShowSettings(false)}
              className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
              Back
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <SettingsPanel />
          </div>
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

          {tab === "daily" ? (
            <DailyTab
              key={dailyKey}
              onOpenSettings={() => setShowSettings(true)}
              initialDate={dailyInitialDate}
            />
          ) : tab === "weekly" ? (
            <WeeklyTab
              onBarClick={(date: Date) => {
                setDailyInitialDate(date);
                setDailyKey((k) => k + 1);
                setTab("daily");
              }}
            />
          ) : (
            <SummaryTab />
          )}

          {/* Tab bar */}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-center gap-4 py-1">
            <button className={tabBtnClass(tab === "daily")} onClick={() => { setDailyInitialDate(null); setTab("daily"); }}>
              <Clock className="size-3" />
              Daily
            </button>
            <button className={tabBtnClass(tab === "weekly")} onClick={() => setTab("weekly")}>
              <BarChart3 className="size-3" />
              Weekly
            </button>
            <button className={tabBtnClass(tab === "summary")} onClick={() => setTab("summary")}>
              <Trophy className="size-3" />
              Summary
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
