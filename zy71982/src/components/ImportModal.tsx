import { useState, useRef } from "react";
import { useQueueStore } from "@/store/useQueueStore";
import type { CompensationEvent, DiffItem } from "@/types";
import {
  Upload,
  X,
  FileUp,
  AlertTriangle,
  Plus,
  ArrowRightLeft,
  Minus,
  Check,
} from "lucide-react";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportModal({ open, onClose }: ImportModalProps) {
  const { importEvents, applyImport } = useQueueStore();
  const [dragging, setDragging] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<CompensationEvent[] | null>(null);
  const [diffs, setDiffs] = useState<DiffItem[] | null>(null);
  const [existingVersion, setExistingVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = (file: File) => {
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let data: CompensationEvent[];
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            data = parsed;
          } else if (parsed.events && Array.isArray(parsed.events)) {
            data = parsed.events;
          } else {
            throw new Error("无法识别的数据格式");
          }
        } catch {
          throw new Error("JSON解析失败，请检查文件格式");
        }

        const validEvents = data.filter(
          (e) => e.idempotencyKey && e.clientId && e.payload
        );
        if (validEvents.length === 0) {
          throw new Error("文件中未找到有效事件数据");
        }

        setParsedEvents(validEvents);
        const version = validEvents[0]?.version || "unknown";
        const result = importEvents(validEvents, file.name, version);
        setDiffs(result.diffs);
        setExistingVersion(result.existingVersion);
      } catch (err) {
        setError(err instanceof Error ? err.message : "导入失败");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = () => {
    if (parsedEvents && diffs) {
      const version = parsedEvents[0]?.version || "1.0";
      applyImport(diffs, parsedEvents, fileName, version);
      handleClose();
    }
  };

  const handleClose = () => {
    setParsedEvents(null);
    setDiffs(null);
    setExistingVersion(null);
    setError(null);
    setFileName("");
    onClose();
  };

  const addedCount = diffs?.filter((d) => d.type === "added").length || 0;
  const modifiedCount = diffs?.filter((d) => d.type === "modified").length || 0;
  const removedCount = diffs?.filter((d) => d.type === "removed").length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-700">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">
            <Upload className="w-5 h-5 text-amber-500" />
            导入迁移清单
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!parsedEvents && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  : "border-zinc-300 dark:border-zinc-600 hover:border-amber-400 dark:hover:border-amber-600"
              }`}
            >
              <FileUp className="w-10 h-10 mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                拖拽JSON文件到此处，或点击选择文件
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                支持包含事件数组的JSON文件
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {parsedEvents && diffs && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  导入摘要：{fileName}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {addedCount}
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" />
                      新增
                    </div>
                  </div>
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {modifiedCount}
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      修改
                    </div>
                  </div>
                  <div className="p-2 rounded bg-red-50 dark:bg-red-950/30">
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">
                      {removedCount}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                      <Minus className="w-3 h-3" />
                      删除
                    </div>
                  </div>
                </div>
              </div>

              {existingVersion && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">版本变更提醒：</span>
                    当前数据版本为 {existingVersion}，导入文件版本为{" "}
                    {parsedEvents[0]?.version || "unknown"}。
                    {modifiedCount > 0 &&
                      `有 ${modifiedCount} 条记录将被覆盖，请仔细审查变更清单。`}
                  </div>
                </div>
              )}

              {diffs.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    变更清单
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800">
                    {diffs.map((diff, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 flex items-center gap-2 text-xs"
                      >
                        {diff.type === "added" && (
                          <Plus className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        {diff.type === "modified" && (
                          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                        {diff.type === "removed" && (
                          <Minus className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {diff.idempotencyKey}
                        </span>
                        {diff.type === "modified" && diff.field && (
                          <span className="text-amber-600 dark:text-amber-400">
                            变更: {diff.field}
                          </span>
                        )}
                        <span
                          className={`ml-auto px-1.5 py-0.5 rounded text-xs font-medium ${
                            diff.type === "added"
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                              : diff.type === "modified"
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {diff.type === "added"
                            ? "新增"
                            : diff.type === "modified"
                              ? "修改"
                              : "删除"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diffs.length === 0 && (
                <div className="text-center py-4 text-sm text-zinc-500 dark:text-zinc-400">
                  未检测到差异，数据完全一致
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
          {parsedEvents && diffs && (
            <button
              onClick={handleConfirmImport}
              className="px-4 py-2 text-sm font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              确认导入
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
