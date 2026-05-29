import { useState } from 'react';
import { useRecordStore } from '@/store/useRecordStore';
import { ExceptionBadge } from './ExceptionBadge';
import { AlertTriangle, CheckCircle, X, Eye, Filter } from 'lucide-react';
import type { Exception, ExceptionType } from '@/types';
import { EXCEPTION_TYPE_LABELS } from '@/types';

interface ExceptionPanelProps {
  onViewRecord: (recordId: string) => void;
}

export function ExceptionPanel({ onViewRecord }: ExceptionPanelProps) {
  const exceptions = useRecordStore((s) => s.getUnresolvedExceptions());
  const getRecordById = useRecordStore((s) => s.getRecordById);
  const resolveException = useRecordStore((s) => s.resolveException);
  const [activeType, setActiveType] = useState<ExceptionType | 'all'>('all');

  const types = ['all', ...(Object.keys(EXCEPTION_TYPE_LABELS) as ExceptionType[])];

  const filteredExceptions = exceptions.filter(
    (e) => activeType === 'all' || e.type === activeType
  );

  const groupedExceptions = filteredExceptions.reduce((acc, e) => {
    if (!acc[e.recordId]) {
      acc[e.recordId] = [];
    }
    acc[e.recordId].push(e);
    return acc;
  }, {} as Record<string, Exception[]>);

  if (exceptions.length === 0) {
    return (
      <div className="card text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
        <p className="text-vinyl-600">全部正常</p>
        <p className="text-sm text-vinyl-500 mt-1">暂无待处理异常</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-vinyl-600" />
          <span className="text-sm font-medium text-vinyl-600">按类型筛选</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type}
              className={`px-3 py-1 rounded-sm text-sm transition-colors ${
                activeType === type
                  ? 'bg-vinyl-700 text-white'
                  : 'bg-cream-100 text-vinyl-700 hover:bg-cream-200'
              }`}
              onClick={() => setActiveType(type as ExceptionType | 'all')}
            >
              {type === 'all' ? '全部' : EXCEPTION_TYPE_LABELS[type as ExceptionType]}
              <span className="ml-1 opacity-70">
                ({type === 'all'
                  ? exceptions.length
                  : exceptions.filter((e) => e.type === type).length
                })
              </span>
            </button>
          ))}
        </div>
      </div>

      {Object.entries(groupedExceptions).length === 0 ? (
        <div className="card text-center py-8 text-vinyl-500">
          该类型暂无异常
        </div>
      ) : (
        Object.entries(groupedExceptions).map(([recordId, recordExceptions]) => {
          const record = getRecordById(recordId);
          if (!record) return null;

          return (
            <div key={recordId} className="card exception-highlight animate-fade-in">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-vinyl-900">
                    {record.albumName}
                  </div>
                  <div className="text-sm text-vinyl-600">
                    {record.artist} · {record.catalogNumber}
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-sm hover:bg-vinyl-700/10 transition-colors text-vinyl-700"
                  onClick={() => onViewRecord(recordId)}
                  title="查看记录"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {recordExceptions.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 bg-cream-50 rounded-sm flex items-start justify-between gap-2"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ExceptionBadge type={e.type} resolved={e.resolved} />
                        {e.field && (
                          <span className="text-xs text-vinyl-500 bg-vinyl-700/10 px-2 py-0.5 rounded-sm">
                            {e.field}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-vinyl-700">{e.message}</p>
                      <p className="text-xs text-vinyl-500 mt-1">
                        {new Date(e.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <button
                      className="p-1.5 rounded-sm hover:bg-green-100 transition-colors text-green-600 flex-shrink-0"
                      onClick={() => resolveException(e.id)}
                      title="标记已解决"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
