import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Home, RotateCcw, Download, Clock } from 'lucide-react';
import { RoomScene } from '../components/game3d/RoomScene';
import { getReplayById } from '../engine/replay';
import type { ReplayRecord, TurnSnapshot } from '../engine/types';
import { formatHour } from '../utils/temperature';
import { generateCSVReport, downloadCSV } from '../utils/export';
import { useUISTore } from '../store/useUISTore';

export default function ReplayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [replay, setReplay] = useState<ReplayRecord | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

  const { showHeatmap, showLabels, toggleHeatmap, toggleLabels, cameraView, setCameraView } = useUISTore();

  useEffect(() => {
    if (gameId) {
      const data = getReplayById(gameId);
      if (data) {
        setReplay(data);
        setCurrentTurn(0);
      }
    }
  }, [gameId]);

  useEffect(() => {
    if (!isPlaying || !replay) return;

    const interval = setInterval(() => {
      setCurrentTurn((prev) => {
        if (prev >= replay.snapshots.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, replay]);

  const currentSnapshot: TurnSnapshot | null = useMemo(() => {
    if (!replay || replay.snapshots.length === 0) return null;
    return replay.snapshots[Math.min(currentTurn, replay.snapshots.length - 1)];
  }, [replay, currentTurn]);

  const handleExport = () => {
    if (!replay) return;
    const gameStateForExport = {
      ...replay,
      racks: replay.snapshots[replay.snapshots.length - 1].racks,
      turnState: replay.snapshots[replay.snapshots.length - 1].turnState,
    };
    const csv = generateCSVReport(gameStateForExport as any);
    downloadCSV(csv, `回放_${replay.levelId}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSkipToStart = () => {
    setCurrentTurn(0);
    setIsPlaying(false);
  };

  const handleSkipToEnd = () => {
    if (replay) {
      setCurrentTurn(replay.snapshots.length - 1);
      setIsPlaying(false);
    }
  };

  if (!replay || !currentSnapshot) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="text-xl mb-4">未找到回放记录</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  const { racks, acUnits, turnState } = currentSnapshot;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <RoomScene
          racks={racks}
          acUnits={acUnits}
          showHeatmap={showHeatmap}
          showLabels={showLabels}
          interactive={false}
        />
      </div>

      <div className="absolute top-4 left-4 z-20">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700/50">
          <div className="text-cyan-400 font-bold">{replay.levelName}</div>
          <div className="text-xs text-slate-400">回放模式</div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700/50 text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400">回合: </span>
              <span className="text-slate-100 font-mono">{currentTurn + 1} / {replay.snapshots.length}</span>
            </div>
            <div>
              <span className="text-slate-400">时间: </span>
              <span className="text-slate-100 font-mono">{formatHour(turnState.hour)}</span>
            </div>
            <div>
              <span className="text-slate-400">得分: </span>
              <span className="text-cyan-400 font-mono">{turnState.score}</span>
            </div>
            <div>
              <span className="text-slate-400">电费: </span>
              <span className="text-green-400 font-mono">¥{turnState.totalCost.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleSkipToStart}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
            title="跳到开始"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-cyan-500 hover:bg-cyan-400 rounded-full text-slate-900 transition-colors"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <button
            onClick={handleSkipToEnd}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
            title="跳到结束"
          >
            <SkipForward size={20} />
          </button>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-slate-400 text-sm">速度:</span>
            {[1, 2, 4, 8].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  playSpeed === speed
                    ? 'bg-cyan-500 text-slate-900'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={toggleHeatmap}
              className={`p-2 rounded-lg transition-colors ${
                showHeatmap ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'
              }`}
              title="热力图"
            >
              <Clock size={18} />
            </button>
            <button
              onClick={toggleLabels}
              className={`p-2 rounded-lg transition-colors ${
                showLabels ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'
              }`}
              title="标签"
            >
              标签
            </button>
            <button
              onClick={() => setCameraView(cameraView === '3d' ? 'top' : '3d')}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 transition-colors"
              title="切换视角"
            >
              {cameraView === '3d' ? '俯视图' : '3D视图'}
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            <Download size={18} />
            导出报告
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            <Home size={18} />
            主菜单
          </button>
        </div>

        <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentTurn + 1) / replay.snapshots.length) * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={replay.snapshots.length - 1}
            value={currentTurn}
            onChange={(e) => {
              setCurrentTurn(parseInt(e.target.value));
              setIsPlaying(false);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>回合 1</span>
          <span>回合 {replay.snapshots.length}</span>
        </div>

        {replay.eventLog.filter(e => e.turn === currentTurn + 1).length > 0 && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-2">当前回合事件:</div>
            {replay.eventLog
              .filter(e => e.turn === currentTurn + 1)
              .map((event) => (
                <div
                  key={event.id}
                  className={`text-sm ${
                    event.severity === 'danger'
                      ? 'text-red-400'
                      : event.severity === 'warning'
                      ? 'text-yellow-400'
                      : 'text-cyan-400'
                  }`}
                >
                  • {event.message}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
