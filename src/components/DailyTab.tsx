import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { BreakView } from "@/components/BreakView";
import { WorkingView } from "@/components/WorkingView";
import { DailyChart } from "@/components/chart";
import { HistoryList } from "@/components/HistoryList";

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function DailyTab({
  onOpenSettings,
  initialDate,
}: {
  onOpenSettings: () => void;
  initialDate?: Date | null;
}) {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const salary = useAppStore((s) => s.salary);
  const sessions = useAppStore((s) => s.sessions);

  const [selectedDate, setSelectedDate] = useState<Date>(
    () => initialDate ?? today(),
  );

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 pb-4 shrink-0">
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

      <div className="h-px bg-border shrink-0" />

      <DailyChart
        sessions={sessions}
        fixedDate={selectedDate}
        onPrev={() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          setSelectedDate(d);
        }}
        onNext={() => {
          if (isToday) return;
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          setSelectedDate(d);
        }}
      />
      <div className="h-px bg-border mx-4 shrink-0" />
      <HistoryList filterDate={selectedDate} />
    </div>
  );
}
