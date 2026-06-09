import { useState } from "react";
import { generateExport, triggerDownload, ExportConfig } from "@/utils/exporter";
import { useAnomaliesStore } from "@/stores/useAnomaliesStore";
import { useModelStore } from "@/stores/useModelStore";
import { useMinutesStore } from "@/stores/useMinutesStore";
import { useMaterialsStore } from "@/stores/useMaterialsStore";
import {
  Download,
  FileJson,
  FileText,
  Package,
  AlertTriangle,
  FileText as FileIcon,
  Map,
  CheckCircle2,
  History,
  MessageSquare,
  Copy,
} from "lucide-react";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";

export default function ExportPage() {
  const { anomalies, snapshots, notes, reruns } = useAnomaliesStore();
  const { annotations } = useModelStore();
  const { minutes } = useMinutesStore();
  const { batches } = useMaterialsStore();
  const { showToast } = useUIGlobalStore();

  const [config, setConfig] = useState<ExportConfig>({
    includeSnapshots: true,
    includeNotes: true,
    includeRawMinutes: false,
    format: "markdown",
    scope: "all",
  });

  const scopeCounts = {
    all: anomalies.length,
    open: anomalies.filter((a) => ["open", "processing", "suspended"].includes(a.status)).length,
    critical: anomalies.filter((a) => a.severity === "critical").length,
  };

  const handleExport = () => {
    const result = generateExport(config);
    triggerDownload(result.content, result.filename, result.type);
    showToast("success", `报告已生成：${result.filename}`);
  };

  const handleCopyJSON = () => {
    const result = generateExport({ ...config, format: "json" });
    navigator.clipboard.writeText(result.content).then(() => {
      showToast("success", "JSON 已复制到剪贴板");
    });
  };

  return (
    <div className="space-y-6">
      {/* 顶部 */}
      <div className="eng-card p-6 border-l-4 border-l-safe-600 bg-gradient-to-br from-safe-50/60 to-white">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-ink-900 flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-eng bg-safe-600 text-white flex items-center justify-center shadow-eng">
                <Download size={22} />
              </div>
              复核报告导出中心
            </h2>
            <p className="text-sm text-ink-600 max-w-xl">
              一键打包「异常说明 + 结论变化轨迹 + 材料清单 + 历史备注」。
              <br />
              <span className="text-xs text-safe-700 font-medium">
                💡 导出内容可配置，推荐 Markdown 格式直接作为会议附件
              </span>
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Stat icon={AlertTriangle} label="异常" value={anomalies.length} color="danger" />
            <Stat icon={Map} label="标注" value={annotations.length} color="brand" />
            <Stat icon={FileIcon} label="纪要" value={minutes.length} color="ink" />
            <Stat icon={Package} label="材料" value={batches.length} color="warn" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* 左：配置 */}
        <section className="space-y-5">
          {/* 导出范围 */}
          <div className="eng-card p-5">
            <h3 className="eng-section-title mb-4 text-ink-800">
              <FileText size={14} />
              第一步 · 选择导出范围
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(["all", "open", "critical"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setConfig({ ...config, scope: s })}
                  className={`p-4 rounded-eng border-2 text-left transition-all ${
                    config.scope === s
                      ? "border-brand-600 bg-brand-50 shadow-eng"
                      : "border-ink-200 hover:border-ink-300 bg-white"
                  }`}
                >
                  <div className="text-2xl font-black mb-1">
                    {s === "all"
                      ? "∞"
                      : s === "open"
                      ? "!"
                      : "⚠"}
                  </div>
                  <div className="text-sm font-bold text-ink-800 mb-0.5">
                    {s === "all" ? "完整导出" : s === "open" ? "仅未闭环" : "仅严重异常"}
                  </div>
                  <div className="text-xs text-ink-500">
                    {s === "all"
                      ? "全部异常和历史"
                      : s === "open"
                      ? "待复核/复核中/挂起"
                      : "关键结构相关"}
                    <b className="ml-1 text-ink-800">{scopeCounts[s]} 条</b>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 格式 */}
          <div className="eng-card p-5">
            <h3 className="eng-section-title mb-4 text-ink-800">
              <Download size={14} />
              第二步 · 选择导出格式
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfig({ ...config, format: "markdown" })}
                className={`p-4 rounded-eng border-2 text-left transition-all flex items-start gap-3 ${
                  config.format === "markdown"
                    ? "border-safe-600 bg-safe-50 shadow-eng"
                    : "border-ink-200 hover:border-ink-300 bg-white"
                }`}
              >
                <div className="w-10 h-10 rounded-eng bg-gradient-to-br from-safe-500 to-safe-700 text-white flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-ink-900 mb-1">Markdown 报告</div>
                  <div className="text-xs text-ink-500 leading-relaxed">
                    结构清晰的文档，可直接提交监理/作为会议附件
                  </div>
                </div>
              </button>
              <button
                onClick={() => setConfig({ ...config, format: "json" })}
                className={`p-4 rounded-eng border-2 text-left transition-all flex items-start gap-3 ${
                  config.format === "json"
                    ? "border-brand-600 bg-brand-50 shadow-eng"
                    : "border-ink-200 hover:border-ink-300 bg-white"
                }`}
              >
                <div className="w-10 h-10 rounded-eng bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shrink-0">
                  <FileJson size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-ink-900 mb-1">JSON 数据包</div>
                  <div className="text-xs text-ink-500 leading-relaxed">
                    结构化数据，便于系统对接/二次加工
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 包含内容 */}
          <div className="eng-card p-5">
            <h3 className="eng-section-title mb-4 text-ink-800">
              <Package size={14} />
              第三步 · 包含内容选项
            </h3>
            <div className="space-y-2">
              {[
                {
                  key: "includeSnapshots",
                  icon: History,
                  label: "历史快照（结论变化时间胶囊）",
                  desc: `包含 ${snapshots.length} 条结论变更记录，用于追溯为什么这次结论不一样`,
                  recommended: true,
                },
                {
                  key: "includeNotes",
                  icon: MessageSquare,
                  label: "历史备注（🔒 受保护备注）",
                  desc: `包含 ${notes.length} 条人工备注，重新复核不会覆盖这些内容`,
                  recommended: true,
                },
                {
                  key: "includeRawMinutes",
                  icon: FileIcon,
                  label: "会议纪要原始内容",
                  desc: `包含 ${minutes.length} 份纪要的原始 JSON，文件体积较大`,
                  recommended: false,
                },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 rounded-eng border cursor-pointer transition-all ${
                    (config as any)[opt.key]
                      ? "border-brand-300 bg-brand-50/40"
                      : "border-ink-200 hover:bg-ink-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={(config as any)[opt.key]}
                    onChange={(e) =>
                      setConfig({ ...config, [opt.key]: e.target.checked } as ExportConfig)
                    }
                    className="mt-1 w-4 h-4 accent-brand-600"
                  />
                  <opt.icon
                    size={18}
                    className={`mt-0.5 shrink-0 ${
                      (config as any)[opt.key] ? "text-brand-600" : "text-ink-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-800">{opt.label}</span>
                      {opt.recommended && (
                        <span className="eng-tag bg-safe-50 text-safe-700 border border-safe-200 text-[10px]">
                          <CheckCircle2 size={9} /> 推荐
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* 右：预览 + 导出按钮 */}
        <aside className="space-y-4">
          <div className="eng-card p-5 sticky top-24">
            <h3 className="text-sm font-black text-ink-900 mb-4 flex items-center gap-2">
              <Download size={15} className="text-safe-600" />
              执行导出
            </h3>

            <div className="space-y-2 mb-5 text-xs">
              <Row label="导出范围" value={config.scope === "all" ? "完整导出" : config.scope === "open" ? "仅未闭环" : "仅严重异常"} />
              <Row label="格式" value={config.format === "markdown" ? "Markdown 报告" : "JSON 数据包"} />
              <Row label="包含快照" value={config.includeSnapshots ? "✅ 是" : "❌ 否"} />
              <Row label="包含备注" value={config.includeNotes ? "✅ 是" : "❌ 否"} />
              <Row label="纪要原文" value={config.includeRawMinutes ? "✅ 包含" : "❌ 不包含"} />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleExport}
                className="w-full eng-btn-safe text-base !py-3 justify-center gap-2"
              >
                <Download size={18} />
                下载 {config.format === "markdown" ? "Markdown" : "JSON"} 报告
              </button>
              <button
                onClick={handleCopyJSON}
                className="w-full eng-btn text-sm justify-center gap-2"
              >
                <Copy size={14} />
                复制 JSON 到剪贴板
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-ink-200">
              <h4 className="text-xs font-bold text-ink-700 mb-3 flex items-center gap-2">
                <History size={12} />
                最近复核运行
              </h4>
              {reruns.length === 0 ? (
                <div className="text-[11px] text-ink-400 bg-ink-50 p-2 rounded-eng text-center">
                  暂无运行记录
                </div>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-eng">
                  {reruns.slice(0, 10).map((r) => (
                    <li
                      key={r.runId}
                      className="text-[11px] p-2 rounded-eng bg-ink-50 border border-ink-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-brand-700">{r.runId.slice(-8)}</span>
                        <span className="eng-tag bg-safe-50 text-safe-700 border border-safe-200 text-[9px]">
                          {r.status === "finished" ? "成功" : r.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-ink-500">
                        <span>异常 {r.anomaliesCountBefore}→{r.anomaliesCountAfter}</span>
                        <span>保护 {r.preservedNoteIds.length}备注</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: any) {
  const bg = {
    danger: "bg-danger-600",
    brand: "bg-brand-600",
    warn: "bg-warn-600",
    safe: "bg-safe-600",
    ink: "bg-ink-600",
  }[color] || "bg-ink-600";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-eng bg-white border border-ink-200 shadow-eng">
      <div className={`w-8 h-8 rounded-eng ${bg} text-white flex items-center justify-center`}>
        <Icon size={14} />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-black text-ink-900 leading-none">{value}</div>
        <div className="text-[10px] text-ink-500 font-bold">{label}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-dashed border-ink-100 last:border-0">
      <span className="text-ink-500 font-medium">{label}</span>
      <span className="font-bold text-ink-800">{value}</span>
    </div>
  );
}
