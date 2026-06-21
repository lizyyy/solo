import { useMemo, useState } from "react";
import { CheckCircle, FileQuestion, RotateCcw, CheckSquare, Square } from "lucide-react";
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
  chipBg: string;
}

const COLUMNS: ColumnDef[] = [
  { status: "confirmed", icon: <CheckCircle className="w-5 h-5" />, color: "text-reef-500", border: "border-reef-500", bg: "bg-reef-400/10", chipBg: "bg-reef-500 text-white" },
  { status: "pending_info", icon: <FileQuestion className="w-5 h-5" />, color: "text-coral-400", border: "border-coral-400", bg: "bg-coral-50", chipBg: "bg-coral-400 text-white" },
  { status: "returned", icon: <RotateCcw className="w-5 h-5" />, color: "text-alert-500", border: "border-alert-500", bg: "bg-alert-400/10", chipBg: "bg-alert-500 text-white" },
];

function fmtShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface RecordCardProps {
  record: SurveyRecord;
  checked: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function RecordCard({ record, checked, onToggle, onSelect }: RecordCardProps) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border p-2 transition-all flex items-center gap-2",
        checked ? "bg-deep-50 border-deep-200" : "border-deep-50 bg-white hover:bg-deep-50/40",
        record.anomalies.length > 0 && "border-l-[3px] border-l-coral-400"
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0 p-0.5 text-deep-300 hover:text-deep-500 transition-colors"
      >
        {checked ? <CheckSquare size={16} className="text-coral-500" /> : <Square size={16} />}
      </button>
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-deep-500 truncate">{record.station || "-"}</span>
          {record.anomalies.length > 0 && (
            <span className="rounded-full bg-coral-100 px-2 py-0.5 text-[10px] font-medium text-coral-500 shrink-0">
              {record.anomalies.length}
            </span>
          )}
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-deep-300">{fmtShort(record.sampledAt)}</p>
      </button>
    </div>
  );
}

const MOVE_TO: { status: RecordStatus; label: string }[] = [
  { status: "confirmed", label: "批量确认" },
  { status: "pending_info", label: "批量待补件" },
  { status: "returned", label: "批量退回" },
];

export default function ReviewBoard() {
  const records = useAppStore((s) => s.records);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const batchChangeStatus = useAppStore((s) => s.batchChangeStatus);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const map: Record<RecordStatus, SurveyRecord[]> = {
      pending: [], confirmed: [], pending_info: [], returned: [],
    };
    records.forEach((r) => map[r.status].push(r));
    return map;
  }, [records]);

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const checkedIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);

  const toggleOne = (id: string) =>
    setChecked((c) => ({ ...c, [id]: !c[id] }));

  const toggleAllInColumn = (items: SurveyRecord[]) => {
    const allChecked = items.every((r) => checked[r.id]);
    setChecked((c) => {
      const next = { ...c };
      items.forEach((r) => (next[r.id] = !allChecked));
      return next;
    });
  };

  const handleBatch = (toStatus: RecordStatus) => {
    if (checkedIds.length === 0) return;
    batchChangeStatus(checkedIds, toStatus);
    setChecked({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">📋 月底复核看板</h2>
        {checkedCount > 0 && (
          <div className="flex items-center gap-2 animate-fade-up">
            <span className="text-sm text-deep-400 font-medium">已选 {checkedCount} 条</span>
            {MOVE_TO.map((m) => {
              const col = COLUMNS.find((c) => c.status === m.status)!;
              return (
                <button
                  key={m.status}
                  onClick={() => handleBatch(m.status)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
                    col.chipBg,
                    "hover:opacity-90 hover:shadow-sm"
                  )}
                >
                  {m.label}
                </button>
              );
            })}
            <button
              onClick={() => setChecked({})}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-deep-100 text-deep-300 hover:bg-deep-50 transition-colors"
            >
              清空
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.status];
          const allChecked = items.length > 0 && items.every((r) => checked[r.id]);
          const someChecked = items.some((r) => checked[r.id]);
          return (
            <div
              key={col.status}
              className={cn("rounded-xl border-2 p-4", col.border, col.bg)}
            >
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => toggleAllInColumn(items)}
                  className="p-0.5 text-deep-300 hover:text-deep-500 transition-colors"
                  title="全选本栏"
                >
                  {allChecked ? (
                    <CheckSquare size={16} className={col.color} />
                  ) : someChecked ? (
                    <CheckSquare size={16} className="text-deep-300 opacity-60" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
                <span className={col.color}>{col.icon}</span>
                <span className={cn("text-sm font-semibold", col.color)}>
                  {STATUS_LABEL[col.status]}
                </span>
                <span className="ml-auto text-xs text-deep-200">
                  全选
                </span>
              </div>
              <p className={cn("font-mono text-4xl font-bold", col.color)}>{items.length}</p>
              <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-deep-200">暂无</p>
                ) : (
                  items.map((r) => (
                    <RecordCard
                      key={r.id}
                      record={r}
                      checked={!!checked[r.id]}
                      onToggle={() => toggleOne(r.id)}
                      onSelect={() => selectRecord(r.id)}
                    />
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
