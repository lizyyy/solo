import React from 'react';
import { Building2, Layers, Eye, Play, Pause, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { CameraViewType, FilterStatusType } from '@/types';

interface LeftPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onToggle }) => {
  const {
    floors,
    selectedFloorId,
    setSelectedFloor,
    filterStatus,
    setFilterStatus,
    cameraView,
    setCameraView,
    timeline,
    setTimelineTime,
    toggleTimelinePlay,
  } = useAppStore();

  const statusOptions: { value: FilterStatusType; label: string; color: string }[] = [
    { value: 'normal', label: '正常', color: 'bg-green-500' },
    { value: 'maintenance', label: '检修中', color: 'bg-yellow-500' },
    { value: 'fault', label: '故障', color: 'bg-red-500' },
    { value: 'expired', label: '检修过期', color: 'bg-orange-500' },
  ];

  const viewOptions: { value: CameraViewType; label: string }[] = [
    { value: 'perspective', label: '透视' },
    { value: 'top', label: '俯视' },
    { value: 'front', label: '正视' },
    { value: 'side', label: '侧视' },
  ];

  const toggleFilter = (status: FilterStatusType) => {
    if (filterStatus.includes(status)) {
      setFilterStatus(filterStatus.filter((s) => s !== status));
    } else {
      setFilterStatus([...filterStatus, status]);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div
      className={`absolute left-0 top-0 h-full bg-white shadow-lg z-10 transition-all duration-300 flex ${
        isOpen ? 'w-60' : 'w-0'
      }`}
    >
      <div className={`flex-1 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Layers size={20} className="text-blue-600" />
            控制面板
          </h2>
        </div>

        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <Building2 size={16} />
            楼层选择
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedFloor(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                selectedFloorId === null
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部楼层
            </button>
            {floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => setSelectedFloor(floor.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedFloorId === floor.id
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">状态筛选</h3>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filterStatus.includes(option.value)}
                  onChange={() => toggleFilter(option.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className={`w-3 h-3 rounded-full ${option.color}`} />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <Eye size={16} />
            视角切换
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setCameraView(option.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  cameraView === option.value
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <RotateCcw size={16} />
            时间轴
          </h3>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-center text-sm font-medium text-gray-800 mb-3">
              {formatDate(timeline.currentTime)}
            </div>
            <input
              type="range"
              min={0}
              max={365}
              value={Math.floor(
                (timeline.currentTime.getTime() - new Date('2026-01-01').getTime()) /
                  (1000 * 60 * 60 * 24)
              )}
              onChange={(e) => {
                const days = parseInt(e.target.value);
                const newDate = new Date('2026-01-01');
                newDate.setDate(newDate.getDate() + days);
                setTimelineTime(newDate);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-center mt-3">
              <button
                onClick={toggleTimelinePlay}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                {timeline.isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {timeline.isPlaying ? '暂停' : '播放'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full bg-white shadow-lg rounded-r-lg p-2 hover:bg-gray-50 transition-colors z-20"
      >
        <Layers size={20} className={`text-gray-600 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
};

export default LeftPanel;
