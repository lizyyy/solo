import { useState } from "react";
import { useMinutesStore } from "@/stores/useMinutesStore";
import { MeetingMinutes, MinutesStatus } from "@/types";
import { StatusBadge } from "@/components/StatusBadges";
import { FileText, Upload, Plus, Trash2, CheckCircle2, AlertCircle, Eye, RefreshCw } from "lucide-react";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";

const SAMPLES: Record<string, Record<string, string>> = {
  sample1: {
    "纪要来源": "第43次现场协调会",
    "处理状态": "待处理",
    "会议标题": "D栋连廊加固专题会",
    "会议日期": "2026-06-10",
    "参会人": "阿乔、赵工、监理",
    "内容": "D栋连廊粘碳纤维布改为双层300g",
  },
  sample2: {
    source_file: "设计交底纪要-SJ-20260610",
    work_status: "复核中",
    topic: "屋顶钢架加固变更",
    occur_date: "2026-06-09",
    members: "设计院、施工、监理",
    body: "屋顶钢架截面加大，增加斜撑",
  },
};

export default function MinutesPage() {
  const { minutes, addMinutes, updateStatus, remove, setSelected, selectedId, resetMock } =
    useMinutesStore();
  const { showToast } = useUIGlobalStore();
  const [showDemo, setShowDemo] = useState(false);
  const [previewItem, setPreviewItem] = useState<MeetingMinutes | null>(null);

  const handleImportSample = (key: string) => {
    const raw = SAMPLES[key];
    const m = addMinutes(raw);
    showToast(
      "success",
      `导入成功 · ${m.fieldMappings.length} 项字段映射 · 来源：${m.source.slice(0, 20)}`
    );
    setShowDemo(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const txt = String(reader.result || "");
        let data: Record<string, unknown> | undefined;
        if (file.name.endsWith(".json")) {
          data = JSON.parse(txt) as Record<string, unknown>;
        } else {
          const lines = txt.split(/\r?\n/).filter(Boolean);
          if (lines.length >= 2) {
            const headers = lines[0].split(/[,，]/);
            const values = lines[1].split(/[,，]/);
            const parsed: Record<string, unknown> = {};
            headers.forEach((h, i) => (parsed[h.trim()] = values[i]?.trim() || ""));
            data = parsed;
          }
        }
        if (data) {
          const m = addMinutes(data);
          showToast("success", `文件 ${file.name} 解析完成 · ID: ${m.id.slice(0, 12)}`);
        }
      } catch {
        showToast("error", "解析失败：文件格式不正确");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const matchRoundStyle = (r: string) =>
    ({
      exact: "bg-safe-50 text-safe-700 border-safe-200",
      alias: "bg-brand-50 text-brand-700 border-brand-200",
      fuzzy: "bg-warn-50 text-warn-700 border-warn-200",
      fallback: "bg-danger-50 text-danger-700 border-danger-200",
    }[r] || "bg-ink-100 text-ink-600");

  const matchRoundLabel = (r: string) =>
    ({ exact: "精确匹配", alias: "别名匹配", fuzzy: "模糊匹配", fallback: "兜底保底" }[r] || r);

  return (
    <div className="space-y-6">
      {/* 顶部操作 */}
      <div className="eng-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-ink-900 flex items-center gap-2 mb-1">
            <FileText size={18} className="text-brand-600" />
            会议纪要管理
          </h2>
          <p className="text-xs text-ink-500">
            字段兼容层自动处理命名不一致；<b className="text-danger-700">来源、处理状态</b> 两个字段永不丢失
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => resetMock()}
            className="eng-btn text-xs"
          >
            <RefreshCw size={13} />
            重置演示数据
          </button>
          <button onClick={() => setShowDemo(!showDemo)} className="eng-btn">
            <Plus size={14} />
            演示导入
          </button>
          <label className="eng-btn-primary cursor-pointer">
            <Upload size={14} />
            导入 JSON/CSV
            <input
              type="file"
              accept=".json,.csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {showDemo && (
        <div className="eng-card p-5 border-l-4 border-l-brand-600 bg-brand-50/50">
          <h4 className="text-sm font-bold text-brand-800 mb-3">导入示例（两种字段命名风格）</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(SAMPLES).map(([k, raw]) => (
              <div key={k} className="bg-white p-4 rounded-eng border border-ink-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink-700">
                    {k === "sample1" ? "风格 A · 中文标准字段" : "风格 B · 英文/非标字段"}
                  </span>
                  <button
                    onClick={() => handleImportSample(k)}
                    className="eng-btn-primary !py-1 !px-2.5 text-xs"
                  >
                    <CheckCircle2 size={12} /> 导入此份
                  </button>
                </div>
                <pre className="text-[11px] font-mono bg-ink-50 p-2 rounded-eng overflow-x-auto scrollbar-eng max-h-[160px]">
                  {JSON.stringify(raw, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="eng-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr className="text-xs text-ink-600">
              <th className="text-left px-4 py-3 font-bold w-[240px]">来源（必保）</th>
              <th className="text-left px-4 py-3 font-bold w-[110px]">状态（必保）</th>
              <th className="text-left px-4 py-3 font-bold">主题 / 日期</th>
              <th className="text-left px-4 py-3 font-bold w-[100px]">映射项</th>
              <th className="text-left px-4 py-3 font-bold w-[140px]">参会人</th>
              <th className="text-right px-4 py-3 font-bold w-[160px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {minutes.map((m) => (
              <tr
                key={m.id}
                onClick={() => {
                  setSelected(m.id);
                  setPreviewItem(m);
                }}
                className={`border-b border-ink-100 hover:bg-brand-50/30 cursor-pointer transition-colors ${
                  selectedId === m.id ? "bg-brand-50/60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-bold text-ink-900 truncate max-w-[220px]" title={m.source}>
                    📎 {m.source}
                  </div>
                  <div className="font-mono text-[10px] text-ink-400 mt-0.5">{m.id.slice(0, 16)}…</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-ink-800">{m.title || "— 未解析标题 —"}</div>
                  <div className="text-[11px] text-ink-500">{m.meetingDate || m.createdAt.slice(0, 10)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.fieldMappings.slice(0, 3).map((f, i) => (
                      <span
                        key={i}
                        className={`text-[10px] eng-tag border ${matchRoundStyle(f.matchRound)}`}
                        title={`${f.originalName} → ${f.canonicalName} (${Math.round(f.confidence * 100)}%)`}
                      >
                        {f.canonicalName}
                      </span>
                    ))}
                    {m.fieldMappings.length > 3 && (
                      <span className="text-[10px] eng-tag bg-ink-100 text-ink-600">
                        +{m.fieldMappings.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-ink-600 truncate max-w-[140px]" title={m.participant}>
                  {m.participant || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={m.status}
                      onChange={(e) => updateStatus(m.id, e.target.value as MinutesStatus)}
                      className="eng-input !py-1 !px-2 text-xs w-[90px]"
                    >
                      <option value="pending">待处理</option>
                      <option value="processing">复核中</option>
                      <option value="resolved">已解决</option>
                      <option value="suspended">已挂起</option>
                    </select>
                    <button
                      onClick={() => {
                        setPreviewItem(m);
                      }}
                      className="eng-btn !p-1.5 !px-2"
                      title="查看兼容日志"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => {
                        remove(m.id);
                        showToast("info", "已删除纪要");
                      }}
                      className="eng-btn !p-1.5 !px-2 hover:!bg-danger-50 hover:!text-danger-700 hover:!border-danger-300"
                      title="删除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {minutes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-ink-400">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <div>暂无会议纪要，点击右上角「演示导入」或「导入 JSON/CSV」</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 兼容日志预览 */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="eng-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-ink-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-ink-900 mb-1">字段兼容映射日志</h3>
                <div className="text-xs text-ink-500 font-bold truncate max-w-[500px]">
                  📎 {previewItem.source}
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-ink-400 hover:text-ink-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto scrollbar-eng space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-brand-50 rounded-eng border border-brand-200">
                  <div className="text-[10px] text-brand-600 font-bold uppercase tracking-wider mb-1">
                    ✅ 最终来源
                  </div>
                  <div className="text-sm font-bold text-brand-800 break-all">{previewItem.source}</div>
                </div>
                <div className="p-3 bg-safe-50 rounded-eng border border-safe-200">
                  <div className="text-[10px] text-safe-600 font-bold uppercase tracking-wider mb-1">
                    ✅ 最终处理状态
                  </div>
                  <div className="text-sm font-bold text-safe-800">
                    <StatusBadge status={previewItem.status} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="eng-section-title mb-3">映射详情</h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-ink-50 text-ink-600">
                      <th className="text-left p-2 rounded-l">原字段名</th>
                      <th className="text-left p-2">→</th>
                      <th className="text-left p-2">规范字段</th>
                      <th className="text-left p-2">匹配轮次</th>
                      <th className="text-right p-2 rounded-r">置信度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItem.fieldMappings.map((f, i) => (
                      <tr key={i} className="border-b border-ink-100">
                        <td className="p-2 font-mono text-ink-700">{f.originalName}</td>
                        <td className="p-2 text-brand-500">→</td>
                        <td className="p-2 font-bold font-mono text-brand-700">{f.canonicalName}</td>
                        <td className="p-2">
                          <span className={`eng-tag border text-[10px] ${matchRoundStyle(f.matchRound)}`}>
                            {matchRoundLabel(f.matchRound)}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-ink-800">
                          {Math.round(f.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="eng-section-title mb-3">原始 JSON</h4>
                <pre className="text-[11px] font-mono bg-ink-50 p-3 rounded-eng overflow-auto scrollbar-eng max-h-[200px] border border-ink-200">
                  {JSON.stringify(previewItem.rawData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
