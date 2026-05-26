import { create } from 'zustand';
import type {
  GameState,
  GameError,
  GameAction,
  MedicineCheckResult,
  Prescription,
  GameErrorType,
  CheckType,
  GameRecord,
  PrescriptionResult,
  ScoreDetail
} from '@/types';
import { getLevelById, generatePrescriptionsForLevel } from '@/data/levels';
import { prescriptions as allPrescriptions } from '@/data/prescriptions';
import { getPointsByErrorType, getErrorDescription, calculateStarRating, getBonusPoints } from '@/data/scoring';
import { getMedicineById } from '@/data/medicines';
import { saveGameRecord, saveHighScore, getHighScore } from '@/utils/storage';

interface GameStore extends GameState {
  currentPrescriptions: Prescription[];
  toasts: any[];
  gameStartTime: number | null;
  prescriptionStartTime: number | null;
  lastActionMedicineId: string | null;
  actionCount: Record<string, number>;
  prescriptionHasError: boolean;
  playerDecision: 'confirm' | 'reject' | null;
  
  initGame: (levelId: string) => void;
  startReading: () => void;
  startPlaying: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  finishGame: () => void;
  
  tickReading: () => void;
  tickTime: () => void;
  
  placeMedicine: (medicineId: string) => void;
  removeMedicine: (medicineId: string) => void;
  
  checkDosage: (medicineId: string) => void;
  checkContraindication: (medicineId: string) => void;
  checkBatch: (medicineId: string) => void;
  
  updateCheckResult: (medicineId: string, checkType: CheckType, result: 'correct' | 'incorrect') => void;
  
  confirmPrescription: () => void;
  rejectPrescription: () => void;
  nextPrescription: () => void;
  
  addError: (errorType: GameErrorType, description: string, correctAnswer: string, medicineId?: string, prescriptionId?: string) => void;
  addAction: (type: GameAction['type'], payload?: GameAction['payload']) => void;
  addToast: (toast: Omit<any, 'id'>) => void;
  removeToast: (id: string) => void;
  
  getCurrentPrescription: () => Prescription | null;
  getCheckResult: (medicineId: string) => MedicineCheckResult | undefined;
  isAllChecked: () => boolean;
  getAvailableMedicines: () => string[];
  checkPrescriptionHasError: () => boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  levelId: '',
  currentPrescriptionIndex: 0,
  score: 0,
  timeRemaining: 0,
  prescriptionTimeRemaining: 0,
  readingTimeRemaining: 0,
  errors: [],
  actions: [],
  placedMedicines: [],
  checkResults: [],
  currentGameId: null,
  currentPrescriptions: [],
  toasts: [],
  gameStartTime: null,
  prescriptionStartTime: null,
  lastActionMedicineId: null,
  actionCount: {},
  prescriptionHasError: false,
  playerDecision: null,

  initGame: (levelId: string) => {
    const level = getLevelById(levelId);
    if (!level) return;
    
    const generatedPrescriptions = generatePrescriptionsForLevel(levelId, allPrescriptions);
    
    set({
      status: 'idle',
      levelId,
      currentPrescriptionIndex: 0,
      score: 0,
      timeRemaining: level.timeLimit,
      prescriptionTimeRemaining: level.prescriptionTimeLimit,
      readingTimeRemaining: level.readingTimeLimit,
      errors: [],
      actions: [],
      placedMedicines: [],
      checkResults: [],
      currentGameId: generateId(),
      currentPrescriptions: generatedPrescriptions,
      gameStartTime: null,
      prescriptionStartTime: null,
      lastActionMedicineId: null,
      actionCount: {},
      toasts: [],
      prescriptionHasError: false,
      playerDecision: null
    });
  },

  startReading: () => {
    const state = get();
    const level = getLevelById(state.levelId);
    if (!level) return;
    
    const currentPrescription = state.currentPrescriptions[state.currentPrescriptionIndex];
    const hasError = currentPrescription?.items.some(item => 
      item.hasDosageError || item.hasContraindication || item.hasBatchError
    ) || false;
    
    set({
      status: 'reading',
      readingTimeRemaining: level.readingTimeLimit,
      prescriptionHasError: hasError,
      playerDecision: null
    });
    get().addAction('drag_start', { details: '开始阅读处方' });
  },

  startPlaying: () => {
    const state = get();
    set({
      status: 'playing',
      gameStartTime: Date.now(),
      prescriptionStartTime: Date.now()
    });
    get().addAction('drag_start', { details: '开始配药' });
  },

  pauseGame: () => {
    if (get().status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    if (get().status === 'paused') {
      set({ status: 'playing' });
    }
  },

  restartGame: () => {
    const { levelId } = get();
    get().initGame(levelId);
  },

  finishGame: () => {
    const state = get();
    const level = getLevelById(state.levelId);
    if (!level) return;
    
    const endTime = Date.now();
    const totalTime = state.gameStartTime ? Math.round((endTime - state.gameStartTime) / 1000) : 0;
    const starRating = calculateStarRating(state.score, level.maxScore);
    const totalChecks = state.checkResults.length * 3;
    const correctChecks = state.checkResults.reduce((acc, cr) => {
      return acc + 
        (cr.dosage === 'correct' ? 1 : 0) +
        (cr.contraindication === 'correct' ? 1 : 0) +
        (cr.batch === 'correct' ? 1 : 0);
    }, 0);
    const accuracy = totalChecks > 0 ? Math.round((correctChecks / totalChecks) * 100) : 0;
    
    const prescriptionResults: PrescriptionResult[] = state.currentPrescriptions.map(prescription => {
      const prescriptionErrors = state.errors.filter(e => e.prescriptionId === prescription.id);
      const hasError = prescription.items.some(item => 
        item.hasDosageError || item.hasContraindication || item.hasBatchError
      );
      const hasCorrectReject = prescriptionErrors.some(e => e.type === 'correct_reject');
      const hasWrongReject = prescriptionErrors.some(e => e.type === 'wrong_reject');
      const hasUnintercepted = prescriptionErrors.some(e => e.type === 'contraindication');
      
      let isCorrect = false;
      if (hasError && hasCorrectReject) {
        isCorrect = true;
      } else if (!hasError && !hasWrongReject && !hasUnintercepted) {
        isCorrect = true;
      }
      
      return {
        prescriptionId: prescription.id,
        score: isCorrect ? 100 : 50,
        isCorrect,
        errors: prescriptionErrors
      };
    });
    
    const scoreDetails: ScoreDetail[] = [];
    
    state.currentPrescriptions.forEach(prescription => {
      scoreDetails.push({
        action: 'prescription_processing',
        description: `处理处方: ${prescription.patientName}`,
        points: 50,
        type: 'bonus',
        prescriptionId: prescription.id
      });
      
      prescription.items.forEach(item => {
        scoreDetails.push({
          action: 'dosage_check',
          description: `${item.medicineName} 剂量核对完成`,
          points: 20,
          type: 'bonus',
          prescriptionId: prescription.id,
          medicineId: item.medicineId
        });
        
        scoreDetails.push({
          action: 'contraindication_check',
          description: `${item.medicineName} 禁忌核对完成`,
          points: 20,
          type: 'bonus',
          prescriptionId: prescription.id,
          medicineId: item.medicineId
        });
        
        scoreDetails.push({
          action: 'batch_check',
          description: `${item.medicineName} 批号核对完成`,
          points: 20,
          type: 'bonus',
          prescriptionId: prescription.id,
          medicineId: item.medicineId
        });
      });
    });
    
    state.errors.forEach(error => {
      scoreDetails.push({
        action: error.type,
        description: error.description,
        points: -error.penalty,
        type: 'penalty',
        prescriptionId: error.prescriptionId,
        medicineId: error.medicineId
      });
    });
    
    const timeBonus = state.timeRemaining * 5;
    if (timeBonus > 0) {
      scoreDetails.push({
        action: 'time_bonus',
        description: `提前完成奖励 (剩余${state.timeRemaining}秒)`,
        points: timeBonus,
        type: 'bonus'
      });
    }
    
    const gameRecord: GameRecord = {
      id: state.currentGameId || generateId(),
      levelId: state.levelId,
      levelName: level.name,
      startTime: state.gameStartTime || endTime,
      endTime,
      totalTime,
      score: state.score,
      maxScore: level.maxScore,
      starRating,
      prescriptions: state.currentPrescriptions,
      errors: state.errors,
      actions: state.actions,
      accuracy,
      prescriptionResults,
      scoreDetails
    };
    
    saveGameRecord(gameRecord);
    
    const currentHighScore = getHighScore(state.levelId);
    if (state.score > currentHighScore) {
      saveHighScore(state.levelId, state.score);
    }
    
    set({ status: 'finished' });
    get().addAction('confirm', { details: '游戏结束' });
  },

  tickReading: () => {
    const state = get();
    if (state.status !== 'reading') return;
    
    if (state.readingTimeRemaining <= 1) {
      get().startPlaying();
    } else {
      set({ readingTimeRemaining: state.readingTimeRemaining - 1 });
    }
  },

  tickTime: () => {
    const state = get();
    if (state.status !== 'playing') return;
    
    if (state.timeRemaining <= 1) {
      get().addError('timeout', '总时间已用完', '请加快配药速度');
      get().finishGame();
      return;
    }
    
    if (state.prescriptionTimeRemaining <= 1) {
      get().addError('timeout', '单张处方配药超时', '请提高核对效率');
      get().nextPrescription();
      return;
    }
    
    set({
      timeRemaining: state.timeRemaining - 1,
      prescriptionTimeRemaining: state.prescriptionTimeRemaining - 1
    });
  },

  placeMedicine: (medicineId: string) => {
    const state = get();
    if (state.status !== 'playing') return;
    if (state.placedMedicines.includes(medicineId)) return;
    
    const actionKey = `place_${medicineId}`;
    const count = state.actionCount[actionKey] || 0;
    
    if (state.lastActionMedicineId === medicineId) {
      get().addError('repeated_operation', '重复操作同一种药品', '请一次性完成药品选择');
    }
    
    set({
      placedMedicines: [...state.placedMedicines, medicineId],
      checkResults: [
        ...state.checkResults,
        {
          medicineId,
          dosage: 'pending',
          contraindication: 'pending',
          batch: 'pending'
        }
      ],
      lastActionMedicineId: medicineId,
      actionCount: {
        ...state.actionCount,
        [actionKey]: count + 1
      }
    });
    
    get().addAction('place', { medicineId });
  },

  removeMedicine: (medicineId: string) => {
    const state = get();
    if (state.status !== 'playing') return;
    
    set({
      placedMedicines: state.placedMedicines.filter(id => id !== medicineId),
      checkResults: state.checkResults.filter(cr => cr.medicineId !== medicineId),
      lastActionMedicineId: medicineId
    });
    
    get().addAction('remove', { medicineId });
  },

  checkDosage: (medicineId: string) => {
    const state = get();
    const prescription = get().getCurrentPrescription();
    if (!prescription) return;
    
    const prescriptionItem = prescription.items.find(item => item.medicineId === medicineId);
    const medicine = getMedicineById(medicineId);
    
    if (!prescriptionItem || !medicine) {
      get().addToast({
        type: 'warning',
        title: '药品不在处方中',
        message: '请选择处方中的药品进行核对',
        duration: 2000
      });
      return;
    }
    
    const hasDosageError = prescriptionItem.hasDosageError;
    
    if (hasDosageError) {
      get().addToast({
        type: 'warning',
        title: '发现剂量问题！',
        message: `处方剂量${prescriptionItem.dosage}${prescriptionItem.unit}存在问题，请在下方选择"拒绝配药"`,
        duration: 3000
      });
      get().updateCheckResult(medicineId, 'dosage', 'incorrect');
    } else {
      get().addToast({
        type: 'success',
        title: '剂量核对通过',
        message: `${medicine.name} 剂量${prescriptionItem.dosage}${prescriptionItem.unit}正确`,
        duration: 2000
      });
      get().updateCheckResult(medicineId, 'dosage', 'correct');
      set({ score: state.score + getBonusPoints('dosage_check_correct') });
    }
    
    get().addAction('check', { medicineId, checkType: 'dosage', isCorrect: !hasDosageError });
  },

  checkContraindication: (medicineId: string) => {
    const state = get();
    const prescription = get().getCurrentPrescription();
    const medicine = getMedicineById(medicineId);
    if (!prescription || !medicine) return;
    
    const prescriptionItem = prescription.items.find(item => item.medicineId === medicineId);
    if (!prescriptionItem) return;
    
    const hasAllergy = prescription.allergies.some(allergy => 
      medicine.contraindications.some(c => c.includes(allergy))
    );
    const hasContraindication = prescriptionItem.hasContraindication || hasAllergy;
    
    if (hasContraindication) {
      get().addToast({
        type: 'warning',
        title: '发现禁忌问题！',
        message: `${medicine.name}存在配伍禁忌或与患者情况冲突，请在下方选择"拒绝配药"`,
        duration: 3000
      });
      get().updateCheckResult(medicineId, 'contraindication', 'incorrect');
    } else {
      get().addToast({
        type: 'success',
        title: '禁忌核对通过',
        message: `${medicine.name} 无配伍禁忌`,
        duration: 2000
      });
      get().updateCheckResult(medicineId, 'contraindication', 'correct');
      set({ score: state.score + getBonusPoints('contraindication_check_correct') });
    }
    
    get().addAction('check', { medicineId, checkType: 'contraindication', isCorrect: !hasContraindication });
  },

  checkBatch: (medicineId: string) => {
    const state = get();
    const prescription = get().getCurrentPrescription();
    const medicine = getMedicineById(medicineId);
    if (!prescription || !medicine) return;
    
    const prescriptionItem = prescription.items.find(item => item.medicineId === medicineId);
    if (!prescriptionItem) return;
    
    const today = new Date('2026-05-26');
    const expiryDate = new Date(medicine.expiryDate);
    const isExpired = expiryDate < today || prescriptionItem.hasBatchError;
    
    if (isExpired) {
      get().addToast({
        type: 'warning',
        title: '发现批号问题！',
        message: `${medicine.name} 批号 ${medicine.batchNumber} 有效期至 ${medicine.expiryDate}，已过期或存在问题，请在下方选择"拒绝配药"`,
        duration: 3000
      });
      get().updateCheckResult(medicineId, 'batch', 'incorrect');
    } else {
      get().addToast({
        type: 'success',
        title: '批号核对通过',
        message: `${medicine.name} 批号在有效期内`,
        duration: 2000
      });
      get().updateCheckResult(medicineId, 'batch', 'correct');
      set({ score: state.score + getBonusPoints('batch_check_correct') });
    }
    
    get().addAction('check', { medicineId, checkType: 'batch', isCorrect: !isExpired });
  },

  updateCheckResult: (medicineId: string, checkType: CheckType, result: 'correct' | 'incorrect') => {
    set(state => ({
      checkResults: state.checkResults.map(cr =>
        cr.medicineId === medicineId
          ? { ...cr, [checkType]: result }
          : cr
      )
    }));
  },

  confirmPrescription: () => {
    const state = get();
    if (state.status !== 'playing') return;
    
    if (!get().isAllChecked()) {
      get().addToast({
        type: 'warning',
        title: '请完成所有核对',
        message: '请完成剂量、禁忌、批号三项核对后再决策',
        duration: 3000
      });
      return;
    }
    
    const hasError = state.prescriptionHasError;
    const currentPrescription = get().getCurrentPrescription();
    
    if (hasError) {
      get().addError('contraindication',
        `处方存在错误但未拦截：${currentPrescription?.patientName}的处方有剂量/禁忌/批号问题`,
        '应选择"拒绝配药"并联系医生确认',
        '',
        currentPrescription?.id
      );
      
      get().addToast({
        type: 'error',
        title: '错误：未拦截问题处方',
        message: '处方存在错误，但您选择了确认配药，应选择"拒绝配药"',
        duration: 4000
      });
    } else {
      const level = getLevelById(state.levelId);
      const timeBonus = state.prescriptionTimeRemaining * getBonusPoints('early_completion');
      const baseBonus = getBonusPoints('correct_dispensing');
      
      set({
        score: state.score + baseBonus + timeBonus
      });
      
      get().addToast({
        type: 'success',
        title: '配药完成',
        message: `处方正确！得分 +${baseBonus + timeBonus}（含提前完成奖励 +${timeBonus}）`,
        duration: 3000
      });
    }
    
    set({ playerDecision: 'confirm' });
    get().addAction('confirm', { details: hasError ? '错误：确认了有问题的处方' : '正确：确认无误的处方' });
    
    setTimeout(() => {
      get().nextPrescription();
    }, 1500);
  },

  rejectPrescription: () => {
    const state = get();
    if (state.status !== 'playing') return;
    
    if (!get().isAllChecked()) {
      get().addToast({
        type: 'warning',
        title: '请完成所有核对',
        message: '请完成剂量、禁忌、批号三项核对后再决策',
        duration: 3000
      });
      return;
    }
    
    const hasError = state.prescriptionHasError;
    const currentPrescription = get().getCurrentPrescription();
    
    if (hasError) {
      const rejectBonus = 80;
      
      get().addError('correct_reject',
        `正确拦截问题处方：${currentPrescription?.patientName}的处方存在错误`,
        '已正确识别并拦截问题处方',
        '',
        currentPrescription?.id
      );
      
      set({
        score: state.score + rejectBonus
      });
      
      get().addToast({
        type: 'success',
        title: '正确拦截问题处方！',
        message: `您正确识别了处方中的问题，得分 +${rejectBonus}`,
        duration: 3000
      });
    } else {
      get().addError('wrong_reject',
        `误判：${currentPrescription?.patientName}的处方没有错误`,
        '不应拒绝配药，处方是正确的',
        '',
        currentPrescription?.id
      );
      
      get().addToast({
        type: 'error',
        title: '错误：误判了正常处方',
        message: '处方没有错误，但您选择了拒绝配药，应选择"确认配药"',
        duration: 4000
      });
    }
    
    set({ playerDecision: 'reject' });
    get().addAction('confirm', { details: hasError ? '正确：拦截了问题处方' : '错误：拒绝了正常处方' });
    
    setTimeout(() => {
      get().nextPrescription();
    }, 1500);
  },

  nextPrescription: () => {
    const state = get();
    const level = getLevelById(state.levelId);
    if (!level) return;
    
    if (state.currentPrescriptionIndex >= state.currentPrescriptions.length - 1) {
      get().finishGame();
      return;
    }
    
    const nextIndex = state.currentPrescriptionIndex + 1;
    const nextPrescription = state.currentPrescriptions[nextIndex];
    const hasError = nextPrescription?.items.some(item => 
      item.hasDosageError || item.hasContraindication || item.hasBatchError
    ) || false;
    
    set({
      currentPrescriptionIndex: nextIndex,
      prescriptionTimeRemaining: level.prescriptionTimeLimit,
      placedMedicines: [],
      checkResults: [],
      prescriptionStartTime: Date.now(),
      lastActionMedicineId: null,
      prescriptionHasError: hasError,
      playerDecision: null
    });
    
    get().addAction('check', { details: '进入下一张处方' });
  },

  addError: (errorType: GameErrorType, description: string, correctAnswer: string, medicineId = '', prescriptionId = '') => {
    const state = get();
    const pointsDeducted = Math.abs(getPointsByErrorType(errorType));
    
    const currentPrescription = get().getCurrentPrescription();
    const actualPrescriptionId = prescriptionId || currentPrescription?.id || '';
    
    const error: GameError = {
      id: generateId(),
      type: errorType,
      severity: errorType === 'contraindication' || errorType === 'batch_expired' || errorType === 'wrong_medicine' 
        ? 'critical' 
        : errorType === 'drug_interaction' || errorType === 'dosage_amount' 
          ? 'major' 
          : 'minor',
      description,
      correctAnswer,
      pointsDeducted,
      timestamp: Date.now(),
      medicineId,
      prescriptionId: actualPrescriptionId,
      message: description,
      penalty: pointsDeducted
    };
    
    set({
      errors: [...state.errors, error],
      score: Math.max(0, state.score - pointsDeducted)
    });
    
    get().addToast({
      type: error.severity === 'critical' ? 'error' : error.severity === 'major' ? 'warning' : 'warning',
      title: getErrorDescription(errorType),
      message: `${description}（-${pointsDeducted}分）`,
      duration: 4000
    });
  },

  addAction: (type: GameAction['type'], payload: GameAction['payload'] = {}) => {
    set(state => ({
      actions: [...state.actions, {
        timestamp: Date.now(),
        type,
        payload
      }]
    }));
  },

  addToast: (toast: Omit<any, 'id'>) => {
    const id = generateId();
    set(state => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));
    
    setTimeout(() => {
      get().removeToast(id);
    }, toast.duration || 3000);
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  getCurrentPrescription: () => {
    const state = get();
    return state.currentPrescriptions[state.currentPrescriptionIndex] || null;
  },

  getCheckResult: (medicineId: string) => {
    return get().checkResults.find(cr => cr.medicineId === medicineId);
  },

  isAllChecked: () => {
    const state = get();
    if (state.checkResults.length === 0) return false;
    
    return state.checkResults.every(cr =>
      cr.dosage !== 'pending' &&
      cr.contraindication !== 'pending' &&
      cr.batch !== 'pending'
    );
  },

  getAvailableMedicines: () => {
    const prescription = get().getCurrentPrescription();
    if (!prescription) return [];
    
    const prescriptionMedicineIds = prescription.items.map(item => item.medicineId);
    const allMedicineIds = allPrescriptions.flatMap(p => p.items.map(i => i.medicineId));
    const uniqueMedicineIds = [...new Set(allMedicineIds)];
    
    const extraMedicines = uniqueMedicineIds
      .filter(id => !prescriptionMedicineIds.includes(id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    
    return [...prescriptionMedicineIds, ...extraMedicines].sort(() => Math.random() - 0.5);
  },

  checkPrescriptionHasError: () => {
    return get().prescriptionHasError;
  }
}));