import React, { useMemo } from 'react';
import { ArrowRight, Clock, User, Plus, Minus, Edit3, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import type { VersionCompareResult, VersionDiff, VersionHistory } from '../../shared/types';

interface VersionCompareProps {
  compareResult: VersionCompareResult;
  versionInfo?: {
    before?: VersionHistory;
    after?: VersionHistory;
  };
  className?: string;
  showOnlyChanges?: boolean;
}

const fieldLabels: Record<string, string> = {
  businessNo: '业务编号',
  buyerName: '买方名称',
  sellerName: '卖方名称',
  totalAmount: '总金额',
  financingAmount: '融资金额',
  currentStatus: '当前状态',
  overdueDays: '逾期天数',
  riskLevel: '风险等级',
  invoiceNo: '发票号',
  amount: '金额',
  taxAmount: '税额',
  goodsDescription: '货物描述',
  issueDate: '开票日期',
  dueDate: '到期日',
  status: '状态',
  confirmDate: '确认日期',
  confirmAmount: '确认金额',
  goodsReceived: '已收货',
  qualityIssue: '质量问题',
  qualityIssueDesc: '质量问题描述',
  confirmer: '确认人',
  isWithdrawn: '已撤回',
  withdrawReason: '撤回原因',
  withdrawDate: '撤回日期',
  contractNo: '合同号',
  factoringRate: '保理费率',
  startDate: '开始日期',
  endDate: '结束日期',
  instalmentNo: '期次',
  principal: '本金',
  interest: '利息',
  plannedDate: '计划日期',
  collectionDate: '催收日期',
  collector: '催收人',
  collectionMethod: '催收方式',
  contactPerson: '联系人',
  contactResult: '联系结果',
  nextAction: '下一步行动',
  followUpDate: '跟进日期',
  reportDate: '报告日期',
  analyst: '分析师',
  keyFindings: '关键发现',
  recommendations: '建议',
  createdAt: '创建时间',
  updatedAt: '更新时间',
};

const getFieldLabel = (field: string): string => {
  return fieldLabels[field] || field;
};

const formatValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

export const VersionCompare: React.FC<VersionCompareProps> = ({
  compareResult,
  versionInfo,
  className,
  showOnlyChanges = false,
}) => {
  const allFields = useMemo(() => {
    const fields = new Set<string>();
    Object.keys(compareResult.before || {}).forEach(f => fields.add(f));
    Object.keys(compareResult.after || {}).forEach(f => fields.add(f));
    return Array.from(fields);
  }, [compareResult]);

  const displayFields = useMemo(() => {
    if (!showOnlyChanges) {
      return allFields;
    }
    return allFields.filter(field =>
      compareResult.diffs.some(d => d.field === field)
    );
  }, [allFields, compareResult.diffs, showOnlyChanges]);

  const getDiffForField = (field: string): VersionDiff | undefined => {
    return compareResult.diffs.find(d => d.field === field);
  };

  const getChangeTypeStyle = (changeType?: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-50 border-green-200';
      case 'removed':
        return 'bg-red-50 border-red-200';
      case 'modified':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-white border-slate-200';
    }
  };

  const getChangeIcon = (changeType?: string) => {
    switch (changeType) {
      case 'added':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-red-600" />;
      case 'modified':
        return <Edit3 className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
      {/* Header */}
      {(versionInfo?.before || versionInfo?.after) && (
        <div className="grid grid-cols-2 border-b border-slate-200">
          <div className="p-4 bg-slate-50 border-r border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">历史版本</span>
              {versionInfo?.before && (
                <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs font-medium">
                  v{versionInfo.before.version}
                </span>
              )}
            </div>
            {versionInfo?.before && (
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(versionInfo.before.timestamp)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>{versionInfo.before.operatorName}</span>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-700">当前版本</span>
              {versionInfo?.after && (
                <span className="ml-auto px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs font-medium">
                  v{versionInfo.after.version}
                </span>
              )}
            </div>
            {versionInfo?.after && (
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(versionInfo.after.timestamp)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>{versionInfo.after.operatorName}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Reason */}
      {versionInfo?.after?.changeReason && (
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-start gap-2">
            <Edit3 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-slate-700">变更原因：</span>
              <span className="text-sm text-slate-600">{versionInfo.after.changeReason}</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {compareResult.diffs.length > 0 && (
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                新增 {compareResult.diffs.filter(d => d.changeType === 'added').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                删除 {compareResult.diffs.filter(d => d.changeType === 'removed').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                修改 {compareResult.diffs.filter(d => d.changeType === 'modified').length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-48 px-4 py-3 text-left text-sm font-semibold text-slate-700 border-r border-slate-200">
                字段
              </th>
              <th className="w-2/5 px-4 py-3 text-left text-sm font-semibold text-slate-700 border-r border-slate-200">
                历史值
              </th>
              <th className="w-12 px-2 py-3 text-center border-r border-slate-200">
                <ArrowRight className="w-4 h-4 text-slate-400 mx-auto" />
              </th>
              <th className="w-2/5 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                当前值
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayFields.map((field) => {
              const diff = getDiffForField(field);
              const beforeValue = compareResult.before?.[field];
              const afterValue = compareResult.after?.[field];
              const hasChange = !!diff;

              return (
                <tr
                  key={field}
                  className={cn(
                    'transition-colors',
                    hasChange && getChangeTypeStyle(diff?.changeType)
                  )}
                >
                  <td className="px-4 py-3 border-r border-slate-200">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(diff?.changeType)}
                      <span className="text-sm font-medium text-slate-700">
                        {getFieldLabel(field)}
                      </span>
                      {hasChange && (
                        <span className="ml-auto text-xs text-slate-400">
                          {diff?.changeType === 'added' && '新增'}
                          {diff?.changeType === 'removed' && '删除'}
                          {diff?.changeType === 'modified' && '修改'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={cn(
                    'px-4 py-3 border-r border-slate-200 font-mono text-sm',
                    diff?.changeType === 'removed'
                      ? 'text-red-700 line-through'
                      : 'text-slate-600'
                  )}>
                    <pre className="whitespace-pre-wrap break-all">
                      {formatValue(beforeValue)}
                    </pre>
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-200">
                    {diff?.changeType === 'modified' && (
                      <ArrowRight className="w-4 h-4 text-amber-500 mx-auto" />
                    )}
                  </td>
                  <td className={cn(
                    'px-4 py-3 font-mono text-sm',
                    diff?.changeType === 'added'
                      ? 'text-green-700'
                      : diff?.changeType === 'modified'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                  )}>
                    <pre className="whitespace-pre-wrap break-all">
                      {formatValue(afterValue)}
                    </pre>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {displayFields.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">暂无差异数据</p>
        </div>
      )}
    </div>
  );
};

export default VersionCompare;
