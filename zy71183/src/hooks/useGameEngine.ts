import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { createScoreDetail } from '../utils/scoreCalculator';
import type { LevelConfig, ActiveAnomaly, OperationRecord } from '../types';

export function useGameEngine(levelConfig: LevelConfig | null) {
  const gameState = useGameStore();

  const validateStep = useCallback((pointId: string): { isCorrect: boolean; isDuplicate: boolean } => {
    if (!levelConfig) return { isCorrect: false, isDuplicate: false };

    const { completedSteps, currentStep } = gameState;

    if (completedSteps.includes(pointId)) {
      return { isCorrect: false, isDuplicate: true };
    }

    const expectedPointId = levelConfig.requiredOrder[currentStep];
    
    if (pointId === expectedPointId) {
      return { isCorrect: true, isDuplicate: false };
    }

    return { isCorrect: false, isDuplicate: false };
  }, [levelConfig, gameState.currentStep, gameState.completedSteps]);

  const handleInspectionPoint = useCallback((pointId: string) => {
    if (!levelConfig || gameState.isPaused || gameState.isCompleted) return;

    const point = levelConfig.inspectionPoints.find(p => p.id === pointId);
    if (!point) return;

    const { isCorrect, isDuplicate } = validateStep(pointId);

    const operation: OperationRecord = {
      type: 'inspect',
      targetId: pointId,
      timestamp: Date.now(),
      isCorrect: isCorrect && !isDuplicate,
      details: point.description,
    };

    if (isDuplicate) {
      gameState.completeStep(pointId, false, true);
      gameState.addScoreDetail(createScoreDetail('duplicate', `重复巡检：${point.name}`));
      operation.details = `重复巡检：${point.name}`;
    } else if (isCorrect) {
      const isLastStep = gameState.currentStep === levelConfig.requiredOrder.length - 1;
      
      gameState.completeStep(pointId, true, false);
      gameState.addScoreDetail(createScoreDetail('correct', `正确巡检：${point.name}`));
      
      if (isLastStep) {
        gameState.addScoreDetail(createScoreDetail('full_completion', '完成全部巡检流程'));
      }
    } else {
      gameState.addWrongStep(pointId);
      gameState.addScoreDetail(createScoreDetail('wrong_order', `顺序错误：${point.name}`));
      operation.details = `顺序错误：${point.name}`;
    }

    gameState.addOperation(operation);

    const relatedAnomaly = gameState.activeAnomalies.find(
      a => a.relatedPointId === pointId && !a.isHandled
    );
    if (relatedAnomaly) {
      gameState.handleAnomaly(relatedAnomaly.configId);
    }
  }, [levelConfig, gameState, validateStep]);

  const handleGenerateReport = useCallback(() => {
    if (!levelConfig || gameState.isCompleted) return;

    const unhandledAnomalies = gameState.activeAnomalies.filter(a => !a.isHandled);
    const notUpgradedCritical = gameState.activeAnomalies.filter(
      a => a.severity === 'critical' && !a.isUpgraded
    );
    const skippedPoints = levelConfig.requiredOrder.filter(
      (id, index) => !gameState.completedSteps.includes(id) && index >= gameState.currentStep
    );

    if (unhandledAnomalies.length > 0) {
      unhandledAnomalies.forEach(anomaly => {
        gameState.addScoreDetail(
          createScoreDetail('anomaly_unhandled', `异常未处理：${anomaly.description}`)
        );
        gameState.addSkippedStep(anomaly.relatedPointId);
      });
    }

    if (notUpgradedCritical.length > 0) {
      notUpgradedCritical.forEach(anomaly => {
        gameState.addScoreDetail(
          createScoreDetail('anomaly_not_upgraded', `严重异常未升级：${anomaly.description}`)
        );
      });
    }

    if (skippedPoints.length > 0) {
      skippedPoints.forEach(pointId => {
        const point = levelConfig.inspectionPoints.find(p => p.id === pointId);
        if (point) {
          gameState.addSkippedStep(pointId);
          gameState.addScoreDetail(
            createScoreDetail('skipped', `漏检项目：${point.name}`)
          );
        }
      });
    }

    if (unhandledAnomalies.length === 0 && skippedPoints.length === 0) {
      gameState.addScoreDetail(createScoreDetail('report_complete', '报告完整生成'));
    }

    gameState.setReportGenerated(true);
    gameState.completeGame();

    gameState.addOperation({
      type: 'generate_report',
      targetId: 'report',
      timestamp: Date.now(),
      isCorrect: true,
      details: '生成巡检报告',
    });
  }, [levelConfig, gameState]);

  const handleUpgradeAnomaly = useCallback((configId: string) => {
    const anomaly = gameState.activeAnomalies.find(a => a.configId === configId);
    if (!anomaly) return;

    gameState.upgradeAnomaly(configId);
    gameState.addOperation({
      type: 'anomaly_upgrade',
      targetId: configId,
      timestamp: Date.now(),
      isCorrect: true,
      details: `升级异常：${anomaly.description}`,
    });
  }, [gameState]);

  const checkAndTriggerAnomalies = useCallback(() => {
    if (!levelConfig) return;

    levelConfig.possibleAnomalies.forEach(anomalyConfig => {
      const alreadyTriggered = gameState.activeAnomalies.some(
        a => a.configId === anomalyConfig.id
      );
      if (alreadyTriggered) return;

      if (Math.random() < anomalyConfig.triggerProbability * 0.01) {
        const anomaly: ActiveAnomaly = {
          configId: anomalyConfig.id,
          type: anomalyConfig.type,
          severity: anomalyConfig.severity,
          isHandled: false,
          isUpgraded: false,
          triggeredAt: Date.now(),
          description: anomalyConfig.description,
          relatedPointId: anomalyConfig.relatedPointId,
        };
        gameState.triggerAnomaly(anomaly);
      }
    });
  }, [levelConfig, gameState.activeAnomalies, gameState.triggerAnomaly]);

  return {
    handleInspectionPoint,
    handleGenerateReport,
    handleUpgradeAnomaly,
    checkAndTriggerAnomalies,
    validateStep,
  };
}
