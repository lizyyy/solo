import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import levelsData from '../data/levels.json';
import type { LevelConfig, InspectionReport } from '../types';
import { useGameStore } from '../store/gameStore';
import { useGameEngine } from '../hooks/useGameEngine';
import { useTimer } from '../hooks/useTimer';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { InspectionMap } from '../components/game/InspectionMap';
import { StepChecklist } from '../components/game/StepChecklist';
import { AnomalyAlert } from '../components/game/AnomalyAlert';
import { ReportForm } from '../components/game/ReportForm';
import { generateReport, formatReportAsText } from '../utils/reportGenerator';
import { saveGameRecord } from '../utils/storage';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const gameState = useGameStore();
  
  const [showAnomalyAlert, setShowAnomalyAlert] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const anomalyCheckRef = useRef<number | null>(null);

  const levelConfig = (levelsData as LevelConfig[]).find(l => l.id === levelId) || null;

  const {
    handleInspectionPoint,
    handleGenerateReport,
    handleUpgradeAnomaly,
    checkAndTriggerAnomalies,
  } = useGameEngine(levelConfig);

  const { formatTime } = useTimer(levelConfig?.timeLimit || 0, () => {
    handleGenerateReport();
  });

  useEffect(() => {
    if (levelConfig) {
      gameState.initializeGame(levelConfig.id, levelConfig.timeLimit);
    }
    return () => {
      gameState.resetGame();
    };
  }, [levelConfig, gameState]);

  useEffect(() => {
    if (!gameState.isStarted || gameState.isPaused || gameState.isCompleted) {
      if (anomalyCheckRef.current) {
        clearInterval(anomalyCheckRef.current);
        anomalyCheckRef.current = null;
      }
      return;
    }

    anomalyCheckRef.current = window.setInterval(() => {
      checkAndTriggerAnomalies();
    }, 3000);

    return () => {
      if (anomalyCheckRef.current) {
        clearInterval(anomalyCheckRef.current);
      }
    };
  }, [gameState.isStarted, gameState.isPaused, gameState.isCompleted, checkAndTriggerAnomalies]);

  useEffect(() => {
    const unhandledAnomalies = gameState.activeAnomalies.filter(a => !a.isHandled);
    if (unhandledAnomalies.length > 0 && !showAnomalyAlert) {
      setShowAnomalyAlert(true);
    }
  }, [gameState.activeAnomalies, showAnomalyAlert]);

  useEffect(() => {
    if (gameState.isCompleted && gameState.reportGenerated) {
      const record = {
        levelId: gameState.levelId,
        score: gameState.score,
        completedAt: Date.now(),
        timeTaken: (levelConfig?.timeLimit || 0) - gameState.timeRemaining,
        errors: [
          ...gameState.wrongSteps.map(id => `顺序错误: ${id}`),
          ...gameState.skippedSteps.map(id => `漏检: ${id}`),
          ...gameState.activeAnomalies.filter(a => !a.isHandled).map(a => `未处理: ${a.description}`),
        ],
        replayData: gameState.operationHistory,
      };
      saveGameRecord(record);
      navigate(`/result/${gameState.levelId}`);
    }
  }, [gameState.isCompleted, gameState.reportGenerated, gameState, levelConfig, navigate]);

  const handleStart = useCallback(() => {
    gameState.startGame();
  }, [gameState]);

  const handlePause = useCallback(() => {
    gameState.setPaused(true);
  }, [gameState]);

  const handleResume = useCallback(() => {
    gameState.setPaused(false);
  }, [gameState]);

  const handleRestart = useCallback(() => {
    if (levelConfig) {
      gameState.initializeGame(levelConfig.id, levelConfig.timeLimit);
      gameState.startGame();
    }
  }, [gameState, levelConfig]);

  const handlePointClick = useCallback((pointId: string) => {
    if (!gameState.isStarted) {
      handleStart();
    }
    handleInspectionPoint(pointId);
  }, [gameState.isStarted, handleStart, handleInspectionPoint]);

  const handleCloseAnomalyAlert = useCallback(() => {
    setShowAnomalyAlert(false);
  }, []);

  const handleUpgradeAnomalyClick = useCallback((configId: string) => {
    handleUpgradeAnomaly(configId);
  }, [handleUpgradeAnomaly]);

  const handleGenerateReportClick = useCallback(() => {
    handleGenerateReport();
  }, [handleGenerateReport]);

  const handleShowReport = useCallback(() => {
    setShowReport(true);
  }, []);

  const handleCloseReport = useCallback(() => {
    setShowReport(false);
  }, []);

  if (!levelConfig) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white text-xl">关卡不存在</p>
      </div>
    );
  }

  const unhandledAnomalyCount = gameState.activeAnomalies.filter(a => !a.isHandled).length;

  const report: InspectionReport | null = gameState.isCompleted && gameState.reportGenerated
    ? generateReport(gameState, levelConfig)
    : null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Header
        levelName={levelConfig.name}
        score={gameState.score}
        timeRemaining={gameState.timeRemaining}
        anomalyCount={unhandledAnomalyCount}
        formatTime={formatTime}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0 p-4">
          <StepChecklist
            points={levelConfig.inspectionPoints}
            requiredOrder={levelConfig.requiredOrder}
            currentStep={gameState.currentStep}
            completedSteps={gameState.completedSteps}
            wrongSteps={gameState.wrongSteps}
            skippedSteps={gameState.skippedSteps}
          />
        </div>

        <div className="flex-1 p-4 flex items-center justify-center">
          <InspectionMap
            points={levelConfig.inspectionPoints}
            requiredOrder={levelConfig.requiredOrder}
            currentStep={gameState.currentStep}
            completedSteps={gameState.completedSteps}
            wrongSteps={gameState.wrongSteps}
            skippedSteps={gameState.skippedSteps}
            activeAnomalies={gameState.activeAnomalies}
            onPointClick={handlePointClick}
          />
        </div>
      </div>

      <Footer
        isPaused={gameState.isPaused}
        isCompleted={gameState.isCompleted}
        onPause={handlePause}
        onResume={handleResume}
        onRestart={handleRestart}
        onGenerateReport={handleGenerateReportClick}
        canGenerateReport={gameState.isStarted && !gameState.isCompleted}
      />

      {gameState.isPaused && !gameState.isCompleted && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">游戏暂停</h2>
            <p className="text-slate-400 mb-6">点击继续按钮恢复游戏</p>
            <button
              onClick={handleResume}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-lg font-medium transition-colors"
            >
              继续游戏
            </button>
          </div>
        </div>
      )}

      {!gameState.isStarted && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="bg-slate-800 rounded-xl p-8 text-center max-w-lg border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">{levelConfig.name}</h2>
            <div className="text-left space-y-2 mb-6">
              <p className="text-slate-300">
                <span className="text-slate-500">时间限制：</span>
                {formatTime(levelConfig.timeLimit)}
              </p>
              <p className="text-slate-300">
                <span className="text-slate-500">巡检点：</span>
                {levelConfig.inspectionPoints.length} 个
              </p>
              <p className="text-slate-300">
                <span className="text-slate-500">可能异常：</span>
                {levelConfig.possibleAnomalies.length} 个
              </p>
              <p className="text-slate-300">
                <span className="text-slate-500">目标得分：</span>
                <span className="text-industrial-yellow font-mono">{levelConfig.targetScore}</span>
              </p>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              按照步骤清单顺序点击巡检点完成巡检，注意处理出现的异常事件
            </p>
            <button
              onClick={handleStart}
              className="w-full px-8 py-3 bg-industrial-blue hover:bg-blue-700 text-white rounded-lg text-lg font-medium transition-colors"
            >
              开始巡检
            </button>
          </div>
        </div>
      )}

      <AnomalyAlert
        anomalies={gameState.activeAnomalies}
        onClose={handleCloseAnomalyAlert}
        onUpgrade={handleUpgradeAnomalyClick}
      />

      {showReport && report && (
        <ReportForm
          report={report}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
}
