import { X, MapPin, Calendar, User, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { GarbagePoint, SourceType } from '@/types';
import { useAppStore } from '@/store';
import StatusBadge from './StatusBadge';
import SourceBadge from './SourceBadge';
import { formatDateTime } from '@/utils/stringUtils';
import { mergeEngine } from '@/utils/mergeEngine';
import { useState } from 'react';

interface PointDetailPanelProps {
  point: GarbagePoint;
  onClose: () => void;
}

export default function PointDetailPanel({ point, onClose }: PointDetailPanelProps) {
  const { getPhotoUrl, getLogsByPointId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'sources' | 'conflicts' | 'logs'>('sources');
  
  const logs = getLogsByPointId(point.id);
  const conflicts = mergeEngine.detectConflicts(point);

  return (
    <div className="w-[480px] bg-white border-l border-neutral-200 flex flex-col h-full">
      <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
        <div>
          <h3 className="font-serif font-semibold text-lg text-neutral-800">
            {point.canonicalName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={point.status} />
            <span className="text-xs text-neutral-500">{point.street}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-neutral-100 rounded-sm transition-colors"
        >
          <X size={18} className="text-neutral-500" />
        </button>
      </div>

      <div className="p-4 border-b border-neutral-200">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-neutral-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-neutral-700">{point.address}</div>
              <div className="text-xs text-neutral-500">
                坐标: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-neutral-400 flex-shrink-0" />
            <span className="text-neutral-600">{point.mergeReason}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              创建: {formatDateTime(point.createdAt)}
            </div>
            <div className="flex items-center gap-1">
              <Clock size={12} />
              更新: {formatDateTime(point.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'sources'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          来源数据 ({point.sources.length})
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'conflicts'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          冲突检测
          {conflicts.length > 0 && (
            <span className="absolute top-2 right-3 w-4 h-4 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center">
              {conflicts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          操作日志 ({logs.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'sources' && (
          <div className="space-y-3">
            {point.sources.map((source) => (
              <div key={source.id} className="card p-3">
                <div className="flex items-start justify-between mb-2">
                  <SourceBadge type={source.sourceType} />
                  <span className="text-xs text-neutral-500">
                    置信度: {(source.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="font-medium text-neutral-800 mb-1">
                  {source.sourceName}
                </div>
                {source.photoUrl && (
                  <div className="mb-2">
                    <img
                      src={getPhotoUrl(source.photoUrl)}
                      alt={source.sourceName}
                      className="w-full h-32 object-cover rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5Zu+54mH5Liq5aSx6LSlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  </div>
                )}
                <div className="text-xs text-neutral-500 space-y-1">
                  <div className="flex items-center gap-1">
                    <User size={12} />
                    操作人: {source.operator}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    导入: {formatDateTime(source.importedAt)}
                  </div>
                </div>
                {Object.keys(source.rawData).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-neutral-100">
                    <div className="text-xs text-neutral-500 mb-1">原始数据:</div>
                    <pre className="text-xs bg-neutral-50 p-2 rounded-sm overflow-x-auto">
                      {JSON.stringify(source.rawData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="space-y-3">
            {conflicts.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <CheckCircle size={40} className="mx-auto mb-2 text-success-400" />
                <p>未检测到数据冲突</p>
              </div>
            ) : (
              conflicts.map((conflict, index) => (
                <div key={index} className="card p-3 border-danger-200 bg-danger-50">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle size={16} className="text-danger-500 mt-0.5 flex-shrink-0" />
                    <div className="font-medium text-danger-700">{conflict.description}</div>
                  </div>
                  <div className="space-y-2">
                    {conflict.evidence.map((item, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <SourceBadge type={item.source.sourceType} />
                        </div>
                        <div className="text-sm text-neutral-700 font-medium">
                          {item.source.sourceName}
                        </div>
                        <div className="text-xs text-neutral-600 mt-1">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  暂无操作日志
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="relative pl-8">
                    <div className="absolute left-1.5 w-3 h-3 rounded-full bg-primary-500 border-2 border-white" />
                    <div className="card p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-primary-600 uppercase">
                          {log.action}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-700">{log.detail}</div>
                      {log.evidence && (
                        <div className="mt-1 text-xs text-neutral-500 bg-neutral-50 p-2 rounded-sm">
                          证据: {log.evidence}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-neutral-400">
                        操作人: {log.operator}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
