import { useGameStore } from '../game/state';
import { pauseGame, resumeGame, restartGame, returnToMenu, markMaintenance, resolveMaintenance } from '../game/engine';
import { Play, Pause, RotateCcw, Home, Wrench, CheckCircle } from 'lucide-react';

export function ControlPanel() {
  const status = useGameStore((state) => state.status);
  const rooms = useGameStore((state) => state.rooms);
  const selectedRoomId = useGameStore((state) => state.selectedRoomId);
  const setSelectedRoom = useGameStore((state) => state.setSelectedRoom);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const handlePauseResume = () => {
    if (status === 'playing') {
      pauseGame();
    } else if (status === 'paused') {
      resumeGame();
    }
  };

  const handleRestart = () => {
    if (confirm('确定要重新开始吗？当前进度将丢失。')) {
      restartGame();
    }
  };

  const handleReturnToMenu = () => {
    if (status === 'playing' || status === 'paused') {
      if (!confirm('确定要返回菜单吗？当前进度将丢失。')) {
        return;
      }
    }
    returnToMenu();
  };

  const handleMarkMaintenance = () => {
    if (selectedRoomId !== null && selectedRoom && selectedRoom.status !== 'occupied') {
      markMaintenance(selectedRoomId);
      setSelectedRoom(null);
    }
  };

  const handleResolveMaintenance = () => {
    if (selectedRoomId !== null) {
      resolveMaintenance(selectedRoomId);
      setSelectedRoom(null);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🎮</span> 游戏控制
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handlePauseResume}
          disabled={status !== 'playing' && status !== 'paused'}
          className={`
            flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium
            transition-all duration-200
            ${status === 'playing'
              ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
              : status === 'paused'
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {status === 'playing' ? (
            <>
              <Pause className="w-4 h-4" /> 暂停
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> 继续
            </>
          )}
        </button>

        <button
          onClick={handleRestart}
          disabled={status === 'menu'}
          className={`
            flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium
            transition-all duration-200
            ${status === 'menu'
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
            }
          `}
        >
          <RotateCcw className="w-4 h-4" /> 重开
        </button>

        <button
          onClick={handleReturnToMenu}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium bg-gray-600 hover:bg-gray-500 text-white transition-all duration-200 col-span-2"
        >
          <Home className="w-4 h-4" /> 返回菜单
        </button>
      </div>

      <div className="mt-4 p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
        <div className="text-xs text-orange-400 mb-2 font-medium">🔧 房间维修管理</div>
        {selectedRoom ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-300">
              已选中房间: <span className="font-bold text-white">{selectedRoom.number}</span>
              <span className="ml-2 text-gray-400">({selectedRoom.status === 'empty' ? '空房' : selectedRoom.status === 'dirty' ? '脏房' : selectedRoom.status === 'maintenance' ? '维修中' : '已入住'})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleMarkMaintenance}
                disabled={status !== 'playing' || selectedRoom.status === 'occupied' || selectedRoom.status === 'maintenance'}
                className={`
                  flex items-center justify-center gap-1 py-2 px-3 rounded text-xs font-medium transition-colors
                  ${status === 'playing' && selectedRoom.status !== 'occupied' && selectedRoom.status !== 'maintenance'
                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                `}
              >
                <Wrench className="w-3 h-3" /> 标记维修
              </button>
              <button
                onClick={handleResolveMaintenance}
                disabled={status !== 'playing' || selectedRoom.status !== 'maintenance'}
                className={`
                  flex items-center justify-center gap-1 py-2 px-3 rounded text-xs font-medium transition-colors
                  ${status === 'playing' && selectedRoom.status === 'maintenance'
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                `}
              >
                <CheckCircle className="w-3 h-3" /> 完成维修
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400">点击房间选中后可进行维修操作</div>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-700/30 rounded-lg">
        <div className="text-xs text-gray-400 mb-2">操作提示</div>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• 点击等待的客人选中</li>
          <li>• 点击空房为选中的客人分配房间</li>
          <li>• 点击脏房自动派遣保洁</li>
          <li>• 及时处理续住申请避免客诉</li>
          <li>• 选中房间后可标记/解除维修状态</li>
        </ul>
      </div>
    </div>
  );
}
