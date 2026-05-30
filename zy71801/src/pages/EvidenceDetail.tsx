import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Info,
  AlertTriangle,
  User,
  Calendar,
  CheckSquare
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { TimelineCard } from '../components/TimelineCard';
import { StatusBadge } from '../components/StatusBadge';
import { sortEvidenceByTime, getSeverityColor } from '../utils/judgmentEngine';
import { format } from 'date-fns';
import type { ReviewAction } from '../types';

export function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentPack, isLoading, loadPackDetail, addReview, setPackStatus } = useStore();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<ReviewAction>('confirm');
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    if (id) {
      loadPackDetail(id);
    }
  }, [id, loadPackDetail]);

  const handleSubmitReview = async () => {
    if (!currentPack || !reviewComment.trim()) return;
    
    await addReview({
      id: `review-${Date.now()}`,
      packId: currentPack.id,
      reviewer: '当前用户',
      reviewedAt: new Date(),
      action: reviewAction,
      comment: reviewComment
    });

    if (reviewAction === 'confirm') {
      await setPackStatus(currentPack.id, 'completed');
    }
    
    setShowReviewModal(false);
    setReviewComment('');
  };

  if (!currentPack) {
    return (
      <div className="p-8">
        <button 
          onClick={() => navigate('/evidence')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <div className="text-center py-12 text-gray-500">
          {isLoading ? '加载中...' : '未找到证据包'}
        </div>
      </div>
    );
  }

  const sortedEvidence = sortEvidenceByTime(currentPack);
  const judgment = currentPack.judgmentResult;

  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/evidence')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1 className="text-xl font-serif font-bold text-gray-900">
                {currentPack.name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(currentPack.importedAt), 'yyyy-MM-dd HH:mm')}
                </span>
                {currentPack.reviewer && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {currentPack.reviewer}
                  </span>
                )}
                <StatusBadge status={currentPack.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出报告
            </button>
            {judgment && (
              <button 
              onClick={() => setShowReviewModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              复核确认
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">证据时间线</h2>
            <div className="space-y-1">
              {sortedEvidence.map((evidence, index) => (
                <TimelineCard
                  key={evidence.id}
                  evidence={evidence}
                  isFirst={index === 0}
                  isLast={index === sortedEvidence.length - 1}
                />
              ))}
            </div>

            {currentPack.reviewRecords.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">复核记录</h3>
                <div className="space-y-3">
                  {currentPack.reviewRecords.map((record) => (
                    <div key={record.id} className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{record.reviewer}</span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(record.reviewedAt), 'yyyy-MM-dd HH:mm')}
                          </span>
                        </div>
                        <span className={`status-badge ${
                          record.action === 'confirm' ? 'bg-success-100 text-success-600' :
                          record.action === 'reject' ? 'bg-danger-100 text-danger-500' :
                          'bg-warning-100 text-warning-600'
                        }`}>
                          {record.action === 'confirm' ? '确认通过' :
                           record.action === 'reject' ? '驳回' :
                           record.action === 'supplement' ? '需补充' : '更正记录'}
                        </span>
                      </div>
                      <p className="text-gray-700 mt-2">{record.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {judgment && (
          <div className="w-96 border-l bg-white overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">自动判断结果</h2>
              
              <div className={`rounded-lg p-4 mb-6 ${
                judgment.conclusion === 'normal' ? 'bg-success-50 border-success-200' :
                judgment.conclusion === 'need_supplement' ? 'bg-danger-50 border-danger-200' :
                'bg-warning-50 border-warning-200'
              } border`}>
                <div className="flex items-center gap-3">
                  {judgment.conclusion === 'normal' ? (
                    <CheckCircle className="w-6 h-6 text-success-600" />
                  ) : judgment.conclusion === 'need_supplement' ? (
                    <AlertCircle className="w-6 h-6 text-danger-500" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-warning-500" />
                  )}
                  <div>
                      <div className="font-semibold text-gray-900">
                        {judgment.conclusion === 'normal' ? '证据链正常' :
                         judgment.conclusion === 'need_supplement' ? '需要补充材料' :
                         '需要人工复核'}
                      </div>
                      <div className="text-sm text-gray-600">
                        置信度：{Math.round(judgment.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    判断理由
                  </h3>
                  <div className="space-y-3">
                    {judgment.reasons.map((reason) => (
                      <div
                        key={reason.ruleCode}
                        className="rounded-lg p-3 border"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {reason.ruleName}
                          </span>
                          <span className={`status-badge ${getSeverityColor(reason.severity)}`}>
                            {reason.severity === 'error' ? '错误' :
                             reason.severity === 'warning' ? '警告' : '提示'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{reason.description}</p>
                        <div className="text-xs text-gray-400 mt-1">
                          规则编号：{reason.ruleCode}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    下一步操作
                  </h3>
                  <p className="text-sm font-medium text-gray-900 mb-3">
                    {judgment.nextStep}
                  </p>
                  <ul className="space-y-2">
                    {judgment.nextStepDetails.map((step, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-primary-600 font-medium">{idx + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">复核确认</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  复核操作
                </label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value as ReviewAction)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="confirm">确认通过</option>
                  <option value="reject">驳回</option>
                  <option value="supplement">需补充材料</option>
                  <option value="correction">记录更正</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  复核意见
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入复核意见..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowReviewModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={!reviewComment.trim()}
                className="btn-primary"
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
