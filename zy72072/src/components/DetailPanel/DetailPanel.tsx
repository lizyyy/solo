import { useState } from 'react';
import { X, Save, Clock, MapPin, FileText, AlertTriangle, CheckCircle, HelpCircle, Database } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PointStatus } from '../../types';
import { cn } from '../../lib/utils';

const statusConfig = {
  normal: { label: '正常', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  pending: { label: '待确认', icon: HelpCircle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  abnormal: { label: '异常', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
};

export const DetailPanel = () => {
  const {
    selectedPointId,
    setSelectedPointId,
    lightPoints,
    updatePointStatus,
    updatePointRemark,
    updatePointSuggestion,
  } = useProjectStore();

  const [editRemark, setEditRemark] = useState('');
  const [editSuggestion, setEditSuggestion] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const selectedPoint = lightPoints.find((p) => p.id === selectedPointId);

  if (!selectedPoint) {
    return (
      <div className="h-full flex flex-col bg-slate-900 text-white items-center justify-center">
        <MapPin className="w-16 h-16 text-slate-600 mb-4" />
        <p className="text-slate-500 text-center px-4">
          点击左侧列表或3D场景中的点位
          <br />
          查看详细信息
        </p>
      </div>
    );
  }

  const StatusIcon = statusConfig[selectedPoint.status].icon;

  const handleStartEdit = () => {
    setEditRemark(selectedPoint.remark);
    setEditSuggestion(selectedPoint.suggestion);
    setIsEditing(true);
  };

  const handleSave = () => {
    updatePointRemark(selectedPoint.id, editRemark);
    updatePointSuggestion(selectedPoint.id, editSuggestion);
    setIsEditing(false);
  };

  const handleStatusChange = (status: PointStatus) => {
    updatePointStatus(selectedPoint.id, status);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold">点位详情</h2>
        <button
          onClick={() => setSelectedPointId(null)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">{selectedPoint.name}</h3>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded text-sm',
                  statusConfig[selectedPoint.status].bg,
                  statusConfig[selectedPoint.status].color
                )}
              >
                <StatusIcon className="w-4 h-4" />
                {statusConfig[selectedPoint.status].label}
              </span>
              <span className="text-xs text-slate-500">
                ID: {selectedPoint.id}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4" />
                <span>
                  X: {selectedPoint.x.toFixed(2)} &nbsp; Y: {selectedPoint.y.toFixed(2)} &nbsp; Z:{' '}
                  {selectedPoint.z.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4" />
                <span>更新于 {selectedPoint.updateTime}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              来源追溯
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">数据来源</span>
                <span className="text-white">{selectedPoint.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">来源行号</span>
                <span className="text-white font-mono">{selectedPoint.sourceRow}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">创建时间</span>
                <span className="text-white">{selectedPoint.createTime}</span>
              </div>
              {selectedPoint.metadata?.modifiedBy && (
                <div className="flex justify-between">
                  <span className="text-slate-400">处理人</span>
                  <span className="text-white">{selectedPoint.metadata.modifiedBy}</span>
                </div>
              )}
              {selectedPoint.metadata?.photoUrl && (
                <div className="flex justify-between">
                  <span className="text-slate-400">关联照片</span>
                  <span className="text-cyan-400">{selectedPoint.metadata.photoUrl}</span>
                </div>
              )}
              {selectedPoint.metadata?.originalX !== undefined && (
                <div className="mt-2 p-2 bg-slate-700/50 rounded">
                  <p className="text-xs text-slate-400 mb-1">原始坐标（手改前）</p>
                  <p className="text-xs font-mono">
                    X: {selectedPoint.metadata.originalX?.toFixed(2)} &nbsp; Y:{' '}
                    {selectedPoint.metadata.originalY?.toFixed(2)} &nbsp; Z:{' '}
                    {selectedPoint.metadata.originalZ?.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">状态修改</h4>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'pending', 'abnormal'] as const).map((status) => {
                const Icon = statusConfig[status].icon;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg transition-all border',
                      selectedPoint.status === status
                        ? `${statusConfig[status].bg} border-transparent`
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    )}
                  >
                    <Icon className={cn('w-5 h-5', statusConfig[status].color)} />
                    <span className="text-xs">{statusConfig[status].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                处理备注
              </h4>
              {!isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  编辑
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-sm resize-none h-20 focus:outline-none focus:border-blue-500"
                placeholder="输入处理备注..."
              />
            ) : (
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {selectedPoint.remark || '暂无备注'}
              </p>
            )}
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              处理建议
            </h4>
            {isEditing ? (
              <textarea
                value={editSuggestion}
                onChange={(e) => setEditSuggestion(e.target.value)}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-sm resize-none h-24 focus:outline-none focus:border-blue-500"
                placeholder="输入处理建议，业务同事能照着做的提醒..."
              />
            ) : (
              <div
                className={cn(
                  'p-3 rounded text-sm',
                  selectedPoint.status === 'normal' && 'bg-emerald-900/30 border border-emerald-700/50',
                  selectedPoint.status === 'pending' && 'bg-amber-900/30 border border-amber-700/50',
                  selectedPoint.status === 'abnormal' && 'bg-red-900/30 border border-red-700/50'
                )}
              >
                <p className="text-slate-200 whitespace-pre-wrap">
                  {selectedPoint.suggestion || '暂无建议'}
                </p>
              </div>
            )}
          </div>

          {isEditing && (
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              保存修改
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
