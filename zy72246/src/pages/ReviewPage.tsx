import { useState, useMemo } from 'react';
import { ShieldAlert, Check, X, AlertTriangle, FileText } from 'lucide-react';
import { usePendingReviewNotes, useAppStore } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { ProcessStepIndicator } from '@/components/ProcessStepIndicator';
import { Layout } from '@/components/Layout';
import { ProcessingStatus, TaxNote, ReviewRecord } from '@/types';

export default function ReviewPage() {
  const pendingNotes = usePendingReviewNotes();
  const dispatch = useAppStore(state => state.dispatch);
  const currentUser = useAppStore(state => state.currentUser);
  const allReviewRecords = useAppStore(state => state.reviewRecords);
  const [selectedNote, setSelectedNote] = useState<TaxNote | null>(null);
  const [reviewOpinion, setReviewOpinion] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewType, setReviewType] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const reviewRecordsByNoteId = useMemo(() => {
    const map: Record<string, ReviewRecord[]> = {};
    for (const note of pendingNotes) {
      map[note.id] = allReviewRecords
        .filter(r => r.taxNoteId === note.id)
        .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
    }
    return map;
  }, [pendingNotes, allReviewRecords]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const openReviewModal = (note: TaxNote, type: 'APPROVED' | 'REJECTED') => {
    setSelectedNote(note);
    setReviewType(type);
    setReviewOpinion('');
    setShowReviewModal(true);
  };

  const handleReview = () => {
    if (!selectedNote || !reviewType || !reviewOpinion.trim()) {
      alert('请填写复核意见');
      return;
    }

    dispatch({
      type: 'REVIEW_RECORD',
      payload: {
        id: selectedNote.id,
        result: reviewType,
        opinion: reviewOpinion,
      },
    });

    setShowReviewModal(false);
    setSelectedNote(null);
    setReviewOpinion('');
    setReviewType(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              风控复核
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              处理金额为0但备注含「冲正」的异常记录
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{pendingNotes.length} 条待复核</span>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <p className="font-medium">风控复核规则</p>
            <ul className="mt-1 space-y-1 text-orange-700">
              <li>• 金额为0且备注含「冲正」关键词的记录，系统自动标记为「已冲正待复核」</li>
              <li>• 此类记录不得直接归为「正常」，必须经过风控同事人工复核</li>
              <li>• 复核通过后状态变为「正常」，可继续后续流程；复核驳回则标记为「已驳回」</li>
              <li>• 所有复核操作全程留痕，支持回滚</li>
            </ul>
          </div>
        </div>

      {pendingNotes.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">暂无待复核记录</h3>
          <p className="text-slate-500">所有冲正记录已处理完毕</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingNotes.map((note) => {
            const reviewRecords = reviewRecordsByNoteId[note.id] || [];
            const hasPreviousReview = reviewRecords.length > 0;

            return (
              <div
                key={note.id}
                className="bg-white rounded-lg border-2 border-orange-300 shadow-sm overflow-hidden"
              >
                <div className="bg-orange-50 px-6 py-4 border-b border-orange-200 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-800">待复核</span>
                    </div>
                    <span className="text-sm text-orange-700">
                      原始行号: <span className="font-mono">{note.originalLineNumber}</span>
                    </span>
                    <span className="text-sm text-orange-700">
                      业务主键: <span className="font-mono text-xs">{note.id}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                      导入时间: {formatDate(note.createdAt)}
                    </span>
                    {hasPreviousReview && (
                      <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">
                        有历史复核记录
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">交易日期</p>
                      <p className="font-medium text-slate-800">{note.tradeDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">证券代码</p>
                      <p className="font-mono font-medium text-slate-800">{note.stockCode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">证券名称</p>
                      <p className="font-medium text-slate-800">{note.stockName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">流水号</p>
                      <p className="font-mono font-medium text-slate-800">{note.serialNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">税费金额</p>
                      <p className="font-mono font-medium text-red-600">HK$ {note.currentAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-xs text-slate-500 mb-2 font-medium">原始备注（不可修改）</p>
                      <p className="text-sm text-slate-800 font-mono bg-white p-3 rounded border border-slate-200">
                        {note.originalRemark}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-xs text-blue-600 mb-2 font-medium">当前备注</p>
                      <p className="text-sm text-slate-800 font-mono bg-white p-3 rounded border border-blue-200">
                        {note.currentRemark}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">柜台流水尾号</p>
                      <p className="font-mono text-slate-800">{note.counterTailNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">当前状态</p>
                      <StatusBadge status={note.processingStatus} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">流程阶段</p>
                      <ProcessStepIndicator currentStep={note.currentStep} />
                    </div>
                  </div>

                  {hasPreviousReview && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center space-x-2">
                        <FileText className="w-4 h-4" />
                        <span>历史复核记录</span>
                      </h4>
                      <div className="space-y-2">
                        {reviewRecords.map((record) => (
                          <div
                            key={record.id}
                            className={`text-sm p-3 rounded ${
                              record.isReversed
                                ? 'bg-gray-100 opacity-60'
                                : record.reviewResult === 'APPROVED'
                                ? 'bg-green-100'
                                : 'bg-red-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-medium ${
                                record.reviewResult === 'APPROVED' ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {record.reviewResult === 'APPROVED' ? '复核通过' : '复核驳回'}
                                {record.isReversed && ' (已回滚)'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {record.reviewedBy} · {formatDate(record.reviewedAt)}
                              </span>
                            </div>
                            <p className="text-gray-700">{record.reviewOpinion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => openReviewModal(note, 'REJECTED')}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>驳回</span>
                    </button>
                    <button
                      onClick={() => openReviewModal(note, 'APPROVED')}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>复核通过</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showReviewModal && selectedNote && reviewType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-medium text-slate-800">
                {reviewType === 'APPROVED' ? '复核通过' : '复核驳回'} - {selectedNote.stockCode} {selectedNote.stockName}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-2">原始备注</p>
                <p className="font-mono text-sm text-slate-800">{selectedNote.originalRemark}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  复核意见 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewOpinion}
                  onChange={(e) => setReviewOpinion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder={
                    reviewType === 'APPROVED'
                      ? '请说明复核通过的依据，如：经核对，该笔冲正属实，为系统测试产生的零金额记录...'
                      : '请说明驳回原因，如：缺少柜台流水尾号核对记录，请补充完整后重新提交...'
                  }
                />
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedNote(null);
                    setReviewOpinion('');
                    setReviewType(null);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleReview}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    reviewType === 'APPROVED'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  确认{reviewType === 'APPROVED' ? '通过' : '驳回'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}
