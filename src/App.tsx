import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useSystemEvents } from "@/hooks/useSystemEvents";
import { BreakView } from "@/components/BreakView";
import { WorkingView } from "@/components/WorkingView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HistoryList } from "@/components/HistoryList";
import { DailyChart, WeeklyChart, computeDayStats } from "@/components/HistoryChart";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";
import { Settings, ChevronLeft, Clock, BarChart3 } from "lucide-react";

type Tab = "today" | "summary";

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MonthlySummary() {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const { formatCurrency } = useSalaryCalc();

  const stats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Iterate each day of the current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalWorkSec = 0;
    let totalBreakSec = 0;
    let totalEarnings = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (date > now) break;
      const day = computeDayStats(sessions, workIntervals, date);
      totalWorkSec += day.workSec;
      totalBreakSec += day.breakSec;
      totalEarnings += day.earnings;
    }
    return { earnings: totalEarnings, workDuration: totalWorkSec, breakDuration: totalBreakSec };
  }, [sessions, workIntervals]);

  const monthLabel = new Date().toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className="px-4 py-3">
      <div className="rounded-xl bg-muted/60 px-4 py-3">
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
            {monthLabel}
          </span>
          <span className="text-xl font-semibold tabular-nums tracking-tight leading-none">
            {formatCurrency(stats.earnings)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Work {formatDuration(stats.workDuration)} &middot; Break {formatDuration(stats.breakDuration)}
        </p>
      </div>
    </div>
  );
}

const tabBtnClass = (active: boolean) =>
  `flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-colors ${
    active
      ? "text-foreground border-b-2 border-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;

function App() {
  const loadFromDisk = useAppStore((s) => s.loadFromDisk);
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const salary = useAppStore((s) => s.salary);
  const sessions = useAppStore((s) => s.sessions);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  useSystemEvents();

  useEffect(() => {
    loadFromDisk();
  }, [loadFromDisk]);

  return (
    <div className="w-[320px] min-h-0 select-none bg-background rounded-xl overflow-hidden">
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
          <SettingsPanel />
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

          {tab === "today" && (
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
          )}

          <div className="h-px bg-border" />

          {/* Tab content */}
          <div>
            {tab === "today" ? (
              <>
                <DailyChart sessions={sessions} todayOnly />
                <div className="h-px bg-border mx-4" />
                <HistoryList todayOnly />
              </>
            ) : (
              <>
                <MonthlySummary />
                <div className="h-px bg-border mx-4" />
                {selectedDay ? (
                  <>
                    <DailyChart
                      sessions={sessions}
                      fixedDate={selectedDay}
                      onPrev={() => { const d = new Date(selectedDay); d.setDate(d.getDate() - 1); setSelectedDay(d); }}
                      onNext={() => { const d = new Date(selectedDay); d.setDate(d.getDate() + 1); setSelectedDay(d); }}
                    />
                    <div className="h-px bg-border mx-4" />
                    <HistoryList filterDate={selectedDay} />
                  </>
                ) : (
                  <>
                    <WeeklyChart sessions={sessions} onBarClick={setSelectedDay} />
                    <div className="h-px bg-border mx-4" />
                    <HistoryList />
                  </>
                )}
              </>
            )}
          </div>

          {/* Tab bar */}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-center gap-4 py-1">
            <button className={tabBtnClass(tab === "today")} onClick={() => { setTab("today"); setSelectedDay(null); }}>
              <Clock className="size-3" />
              Today
            </button>
            <button className={tabBtnClass(tab === "summary")} onClick={() => { setTab("summary"); setSelectedDay(null); }}>
              <BarChart3 className="size-3" />
              Summary
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
