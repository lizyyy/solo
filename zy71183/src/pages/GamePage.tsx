import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import levelsData from '../data/levels.json';
import type { LevelConfig } from '../types';
import type { InspectionReport } from '../utils/reportGenerator';
import { useGameStore } from '../store/gameStore';
import { useGameEngine } from '../hooks/useGameEngine';
import { useTimer } from '../hooks/useTimer';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { InspectionMap } from '../components/game/InspectionMap';
import { StepChecklist } from '../components/game/StepChecklist';
import { AnomalyAlert } from '../components/game/AnomalyAlert';
import { ReportForm } from '../components/game/ReportForm';
import { generateReport } from '../utils/reportGenerator';
import { saveGameRecord } from '../utils/storage';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  
  const initializeGame = useGameStore(state => state.initializeGame);
  const resetGame = useGameStore(state => state.resetGame);
  const startGame = useGameStore(state => state.startGame);
  const setPaused = useGameStore(state => state.setPaused);
  
  const isStarted = useGameStore(state => state.isStarted);
  const isPaused = useGameStore(state => state.isPaused);
  const isCompleted = useGameStore(state => state.isCompleted);
  const reportGenerated = useGameStore(state => state.reportGenerated);
  const score = useGameStore(state => state.score);
  const timeRemaining = useGameStore(state => state.timeRemaining);
  const activeAnomalies = useGameStore(state => state.activeAnomalies);
  const levelIdFromState = useGameStore(state => state.levelId);
  const wrongSteps = useGameStore(state => state.wrongSteps);
  const skippedSteps = useGameStore(state => state.skippedSteps);
  const operationHistory = useGameStore(state => state.operationHistory);
  const completedSteps = useGameStore(state => state.completedSteps);
  const currentStep = useGameStore(state => state.currentStep);
  const scoreDetails = useGameStore(state => state.scoreDetails);
  
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
      initializeGame(levelConfig.id, levelConfig.timeLimit);
    }
    return () => {
      resetGame();
    };
  }, [levelConfig, initializeGame, resetGame]);

  useEffect(() => {
    if (!isStarted || isPaused || isCompleted) {
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
  }, [isStarted, isPaused, isCompleted, checkAndTriggerAnomalies]);

  const handleDismissAnomaly = useCallback((_configId: string) => {
  }, []);

  useEffect(() => {
    if (isCompleted && reportGenerated) {
      const record = {
        levelId: levelIdFromState,
        score,
        completedAt: Date.now(),
        timeTaken: (levelConfig?.timeLimit || 0) - timeRemaining,
        errors: [
          ...wrongSteps.map(id => `顺序错误: ${id}`),
          ...skippedSteps.map(id => `漏检: ${id}`),
          ...activeAnomalies.filter(a => !a.isHandled).map(a => `未处理: ${a.description}`),
        ],
        replayData: operationHistory,
      };
      saveGameRecord(record);
      navigate(`/result/${levelIdFromState}`);
    }
  }, [isCompleted, reportGenerated, levelIdFromState, score, timeRemaining, wrongSteps, skippedSteps, activeAnomalies, operationHistory, levelConfig, navigate]);

  const handleStart = useCallback(() => {
    startGame();
  }, [startGame]);

  const handlePause = useCallback(() => {
    setPaused(true);
  }, [setPaused]);

  const handleResume = useCallback(() => {
    setPaused(false);
  }, [setPaused]);

  const handleRestart = useCallback(() => {
    if (levelConfig) {
      initializeGame(levelConfig.id, levelConfig.timeLimit);
      startGame();
    }
  }, [levelConfig, initializeGame, startGame]);

  const handlePointClick = useCallback((pointId: string) => {
    if (!isStarted) {
      handleStart();
    }
    handleInspectionPoint(pointId);
  }, [isStarted, handleStart, handleInspectionPoint]);

  const handleUpgradeAnomalyClick = useCallback((configId: string) => {
    handleUpgradeAnomaly(configId);
  }, [handleUpgradeAnomaly]);

  const handleGenerateReportClick = useCallback(() => {
    handleGenerateReport();
  }, [handleGenerateReport]);

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

  const unhandledAnomalyCount = activeAnomalies.filter(a => !a.isHandled).length;

  const gameStateForReport = {
    levelId: levelIdFromState,
    currentStep,
    completedSteps,
    skippedSteps,
    wrongSteps: useGameStore.getState().wrongSteps,
    duplicateSteps: useGameStore.getState().duplicateSteps,
    activeAnomalies,
    score,
    scoreDetails,
    timeRemaining,
    isPaused,
    isCompleted,
    isStarted,
    operationHistory,
    reportGenerated,
    startTime: useGameStore.getState().startTime,
  };

  const report: InspectionReport | null = isCompleted && reportGenerated
    ? generateReport(gameStateForReport, levelConfig)
    : null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Header
        levelName={levelConfig.name}
        score={score}
        timeRemaining={timeRemaining}
        anomalyCount={unhandledAnomalyCount}
        formatTime={formatTime}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0 p-4">
          <StepChecklist
            points={levelConfig.inspectionPoints}
            requiredOrder={levelConfig.requiredOrder}
            currentStep={currentStep}
            completedSteps={completedSteps}
            wrongSteps={wrongSteps}
            skippedSteps={skippedSteps}
          />
        </div>

        <div className="flex-1 p-4 flex items-center justify-center">
          <InspectionMap
            points={levelConfig.inspectionPoints}
            requiredOrder={levelConfig.requiredOrder}
            currentStep={currentStep}
            completedSteps={completedSteps}
            wrongSteps={wrongSteps}
            skippedSteps={skippedSteps}
            activeAnomalies={activeAnomalies}
            onPointClick={handlePointClick}
          />
        </div>
      </div>

      <Footer
        isPaused={isPaused}
        isCompleted={isCompleted}
        onPause={handlePause}
        onResume={handleResume}
        onRestart={handleRestart}
        onGenerateReport={handleGenerateReportClick}
        canGenerateReport={isStarted && !isCompleted}
      />

      {isPaused && !isCompleted && (
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

      {!isStarted && (
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
        anomalies={activeAnomalies}
        onUpgrade={handleUpgradeAnomalyClick}
        onDismiss={handleDismissAnomaly}
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
