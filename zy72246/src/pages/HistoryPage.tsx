import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, RotateCcw, ChevronRight, DollarSign } from 'lucide-react';
import {
  useTaxNoteById,
  useVersionsByTaxNoteId,
  useStatusHistoryByTaxNoteId,
  useReviewRecordsByTaxNoteId,
  useAppStore,
} from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { StatusBadge } from '@/components/StatusBadge';
import { ProcessStepIndicator } from '@/components/ProcessStepIndicator';
import { Layout } from '@/components/Layout';
import { getStatusDisplayName } from '@/utils/stateMachine';
import { TaxNoteVersion, StatusHistory, ReviewRecord, BalanceChangeRecord } from '@/types';

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const taxNote = useTaxNoteById(id || '');
  const versions = useVersionsByTaxNoteId(id || '');
  const statusHistory = useStatusHistoryByTaxNoteId(id || '');
  const reviewRecords = useReviewRecordsByTaxNoteId(id || '');
  const balanceChanges = useAppStore(
    useShallow((state: { balanceChanges: BalanceChangeRecord[] }) =>
      state.balanceChanges.filter((bc: BalanceChangeRecord) => bc.taxNoteId === id)
    )
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (!taxNote) {
    return (
      <Layout>
        <div className="text-center py-12 text-slate-500">
          <p>未找到该记录</p>
          <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
            返回主界面
          </Link>
        </div>
      </Layout>
    );
  }

  const groupedVersions = versions.reduce((acc, version) => {
    const key = `${version.versionNumber}-${version.changedAt}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(version);
    return acc;
  }, {} as Record<string, TaxNoteVersion[]>);

  return (
    <Layout>
      <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          to="/"
          className="flex items-center space-x-1 text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            历史变更追踪
          </h2>
          <p className="text-sm text-slate-500">
            {taxNote.stockCode} {taxNote.stockName} · {taxNote.tradeDate} · 原始行号: {taxNote.originalLineNumber}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <StatusBadge status={taxNote.processingStatus} />
            <ProcessStepIndicator currentStep={taxNote.currentStep} />
            <span className="text-sm text-slate-500">当前版本: v{taxNote.version}</span>
          </div>
          <div className="text-sm text-slate-500">
            共 {versions.length} 次字段变更 · {statusHistory.length} 次状态流转
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-800 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <span>字段变更历史</span>
          </h3>

          <div className="space-y-4">
            {Object.entries(groupedVersions).map(([key, groupVersions]) => {
              const [versionNumber, timestamp] = key.split('-');
              const sampleVersion = groupVersions[0];

              return (
                <div
                  key={key}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-mono font-medium">
                        v{versionNumber}
                      </span>
                      <span className="text-sm text-slate-600">
                        {groupVersions.length} 个字段变更
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-500">
                      <User className="w-3.5 h-3.5" />
                      <span>{sampleVersion.changedBy}</span>
                      <span>·</span>
                      <span>{formatDate(sampleVersion.changedAt)}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {groupVersions.map((version) => (
                      <div key={version.id} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-slate-700">
                            {version.fieldName}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <div className="flex-1 bg-red-50 border border-red-200 rounded p-2">
                            <p className="text-xs text-red-500 mb-0.5">变更前</p>
                            <p className="text-red-700 font-mono text-xs line-through">
                              {version.oldValue || '(空)'}
                            </p>
                          </div>
                          <div className="flex-1 bg-green-50 border border-green-200 rounded p-2">
                            <p className="text-xs text-green-500 mb-0.5">变更后</p>
                            <p className="text-green-700 font-mono text-xs">
                              {version.newValue || '(空)'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                          原因: {version.changeReason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {versions.length === 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
                暂无字段变更记录
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-800 flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-blue-600" />
            <span>状态流转历史</span>
          </h3>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 space-y-4">
              {statusHistory.map((history, index) => (
                <div key={history.id} className="relative pl-8 pb-4">
                  {index < statusHistory.length - 1 && (
                    <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200" />
                  )}
                  <div className="absolute left-0 top-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">{index + 1}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-500">
                        {history.fromStatus ? getStatusDisplayName(history.fromStatus) : '初始状态'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <StatusBadge status={history.toStatus} />
                    </div>
                    <p className="text-sm text-slate-700">{history.remark}</p>
                    <p className="text-xs text-slate-500 flex items-center space-x-2">
                      <User className="w-3 h-3" />
                      <span>{history.operatedBy}</span>
                      <span>·</span>
                      <span>{formatDate(history.operatedAt)}</span>
                    </p>
                  </div>
                </div>
              ))}

              {statusHistory.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  暂无状态流转记录
                </div>
              )}
            </div>
          </div>

          {reviewRecords.length > 0 && (
            <>
              <h3 className="text-lg font-medium text-slate-800 mt-6">风控复核记录</h3>
              <div className="space-y-3">
                {reviewRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`bg-white rounded-lg border p-4 ${
                      record.isReversed
                        ? 'border-gray-300 bg-gray-50 opacity-60'
                        : record.reviewResult === 'APPROVED'
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-red-300 bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          record.reviewResult === 'APPROVED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {record.reviewResult === 'APPROVED' ? '复核通过' : '复核驳回'}
                      </span>
                      {record.isReversed && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          已回滚
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{record.reviewOpinion}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>复核人: {record.reviewedBy}</span>
                      <span>{formatDate(record.reviewedAt)}</span>
                    </div>
                    {record.isReversed && record.reversedBy && (
                      <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                        回滚人: {record.reversedBy} · {record.reversedAt && formatDate(record.reversedAt)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">最终状态总结</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">当前状态</h4>
            <StatusBadge status={taxNote.processingStatus} />
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">流程阶段</h4>
            <ProcessStepIndicator currentStep={taxNote.currentStep} />
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">当前税费金额</h4>
            <p className={`text-lg font-mono ${
              taxNote.currentAmount !== taxNote.originalAmount ? 'text-amber-600' : 'text-slate-800'
            }`}>
              HK$ {taxNote.currentAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">摘要</h4>
            <p className="text-sm text-slate-800">
              {taxNote.summary || '（未填写）'}
            </p>
          </div>
        </div>
        {statusHistory.length > 0 && (
          <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 font-medium">最近状态变更原因</p>
            <p className="text-sm text-blue-700 mt-1">
              {statusHistory[0].remark}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              {statusHistory[0].operatedBy} · {formatDate(statusHistory[0].operatedAt)}
            </p>
          </div>
        )}
      </div>

      {balanceChanges.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-cyan-600" />
            <span>余额变化明细</span>
          </h3>
          <div className="space-y-3">
            {balanceChanges.map((bc: BalanceChangeRecord) => (
              <div key={bc.id} className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <div className="grid grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">变更前余额</p>
                    <p className="font-mono text-slate-800">HK$ {bc.previousBalance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">变更金额</p>
                    <p className={`font-mono ${bc.changeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {bc.changeAmount >= 0 ? '+' : ''}HK$ {bc.changeAmount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">变更后余额</p>
                    <p className="font-mono text-slate-800">HK$ {bc.newBalance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">变更类型</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      bc.changeType === 'TAX' ? 'bg-blue-100 text-blue-700'
                      : bc.changeType === 'ADJUSTMENT' ? 'bg-amber-100 text-amber-700'
                      : bc.changeType === 'REVERSAL' ? 'bg-red-100 text-red-700'
                      : 'bg-purple-100 text-purple-700'
                    }`}>
                      {bc.changeType === 'TAX' ? '税费' : bc.changeType === 'ADJUSTMENT' ? '调整' : bc.changeType === 'REVERSAL' ? '冲正' : '节假日'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">备注</p>
                    <p className="text-slate-700 text-xs">{bc.remark}</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                  <span>{bc.generatedBy} · {formatDate(bc.generatedAt)}</span>
                  <span>版本: v{bc.version}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">原始证据保留</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">原始行号</h4>
            <p className="text-lg font-mono text-slate-800">{taxNote.originalLineNumber}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">业务主键</h4>
            <p className="text-sm font-mono text-slate-800">{taxNote.id}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg col-span-2">
            <h4 className="text-sm font-medium text-slate-500 mb-2">原始备注（永久不可修改）</h4>
            <p className="text-slate-800 font-mono text-sm bg-white p-3 rounded border border-slate-200">
              {taxNote.originalRemark}
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">原始税费金额</h4>
            <p className="text-lg font-mono text-slate-800">HK$ {taxNote.originalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-slate-500 mb-2">当前税费金额</h4>
            <p className={`text-lg font-mono ${
              taxNote.currentAmount !== taxNote.originalAmount ? 'text-amber-600' : 'text-slate-800'
            }`}>
              HK$ {taxNote.currentAmount.toFixed(2)}
              {taxNote.currentAmount !== taxNote.originalAmount && ' (已修改)'}
            </p>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
}
