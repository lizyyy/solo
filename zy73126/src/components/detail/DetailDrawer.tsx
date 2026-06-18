import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ANOMALY_LABEL, STATUS_LABEL } from "@/data/types";
import type { RecordStatus } from "@/data/types";
import { cn } from "@/lib/utils";

const STATUS_ACTIONS: { status: RecordStatus; label: string; color: string }[] = [
  { status: "confirmed", label: STATUS_LABEL.confirmed, color: "bg-reef-500 hover:bg-reef-600" },
  { status: "pending_info", label: STATUS_LABEL.pending_info, color: "bg-coral-500 hover:bg-coral-600" },
  { status: "returned", label: STATUS_LABEL.returned, color: "bg-alert-500 hover:bg-alert-600" },
];

export default function DetailDrawer() {
  const selectedRecordId = useAppStore((s) => s.selectedRecordId);
  const records = useAppStore((s) => s.records);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const addNote = useAppStore((s) => s.addNote);
  const changeRecordStatus = useAppStore((s) => s.changeRecordStatus);

  const [noteInput, setNoteInput] = useState("");

  const record = records.find((r) => r.id === selectedRecordId) ?? null;

  if (!record) return null;

  const close = () => selectRecord(null);

  const handleAddNote = () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    addNote(record.id, trimmed);
    setNoteInput("");
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString("zh-CN");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={close} />

      <aside className="fixed right-0 top-0 z-50 h-full w-[420px] animate-slide-in-right bg-white shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-deep-500">记录详情</h2>
          <button onClick={close} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-deep-400">
          <InfoRow label="站点" value={record.station} />
          <InfoRow label="采样时间" value={fmtDate(record.sampledAt)} />
          <InfoRow label="潮位" value={record.tideLevel} />
          <InfoRow label="水温" value={record.waterTemp != null ? `${record.waterTemp} °C` : "—"} />
          <InfoRow label="白化率" value={record.bleachingRate != null ? `${record.bleachingRate}%` : "—"} />
          <InfoRow label="创建人" value={record.createdBy} />
          <InfoRow label="更新时间" value={fmtDate(record.updatedAt)} />
        </div>

        {record.anomalies.length > 0 && (
          <section className="px-5 pb-4 space-y-2">
            <h3 className="text-sm font-semibold text-alert-500">异常信息</h3>
            {record.anomalies.map((a) => (
              <div key={a.id} className="rounded-lg border-2 border-alert-400/60 p-3 space-y-1">
                <span className="inline-block rounded bg-alert-500 px-2 py-0.5 text-xs text-white font-medium">
                  {ANOMALY_LABEL[a.type]}
                </span>
                <p className="text-sm text-deep-400">{a.description}</p>
              </div>
            ))}
          </section>
        )}

        <section className="px-5 pb-4 space-y-3">
          <h3 className="text-sm font-semibold text-deep-500">后补备注</h3>
          {record.notes.length > 0 && (
            <ul className="space-y-2">
              {record.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-deep-400">{n.content}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {n.author} · {fmtDate(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="输入备注内容…"
            rows={3}
            className="w-full rounded-lg border border-gray-200 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-reef-400"
          />
          <button
            onClick={handleAddNote}
            disabled={!noteInput.trim()}
            className={cn(
              "rounded-lg px-4 py-2 text-sm text-white transition-colors",
              noteInput.trim() ? "bg-reef-500 hover:bg-reef-600" : "bg-gray-300 cursor-not-allowed"
            )}
          >
            添加备注
          </button>
        </section>

        <section className="px-5 pb-5 space-y-3">
          <h3 className="text-sm font-semibold text-deep-500">状态流转</h3>
          <div className="flex gap-2">
            {STATUS_ACTIONS.map(({ status, label, color }) => (
              <button
                key={status}
                disabled={record.status === status}
                onClick={() => changeRecordStatus(record.id, status)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm text-white transition-colors",
                  record.status === status ? "bg-gray-300 cursor-not-allowed" : color
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-deep-500">{value}</span>
    </div>
  );
}
