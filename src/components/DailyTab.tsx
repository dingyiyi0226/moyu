import { useAppStore } from "@/store/appStore";
import { BreakView } from "@/components/BreakView";
import { WorkingView } from "@/components/WorkingView";
import { DailyChart } from "@/components/DailyChart";
import { HistoryList } from "@/components/HistoryList";

export function DailyTab({ onOpenSettings }: { onOpenSettings: () => void }) {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const salary = useAppStore((s) => s.salary);
  const sessions = useAppStore((s) => s.sessions);

  return (
    <>
      <div className="px-4 pb-4">
        {salary.amount === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">
              No salary configured
            </p>
            <button
              onClick={onOpenSettings}
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

      <div className="h-px bg-border" />

      <DailyChart sessions={sessions} todayOnly />
      <div className="h-px bg-border mx-4" />
      <HistoryList todayOnly />
    </>
  );
}
