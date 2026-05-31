import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Check,
  Merge,
  Trash2,
  Edit3,
  ArrowRight,
  History,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/utils/api";
import type {
  ParsedResult,
  ParsedItem,
  ImportBatch,
  ImportDecision,
  ImportAction,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

type CategoryKey = "normal" | "late" | "duplicate" | "correction";

interface CategoryConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof Check;
}

const categoryMap: Record<CategoryKey, CategoryConfig> = {
  normal: {
    label: "正常记录",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: Check,
  },
  late: {
    label: "晚到附件",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: FileSpreadsheet,
  },
  duplicate: {
    label: "重复项",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: Merge,
  },
  correction: {
    label: "人工更正",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: Edit3,
  },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileIcon(name: string) {
  if (name.endsWith(".zip")) return <FileArchive className="w-5 h-5 text-amber-500" />;
  if (name.endsWith(".json")) return <FileJson className="w-5 h-5 text-blue-500" />;
  return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
}

function CategoryCard({
  categoryKey,
  count,
  items,
  expanded,
  onToggle,
  onDuplicateAction,
  decisions,
}: {
  categoryKey: CategoryKey;
  count: number;
  items: ParsedItem[];
  expanded: boolean;
  onToggle: () => void;
  onDuplicateAction?: (itemId: string, action: ImportAction) => void;
  decisions: Record<string, ImportAction>;
}) {
  const config = categoryMap[categoryKey];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg border p-4", config.border, config.bg)}>
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", config.color)} />
          <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-bold", config.color)}>{count}</span>
          {expanded ? (
            <ChevronDown className={cn("w-4 h-4", config.color)} />
          ) : (
            <ChevronRight className={cn("w-4 h-4", config.color)} />
          )}
        </div>
      </div>

      {expanded && items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-md border border-gray-100 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="text-primary font-medium">
                  {item.data.towerId && (
                    <span className="font-mono">{String(item.data.towerId)}</span>
                  )}
                  {item.data.fileName && (
                    <span className="flex items-center gap-1">
                      {fileIcon(String(item.data.fileName))}
                      {String(item.data.fileName)}
                    </span>
                  )}
                </div>
                {item.type === "duplicate" && onDuplicateAction && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      decisions[item.id] === "accept"
                        ? "bg-emerald-100 text-emerald-700"
                        : decisions[item.id] === "merge"
                          ? "bg-blue-100 text-blue-700"
                          : decisions[item.id] === "reject"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {decisions[item.id] === "accept"
                      ? "保留原有"
                      : decisions[item.id] === "merge"
                        ? "合并"
                        : decisions[item.id] === "reject"
                          ? "丢弃新记录"
                          : "待处理"}
                  </span>
                )}
                {item.type === "manual_correction" && decisions[item.id] === "correct" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                    已更正
                  </span>
                )}
              </div>
              <div className="text-gray-400 mt-1">
                {item.data.flightDate && `日期: ${String(item.data.flightDate)}`}
                {item.data.pilotName && ` | 飞手: ${String(item.data.pilotName)}`}
                {item.data.arrivedAt && `到达: ${String(item.data.arrivedAt)}`}
                {item.data.fieldName && (
                  <span>
                    字段: {String(item.data.fieldName)} &quot;{item.originalValue ?? ""}&quot; → &quot;
                    {item.correctedValue ?? ""}&quot;
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicatePanel({
  existing,
  incoming,
  itemId,
  onAction,
  currentAction,
}: {
  existing: ParsedItem;
  incoming: ParsedItem;
  itemId: string;
  onAction: (itemId: string, action: ImportAction) => void;
  currentAction?: ImportAction;
}) {
  const actionButtons: { action: ImportAction; label: string; icon: typeof Check; style: string }[] =
    [
      {
        action: "accept",
        label: "保留原有",
        icon: Check,
        style:
          "border-emerald-200 text-emerald-700 hover:bg-emerald-50 data-[active=true]:bg-emerald-100 data-[active=true]:border-emerald-400",
      },
      {
        action: "merge",
        label: "合并",
        icon: Merge,
        style:
          "border-blue-200 text-blue-700 hover:bg-blue-50 data-[active=true]:bg-blue-100 data-[active=true]:border-blue-400",
      },
      {
        action: "reject",
        label: "丢弃新记录",
        icon: Trash2,
        style:
          "border-red-200 text-red-700 hover:bg-red-50 data-[active=true]:bg-red-100 data-[active=true]:border-red-400",
      },
    ];

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50/50 overflow-hidden">
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm font-medium text-amber-800">
        重复记录对比 — {existing.data.towerId && <span className="font-mono">{String(existing.data.towerId)}</span>}
      </div>

      <div className="grid grid-cols-2 divide-x divide-amber-200">
        <div className="p-4">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-steel" />
            已有记录
          </div>
          <div className="space-y-1.5 text-sm">
            {Object.entries(existing.data).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="text-primary font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-amber-50/30">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent" />
            新导入记录
          </div>
          <div className="space-y-1.5 text-sm">
            {Object.entries(incoming.data).map(([k, v]) => {
              const changed = existing.data[k] !== v;
              return (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span
                    className={cn(
                      "font-medium",
                      changed ? "text-accent underline decoration-wavy decoration-amber-300" : "text-primary"
                    )}
                  >
                    {String(v)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-amber-200 flex items-center gap-2 bg-white/50">
        <span className="text-xs text-gray-500 mr-2">操作:</span>
        {actionButtons.map(({ action, label, icon: BtnIcon, style }) => (
          <button
            key={action}
            data-active={currentAction === action}
            onClick={() => onAction(itemId, action)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
              style
            )}
          >
            <BtnIcon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        {currentAction && (
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-500" />
            已选择: {actionButtons.find((b) => b.action === currentAction)?.label}
          </span>
        )}
      </div>
    </div>
  );
}

function CorrectionPanel({
  item,
  onConfirm,
  confirmed,
}: {
  item: ParsedItem;
  onConfirm: (itemId: string, reason: string) => void;
  confirmed: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    onConfirm(item.id, reason);
  };

  return (
    <div className="border border-purple-200 rounded-lg bg-purple-50/50 overflow-hidden">
      <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 text-sm font-medium text-purple-800">
        人工更正 — {item.data.towerId && <span className="font-mono">{String(item.data.towerId)}</span>} /{" "}
        {String(item.data.fieldName ?? "")}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 line-through">{item.originalValue ?? ""}</span>
          <ArrowRight className="w-4 h-4 text-purple-400" />
          <span className="text-purple-700 font-medium">{item.correctedValue ?? ""}</span>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            更正原因 <span className="text-danger">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError(false);
            }}
            placeholder="请输入更正原因（必填）"
            rows={2}
            className={cn(
              "w-full px-3 py-2 rounded-md border text-sm resize-none transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400",
              "placeholder:text-gray-400",
              error ? "border-danger" : "border-gray-200"
            )}
            disabled={confirmed}
          />
          {error && <p className="text-xs text-danger mt-1">请填写更正原因</p>}
        </div>

        <button
          onClick={handleConfirm}
          disabled={confirmed}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
            confirmed
              ? "bg-purple-100 text-purple-400 cursor-default"
              : "bg-purple-600 text-white hover:bg-purple-700"
          )}
        >
          {confirmed ? "已确认更正" : "确认更正"}
        </button>
      </div>
    </div>
  );
}

export default function DataImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(new Set());
  const [decisions, setDecisions] = useState<Record<string, ImportAction>>({});
  const [correctionReasons, setCorrectionReasons] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<ImportBatch[]>('/import/batches')
      .then(setBatches)
      .catch(() => {});
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFile(file.name);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const xhr = new XMLHttpRequest();

      const result = await new Promise<ParsedResult>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText) as { batchId: string; parsed: ParsedResult };
              resolve(resp.parsed);
            } catch {
              reject(new Error("解析响应失败"));
            }
          } else {
            reject(new Error(`上传失败 (${xhr.status})`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("网络错误")));

        xhr.open("POST", `${BASE_URL}/import/upload`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });

      setParsed(result);
      setBatchId(crypto.randomUUID());
      setExpandedCategories(new Set(["normal", "late", "duplicate", "correction"]));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const toggleCategory = (key: CategoryKey) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDuplicateAction = (itemId: string, action: ImportAction) => {
    setDecisions((prev) => ({ ...prev, [itemId]: action }));
  };

  const handleCorrectionConfirm = (itemId: string, reason: string) => {
    setDecisions((prev) => ({ ...prev, [itemId]: "correct" }));
    setCorrectionReasons((prev) => ({ ...prev, [itemId]: reason }));
  };

  const handleConfirmImport = async () => {
    if (!batchId || !parsed) return;

    const decisionList: ImportDecision[] = parsed.items
      .filter((item) => item.type === "duplicate" || item.type === "manual_correction")
      .map((item) => ({
        itemId: item.id,
        action: decisions[item.id] || "accept",
        mergeTargetId: item.duplicateOf,
        correctionReason: correctionReasons[item.id],
      }));

    setIsSubmitting(true);
    try {
      await api.post("/import/confirm", { batchId, decisions: decisionList });
    } catch {
      // handled silently for demo
    } finally {
      setIsSubmitting(false);
      setParsed(null);
      setBatchId(null);
      setUploadedFile(null);
      setUploadProgress(0);
      setDecisions({});
      setCorrectionReasons({});
      setExpandedCategories(new Set());
    }
  };

  const handleReset = () => {
    setParsed(null);
    setBatchId(null);
    setUploadedFile(null);
    setUploadProgress(0);
    setDecisions({});
    setCorrectionReasons({});
    setExpandedCategories(new Set());
  };

  const duplicates = parsed?.items.filter((i) => i.type === "duplicate") ?? [];
  const corrections = parsed?.items.filter((i) => i.type === "manual_correction") ?? [];
  const allDuplicatesResolved = duplicates.every((d) => decisions[d.id]);
  const allCorrectionsResolved = corrections.every((c) => decisions[c.id] === "correct");
  const canSubmit = parsed && allDuplicatesResolved && allCorrectionsResolved;

  const counts: Record<CategoryKey, number> = parsed
    ? {
        normal: parsed.normalRecords,
        late: parsed.lateAttachments,
        duplicate: parsed.duplicates,
        correction: parsed.manualCorrections,
      }
    : { normal: 0, late: 0, duplicate: 0, correction: 0 };

  const categoryItems = (key: CategoryKey): ParsedItem[] => {
    if (!parsed) return [];
    const typeMap: Record<CategoryKey, string> = {
      normal: "normal",
      late: "late_attachment",
      duplicate: "duplicate",
      correction: "manual_correction",
    };
    return parsed.items.filter((i) => i.type === typeMap[key]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">数据导入</h1>
      </div>

      {!parsed && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center",
            "transition-colors duration-200 cursor-pointer",
            isDragging
              ? "border-accent bg-accent/5"
              : "border-gray-300 bg-white hover:border-accent hover:bg-accent/5"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
              isDragging ? "bg-accent/10" : "bg-gray-100"
            )}
          >
            <Upload className={cn("w-8 h-8", isDragging ? "text-accent" : "text-gray-400")} />
          </div>
          <p className="text-base font-medium text-primary mb-1">
            {isDragging ? "松开以上传文件" : "拖拽文件到此处，或点击选择文件"}
          </p>
          <p className="text-sm text-gray-400">支持 ZIP、JSON、CSV 格式</p>
          <div className="flex items-center gap-4 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <FileArchive className="w-4 h-4" /> ZIP
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <FileJson className="w-4 h-4" /> JSON
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </span>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="card card-body">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary">{uploadedFile}</span>
            <span className="text-xs text-gray-400">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="card card-body border-red-200 bg-red-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700">{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {parsed && !isUploading && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">解析结果</span>
              <span className="text-xs text-gray-400">
                共 {parsed.items.length} 条记录
              </span>
            </div>
            <button onClick={handleReset} className="btn-secondary text-xs py-1 px-3">
              <X className="w-3.5 h-3.5" />
              重新上传
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(categoryMap) as CategoryKey[]).map((key) => (
              <CategoryCard
                key={key}
                categoryKey={key}
                count={counts[key]}
                items={categoryItems(key)}
                expanded={expandedCategories.has(key)}
                onToggle={() => toggleCategory(key)}
                onDuplicateAction={handleDuplicateAction}
                decisions={decisions}
              />
            ))}
          </div>

          {duplicates.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-primary flex items-center gap-2">
                <Merge className="w-5 h-5 text-amber-500" />
                重复处理
                {!allDuplicatesResolved && (
                  <span className="text-xs font-normal text-gray-400">
                    （待处理 {duplicates.length - duplicates.filter((d) => decisions[d.id]).length} 项）
                  </span>
                )}
              </h2>
              <div className="space-y-4">
                {duplicates.map((dup) => {
                  const original = parsed.items.find((i) => i.id === dup.duplicateOf);
                  if (!original) return null;
                  return (
                    <DuplicatePanel
                      key={dup.id}
                      existing={original}
                      incoming={dup}
                      itemId={dup.id}
                      onAction={handleDuplicateAction}
                      currentAction={decisions[dup.id]}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {corrections.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-primary flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-500" />
                人工更正
                {!allCorrectionsResolved && (
                  <span className="text-xs font-normal text-gray-400">
                    （待处理 {corrections.filter((c) => decisions[c.id] !== "correct").length} 项）
                  </span>
                )}
              </h2>
              <div className="space-y-4">
                {corrections.map((item) => (
                  <CorrectionPanel
                    key={item.id}
                    item={item}
                    onConfirm={handleCorrectionConfirm}
                    confirmed={decisions[item.id] === "correct"}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="card card-body flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {canSubmit ? (
                <span className="text-emerald-600 font-medium">所有项目已处理，可以提交导入</span>
              ) : (
                <span>
                  请处理所有重复项和更正项后再提交
                  {duplicates.length > 0 && !allDuplicatesResolved && " · 重复项待处理"}
                  {corrections.length > 0 && !allCorrectionsResolved && " · 更正项待处理"}
                </span>
              )}
            </div>
            <button
              onClick={handleConfirmImport}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                "btn-primary",
                (!canSubmit || isSubmitting) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  确认导入
                </>
              )}
            </button>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-header flex items-center gap-2">
          <History className="w-4 h-4 text-steel" />
          <span>导入历史</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">批次名称</th>
                <th className="px-5 py-3 font-medium">导入时间</th>
                <th className="px-5 py-3 font-medium">操作人</th>
                <th className="px-5 py-3 font-medium">总数</th>
                <th className="px-5 py-3 font-medium">正常</th>
                <th className="px-5 py-3 font-medium">晚到</th>
                <th className="px-5 py-3 font-medium">重复</th>
                <th className="px-5 py-3 font-medium">更正</th>
                <th className="px-5 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-primary">{batch.batchName}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                    {formatTime(batch.importedAt)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{batch.importedBy}</td>
                  <td className="px-5 py-3 text-primary font-medium">{batch.totalItems}</td>
                  <td className="px-5 py-3 text-emerald-600">{batch.normalCount}</td>
                  <td className="px-5 py-3 text-blue-600">{batch.lateCount}</td>
                  <td className="px-5 py-3 text-amber-600">{batch.duplicateCount}</td>
                  <td className="px-5 py-3 text-purple-600">{batch.correctionCount}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        batch.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : batch.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          batch.status === "completed"
                            ? "bg-emerald-500"
                            : batch.status === "failed"
                              ? "bg-red-500"
                              : "bg-amber-500"
                        )}
                      />
                      {batch.status === "completed"
                        ? "已完成"
                        : batch.status === "failed"
                          ? "失败"
                          : "处理中"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
