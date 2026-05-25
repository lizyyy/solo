import { motion } from 'framer-motion';
import { MapPin, SlidersHorizontal, Play, RotateCcw, Upload, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PointSelector } from './PointSelector';
import { FilterPanel } from './FilterPanel';
import { Timeline } from './Timeline';

export const ControlPanel = () => {
  const {
    campusData,
    selectedStartPoint,
    selectedEndPoint,
    currentRoute,
    setIsPlaying,
    resetState,
    loadSampleData,
    setTimelinePosition,
  } = useAppStore();

  const handleReset = () => {
    setTimelinePosition(0);
    setIsPlaying(false);
    resetState();
  };

  const handleReplay = () => {
    setTimelinePosition(0);
    setIsPlaying(true);
  };

  return (
    <motion.div
      initial={{ x: -320 }}
      animate={{ x: 0 }}
      className="absolute left-4 top-4 bottom-4 w-80 bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col overflow-hidden z-10"
    >
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-xl">♿</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">无障碍路线规划</h1>
            <p className="text-xs text-gray-400">校园出行助手</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!campusData ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-sm mb-4">暂无场景数据</p>
            <button
              onClick={loadSampleData}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/25"
            >
              导入样例场景
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>选择起点和终点</span>
              </div>
              <PointSelector />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                <span>筛选条件</span>
              </div>
              <FilterPanel />
            </div>

            {currentRoute && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Play className="w-4 h-4 text-green-400" />
                  <span>路线预览</span>
                </div>
                <Timeline />
              </div>
            )}

            {selectedStartPoint && selectedEndPoint && !currentRoute && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-blue-300">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>正在规划路线...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-gray-700/50 space-y-2">
        {currentRoute && (
          <button
            onClick={handleReplay}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            重新播放路线
          </button>
        )}

        <button
          onClick={handleReset}
          className="w-full py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          重置状态
        </button>
      </div>
    </motion.div>
  );
};
