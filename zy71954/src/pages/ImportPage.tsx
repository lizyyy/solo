import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  FileImage,
  FileText,
  Map,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { useAppStore } from "@/store";
import type {
  InspectionPhoto,
  KmlRoute,
  ImportBatch,
  AuditLog,
  AuditAction,
} from "@/types";

type ConflictResolution = "skip" | "overwrite" | "merge";

interface DuplicateConflict {
  fileName: string;
  fileHash: string;
  existingHash: string;
  resolution: ConflictResolution;
}

interface ProcessedFile {
  name: string;
  type: "photo" | "kml" | "note";
  status: "pending" | "processing" | "done";
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function genHash(): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function genShanghaiCoords(): [number, number] {
  return [
    31.0 + Math.random() * 0.4,
    121.0 + Math.random() * 0.6,
  ];
}

function classifyFile(name: string): "photo" | "kml" | "note" {
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg|png)$/i.test(lower)) return "photo";
  if (/\.(kml|kmz)$/i.test(lower)) return "kml";
  return "note";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const actionBadge: Record<AuditAction, { label: string; color: string }> = {
  import: { label: "导入", color: "bg-blue-500/20 text-blue-400" },
  confirm: { label: "确认", color: "bg-green-500/20 text-green-400" },
  revert: { label: "撤回", color: "bg-red-500/20 text-red-400" },
  export: { label: "导出", color: "bg-purple-500/20 text-purple-400" },
  status_change: { label: "状态变更", color: "bg-amber-500/20 text-amber-400" },
};

export default function ImportPage() {
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [conflicts, setConflicts] = useState<DuplicateConflict[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showRevertDialog, setShowRevertDialog] = useState<string | null>(null);
  const [auditExpanded, setAuditExpanded] = useState(true);
  const [importSuccess, setImportSuccess] = useState(false);

  const existingHashes = new Set(
    store.importBatches.flatMap((b) => b.fileHashes)
  );

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      const newConflicts: DuplicateConflict[] = [];

      for (const file of fileArr) {
        const hash = genHash();
        if (existingHashes.has(hash)) {
          newConflicts.push({
            fileName: file.name,
            fileHash: hash,
            existingHash: hash,
            resolution: "skip",
          });
        }
      }

      setPendingFiles(fileArr);

      if (newConflicts.length > 0) {
        setConflicts(newConflicts);
        setShowConflictModal(true);
      } else {
        runImport(fileArr);
      }
    },
    [existingHashes]
  );

  const runImport = useCallback(
    async (files: File[]) => {
      setShowConflictModal(false);
      setIsImporting(true);
      setImportSuccess(false);
      setProgress(0);

      const items: ProcessedFile[] = files.map((f) => ({
        name: f.name,
        type: classifyFile(f.name),
        status: "pending",
      }));
      setProcessedFiles([...items]);

      const batchId = genId();
      const now = Date.now();
      const hashes: string[] = [];
      const photosToAdd: InspectionPhoto[] = [];
      const routesToAdd: KmlRoute[] = [];

      for (let i = 0; i < items.length; i++) {
        await new Promise((r) => setTimeout(r, 300));

        setProcessedFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "processing" } : f
          )
        );

        const file = files[i];
        const hash = genHash();
        hashes.push(hash);
        const fileType = classifyFile(file.name);

        if (fileType === "photo") {
          const sortieId = genId();
          const photo: InspectionPhoto = {
            id: genId(),
            sortieId,
            fileName: file.name,
            fileHash: hash,
            thumbnailUrl: "",
            fullImageUrl: "",
            exifTimestamp: now - Math.floor(Math.random() * 86400000),
            exifGps: { lat: 31.2 + Math.random() * 0.1, lng: 121.4 + Math.random() * 0.1 },
            annotations: [],
          };
          photosToAdd.push(photo);
        } else if (fileType === "kml") {
          const sortieId = genId();
          const coordCount = 5 + Math.floor(Math.random() * 10);
          const coordinates: [number, number][] = Array.from(
            { length: coordCount },
            genShanghaiCoords
          );
          const route: KmlRoute = {
            id: genId(),
            sortieId,
            fileName: file.name,
            fileHash: hash,
            coordinates,
            swapPoints: [],
            noflyZones: [],
            rthPoint: null,
          };
          routesToAdd.push(route);
        }

        await new Promise((r) => setTimeout(r, 200));

        setProcessedFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "done" } : f
          )
        );

        setProgress(Math.round(((i + 1) / items.length) * 100));
      }

      const batch: ImportBatch = {
        id: batchId,
        timestamp: now,
        fileCount: files.length,
        fileHashes: hashes,
        status: "active",
      };

      await store.addImportBatch(batch);

      for (const photo of photosToAdd) {
        await store.addPhoto(photo);
      }
      for (const route of routesToAdd) {
        await store.addKmlRoute(route);
      }

      const auditLog: AuditLog = {
        id: genId(),
        action: "import",
        operator: "外场队长",
        timestamp: Date.now(),
        detail: `导入批次 ${batchId.slice(0, 8)}，共 ${files.length} 个文件`,
        batchId,
      };
      await store.addAuditLog(auditLog);

      setIsImporting(false);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    },
    [store]
  );

  const handleConflictResolve = useCallback(() => {
    const skipSet = new Set(
      conflicts.filter((c) => c.resolution === "skip").map((c) => c.fileName)
    );
    const filteredFiles = pendingFiles.filter(
      (f) => !skipSet.has(f.name)
    );
    runImport(filteredFiles);
  }, [conflicts, pendingFiles, runImport]);

  const handleRevert = useCallback(
    async (batchId: string) => {
      await store.revertImportBatch(batchId);
      await store.addAuditLog({
        id: genId(),
        action: "revert",
        operator: "外场队长",
        timestamp: Date.now(),
        detail: `撤回批次 ${batchId.slice(0, 8)}`,
        batchId,
      });
      setShowRevertDialog(null);
    },
    [store]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      e.target.value = "";
    },
    [processFiles]
  );

  useEffect(() => {
    return () => {
      setIsImporting(false);
      setProgress(0);
      setProcessedFiles([]);
    };
  }, []);

  return (
    <div className="min-h-screen space-y-6 bg-[#0f0f23] pb-8">
      <div>
        <div className="flex items-center gap-3">
          <Upload className="h-7 w-7 text-amber-400" />
          <h1 className="text-2xl font-bold text-gray-100">数据导入</h1>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          批量导入巡检照片、航线KML和备注文件
        </p>
      </div>

      <div
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors duration-200 ${
          dragOver
            ? "border-amber-400 bg-amber-400/5"
            : "border-gray-600 bg-[#16213e]/50 hover:border-gray-500"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          accept=".jpg,.jpeg,.png,.kml,.kmz,.csv,.txt"
        />
        <Upload className="mb-3 h-10 w-10 text-gray-500" />
        <p className="text-base font-medium text-gray-300">
          拖拽文件到此处或点击上传
        </p>
        <p className="mt-2 text-xs text-gray-500">
          支持 JPG/PNG 照片、KML/KMZ 航线、CSV/TXT 备注
        </p>
      </div>

      {isImporting && (
        <div className="rounded-xl bg-[#16213e] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              导入进度
            </span>
            <span className="text-sm text-amber-400">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-4 space-y-2">
            {processedFiles.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm"
              >
                {f.type === "photo" && (
                  <FileImage className="h-4 w-4 text-blue-400" />
                )}
                {f.type === "kml" && (
                  <Map className="h-4 w-4 text-green-400" />
                )}
                {f.type === "note" && (
                  <FileText className="h-4 w-4 text-gray-400" />
                )}
                <span className="flex-1 truncate text-gray-300">
                  {f.name}
                </span>
                {f.status === "pending" && (
                  <span className="text-xs text-gray-500">等待中</span>
                )}
                {f.status === "processing" && (
                  <span className="text-xs text-amber-400">处理中...</span>
                )}
                {f.status === "done" && (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {importSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-green-500/10 p-4 text-green-400">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm font-medium">
            导入完成！所有文件已成功处理。
          </span>
        </div>
      )}

      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-[#16213e] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-bold text-gray-100">
                检测到重复文件
              </h3>
            </div>
            <div className="space-y-4">
              {conflicts.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-[#0f0f23] p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium text-gray-200">
                      {c.fileName}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-gray-500">
                    已存在哈希: {c.existingHash.slice(0, 16)}...
                  </p>
                  <div className="flex gap-2">
                    {(["skip", "overwrite", "merge"] as ConflictResolution[]).map(
                      (opt) => (
                        <button
                          key={opt}
                          onClick={() =>
                            setConflicts((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, resolution: opt } : item
                              )
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            c.resolution === opt
                              ? opt === "skip"
                                ? "bg-gray-600 text-gray-200"
                                : opt === "overwrite"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-blue-500/20 text-blue-400"
                              : "bg-white/5 text-gray-400 hover:bg-white/10"
                          }`}
                        >
                          {opt === "skip"
                            ? "跳过"
                            : opt === "overwrite"
                              ? "覆盖"
                              : "合并"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleConflictResolve}
              className="mt-5 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-[#0f0f23] transition-colors hover:bg-amber-500"
            >
              确认并继续导入
            </button>
          </div>
        </div>
      )}

      {showRevertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-[#16213e] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-bold text-gray-100">
                确认撤回
              </h3>
            </div>
            <p className="mb-6 text-sm text-gray-300">
              确定撤回此批次？该操作将删除所有关联数据且不可恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevertDialog(null)}
                className="flex-1 rounded-lg bg-white/5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10"
              >
                取消
              </button>
              <button
                onClick={() => handleRevert(showRevertDialog)}
                className="flex-1 rounded-lg bg-red-500/20 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[#16213e] p-5">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-gray-100">导入历史</h2>
        </div>
        {store.importBatches.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            暂无导入记录
          </p>
        ) : (
          <div className="relative ml-3 border-l-2 border-gray-700 pl-6">
            {[...store.importBatches]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((batch) => (
                <div key={batch.id} className="relative mb-6 last:mb-0">
                  <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-gray-700 bg-[#16213e]" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        批次 {batch.id.slice(0, 8)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatTime(batch.timestamp)} · {batch.fileCount} 个文件
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          batch.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {batch.status === "active" ? "有效" : "已撤回"}
                      </span>
                      {batch.status === "active" && (
                        <button
                          onClick={() => setShowRevertDialog(batch.id)}
                          className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <RotateCcw className="h-3 w-3" />
                          撤回
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-[#16213e] p-5">
        <button
          onClick={() => setAuditExpanded((v) => !v)}
          className="mb-4 flex w-full items-center gap-2 text-left"
        >
          <FileText className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-gray-100">操作日志</h2>
          <span
            className={`ml-auto text-xs text-gray-500 transition-transform ${
              auditExpanded ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>
        {auditExpanded && (
          <div className="space-y-2">
            {store.auditLogs.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                暂无操作日志
              </p>
            ) : (
              [...store.auditLogs]
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 50)
                .map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg bg-[#0f0f23] px-4 py-2.5"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        actionBadge[log.action]?.color ?? "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {actionBadge[log.action]?.label ?? log.action}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {log.operator}
                    </span>
                    <span className="flex-1 truncate text-xs text-gray-300">
                      {log.detail}
                    </span>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
