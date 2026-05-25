import React from 'react';
import { Building2, Layers, Eye, Play, Pause, RotateCcw, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { CameraViewType, FilterStatusType } from '@/types';
import { useScreenSize } from '@/hooks/useScreenSize';

interface LeftPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onToggle }) => {
  const { isMobile, isTablet } = useScreenSize();
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

  const panelWidth = isMobile ? 'w-full' : isTablet ? 'w-56' : 'w-60';
  const maxHeight = isMobile ? 'max-h-[70vh]' : '';

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onToggle}
        />
      )}

      <div
        className={`absolute left-0 top-0 h-full bg-white shadow-lg z-50 transition-all duration-300 flex flex-col ${
          isMobile ? 'fixed' : ''
        } ${panelWidth} ${maxHeight} ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {isMobile && (
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Layers size={18} className="text-blue-600" />
              控制面板
            </h2>
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {!isMobile && (
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Layers size={20} className="text-blue-600" />
                控制面板
              </h2>
            </div>
          )}

          <div className={`p-${isMobile ? '3' : '4'} border-b border-gray-100`}>
            <h3 className={`text-${isMobile ? 'xs' : 'sm'} font-semibold text-gray-600 mb-2 flex items-center gap-2`}>
              <Building2 size={isMobile ? 14 : 16} />
              楼层选择
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setSelectedFloor(null);
                  if (isMobile) onToggle();
                }}
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
                  onClick={() => {
                    setSelectedFloor(floor.id);
                    if (isMobile) onToggle();
                  }}
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

          <div className={`p-${isMobile ? '3' : '4'} border-b border-gray-100`}>
            <h3 className={`text-${isMobile ? 'xs' : 'sm'} font-semibold text-gray-600 mb-2`}>
              状态筛选
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filterStatus.includes(option.value)}
                    onChange={() => toggleFilter(option.value)}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                  <span className="text-xs text-gray-700 truncate">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={`p-${isMobile ? '3' : '4'} border-b border-gray-100`}>
            <h3 className={`text-${isMobile ? 'xs' : 'sm'} font-semibold text-gray-600 mb-2 flex items-center gap-2`}>
              <Eye size={isMobile ? 14 : 16} />
              视角切换
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCameraView(option.value)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

          <div className={`p-${isMobile ? '3' : '4'}`}>
            <h3 className={`text-${isMobile ? 'xs' : 'sm'} font-semibold text-gray-600 mb-2 flex items-center gap-2`}>
              <RotateCcw size={isMobile ? 14 : 16} />
              时间轴
            </h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-center text-xs font-medium text-gray-800 mb-2">
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
              <div className="flex justify-center mt-2">
                <button
                  onClick={toggleTimelinePlay}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                >
                  {timeline.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {timeline.isPlaying ? '暂停' : '播放'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isMobile && (
        <button
          onClick={onToggle}
          className={`absolute top-1/2 -translate-y-1/2 bg-white shadow-lg p-2 hover:bg-gray-50 transition-colors z-40 ${
            isOpen
              ? 'left-[240px] rounded-r-lg'
              : 'left-0 rounded-r-lg'
          } ${isTablet ? 'left-[224px]' : ''}`}
          style={{ left: isOpen ? (isTablet ? '224px' : '240px') : '0' }}
        >
          <Layers size={20} className={`text-gray-600 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        </button>
      )}
    </>
  );
};

export default LeftPanel;
