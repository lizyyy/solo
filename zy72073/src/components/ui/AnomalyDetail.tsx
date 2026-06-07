import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Database,
  MapPin,
  MessageSquare,
  User,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  statusLabels,
  sourceLabels,
  conflictTypeLabels,
  formatTimestamp,
  getStatusBgClass,
} from '../../utils/helpers';

export const AnomalyDetail: React.FC = () => {
  const { selectedPointId, points, resolveConflict, addProcessRecord, updatePointStatus } =
    useStore();
  const [remark, setRemark] = useState('');
  const [showStatusSelect, setShowStatusSelect] = useState(false);

  const selectedPoint = points.find((p) => p.id === selectedPointId);

  if (!selectedPoint) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
            <MapPin size={24} className="text-slate-600" />
          </div>
          <p>点击3D场景中的点位</p>
          <p className="text-xs mt-1">查看详细信息和来源追溯</p>
        </div>
      </div>
    );
  }

  const hasConflict = selectedPoint.conflict && !selectedPoint.conflict.resolved;

  const handleAddRemark = () => {
    if (!remark.trim()) return;
    addProcessRecord(selectedPoint.id, {
      operator: '阿乔',
      action: '添加备注',
      remark,
      status: selectedPoint.status,
    });
    setRemark('');
  };

  const handleResolveConflict = (resolution: 'use_system' | 'use_photo' | 'manual') => {
    resolveConflict(selectedPoint.id, resolution, remark || '人工裁决');
    setRemark('');
  };

  const handleStatusChange = (status: 'normal' | 'warning' | 'error' | 'pending') => {
    updatePointStatus(selectedPoint.id, status);
    setShowStatusSelect(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-slate-100 font-medium text-sm">{selectedPoint.deviceName}</h3>
            <p className="text-slate-500 text-xs mt-1">ID: {selectedPoint.id}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowStatusSelect(!showStatusSelect)}
              className={`px-3 py-1 text-xs border ${getStatusBgClass(selectedPoint.status)}`}
            >
              {statusLabels[selectedPoint.status]}
            </button>
            {showStatusSelect && (
              <div className="absolute right-0 mt-1 bg-slate-900 border border-slate-700 z-10 w-28">
                {(['normal', 'warning', 'error', 'pending'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${
                      s === selectedPoint.status ? 'text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin size={12} />
            <span className="font-mono">
              {selectedPoint.position.floor}层 ({selectedPoint.position.x.toFixed(1)},{' '}
              {selectedPoint.position.y.toFixed(1)}, {selectedPoint.position.z.toFixed(1)})
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            {selectedPoint.source === 'system' ? <Database size={12} /> : <Camera size={12} />}
            <span>{sourceLabels[selectedPoint.source]}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 col-span-2">
            <Clock size={12} />
            <span>来源: {selectedPoint.sourceRef}</span>
          </div>
        </div>
      </div>

      {hasConflict && (
        <div className="p-4 border-b border-slate-700/50 bg-orange-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-orange-400 text-sm font-medium">
              数据冲突 · {conflictTypeLabels[selectedPoint.conflict!.type]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-slate-800/50 border border-cyan-500/20 p-2">
              <div className="text-cyan-400 text-xs mb-1 flex items-center gap-1">
                <Database size={10} /> 系统数据
              </div>
              <p className="text-slate-300 text-xs">{selectedPoint.conflict!.evidence.system}</p>
            </div>
            <div className="bg-slate-800/50 border border-orange-500/20 p-2">
              <div className="text-orange-400 text-xs mb-1 flex items-center gap-1">
                <Camera size={10} /> 照片证据
              </div>
              <p className="text-slate-300 text-xs">{selectedPoint.conflict!.evidence.photo}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 p-2 mb-3">
            <div className="text-slate-400 text-xs mb-1">💡 系统建议</div>
            <p className="text-slate-300 text-xs">{selectedPoint.conflict!.suggestion}</p>
          </div>

          <div className="text-xs text-slate-400 mb-2">请选择裁决方式：</div>
          <div className="flex gap-2">
            <button
              onClick={() => handleResolveConflict('use_system')}
              className="flex-1 px-2 py-2 text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center gap-1"
            >
              <Check size={12} /> 采用系统数据
            </button>
            <button
              onClick={() => handleResolveConflict('use_photo')}
              className="flex-1 px-2 py-2 text-xs border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 flex items-center justify-center gap-1"
            >
              <Check size={12} /> 采用照片数据
            </button>
            <button
              onClick={() => handleResolveConflict('manual')}
              className="px-2 py-2 text-xs border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              手动处理
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="text-slate-400 text-xs mb-3 flex items-center gap-2">
          <MessageSquare size={12} />
          处理历史与备注
        </h4>

        <div className="space-y-3">
          {selectedPoint.processHistory
            .slice()
            .reverse()
            .map((record) => (
              <div key={record.id} className="relative pl-4 border-l-2 border-slate-700 pb-3">
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-600" />
                <div className="flex items-center gap-2 text-xs mb-1">
                  <User size={10} className="text-slate-500" />
                  <span className="text-slate-400">{record.operator}</span>
                  <span className="text-cyan-400">{record.action}</span>
                  <span className="text-slate-500 ml-auto">{formatTimestamp(record.timestamp)}</span>
                </div>
                <p className="text-slate-300 text-xs">{record.remark}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs border ${getStatusBgClass(record.status)}`}>
                  {statusLabels[record.status as keyof typeof statusLabels]}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="p-4 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="添加处理备注..."
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 px-3 py-2 text-xs focus:border-cyan-500/50 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAddRemark()}
          />
          <button
            onClick={handleAddRemark}
            disabled={!remark.trim()}
            className="px-4 py-2 text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
};
