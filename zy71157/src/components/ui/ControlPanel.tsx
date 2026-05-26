import { Play, Pause, RotateCcw, Home, FastForward, SkipBack } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';

interface ControlPanelProps {
  onShowHelp?: () => void;
}

export const ControlPanel = ({ onShowHelp }: ControlPanelProps) => {
  const navigate = useNavigate();
  const status = useGameStore(state => state.status);
  const startGame = useGameStore(state => state.startGame);
  const pauseGame = useGameStore(state => state.pauseGame);
  const resumeGame = useGameStore(state => state.resumeGame);
  const restartGame = useGameStore(state => state.restartGame);
  const replayMode = useGameStore(state => state.replayMode);
  const replaySpeed = useGameStore(state => state.replaySpeed);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isFinished = status === 'finished' || status === 'failed';

  const handlePlayPause = () => {
    if (isIdle || isFinished) {
      startGame();
    } else if (isPlaying) {
      pauseGame();
    } else if (isPaused) {
      resumeGame();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
      <div className="flex justify-center items-center gap-4">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-3 border border-gray-700 shadow-xl flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white"
            title="返回主菜单"
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={replayMode}
            className={`p-4 rounded-xl transition-all duration-200 font-bold text-white shadow-lg ${
              isPlaying
                ? 'bg-yellow-600 hover:bg-yellow-500'
                : isPaused
                ? 'bg-green-600 hover:bg-green-500'
                : 'bg-blue-600 hover:bg-blue-500'
            } ${replayMode ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
            title={isPlaying ? '暂停' : isPaused ? '继续' : '开始'}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={restartGame}
            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white hover:scale-105 active:scale-95"
            title="重新开始"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {replayMode && (
            <>
              <div className="h-8 w-px bg-gray-600 mx-2" />
              <button
                onClick={() => useGameStore.setState({ replaySpeed: replaySpeed === 1 ? 2 : replaySpeed === 2 ? 4 : 1 })}
                className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white flex items-center gap-1"
                title="倍速"
              >
                <FastForward className="w-5 h-5" />
                <span className="text-sm font-mono">{replaySpeed}x</span>
              </button>
              <button
                onClick={() => useGameStore.setState({ replayTime: 0 })}
                className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white"
                title="回到开始"
              >
                <SkipBack className="w-5 h-5" />
              </button>
            </>
          )}

          {onShowHelp && (
            <>
              <div className="h-8 w-px bg-gray-600 mx-2" />
              <button
                onClick={onShowHelp}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white text-sm font-medium"
              >
                操作说明
              </button>
            </>
          )}
        </div>

        {status === 'paused' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700 text-center">
              <Pause className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">游戏暂停</h2>
              <p className="text-gray-400 mb-6">点击继续按钮恢复游戏</p>
              <button
                onClick={resumeGame}
                className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all duration-200 hover:scale-105"
              >
                继续游戏
              </button>
            </div>
          </div>
        )}

        {isIdle && !replayMode && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700 text-center max-w-md">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">准备开始</h2>
              <p className="text-gray-400 mb-6">
                点击黄色切换器改变传送带方向，将行李送到正确的航班口。
                注意转机时间和超规行李！
              </p>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg shadow-blue-600/30"
              >
                开始分拣
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
