import { useState } from "react";
import { Upload, CheckCircle2, AlertCircle, FileWarning } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { ImportResult } from "@/stores/appStore";

const DATA_TYPES = [
  { key: "channel", label: "渠道数据", status: "active" },
  { key: "conversion", label: "转化流水", status: "active" },
  { key: "budget", label: "预算表", status: "active" },
  { key: "creative_tag", label: "创意标签", status: "pending" },
  { key: "calendar", label: "投放日历", status: "pending" },
];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "已同步", cls: "badge-success" },
  pending: { label: "待导入", cls: "badge-warning" },
  missing: { label: "缺失", cls: "badge-critical" },
  error: { label: "异常", cls: "badge-critical" },
};

function DataSourceTable() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">数据源列表</h3>
      </div>
      <div className="card-body p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left">
              <th className="px-5 py-3 font-medium text-zinc-500">数据类型</th>
              <th className="px-5 py-3 font-medium text-zinc-500">状态</th>
              <th className="px-5 py-3 font-medium text-zinc-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {DATA_TYPES.map((dt) => (
              <tr key={dt.key} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-5 py-3">{dt.label}</td>
                <td className="px-5 py-3">
                  <span className={STATUS_MAP[dt.status]?.cls ?? "badge-info"}>
                    {STATUS_MAP[dt.status]?.label ?? dt.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button className="btn-secondary text-xs py-1 px-3">
                    重新导入
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportForm({
  onImport,
  loading,
}: {
  onImport: (dataType: string, records: any[], options: any) => Promise<ImportResult>;
  loading: boolean;
}) {
  const [dataType, setDataType] = useState("channel");
  const [jsonInput, setJsonInput] = useState("");
  const [dateFormat, setDateFormat] = useState("auto");
  const [duplicatePolicy, setDuplicatePolicy] = useState("skip");
  const [allowLate, setAllowLate] = useState(false);

  const handleSubmit = async () => {
    let records: any[];
    try {
      records = JSON.parse(jsonInput);
      if (!Array.isArray(records)) {
        alert("请输入 JSON 数组格式");
        return;
      }
    } catch {
      alert("JSON 格式不正确，请检查输入");
      return;
    }
    await onImport(dataType, records, {
      dateFormat,
      duplicatePolicy,
      allowLateAttachment: allowLate,
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">数据导入</h3>
      </div>
      <div className="card-body space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            数据类型
          </label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {DATA_TYPES.map((dt) => (
              <option key={dt.key} value={dt.key}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            JSON 数据（数组格式）
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={8}
            placeholder='[{"name": "抖音", "platform": "douyin", ...}]'
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              日期格式
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="auto">自动检测</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              重复策略
            </label>
            <select
              value={duplicatePolicy}
              onChange={(e) => setDuplicatePolicy(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="skip">跳过</option>
              <option value="overwrite">覆盖</option>
              <option value="rename">重命名</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              附件延迟
            </label>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowLate}
                onChange={(e) => setAllowLate(e.target.checked)}
                className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-zinc-600">允许延迟附件</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !jsonInput.trim()}
          className="btn-primary gap-2"
        >
          <Upload className="w-4 h-4" />
          {loading ? "导入中..." : "导入数据"}
        </button>
      </div>
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportResult | null }) {
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div
        className={`card p-5 ${
          result.success ? "border-emerald-200" : "border-red-200"
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="font-semibold">
            导入{result.success ? "成功" : "失败"}
          </span>
        </div>
        <div className="flex gap-6 text-sm">
          <span>
            导入: <span className="font-mono font-semibold">{result.imported}</span> 条
          </span>
          <span>
            跳过: <span className="font-mono font-semibold">{result.skipped}</span> 条
          </span>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
            <FileWarning className="w-4 h-4" />
            警告 ({result.warnings.length})
          </h4>
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="card p-4 border-amber-200 bg-amber-50/50"
            >
              <p className="text-sm text-amber-800">{w.message}</p>
              <div className="flex gap-2 mt-1.5">
                <span className="badge-warning">{w.type}</span>
                <span className="text-xs text-amber-600">
                  建议操作: {w.suggestion}
                </span>
              </div>
              {w.affectedRows.length > 0 && (
                <p className="text-xs text-amber-500 mt-1 font-mono">
                  影响行: [{w.affectedRows.join(", ")}]
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-700 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            错误 ({result.errors.length})
          </h4>
          {result.errors.map((e, i) => (
            <div key={i} className="card p-4 border-red-200 bg-red-50/50">
              <p className="text-sm text-red-800">{e.message}</p>
              <span className="text-xs text-red-500 font-mono">
                行 {e.row} · 字段 {e.field}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataManagement() {
  const { importResult, loading, importData } = useAppStore();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">数据管理</h2>
      <DataSourceTable />
      <div className="grid grid-cols-2 gap-6">
        <ImportForm onImport={importData} loading={loading} />
        <ImportResultPanel result={importResult} />
      </div>
    </div>
  );
}
