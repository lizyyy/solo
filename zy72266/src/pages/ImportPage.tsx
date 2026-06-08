import { useState, useCallback, useRef } from "react";
import { useGateStore } from "@/store/useGateStore";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, X, FileText } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { RULE_LABELS } from "@/types";
import type { SafetyRadiusRecord } from "@/types";

interface PreviewRow {
  originalRowNumber: number;
  gateOpening: number;
  safetyRadius: number;
  zAxisValue: number | null;
  coordinateOrigin: string;
  zAxisDirection: "positive" | "negative" | "missing";
  ruleCode: "ZR-001" | "ZR-002" | "ZR-003";
}

const DEMO_DATA: Omit<SafetyRadiusRecord, "id" | "status" | "createdAt" | "updatedAt" | "zAxisDirection">[] = [
  { originalRowNumber: 1, gateOpening: 0.5, safetyRadius: 12.0, zAxisValue: 3.2, coordinateOrigin: "闸底板中心" },
  { originalRowNumber: 2, gateOpening: 1.0, safetyRadius: 15.5, zAxisValue: -2.8, coordinateOrigin: "闸底板中心" },
  { originalRowNumber: 3, gateOpening: 1.5, safetyRadius: 18.3, zAxisValue: 4.1, coordinateOrigin: "左岸基准点" },
  { originalRowNumber: 4, gateOpening: 2.0, safetyRadius: 21.7, zAxisValue: -1.5, coordinateOrigin: "右岸基准点" },
  { originalRowNumber: 5, gateOpening: 2.5, safetyRadius: 24.0, zAxisValue: null, coordinateOrigin: "闸底板中心" },
  { originalRowNumber: 6, gateOpening: 3.0, safetyRadius: 27.2, zAxisValue: 5.6, coordinateOrigin: "左岸基准点" },
  { originalRowNumber: 7, gateOpening: 3.5, safetyRadius: 30.1, zAxisValue: -3.4, coordinateOrigin: "闸底板中心" },
  { originalRowNumber: 8, gateOpening: 4.0, safetyRadius: 33.5, zAxisValue: 2.9, coordinateOrigin: "右岸基准点" },
];

function detectDirection(val: number | null) {
  if (val === null || val === undefined) return { direction: "missing" as const, ruleCode: "ZR-003" as const };
  if (val < 0) return { direction: "negative" as const, ruleCode: "ZR-001" as const };
  return { direction: "positive" as const, ruleCode: "ZR-002" as const };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text: string): PreviewRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, "").trim());
  const colIdx = {
    row: header.findIndex((h) => /原始行号|行号|row/i.test(h)),
    opening: header.findIndex((h) => /闸门开度|开度|opening/i.test(h)),
    radius: header.findIndex((h) => /安全半径|半径|radius/i.test(h)),
    zAxis: header.findIndex((h) => /z\s*轴|zaxis|z_axis|z-axis/i.test(h)),
    origin: header.findIndex((h) => /坐标原点|原点|origin|coordinate/i.test(h)),
  };

  const rows: PreviewRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const rowNumber = colIdx.row >= 0 ? parseInt(cells[colIdx.row], 10) : i;
    const gateOpening = colIdx.opening >= 0 ? parseFloat(cells[colIdx.opening]) : NaN;
    const safetyRadius = colIdx.radius >= 0 ? parseFloat(cells[colIdx.radius]) : NaN;
    const zRaw = colIdx.zAxis >= 0 ? cells[colIdx.zAxis].replace(/^["']|["']$/g, "").trim() : "";
    const zAxisValue = zRaw === "" || zRaw === "-" || zRaw.toLowerCase() === "null" || zRaw.toLowerCase() === "缺失"
      ? null
      : parseFloat(zRaw);
    const coordinateOrigin = colIdx.origin >= 0 ? cells[colIdx.origin].replace(/^["']|["']$/g, "") : "";

    if (isNaN(gateOpening) && isNaN(safetyRadius)) continue;

    const det = detectDirection(zAxisValue);
    rows.push({
      originalRowNumber: isNaN(rowNumber) ? i : rowNumber,
      gateOpening: isNaN(gateOpening) ? 0 : gateOpening,
      safetyRadius: isNaN(safetyRadius) ? 0 : safetyRadius,
      zAxisValue,
      coordinateOrigin,
      zAxisDirection: det.direction,
      ruleCode: det.ruleCode,
    });
  }
  return rows;
}

export default function ImportPage() {
  const importRecords = useGateStore((s) => s.importRecords);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDemoImport = useCallback(() => {
    const rows: PreviewRow[] = DEMO_DATA.map((d) => {
      const det = detectDirection(d.zAxisValue);
      return {
        originalRowNumber: d.originalRowNumber,
        gateOpening: d.gateOpening,
        safetyRadius: d.safetyRadius,
        zAxisValue: d.zAxisValue,
        coordinateOrigin: d.coordinateOrigin,
        zAxisDirection: det.direction,
        ruleCode: det.ruleCode,
      };
    });
    setPreviewRows(rows);
    setFileName("演示数据");
    setParseError("");
    setShowPreview(true);
    setImportSuccess(false);
  }, []);

  const handleFileContent = useCallback((text: string, name: string) => {
    try {
      const rows = parseCsvText(text);
      if (rows.length === 0) {
        setParseError(`文件 "${name}" 中未找到有效数据行。请确认 CSV 包含表头行（原始行号,闸门开度,安全半径,Z轴值,坐标原点）`);
        return;
      }
      setPreviewRows(rows);
      setFileName(name);
      setParseError("");
      setShowPreview(true);
      setImportSuccess(false);
    } catch {
      setParseError(`文件 "${name}" 解析失败，请确认格式为 CSV`);
    }
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        handleFileContent(text, file.name);
      }
    };
    reader.onerror = () => {
      setParseError(`文件 "${file.name}" 读取失败`);
    };
    reader.readAsText(file, "utf-8");
  }, [handleFileContent]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleConfirmImport = useCallback(() => {
    importRecords(
      previewRows.map((r) => ({
        originalRowNumber: r.originalRowNumber,
        gateOpening: r.gateOpening,
        safetyRadius: r.safetyRadius,
        zAxisValue: r.zAxisValue,
        coordinateOrigin: r.coordinateOrigin,
      }))
    );
    setImportSuccess(true);
  }, [previewRows, importRecords]);

  const handleReset = useCallback(() => {
    setPreviewRows([]);
    setShowPreview(false);
    setImportSuccess(false);
    setFileName("");
    setParseError("");
  }, []);

  const anomalyCount = previewRows.filter(
    (r) => r.ruleCode === "ZR-001" || r.ruleCode === "ZR-003"
  ).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          安全半径表导入
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          上传安全半径表，系统自动解析并保留原始行号，Z轴方向异常自动检测
        </p>
      </div>

      {!showPreview && !importSuccess && (
        <div>
          <div
            className="rounded-xl border-2 border-dashed p-16 text-center transition-colors"
            style={{
              borderColor: isDragOver ? "var(--color-steel)" : "var(--color-border)",
              backgroundColor: isDragOver ? "rgba(70, 130, 180, 0.08)" : "var(--color-surface)",
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload size={48} style={{ color: "var(--color-text-muted)" }} className="mx-auto mb-4" />
            <p className="text-base font-medium mb-2" style={{ color: "var(--color-text)" }}>
              拖拽安全半径表文件至此处
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
              支持 CSV 格式，系统将自动解析并保留原始行号
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{ backgroundColor: "var(--color-steel)", color: "#fff" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                <FileText size={16} className="inline mr-2" />
                选择 CSV 文件
              </button>
              <button
                onClick={handleDemoImport}
                className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", backgroundColor: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-steel)"; e.currentTarget.style.color = "var(--color-text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
              >
                <FileSpreadsheet size={16} className="inline mr-2" />
                使用演示数据导入
              </button>
            </div>
            <p className="text-xs mt-4" style={{ color: "var(--color-text-muted)" }}>
              CSV 表头格式：原始行号, 闸门开度, 安全半径, Z轴值, 坐标原点
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              演示数据包含8条记录，其中3条Z轴方向按旧习惯写反、1条数据缺失
            </p>
          </div>

          {parseError && (
            <div className="mt-4 p-4 rounded-lg border flex items-start gap-3"
              style={{ backgroundColor: "#FEE2E2", borderColor: "#EF4444" }}>
              <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-bold" style={{ color: "#991B1B" }}>文件解析失败</p>
                <p className="text-sm mt-1" style={{ color: "#991B1B" }}>{parseError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showPreview && !importSuccess && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
                导入预览
              </h2>
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text-muted)" }}>
                <FileText size={12} />
                {fileName}
              </span>
              {anomalyCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                  <AlertTriangle size={12} />
                  {anomalyCount} 条异常
                </span>
              )}
            </div>
            <button onClick={handleReset} className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}>
              <X size={18} />
            </button>
          </div>

          <div className="rounded-xl border overflow-hidden mb-4"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-bg)" }}>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>原始行号</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>闸门开度</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>安全半径</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>Z轴值</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>坐标原点</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>Z轴检测结果</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => {
                    const isAnomaly = row.ruleCode === "ZR-001" || row.ruleCode === "ZR-003";
                    return (
                      <tr key={idx} className="border-t transition-colors"
                        style={{
                          borderColor: "var(--color-border)",
                          backgroundColor: isAnomaly
                            ? row.ruleCode === "ZR-001"
                              ? "rgba(239, 68, 68, 0.08)"
                              : "rgba(245, 158, 11, 0.08)"
                            : "transparent",
                        }}>
                        <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>{row.originalRowNumber}</td>
                        <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>{row.gateOpening}m</td>
                        <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>{row.safetyRadius}m</td>
                        <td className="px-4 py-3">
                          <span style={{
                            color: row.zAxisValue !== null && row.zAxisValue < 0 ? "#EF4444" : "var(--color-text)"
                          }}>
                            {row.zAxisValue ?? "缺失"}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>{row.coordinateOrigin}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs">
                            {isAnomaly ? (
                              <AlertTriangle size={12} style={{ color: "#EF4444" }} />
                            ) : (
                              <CheckCircle size={12} style={{ color: "#10B981" }} />
                            )}
                            <span style={{ color: isAnomaly ? "#EF4444" : "#10B981" }}>
                              {RULE_LABELS[row.ruleCode]}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status="pending_review" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              共 {previewRows.length} 条记录，其中 {anomalyCount} 条需复核
            </p>
            <div className="flex gap-3">
              <button onClick={handleReset}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                取消
              </button>
              <button onClick={handleConfirmImport}
                className="px-6 py-2 rounded-lg text-sm font-bold transition-all"
                style={{ backgroundColor: "var(--color-steel)", color: "#fff" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {importSuccess && (
        <div className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CheckCircle size={48} style={{ color: "var(--color-success)" }} className="mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
            导入成功
          </h2>
          <p className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>
            已从「{fileName}」导入 {previewRows.length} 条安全半径表记录
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            Z轴方向异常记录已标记为"待复核"，请前往坐标原点说明审核页进行审核
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
              继续导入
            </button>
            <a href="/review"
              className="px-6 py-2 rounded-lg text-sm font-bold transition-all inline-block"
              style={{ backgroundColor: "var(--color-steel)", color: "#fff" }}>
              前往审核
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
