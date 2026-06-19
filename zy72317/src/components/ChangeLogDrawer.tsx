import React from 'react';
import { X, Clock, User, FileText, CheckSquare, AlertTriangle } from 'lucide-react';
import type { ChangeRecord, GapReviewInfo, RouteSnapshot, RouteOptimizationResult, RouteStatus } from '../../shared/types';
import dayjs from 'dayjs';

interface ChangeLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  changes: ChangeRecord[];
  originalLineNo: number;
  currentLineNo: number;
}

const actionLabels: Record<string, string> = {
  import: '导入',
  delete: '删除',
  supplement: '补录',
  recalculate: '重算',
  status_update: '状态更新',
  gap_review: '断档复核',
};

const actionColors: Record<string, string> = {
  import: 'bg-green-500',
  delete: 'bg-red-500',
  supplement: 'bg-blue-500',
  recalculate: 'bg-purple-500',
  status_update: 'bg-warning-500',
  gap_review: 'bg-indigo-500',
};

interface GapReviewAfterValue {
  gapReviewInfo: GapReviewInfo;
  status?: RouteStatus;
}

interface DeleteBeforeValue extends RouteSnapshot {
  routeData?: RouteOptimizationResult;
}

interface SupplementAfterValue {
  originalLineNo: number;
  currentLineNo?: number;
  status?: RouteStatus;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasGapReviewInfo(v: unknown): v is GapReviewAfterValue {
  return isRecord(v) && isRecord((v as UnknownRecord).gapReviewInfo);
}

function isDeleteBefore(v: unknown): v is DeleteBeforeValue {
  if (!isRecord(v)) return false;
  return typeof (v as UnknownRecord).currentLineNo === 'number';
}

function isSupplementAfter(v: unknown): v is SupplementAfterValue {
  if (!isRecord(v)) return false;
  return (v as UnknownRecord).originalLineNo === -1;
}

const renderChangeDetail = (change: ChangeRecord) => {
  const before = change.beforeValue;
  const after = change.afterValue;

  if (change.action === 'gap_review' && hasGapReviewInfo(after)) {
    const info = after.gapReviewInfo;
    return (
      <div className="space-y-2 mt-2">
        <div className="bg-indigo-50 border border-indigo-200 rounded p-3 text-xs text-indigo-800">
          <div className="flex items-center mb-1.5 font-medium text-indigo-900">
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
            断档复核详情
          </div>
          <div className="space-y-1.5">
            <div>
              <span className="text-gray-500">原始断档：</span>
              <span className="font-mono ml-1">
                #{info.originalGap.beforeLineNo} → #{info.originalGap.afterLineNo}，
                缺失 {info.originalGap.missingCount} 条
              </span>
            </div>
            <div>
              <span className="text-gray-500">处理方式：</span>
              <span className="ml-1 font-medium">
                {info.resolutionType === 'accept_gap' && '接受断档不修正'}
                {info.resolutionType === 'supplement_fill' && '补录填充断档'}
                {info.resolutionType === 'renumber' && '后续重排编号'}
                {info.resolutionType === 'other' && '其他方式'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">复核说明：</span>
              <span className="ml-1">{info.resolutionRemark}</span>
            </div>
            {info.nextHandler && (
              <div>
                <span className="text-gray-500">下一步责任人：</span>
                <span className="ml-1 font-medium text-indigo-900">{info.nextHandler}</span>
              </div>
            )}
            <div className="text-xs text-gray-500 pt-1 border-t border-indigo-100">
              复核人：{info.reviewedBy} · {dayjs(info.reviewedAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        </div>
        {isRecord(before) && typeof (before as UnknownRecord).status === 'string' && isRecord(after) && typeof (after as UnknownRecord).status === 'string' && (
          <div className="text-xs text-gray-500 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1 text-warning-500" />
            状态：{(before as UnknownRecord).status as string} → {(after as UnknownRecord).status as string}
          </div>
        )}
      </div>
    );
  }

  if (change.action === 'delete' && isDeleteBefore(before)) {
    return (
      <div className="text-xs text-gray-500 space-y-1">
        <p className="text-red-600 font-medium">删除前编号：</p>
        <div className="bg-red-50 p-2 rounded">
          <div>原始行号：{before.originalLineNo}</div>
          <div>当前编号：{before.currentLineNo}</div>
          <div>订单号：{before.orderNo || before.routeData?.orderNo}</div>
          <div>SKU：{before.sku || before.routeData?.sku}</div>
        </div>
      </div>
    );
  }

  if (change.action === 'supplement' && isSupplementAfter(after)) {
    return (
      <div className="text-xs text-gray-500 space-y-1">
        <p className="text-blue-600 font-medium">补录说明：</p>
        <div className="bg-blue-50 p-2 rounded">
          <div>原始行号：补录（-1）</div>
          <div>当前编号：{after.currentLineNo || '待重算分配'}</div>
          <div className="text-gray-500 pt-1 border-t border-blue-100 mt-1">
            补录后需点击"补录后重算"按钮重新计算拣货参数
          </div>
        </div>
      </div>
    );
  }

  const beforeRec = isRecord(before) ? before : null;
  const afterRec = isRecord(after) ? after : null;

  return (
    <>
      {beforeRec && Object.keys(beforeRec).length > 0 && (
        <div className="text-xs text-gray-500 mb-1">
          <span className="text-red-600 font-medium">变更前：</span>
          <pre className="mt-1 bg-red-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(beforeRec, null, 2)}
          </pre>
        </div>
      )}
      {afterRec && Object.keys(afterRec).length > 0 && (
        <div className="text-xs text-gray-500">
          <span className="text-green-600 font-medium">变更后：</span>
          <pre className="mt-1 bg-green-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(afterRec, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
};

export const ChangeLogDrawer: React.FC<ChangeLogDrawerProps> = ({
  isOpen,
  onClose,
  changes,
  originalLineNo,
  currentLineNo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl transform transition-transform">
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-gray-900">变更历史</h3>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    原始行号：{originalLineNo === -1 ? '补录' : originalLineNo}
                  </span>
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    当前编号：{currentLineNo}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {changes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">暂无变更记录</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-6">
                  {changes.map((change, index) => (
                    <div key={index} className="relative pl-8">
                      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full ${actionColors[change.action] || 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold`}>
                        {changes.length - index}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${actionColors[change.action] || 'bg-gray-500'}`}>
                            {actionLabels[change.action] || change.action}
                          </span>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {dayjs(change.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <User className="w-4 h-4 mr-1" />
                          <span>{change.operator}</span>
                        </div>
                        {change.remark && (
                          <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{change.remark}</p>
                        )}
                        {renderChangeDetail(change)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
