import AnomalyCard from "./AnomalyCard";
import { useAppStore } from "@/store/useAppStore";
import { anomalyLabel } from "@/utils/export";
import { FileQuestion } from "lucide-react";

export default function AnomalyTimeline() {
  const { currentAnomalies } = useAppStore();

  if (currentAnomalies.length === 0) {
    return (
      <div className="h-full flex items-center justify-center py-12 text-center">
        <div className="text-ink-300">
          <FileQuestion size={36} className="mx-auto mb-2 opacity-60" />
          <p className="text-sm">尚未检测到异常</p>
          <p className="text-xs text-ink-400 mt-1">
            点击"启动验算"后，异常将在此处按类型分组展示
          </p>
        </div>
      </div>
    );
  }

  const groups = new Map<string, typeof currentAnomalies>();
  for (const a of currentAnomalies) {
    if (!groups.has(a.type)) groups.set(a.type, []);
    groups.get(a.type)!.push(a);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([type, list]) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-px flex-1 bg-fog-200" />
            <span className="label">{anomalyLabel(type as any)}</span>
            <span className="chip bg-fog-100 text-ink-500">
              {list.length}
            </span>
            <span className="h-px flex-1 bg-fog-200" />
          </div>
          <div className="space-y-2">
            {list.map((a) => (
              <AnomalyCard key={a.id} anomaly={a} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
