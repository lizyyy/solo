import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, RotateCcw, Edit3, RefreshCw, AlertTriangle, ChevronRight, Zap
} from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { ScenarioSelector } from '@/components/ScenarioSelector/ScenarioSelector';
import { useAppStore } from '@/store/useAppStore';
import { useState } from 'react';

export function FlowControl() {
  const {
    currentStep,
    scenarioType,
    pointCloudLogs,
    isDemoRunning,
    importLog,
    checkRadiusTable,
    updateAnnotation,
    manualCorrect,
    reRun,
    resetDemo,
    markForReview,
    setScenarioType,
  } = useAppStore();

  const [showManualCorrect, setShowManualCorrect] = useState(false);
  const [manualRadius, setManualRadius] = useState('2.0');

  const latestLog = pointCloudLogs[pointCloudLogs.length - 1];
  const hasConflictObstacle = latestLog?.detectedObstacles.some(
    (o) => o.status === 'conflict'
  );
  const hasPendingReview = latestLog?.detectedObstacles.some(
    (o) => o.status === 'pending_review'
  );
  const conflictObstacle = latestLog?.detectedObstacles.find(
    (o) => o.status === 'conflict'
  );
  const pendingObstacle = latestLog?.detectedObstacles.find(
    (o) => o.status === 'pending_review'
  );

  const handleImportLog = () => {
    if (scenarioType) {
      importLog(scenarioType);
    }
  };

  const handleManualCorrect = () => {
    if (conflictObstacle) {
      manualCorrect(conflictObstacle.id, parseFloat(manualRadius));
      setShowManualCorrect(false);
    }
  };

  const handleMarkReview = () => {
    if (pendingObstacle) {
      markForReview(pendingObstacle.id);
    }
  };

  const canProceedStep1 = !!scenarioType && !isDemoRunning;
  const canProceedStep2 = currentStep === 1 && pointCloudLogs.length > 0;
  const canProceedStep3 = currentStep === 2;

  return (
    <div className="bg-primary-800/80 backdrop-blur-md border-t border-primary-700/50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex-shrink-0">
            <StepIndicator currentStep={currentStep} />
          </div>

          <div className="flex-1 max-w-xl w-full">
            <AnimatePresence mode="wait">
              {!isDemoRunning ? (
                <motion.div
                  key="selector"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ScenarioSelector
                    selected={scenarioType}
                    onSelect={setScenarioType}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-wrap items-center gap-2"
                >
                  {showManualCorrect && conflictObstacle && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 bg-primary-700/50 px-3 py-2 rounded-lg"
                    >
                      <Edit3 size={14} className="text-status-corrected" />
                      <span className="text-xs text-white">
                        修正 {conflictObstacle.name} 半径:
                      </span>
                      <input
                        type="number"
                        value={manualRadius}
                        onChange={(e) => setManualRadius(e.target.value)}
                        className="w-16 px-2 py-1 text-xs bg-primary-900 border border-primary-600 rounded text-white font-mono"
                        step="0.1"
                        min="0.5"
                        max="10"
                      />
                      <span className="text-xs text-gray-400">m</span>
                      <button
                        onClick={handleManualCorrect}
                        className="px-3 py-1 text-xs bg-status-corrected text-white rounded hover:bg-status-corrected/80 transition-colors"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setShowManualCorrect(false)}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                      >
                        取消
                      </button>
                    </motion.div>
                  )}

                  {hasPendingReview && pendingObstacle && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleMarkReview}
                      className="flex items-center gap-2 px-4 py-2 bg-status-pending/20 border border-status-pending/50 rounded-lg text-xs text-status-pending"
                    >
                      <AlertTriangle size={14} />
                      <span>标记"{pendingObstacle.name}" 待复核 (学员操作)</span>
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isDemoRunning ? (
              <motion.button
                whileHover={canProceedStep1 ? { scale: 1.02 } : {}}
                whileTap={canProceedStep1 ? { scale: 0.98 } : {}}
                onClick={handleImportLog}
                disabled={!canProceedStep1}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm
                  transition-all duration-200
                  ${canProceedStep1
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50'
                    : 'bg-primary-800 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <Play size={16} />
                导入日志
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={canProceedStep2 ? { scale: 1.02 } : {}}
                  whileTap={canProceedStep2 ? { scale: 0.98 } : {}}
                  onClick={checkRadiusTable}
                  disabled={!canProceedStep2}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    ${canProceedStep2
                      ? 'bg-primary-600 text-white hover:bg-primary-500'
                      : 'bg-primary-800 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  对照半径表
                  <ChevronRight size={16} />
                </motion.button>

                {hasConflictObstacle && conflictObstacle && currentStep >= 2 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowManualCorrect(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-status-corrected text-white hover:bg-status-corrected/90 transition-colors"
                  >
                    <Edit3 size={16} />
                    人工修正
                  </motion.button>
                )}

                <motion.button
                  whileHover={canProceedStep3 ? { scale: 1.02 } : {}}
                  whileTap={canProceedStep3 ? { scale: 0.98 } : {}}
                  onClick={updateAnnotation}
                  disabled={!canProceedStep3}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    ${canProceedStep3
                      ? 'bg-status-normal text-white hover:bg-status-normal/90'
                      : 'bg-primary-800 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  更新标注
                </motion.button>

                {currentStep === 3 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={reRun}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-primary-500 text-white hover:bg-primary-400 transition-colors"
                  >
                    <RefreshCw size={16} />
                    重跑
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetDemo}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-primary-800 text-gray-300 hover:bg-primary-700 transition-colors border border-primary-600/50"
                >
                  <RotateCcw size={16} />
                  重置
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>

      {isDemoRunning && scenarioType && (
        <div className="max-w-7xl mx-auto mt-3">
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-primary-900/50 px-3 py-2 rounded-lg">
            <Zap size={12} className="text-yellow-500" />
            <span className="font-medium text-yellow-500">培训提示：</span>
            <span>
              {scenarioType === 'normal' &&
                '这是顺利记录场景 - 日志数据与安全半径表完全一致，标注正常。可以直接走完三步流程。'}
              {scenarioType === 'duplicate_name' &&
                '这是同物异名场景 - 注意35kV母线架构被标了两个名字。别急着归正常，留给学员复核发现。'}
              {scenarioType === 'old_caliber' &&
                '这是旧口径场景 - 10kV开关柜日志用了旧口径1.5米，安全半径表已更新为2.0米。需要人工修正后重跑。'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
