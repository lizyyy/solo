import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, MessageSquare, FileCheck, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { useClaimStore } from '../store/useClaimStore';
import { StatusBadge } from '../components/claim/StatusBadge';
import { ProcessSteps } from '../components/claim/ProcessSteps';
import { EvidenceTimeline } from '../components/claim/EvidenceTimeline';
import { EvidenceCard } from '../components/claim/EvidenceCard';
import { ConflictTable } from '../components/claim/ConflictTable';
import { ImportModal } from '../components/claim/ImportModal';
import { ReviewModal } from '../components/claim/ReviewModal';
import { VerifyModal } from '../components/claim/VerifyModal';
import type { ConflictItem } from '../types/claim';

export function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, importManualJudgment, reviewPromptVersion, resolveConflict, resolveAllConflicts, verifyDuplicate } = useClaimStore();
  const record = id ? getRecordById(id) : undefined;

  const [showImportModal, setShowImportModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  useEffect(() => {
    if (id && !record) {
      navigate('/list');
    }
  }, [id, record, navigate]);

  if (!record) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleImportSubmit = (data: { conclusion: string; evidences: { field: string; value: string; remark?: string }[] }) => {
    if (record) {
      importManualJudgment(record.id, data);
    }
  };

  const handleReviewSubmit = (data: {
    version: string;
    conclusion: string;
    isOldCriteria: boolean;
    evidences: { field: string; value: string; remark?: string }[];
  }) => {
    if (record) {
      reviewPromptVersion(record.id, data);
    }
  };

  const handleResolveConflict = (conflictId: string, resolution: ConflictItem['resolution']) => {
    if (record) {
      resolveConflict(record.id, conflictId, resolution);
    }
  };

  const handleResolveAll = (resolution: ConflictItem['resolution']) => {
    if (record) {
      resolveAllConflicts(record.id, resolution);
    }
  };

  const handleVerify = (result: 'approved' | 'rejected', remark: string) => {
    if (record) {
      verifyDuplicate(record.id, result, remark);
    }
  };

  const hasConflicts = record.conflicts && record.conflicts.length > 0;
  const needsVerification = record.status === 'pending_verify';

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/list')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {record.userName} - {record.materialType}
                </h1>
                <StatusBadge status={record.status} resultType={record.resultType} />
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span>记录编号：{record.id}</span>
                <span>用户编号：{record.userId}</span>
                <span>提交时间：{record.submitTime}</span>
              </div>
            </div>
          </div>
          <ProcessSteps record={record} />
        </div>

        {needsVerification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Users size={20} className="text-amber-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800">待标注负责人复核</h3>
                  <p className="text-sm text-amber-700">检测到同一用户疑似重复提交，不急着归为正常，请标注负责人复核</p>
                </div>
              </div>
              <button
                onClick={() => setShowVerifyModal(true)}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
              >
                去复核
              </button>
            </div>
          </div>
        )}

        {hasConflicts && (
          <div className="mb-5">
            <ConflictTable
              conflicts={record.conflicts!}
              onResolve={handleResolveConflict}
              onResolveAll={handleResolveAll}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <h3 className="font-semibold text-blue-800">人工改判表（主流程）</h3>
              </div>
              {record.manualJudgment ? (
                <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                  <FileCheck size={12} />
                  已导入
                </span>
              ) : (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  第一步：导入
                </button>
              )}
            </div>
            <div className="p-5">
              {record.manualJudgment ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-md">
                    <div className="text-xs text-blue-600 mb-1">审核结论</div>
                    <div className="text-sm font-medium text-blue-800">{record.manualJudgment.conclusion}</div>
                    <div className="text-xs text-blue-600 mt-2">
                      操作人：{record.manualJudgment.operator} · {record.manualJudgment.importedAt}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-500">证据明细</div>
                    {record.manualJudgment.evidences.map((ev) => (
                      <EvidenceCard key={ev.id} evidence={ev} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">尚未导入人工改判表</p>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    点击导入 →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-purple-600" />
                <h3 className="font-semibold text-purple-800">提示词版本号（现场说法）</h3>
                {record.promptVersion?.isOldCriteria && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                    <AlertTriangle size={10} />
                    旧口径
                  </span>
                )}
              </div>
              {record.promptVersion ? (
                <span className="inline-flex items-center gap-1 text-xs text-purple-700">
                  <FileCheck size={12} />
                  已补看
                </span>
              ) : record.manualJudgment ? (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 transition-colors"
                >
                  第二步：补看
                </button>
              ) : (
                <span className="text-xs text-gray-400">请先完成第一步</span>
              )}
            </div>
            <div className="p-5">
              {record.promptVersion ? (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 rounded-md">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-purple-600">提取结论</div>
                      <div className="text-xs text-purple-600">版本 {record.promptVersion.version}</div>
                    </div>
                    <div className="text-sm font-medium text-purple-800">{record.promptVersion.conclusion}</div>
                    <div className="text-xs text-purple-600 mt-2">
                      操作人：{record.promptVersion.operator} · {record.promptVersion.reviewedAt}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-500">证据明细</div>
                    {record.promptVersion.evidences.map((ev) => (
                      <EvidenceCard key={ev.id} evidence={ev} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">
                    {record.manualJudgment ? '小孟尚未补看提示词版本号' : '请先导入人工改判表'}
                  </p>
                  {record.manualJudgment && (
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      点击补看 →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {record.finalConclusion && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-800 mb-0.5">最终结论</h3>
                <p className="text-emerald-700">{record.finalConclusion}</p>
                {record.verification && (
                  <p className="text-xs text-emerald-600 mt-1">
                    复核人：{record.verification.verifier} · 备注：{record.verification.remark || '无'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <EvidenceTimeline timeline={record.timeline} />
      </div>

      <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onSubmit={handleImportSubmit} />
      <ReviewModal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} onSubmit={handleReviewSubmit} />
      <VerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSubmit={handleVerify}
        recordId={record.id}
        duplicateRecordIds={record.duplicateRecordIds}
      />
    </div>
  );
}
