import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getHistory } from '../store/useGameStore';
import { HistoryRecord } from '../types';
import { Home, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export const ReplayScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      const history = getHistory();
      if (id === 'latest') {
        setRecord(history[0] || null);
      } else {
        setRecord(history.find((r) => r.id === id) || null);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isPlaying || !record) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= record.actionHistory.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, record]);

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">找不到回放记录</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const currentAction = record.actionHistory[currentStep];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🎬 历史回放</h1>
            <p className="text-slate-400 text-sm">
              {record.levelName} - 得分: {record.score}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            <Home size={16} /> 返回
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-medium">
                步骤 {currentStep + 1} / {record.actionHistory.length}
              </span>
              <span className="text-slate-400 text-sm">
                回合 {currentAction?.turn || 1}
              </span>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs uppercase">
                  {currentAction?.type}
                </span>
              </div>
              <p className="text-white">
                {currentAction?.type === 'load' && 
                  `装载物资: ${currentAction.payload.type} x ${currentAction.payload.amount}`}
                {currentAction?.type === 'unload' && '卸载所有物资'}
                {currentAction?.type === 'route' && 
                  `派遣车辆: ${currentAction.payload.route.length} 个目的地`}
                {currentAction?.type === 'start' && `回合 ${currentAction.payload.turn} 开始`}
                {currentAction?.type === 'event' && `发生事件`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setCurrentStep(0)}
                disabled={currentStep === 0}
                className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-white"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full text-white"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <button
                onClick={() => setCurrentStep(record.actionHistory.length - 1)}
                disabled={currentStep === record.actionHistory.length - 1}
                className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-white"
              >
                <SkipForward size={20} />
              </button>
            </div>

            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={record.actionHistory.length - 1}
                value={currentStep}
                onChange={(e) => setCurrentStep(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">操作记录</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {record.actionHistory.map((action, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    index === currentStep
                      ? 'bg-blue-600/30 border border-blue-500'
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  }`}
                  onClick={() => setCurrentStep(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">
                        #{index + 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        action.type === 'load' ? 'bg-green-500/20 text-green-400' :
                        action.type === 'unload' ? 'bg-yellow-500/20 text-yellow-400' :
                        action.type === 'route' ? 'bg-blue-500/20 text-blue-400' :
                        action.type === 'event' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {action.type}
                      </span>
                    </div>
                    <span className="text-slate-400 text-xs">
                      回合 {action.turn}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
