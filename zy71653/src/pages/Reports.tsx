import { useState, useEffect } from "react";
import { FileDown, Copy, Check, Eye } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { ReportConfig, Report } from "@/stores/appStore";

const MODULE_OPTIONS = [
  { key: "allocation", label: "分配记录" },
  { key: "exceptions", label: "异常记录" },
  { key: "comparison", label: "情景对比" },
  { key: "raw_data", label: "原始数据" },
];

function GenerateForm({
  onGenerate,
  loading,
}: {
  onGenerate: (config: ReportConfig) => Promise<Report>;
  loading: boolean;
}) {
  const [format, setFormat] = useState<"markdown" | "json">("markdown");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modules, setModules] = useState<string[]>(["allocation", "exceptions"]);
  const [includeHumanTips, setIncludeHumanTips] = useState(true);
  const [generatedReport, setGeneratedReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    const config: ReportConfig = {
      format,
      dateRange: { start: startDate, end: endDate },
      modules: modules as ReportConfig["modules"],
      includeHumanTips,
    };
    const report = await onGenerate(config);
    setGeneratedReport(report);
  };

  const toggleModule = (key: string) => {
    setModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleCopy = () => {
    if (!generatedReport?.humanTipsSummary) return;
    navigator.clipboard.writeText(generatedReport.humanTipsSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-zinc-900">导出配置</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              导出格式
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="markdown"
                  checked={format === "markdown"}
                  onChange={() => setFormat("markdown")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Markdown</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === "json"}
                  onChange={() => setFormat("json")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">JSON</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              包含模块
            </label>
            <div className="space-y-2">
              {MODULE_OPTIONS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modules.includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                    className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHumanTips}
              onChange={(e) => setIncludeHumanTips(e.target.checked)}
              className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">包含人话提示</span>
          </label>

          <button
            onClick={handleGenerate}
            disabled={loading || modules.length === 0}
            className="btn-primary gap-2"
          >
            <FileDown className="w-4 h-4" />
            {loading ? "生成中..." : "生成报告"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {generatedReport && (
          <>
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900">人话提示预览</h3>
                <button
                  onClick={handleCopy}
                  className="btn-secondary text-xs py-1 px-3 gap-1"
                >
                  {copied ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
              <div className="card-body">
                <div className="terminal-block">
                  {generatedReport.humanTipsSummary || "暂无人话提示"}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-zinc-900">报告内容预览</h3>
              </div>
              <div className="card-body max-h-80 overflow-y-auto">
                <pre className="text-xs font-mono text-zinc-600 whitespace-pre-wrap">
                  {generatedReport.content}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReportHistory({
  reports,
  onSelect,
}: {
  reports: Report[];
  onSelect: (r: Report) => void;
}) {
  const formatLabel = (f: string) => (f === "markdown" ? "Markdown" : "JSON");

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">历史报告</h3>
      </div>
      <div className="card-body p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left">
              <th className="px-5 py-3 font-medium text-zinc-500">时间</th>
              <th className="px-5 py-3 font-medium text-zinc-500">格式</th>
              <th className="px-5 py-3 font-medium text-zinc-500">模块</th>
              <th className="px-5 py-3 font-medium text-zinc-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-zinc-400">
                  暂无历史报告
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50"
                >
                  <td className="px-5 py-3 font-mono text-xs">
                    {r.createdAt}
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge-info">
                      {formatLabel(r.config.format)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {r.config.modules.map((m) => (
                        <span key={m} className="badge bg-zinc-100 text-zinc-600">
                          {m === "allocation"
                            ? "分配"
                            : m === "exceptions"
                            ? "异常"
                            : m === "comparison"
                            ? "对比"
                            : "原始"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 flex gap-2">
                    <button
                      onClick={() => onSelect(r)}
                      className="btn-secondary text-xs py-1 px-2.5 gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      查看
                    </button>
                    <a
                      href={r.downloadUrl}
                      className="btn-secondary text-xs py-1 px-2.5 gap-1"
                    >
                      <FileDown className="w-3 h-3" />
                      下载
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Reports() {
  const { reports, loading, fetchReports, generateReport } = useAppStore();
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">报告中心</h2>
      <GenerateForm onGenerate={generateReport} loading={loading} />
      <ReportHistory reports={reports} onSelect={setPreviewReport} />
      {previewReport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[700px] max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-semibold">报告预览</h3>
              <button
                onClick={() => setPreviewReport(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm"
              >
                关闭
              </button>
            </div>
            <div className="p-6">
              {previewReport.humanTipsSummary && (
                <div className="terminal-block mb-4">
                  {previewReport.humanTipsSummary}
                </div>
              )}
              <pre className="text-xs font-mono text-zinc-600 whitespace-pre-wrap">
                {previewReport.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
