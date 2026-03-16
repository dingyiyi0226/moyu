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

function WeeklySummary({ weekOffset }: { weekOffset: number }) {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const { formatCurrency } = useSalaryCalc();

  const stats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const sunday = new Date(now);
    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(now.getDate() - dayOfWeek + weekOffset * 7);

    let totalWorkSec = 0;
    let totalBreakSec = 0;
    let totalEarnings = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      if (date > now) break;
      const day = computeDayStats(sessions, workIntervals, date);
      totalWorkSec += day.workSec;
      totalBreakSec += day.breakSec;
      totalEarnings += day.earnings;
    }
    return { earnings: totalEarnings, workDuration: totalWorkSec, breakDuration: totalBreakSec };
  }, [sessions, workIntervals, weekOffset]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "This Week";
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${fmt(sunday)} – ${fmt(saturday)}`;
  }, [weekOffset]);

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[10px] text-muted-foreground">
        Your earnings {weekOffset === 0 ? "this week" : `in ${weekLabel}`}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">
        {formatCurrency(stats.earnings)}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Work {formatDuration(stats.workDuration)} &middot; Break {formatDuration(stats.breakDuration)}
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
  const [weekOffset, setWeekOffset] = useState(0);
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
                <WeeklySummary weekOffset={weekOffset} />
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
                    <WeeklyChart sessions={sessions} onBarClick={setSelectedDay} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
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
