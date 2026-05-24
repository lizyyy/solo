import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react';
import { ReplayData, Train, Signal, Section, TRAIN_STATUSES, Point } from '../types/game';
import { levels } from '../data/levels';

interface ReplayPageProps {
  onBack: () => void;
}

export default function ReplayPage({ onBack }: ReplayPageProps) {
  const [replays, setReplays] = useState<ReplayData[]>([]);
  const [selectedReplay, setSelectedReplay] = useState<ReplayData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const saved = localStorage.getItem('railway_replays');
    if (saved) {
      setReplays(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || !selectedReplay) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex(prev => {
        if (prev >= selectedReplay.frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 33);

    return () => clearInterval(interval);
  }, [isPlaying, selectedReplay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedReplay) return;

    const level = levels.find(l => l.id === selectedReplay.levelId);
    if (!level) return;

    const frame = selectedReplay.frames[currentFrameIndex];
    if (!frame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 900;
    const height = 450;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (const section of level.sections) {
      const inMaintenance = section.maintenance.some(
        w => frame.time >= w.start && frame.time <= w.end
      );

      ctx.strokeStyle = inMaintenance ? '#ef4444' : '#475569';
      ctx.lineWidth = inMaintenance ? 12 : 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(section.fromPos.x, section.fromPos.y);
      ctx.lineTo(section.toPos.x, section.toPos.y);
      ctx.stroke();

      ctx.strokeStyle = inMaintenance ? '#fca5a5' : '#64748b';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(section.fromPos.x, section.fromPos.y);
      ctx.lineTo(section.toPos.x, section.toPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const station of level.stations) {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(station.position.x, station.position.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 14px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(station.id, station.position.x, station.position.y);
    }

    for (const signal of frame.signals) {
      const signalColor = signal.aspect === 'red' ? '#dc2626' :
                         signal.aspect === 'yellow' ? '#eab308' : '#16a34a';

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(signal.position.x, signal.position.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = signalColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = signalColor;
      ctx.beginPath();
      ctx.arc(signal.position.x, signal.position.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const train of frame.trains) {
      if (train.status === TRAIN_STATUSES.COMPLETED) continue;

      const pos = getTrainPosition(train, level.sections);
      if (!pos) {
        if (train.status === TRAIN_STATUSES.WAITING) {
          const firstSectionId = train.route[0];
          const firstSection = level.sections.find(s => s.id === firstSectionId);
          if (firstSection) {
            const startPos = firstSection.fromPos;
            
            ctx.fillStyle = train.color + '60';
            ctx.strokeStyle = train.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(startPos.x, startPos.y, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 10px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(train.name, startPos.x, startPos.y);
          }
        }
        continue;
      }

      ctx.save();
      ctx.translate(pos.x, pos.y);

      ctx.fillStyle = train.color;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-20, -8, 40, 16, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(15, -6, 6, 12);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(train.name, 0, 0);

      ctx.restore();

      if (train.delay > 0) {
        ctx.fillStyle = train.delay > 100 ? '#ef4444' : '#f59e0b';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`+${Math.floor(train.delay)}`, pos.x, pos.y - 20);
      }
    }

  }, [selectedReplay, currentFrameIndex]);

  const getTrainPosition = (train: Train, sections: Section[]): Point | null => {
    if (train.currentSectionIndex < 0 || train.currentSectionIndex >= train.route.length) {
      return null;
    }

    const sectionId = train.route[train.currentSectionIndex];
    const section = sections.find(s => s.id === sectionId);
    if (!section) return null;

    const x = section.fromPos.x + (section.toPos.x - section.fromPos.x) * train.progress;
    const y = section.fromPos.y + (section.toPos.y - section.fromPos.y) * train.progress;

    return { x, y };
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentFrameIndex(parseInt(e.target.value));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  if (replays.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回菜单
          </button>
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📼</div>
            <h2 className="text-2xl font-bold text-white mb-2">暂无回放记录</h2>
            <p className="text-slate-400">完成游戏后可保存对局回放</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedReplay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回菜单
          </button>
          <h1 className="text-3xl font-bold text-white mb-8">历史回放</h1>
          <div className="space-y-4">
            {replays.map((replay, index) => {
              const level = levels.find(l => l.id === replay.levelId);
              return (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedReplay(replay);
                    setCurrentFrameIndex(0);
                  }}
                  className="w-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 text-left transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-white">{level?.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          replay.result === 'won' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {replay.result === 'won' ? '胜利' : '失败'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        得分: <span className="text-emerald-400 font-mono">{replay.finalScore}</span>
                        {' · '}
                        帧数: {replay.frames.length}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-500">{formatDate(replay.timestamp)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const level = levels.find(l => l.id === selectedReplay.levelId);
  const currentFrame = selectedReplay.frames[currentFrameIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setSelectedReplay(null);
              setIsPlaying(false);
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回列表
          </button>
          <div className="text-slate-400">
            {level?.name} · {selectedReplay.result === 'won' ? '胜利' : '失败'}
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6">
          <canvas
            ref={canvasRef}
            width={900}
            height={450}
            className="rounded-lg mx-auto block"
            style={{ maxWidth: '100%', height: 'auto' }}
          />

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleReset}
              className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={selectedReplay.frames.length - 1}
              value={currentFrameIndex}
              onChange={handleSliderChange}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-sm font-mono text-slate-400 w-32 text-right">
              {Math.floor(currentFrame?.time || 0)} / {level?.timeLimit}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">当前分数</div>
              <div className="text-xl font-bold text-emerald-400">{currentFrame?.score || 0}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">最终分数</div>
              <div className="text-xl font-bold text-blue-400">{selectedReplay.finalScore}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">结果</div>
              <div className={`text-xl font-bold ${selectedReplay.result === 'won' ? 'text-emerald-400' : 'text-red-400'}`}>
                {selectedReplay.result === 'won' ? '胜利' : '失败'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
