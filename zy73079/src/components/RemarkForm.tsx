import { useState } from 'react';
import { X, Save, FileText, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { JudgementImpact } from '../types';
import { metricLabel } from '../utils';

type ImpactDraft = Omit<JudgementImpact, 'id'>;

const METRICS: ImpactDraft['metric'][] = ['temperature', 'vibration', 'wear', 'overall'];
const STATUSES: Array<ImpactDraft['beforeStatus']> = ['normal', 'warning', 'anomaly'];
const STATUS_LABEL: Record<ImpactDraft['beforeStatus'], string> = {
  normal: '正常',
  warning: '预警',
  anomaly: '异常',
};

export default function RemarkForm() {
  const {
    showRemarkForm,
    toggleRemarkForm,
    selectedInspectionId,
    inspections,
    attributions,
    addSupplementaryRemark,
  } = useAppStore();

  const selectedInsp = inspections.find((i) => i.id === selectedInspectionId);
  const pendingAttr = attributions.find((a) => a.inspectionId === selectedInspectionId && a.status === 'pending');

  const [author, setAuthor] = useState('维保主管-阿敏');
  const [content, setContent] = useState('');
  const [impacts, setImpacts] = useState<ImpactDraft[]>([]);

  if (!showRemarkForm) return null;

  function addImpact() {
    const draft: ImpactDraft = {
      metric: pendingAttr?.relatedMetric || 'temperature',
      beforeStatus: pendingAttr ? 'anomaly' : 'warning',
      afterStatus: 'warning',
      reason: '',
    };
    setImpacts([...impacts, draft]);
  }

  function updateImpact(idx: number, patch: Partial<ImpactDraft>) {
    setImpacts(impacts.map((im, i) => (i === idx ? { ...im, ...patch } : im)));
  }

  function removeImpact(idx: number) {
    setImpacts(impacts.filter((_, i) => i !== idx));
  }

  function reset() {
    setContent('');
    setImpacts([]);
    toggleRemarkForm(false);
  }

  function handleSubmit() {
    if (!selectedInspectionId) {
      alert('请先选择一条巡检记录');
      return;
    }
    if (!content.trim()) {
      alert('请输入备注内容');
      return;
    }
    if (!author.trim()) {
      alert('请输入填写人');
      return;
    }
    const validImpacts = impacts.filter((i) => i.reason.trim());
    addSupplementaryRemark({
      inspectionId: selectedInspectionId,
      content: content.trim(),
      author: author.trim(),
      impacts: validImpacts,
    });
    reset();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-amber-400" />
            <h3 className="text-slate-100 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              换班前补录备注
            </h3>
          </div>
          <button
            onClick={reset}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {selectedInsp ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              📌 将补录到巡检：<span className="font-mono font-medium text-amber-200">
                {new Date(selectedInsp.inspectionTime).toLocaleString('zh-CN')}
              </span>（{selectedInsp.inspector} · 设备 {selectedInsp.deviceId}）
            </div>
          ) : (
            <div className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-300 flex items-center gap-1.5">
              <AlertCircle size={13} />
              请先在左侧选择一条巡检记录
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">填写人</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-slate-700 bg-slate-800 text-slate-100 focus:border-blue-500 focus:outline-none"
              placeholder="例如：维保主管-阿敏"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              备注内容 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm rounded border border-slate-700 bg-slate-800 text-slate-100 focus:border-blue-500 focus:outline-none resize-none font-mono leading-relaxed"
              placeholder="请详细描述现场情况、原因分析、处理建议…（将保存为换班前临时补录备注，时间戳自动记录）"
            />
          </div>

          <div className="rounded border border-slate-700 bg-slate-800/40 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <div className="text-sm text-slate-200 font-medium">
                  此备注改变了哪些判断？
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  说明：系统将根据这些变更更新归因结论，并在历史追溯链中显示
                </div>
              </div>
              <button
                onClick={addImpact}
                className="px-2.5 py-1 text-xs rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition"
              >
                + 添加影响项
              </button>
            </div>
            {impacts.length === 0 && (
              <p className="text-xs text-slate-500 italic py-2">
                暂无影响项，若此备注不改变任何判断可留空
              </p>
            )}
            <div className="space-y-2">
              {impacts.map((imp, idx) => (
                <div
                  key={idx}
                  className="rounded border border-slate-700 bg-slate-900/60 p-2.5 space-y-2"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">指标</label>
                      <select
                        value={imp.metric}
                        onChange={(e) => updateImpact(idx, { metric: e.target.value as any })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
                      >
                        {METRICS.map((m) => (
                          <option key={m} value={m}>{metricLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">变更前</label>
                      <select
                        value={imp.beforeStatus}
                        onChange={(e) => updateImpact(idx, { beforeStatus: e.target.value as any })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">变更后</label>
                      <select
                        value={imp.afterStatus}
                        onChange={(e) => updateImpact(idx, { afterStatus: e.target.value as any })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <input
                      value={imp.reason}
                      onChange={(e) => updateImpact(idx, { reason: e.target.value })}
                      placeholder="理由：（说明为什么改变判断）"
                      className="flex-1 px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
                    />
                    <button
                      onClick={() => removeImpact(idx)}
                      className="px-2 py-1 text-xs rounded text-slate-400 hover:bg-slate-700 hover:text-red-400 transition"
                      title="移除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-5 py-3 flex items-center justify-end gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-xs rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs rounded bg-orange-500 hover:bg-orange-600 text-white font-medium transition flex items-center gap-1.5 shadow"
          >
            <Save size={13} /> 保存补录备注
          </button>
        </div>
      </div>
    </div>
  );
}
