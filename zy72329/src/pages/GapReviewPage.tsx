import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, XCircle, User, Shield, FileText, ListChecks } from 'lucide-react';
import { api } from '../lib/api';
import { useDataStore } from '../store/dataStore';
import { useAuthStore } from '../store/authStore';
import { GapRecord, GapReviewStatus } from '../../shared/types';
import { cn } from '../lib/utils';

const warningPattern = {
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(251, 146, 60, 0.15) 4px, rgba(251, 146, 60, 0.15) 8px)',
};

export default function GapReviewPage() {
  const { gaps, records, loading, refreshAll, refreshGaps, getRecordById, getHistoryByRecordId } = useDataStore();
  const { user: currentUser } = useAuthStore();
  const [selectedGap, setSelectedGap] = useState<GapRecord | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (gaps.length === 0) {
      refreshGaps();
    }
  }, [gaps.length, refreshGaps]);

  const handleSelectGap = (gap: GapRecord) => {
    if (gap.reviewStatus !== 'pending') return;
    if (selectedGap?.id === gap.id) {
      setSelectedGap(null);
      setReviewNote('');
      return;
    }
    setSelectedGap(gap);
    setReviewNote('');
  };

  const handleReview = async (status: GapReviewStatus) => {
    if (!selectedGap) return;
    if (!reviewNote.trim()) {
      alert('请填写复核意见');
      return;
    }
    setReviewing(true);
    try {
      await api.reviewGap(selectedGap.id, status, reviewNote);
      await refreshAll();
      setSelectedGap(null);
      setReviewNote('');
    } catch (error) {
      console.error('复核断档失败:', error);
      alert('复核失败，请重试');
    } finally {
      setReviewing(false);
    }
  };

  const pendingGaps = gaps.filter((g) => g.reviewStatus === 'pending');
  const reviewedGaps = gaps.filter((g) => g.reviewStatus !== 'pending');

  const getNextHandlerLabel = (gap: GapRecord): string => {
    if (gap.reviewStatus === 'pending') return '教研组';
    if (gap.reviewStatus === 'normal') return '唐老师确认 / 归档';
    if (gap.reviewStatus === 'abnormal') return '唐老师确认 / 归档';
    return '唐老师确认 / 归档';
  };

  const GapCard = ({ gap }: { gap: GapRecord }) => {
    const isSelected = selectedGap?.id === gap.id;
    const isPending = gap.reviewStatus === 'pending';
    const record = getRecordById(gap.recordId);
    const gapHistory = gap.recordId ? getHistoryByRecordId(gap.recordId) : [];
    const latestReason = gapHistory.length > 0 ? gapHistory[gapHistory.length - 1] : null;
    let parsedReason = '';
    if (latestReason?.afterState) {
      const state = latestReason.afterState;
      if (typeof state === 'object') {
        parsedReason = state.reason || '';
      } else {
        try {
          const parsed = JSON.parse(state);
          parsedReason = parsed.reason || '';
        } catch {}
      }
    }

    return (
      <div
        key={gap.id}
        className={cn(
          'border rounded-xl overflow-hidden transition-all',
          isPending && 'cursor-pointer',
          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-orange-300',
          !isPending && 'opacity-75'
        )}
        style={isPending ? warningPattern : undefined}
        onClick={() => handleSelectGap(gap)}
      >
        <div className={cn(
          'p-4',
          isPending ? 'bg-orange-50/80' : 'bg-white'
        )}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                isPending ? 'bg-orange-100 text-orange-600' :
                gap.reviewStatus === 'normal' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              )}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-medium text-gray-900">
                    {record?.recordNo || gap.recordId}
                  </span>
                  {record?.teacherName && (
                    <span className="text-sm text-gray-600">{record.teacherName}</span>
                  )}
                  {!isPending && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      gap.reviewStatus === 'normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    )}>
                      {gap.reviewStatus === 'normal' ? '复核正常' : '复核异常'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  创建时间：{gap.createdAt}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {isPending ? (
                <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded-lg">
                  待复核
                </span>
              ) : (
                gap.reviewStatus === 'normal' ? (
                  <span className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-lg flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> 已复核正常
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> 已复核异常
                  </span>
                )
              )}
              <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                <Shield className="w-3 h-3" />
                下一步：{getNextHandlerLabel(gap)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-orange-200 p-4">
            <div className="text-xs font-semibold text-orange-700 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              原始说法：编号序列跳号，疑似人工删除
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                  <span className="font-mono text-sm font-bold text-gray-700">{gap.previousRecordNo}</span>
                </div>
                <span className="text-xs text-gray-500 mt-1">前一编号</span>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-50 rounded-lg border-2 border-red-300 border-dashed flex items-center justify-center relative">
                  <span className="font-mono text-2xl font-bold text-red-500">?</span>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                    MISSING
                  </div>
                </div>
                <span className="text-xs text-red-600 mt-2 font-medium">{gap.missingRecordNo}</span>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                  <span className="font-mono text-sm font-bold text-gray-700">{gap.nextRecordNo}</span>
                </div>
                <span className="text-xs text-gray-500 mt-1">后一编号</span>
              </div>
            </div>
            <div className="mt-4 text-center text-xs text-gray-500">
              编号序列：{gap.previousRecordNo} → [缺失 {gap.missingRecordNo}] → {gap.nextRecordNo}
            </div>
          </div>

          {isPending && parsedReason && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                处理原因（待复核）
              </div>
              <p className="text-sm text-amber-800">{parsedReason}</p>
            </div>
          )}

          {!isPending && gap.reviewNote && (
            <div className={cn(
              'mt-4 p-3 rounded-lg border',
              gap.reviewStatus === 'normal' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            )}>
              <div className="text-xs font-medium text-gray-600 mb-1">复核意见</div>
              <p className="text-sm text-gray-700">{gap.reviewNote}</p>
              {gap.reviewedBy && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {gap.reviewedBy} · {gap.reviewedAt}
                </p>
              )}
            </div>
          )}
        </div>

        {isSelected && isPending && (
          <div className="border-t border-orange-200 bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  复核意见 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="请输入复核意见（必填），说明断档原因或处理方式"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                />
                {currentUser && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    操作人：{currentUser.name} ({currentUser.role === 'reviewer' ? '教研组' : currentUser.role})
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGap(null);
                    setReviewNote('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview('normal');
                  }}
                  disabled={reviewing || !reviewNote.trim()}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  标记正常
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview('abnormal');
                  }}
                  disabled={reviewing || !reviewNote.trim()}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  标记异常
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">断档复核</h1>
          <p className="text-sm text-gray-500 mt-1">复核记录编号断档情况，必须人工确认</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            待复核：<span className="font-semibold text-orange-600">{pendingGaps.length}</span> 条
          </div>
          <div className="text-sm text-gray-500">
            已复核：<span className="font-semibold text-green-600">{reviewedGaps.length}</span> 条
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-yellow-900 text-base">
              ⚠️ 编号断档不自动归正常！
            </p>
            <p className="mt-1 text-yellow-800">
              请根据实际情况人工复核，确认无问题后再标记正常。
            </p>
            <p className="mt-1 text-yellow-700">
              标记后会同步更新参数版本，<span className="font-semibold">全系统各页面看到的是同一份结果</span>。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <p className="font-medium">重要提示</p>
            <p className="mt-1 text-orange-700">断档记录不会自动归为正常，必须由复核员人工确认。请仔细核对断档位置的前后编号，确认是否存在数据缺失。</p>
          </div>
        </div>
      </div>

      {loading && gaps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : gaps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无断档记录，数据完整</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingGaps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                待复核断档
              </h2>
              <div className="space-y-4">
                {pendingGaps.map((gap) => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
          )}

          {reviewedGaps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                已复核断档
              </h2>
              <div className="space-y-4">
                {reviewedGaps.map((gap) => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
