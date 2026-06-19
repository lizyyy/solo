import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck, ShieldCheck, Clock, FileText, AlertTriangle, GitCompare } from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import ProcessTimeline from '@/components/common/ProcessTimeline';
import { STATUS_LABELS, isZeroReversed } from '@shared/types';

const statusSteps = [
  { key: 'imported', label: '已导入' },
  { key: 'pending_custody', label: '待补托管页' },
  { key: 'pending_review', label: '待风控复核' },
  { key: 'reviewed_normal', label: '已复核正常' },
  { key: 'needs_verification', label: '需进一步核实' },
];

export default function AdjustmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getAdjustmentById, getProcessNodesByAdjustmentId, getCustodyByAdjustmentId, getDiffSnapshotByAdjustmentId, currentRole } =
    useClearingStore();

  const adjustment = getAdjustmentById(id || '');
  const processNodes = getProcessNodesByAdjustmentId(id || '');
  const custody = getCustodyByAdjustmentId(id || '');
  const diffSnapshot = getDiffSnapshotByAdjustmentId(id || '');

  if (!adjustment) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-warning-orange mx-auto mb-4" />
          <h2 className="text-xl font-bold text-carbon-800 mb-2">记录不存在</h2>
          <p className="text-carbon-500 mb-4">找不到对应的尾差调整记录</p>
          <button
            onClick={() => navigate('/adjustments')}
            className="px-4 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const isFlagged = isZeroReversed(adjustment.amount, adjustment.remark);
  const currentStepIndex = statusSteps.findIndex((s) => s.key === adjustment.status);

  const getStepStatus = (index: number) => {
    if (index < currentStepIndex) return 'done';
    if (index === currentStepIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/adjustments')}
          className="p-2 hover:bg-carbon-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-carbon-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-carbon-800 font-mono">
            {adjustment.adjustmentNo}
          </h1>
          <p className="text-carbon-500 mt-1">尾差调整详情</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className={`bg-white rounded-xl p-6 shadow-card ${isFlagged ? 'border-l-4 border-risk-red' : ''}`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-carbon-800">基本信息</h2>
                  {isFlagged && (
                    <span className="px-2 py-0.5 bg-risk-red/10 text-risk-red text-xs rounded border border-risk-red/20 font-medium">
                      已冲正
                    </span>
                  )}
                </div>
                <p className="text-carbon-500 text-sm">{adjustment.remark}</p>
              </div>
              <StatusBadge
                status={adjustment.status}
                amount={adjustment.amount}
                remark={adjustment.remark}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-carbon-400 mb-1">金额</p>
                <AmountDisplay amount={adjustment.amount} className="text-xl font-semibold" />
              </div>
              <div>
                <p className="text-sm text-carbon-400 mb-1">交易日期</p>
                <p className="text-carbon-800 font-medium">{adjustment.tradeDate}</p>
              </div>
              <div>
                <p className="text-sm text-carbon-400 mb-1">导入时间</p>
                <p className="text-carbon-800 font-medium">{adjustment.importTime}</p>
              </div>
              <div>
                <p className="text-sm text-carbon-400 mb-1">操作人</p>
                <p className="text-carbon-800 font-medium">{adjustment.importOperator}</p>
              </div>
            </div>

            {adjustment.reviewTime && (
              <div className="mt-6 pt-6 border-t border-carbon-100">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-carbon-400 mb-1">复核时间</p>
                    <p className="text-carbon-800 font-medium">{adjustment.reviewTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-carbon-400 mb-1">复核人</p>
                    <p className="text-carbon-800 font-medium">{adjustment.reviewOperator}</p>
                  </div>
                </div>
                {adjustment.reviewComment && (
                  <div className="mt-4 p-4 bg-carbon-50 rounded-lg border-l-2 border-custody-blue">
                    <p className="text-sm font-medium text-carbon-700 mb-1">复核意见</p>
                    <p className="text-carbon-600">{adjustment.reviewComment}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-card">
            <h2 className="text-lg font-semibold text-carbon-800 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-custody-blue" />
              状态流转
            </h2>
            <div className="relative">
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-carbon-200" />
              <div className="flex justify-between relative">
                {statusSteps.map((step, index) => {
                  const status = getStepStatus(index);
                  return (
                    <div key={step.key} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          status === 'done'
                            ? 'bg-finance-green border-finance-green text-white'
                            : status === 'current'
                            ? 'bg-white border-custody-blue text-custody-blue shadow-lg shadow-custody-blue/30'
                            : 'bg-white border-carbon-200 text-carbon-300'
                        }`}
                      >
                        {status === 'done' ? (
                          <span className="w-3 h-3 bg-white rounded-full" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-current" />
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium text-center max-w-[80px] ${
                          status === 'done'
                            ? 'text-finance-green'
                            : status === 'current'
                            ? 'text-custody-blue'
                            : 'text-carbon-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-card">
            <h2 className="text-lg font-semibold text-carbon-800 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-custody-blue" />
              流程时间线
            </h2>
            <ProcessTimeline nodes={processNodes} />
          </div>

          {diffSnapshot && diffSnapshot.fields.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-card border-l-4 border-summary-gold">
              <h2 className="text-lg font-semibold text-carbon-800 mb-2 flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-summary-gold" />
                补录差异快照
              </h2>
              <p className="text-sm text-carbon-500 mb-4">
                操作人：{diffSnapshot.operator} · 快照时间：{diffSnapshot.snapshotTime}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-carbon-200">
                      <th className="text-left py-2 px-3 text-carbon-500 font-medium">字段</th>
                      <th className="text-left py-2 px-3 text-carbon-500 font-medium">补录前</th>
                      <th className="text-left py-2 px-3 text-carbon-500 font-medium">补录后</th>
                      <th className="text-left py-2 px-3 text-carbon-500 font-medium">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffSnapshot.fields.map((f, i) => (
                      <tr key={i} className="border-b border-carbon-100 last:border-0">
                        <td className="py-2 px-3 font-medium text-carbon-800">{f.label}</td>
                        <td className="py-2 px-3 text-carbon-500 font-mono">
                          {f.original === null ? '—' : String(f.original)}
                        </td>
                        <td className="py-2 px-3 text-carbon-800 font-mono">
                          {String(f.corrected)}
                        </td>
                        <td className="py-2 px-3 text-carbon-600">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-carbon-50 rounded-lg text-sm text-carbon-600">
                <span className="font-medium">状态变更：</span>
                <span className="text-warning-orange">{STATUS_LABELS[diffSnapshot.beforeStatus]}</span>
                {' → '}
                <span className="text-risk-red">{STATUS_LABELS[diffSnapshot.afterStatus]}</span>
                {diffSnapshot.afterStatus === 'pending_review' && (
                  <span className="ml-2 text-risk-red">（冲正记录不自动归正常，留给风控复核）</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {custody ? (
            <div className="bg-white rounded-xl p-6 shadow-card border-2 border-custody-blue/20">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="w-5 h-5 text-custody-blue" />
                <h3 className="font-semibold text-carbon-800">托管确认页</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-carbon-400">凭证号</span>
                  <span className="font-mono text-carbon-800">{custody.voucherNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-carbon-400">托管日期</span>
                  <span className="text-carbon-800">{custody.custodyDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-carbon-400">金额</span>
                  <AmountDisplay amount={custody.amount} />
                </div>
                <div className="flex justify-between">
                  <span className="text-carbon-400">托管人</span>
                  <span className="text-carbon-800">{custody.custodian}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-carbon-400">经办人</span>
                  <span className="text-carbon-800">{custody.handler}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-carbon-400">附件</span>
                  <span className={custody.hasScannedCopy ? 'text-finance-green' : 'text-warning-orange'}>
                    {custody.hasScannedCopy ? '已上传' : '待上传'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/custody/${custody.id}`)}
                className="w-full mt-4 py-2 bg-custody-blue text-white rounded-lg hover:bg-custody-blue-hover transition-colors text-sm font-medium"
              >
                查看完整托管页
              </button>
            </div>
          ) : adjustment.status === 'pending_custody' || isFlagged ? (
            <div className="bg-white rounded-xl p-6 shadow-card border-2 border-dashed border-warning-orange/30">
              <div className="text-center">
                <div className="w-12 h-12 bg-warning-orange-light rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="w-6 h-6 text-warning-orange" />
                </div>
                <h3 className="font-semibold text-carbon-800 mb-2">待补托管确认页</h3>
                <p className="text-sm text-carbon-500 mb-4">
                  这条冲正记录还没有托管凭证，请先补录后再提交风控复核。
                </p>
                <button
                  onClick={() => navigate(`/custody?adjustmentId=${adjustment.id}`)}
                  className="w-full py-2 bg-warning-orange text-white rounded-lg hover:bg-warning-orange-hover transition-colors text-sm font-medium"
                >
                  补录托管页
                </button>
              </div>
            </div>
          ) : null}

          {adjustment.status === 'pending_review' && currentRole === 'risk' && (
            <div className="bg-white rounded-xl p-6 shadow-card border-2 border-risk-red/20">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-risk-red" />
                <h3 className="font-semibold text-carbon-800">风控复核</h3>
              </div>
              <p className="text-sm text-carbon-500 mb-4">
                请核对相关凭证后，到复核工作台进行处理。
              </p>
              <button
                onClick={() => navigate('/review')}
                className="w-full py-2 bg-risk-red text-white rounded-lg hover:bg-risk-red-hover transition-colors text-sm font-medium"
              >
                前往复核工作台
              </button>
            </div>
          )}

          <div className="bg-gradient-to-br from-carbon-50 to-custody-blue-light/20 rounded-xl p-6 border border-custody-blue/10">
            <h3 className="font-semibold text-carbon-800 mb-3">💡 下一步操作</h3>
            <div className="space-y-2 text-sm text-carbon-600">
              {adjustment.status === 'pending_custody' && (
                <p>• 先补录托管确认页，上传相关凭证扫描件</p>
              )}
              {adjustment.status === 'pending_review' && currentRole !== 'risk' && (
                <p>• 等待风控同事复核，如有疑问请联系李工</p>
              )}
              {adjustment.status === 'pending_review' && currentRole === 'risk' && (
                <p>• 请核对托管凭证完整性，确认冲正真实性</p>
              )}
              {adjustment.status === 'reviewed_normal' && (
                <p>• 已复核通过，记录可归档</p>
              )}
              {adjustment.status === 'needs_verification' && (
                <p>• 需要进一步核实，请补充相关材料后再次提交</p>
              )}
              {isFlagged && adjustment.status !== 'reviewed_normal' && adjustment.status !== 'needs_verification' && (
                <p className="text-risk-red font-medium">• 冲正记录必须经过风控人工确认</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
