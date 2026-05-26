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
  
  checkDosage: (medicineId: string) => boolean;
  checkContraindication: (medicineId: string) => boolean;
  checkBatch: (medicineId: string) => boolean;
  
  updateCheckResult: (medicineId: string, checkType: CheckType, result: 'correct' | 'incorrect') => void;
  
  confirmPrescription: () => boolean;
  nextPrescription: () => void;
  
  addError: (errorType: GameErrorType, description: string, correctAnswer: string, medicineId?: string, prescriptionId?: string) => void;
  addAction: (type: GameAction['type'], payload?: GameAction['payload']) => void;
  addToast: (toast: Omit<any, 'id'>) => void;
  removeToast: (id: string) => void;
  
  getCurrentPrescription: () => Prescription | null;
  getCheckResult: (medicineId: string) => MedicineCheckResult | undefined;
  isAllChecked: () => boolean;
  getAvailableMedicines: () => string[];
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
      toasts: []
    });
  },

  startReading: () => {
    const state = get();
    const level = getLevelById(state.levelId);
    if (!level) return;
    
    set({
      status: 'reading',
      readingTimeRemaining: level.readingTimeLimit
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
      const isCorrect = prescriptionErrors.length === 0;
      const score = isCorrect ? 100 - prescriptionErrors.reduce((sum, e) => sum + e.penalty, 0) : 0;
      
      return {
        prescriptionId: prescription.id,
        score: Math.max(0, score),
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
          action: 'dosage_check_correct',
          description: `${item.medicineName} 剂量核对正确`,
          points: 20,
          type: 'bonus',
          prescriptionId: prescription.id,
          medicineId: item.medicineId
        });
        
        scoreDetails.push({
          action: 'contraindication_check_correct',
          description: `${item.medicineName} 禁忌核对正确`,
          points: 20,
          type: 'bonus',
          prescriptionId: prescription.id,
          medicineId: item.medicineId
        });
        
        scoreDetails.push({
          action: 'batch_check_correct',
          description: `${item.medicineName} 批号核对正确`,
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
    if (!prescription) return false;
    
    const prescriptionItem = prescription.items.find(item => item.medicineId === medicineId);
    const medicine = getMedicineById(medicineId);
    
    if (!prescriptionItem || !medicine) {
      get().addError('wrong_medicine', '所选药品与处方不符', `请选择处方中的药品`);
      get().updateCheckResult(medicineId, 'dosage', 'incorrect');
      get().addAction('check', { medicineId, checkType: 'dosage', isCorrect: false });
      return false;
    }
    
    const isUnitCorrect = prescriptionItem.unit === medicine.unit;
    const isDosageCorrect = !prescriptionItem.hasDosageError;
    
    if (!isUnitCorrect) {
      get().addError('dosage_unit', 
        `剂量单位错误：处方要求${prescriptionItem.unit}，药品规格为${medicine.unit}`,
        `正确单位应为${medicine.unit}`);
      get().updateCheckResult(medicineId, 'dosage', 'incorrect');
      get().addAction('error', { medicineId, checkType: 'dosage', errorType: 'dosage_unit' });
      return false;
    }
    
    if (!isDosageCorrect) {
      get().addError('dosage_amount',
        `剂量数值错误：处方剂量${prescriptionItem.dosage}${prescriptionItem.unit}有误`,
        `请核对原始处方确认正确剂量`);
      get().updateCheckResult(medicineId, 'dosage', 'incorrect');
      get().addAction('error', { medicineId, checkType: 'dosage', errorType: 'dosage_amount' });
      return false;
    }
    
    get().updateCheckResult(medicineId, 'dosage', 'correct');
    set({ score: state.score + getBonusPoints('dosage_check_correct') });
    get().addAction('correct', { medicineId, checkType: 'dosage', isCorrect: true });
    get().addToast({
      type: 'success',
      title: '剂量核对正确',
      message: `${medicine.name} 剂量核对通过`,
      duration: 2000
    });
    return true;
  },

  checkContraindication: (medicineId: string) => {
    const state = get();
    const prescription = get().getCurrentPrescription();
    const medicine = getMedicineById(medicineId);
    if (!prescription || !medicine) return false;
    
    const prescriptionItem = prescription.items.find(item => item.medicineId === medicineId);
    if (!prescriptionItem) {
      get().addError('wrong_medicine', '所选药品与处方不符', '请选择处方中的药品');
      get().updateCheckResult(medicineId, 'contraindication', 'incorrect');
      return false;
    }
    
    const hasAllergy = prescription.allergies.some(allergy => 
      medicine.contraindications.some(c => c.includes(allergy))
    );
    
    const hasContraindication = prescriptionItem.hasContraindication || hasAllergy;
    
    if (hasContraindication) {
      const contraindicationText = hasAllergy 
        ? `患者过敏史与${medicine.name}禁忌冲突`
        : `${medicine.name}存在配伍禁忌或患者情况不适用`;
      
      get().addError('contraindication',
        `禁忌未拦截：${contraindicationText}`,
        `应拦截该药品并联系医生确认`);
      get().updateCheckResult(medicineId, 'contraindication', 'incorrect');
      get().addAction('error', { medicineId, checkType: 'contraindication', errorType: 'contraindication' });
      return false;
    }
    
    if (prescription.items.length > 1) {
      for (const otherItem of prescription.items) {
        if (otherItem.medicineId === medicineId) continue;
        const otherMedicine = getMedicineById(otherItem.medicineId);
        if (otherMedicine) {
          const hasInteraction = medicine.drugInteractions.some(di => 
            di.includes(otherMedicine.name) || di.includes(otherMedicine.genericName)
          );
          if (hasInteraction) {
            get().addError('drug_interaction',
              `药物相互作用：${medicine.name} 与 ${otherMedicine.name} 存在相互作用`,
              `应调整用药方案或密切监测`);
            get().updateCheckResult(medicineId, 'contraindication', 'incorrect');
            get().addAction('error', { medicineId, checkType: 'contraindication', errorType: 'drug_interaction' });
            return false;
          }
        }
      }
    }
    
    get().updateCheckResult(medicineId, 'contraindication', 'correct');
    set({ score: state.score + getBonusPoints('contraindication_check_correct') });
    get().addAction('correct', { medicineId, checkType: 'contraindication', isCorrect: true });
    get().addToast({
      type: 'success',
      title: '禁忌核对正确',
      message: `${medicine.name} 无配伍禁忌`,
      duration: 2000
    });
    return true;
  },

  checkBatch: (medicineId: string) => {
    const state = get();
    const prescription = get().getCurrentPrescription();
    const medicine = getMedicineById(medicineId);
    if (!prescription || !medicine) return false;
    
    const prescriptionItem = prescription.items.find(item => item.medicineId === medicineId);
    if (!prescriptionItem) {
      get().addError('wrong_medicine', '所选药品与处方不符', '请选择处方中的药品');
      get().updateCheckResult(medicineId, 'batch', 'incorrect');
      return false;
    }
    
    const today = new Date('2026-05-26');
    const expiryDate = new Date(medicine.expiryDate);
    const isExpired = expiryDate < today || prescriptionItem.hasBatchError;
    
    if (isExpired) {
      get().addError('batch_expired',
        `批号过期：${medicine.name} 批号 ${medicine.batchNumber} 有效期至 ${medicine.expiryDate}`,
        `应选择有效期内的药品`);
      get().updateCheckResult(medicineId, 'batch', 'incorrect');
      get().addAction('error', { medicineId, checkType: 'batch', errorType: 'batch_expired' });
      return false;
    }
    
    get().updateCheckResult(medicineId, 'batch', 'correct');
    set({ score: state.score + getBonusPoints('batch_check_correct') });
    get().addAction('correct', { medicineId, checkType: 'batch', isCorrect: true });
    get().addToast({
      type: 'success',
      title: '批号核对正确',
      message: `${medicine.name} 批号在有效期内`,
      duration: 2000
    });
    return true;
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
    if (state.status !== 'playing') return false;
    
    const prescription = get().getCurrentPrescription();
    if (!prescription) return false;
    
    if (!get().isAllChecked()) {
      get().addError('unchecked_confirm',
        '未完成全部核对就确认',
        '请完成剂量、禁忌、批号三项核对后再确认');
      return false;
    }
    
    const allCorrect = state.checkResults.every(cr =>
      cr.dosage === 'correct' &&
      cr.contraindication === 'correct' &&
      cr.batch === 'correct'
    );
    
    const correctItems = state.checkResults.filter(cr =>
      cr.dosage === 'correct' &&
      cr.contraindication === 'correct' &&
      cr.batch === 'correct'
    ).length;
    
    if (allCorrect) {
      const level = getLevelById(state.levelId);
      const timeBonus = state.prescriptionTimeRemaining * getBonusPoints('early_completion');
      const baseBonus = getBonusPoints('correct_dispensing');
      
      set({
        score: state.score + baseBonus + timeBonus
      });
      
      get().addToast({
        type: 'success',
        title: '配药完成',
        message: `本处方得分 +${baseBonus + timeBonus}（含提前完成奖励 +${timeBonus}）`,
        duration: 3000
      });
      
      get().addAction('confirm', {
        details: `处方配药完成，正确${correctItems}项，时间奖励${timeBonus}分`
      });
      
      return true;
    }
    
    return false;
  },

  nextPrescription: () => {
    const state = get();
    const level = getLevelById(state.levelId);
    if (!level) return;
    
    if (state.currentPrescriptionIndex >= state.currentPrescriptions.length - 1) {
      get().finishGame();
      return;
    }
    
    set({
      currentPrescriptionIndex: state.currentPrescriptionIndex + 1,
      prescriptionTimeRemaining: level.prescriptionTimeLimit,
      placedMedicines: [],
      checkResults: [],
      prescriptionStartTime: Date.now(),
      lastActionMedicineId: null
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
  }
}));
