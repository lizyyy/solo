import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { Play, Pause, SkipForward, Home } from 'lucide-react';

export default function Replay() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const state = useGameStore();
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (levelId) {
      const savedHistory = localStorage.getItem(`exhibition-history-${levelId}`);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    }
  }, [levelId]);

  useEffect(() => {
    if (!isPlaying || replayIndex >= history.length - 1) return;

    const timer = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= history.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, replayIndex, history.length]);

  const currentRecord = history[replayIndex];

  const handleGoToMenu = () => {
    state.goToMenu();
    navigate('/');
  };

  if (history.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">暂无历史记录</h2>
          <p className="text-slate-400 mb-6">请先完成一个关卡以生成回放记录</p>
          <button
            onClick={handleGoToMenu}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 mx-auto"
          >
            <Home size={20} />
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">历史回放</span>
          <span className="text-white font-mono">
            回合 {replayIndex} / {history.length - 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            上一帧
          </button>
          <button
            onClick={() => setReplayIndex(Math.min(history.length - 1, replayIndex + 1))}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            <SkipForward size={16} />
          </button>
          <button
            onClick={handleGoToMenu}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            <Home size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {currentRecord && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">回合 {currentRecord.turn} 操作</h3>
              <div className="space-y-1">
                {currentRecord.actions?.map((action: any, i: number) => (
                  <div key={i} className="text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
                    {action.type === 'assign_task' && `分配任务: ${action.taskType}`}
                    {action.type === 'request_inspection' && `申请验收: ${action.taskType}`}
                    {action.type === 'emergency_material' && `紧急补货: ${action.taskType}`}
                    {action.type === 'end_turn' && '结束回合'}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-400 mb-2">展位状态</h4>
                <div className="space-y-2">
                  {currentRecord.stateSnapshot?.booths?.map((booth: any) => (
                    <div key={booth.id} className="text-xs">
                      <span className="text-white">{booth.name}</span>
                      <span className="text-slate-500 ml-2">
                        水:{Math.round(booth.utilitiesProgress)}% 架:{Math.round(booth.structureProgress)}% 消:{Math.round(booth.fireSafetyProgress)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-400 mb-2">验收状态</h4>
                <div className="space-y-2">
                  {currentRecord.stateSnapshot?.inspections?.map((inspection: any) => (
                    <div key={inspection.type} className="text-xs">
                      <span className="text-white">
                        {inspection.type === 'utilities' ? '水电' : inspection.type === 'structure' ? '展架' : '消防'}
                      </span>
                      <span className={`ml-2 ${inspection.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {inspection.passed ? '✓ 通过' : inspection.unlocked ? '可申请' : '锁定'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800 border-t border-slate-700 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-16">时间线</span>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={replayIndex}
            onChange={(e) => setReplayIndex(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-700 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
