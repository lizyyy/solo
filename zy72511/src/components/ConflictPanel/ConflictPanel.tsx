import React, { useState } from 'react';
import { AlertTriangle, Check, X, MessageSquare } from 'lucide-react';
import { ConflictEvidence } from '../../types';
import { useStore } from '../../store/useStore';

interface ConflictPanelProps {
  sampleId: string;
  evidence: ConflictEvidence;
  status: string;
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({
  sampleId,
  evidence,
  status
}) => {
  const { confirmSample, rejectSample, currentUser } = useStore();
  const [remark, setRemark] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState<'confirm' | 'reject' | null>(null);

  const handleConfirm = () => {
    if (!remark.trim()) {
      alert('请填写确认原因');
      return;
    }
    confirmSample(sampleId, remark, currentUser.name, currentUser.role);
    setShowConfirmModal(null);
    setRemark('');
  };

  const handleReject = () => {
    if (!remark.trim()) {
      alert('请填写驳回原因');
      return;
    }
    rejectSample(sampleId, remark, currentUser.name, currentUser.role);
    setShowConfirmModal(null);
    setRemark('');
  };

  return (
    <div className="border-2 border-red-200 rounded-lg overflow-hidden animate-pulse-slow">
      <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-600" />
        <span className="font-medium text-red-800">冲突证据</span>
        <span className="text-xs text-red-600 ml-auto">脱敏规则备注与灰度批次存在矛盾</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-2">脱敏规则备注主张</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {evidence.desensitizationClaim}
            </p>
          </div>
          <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
            <p className="text-xs font-medium text-violet-700 mb-2">灰度批次信息主张</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {evidence.grayBatchClaim}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">冲突点</p>
          <ul className="space-y-1">
            {evidence.conflictPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-red-500 mt-0.5">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {(status === 'conflict' || status === 'pending_review') && (
          <div className="pt-4 border-t border-slate-200">
            {status === 'conflict' && (
              <p className="text-sm text-slate-600 mb-3">
                请 AI 产品经理阿宁选择：确认或驳回，不要自动拍板
              </p>
            )}
            {status === 'pending_review' && (
              <div className="mb-3">
                <p className="text-sm text-amber-600 font-medium">
                  已提交运营复核，请运营复核人最终确认：
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  模型版本换了但样本编号没变，您来拍板最终以哪方为准
                </p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  <MessageSquare size={12} className="inline mr-1" />
                  决策原因（必填）
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="请输入决策原因，该原因将记录到历史中..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmModal('confirm')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors"
                >
                  <Check size={16} />
                  {status === 'pending_review' ? '运营确认：以脱敏规则为准' : '确认脱敏规则主张'}
                </button>
                <button
                  onClick={() => setShowConfirmModal('reject')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  <X size={16} />
                  {status === 'pending_review' ? '运营确认：以灰度批次为准' : '确认灰度批次主张'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {showConfirmModal === 'confirm' ? '确认操作' : '驳回操作'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {showConfirmModal === 'confirm'
                ? '确定要以脱敏规则备注为准吗？此操作将记录到历史中。'
                : '确定要以灰度批次信息为准吗？此操作将记录到历史中。'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={showConfirmModal === 'confirm' ? handleConfirm : handleReject}
                className={`px-4 py-2 text-sm text-white rounded transition-colors ${
                  showConfirmModal === 'confirm'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
