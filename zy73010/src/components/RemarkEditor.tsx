import { useEffect, useState } from 'react';
import type { ReviewRemark, ReviewStatus } from '../../shared/types.js';
import { StatusBadge, AnomalyBadge } from './StatusBadge.js';
import { Send, Plus, RefreshCw, FileCheck } from 'lucide-react';

interface Props {
  recordId: string;
  remarks: ReviewRemark[];
  loading: boolean;
  supplementLoading: boolean;
  onSave: (content: string, status: ReviewStatus) => Promise<void>;
  onSupplement: (content: string) => Promise<{ exportId: string; changeDescription: string } | null>;
  onNavigateExport?: () => void;
}

const statusOptions: { value: ReviewStatus; label: string; color: string }[] = [
  { value: 'pending', label: '待复核', color: 'bg-accent-300/20 border-accent-400/50 text-accent-500 hover:bg-accent-300/30' },
  { value: 'approved', label: '复核通过', color: 'bg-brand-100 border-brand-300/50 text-brand-700 hover:bg-brand-200/50' },
  { value: 'exception', label: '存在异常', color: 'bg-warn-400/15 border-warn-400/50 text-warn-600 hover:bg-warn-400/25' },
  { value: 'needsInfo', label: '需补充信息', color: 'bg-warn-400/10 border-warn-400/40 text-warn-600 hover:bg-warn-400/20' },
];

export function RemarkEditor({
  recordId, remarks, loading, supplementLoading, onSave, onSupplement, onNavigateExport,
}: Props) {
  const sorted = [...remarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  const [content, setContent] = useState(latest?.content || '');
  const [status, setStatus] = useState<ReviewStatus>(latest?.status || 'pending');
  const [supplement, setSupplement] = useState('');
  const [lastChange, setLastChange] = useState<string | null>(null);

  useEffect(() => {
    if (latest) {
      setContent(latest.isSupplement ? sorted.find(r => !r.isSupplement)?.content || latest.content : latest.content);
      setStatus(latest.status);
    }
  }, [recordId]);

  const handleSave = async () => {
    if (!content.trim()) return;
    await onSave(content.trim(), status);
  };

  const handleSupplement = async () => {
    if (!supplement.trim()) return;
    const res = await onSupplement(supplement.trim());
    if (res) {
      setLastChange(res.changeDescription);
      setSupplement('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="label">复核状态</div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(opt => (
            <button key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all duration-200
                ${status === opt.value ? `${opt.color} ring-2 ring-offset-1 ring-brand-400/40 scale-105` : 'bg-white border-ink-200 text-ink-500 hover:bg-ink-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label flex items-center justify-between">
          <span>复核备注（修改后自动同步后端数据和导出结果）</span>
          <StatusBadge status={status} size="sm" />
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          className="input-base resize-none focus:shadow-glow"
          placeholder="请输入复核结论备注，例如：6月4日体重下降经主人确认系换粮导致，恢复中..."
        />
        <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-ink-500">
            <RefreshCw size={12} className="text-brand-500" />
            <span>保存后将自动同步至：复核记录 / 异常队列 / 导出缓存</span>
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !content.trim()}
            className="btn-primary">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            保存并同步
          </button>
        </div>
      </div>

      <div className="border-t border-ink-100 pt-4">
        <div className="label flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Plus size={12} /> 补录备注（完成复核后追加）
          </span>
          <AnomalyBadge kind="supplement" />
        </div>
        <textarea
          value={supplement}
          onChange={e => setSupplement(e.target.value)}
          rows={2}
          className="input-base resize-none"
          placeholder="补录将生成导出变更说明，用于记录复核完成后的补充信息..."
        />
        <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-ink-500">
            补录后系统自动生成前后版本差异对比，说明本次补录让导出发生了哪些变更
          </span>
          <button
            onClick={handleSupplement}
            disabled={supplementLoading || !supplement.trim()}
            className="btn-secondary">
            {supplementLoading ? <RefreshCw size={14} className="animate-spin" /> : <FileCheck size={14} />}
            补录并生成变更说明
          </button>
        </div>
      </div>

      {lastChange && (
        <div className="animate-slide-down rounded-xl border-2 border-brand-200 bg-brand-50/50 p-3.5">
          <div className="flex items-start gap-2.5">
            <FileCheck size={18} className="text-brand-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-brand-700 mb-0.5">✅ 补录变更说明已生成</div>
              <div className="text-ink-600 leading-relaxed">{lastChange}</div>
              {onNavigateExport && (
                <button onClick={onNavigateExport} className="mt-2 text-xs text-brand-600 font-medium hover:underline">
                  → 前往导出中心查看详细差异对比
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="border-t border-ink-100 pt-4 space-y-2.5">
          <div className="label">备注历史（共 {sorted.length} 条）</div>
          <div className="space-y-2">
            {sorted.map(r => (
              <div key={r.id} className={`rounded-xl border p-3 text-sm ${
                r.isSupplement
                  ? 'bg-brand-50/40 border-brand-200/70'
                  : 'bg-ink-50/60 border-ink-100'
              }`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {r.isSupplement && <AnomalyBadge kind="supplement" />}
                  <StatusBadge status={r.status} size="sm" />
                  <span className="text-[11px] text-ink-500">{r.operator}</span>
                  <span className="text-[11px] text-ink-300 ml-auto">
                    {r.createdAt.replace('T', ' ').slice(0, 16)}
                  </span>
                </div>
                <p className="text-ink-700 leading-relaxed">{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
