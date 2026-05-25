import { Play, Pause, RotateCcw, ChevronRight, Layers } from 'lucide-react';
import { useGame } from '../hooks/useGameState';
import { LEVELS, getLevelById } from '../game/levels';

export function ControlPanel() {
  const { state, dispatch } = useGame();
  const level = getLevelById(state.level);

  const handleNextRound = () => {
    dispatch({ type: 'NEXT_ROUND' });
  };

  const handlePause = () => {
    if (state.status === 'playing') {
      dispatch({ type: 'PAUSE' });
    } else if (state.status === 'paused') {
      dispatch({ type: 'RESUME' });
    }
  };

  const handleRestart = () => {
    dispatch({ type: 'RESTART' });
  };

  const handleLevelChange = (levelId: number) => {
    dispatch({ type: 'LOAD_LEVEL', payload: { levelId } });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 space-y-4">
      <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2">
        <Layers className="w-5 h-5" />
        控制面板
      </h3>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-600">选择关卡</label>
        <select
          value={state.level}
          onChange={(e) => handleLevelChange(Number(e.target.value))}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          disabled={state.status === 'playing' && state.round > 1}
        >
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">{level?.description}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-gray-600">回合: </span>
          <span className="font-bold text-amber-700">
            {state.round} / {state.maxRounds}
          </span>
        </div>
        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${(state.round / state.maxRounds) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handlePause}
          disabled={state.status !== 'playing' && state.status !== 'paused'}
          className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all ${
            state.status === 'playing'
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : state.status === 'paused'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {state.status === 'playing' ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          <span className="text-xs mt-1">
            {state.status === 'playing' ? '暂停' : '继续'}
          </span>
        </button>

        <button
          onClick={handleNextRound}
          disabled={state.status !== 'playing'}
          className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all ${
            state.status === 'playing'
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
          <span className="text-xs mt-1">下一回合</span>
        </button>

        <button
          onClick={handleRestart}
          className="flex flex-col items-center justify-center p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="text-xs mt-1">重新开始</span>
        </button>
      </div>

      {state.status === 'paused' && (
        <div className="p-3 bg-yellow-100 rounded-lg text-center">
          <p className="text-yellow-800 font-medium">游戏已暂停</p>
          <p className="text-yellow-600 text-sm">点击继续按钮恢复游戏</p>
        </div>
      )}

      {state.status === 'replaying' && (
        <div className="p-3 bg-blue-100 rounded-lg text-center">
          <p className="text-blue-800 font-medium">历史回放模式</p>
          <p className="text-blue-600 text-sm">使用回放控制面板查看历史</p>
        </div>
      )}
    </div>
  );
}
