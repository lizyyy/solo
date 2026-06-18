import { X, GitBranch, FileWarning } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/store/useStore';

interface ChangeRecordDialogProps {
  materialId: string;
  previousConclusion: string;
  onClose: () => void;
}

export function ChangeRecordDialog({ materialId, previousConclusion, onClose }: ChangeRecordDialogProps) {
  const addRecord = useStore((state) => state.addRecord);

  const [formData, setFormData] = useState({
    content: '',
    operator: '阿宁',
    newConclusion: '',
    reason: '',
    changeOrderNo: '',
    hasChangeOrder: false,
    changeOrderLate: false,
    remark: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.newConclusion.trim() || !formData.reason.trim()) return;

    addRecord({
      materialId,
      type: 'change',
      content: formData.content || '变更结论',
      operator: formData.operator.trim(),
      previousConclusion,
      newConclusion: formData.newConclusion.trim(),
      reason: formData.reason.trim(),
      changeOrderNo: formData.changeOrderNo.trim(),
      hasChangeOrder: formData.hasChangeOrder,
      changeOrderLate: formData.changeOrderLate,
      remark: formData.remark.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-industrial-800 border border-industrial-700 rounded-lg w-full max-w-lg mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-primary-700/50 bg-primary-900/20">
          <h3 className="text-lg font-semibold text-primary-300 flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            提交变更记录
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-industrial-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-industrial-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="bg-primary-900/20 border border-primary-700/50 rounded p-3">
            <p className="text-xs text-primary-400 mb-1">当前结论（将被替换）：</p>
            <p className="text-sm text-primary-200">「{previousConclusion}」</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">操作人</label>
              <input
                type="text"
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">变更摘要</label>
              <input
                type="text"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="例如：更新检测结论"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="label-field">新结论 *</label>
            <textarea
              value={formData.newConclusion}
              onChange={(e) => setFormData({ ...formData, newConclusion: e.target.value })}
              placeholder="请输入变更后的结论..."
              className="input-field resize-none h-20"
              required
            />
          </div>

          <div>
            <label className="label-field">变更原因 *</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="请详细说明变更原因，例如：重新检测、设计变更、现场条件变化等..."
              className="input-field resize-none h-20"
              required
            />
          </div>

          <div className="bg-industrial-900/50 rounded p-3 border border-industrial-700 space-y-3">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-warning-400" />
              <span className="text-sm font-medium text-industrial-200">变更单信息</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasChangeOrder}
                onChange={(e) => setFormData({ ...formData, hasChangeOrder: e.target.checked })}
                className="w-4 h-4 rounded border-industrial-600 bg-industrial-800 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-industrial-300">已有正式变更单</span>
            </label>

            {formData.hasChangeOrder && (
              <>
                <div>
                  <label className="label-field">变更单号</label>
                  <input
                    type="text"
                    value={formData.changeOrderNo}
                    onChange={(e) => setFormData({ ...formData, changeOrderNo: e.target.value })}
                    placeholder="例如：BG-2024-045"
                    className="input-field font-mono"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.changeOrderLate}
                    onChange={(e) => setFormData({ ...formData, changeOrderLate: e.target.checked })}
                    className="w-4 h-4 rounded border-industrial-600 bg-industrial-800 text-warning-500 focus:ring-warning-500"
                  />
                  <span className="text-sm text-industrial-300">
                    变更单晚到（将标记为异常并生成处理建议）
                  </span>
                </label>
              </>
            )}
          </div>

          <div>
            <label className="label-field">备注说明</label>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              placeholder="补充说明信息，如同步情况、后续处理等..."
              className="input-field resize-none h-16"
            />
          </div>

          {!formData.hasChangeOrder && (
            <div className="bg-warning-900/20 border border-warning-700/50 rounded p-3">
              <p className="text-xs text-warning-400">
                <span className="font-medium">提示：</span>
                未填写变更单将被标记为异常状态。请尽快补充变更单以确保材料追踪的完整性。
              </p>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-700">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.newConclusion.trim() || !formData.reason.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认变更
          </button>
        </div>
      </div>
    </div>
  );
}
