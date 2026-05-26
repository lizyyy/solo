import { useGameStore } from "@/store/gameStore";

export function EventLog() {
  const events = useGameStore((s) => s.session?.events || []);
  const recent = events.slice(-8).reverse();

  const colorFor = (severity: string) => {
    if (severity === "critical") return "text-industrial-warn";
    if (severity === "warning") return "text-industrial-accent";
    if (severity === "success") return "text-industrial-ok";
    return "text-industrial-dim";
  };

  return (
    <div className="panel w-64">
      <div className="panel-title">事件日志</div>
      <div className="space-y-1 max-h-56 overflow-y-auto font-mono text-xs">
        {recent.length === 0 ? (
          <div className="text-industrial-dim/60 text-center py-4">暂无事件</div>
        ) : (
          recent.map((e, i) => (
            <div
              key={e.id}
              className="flex gap-2 items-start py-1 border-b border-industrial-border/40"
            >
              <span className={`${colorFor(e.severity)} flex-shrink-0 w-2`}>●</span>
              <span className="text-industrial-dim flex-shrink-0">
                [{String(events.length - i).padStart(3, "0")}]
              </span>
              <span className={colorFor(e.severity)}>{e.detail}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
