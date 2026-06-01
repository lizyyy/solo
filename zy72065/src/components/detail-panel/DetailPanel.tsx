import { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  User,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useFilteredPoints, useConflictForPoint } from '../../hooks/useFilteredPoints';
import { getStatusColor, getStatusLabel, getSourceLabel } from '../../utils/terrain';
import { businessSuggestions } from '../../data/sampleData';

export function DetailPanel() {
  const selectedPointId = useStore((state) => state.selectedPointId);
  const filteredPoints = useFilteredPoints();
  const updatePoint = useStore((state) => state.updatePoint);
  const setShowConflictModal = useStore((state) => state.setShowConflictModal);
  const conflict = useConflictForPoint(selectedPointId || '');

  const [suggestion, setSuggestion] = useState('');
  const [handler, setHandler] = useState('何工');

  const point = filteredPoints.find((p) => p.id === selectedPointId);

  if (!point) {
    return (
      <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">点位详情</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <MapPin size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">点击点位查看详情</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveSuggestion = () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    updatePoint(point.id, {
      suggestion,
      handler,
      processedAt: now,
    });
  };

  const handleMarkRework = () => {
    updatePoint(point.id, {
      isReworked: true,
      reworkReason: '数据存在疑问，需重新核查',
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">点位详情</h2>
        <button
          onClick={() => useStore.getState().selectPoint(null)}
          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getStatusColor(point.status) }}
              />
              <span
                className="font-semibold"
                style={{ color: getStatusColor(point.status) }}
              >
                {getStatusLabel(point.status)}
              </span>
              {point.isReworked && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1">
                  <RefreshCw size={10} />
                  返工
                </span>
              )}
            </div>
            <h3 className="text-white font-medium text-lg">{point.name}</h3>
            <div className="text-xs text-gray-500 font-mono mt-1">{point.id}</div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <FileText size={14} />
              基本信息
            </h4>
            <div className="bg-gray-800/30 rounded-lg divide-y divide-gray-700/50">
              <div className="flex justify-between py-2 px-3">
                <span className="text-gray-400 text-sm">数据来源</span>
                <span className="text-white text-sm">{getSourceLabel(point.source)}</span>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-gray-400 text-sm">源文件</span>
                <span className="text-white text-sm font-mono text-xs">{point.sourceFile}</span>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-gray-400 text-sm">位移量</span>
                <span className="text-white text-sm font-mono">{point.displacement.toFixed(1)} mm</span>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-gray-400 text-sm">坐标位置</span>
                <span className="text-white text-sm font-mono text-xs">
                  ({point.coordinates.x.toFixed(2)}, {point.coordinates.y.toFixed(2)}, {point.coordinates.z.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Clock size={14} />
              处理记录
            </h4>
            <div className="bg-gray-800/30 rounded-lg divide-y divide-gray-700/50">
              <div className="flex justify-between py-2 px-3">
                <span className="text-gray-400 text-sm">导入时间</span>
                <span className="text-white text-sm text-xs">{point.importedAt}</span>
              </div>
              {point.processedAt && (
                <div className="flex justify-between py-2 px-3">
                  <span className="text-gray-400 text-sm">处理时间</span>
                  <span className="text-white text-sm text-xs">{point.processedAt}</span>
                </div>
              )}
              {point.handler && (
                <div className="flex justify-between py-2 px-3">
                  <span className="text-gray-400 text-sm">处理人</span>
                  <span className="text-white text-sm flex items-center gap-1">
                    <User size={12} />
                    {point.handler}
                  </span>
                </div>
              )}
            </div>
          </div>

          {point.hasConflict && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                <AlertTriangle size={14} />
                数据冲突警告
              </h4>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-sm mb-2">
                  该点位周会记录与导入数据存在差异
                </p>
                <button
                  onClick={() => setShowConflictModal(true, point.id)}
                  className="w-full py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm rounded transition-colors"
                >
                  查看冲突详情
                </button>
              </div>
            </div>
          )}

          {point.isCorrupted && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-red-500 flex items-center gap-2">
                <AlertCircle size={14} />
                数据损坏
              </h4>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">
                  {point.corruptionNote || '该点位数据存在异常，请检查原始文件'}
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  提示：运维工程师何工可直接定位该问题，无需重新翻周会截图
                </p>
              </div>
            </div>
          )}

          {point.photos && point.photos.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Camera size={14} />
                现场照片 ({point.photos.length})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {point.photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="aspect-square bg-gray-800 rounded flex items-center justify-center"
                  >
                    <Camera size={24} className="text-gray-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <CheckCircle size={14} />
              处理建议
            </h4>
            <div className="bg-gray-800/30 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">处理人</label>
                <input
                  type="text"
                  value={handler}
                  onChange={(e) => setHandler(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">处理意见</label>
                <textarea
                  value={suggestion || point.suggestion || ''}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="请输入业务同事能照着做的处理建议..."
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="text-xs text-gray-500">
                <p className="mb-1">快捷建议：</p>
                <div className="flex flex-wrap gap-1">
                  {businessSuggestions.slice(0, 4).map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSuggestion(s)}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 text-xs"
                    >
                      {s.slice(0, 8)}...
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSuggestion}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  保存处理意见
                </button>
                <button
                  onClick={handleMarkRework}
                  className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm rounded transition-colors border border-purple-500/30"
                  title="标记为返工"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </div>

          {point.reworkReason && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-purple-400">返工原因</h4>
              <p className="text-gray-300 text-sm bg-purple-500/10 rounded p-2">
                {point.reworkReason}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
