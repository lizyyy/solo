import { useAppStore } from "@/store/useAppStore";
import type { SurveyRecord } from "@/data/types";

interface StatCard {
  label: string;
  value: number;
  borderColor: string;
  pulse?: boolean;
}

function computeStats(records: SurveyRecord[]): StatCard[] {
  const total = records.length;
  const anomaly = records.filter((r) => r.anomalies.some((a) => !a.resolved)).length;
  const processed = records.filter((r) => r.status === "confirmed" || r.status === "returned").length;
  const pending = records.filter((r) => r.status === "pending" || r.status === "pending_info").length;

  return [
    { label: "总数", value: total, borderColor: "border-l-deep-400" },
    { label: "异常数", value: anomaly, borderColor: "border-l-coral-400", pulse: true },
    { label: "已处理", value: processed, borderColor: "border-l-reef-500" },
    { label: "待处理", value: pending, borderColor: "border-l-alert-500" },
  ];
}

export default function StatsBar() {
  const records = useAppStore((s) => s.records);
  const stats = computeStats(records);

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-4">
      {stats.map(({ label, value, borderColor, pulse }) => (
        <div
          key={label}
          className={`app-card border-l-4 ${borderColor} px-5 py-4 ${pulse ? "animate-coral-pulse" : ""}`}
        >
          <p className="label mb-1">{label}</p>
          <p className="font-mono text-3xl font-semibold text-deep-500">{value}</p>
        </div>
      ))}
    </div>
  );
}
