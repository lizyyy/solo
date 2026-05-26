import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PharmacyScene } from '@/components/PharmacyScene';
import { PrescriptionPanel } from '@/components/PrescriptionPanel';
import { MedicineCard } from '@/components/MedicineCard';
import { DispensingTable } from '@/components/DispensingTable';
import { ScoreBoard } from '@/components/ScoreBoard';
import { GameControls } from '@/components/GameControls';
import { ToastContainer } from '@/components/ToastContainer';
import { useGameStore } from '@/store/gameStore';
import { getMedicineById, medicines } from '@/data/medicines';
import { getLevelById } from '@/data/levels';
import { getGameRecordById } from '@/utils/storage';

const Game = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const [draggingMedicineId, setDraggingMedicineId] = useState<string | null>(null);

  const {
    status,
    score,
    timeRemaining,
    prescriptionTimeRemaining,
    readingTimeRemaining,
    currentPrescriptionIndex,
    errors,
    placedMedicines,
    checkResults,
    toasts,
    currentPrescriptions,
    currentGameId,
    initGame,
    startReading,
    startPlaying,
    pauseGame,
    resumeGame,
    restartGame,
    tickReading,
    tickTime,
    placeMedicine,
    removeMedicine,
    checkDosage,
    checkContraindication,
    checkBatch,
    confirmPrescription,
    nextPrescription,
    removeToast,
    getCurrentPrescription,
    isAllChecked,
    getAvailableMedicines
  } = useGameStore();

  const level = useMemo(() => getLevelById(levelId || ''), [levelId]);
  const currentPrescription = useMemo(() => getCurrentPrescription(), [getCurrentPrescription]);
  const availableMedicineIds = useMemo(() => getAvailableMedicines(), [getAvailableMedicines]);

  useEffect(() => {
    if (levelId) {
      initGame(levelId);
    }
  }, [levelId, initGame]);

  useEffect(() => {
    if (status === 'finished' && currentGameId) {
      navigate(`/result/${currentGameId}`);
    }
  }, [status, currentGameId, navigate]);

  useEffect(() => {
    let interval: number | undefined;
    
    if (status === 'reading') {
      interval = window.setInterval(() => {
        tickReading();
      }, 1000);
    } else if (status === 'playing') {
      interval = window.setInterval(() => {
        tickTime();
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, tickReading, tickTime]);

  const handleDragStart = useCallback((e: React.DragEvent, medicineId: string) => {
    e.dataTransfer.setData('medicineId', medicineId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingMedicineId(medicineId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingMedicineId(null);
  }, []);

  const handleStart = useCallback(() => {
    startReading();
  }, [startReading]);

  const handleConfirm = useCallback(() => {
    const success = confirmPrescription();
    if (success) {
      setTimeout(() => {
        nextPrescription();
      }, 1000);
    }
  }, [confirmPrescription, nextPrescription]);

  const handleHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const hasAnyIncorrect = useMemo(() => {
    return checkResults.some(cr => 
      cr.dosage === 'incorrect' || 
      cr.contraindication === 'incorrect' || 
      cr.batch === 'incorrect'
    );
  }, [checkResults]);

  const prescriptionMedicineIds = useMemo(() => {
    return currentPrescription?.items.map(item => item.medicineId) || [];
  }, [currentPrescription]);

  if (!level) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-xl text-gray-600">关卡不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg"
          >
            返回菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PharmacyScene isPaused={status === 'paused'} />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="p-4">
          <ScoreBoard
            score={score}
            maxScore={level.maxScore}
            timeRemaining={timeRemaining}
            prescriptionTimeRemaining={prescriptionTimeRemaining}
            currentPrescription={currentPrescriptionIndex + 1}
            totalPrescriptions={currentPrescriptions.length}
            errorsCount={errors.length}
            status={status}
          />
        </div>

        <div className="flex-1 px-4 pb-4 flex gap-4 overflow-hidden">
          <div className="w-72 flex-shrink-0 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 overflow-y-auto">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-lg">💊</span>
              药品架
            </h3>
            <div className="space-y-3">
              {availableMedicineIds.map(medicineId => {
                const medicine = getMedicineById(medicineId);
                if (!medicine) return null;
                
                const isPlaced = placedMedicines.includes(medicineId);
                const isDragging = draggingMedicineId === medicineId;
                
                return (
                  <MedicineCard
                    key={medicineId}
                    medicine={medicine}
                    isDragging={isDragging}
                    isPlaced={isPlaced}
                    draggable={!isPlaced && status === 'playing'}
                    onDragStart={(e) => handleDragStart(e, medicineId)}
                    onDragEnd={handleDragEnd}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex-1 flex gap-4 min-h-0">
              <div className="flex-1 overflow-y-auto">
                <DispensingTable
                  placedMedicineIds={placedMedicines}
                  checkResults={checkResults}
                  onDrop={placeMedicine}
                  onRemove={removeMedicine}
                  onCheckDosage={checkDosage}
                  onCheckContraindication={checkContraindication}
                  onCheckBatch={checkBatch}
                  disabled={status !== 'playing'}
                  prescriptionMedicineIds={prescriptionMedicineIds}
                />
              </div>

              <div className="w-96 flex-shrink-0 overflow-y-auto">
                <PrescriptionPanel
                  prescription={currentPrescription}
                  isReading={status === 'reading'}
                  readingTimeRemaining={readingTimeRemaining}
                  currentIndex={currentPrescriptionIndex + 1}
                  totalCount={currentPrescriptions.length}
                />
              </div>
            </div>

            <GameControls
              status={status}
              isAllChecked={isAllChecked()}
              hasAnyIncorrect={hasAnyIncorrect}
              onStart={handleStart}
              onPause={pauseGame}
              onResume={resumeGame}
              onRestart={restartGame}
              onConfirm={handleConfirm}
              onHome={handleHome}
              readingTimeRemaining={readingTimeRemaining}
            />
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <AnimatePresence>
        {status === 'paused' && (
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
              <h2 className="text-3xl font-bold text-gray-900 mb-4">游戏暂停</h2>
              <p className="text-gray-600 mb-8">点击继续按钮恢复游戏</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleHome}
                  className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  返回菜单
                </button>
                <button
                  onClick={resumeGame}
                  className="px-6 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors"
                >
                  继续游戏
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Game;
