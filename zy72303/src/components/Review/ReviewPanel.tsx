import { useState } from 'react';
import { useAppContext } from '../../store/AppContext';
import { useWorkflow } from '../../hooks/useWorkflow';
import { getStakeholderName, getStatusName } from '../../utils/dataUtils';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserCheck,
  Calculator,
  Clock,
  MessageSquare,
  Send,
} from 'lucide-react';
import type { Stakeholder } from '../../types';

interface ReviewPanelProps {
  selectedRecordId: string | null;
}

export function ReviewPanel({ selectedRecordId }: ReviewPanelProps) {
  const { state } = useAppContext();
  const { provideCounterexample, approveRecord, rejectRecord } = useWorkflow();
  const [counterexample, setCounterexample] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  const selectedRecord = state.parameterRecords.find(
    r => r.id === selectedRecordId
  );

  if (!selectedRecord) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-violet-600">
          <h2 className="text-xl font-bold text-white">复核与反例</h2>
          <p className="text-purple-100 text-sm mt-1">
            分母为0的记录需要人工复核
          </p>
        </div>
        <div className="p-8 text-center text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>请在左侧参数表中选择一条记录</p>
        </div>
      </div>
    );
  }

  const isZeroDenom = selectedRecord.status === 'zero_denominator';
  const canProvideCounterexample =
    state.currentUser === 'alan' && isZeroDenom;
  const canReview =
    state.currentUser === 'data_reviewer' &&
    selectedRecord.reviewStatus === 'pending';

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-violet-600">
        <h2 className="text-xl font-bold text-white">复核与反例</h2>
        <p className="text-purple-100 text-sm mt-1">
          {selectedRecord.sourceNode} → {selectedRecord.targetNode}
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">记录状态</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isZeroDenom
                  ? 'bg-amber-100 text-amber-700'
                  : selectedRecord.reviewStatus === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {getStatusName(selectedRecord.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">分子</p>
              <p className="text-lg font-bold text-gray-800">
                {selectedRecord.numerator}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">分母</p>
              <p
                className={`text-lg font-bold ${
                  isZeroDenom ? 'text-amber-600' : 'text-gray-800'
                }`}
              >
                {isZeroDenom ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    空（实际为0）
                  </span>
                ) : (
                  selectedRecord.denominator
                )}
              </p>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">原始备注</p>
            <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
              {selectedRecord.remark}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              负责人：{getStakeholderName(selectedRecord.assignedTo as Stakeholder)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              版本 v{selectedRecord.currentVersion}
            </span>
          </div>
        </div>

        {isZeroDenom && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-800 mb-1">
                  分母为 0 的特殊处理
                </h4>
                <p className="text-sm text-amber-700">
                  该记录分母为 0，系统已将其显示为空字符串，但未自动归为正常。
                  需要数据复核人确认原因，运营规划阿岚补充手算反例。
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${selectedRecord.manualCounterexample ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={selectedRecord.manualCounterexample ? 'text-green-700' : 'text-gray-600'}>
                      手算反例：{selectedRecord.manualCounterexample ? '已提供' : '待补充'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${selectedRecord.reviewStatus === 'approved' ? 'bg-green-500' : selectedRecord.reviewStatus === 'rejected' ? 'bg-red-500' : 'bg-gray-300'}`} />
                    <span className={selectedRecord.reviewStatus === 'approved' ? 'text-green-700' : selectedRecord.reviewStatus === 'rejected' ? 'text-red-700' : 'text-gray-600'}>
                      复核状态：{
                        selectedRecord.reviewStatus === 'approved' ? '已通过' :
                        selectedRecord.reviewStatus === 'rejected' ? '已拒绝' :
                        '待复核'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedRecord.manualCounterexample && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Calculator className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-800 mb-1">
                  手算反例（由 {getStakeholderName(selectedRecord.counterexampleProvider as Stakeholder)} 提供）
                </h4>
                <p className="text-sm text-blue-700 whitespace-pre-wrap">
                  {selectedRecord.manualCounterexample}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  提供时间：{selectedRecord.counterexampleTimestamp
                    ? new Date(selectedRecord.counterexampleTimestamp).toLocaleString()
                    : '未知'}
                </p>
              </div>
            </div>
          </div>
        )}

        {canProvideCounterexample && !selectedRecord.manualCounterexample && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                补充手算反例
              </span>
              <textarea
                value={counterexample}
                onChange={e => setCounterexample(e.target.value)}
                placeholder="请输入手算反例，说明分母为0的原因和计算过程..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={4}
              />
            </label>
            <button
              onClick={() => {
                if (counterexample.trim()) {
                  provideCounterexample(
                    selectedRecord.id,
                    counterexample.trim(),
                    state.currentUser as Stakeholder
                  );
                  setCounterexample('');
                }
              }}
              disabled={!counterexample.trim()}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Send className="w-4 h-4" />
              提交手算反例
            </button>
          </div>
        )}

        {canReview && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                复核意见
              </span>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="请输入复核意见..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  approveRecord(
                    selectedRecord.id,
                    state.currentUser as Stakeholder,
                    reviewComment.trim() || undefined
                  );
                  setReviewComment('');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                通过
              </button>
              <button
                onClick={() => {
                  rejectRecord(
                    selectedRecord.id,
                    state.currentUser as Stakeholder,
                    reviewComment.trim() || undefined
                  );
                  setReviewComment('');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                拒绝
              </button>
            </div>
          </div>
        )}

        {!canProvideCounterexample && !canReview && selectedRecord.reviewStatus !== 'pending' && (
          <div className="text-center py-4 text-gray-500">
            {selectedRecord.reviewStatus === 'approved' ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>该记录已通过复核</span>
              </div>
            ) : selectedRecord.reviewStatus === 'rejected' ? (
              <div className="flex items-center justify-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <span>该记录已被拒绝</span>
              </div>
            ) : (
              <p>请切换到相应角色进行操作</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
