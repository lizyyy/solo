import { useMemo } from "react";
import { CheckCircle, FileQuestion, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { STATUS_LABEL } from "@/data/types";
import type { RecordStatus, SurveyRecord } from "@/data/types";

interface ColumnDef {
  status: RecordStatus;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
}

const COLUMNS: ColumnDef[] = [
  { status: "confirmed", icon: <CheckCircle className="w-5 h-5" />, color: "text-reef-500", border: "border-reef-500", bg: "bg-reef-400/10" },
  { status: "pending_info", icon: <FileQuestion className="w-5 h-5" />, color: "text-coral-400", border: "border-coral-400", bg: "bg-coral-50" },
  { status: "returned", icon: <RotateCcw className="w-5 h-5" />, color: "text-alert-500", border: "border-alert-500", bg: "bg-alert-400/10" },
];

function fmtShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RecordCard({ record, onSelect }: { record: SurveyRecord; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border border-deep-50 p-3 transition-colors hover:bg-deep-50/40",
        record.anomalies.length > 0 && "border-l-[3px] border-l-coral-400"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-deep-500">{record.station || "-"}</span>
        {record.anomalies.length > 0 && (
          <span className="rounded-full bg-coral-100 px-2 py-0.5 text-xs font-medium text-coral-500">
            {record.anomalies.length} 异常
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-xs text-deep-300">{fmtShort(record.sampledAt)}</p>
    </button>
  );
}

export default function ReviewBoard() {
  const records = useAppStore((s) => s.records);
  const selectRecord = useAppStore((s) => s.selectRecord);

  const grouped = useMemo(() => {
    const map: Record<RecordStatus, SurveyRecord[]> = {
      pending: [], confirmed: [], pending_info: [], returned: [],
    };
    records.forEach((r) => map[r.status].push(r));
    return map;
  }, [records]);

  return (
    <div className="space-y-4">
      <h2 className="section-title">📋 月底复核看板</h2>
      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.status];
          return (
            <div
              key={col.status}
              className={cn("rounded-xl border-2 p-4", col.border, col.bg)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={col.color}>{col.icon}</span>
                <span className={cn("text-sm font-semibold", col.color)}>
                  {STATUS_LABEL[col.status]}
                </span>
              </div>
              <p className={cn("font-mono text-4xl font-bold", col.color)}>{items.length}</p>
              <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-deep-200">暂无</p>
                ) : (
                  items.map((r) => (
                    <RecordCard key={r.id} record={r} onSelect={() => selectRecord(r.id)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
