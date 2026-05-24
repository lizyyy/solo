import { useState } from 'react';
import { Info, ChevronLeft, ChevronRight, User, AlertTriangle } from 'lucide-react';
import { useAppStore, useFilteredSeats } from '@/store/appStore';

export function RightPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const seats = useFilteredSeats();
  const { eyeHeight, setEyeHeight, selectedSeatId } = useAppStore();

  const blockedSeats = seats.filter((s) => s.isBlocked);
  const selectedSeat = seats.find((s) => s.id === selectedSeatId);
  const blockRate = seats.length > 0 ? ((blockedSeats.length / seats.length) * 100).toFixed(1) : '0';

  if (isCollapsed) {
    return (
      <div className="absolute right-0 top-14 bottom-20 w-10 bg-slate-900/95 backdrop-blur-sm border-l border-slate-700 flex items-center justify-center z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <Info size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-14 bottom-20 w-64 bg-slate-900/95 backdrop-blur-sm border-l border-slate-700 flex flex-col z-10">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">信息面板</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <h4 className="text-white text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            遮挡统计
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">总座位数</span>
              <span className="text-white">{seats.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">遮挡座位</span>
              <span className="text-red-400 font-medium">{blockedSeats.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">遮挡率</span>
              <span className={`font-medium ${parseFloat(blockRate) > 20 ? 'text-red-400' : parseFloat(blockRate) > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {blockRate}%
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                parseFloat(blockRate) > 20 ? 'bg-red-500' : parseFloat(blockRate) > 10 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(parseFloat(blockRate), 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <h4 className="text-white text-sm font-medium flex items-center gap-2">
            <User size={16} className="text-blue-400" />
            视线设置
          </h4>
          <div className="space-y-2">
            <label className="text-slate-400 text-xs">眼睛高度 (米)</label>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              value={eyeHeight}
              onChange={(e) => setEyeHeight(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>0.8m</span>
              <span className="text-white font-medium">{eyeHeight.toFixed(2)}m</span>
              <span>1.5m</span>
            </div>
          </div>
        </div>

        {selectedSeat && (
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-white text-sm font-medium">选中座位</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">座位号</span>
                <span className="text-white">{selectedSeat.row + 1}排{selectedSeat.col + 1}座</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">状态</span>
                <span className={selectedSeat.isBlocked ? 'text-red-400' : 'text-emerald-400'}>
                  {selectedSeat.isBlocked ? '视线遮挡' : '视线通畅'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">位置</span>
                <span className="text-white text-xs">
                  ({selectedSeat.position.x.toFixed(1)}, {selectedSeat.position.z.toFixed(1)})
                </span>
              </div>
              {selectedSeat.isBlocked && selectedSeat.blockingObstacleId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">遮挡物</span>
                  <span className="text-red-400">{selectedSeat.blockingObstacleId}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {blockedSeats.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-white text-sm font-medium">遮挡座位列表</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {blockedSeats.map((seat) => (
                <div
                  key={seat.id}
                  className="flex justify-between items-center px-2 py-1 bg-slate-700/50 rounded text-xs"
                >
                  <span className="text-slate-300">
                    {seat.row + 1}排{seat.col + 1}座
                  </span>
                  <span className="text-red-400">遮挡</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500">
          <p>提示: 点击"拖拽座位"按钮可移动座位</p>
          <p className="mt-1">鼠标滚轮缩放，左键旋转，右键平移</p>
        </div>
      </div>
    </div>
  );
}
