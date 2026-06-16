import { useFilteredRecords } from "@/hooks/useDerived";
import { useStore } from "@/store/useStore";
import { IssueBadge } from "./StatusBadge";
import { Edit3, Check, X, AlertTriangle, FileWarning } from "lucide-react";
import { useState, useCallback } from "react";
import type { SampleRecord } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntilExpiry(expiry: string | null): number | null {
  if (!expiry) return null;
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DataTable() {
  const filteredRecords = useFilteredRecords();
  const updateNote = useStore((s) => s.updateNote);
  const updateStatus = useStore((s) => s.updateStatus);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = useCallback((record: SampleRecord) => {
    setEditingId(record.id);
    setEditValue(record.userNote);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId) {
      updateNote(editingId, editValue);
      setEditingId(null);
      setEditValue("");
    }
  }, [editingId, editValue, updateNote]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  if (filteredRecords.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <FileWarning className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">暂无匹配的采样记录</p>
        <p className="text-xs mt-1">请导入音频文件或加载样例数据</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-800/80 text-zinc-400 text-left">
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">曲目名</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">原始文件名</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">授权状态</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">到期日</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">时码</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">标记</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap min-w-[200px]">备注</th>
            <th className="px-3 py-2.5 font-medium whitespace-nowrap">来源</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.map((r) => {
            const days = daysUntilExpiry(r.authorizationExpiry);
            const isEditing = editingId === r.id;

            return (
              <tr
                key={r.id}
                className="border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors"
              >
                <td className="px-3 py-2.5 text-zinc-200 font-medium whitespace-nowrap">
                  {r.trackName}
                </td>
                <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap max-w-[180px] truncate">
                  {r.originalFileName}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <select
                    className="bg-transparent text-xs cursor-pointer"
                    value={r.authorizationStatus}
                    onChange={(e) =>
                      updateStatus(r.id, e.target.value as SampleRecord["authorizationStatus"])
                    }
                  >
                    <option value="valid">有效</option>
                    <option value="expired">已过期</option>
                    <option value="missing">缺授权</option>
                    <option value="unknown">未确认</option>
                  </select>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {r.authorizationExpiry ? (
                    <span className="flex items-center gap-1">
                      {r.authorizationExpiry}
                      {days !== null && days < 0 && (
                        <span className="text-red-400 text-[10px]">过期{-days}天</span>
                      )}
                      {days !== null && days >= 0 && days <= 30 && (
                        <span className="text-amber-400 text-[10px]">剩余{days}天</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                  {r.timecodeStart && r.timecodeEnd ? (
                    <span className={r.hasTimecodeIssue ? "text-sky-400" : ""}>
                      {r.timecodeStart} → {r.timecodeEnd}
                      {r.hasTimecodeIssue && (
                        <AlertTriangle className="w-3 h-3 inline ml-1" />
                      )}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex gap-1 flex-wrap">
                    {r.isDuplicate && <IssueBadge type="duplicate" />}
                    {r.isOldMaster && <IssueBadge type="oldMaster" />}
                    {r.isManualRename && <IssueBadge type="rename" />}
                    {r.hasTimecodeIssue && <IssueBadge type="timecode" />}
                    {r.authorizationStatus === "expired" && <IssueBadge type="expired" />}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        className="flex-1 bg-zinc-700 border border-amber-400/40 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                      />
                      <button
                        className="text-emerald-400 hover:text-emerald-300"
                        onClick={saveEdit}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="text-zinc-400 hover:text-zinc-200"
                        onClick={cancelEdit}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 cursor-pointer group min-h-[20px]"
                      onClick={() => startEdit(r)}
                    >
                      <span className={`text-xs ${r.userNote ? "text-zinc-300" : "text-zinc-600"}`}>
                        {r.userNote || "点击添加备注..."}
                      </span>
                      <Edit3 className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-[10px]">
                  <div>{r.originalImportBatch}</div>
                  <div>{formatDate(r.updatedAt)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
