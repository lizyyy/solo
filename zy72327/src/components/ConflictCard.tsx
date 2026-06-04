import { useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Conflict } from '../types';
import { cn } from '@/lib/utils';

interface Props {
  conflict: Conflict;
  onResolve: (id: string, resolution: 'accept_example' | 'reject_example', reason: string) => Promise<void>;
  disabled?: boolean;
}

export default function ConflictCard({ conflict, onResolve, disabled = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [resolving, setResolving] = useState(false);

  const getDiffColor = (diff: number) => {
    if (diff > 10) return 'text-red-600 bg-red-50 border-red-200';
    if (diff >= 5) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  const handleResolve = async (resolution: 'accept_example' | 'reject_example') => {
    if (!reason.trim()) return;
    setResolving(true);
    try {
      await onResolve(conflict.id, resolution, reason);
      setReason('');
    } finally {
      setResolving(false);
    }
  };

  const isPending = conflict.status === 'pending';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 overflow-hidden',
        'transition-all duration-300 ease-out',
        'hover:shadow-lg hover:-translate-y-0.5',
        disabled && 'opacity-60 pointer-events-none'
      )}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{conflict.productName}</h3>
            <p className="text-sm text-gray-500">ID: {conflict.id}</p>
          </div>
        </div>
        <span
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            isPending
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
          )}
        >
          {isPending ? '待处理' : '已解决'}
        </span>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-stretch">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">
              参数调试表结论
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {conflict.parameterValue.toFixed(2)}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div
              className={cn(
                'px-4 py-2 rounded-lg border font-bold text-lg',
                'transition-all duration-500',
                'animate-pulse',
                getDiffColor(conflict.diffPercentage)
              )}
            >
              {conflict.diffPercentage.toFixed(1)}%
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">
              手算反例
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {conflict.exampleValue.toFixed(2)}
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span className="font-medium">证据详情</span>
          <div className="transition-transform duration-300" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
          )}
        >
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
            {conflict.evidence}
          </div>
        </div>

        {isPending ? (
          <div className="mt-6 space-y-4">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请填写决策理由"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              rows={3}
              disabled={resolving}
            />
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleResolve('accept_example')}
                disabled={!reason.trim() || resolving}
                className={cn(
                  'flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200',
                  'bg-green-600 hover:bg-green-700 active:scale-98',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600'
                )}
              >
                <Check className="w-5 h-5" />
                确认手算反例
              </button>
              <button
                onClick={() => handleResolve('reject_example')}
                disabled={!reason.trim() || resolving}
                className={cn(
                  'flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200',
                  'bg-gray-600 hover:bg-gray-700 active:scale-98',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-600'
                )}
              >
                <X className="w-5 h-5" />
                驳回维持原结论
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {conflict.resolution === 'accept_example' ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">已确认手算反例</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-700">已驳回，维持原结论</span>
                </>
              )}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">决策理由：</span>
              {conflict.resolutionReason}
            </div>
            {conflict.resolvedBy && (
              <div className="text-xs text-gray-500 mt-2">
                处理人：{conflict.resolvedBy} · {conflict.resolvedAt}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
