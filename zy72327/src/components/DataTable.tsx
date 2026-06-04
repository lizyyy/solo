import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, AlertTriangle, UserCheck } from 'lucide-react';
import type { ForecastResult } from '../types';
import CalculationDetail from './CalculationDetail';
import { formatValue, getReviewStatusText } from '../utils/exponentialSmoothing';
import { cn } from '@/lib/utils';

interface Props {
  results: ForecastResult[];
  onExport?: () => void;
  loading?: boolean;
}

export default function DataTable({ results, onExport, loading = false }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getReviewStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      pending_review: 'text-amber-700 bg-amber-100',
      reviewed: 'text-green-700 bg-green-100',
      normal: 'text-gray-700 bg-gray-100',
    };
    return colorMap[status] || colorMap.normal;
  };

  const getStatusBorderColor = (status: string): string => {
    if (status === 'pending_review') {
      return 'ring-2 ring-amber-300 ring-offset-1';
    }
    return '';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            共 <span className="font-semibold text-gray-900">{results.length}</span> 条记录
          </span>
          {results.some((r) => r.isMixedFormat) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
              <AlertTriangle className="w-3 h-3 animate-pulse" />
              {results.filter((r) => r.isMixedFormat).length} 条混合格式
            </span>
          )}
          {results.some((r) => r.reviewStatus === 'pending_review') && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">
              <UserCheck className="w-3 h-3" />
              {results.filter((r) => r.reviewStatus === 'pending_review').length} 条待复核
            </span>
          )}
        </div>
        {onExport && (
          <button
            onClick={onExport}
            disabled={loading || results.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 active:scale-98"
          >
            <Download className="w-4 h-4" />
            导出数据
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                产品ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                产品名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                预测值
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                参数版本
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                复核状态
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                混合格式
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((result) => {
              const isExpanded = expandedRows.has(result.id);
              const isMixed = result.isMixedFormat;
              const isPendingReview = result.reviewStatus === 'pending_review';

              return (
                <tr key={result.id}>
                  <td
                    colSpan={7}
                    className={cn(
                      'p-0 transition-all duration-200',
                      isMixed ? 'bg-amber-50' : 'bg-white',
                      'hover:bg-gray-50',
                      isPendingReview && getStatusBorderColor(result.reviewStatus)
                    )}
                  >
                    <div className="grid grid-cols-1">
                      <div
                        className={cn(
                          'grid grid-cols-[120px,1fr,120px,120px,120px,100px,80px] items-center px-6 py-4',
                          'cursor-pointer transition-colors duration-200'
                        )}
                      >
                        <div className="text-sm text-gray-600 font-mono">
                          {result.productId}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {result.productName}
                        </div>
                        <div className="text-sm font-semibold text-blue-600">
                          {formatValue(result.forecastValue, result.valueFormat)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {result.parameterVersion}
                        </div>
                        <div>
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                              getReviewStatusColor(result.reviewStatus)
                            )}
                          >
                            {isPendingReview && (
                              <AlertTriangle className="w-3 h-3 mr-1 animate-pulse" />
                            )}
                            {getReviewStatusText(result.reviewStatus)}
                          </span>
                        </div>
                        <div className="text-center">
                          {isMixed ? (
                            <span className="inline-flex items-center justify-center">
                              <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                              <span className="sr-only">是</span>
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">否</span>
                          )}
                        </div>
                        <div className="text-center">
                          <button
                            onClick={() => toggleRow(result.id)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-500 transition-transform duration-300" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-300 ease-in-out',
                          isExpanded
                            ? 'max-h-[1000px] opacity-100'
                            : 'max-h-0 opacity-0'
                        )}
                      >
                        <CalculationDetail result={result} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {results.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-gray-400 text-sm">暂无数据</div>
        </div>
      )}
    </div>
  );
}
