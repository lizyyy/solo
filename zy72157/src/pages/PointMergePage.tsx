import React, { useState, useEffect } from 'react';
import { GitMerge, X, Check, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { MergeSuggestion } from '../types';
import { SIMILARITY_THRESHOLDS } from '../utils/similarity';

export function PointMergePage() {
  const {
    points,
    suggestions,
    generateSuggestions,
    approveSuggestion,
    rejectSuggestion,
    setCurrentStep,
  } = useApp();

  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (points.length > 0 && suggestions.length === 0) {
      generateSuggestions();
    }
  }, [points.length]);

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const approvedSuggestions = suggestions.filter((s) => s.status === 'approved');
  const rejectedSuggestions = suggestions.filter((s) => s.status === 'rejected');

  const getPointById = (id: string) => points.find((p) => p.id === id);

  const getSimilarityColor = (score: number) => {
    if (score >= SIMILARITY_THRESHOLDS.AUTO_MERGE) return 'text-green-600';
    if (score >= SIMILARITY_THRESHOLDS.MANUAL_REVIEW) return 'text-amber-600';
    return 'text-gray-600';
  };

  const getSimilarityBarColor = (score: number) => {
    if (score >= SIMILARITY_THRESHOLDS.AUTO_MERGE) return 'bg-green-500';
    if (score >= SIMILARITY_THRESHOLDS.MANUAL_REVIEW) return 'bg-amber-500';
    return 'bg-gray-400';
  };

  const handleApprove = (suggestionId: string) => {
    approveSuggestion(suggestionId);
  };

  const handleReject = (suggestionId: string) => {
    const reason = rejectReason[suggestionId] || '人工判断不合并';
    rejectSuggestion(suggestionId, reason);
    setShowRejectInput((prev) => ({ ...prev, [suggestionId]: false }));
    setRejectReason((prev) => ({ ...prev, [suggestionId]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">点位归并</h1>
          <p className="mt-1 text-sm text-gray-500">智能识别重复点位，支持人工确认归并决策</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateSuggestions}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            重新分析
          </button>
          {pendingSuggestions.length === 0 && points.some((p) => p.status !== 'rejected') && (
            <button
              onClick={() => setCurrentStep('review')}
              className="inline-flex items-center px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors"
            >
              前往人工复核
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">总点位数量</p>
          <p className="text-3xl font-bold text-primary-700">{points.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">待确认归并</p>
          <p className="text-3xl font-bold text-amber-600">{pendingSuggestions.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">已完成归并</p>
          <p className="text-3xl font-bold text-green-600">{approvedSuggestions.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">已拒绝归并</p>
          <p className="text-3xl font-bold text-gray-600">{rejectedSuggestions.length}</p>
        </div>
      </div>

      {pendingSuggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
            <h3 className="font-semibold text-amber-800 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              待确认的归并建议 ({pendingSuggestions.length} 条)
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingSuggestions.map((suggestion) => (
              <MergeSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                point1={getPointById(suggestion.pointId1)}
                point2={getPointById(suggestion.pointId2)}
                getSimilarityColor={getSimilarityColor}
                getSimilarityBarColor={getSimilarityBarColor}
                onApprove={handleApprove}
                onReject={handleReject}
                showRejectInput={showRejectInput[suggestion.id] || false}
                setShowRejectInput={(show) =>
                  setShowRejectInput((prev) => ({ ...prev, [suggestion.id]: show }))
                }
                rejectReason={rejectReason[suggestion.id] || ''}
                setRejectReason={(value) =>
                  setRejectReason((prev) => ({ ...prev, [suggestion.id]: value }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {approvedSuggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <h3 className="font-semibold text-green-800 flex items-center">
              <Check className="w-5 h-5 mr-2" />
              已完成的归并 ({approvedSuggestions.length} 条)
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {approvedSuggestions.map((suggestion) => {
                const p1 = getPointById(suggestion.pointId1);
                const p2 = getPointById(suggestion.pointId2);
                return (
                  <div key={suggestion.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">已归并</span>
                      <span className="text-sm text-gray-700">
                        {p1?.name || '未知'} ← {p2?.name || '未知'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      相似度 {(suggestion.similarityScore * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {points.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <GitMerge className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">暂无数据，请先导入点位数据</p>
          <button
            onClick={() => setCurrentStep('import')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            前往数据导入
          </button>
        </div>
      )}
    </div>
  );
}

interface MergeSuggestionCardProps {
  suggestion: MergeSuggestion;
  point1: ReturnType<typeof useApp>['points'][0] | undefined;
  point2: ReturnType<typeof useApp>['points'][0] | undefined;
  getSimilarityColor: (score: number) => string;
  getSimilarityBarColor: (score: number) => string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  showRejectInput: boolean;
  setShowRejectInput: (show: boolean) => void;
  rejectReason: string;
  setRejectReason: (value: string) => void;
}

function MergeSuggestionCard({
  suggestion,
  point1,
  point2,
  getSimilarityColor,
  getSimilarityBarColor,
  onApprove,
  onReject,
  showRejectInput,
  setShowRejectInput,
  rejectReason,
  setRejectReason,
}: MergeSuggestionCardProps) {
  if (!point1 || !point2) return null;

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-6">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <StatusBadge type="source" value={point1.source} />
              <StatusBadge type="pointType" value={point1.type} />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{point1.name || '(未命名)'}</h4>
            <p className="text-sm text-gray-600">{point1.address}</p>
            <p className="text-xs text-gray-400 mt-2">
              {point1.lat.toFixed(4)}, {point1.lng.toFixed(4)}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <StatusBadge type="source" value={point2.source} />
              <StatusBadge type="pointType" value={point2.type} />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{point2.name || '(未命名)'}</h4>
            <p className="text-sm text-gray-600">{point2.address}</p>
            <p className="text-xs text-gray-400 mt-2">
              {point2.lat.toFixed(4)}, {point2.lng.toFixed(4)}
            </p>
          </div>
        </div>

        <div className="w-48 flex-shrink-0">
          <div className="text-center mb-3">
            <span className={`text-2xl font-bold ${getSimilarityColor(suggestion.similarityScore)}`}>
              {(suggestion.similarityScore * 100).toFixed(0)}%
            </span>
            <p className="text-xs text-gray-500 mt-1">相似度</p>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full ${getSimilarityBarColor(suggestion.similarityScore)} transition-all`}
              style={{ width: `${suggestion.similarityScore * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>地址:</span>
              <span>{(suggestion.similarityBreakdown.address * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>名称:</span>
              <span>{(suggestion.similarityBreakdown.name * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>距离:</span>
              <span>{(suggestion.similarityBreakdown.distance * 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="text-xs text-primary-600 mt-2 text-center">{suggestion.reason}</p>
        </div>
      </div>

      <div className="flex items-center justify-end mt-4 gap-3">
        {showRejectInput ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              placeholder="输入拒绝原因..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={() => onReject(suggestion.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              确认拒绝
            </button>
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              取消
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowRejectInput(true)}
              className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <X className="w-4 h-4 mr-2" />
              不合并
            </button>
            <button
              onClick={() => onApprove(suggestion.id)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <GitMerge className="w-4 h-4 mr-2" />
              确认合并
            </button>
          </>
        )}
      </div>
    </div>
  );
}
