import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Radio, X, CheckCircle2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export default function DataImport() {
  const importPayloadPlan = useStore((s) => s.importPayloadPlan);
  const importGroundStationSchedule = useStore((s) => s.importGroundStationSchedule);
  const importHistory = useStore((s) => s.importHistory);
  const retractImport = useStore((s) => s.retractImport);

  const [payloadDragOver, setPayloadDragOver] = useState(false);
  const [scheduleDragOver, setScheduleDragOver] = useState(false);
  const [payloadError, setPayloadError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const payloadInputRef = useRef<HTMLInputElement>(null);
  const scheduleInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File, type: "payload" | "schedule") => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          if (type === "payload") {
            importPayloadPlan(text, file.name, "当前用户");
          } else {
            importGroundStationSchedule(text, file.name, "当前用户");
          }
          setSuccessToast("导入成功");
          setTimeout(() => setSuccessToast(""), 2500);
          if (type === "payload") setPayloadError("");
          else setScheduleError("");
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "导入失败，请检查文件格式";
          if (type === "payload") setPayloadError(msg);
          else setScheduleError(msg);
        }
      };
      reader.readAsText(file);
    },
    [importPayloadPlan, importGroundStationSchedule]
  );

  const onDragOver = (e: React.DragEvent, type: "payload" | "schedule") => {
    e.preventDefault();
    if (type === "payload") setPayloadDragOver(true);
    else setScheduleDragOver(true);
  };

  const onDragLeave = (type: "payload" | "schedule") => {
    if (type === "payload") setPayloadDragOver(false);
    else setScheduleDragOver(false);
  };

  const onDrop = (
    e: React.DragEvent,
    type: "payload" | "schedule"
  ) => {
    e.preventDefault();
    if (type === "payload") setPayloadDragOver(false);
    else setScheduleDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, type);
  };

  const onFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "payload" | "schedule"
  ) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, type);
    e.target.value = "";
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-8">
      {successToast && (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">{successToast}</span>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold">数据导入</h1>
        <p className="mt-1 text-slate-400">
          导入载荷计划与地面站窗口数据，系统将自动进行冲突检测
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-3 text-lg font-semibold">载荷计划导入</h2>
          <div
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors",
              payloadDragOver
                ? "border-amber-500 bg-amber-500/5"
                : "border-slate-600 hover:border-slate-500"
            )}
            onClick={() => payloadInputRef.current?.click()}
            onDragOver={(e) => onDragOver(e, "payload")}
            onDragLeave={() => onDragLeave("payload")}
            onDrop={(e) => onDrop(e, "payload")}
          >
            <Upload className="mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-300">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="mt-1 text-xs text-slate-500">支持 JSON、CSV 格式</p>
            <input
              ref={payloadInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => onFileChange(e, "payload")}
            />
          </div>
          {payloadError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-900/30 px-4 py-3 text-red-400">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-sm">{payloadError}</span>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">地面站窗口导入</h2>
          <div
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors",
              scheduleDragOver
                ? "border-amber-500 bg-amber-500/5"
                : "border-slate-600 hover:border-slate-500"
            )}
            onClick={() => scheduleInputRef.current?.click()}
            onDragOver={(e) => onDragOver(e, "schedule")}
            onDragLeave={() => onDragLeave("schedule")}
            onDrop={(e) => onDrop(e, "schedule")}
          >
            <Upload className="mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-300">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="mt-1 text-xs text-slate-500">支持 JSON、CSV 格式</p>
            <input
              ref={scheduleInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => onFileChange(e, "schedule")}
            />
          </div>
          {scheduleError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-900/30 px-4 py-3 text-red-400">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-sm">{scheduleError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">导入历史</h2>
        {importHistory.length === 0 ? (
          <p className="py-8 text-center text-slate-500">暂无导入记录</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-700" />
            <div className="space-y-1">
              {importHistory.map((entry) => (
                <div key={entry.id} className="relative flex items-center gap-4 py-3 pl-8">
                  <div
                    className={cn(
                      "absolute left-2 top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2",
                      entry.retracted
                        ? "border-slate-600 bg-slate-700"
                        : entry.type === "payload_plan"
                        ? "border-blue-400 bg-blue-400"
                        : "border-emerald-400 bg-emerald-400"
                    )}
                  />
                  {entry.type === "payload_plan" ? (
                    <FileText
                      className={cn(
                        "h-4 w-4 shrink-0",
                        entry.retracted ? "text-slate-600" : "text-blue-400"
                      )}
                    />
                  ) : (
                    <Radio
                      className={cn(
                        "h-4 w-4 shrink-0",
                        entry.retracted ? "text-slate-600" : "text-emerald-400"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      entry.retracted
                        ? "text-slate-600 line-through"
                        : "text-slate-300"
                    )}
                  >
                    {entry.filename}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(entry.importedAt)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {entry.operator}
                  </span>
                  {!entry.retracted && (
                    <button
                      onClick={() => retractImport(entry.id)}
                      className="ml-auto rounded px-2 py-0.5 text-xs text-red-400 transition-colors hover:bg-red-900/20"
                    >
                      撤回
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
