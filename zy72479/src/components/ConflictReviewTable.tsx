import { useState } from 'react';
import { ConflictItem, Evidence, conflictStatusLabels } from '../types';
import { AlertCircle, CheckCircle, XCircle, MessageSquare, Clock } from 'lucide-react';
import { useCaseStore } from '../store/useCaseStore';

interface ConflictReviewTableProps {
  conflicts: ConflictItem[];
  evidences: Evidence[];
  caseId: string;
}

export function ConflictReviewTable({ conflicts, evidences, caseId }: ConflictReviewTableProps) {
  const { updateConflictStatus, simulateStep3ConflictReview } = useCaseStore();
  const [remark, setRemark] = useState('');
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null);

  const getEvidenceById = (id: string) => evidences.find(e => e.id === id);

  const handleConfirm = (conflictId: string) => {
    updateConflictStatus(conflictId, 'confirmed', '小姜', remark || undefined);
    simulateStep3ConflictReview(caseId);
    setRemark('');
    setActiveConflictId(null);
  };

  const handleReject = (conflictId: string) => {
    updateConflictStatus(conflictId, 'rejected', '小姜', remark || undefined);
    simulateStep3ConflictReview(caseId);
    setRemark('');
    setActiveConflictId(null);
  };

  if (conflicts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-800 mb-1">无证据冲突</h3>
          <p className="text-sm text-gray-500">路口照片与公交刷卡时段证据一致，无需复核</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-gray-100 bg-danger-50 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-danger-500" />
        <h3 className="text-sm font-semibold text-gray-800">冲突复核表</h3>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
          {conflicts.filter(c => c.status === 'pending').length} 项待处理
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {conflicts.map((conflict) => {
          const evidenceA = getEvidenceById(conflict.evidenceAId);
          const evidenceB = getEvidenceById(conflict.evidenceBId);
          const isExpanded = activeConflictId === conflict.id;
          const isPending = conflict.status === 'pending';

          return (
            <div key={conflict.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" />
                    <h4 className="text-sm font-medium text-gray-900">冲突点</h4>
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                        conflict.status === 'pending'
                          ? 'bg-warning-100 text-warning-700'
                          : conflict.status === 'confirmed'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {conflictStatusLabels[conflict.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 bg-danger-50 p-3 rounded border border-danger-100">
                    {conflict.conflictPoint}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                  <p className="text-xs font-medium text-primary-700 mb-2">路口照片证据</p>
                  {evidenceA ? (
                    <>
                      <p className="text-sm font-medium text-gray-900 mb-1">{evidenceA.title}</p>
                      <p className="text-xs text-gray-600 line-clamp-3">{evidenceA.description}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">证据不存在</p>
                  )}
                </div>
                <div className="p-4 rounded-lg border border-green-200 bg-green-50">
                  <p className="text-xs font-medium text-success-700 mb-2">公交刷卡时段证据</p>
                  {evidenceB ? (
                    <>
                      <p className="text-sm font-medium text-gray-900 mb-1">{evidenceB.title}</p>
                      <p className="text-xs text-gray-600 line-clamp-3">{evidenceB.description}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">证据不存在</p>
                  )}
                </div>
              </div>

              {!isPending && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      复核人：{conflict.reviewer}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {conflict.reviewedAt}
                    </span>
                  </div>
                  {conflict.remark && (
                    <p className="mt-2 text-gray-600 flex items-start gap-1.5">
                      <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      备注：{conflict.remark}
                    </p>
                  )}
                </div>
              )}

              {isPending && (
                <div>
                  <button
                    onClick={() => setActiveConflictId(isExpanded ? null : conflict.id)}
                    className="text-sm text-primary-700 hover:text-primary-800 font-medium"
                  >
                    {isExpanded ? '收起复核操作' : '展开复核操作 →'}
                  </button>

                  {isExpanded && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          复核备注（可选）
                        </label>
                        <textarea
                          value={activeConflictId === conflict.id ? remark : ''}
                          onChange={(e) => setRemark(e.target.value)}
                          placeholder="请填写复核意见..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleConfirm(conflict.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success-600 text-white rounded-md text-sm font-medium hover:bg-success-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          确认冲突，采信两边证据
                        </button>
                        <button
                          onClick={() => handleReject(conflict.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-danger-600 text-white rounded-md text-sm font-medium hover:bg-danger-700 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          驳回冲突，需补充材料
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        ⚠️ 请小姜人工选择确认或驳回，系统不会自动拍板
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
