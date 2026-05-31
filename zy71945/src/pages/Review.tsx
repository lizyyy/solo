import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  CheckCircle2,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  User,
} from "lucide-react";
import { formatTime, formatDuration } from "@/utils/timeFormat";
import type { OcclusionEvent, ReviewRecord, ReviewHistory } from "@/types";

export default function Review() {
  const {
    occlusionEvents,
    reviewRecords,
    reviewHistory,
    confirmEvent,
    modifyEvent,
    loadData,
  } = useAppStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [reviewer, setReviewer] = useState("任务主任");
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");

  const toggleHistory = (id: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async (eventId: string) => {
    await confirmEvent(eventId, reviewer);
  };

  const handleModify = async (eventId: string) => {
    const corrections: { field: string; oldValue: string; newValue: string }[] = [];
    const event = occlusionEvents.find((e) => e.id === eventId);
    if (!event) return;

    if (editReason.trim()) {
      corrections.push({
        field: "reason",
        oldValue: event.reason,
        newValue: editReason.trim(),
      });
    }
    if (corrections.length > 0) {
      await modifyEvent(eventId, corrections, reviewer);
      setEditingEvent(null);
      setEditReason("");
    }
  };

  const getHistoryForRecord = (recordId: string): ReviewHistory[] => {
    return reviewHistory.filter((h) => h.reviewRecordId === recordId);
  };

  const getRecordsForEvent = (eventId: string): ReviewRecord[] => {
    return reviewRecords.filter((r) => r.occlusionEventId === eventId);
  };

  const statusBadge = (status: string) => {
    if (status === "confirmed")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-400/10 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />已确认
        </span>
      );
    if (status === "modified")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-400/10 text-blue-400">
          <Shield className="w-3 h-3" />人工修正
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-400/10 text-amber-400">
        <Clock className="w-3 h-3" />待处理
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">复核与修正</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            对遮挡判断结果逐条确认或修正，修改历史完整保留
          </p>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            className="px-2 py-1 rounded border border-slate-600 bg-slate-800/50 text-xs text-slate-200 w-28 focus:outline-none focus:border-amber-400/50"
            placeholder="操作人"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {occlusionEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <History className="w-10 h-10 mb-3 text-slate-600" />
            <p className="text-sm">尚无遮挡事件</p>
            <p className="text-xs mt-1">请先在遮挡分析页运行分析</p>
          </div>
        ) : (
          <div className="space-y-3">
            {occlusionEvents.map((evt) => {
              const records = getRecordsForEvent(evt.id);
              const isEditing = editingEvent === evt.id;

              return (
                <div
                  key={evt.id}
                  className="rounded-lg border border-slate-700/30 bg-[#0f1a2e] overflow-hidden"
                >
                  <div className="px-4 py-3 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {statusBadge(evt.status)}
                        <span className="font-mono text-xs text-slate-400">
                          {formatTime(evt.startTime)} — {formatTime(evt.endTime)}
                        </span>
                        <span className="text-xs text-slate-600">
                          {formatDuration(evt.startTime, evt.endTime)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {evt.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {evt.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleConfirm(evt.id)}
                            className="px-3 py-1.5 rounded text-xs bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-colors"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => {
                              setEditingEvent(isEditing ? null : evt.id);
                              setEditReason("");
                            }}
                            className="px-3 py-1.5 rounded text-xs bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition-colors"
                          >
                            修正
                          </button>
                        </>
                      )}
                      {evt.status === "confirmed" && (
                        <span className="text-xs text-emerald-400/60">已确认</span>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="px-4 pb-3 border-t border-slate-700/20 pt-3">
                      <label className="text-xs text-slate-500 mb-1 block">
                        修正理由
                      </label>
                      <textarea
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-800/50 text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 resize-none"
                        rows={3}
                        placeholder="输入修正后的理由…"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingEvent(null);
                            setEditReason("");
                          }}
                          className="px-3 py-1 rounded text-xs text-slate-400 hover:text-slate-200"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleModify(evt.id)}
                          className="px-3 py-1 rounded text-xs bg-blue-400/10 text-blue-400 hover:bg-blue-400/20"
                        >
                          提交修正
                        </button>
                      </div>
                    </div>
                  )}

                  {records.length > 0 && (
                    <div className="border-t border-slate-700/20">
                      <button
                        onClick={() => toggleHistory(evt.id)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <History className="w-3 h-3" />
                        复核记录 ({records.length})
                        {expandedHistory.has(evt.id) ? (
                          <ChevronUp className="w-3 h-3 ml-auto" />
                        ) : (
                          <ChevronDown className="w-3 h-3 ml-auto" />
                        )}
                      </button>
                      {expandedHistory.has(evt.id) && (
                        <div className="px-4 pb-3 space-y-2">
                          {records.map((rec) => {
                            const histories = getHistoryForRecord(rec.id);
                            return (
                              <div
                                key={rec.id}
                                className="rounded border border-slate-700/20 bg-[#0a1120] p-2"
                              >
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                                  {statusBadge(rec.status)}
                                  <span>
                                    {rec.reviewer} · {formatTime(rec.reviewedAt)}
                                  </span>
                                </div>
                                {histories.length > 0 && (
                                  <div className="ml-2 space-y-1">
                                    {histories.map((h) => (
                                      <div
                                        key={h.id}
                                        className="text-[10px] text-slate-500"
                                      >
                                        <span className="text-slate-400">{h.field}</span>
                                        ：{h.oldValue} →{" "}
                                        <span className="text-blue-400">
                                          {h.newValue}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
