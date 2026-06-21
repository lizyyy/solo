import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  AlertTriangle,
  Copy,
  Download,
  Package,
  Clock,
  CheckCircle2,
  FileCode,
  Code2,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import type { ExportResult } from '@/shared/types';

interface ReconciliationModalProps {
  onClose: () => void;
}

export default function ReconciliationModal({
  onClose,
}: ReconciliationModalProps) {
  const record = useWorkbenchStore((s) => s.record);
  const exportRecord = useWorkbenchStore((s) => s.exportRecord);
  const [exportData, setExportData] = useState<ExportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await exportRecord();
      setExportData(data);
      setLoading(false);
    })();
  }, [exportRecord]);

  const unresolvedPending = record?.pending_queue.filter(
    (p) => !p.resolved_at
  ).length || 0;

  const handleCopy = async () => {
    if (!exportData) return;
    const text = exportData.reconciliation_text;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record?.project_code || 'record'}-reconciliation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <FileText size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">对账导出</h3>
              <p className="text-slate-400 text-xs flex items-center gap-2">
                {record.project_code} · {record.structural_element}
                <span className="font-mono text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">
                  {record.render_source_id}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              disabled={!exportData}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  已复制
                </>
              ) : (
                <>
                  <Copy size={14} />
                  复制纯文本
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              disabled={!exportData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download size={14} />
              下载 JSON
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {unresolvedPending > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex items-center gap-3 flex-shrink-0">
            <AlertTriangle
              size={18}
              className="text-amber-400 flex-shrink-0"
            />
            <span className="text-amber-300 text-sm">
              存在{' '}
              <span className="font-bold text-amber-400">
                {unresolvedPending}
              </span>{' '}
              条未解决的挂起项，对账结果可能存在数据不一致，请先处理后再导出。
            </span>
          </div>
        )}

        <div className="flex-1 grid grid-cols-3 gap-0 min-h-0 overflow-hidden">
          <div className="flex flex-col border-r border-slate-700 min-w-0">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
              <Package size={12} className="text-blue-400" />
              <span className="text-xs text-slate-300 font-medium">
                左：材料送审表
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-white min-w-0">
              {loading ? (
                <div className="text-slate-400 text-sm">加载中...</div>
              ) : (
                <pre className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {record.materials
                    .map((m) => {
                      const lines = [
                        `━━━ ${m.material_name} ━━━`,
                        `  规格: ${m.specification}`,
                        `  批号: ${m.batch_no}`,
                        `  数量: ${m.quantity} ${m.unit}`,
                        `  供应商: ${m.supplier}`,
                        `  碰撞点: ${m.collision_points.length} 处`,
                        m.collision_points
                          .map(
                            (c) =>
                              `    · [${c.severity.toUpperCase()}] ${
                                c.collision_id
                              }: ${c.description}`
                          )
                          .join('\n'),
                        `  备注: ${m.remarks.length} 条`,
                        m.remarks
                          .map(
                            (r) =>
                              `    · [${r.operator}] ${r.content}`
                          )
                          .join('\n'),
                        '',
                      ];
                      return lines.join('\n');
                    })
                    .join('\n')}
                </pre>
              )}
            </div>
          </div>

          <div className="flex flex-col border-r border-slate-700 min-w-0">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
              <Clock size={12} className="text-amber-400" />
              <span className="text-xs text-slate-300 font-medium">
                中：处理记录
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-w-0">
              {loading ? (
                <div className="text-slate-400 text-sm">加载中...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
                      历史版本
                    </div>
                    <div className="space-y-2">
                      {record.history_chain.map((v) => (
                        <div
                          key={v.version_id}
                          className="bg-slate-700/30 rounded-lg p-3 border border-slate-700"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm text-blue-400">
                              v{v.version_no}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(v.operated_at).toLocaleString(
                                'zh-CN'
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mb-1">
                            {v.operator}
                          </div>
                          {v.revise_reason && (
                            <div className="text-[11px] text-slate-400">
                              {v.revise_reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {record.pending_queue.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
                        挂起记录
                      </div>
                      <div className="space-y-2">
                        {record.pending_queue.map((p) => (
                          <div
                            key={p.pending_id}
                            className={`rounded-lg p-3 border ${
                              p.resolved_at
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-amber-500/10 border-amber-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-[11px] text-slate-300">
                                {p.pending_id}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  p.resolved_at
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                {p.resolved_at ? '已解决' : '待确认'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {p.impact_analysis}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
              <Code2 size={12} className="text-emerald-400" />
              <span className="text-xs text-slate-300 font-medium">
                右：API JSON
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-950 min-w-0">
              {loading ? (
                <div className="text-slate-400 text-sm flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  加载导出数据中...
                </div>
              ) : (
                <pre className="font-mono text-[11px] text-emerald-300 whitespace-pre-wrap leading-relaxed">
                  {exportData
                    ? JSON.stringify(exportData, null, 2)
                    : JSON.stringify(
                        {
                          render_source_id: record.render_source_id,
                          scene_annotations: record.scene_annotations,
                          side_notes: record.side_notes,
                          api_response: record.api_response,
                          warnings:
                            unresolvedPending > 0
                              ? [`存在 ${unresolvedPending} 条未解决挂起项`]
                              : [],
                        },
                        null,
                        2
                      )}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
