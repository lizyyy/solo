import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ArrowLeft,
  ArrowRight,
  FileCheck,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle,
  Send,
} from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import { api } from '@/services/api';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import ProcessTimeline from '@/components/common/ProcessTimeline';
import { isZeroReversed } from '@shared/types';
import type { ReviewRequest } from '@shared/types';

export default function ReviewDesk() {
  const navigate = useNavigate();
  const {
    adjustments,
    getCustodyByAdjustmentId,
    getProcessNodesByAdjustmentId,
    submitReview,
    currentUser,
    currentRole,
  } = useClearingStore();

  const pendingReview = adjustments.filter((a) => a.status === 'pending_review');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewResult, setReviewResult] = useState<'normal' | 'verify' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentAdjustment = pendingReview[currentIndex];

  if (pendingReview.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-carbon-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-carbon-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-carbon-800">风控复核工作台</h1>
            <p className="text-carbon-500 mt-1">人工复核冲正记录</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-12 text-center shadow-card">
          <CheckCircle className="w-16 h-16 text-finance-green mx-auto mb-4" />
          <h2 className="text-xl font-bold text-carbon-800 mb-2">太棒了！</h2>
          <p className="text-carbon-500">所有待复核的记录都已处理完毕</p>
          <p className="text-carbon-400 text-sm mt-2">小周会感谢您的辛勤工作～</p>
          <button
            onClick={() => navigate('/summary')}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors"
          >
            查看负责人摘要
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!currentAdjustment) return null;

  const custody = getCustodyByAdjustmentId(currentAdjustment.id);
  const processNodes = getProcessNodesByAdjustmentId(currentAdjustment.id);
  const isFlagged = isZeroReversed(currentAdjustment.amount, currentAdjustment.remark);

  const handleSubmit = async () => {
    if (!reviewResult) {
      alert('请先选择复核结果');
      return;
    }
    if (!comment.trim()) {
      alert('请填写复核意见');
      return;
    }

    setSubmitting(true);
    try {
      const request: ReviewRequest = {
        result: reviewResult,
        comment: comment.trim(),
        operator: currentUser,
      };

      await api.submitReview(currentAdjustment.id, request);
      submitReview(currentAdjustment.id, request);

      setReviewResult(null);
      setComment('');

      if (currentIndex >= pendingReview.length - 1) {
        navigate('/summary');
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (e) {
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setReviewResult(null);
      setComment('');
    }
  };

  const handleNext = () => {
    if (currentIndex < pendingReview.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setReviewResult(null);
      setComment('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-carbon-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-carbon-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-carbon-800">风控复核工作台</h1>
          <p className="text-carbon-500 mt-1">
            第 {currentIndex + 1} / {pendingReview.length} 条 · 请仔细核对后给出结论
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 border border-carbon-200 rounded-lg hover:bg-carbon-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === pendingReview.length - 1}
            className="p-2 border border-carbon-200 rounded-lg hover:bg-carbon-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <div className="bg-warning-orange p-4 text-white flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5" />
            <h2 className="font-semibold">调整条信息</h2>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-mono text-xl font-bold text-carbon-800">
                  {currentAdjustment.adjustmentNo}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge
                    status={currentAdjustment.status}
                    amount={currentAdjustment.amount}
                    remark={currentAdjustment.remark}
                  />
                  {isFlagged && (
                    <span className="px-2 py-0.5 bg-risk-red/10 text-risk-red text-xs rounded border border-risk-red/20 font-medium">
                      已冲正
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-carbon-400">金额</p>
                <AmountDisplay amount={currentAdjustment.amount} className="text-xl" />
              </div>
            </div>

            <div className="bg-risk-red-light/30 rounded-lg p-4 mb-6 border border-risk-red/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-risk-red flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-risk-red mb-1">风控重点关注</p>
                  <p className="text-sm text-carbon-600">{currentAdjustment.remark}</p>
                  <p className="text-xs text-carbon-400 mt-2">
                    金额为0但备注已冲正，请核实该笔调整的真实性和必要性
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-carbon-400 mb-1">交易日期</p>
                <p className="text-carbon-800 font-medium">{currentAdjustment.tradeDate}</p>
              </div>
              <div>
                <p className="text-sm text-carbon-400 mb-1">导入时间</p>
                <p className="text-carbon-800 font-medium">{currentAdjustment.importTime}</p>
              </div>
              <div>
                <p className="text-sm text-carbon-400 mb-1">导入人</p>
                <p className="text-carbon-800 font-medium">{currentAdjustment.importOperator}</p>
              </div>
            </div>

            <div className="border-t border-carbon-100 pt-4">
              <h4 className="font-medium text-carbon-800 mb-3">处理流程</h4>
              <div className="max-h-60 overflow-y-auto">
                <ProcessTimeline nodes={processNodes} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <div className="bg-custody-blue p-4 text-white flex items-center gap-3">
            <FileCheck className="w-5 h-5" />
            <h2 className="font-semibold">托管确认页</h2>
          </div>
          <div className="p-6">
            {custody ? (
              <>
                <div className="bg-carbon-50 rounded-lg p-4 mb-6 border border-carbon-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-mono text-lg font-semibold text-carbon-800">
                        {custody.voucherNo}
                      </p>
                      <p className="text-sm text-carbon-500 mt-1">托管日期：{custody.custodyDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-carbon-400">托管金额</p>
                      <AmountDisplay amount={custody.amount} className="text-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-carbon-400">托管机构</p>
                      <p className="text-carbon-800">{custody.custodian}</p>
                    </div>
                    <div>
                      <p className="text-carbon-400">经办人</p>
                      <p className="text-carbon-800">{custody.handler}</p>
                    </div>
                  </div>
                  {custody.hasScannedCopy && (
                    <div className="mt-3 pt-3 border-t border-carbon-200">
                      <span className="text-sm text-finance-green flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        已上传凭证扫描件
                      </span>
                    </div>
                  )}
                </div>

                {Object.keys(custody.supplementaryFields).length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-carbon-800 mb-3">补充信息</h4>
                    <div className="space-y-2">
                      {Object.entries(custody.supplementaryFields).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-carbon-500">{key}</span>
                          <span className="text-carbon-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/custody/${custody.id}`)}
                  className="w-full py-2 border border-custody-blue text-custody-blue rounded-lg hover:bg-custody-blue-light/30 transition-colors text-sm"
                >
                  查看完整托管页
                </button>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-warning-orange-light rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-warning-orange" />
                </div>
                <h3 className="font-semibold text-carbon-800 mb-2">暂无托管凭证</h3>
                <p className="text-sm text-carbon-500 mb-4">
                  该记录还没有上传托管确认页，请先通知小周补录
                </p>
                <button
                  onClick={() => navigate(`/custody?adjustmentId=${currentAdjustment.id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-warning-orange text-white rounded-lg hover:bg-warning-orange-hover transition-colors text-sm"
                >
                  去补录托管页
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="bg-carbon-800 p-4 text-white">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5" />
            <h2 className="font-semibold">人工判断</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-carbon-600 mb-6">
            请仔细核对左侧调整条和右侧托管页信息，确认该笔冲正记录是否正常。必须选择一个结论并填写复核意见。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setReviewResult('normal')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                reviewResult === 'normal'
                  ? 'border-finance-green bg-finance-green-light/30'
                  : 'border-carbon-200 hover:border-finance-green/50 hover:bg-finance-green-light/10'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  reviewResult === 'normal' ? 'bg-finance-green text-white' : 'bg-finance-green-light text-finance-green'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-carbon-800">确认正常</h3>
              </div>
              <p className="text-sm text-carbon-500">
                冲正记录核实无误，托管凭证齐全，可正常归档
              </p>
            </button>

            <button
              onClick={() => setReviewResult('verify')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                reviewResult === 'verify'
                  ? 'border-warning-orange bg-warning-orange-light/30'
                  : 'border-carbon-200 hover:border-warning-orange/50 hover:bg-warning-orange-light/10'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  reviewResult === 'verify' ? 'bg-warning-orange text-white' : 'bg-warning-orange-light text-warning-orange'
                }`}>
                  <ShieldX className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-carbon-800">需进一步核实</h3>
              </div>
              <p className="text-sm text-carbon-500">
                存在疑问，需要补充材料或进一步核实后再处理
              </p>
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-carbon-700 mb-2">
              复核意见 <span className="text-risk-red">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请详细说明复核结论的原因..."
              rows={4}
              className="w-full px-4 py-3 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue resize-none"
            />
            <p className="text-xs text-carbon-400 mt-2">
              复核人：{currentUser}（{currentRole === 'risk' ? '风控' : '其他'}）
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-carbon-400">
              {pendingReview.length - currentIndex - 1} 条待处理
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleNext}
                className="px-4 py-2 border border-carbon-200 text-carbon-600 rounded-lg hover:bg-carbon-50 transition-colors"
              >
                跳过本条
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reviewResult || !comment.trim() || submitting || !custody}
                className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  reviewResult === 'normal'
                    ? 'bg-finance-green hover:bg-finance-green-hover text-white'
                    : reviewResult === 'verify'
                    ? 'bg-warning-orange hover:bg-warning-orange-hover text-white'
                    : 'bg-carbon-200 text-carbon-400'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    提交复核意见
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
