import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, InspectionReport, LevelConfig, ReplayFrame } from '../game/types';
import { GameCanvas } from '../components/GameCanvas';
import { StatusPanel } from '../components/StatusPanel';
import { ControlPanel } from '../components/ControlPanel';
import { ResultModal } from '../components/ResultModal';
import { HistoryModal } from '../components/HistoryModal';
import { ReplayPlayer } from '../components/ReplayPlayer';

interface ReplayData {
  id: string;
  levelId: number;
  timestamp: number;
  frames: ReplayFrame[];
  map: any;
  hazards: any[];
  totalTime: number;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [engine, setEngine] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [currentReport, setCurrentReport] = useState<InspectionReport | null>(null);
  const [currentReplay, setCurrentReplay] = useState<ReplayData | null>(null);
  const [historyReports, setHistoryReports] = useState<InspectionReport[]>([]);
  const [replays, setReplays] = useState<ReplayData[]>([]);
  const [levels, setLevels] = useState<LevelConfig[]>([]);

  const canvasWidth = 800;
  const canvasHeight = 600;

  const handleEngineReady = useCallback((engineInstance: any) => {
    setEngine(engineInstance);
    setLevels(engineInstance.getLevels());

    engineInstance.setOnStateChange((state: GameState) => {
      setGameState(state);
    });

    engineInstance.setOnGameEnd((report: InspectionReport) => {
      setCurrentReport(report);
      setShowResult(true);
      refreshHistory();
    });
  }, []);

  const refreshHistory = useCallback(() => {
    if (engine) {
      const reports = engine.getReportSystem().loadAllReports();
      setHistoryReports(reports);
      
      const replaySystem = engine.getReplaySystem();
      const replayList = replaySystem.getReplayList();
      
      const loadedReplays: ReplayData[] = replayList.map(r => {
        const frames = replaySystem.loadFromStorage(r.id);
        if (frames && frames.length > 0) {
          const lastFrame = frames[frames.length - 1];
          return {
            id: r.id,
            levelId: r.levelId,
            timestamp: r.timestamp,
            frames,
            map: gameState?.map || null,
            hazards: gameState?.hazards || [],
            totalTime: lastFrame.timestamp / 1000
          };
        }
        return null;
      }).filter(Boolean) as ReplayData[];
      
      setReplays(loadedReplays);
    }
  }, [engine, gameState]);

  useEffect(() => {
    refreshHistory();
  }, [engine, refreshHistory]);

  const handleStartLevel = useCallback((levelId: number) => {
    if (engine) {
      engine.startLevel(levelId);
      setShowResult(false);
    }
  }, [engine]);

  const handlePause = useCallback(() => {
    engine?.pause();
  }, [engine]);

  const handleResume = useCallback(() => {
    engine?.resume();
  }, [engine]);

  const handleRestart = useCallback(() => {
    engine?.restart();
    setShowResult(false);
  }, [engine]);

  const handleExport = useCallback((format: 'json' | 'txt') => {
    if (currentReport && engine) {
      engine.getReportSystem().downloadReport(currentReport, format);
    }
  }, [currentReport, engine]);

  const handleViewHistoryReport = useCallback((report: InspectionReport) => {
    setCurrentReport(report);
    setShowHistory(false);
    setShowResult(true);
  }, []);

  const handleStartReplay = useCallback((replayId: string) => {
    const replay = replays.find(r => r.id === replayId);
    if (replay && gameState) {
      setCurrentReplay({
        ...replay,
        map: gameState.map,
        hazards: gameState.hazards
      });
      setShowHistory(false);
      setShowReplay(true);
    }
  }, [replays, gameState]);

  const currentLevelName = gameState 
    ? levels.find(l => l.id === gameState.currentLevel)?.name || ''
    : levels[0]?.name || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <span className="text-xl">🔥</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">仓库消防巡逻</h1>
                <p className="text-sm text-gray-400">Warehouse Fire Safety Patrol</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>WASD/方向键移动</span>
              <span>空格键标记隐患</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-gray-800/30 rounded-xl p-4 mb-4">
              <ControlPanel
                status={gameState?.status || 'idle'}
                levels={levels}
                currentLevelId={gameState?.currentLevel || 1}
                onStartLevel={handleStartLevel}
                onPause={handlePause}
                onResume={handleResume}
                onRestart={handleRestart}
                onShowHistory={() => setShowHistory(true)}
              />
            </div>

            <div className="flex justify-center items-center bg-gray-800/30 rounded-xl p-4">
              <GameCanvas
                width={canvasWidth}
                height={canvasHeight}
                gameState={gameState}
                onEngineReady={handleEngineReady}
              />
            </div>

            {gameState?.status === 'paused' && (
              <div className="mt-4 bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 text-center">
                <p className="text-yellow-400 font-semibold">游戏已暂停</p>
                <p className="text-yellow-300 text-sm mt-1">点击"继续"按钮恢复游戏</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <StatusPanel
              gameState={gameState}
              levelName={currentLevelName}
            />

            <div className="mt-4 bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">图例说明</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span className="text-gray-400">隐患（需标记）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span className="text-gray-400">正常设施</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded-full" />
                  <span className="text-gray-400">玩家位置</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span className="text-gray-400">安全出口</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-600 rounded" />
                  <span className="text-gray-400">货架（不可穿过）</span>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">计分规则</h3>
              <div className="space-y-1 text-sm text-gray-400">
                <p>• 基础分: 1000</p>
                <p>• 正确标记: +100</p>
                <p>• 错误标记: -50</p>
                <p>• 重复标记: -30</p>
                <p>• 未发现隐患: -100</p>
                <p>• 超时: -10/秒</p>
                <p>• 资源浪费: -30</p>
                <p>• 时间奖励: +2/秒</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showResult && currentReport && (
        <ResultModal
          report={currentReport}
          onClose={() => setShowResult(false)}
          onRestart={handleRestart}
          onExport={handleExport}
        />
      )}

      {showHistory && (
        <HistoryModal
          reports={historyReports}
          replays={replays}
          onClose={() => setShowHistory(false)}
          onViewReport={handleViewHistoryReport}
          onStartReplay={handleStartReplay}
        />
      )}

      {showReplay && currentReplay && currentReplay.map && (
        <ReplayPlayer
          frames={currentReplay.frames}
          hazards={currentReplay.hazards}
          map={currentReplay.map}
          totalTime={currentReplay.totalTime}
          onClose={() => {
            setShowReplay(false);
            setCurrentReplay(null);
          }}
        />
      )}
    </div>
  );
}
