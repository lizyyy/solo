import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  X,
  MessageSquare,
  Clock,
  User,
} from 'lucide-react';
import { useHandoverStore } from '@/store/useHandoverStore';
import {
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_SEVERITY_LABELS,
} from '@/types';
import { cn } from '@/lib/utils';

export default function Exceptions() {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'ignored'>('all');
  const [viewingException, setViewingException] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [resolution, setResolution] = useState('');

  const {
    getCurrentHandover,
    getExceptionsForHandover,
    getMaterialsForHandover,
    resolveException,
    ignoreException,
  } = useHandoverStore();

  const currentHandover = getCurrentHandover();

  if (!currentHandover) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gallery-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gallery-300 mb-4" />
          <h3 className="text-lg font-medium text-gallery-700 mb-2">请先选择交接单</h3>
          <p className="text-gallery-500">在交接工作台中选择或创建交接单</p>
        </div>
      </div>
    );
  }

  const exceptions = getExceptionsForHandover(currentHandover.id);
  const materials = getMaterialsForHandover(currentHandover.id);

  const filteredExceptions =
    filter === 'all'
      ? exceptions
      : exceptions.filter(e => e.status === filter);

  const stats = {
    total: exceptions.length,
    open: exceptions.filter(e => e.status === 'open').length,
    resolved: exceptions.filter(e => e.status === 'resolved').length,
    ignored: exceptions.filter(e => e.status === 'ignored').length,
  };

  const viewingExceptionData = viewingException
    ? exceptions.find(e => e.id === viewingException)
    : null;

  const getRelatedMaterial = (materialId?: string) => {
    return materials.find(m => m.id === materialId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-gallery-100 text-gallery-700 border-gallery-300';
    }
  };

  const handleResolve = () => {
    if (viewingException && resolution.trim()) {
      resolveException(viewingException, resolution.trim(), explanation.trim() || undefined);
      setViewingException(null);
      setResolution('');
      setExplanation('');
    }
  };

  const handleIgnore = () => {
    if (viewingException) {
      ignoreException(viewingException);
      setViewingException(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gallery-900">异常中心</h1>
        <p className="text-sm text-gallery-500 mt-1">管理和解释交接过程中的所有异常情况</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gallery-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-gallery-900">{stats.total}</div>
          <div className="text-sm text-gallery-500 mt-1">异常总数</div>
        </div>
        <div className="bg-white border border-gallery-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-accent-danger">{stats.open}</div>
          <div className="text-sm text-gallery-500 mt-1">待处理</div>
        </div>
        <div className="bg-white border border-gallery-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-accent-success">{stats.resolved}</div>
          <div className="text-sm text-gallery-500 mt-1">已解决</div>
        </div>
        <div className="bg-white border border-gallery-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-gallery-400">{stats.ignored}</div>
          <div className="text-sm text-gallery-500 mt-1">已忽略</div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'open', 'resolved', 'ignored'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded text-sm transition-colors',
              filter === f
                ? 'bg-gallery-900 text-white'
                : 'bg-gallery-100 text-gallery-600 hover:bg-gallery-200'
            )}
          >
            {f === 'all' ? '全部' : f === 'open' ? '待处理' : f === 'resolved' ? '已解决' : '已忽略'} (
            {f === 'all'
              ? stats.total
              : f === 'open'
              ? stats.open
              : f === 'resolved'
              ? stats.resolved
              : stats.ignored}
            )
          </button>
        ))}
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gallery-50 border-b border-gallery-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">严重程度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">描述</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">关联材料</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gallery-100">
              {filteredExceptions.map(exception => {
                const relatedMaterial = getRelatedMaterial(exception.relatedMaterialId);

                return (
                  <tr key={exception.id} className="hover:bg-gallery-50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded border',
                          getSeverityColor(exception.severity)
                        )}
                      >
                        {EXCEPTION_SEVERITY_LABELS[exception.severity]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {EXCEPTION_TYPE_LABELS[exception.type]}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {exception.description}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {relatedMaterial ? (
                        <span className="text-accent-info hover:underline cursor-pointer">
                          {relatedMaterial.name}
                        </span>
                      ) : (
                        <span className="text-gallery-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded',
                          exception.status === 'open'
                            ? 'bg-red-100 text-red-700'
                            : exception.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gallery-100 text-gallery-600'
                        )}
                      >
                        {exception.status === 'open'
                          ? '待处理'
                          : exception.status === 'resolved'
                          ? '已解决'
                          : '已忽略'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gallery-500">
                      {new Date(exception.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewingException(exception.id)}
                        className="p-1.5 text-gallery-500 hover:text-gallery-700 hover:bg-gallery-100 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredExceptions.length === 0 && (
          <div className="p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-accent-success mb-3" />
            <p className="text-gallery-500">暂无异常记录</p>
          </div>
        )}
      </div>

      {viewingExceptionData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gallery-200">
              <h3 className="font-medium flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent-warning" />
                异常详情
              </h3>
              <button
                onClick={() => {
                  setViewingException(null);
                  setExplanation('');
                  setResolution('');
                }}
                className="p-1 hover:bg-gallery-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-60px)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">类型</div>
                    <div className="font-medium">
                      {EXCEPTION_TYPE_LABELS[viewingExceptionData.type]}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">严重程度</div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded border inline-block',
                        getSeverityColor(viewingExceptionData.severity)
                      )}
                    >
                      {EXCEPTION_SEVERITY_LABELS[viewingExceptionData.severity]}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">状态</div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded inline-block',
                        viewingExceptionData.status === 'open'
                          ? 'bg-red-100 text-red-700'
                          : viewingExceptionData.status === 'resolved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gallery-100 text-gallery-600'
                      )}
                    >
                      {viewingExceptionData.status === 'open'
                        ? '待处理'
                        : viewingExceptionData.status === 'resolved'
                        ? '已解决'
                        : '已忽略'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">创建时间</div>
                    <div className="text-sm">
                      {new Date(viewingExceptionData.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gallery-500 mb-1">描述</div>
                  <div className="bg-gallery-50 rounded p-3 text-sm">
                    {viewingExceptionData.description}
                  </div>
                </div>

                {viewingExceptionData.relatedMaterialId && (
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">关联材料</div>
                    <div className="bg-gallery-50 rounded p-3 text-sm">
                      {getRelatedMaterial(viewingExceptionData.relatedMaterialId)?.name ||
                        '材料已删除'}
                    </div>
                  </div>
                )}

                {viewingExceptionData.explanation && (
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">原因解释</div>
                    <div className="bg-gallery-50 rounded p-3 text-sm">
                      {viewingExceptionData.explanation}
                    </div>
                  </div>
                )}

                {viewingExceptionData.resolution && (
                  <div>
                    <div className="text-xs text-gallery-500 mb-1">解决方案</div>
                    <div className="bg-green-50 rounded p-3 text-sm text-green-700">
                      {viewingExceptionData.resolution}
                    </div>
                  </div>
                )}

                {viewingExceptionData.status === 'open' && (
                  <div className="border-t border-gallery-200 pt-4 space-y-4">
                    <div>
                      <label className="text-xs text-gallery-500 mb-1 block">
                        <MessageSquare className="w-3 h-3 inline mr-1" />
                        原因解释 (可选)
                      </label>
                      <textarea
                        value={explanation}
                        onChange={e => setExplanation(e.target.value)}
                        placeholder="说明异常产生的原因..."
                        className="w-full px-3 py-2 border border-gallery-300 rounded text-sm focus:outline-none focus:border-gallery-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gallery-500 mb-1 block">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        解决方案
                      </label>
                      <textarea
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        placeholder="描述如何解决此异常..."
                        className="w-full px-3 py-2 border border-gallery-300 rounded text-sm focus:outline-none focus:border-gallery-500"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleResolve}
                        disabled={!resolution.trim()}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-colors',
                          resolution.trim()
                            ? 'bg-accent-success text-white hover:bg-green-600'
                            : 'bg-gallery-200 text-gallery-400 cursor-not-allowed'
                        )}
                      >
                        <CheckCircle className="w-4 h-4" />
                        标记已解决
                      </button>
                      <button
                        onClick={handleIgnore}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-gallery-300 rounded text-sm hover:bg-gallery-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        忽略
                      </button>
                    </div>
                  </div>
                )}

                {viewingExceptionData.status === 'resolved' && (
                  <div className="border-t border-gallery-200 pt-4">
                    <div className="flex items-center gap-2 text-xs text-gallery-500">
                      <User className="w-3 h-3" />
                      <span>处理人: {viewingExceptionData.resolvedBy}</span>
                      <span className="mx-2">·</span>
                      <Clock className="w-3 h-3" />
                      <span>
                        处理时间: {new Date(viewingExceptionData.resolvedAt!).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
