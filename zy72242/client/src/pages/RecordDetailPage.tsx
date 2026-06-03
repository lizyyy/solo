import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { recordApi, adjustmentApi } from '../services/api';
import { ReconciliationRecordWithRelations, STATUS_CONFIG } from '../types';
import AuditTimeline from '../components/AuditTimeline';
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  UserIcon,
  ClockIcon,
  BanknotesIcon,
  DocumentTextIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { differenceInDays, parseISO } from 'date-fns';

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, loadRecords } = useApp();
  const [record, setRecord] = useState<ReconciliationRecordWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    if (id) {
      loadRecordDetail();
    }
  }, [id]);

  const loadRecordDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await recordApi.getRecordById(id);
      if (response.data.success && response.data.data) {
        setRecord(response.data.data);
      }
    } catch (error) {
      console.error('加载记录详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!id) return;
    try {
      await recordApi.reviewRecord(id, {
        recordId: id,
        reviewer: state.currentUser.name,
        status,
        comment: reviewComment
      });
      setShowReviewForm(false);
      setReviewComment('');
      await loadRecordDetail();
      await loadRecords();
    } catch (error) {
      console.error('复核失败:', error);
    }
  };

  const handleRerun = async () => {
    if (!id) return;
    try {
      await recordApi.rerunReconciliation(id, state.currentUser.name);
      await loadRecordDetail();
      await loadRecords();
    } catch (error) {
      console.error('重跑失败:', error);
    }
  };

  const handleAddAdjustment = async () => {
    if (!id || !adjustmentAmount || !adjustmentReason) return;
    try {
      await adjustmentApi.createAdjustment({
        recordId: id,
        amount: parseFloat(adjustmentAmount),
        reason: adjustmentReason,
        adjustedBy: state.currentUser.name
      });
      setShowAdjustmentForm(false);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      await loadRecordDetail();
      await loadRecords();
    } catch (error) {
      console.error('添加尾差调整失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-finance-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">记录不存在</p>
        <Link to="/" className="btn-primary mt-4 inline-block">返回主页</Link>
      </div>
    );
  }

  const isT1ToT2 = record.modificationType === 't1_to_t2';
  const delayDays = differenceInDays(parseISO(record.actualArrivalDate), parseISO(record.expectedArrivalDate));
  const statusConfig = STATUS_CONFIG[record.status];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-4">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h2 className="text-2xl font-serif-sc text-gray-900">
            {record.fundCode} / {record.futuresCode}
          </h2>
          <p className="text-sm text-gray-500 mt-1">记录详情 — 完整操作历史与复核追踪</p>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          {isT1ToT2 && (
            <span className="badge bg-red-100 text-red-800 border border-red-200 flex items-center space-x-1">
              <ExclamationTriangleIcon className="w-3 h-3" />
              <span>T+1→T+2 修改</span>
            </span>
          )}
          <span className={`badge ${statusConfig.className}`}>{statusConfig.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className={isT1ToT2 ? 'card-alert' : 'card'}>
            <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-gray-500 text-xs mb-1">交易日</div>
                <div className="font-medium">{record.tradeDate}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-blue-600 text-xs mb-1">预期到账日 (T+1)</div>
                <div className="font-medium text-blue-800">{record.expectedArrivalDate}</div>
              </div>
              <div className={`p-3 rounded ${isT1ToT2 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-xs mb-1 ${isT1ToT2 ? 'text-red-600' : 'text-gray-500'}`}>实际到账日</div>
                <div className={`font-medium ${isT1ToT2 ? 'text-red-800' : ''}`}>
                  {record.actualArrivalDate}
                  {isT1ToT2 && <span className="text-red-500 text-xs ml-2">延迟{delayDays}天</span>}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-gray-500 text-xs mb-1">金额</div>
                <div className="font-medium">¥{record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-gray-500 text-xs mb-1">基金代码</div>
                <div className="font-medium">{record.fundCode}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-gray-500 text-xs mb-1">期货代码</div>
                <div className="font-medium">{record.futuresCode}</div>
              </div>
            </div>

            {isT1ToT2 && record.modifiedBy && (
              <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-800">人工修改记录</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm text-red-700">
                  <div className="flex items-center space-x-1">
                    <UserIcon className="w-4 h-4" />
                    <span>修改人: {record.modifiedBy}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="w-4 h-4" />
                    <span>修改时间: {record.modifiedAt}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <DocumentTextIcon className="w-4 h-4" />
                    <span>原因: {record.modificationReason}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <BanknotesIcon className="w-5 h-5 text-finance-600" />
              <span>对账说明</span>
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 mb-2 flex items-center space-x-1">
                  <span>📋</span>
                  <span>为什么被留下</span>
                </div>
                <div className="text-sm text-blue-900 leading-relaxed">{record.whyKept || '暂无说明'}</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center space-x-1">
                  <span>📎</span>
                  <span>还缺什么材料</span>
                </div>
                <div className="text-sm text-amber-900 leading-relaxed">
                  {record.missingMaterials || '材料齐全'}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <div className="text-xs font-semibold text-green-800 mb-2 flex items-center space-x-1">
                  <span>👉</span>
                  <span>下一步找谁</span>
                </div>
                <div className="text-sm text-green-900 leading-relaxed">{record.nextAction || '无需处理'}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              最后更新: {record.lastUpdatedBy} @ {record.lastUpdatedAt}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif-sc text-lg font-semibold text-gray-900">操作时间线</h3>
              <button onClick={handleRerun} className="btn-secondary flex items-center space-x-1 text-sm">
                <ArrowPathIcon className="w-4 h-4" />
                <span>重跑对账</span>
              </button>
            </div>
            <AuditTimeline logs={record.auditLogs || []} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4">基金经理复核</h3>
            {record.status === 'reviewing' ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800">
                  T+1→T+2修改记录，不急着归正常，留给基金经理复核
                </div>
                {!showReviewForm ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="btn-success flex-1 flex items-center justify-center space-x-1"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>通过</span>
                    </button>
                    <button
                      onClick={() => { setShowReviewForm(true); }}
                      className="btn-danger flex-1 flex items-center justify-center space-x-1"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      <span>驳回</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="input"
                      rows={3}
                      placeholder="复核意见..."
                    />
                    <div className="flex space-x-2">
                      <button onClick={() => handleReview('approved')} className="btn-success flex-1">确认通过</button>
                      <button onClick={() => handleReview('rejected')} className="btn-danger flex-1">确认驳回</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`p-3 rounded text-sm ${
                record.status === 'approved' ? 'bg-green-50 text-green-800' : 
                record.status === 'rejected' ? 'bg-red-50 text-red-800' : 
                'bg-gray-50 text-gray-800'
              }`}>
                {record.status === 'approved' ? '已通过复核' : 
                 record.status === 'rejected' ? '已驳回' : 
                 '等待处理'}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif-sc text-lg font-semibold text-gray-900">尾差调整</h3>
              <button
                onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}
                className="btn-secondary text-sm flex items-center space-x-1"
              >
                <PlusIcon className="w-4 h-4" />
                <span>补录</span>
              </button>
            </div>

            {showAdjustmentForm && (
              <div className="space-y-3 mb-4 animate-slide-up">
                <div>
                  <label className="label">调整金额</label>
                  <input
                    type="number"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    className="input"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">调整原因</label>
                  <textarea
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="input"
                    rows={2}
                    placeholder="如：银行手续费尾差调整"
                  />
                </div>
                <button onClick={handleAddAdjustment} className="btn-primary w-full">提交尾差调整</button>
              </div>
            )}

            {(record.adjustments || []).length === 0 ? (
              <p className="text-sm text-gray-500">暂无尾差调整</p>
            ) : (
              <div className="space-y-3">
                {(record.adjustments || []).map((adj) => (
                  <div key={adj.id} className="bg-indigo-50 p-3 rounded border border-indigo-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-indigo-800">
                        ¥{adj.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-indigo-600">{adj.adjustedBy}</span>
                    </div>
                    <div className="text-xs text-indigo-700 mt-1">{adj.reason}</div>
                    <div className="text-xs text-indigo-500 mt-1">{adj.adjustedAt}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-3">复核历史</h3>
            {(record.reviews || []).length === 0 ? (
              <p className="text-sm text-gray-500">暂无复核记录</p>
            ) : (
              <div className="space-y-2">
                {(record.reviews || []).map((review) => (
                  <div key={review.id} className={`p-3 rounded text-sm ${
                    review.status === 'approved' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{review.reviewer}</span>
                      <span className={review.status === 'approved' ? 'text-green-600' : 'text-red-600'}>
                        {review.status === 'approved' ? '通过' : '驳回'}
                      </span>
                    </div>
                    {review.comment && <div className="mt-1 text-gray-600">{review.comment}</div>}
                    <div className="mt-1 text-xs text-gray-400">{review.reviewedAt}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
