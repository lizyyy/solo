import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import levelsData from '../data/levels.json';
import type { LevelConfig, GameRecord } from '../types';
import { useGameStore } from '../store/gameStore';
import { useReplay } from '../hooks/useReplay';
import { ScoreDetailComponent } from '../components/result/ScoreDetail';
import { ReplayPlayer } from '../components/result/ReplayPlayer';
import { ReportExport } from '../components/result/ReportExport';
import { InspectionMap } from '../components/game/InspectionMap';
import { generateReport } from '../utils/reportGenerator';
import { getLevelRecords } from '../utils/storage';

export function ResultPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const gameState = useGameStore();

  const levelConfig = (levelsData as LevelConfig[]).find(l => l.id === levelId) || null;

  const [records, setRecords] = useState<GameRecord[]>([]);

  useEffect(() => {
    if (levelId) {
      setRecords(getLevelRecords(levelId));
    }
  }, [levelId]);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.sort((a, b) => b.completedAt - a.completedAt)[0];
  }, [records]);

  const replayData = useMemo(() => {
    return gameState.operationHistory.length > 0 
      ? gameState.operationHistory 
      : (latestRecord?.replayData || []);
  }, [gameState.operationHistory, latestRecord]);

  const {
    isPlaying,
    currentIndex,
    progress,
    speed,
    play,
    pause,
    reset,
    seekTo,
    setSpeed,
    getCurrentOperation,
    getHighlightedPointId,
  } = useReplay(replayData, levelConfig);

  const report = useMemo(() => {
    if (!levelConfig) return null;
    
    const stateToUse = gameState.operationHistory.length > 0 
      ? gameState 
      : latestRecord 
        ? {
            ...gameState,
            score: latestRecord.score,
            operationHistory: latestRecord.replayData,
            completedSteps: [],
            skippedSteps: latestRecord.errors.filter(e => e.includes('漏检')).map(e => e.split(': ')[1]),
            wrongSteps: latestRecord.errors.filter(e => e.includes('顺序错误')).map(e => e.split(': ')[1]),
            activeAnomalies: [],
            timeRemaining: (levelConfig?.timeLimit || 0) - latestRecord.timeTaken,
            reportGenerated: true,
          }
        : gameState;

    return generateReport(stateToUse, levelConfig);
  }, [levelConfig, gameState, latestRecord]);

  const handleBackToMenu = () => {
    gameState.resetGame();
    navigate('/');
  };

  const handlePlayAgain = () => {
    gameState.resetGame();
    if (levelId) {
      navigate(`/game/${levelId}`);
    }
  };

  if (!levelConfig || !report) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white text-xl">无法加载结算页面</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="container mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">巡检报告</h1>
          <p className="text-slate-400">{levelConfig.name} - 结算页面</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6">
          <ScoreDetailComponent
            details={gameState.scoreDetails.length > 0 ? gameState.scoreDetails : []}
            totalScore={gameState.score || latestRecord?.score || 0}
            targetScore={levelConfig.targetScore}
          />

          <ReplayPlayer
            operations={replayData}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            progress={progress}
            speed={speed}
            onPlay={play}
            onPause={pause}
            onReset={reset}
            onSeekTo={seekTo}
            onSpeedChange={setSpeed}
            currentOperation={getCurrentOperation()}
            totalOperations={replayData.length}
          />
        </div>

        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">操作回放地图</h3>
            <InspectionMap
              points={levelConfig.inspectionPoints}
              requiredOrder={levelConfig.requiredOrder}
              currentStep={currentIndex + 1}
              completedSteps={replayData.slice(0, currentIndex + 1).filter(o => o.isCorrect).map(o => o.targetId)}
              wrongSteps={[]}
              skippedSteps={[]}
              activeAnomalies={[]}
              onPointClick={() => {}}
              highlightedPointId={getHighlightedPointId()}
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <ReportExport
            report={report}
            onBackToMenu={handleBackToMenu}
            onPlayAgain={handlePlayAgain}
          />
        </div>

        {records.length > 1 && (
          <div className="max-w-6xl mx-auto mt-6">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">历史记录</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {records.slice(0, 5).map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                  >
                    <div>
                      <span className="text-slate-400 text-sm">
                        {new Date(record.completedAt).toLocaleString('zh-CN')}
                      </span>
                      {record.errors.length > 0 && (
                        <p className="text-xs text-industrial-red mt-1">
                          {record.errors.length} 个错误
                        </p>
                      )}
                    </div>
                    <span className={`font-mono text-lg ${
                      record.score >= levelConfig.targetScore ? 'text-green-400' : 'text-industrial-yellow'
                    }`}>
                      {record.score} 分
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
