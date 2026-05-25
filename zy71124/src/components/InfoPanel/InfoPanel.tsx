import { useState } from 'react';
import { Info, AlertTriangle, Eye, ChevronDown, EyeOff, BarChart3, Layers } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { ConflictDetector } from '../../engine/ConflictDetector';

export default function InfoPanel() {
  const {
    buses,
    selectedBusId,
    conflicts,
    currentTime,
    cameraView,
    viewMode,
    setCameraView,
    setViewMode,
    setShowReport,
  } = useScheduleStore();

  const [isExpanded, setIsExpanded] = useState(true);

  const selectedBus = buses.find(b => b.id === selectedBusId);
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  const criticalConflicts = unresolvedConflicts.filter(c => c.severity === 'critical');
  const warningConflicts = unresolvedConflicts.filter(c => c.severity === 'warning');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      parked: '待命',
      boarding: '上车中',
      departing: '发车中',
      departed: '已发车',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      parked: 'text-gray-400',
      boarding: 'text-blue-400',
      departing: 'text-orange-400',
      departed: 'text-green-400',
    };
    return colors[status] || 'text-gray-400';
  };

  const departedCount = buses.filter(b => b.status === 'departed').length;
  const boardingCount = buses.filter(b => b.status === 'boarding' || b.status === 'departing').length;
  const parkedCount = buses.filter(b => b.status === 'parked').length;
  const totalStudents = buses.reduce((sum, b) => sum + b.currentStudents, 0);
  const totalCapacity = buses.reduce((sum, b) => sum + b.capacity, 0);

  const cameraViews = [
    { id: 'default', label: '默认', icon: Eye },
    { id: 'top', label: '俯视', icon: Eye },
    { id: 'front', label: '前视', icon: Eye },
    { id: 'side', label: '侧视', icon: Eye },
  ];

  return (
    <div className={`h-full bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 flex flex-col transition-all duration-300 ${isExpanded ? 'w-72' : 'w-12'}`}>
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-90'}`} />
        </button>
        {isExpanded && (
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">信息面板</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          <div className="p-3 border-b border-gray-700">
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              实时统计
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-2xl font-bold text-green-400">{departedCount}</div>
                <div className="text-xs text-gray-400">已发车</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-2xl font-bold text-blue-400">{boardingCount}</div>
                <div className="text-xs text-gray-400">进行中</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-2xl font-bold text-gray-400">{parkedCount}</div>
                <div className="text-xs text-gray-400">待命中</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {totalStudents}/{totalCapacity}
                </div>
                <div className="text-xs text-gray-400">学生总数</div>
              </div>
            </div>
          </div>

          <div className="p-3 border-b border-gray-700">
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              视角切换
            </div>
            <div className="grid grid-cols-2 gap-1 mb-2">
              <button
                onClick={() => setViewMode('3d')}
                className={`p-2 rounded text-xs transition-colors ${
                  viewMode === '3d'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                3D 模式
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`p-2 rounded text-xs transition-colors ${
                  viewMode === '2d'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                2D 俯视
              </button>
            </div>
            {viewMode === '3d' && (
              <div className="grid grid-cols-4 gap-1">
                {cameraViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => setCameraView(view.id as any)}
                    className={`p-2 rounded text-xs transition-colors ${
                      cameraView === view.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              冲突警告 ({unresolvedConflicts.length})
            </div>

            {unresolvedConflicts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <EyeOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                暂无冲突
              </div>
            ) : (
              <div className="space-y-2">
                {criticalConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="bg-red-900/30 border border-red-500/50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-medium text-red-400">
                        严重 - {ConflictDetector.getInstance().getConflictTypeLabel(conflict.type)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 mb-2">
                      {conflict.description}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        时间: {formatTime(conflict.time)}
                      </span>
                      <span className="text-xs text-red-400">
                        涉及: {conflict.involvedBuses.map(id => 
                          buses.find(b => b.id === id)?.number
                        ).join(', ')}
                      </span>
                    </div>
                  </div>
                ))}

                {warningConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-medium text-yellow-400">
                        警告 - {ConflictDetector.getInstance().getConflictTypeLabel(conflict.type)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 mb-2">
                      {conflict.description}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        时间: {formatTime(conflict.time)}
                      </span>
                      <span className="text-xs text-yellow-400">
                        涉及: {conflict.involvedBuses.map(id => 
                          buses.find(b => b.id === id)?.number
                        ).join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedBus && (
            <div className="p-3 border-t border-gray-700 bg-gray-800/50">
              <div className="text-xs text-gray-400 mb-2">选中车辆</div>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: selectedBus.color }}
                >
                  {selectedBus.number.split('-')[1]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{selectedBus.number}</div>
                  <div className="text-xs text-gray-400">{selectedBus.route}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">状态: </span>
                  <span className={getStatusColor(selectedBus.status)}>
                    {getStatusLabel(selectedBus.status)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">发车时间: </span>
                  <span className="text-white">{formatTime(selectedBus.departureTime)}</span>
                </div>
                <div>
                  <span className="text-gray-500">当前人数: </span>
                  <span className="text-white">{selectedBus.currentStudents}</span>
                </div>
                <div>
                  <span className="text-gray-500">载客率: </span>
                  <span className="text-white">
                    {Math.round((selectedBus.currentStudents / selectedBus.capacity) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => setShowReport(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              生成调度报告
            </button>
          </div>
        </>
      )}
    </div>
  );
}
