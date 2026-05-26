import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, 
  ArrowLeft, Home, Trophy, Download,
  Clock, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import { getGameRecordById, downloadReport } from '@/utils/storage';
import { getLevelById, getDifficultyStars } from '@/data/levels';
import { getMedicineById } from '@/data/medicines';
import { PharmacyScene } from '@/components/PharmacyScene';
import { PrescriptionPanel } from '@/components/PrescriptionPanel';
import { MedicineCard } from '@/components/MedicineCard';
import { DispensingTable } from '@/components/DispensingTable';
import { ScoreBoard } from '@/components/ScoreBoard';
import { cn } from '@/lib/utils';
import type { GameRecord, ReplayAction, Prescription } from '@/types';

const Replay = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const gameRecord = useMemo(() => {
    if (!gameId) return null;
    return getGameRecordById(gameId);
  }, [gameId]);

  const level = useMemo(() => {
    if (!gameRecord) return null;
    return getLevelById(gameRecord.levelId);
  }, [gameRecord]);

  const replayActions = useMemo<ReplayAction[]>(() => {
    if (!gameRecord) return [];
    
    const actions: ReplayAction[] = [];
    const prescriptions = gameRecord.prescriptions;
    let prescriptionIndex = 0;
    
    // 添加初始状态
    actions.push({
      type: 'init',
      timestamp: 0,
      prescriptionIndex: 0,
      score: 0,
      placedMedicines: [],
      checkResults: [],
      description: '游戏开始'
    });
    
    // 遍历所有处方结果
    gameRecord.prescriptionResults.forEach((result, pIndex) => {
      const prescription = prescriptions[pIndex];
      if (!prescription) return;
      
      // 添加阅读处方阶段
      actions.push({
        type: 'reading',
        timestamp: actions.length * 1000,
        prescriptionIndex: pIndex,
        score: result.score,
        placedMedicines: [],
        checkResults: [],
        description: `阅读处方 #${pIndex + 1}`
      });
      
      // 添加放置药品
      prescription.items.forEach((item, mIndex) => {
        const medicine = getMedicineById(item.medicineId);
        const placedMeds = prescription.items.slice(0, mIndex + 1).map(i => i.medicineId);
        
        actions.push({
          type: 'place',
          timestamp: actions.length * 1000,
          prescriptionIndex: pIndex,
          medicineId: item.medicineId,
          medicineName: medicine?.name || '',
          score: result.score,
          placedMedicines: placedMeds,
          checkResults: [],
          description: `放置药品: ${medicine?.name || '未知'}`
        });
      });
      
      // 添加核对操作
      const prescriptionErrors = gameRecord.errors.filter(
        e => e.prescriptionId === prescription.id
      );
      
      prescription.items.forEach((item, mIndex) => {
        const placedMeds = prescription.items.map(i => i.medicineId);
        const hasDosageError = prescriptionErrors.some(
          e => e.type === 'dosage' && e.medicineId === item.medicineId
        );
        const hasContraindicationError = prescriptionErrors.some(
          e => e.type === 'contraindication' && e.medicineId === item.medicineId
        );
        const hasBatchError = prescriptionErrors.some(
          e => e.type === 'batch' && e.medicineId === item.medicineId
        );
        
        // 剂量核对
        actions.push({
          type: 'check_dosage',
          timestamp: actions.length * 1000,
          prescriptionIndex: pIndex,
          medicineId: item.medicineId,
          medicineName: getMedicineById(item.medicineId)?.name || '',
          checkResult: hasDosageError ? 'incorrect' : 'correct',
          score: result.score,
          placedMedicines: placedMeds,
          checkResults: placedMeds.map((mid, idx) => ({
            medicineId: mid,
            dosage: idx < mIndex ? 'correct' : (mid === item.medicineId ? (hasDosageError ? 'incorrect' : 'correct') : 'unchecked'),
            contraindication: idx <= mIndex ? 'unchecked' : 'unchecked',
            batch: idx <= mIndex ? 'unchecked' : 'unchecked'
          })),
          description: `核对剂量: ${getMedicineById(item.medicineId)?.name || ''}`
        });
        
        // 禁忌核对
        actions.push({
          type: 'check_contraindication',
          timestamp: actions.length * 1000,
          prescriptionIndex: pIndex,
          medicineId: item.medicineId,
          medicineName: getMedicineById(item.medicineId)?.name || '',
          checkResult: hasContraindicationError ? 'incorrect' : 'correct',
          score: result.score,
          placedMedicines: placedMeds,
          checkResults: placedMeds.map((mid, idx) => ({
            medicineId: mid,
            dosage: 'correct',
            contraindication: idx < mIndex ? 'correct' : (mid === item.medicineId ? (hasContraindicationError ? 'incorrect' : 'correct') : 'unchecked'),
            batch: idx <= mIndex ? 'unchecked' : 'unchecked'
          })),
          description: `核对禁忌: ${getMedicineById(item.medicineId)?.name || ''}`
        });
        
        // 批号核对
        actions.push({
          type: 'check_batch',
          timestamp: actions.length * 1000,
          prescriptionIndex: pIndex,
          medicineId: item.medicineId,
          medicineName: getMedicineById(item.medicineId)?.name || '',
          checkResult: hasBatchError ? 'incorrect' : 'correct',
          score: result.score,
          placedMedicines: placedMeds,
          checkResults: placedMeds.map((mid, idx) => ({
            medicineId: mid,
            dosage: 'correct',
            contraindication: 'correct',
            batch: idx < mIndex ? 'correct' : (mid === item.medicineId ? (hasBatchError ? 'incorrect' : 'correct') : 'unchecked')
          })),
          description: `核对批号: ${getMedicineById(item.medicineId)?.name || ''}`
        });
      });
      
      // 添加确认配药
      actions.push({
        type: 'confirm',
        timestamp: actions.length * 1000,
        prescriptionIndex: pIndex,
        score: result.score,
        placedMedicines: prescription.items.map(i => i.medicineId),
        checkResults: prescription.items.map(i => {
          const hasDosageError = prescriptionErrors.some(
            e => e.type === 'dosage' && e.medicineId === i.medicineId
          );
          const hasContraindicationError = prescriptionErrors.some(
            e => e.type === 'contraindication' && e.medicineId === i.medicineId
          );
          const hasBatchError = prescriptionErrors.some(
            e => e.type === 'batch' && e.medicineId === i.medicineId
          );
          return {
            medicineId: i.medicineId,
            dosage: hasDosageError ? 'incorrect' : 'correct',
            contraindication: hasContraindicationError ? 'incorrect' : 'correct',
            batch: hasBatchError ? 'incorrect' : 'correct'
          };
        }),
        description: result.isCorrect ? '配药成功！' : '配药存在错误'
      });
      
      // 如果不是最后一个处方，添加切换到下一个处方
      if (pIndex < gameRecord.prescriptionResults.length - 1) {
        actions.push({
          type: 'next',
          timestamp: actions.length * 1000,
          prescriptionIndex: pIndex + 1,
          score: result.score,
          placedMedicines: [],
          checkResults: [],
          description: `进入处方 #${pIndex + 2}`
        });
      }
    });
    
    // 添加游戏结束
    actions.push({
      type: 'finish',
      timestamp: actions.length * 1000,
      prescriptionIndex: gameRecord.prescriptionResults.length - 1,
      score: gameRecord.score,
      placedMedicines: [],
      checkResults: [],
      description: '游戏结束'
    });
    
    return actions;
  }, [gameRecord]);

  const currentAction = useMemo(() => {
    return replayActions[currentStepIndex] || replayActions[0];
  }, [replayActions, currentStepIndex]);

  const currentPrescription = useMemo(() => {
    if (!gameRecord) return null;
    return gameRecord.prescriptions[currentAction.prescriptionIndex] || null;
  }, [gameRecord, currentAction]);

  const availableMedicineIds = useMemo(() => {
    if (!gameRecord || !currentPrescription) return [];
    const prescriptionIds = currentPrescription.items.map(i => i.medicineId);
    const allMedicineIds = gameRecord.prescriptions.flatMap(p => 
      p.items.map(i => i.medicineId)
    );
    // 去重
    return [...new Set([...prescriptionIds, ...allMedicineIds.slice(0, 6)])];
  }, [gameRecord, currentPrescription]);

  const isReading = useMemo(() => {
    return currentAction.type === 'reading';
  }, [currentAction]);

  const hasAnyIncorrect = useMemo(() => {
    return currentAction.checkResults.some(cr => 
      cr.dosage === 'incorrect' || 
      cr.contraindication === 'incorrect' || 
      cr.batch === 'incorrect'
    );
  }, [currentAction]);

  const isAllChecked = useMemo(() => {
    if (currentAction.checkResults.length === 0) return false;
    return currentAction.checkResults.every(cr => 
      cr.dosage !== 'unchecked' && 
      cr.contraindication !== 'unchecked' && 
      cr.batch !== 'unchecked'
    );
  }, [currentAction]);

  // 自动播放
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev >= replayActions.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);
    
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, replayActions.length]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
    setIsPlaying(false);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStepIndex(prev => Math.min(replayActions.length - 1, prev + 1));
    setIsPlaying(false);
  }, [replayActions.length]);

  const handleReset = useCallback(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, []);

  const handleSkipToEnd = useCallback(() => {
    setCurrentStepIndex(replayActions.length - 1);
    setIsPlaying(false);
  }, [replayActions.length]);

  const getActionIcon = (action: ReplayAction) => {
    switch (action.type) {
      case 'init': return <Play className="text-green-500" size={16} />;
      case 'reading': return <Clock className="text-blue-500" size={16} />;
      case 'place': return <CheckCircle className="text-purple-500" size={16} />;
      case 'check_dosage':
      case 'check_contraindication':
      case 'check_batch':
        return action.checkResult === 'correct' 
          ? <CheckCircle className="text-green-500" size={16} />
          : <XCircle className="text-red-500" size={16} />;
      case 'confirm': return <Trophy className="text-yellow-500" size={16} />;
      case 'next': return <SkipForward className="text-blue-500" size={16} />;
      case 'finish': return <Trophy className="text-yellow-500" size={16} />;
      default: return null;
    }
  };

  if (!gameRecord || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
        <div className="text-center">
          <p className="text-xl text-gray-600">游戏记录不存在</p>
          <button
            onClick={() => navigate('/history')}
            className="mt-4 px-6 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors"
          >
            返回历史记录
          </button>
        </div>
      </div>
    );
  }

  const prescriptionMedicineIds = currentPrescription?.items.map(item => item.medicineId) || [];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PharmacyScene isPaused={!isPlaying} />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="p-4">
          <ScoreBoard
            score={currentAction.score}
            maxScore={level.maxScore}
            timeRemaining={gameRecord.totalTime - Math.floor(currentStepIndex / 3)}
            prescriptionTimeRemaining={30}
            currentPrescription={currentAction.prescriptionIndex + 1}
            totalPrescriptions={gameRecord.prescriptions.length}
            errorsCount={gameRecord.errors.filter((_, i) => i < Math.floor(currentStepIndex / 6)).length}
            status={isReading ? 'reading' : 'playing'}
          />
        </div>

        <div className="flex-1 px-4 pb-4 flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="w-72 flex-shrink-0 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-lg">💊</span>
                  药品架
                </h3>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-full font-medium">
                  回放模式
                </span>
              </div>
              <div className="space-y-3">
                {availableMedicineIds.map(medicineId => {
                  const medicine = getMedicineById(medicineId);
                  if (!medicine) return null;
                  
                  const isPlaced = currentAction.placedMedicines.includes(medicineId);
                  
                  return (
                    <MedicineCard
                      key={medicineId}
                      medicine={medicine}
                      isDragging={false}
                      isPlaced={isPlaced}
                      draggable={false}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div className="flex-1 flex gap-4 min-h-0">
                <div className="flex-1 overflow-y-auto">
                  <DispensingTable
                    placedMedicineIds={currentAction.placedMedicines}
                    checkResults={currentAction.checkResults}
                    medicineIssues={{}}
                    onDrop={() => {}}
                    onRemove={() => {}}
                    onCheckDosage={() => {}}
                    onCheckContraindication={() => {}}
                    onCheckBatch={() => {}}
                    onCorrectDosage={() => {}}
                    onReplaceBatch={() => {}}
                    onMarkContraindication={() => {}}
                    disabled={true}
                    prescriptionMedicineIds={prescriptionMedicineIds}
                  />
                </div>

                <div className="w-96 flex-shrink-0 overflow-y-auto">
                  <PrescriptionPanel
                    prescription={currentPrescription}
                    isReading={isReading}
                    readingTimeRemaining={10}
                    currentIndex={currentAction.prescriptionIndex + 1}
                    totalCount={gameRecord.prescriptions.length}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/history')}
                  className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-px h-8 bg-gray-200" />
                <button
                  onClick={handleReset}
                  className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="从头开始"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={handlePrev}
                  disabled={currentStepIndex === 0}
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    currentStepIndex === 0
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="上一步"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
                  title={isPlaying ? '暂停' : '播放'}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentStepIndex >= replayActions.length - 1}
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    currentStepIndex >= replayActions.length - 1
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="下一步"
                >
                  <SkipForward size={20} />
                </button>
                <button
                  onClick={handleSkipToEnd}
                  disabled={currentStepIndex >= replayActions.length - 1}
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    currentStepIndex >= replayActions.length - 1
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="跳转到最后"
                >
                  <SkipForward size={20} />
                </button>
                <div className="w-px h-8 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">速度:</span>
                  {[0.5, 1, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                        playbackSpeed === speed
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 px-4">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>步骤 {currentStepIndex + 1} / {replayActions.length}</span>
                  <span>{currentAction.description}</span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStepIndex + 1) / replayActions.length) * 100}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="返回菜单"
                >
                  <Home size={20} />
                </button>
                <button
                  onClick={() => navigate(`/result/${gameId}`)}
                  className="p-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                  title="查看详情"
                >
                  <Trophy size={20} />
                </button>
                <button
                  onClick={() => downloadReport(gameRecord)}
                  className="p-2 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                  title="导出报告"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 max-h-48 overflow-y-auto">
            <h4 className="font-bold text-gray-900 mb-3">操作时间轴</h4>
            <div className="flex flex-wrap gap-2">
              {replayActions.map((action, index) => (
                <motion.button
                  key={index}
                  onClick={() => {
                    setCurrentStepIndex(index);
                    setIsPlaying(false);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                    currentStepIndex === index
                      ? 'bg-purple-500 text-white shadow-lg scale-105'
                      : index < currentStepIndex
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-gray-50 text-gray-400'
                  )}
                >
                  {getActionIcon(action)}
                  <span className="truncate max-w-32">{action.description}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {currentAction.type === 'finish' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-md"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                <Trophy className="text-white" size={40} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">回放结束</h2>
              <p className="text-gray-600 mb-6">
                最终得分: <span className="font-bold text-purple-600 text-2xl">{gameRecord.score}</span> 分
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  重新回放
                </button>
                <button
                  onClick={() => navigate(`/result/${gameId}`)}
                  className="px-6 py-3 rounded-xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition-colors"
                >
                  查看详情
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Replay;
