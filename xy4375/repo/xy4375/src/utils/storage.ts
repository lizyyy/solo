import {
  Prescription,
  HerbBatch,
  DecoctionPot,
  DecoctionSchedule,
  PickupTimeSlot,
  RiskEvent,
  ReviewLog,
  AuditTrail,
  DailyWorkSession,
} from '../types';

const STORAGE_PREFIX = 'herb_decoction_review_';

const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getStorageKey = (key: string): string => {
  return `${STORAGE_PREFIX}${key}`;
};

const saveToStorage = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(data));
  } catch (error) {
    console.error(`保存数据失败 [${key}]:`, error);
    throw new Error('本地存储容量不足，请清理部分数据');
  }
};

const loadFromStorage = <T>(key: string, defaultValue: T[] = []): T[] => {
  try {
    const stored = localStorage.getItem(getStorageKey(key));
    if (stored) {
      return JSON.parse(stored) as T[];
    }
    return defaultValue;
  } catch (error) {
    console.error(`读取数据失败 [${key}]:`, error);
    return defaultValue;
  }
};

export const savePrescriptions = (prescriptions: Prescription[]): void => {
  saveToStorage('prescriptions', prescriptions);
};

export const loadPrescriptions = (): Prescription[] => {
  return loadFromStorage<Prescription>('prescriptions');
};

export const getPrescription = (id: string): Prescription | undefined => {
  const prescriptions = loadPrescriptions();
  return prescriptions.find(p => p.id === id || p.prescriptionNo === id);
};

export const addPrescription = (prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>): Prescription => {
  const prescriptions = loadPrescriptions();
  const newPrescription: Prescription = {
    ...prescription,
    id: `pres_${generateId()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  prescriptions.push(newPrescription);
  savePrescriptions(prescriptions);
  addAuditTrail({
    entityType: 'prescription',
    entityId: newPrescription.id,
    action: 'create',
    details: `新增处方: ${newPrescription.prescriptionNo}`,
  });
  return newPrescription;
};

export const updatePrescription = (id: string, updates: Partial<Prescription>): Prescription => {
  const prescriptions = loadPrescriptions();
  const index = prescriptions.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error(`处方不存在: ${id}`);
  }
  const previousValue = JSON.stringify(prescriptions[index]);
  prescriptions[index] = {
    ...prescriptions[index],
    ...updates,
    updatedAt: Date.now(),
  };
  savePrescriptions(prescriptions);
  addAuditTrail({
    entityType: 'prescription',
    entityId: id,
    action: 'update',
    previousValue,
    newValue: JSON.stringify(prescriptions[index]),
    details: `更新处方: ${prescriptions[index].prescriptionNo}`,
  });
  return prescriptions[index];
};

export const deletePrescription = (id: string): void => {
  const prescriptions = loadPrescriptions();
  const prescription = prescriptions.find(p => p.id === id);
  if (!prescription) return;
  
  const filtered = prescriptions.filter(p => p.id !== id);
  savePrescriptions(filtered);
  addAuditTrail({
    entityType: 'prescription',
    entityId: id,
    action: 'delete',
    details: `删除处方: ${prescription.prescriptionNo}`,
  });
};

export const saveHerbBatches = (batches: HerbBatch[]): void => {
  saveToStorage('herbBatches', batches);
};

export const loadHerbBatches = (): HerbBatch[] => {
  return loadFromStorage<HerbBatch>('herbBatches');
};

export const getHerbBatch = (id: string): HerbBatch | undefined => {
  const batches = loadHerbBatches();
  return batches.find(b => b.id === id || b.batchNo === id);
};

export const addHerbBatch = (batch: Omit<HerbBatch, 'id' | 'createdAt'>): HerbBatch => {
  const batches = loadHerbBatches();
  const newBatch: HerbBatch = {
    ...batch,
    id: `batch_${generateId()}`,
    createdAt: Date.now(),
  };
  batches.push(newBatch);
  saveHerbBatches(batches);
  addAuditTrail({
    entityType: 'batch',
    entityId: newBatch.id,
    action: 'create',
    details: `新增药材批次: ${newBatch.herbName} - ${newBatch.batchNo}`,
  });
  return newBatch;
};

export const updateHerbBatch = (id: string, updates: Partial<HerbBatch>): HerbBatch => {
  const batches = loadHerbBatches();
  const index = batches.findIndex(b => b.id === id);
  if (index === -1) {
    throw new Error(`批次不存在: ${id}`);
  }
  const previousValue = JSON.stringify(batches[index]);
  batches[index] = {
    ...batches[index],
    ...updates,
  };
  saveHerbBatches(batches);
  addAuditTrail({
    entityType: 'batch',
    entityId: id,
    action: 'update',
    previousValue,
    newValue: JSON.stringify(batches[index]),
    details: `更新药材批次: ${batches[index].herbName} - ${batches[index].batchNo}`,
  });
  return batches[index];
};

export const deleteHerbBatch = (id: string): void => {
  const batches = loadHerbBatches();
  const batch = batches.find(b => b.id === id);
  if (!batch) return;
  
  const filtered = batches.filter(b => b.id !== id);
  saveHerbBatches(filtered);
  addAuditTrail({
    entityType: 'batch',
    entityId: id,
    action: 'delete',
    details: `删除药材批次: ${batch.herbName} - ${batch.batchNo}`,
  });
};

export const saveDecoctionPots = (pots: DecoctionPot[]): void => {
  saveToStorage('decoctionPots', pots);
};

export const loadDecoctionPots = (): DecoctionPot[] => {
  return loadFromStorage<DecoctionPot>('decoctionPots');
};

export const getDecoctionPot = (id: string): DecoctionPot | undefined => {
  const pots = loadDecoctionPots();
  return pots.find(p => p.id === id || p.potNo === id);
};

export const addDecoctionPot = (pot: Omit<DecoctionPot, 'id'>): DecoctionPot => {
  const pots = loadDecoctionPots();
  const newPot: DecoctionPot = {
    ...pot,
    id: `pot_${generateId()}`,
  };
  pots.push(newPot);
  saveDecoctionPots(pots);
  return newPot;
};

export const updateDecoctionPot = (id: string, updates: Partial<DecoctionPot>): DecoctionPot => {
  const pots = loadDecoctionPots();
  const index = pots.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error(`煎锅不存在: ${id}`);
  }
  pots[index] = {
    ...pots[index],
    ...updates,
  };
  saveDecoctionPots(pots);
  return pots[index];
};

export const saveDecoctionSchedules = (schedules: DecoctionSchedule[]): void => {
  saveToStorage('decoctionSchedules', schedules);
};

export const loadDecoctionSchedules = (): DecoctionSchedule[] => {
  return loadFromStorage<DecoctionSchedule>('decoctionSchedules');
};

export const getDecoctionSchedule = (id: string): DecoctionSchedule | undefined => {
  const schedules = loadDecoctionSchedules();
  return schedules.find(s => s.id === id);
};

export const addDecoctionSchedule = (
  schedule: Omit<DecoctionSchedule, 'id' | 'createdAt' | 'updatedAt'>
): DecoctionSchedule => {
  const schedules = loadDecoctionSchedules();
  const newSchedule: DecoctionSchedule = {
    ...schedule,
    id: `schedule_${generateId()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  schedules.push(newSchedule);
  saveDecoctionSchedules(schedules);
  addAuditTrail({
    entityType: 'schedule',
    entityId: newSchedule.id,
    action: 'create',
    details: `新增排程: ${newSchedule.potNo}-${newSchedule.sequence}`,
  });
  return newSchedule;
};

export const updateDecoctionSchedule = (
  id: string,
  updates: Partial<DecoctionSchedule>
): DecoctionSchedule => {
  const schedules = loadDecoctionSchedules();
  const index = schedules.findIndex(s => s.id === id);
  if (index === -1) {
    throw new Error(`排程不存在: ${id}`);
  }
  const previousValue = JSON.stringify(schedules[index]);
  schedules[index] = {
    ...schedules[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveDecoctionSchedules(schedules);
  addAuditTrail({
    entityType: 'schedule',
    entityId: id,
    action: 'update',
    previousValue,
    newValue: JSON.stringify(schedules[index]),
    details: `更新排程: ${schedules[index].potNo}-${schedules[index].sequence}`,
  });
  return schedules[index];
};

export const deleteDecoctionSchedule = (id: string): void => {
  const schedules = loadDecoctionSchedules();
  const schedule = schedules.find(s => s.id === id);
  if (!schedule) return;
  
  const filtered = schedules.filter(s => s.id !== id);
  saveDecoctionSchedules(filtered);
  addAuditTrail({
    entityType: 'schedule',
    entityId: id,
    action: 'delete',
    details: `删除排程: ${schedule.potNo}-${schedule.sequence}`,
  });
};

export const savePickupTimeSlots = (slots: PickupTimeSlot[]): void => {
  saveToStorage('pickupTimeSlots', slots);
};

export const loadPickupTimeSlots = (): PickupTimeSlot[] => {
  return loadFromStorage<PickupTimeSlot>('pickupTimeSlots');
};

export const addPickupTimeSlot = (slot: Omit<PickupTimeSlot, 'id'>): PickupTimeSlot => {
  const slots = loadPickupTimeSlots();
  const newSlot: PickupTimeSlot = {
    ...slot,
    id: `slot_${generateId()}`,
  };
  slots.push(newSlot);
  savePickupTimeSlots(slots);
  return newSlot;
};

export const saveRiskEvents = (risks: RiskEvent[]): void => {
  saveToStorage('riskEvents', risks);
};

export const loadRiskEvents = (): RiskEvent[] => {
  return loadFromStorage<RiskEvent>('riskEvents');
};

export const getRiskEvent = (id: string): RiskEvent | undefined => {
  const risks = loadRiskEvents();
  return risks.find(r => r.id === id);
};

export const addRiskEvents = (risks: RiskEvent[]): void => {
  const existingRisks = loadRiskEvents();
  const newRisks = [...existingRisks, ...risks];
  saveRiskEvents(newRisks);
};

export const updateRiskReview = (
  riskId: string,
  isReviewed: boolean,
  reviewResult: RiskEvent['reviewResult'],
  reviewNotes: string,
  reviewedBy: string
): RiskEvent => {
  const risks = loadRiskEvents();
  const index = risks.findIndex(r => r.id === riskId);
  if (index === -1) {
    throw new Error(`风险事件不存在: ${riskId}`);
  }
  
  const previousResult = risks[index].reviewResult;
  
  risks[index] = {
    ...risks[index],
    isReviewed,
    reviewResult,
    reviewNotes,
    reviewedBy,
    reviewedAt: Date.now(),
    originalRiskLevel: risks[index].originalRiskLevel || risks[index].severity,
  };
  
  saveRiskEvents(risks);
  
  addReviewLog({
    riskEventId: riskId,
    prescriptionId: risks[index].relatedPrescriptionId,
    scheduleId: risks[index].relatedScheduleId,
    reviewerName: reviewedBy,
    reviewResult: reviewResult!,
    previousResult,
    notes: reviewNotes,
  });
  
  addAuditTrail({
    entityType: 'risk',
    entityId: riskId,
    action: 'review',
    details: `复核风险: ${risks[index].title} - 结果: ${reviewResult}`,
  });
  
  return risks[index];
};

export const saveReviewLogs = (logs: ReviewLog[]): void => {
  saveToStorage('reviewLogs', logs);
};

export const loadReviewLogs = (): ReviewLog[] => {
  return loadFromStorage<ReviewLog>('reviewLogs');
};

export const addReviewLog = (log: Omit<ReviewLog, 'id' | 'createdAt'>): ReviewLog => {
  const logs = loadReviewLogs();
  const newLog: ReviewLog = {
    ...log,
    id: `review_${generateId()}`,
    createdAt: Date.now(),
  };
  logs.push(newLog);
  saveReviewLogs(logs);
  return newLog;
};

export const saveAuditTrails = (trails: AuditTrail[]): void => {
  saveToStorage('auditTrails', trails);
};

export const loadAuditTrails = (): AuditTrail[] => {
  return loadFromStorage<AuditTrail>('auditTrails');
};

export const addAuditTrail = (
  trail: Omit<AuditTrail, 'id' | 'timestamp' | 'operatorName'> & { operatorName?: string }
): AuditTrail => {
  const trails = loadAuditTrails();
  const session = getCurrentSession();
  const newTrail: AuditTrail = {
    ...trail,
    id: `audit_${generateId()}`,
    timestamp: Date.now(),
    operatorName: trail.operatorName || session?.operatorName || '系统',
  };
  trails.push(newTrail);
  saveAuditTrails(trails);
  return newTrail;
};

export const saveDailySessions = (sessions: DailyWorkSession[]): void => {
  saveToStorage('dailySessions', sessions);
};

export const loadDailySessions = (): DailyWorkSession[] => {
  return loadFromStorage<DailyWorkSession>('dailySessions');
};

export const startNewSession = (operatorName: string): DailyWorkSession => {
  const sessions = loadDailySessions();
  const today = new Date().toISOString().split('T')[0];
  
  let activeSession = sessions.find(s => s.date === today && s.status === 'active');
  if (activeSession) {
    return activeSession;
  }
  
  const newSession: DailyWorkSession = {
    id: `session_${generateId()}`,
    date: today,
    operatorName,
    startTime: Date.now(),
    endTime: null,
    status: 'active',
    prescriptionsImported: 0,
    batchesImported: 0,
    schedulesCreated: 0,
    risksDetected: 0,
    risksReviewed: 0,
    notes: '',
  };
  
  sessions.push(newSession);
  saveDailySessions(sessions);
  
  localStorage.setItem(getStorageKey('currentSessionId'), newSession.id);
  
  addAuditTrail({
    entityType: 'prescription',
    entityId: newSession.id,
    action: 'create',
    details: `开始新工作会话: ${operatorName}`,
    operatorName,
  });
  
  return newSession;
};

export const endCurrentSession = (): DailyWorkSession | null => {
  const currentSessionId = localStorage.getItem(getStorageKey('currentSessionId'));
  if (!currentSessionId) return null;
  
  const sessions = loadDailySessions();
  const index = sessions.findIndex(s => s.id === currentSessionId);
  if (index === -1) return null;
  
  sessions[index] = {
    ...sessions[index],
    endTime: Date.now(),
    status: 'completed',
  };
  
  saveDailySessions(sessions);
  localStorage.removeItem(getStorageKey('currentSessionId'));
  
  addAuditTrail({
    entityType: 'prescription',
    entityId: sessions[index].id,
    action: 'update',
    details: `结束工作会话: ${sessions[index].operatorName}`,
    operatorName: sessions[index].operatorName,
  });
  
  return sessions[index];
};

export const getCurrentSession = (): DailyWorkSession | null => {
  const currentSessionId = localStorage.getItem(getStorageKey('currentSessionId'));
  if (!currentSessionId) return null;
  
  const sessions = loadDailySessions();
  return sessions.find(s => s.id === currentSessionId) || null;
};

export const updateSessionStats = (
  updates: Partial<Pick<DailyWorkSession, 'prescriptionsImported' | 'batchesImported' | 'schedulesCreated' | 'risksDetected' | 'risksReviewed'>>
): void => {
  const currentSessionId = localStorage.getItem(getStorageKey('currentSessionId'));
  if (!currentSessionId) return;
  
  const sessions = loadDailySessions();
  const index = sessions.findIndex(s => s.id === currentSessionId);
  if (index === -1) return;
  
  sessions[index] = {
    ...sessions[index],
    prescriptionsImported: (sessions[index].prescriptionsImported || 0) + (updates.prescriptionsImported || 0),
    batchesImported: (sessions[index].batchesImported || 0) + (updates.batchesImported || 0),
    schedulesCreated: (sessions[index].schedulesCreated || 0) + (updates.schedulesCreated || 0),
    risksDetected: (sessions[index].risksDetected || 0) + (updates.risksDetected || 0),
    risksReviewed: (sessions[index].risksReviewed || 0) + (updates.risksReviewed || 0),
  };
  
  saveDailySessions(sessions);
};

export const checkStorageQuota = (): { used: number; total: number; available: number } => {
  let used = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith(STORAGE_PREFIX)) {
      used += (localStorage[key].length + key.length) * 2;
    }
  }
  
  const total = 5 * 1024 * 1024;
  const available = total - used;
  
  return { used, total, available };
};

export const clearAllData = (): void => {
  const keysToRemove: string[] = [];
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  addAuditTrail({
    entityType: 'prescription',
    entityId: 'system',
    action: 'delete',
    details: '清除所有数据',
  });
};

export const exportAllData = (): Record<string, unknown> => {
  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    prescriptions: loadPrescriptions(),
    herbBatches: loadHerbBatches(),
    decoctionPots: loadDecoctionPots(),
    decoctionSchedules: loadDecoctionSchedules(),
    pickupTimeSlots: loadPickupTimeSlots(),
    riskEvents: loadRiskEvents(),
    reviewLogs: loadReviewLogs(),
    auditTrails: loadAuditTrails(),
    dailySessions: loadDailySessions(),
  };
};

export const importAllData = (data: Record<string, unknown>): boolean => {
  try {
    if (data.prescriptions) savePrescriptions(data.prescriptions as Prescription[]);
    if (data.herbBatches) saveHerbBatches(data.herbBatches as HerbBatch[]);
    if (data.decoctionPots) saveDecoctionPots(data.decoctionPots as DecoctionPot[]);
    if (data.decoctionSchedules) saveDecoctionSchedules(data.decoctionSchedules as DecoctionSchedule[]);
    if (data.pickupTimeSlots) savePickupTimeSlots(data.pickupTimeSlots as PickupTimeSlot[]);
    if (data.riskEvents) saveRiskEvents(data.riskEvents as RiskEvent[]);
    if (data.reviewLogs) saveReviewLogs(data.reviewLogs as ReviewLog[]);
    if (data.auditTrails) saveAuditTrails(data.auditTrails as AuditTrail[]);
    if (data.dailySessions) saveDailySessions(data.dailySessions as DailyWorkSession[]);
    
    addAuditTrail({
      entityType: 'prescription',
      entityId: 'system',
      action: 'import',
      details: '导入数据备份',
    });
    
    return true;
  } catch (error) {
    console.error('导入数据失败:', error);
    return false;
  }
};

export const initializeDefaultData = (): void => {
  const existingPots = loadDecoctionPots();
  if (existingPots.length === 0) {
    const defaultPots: DecoctionPot[] = [
      {
        id: `pot_${generateId()}`,
        potNo: '01',
        name: '自动煎药锅1号',
        capacity: 20,
        capacityUnit: 'L',
        type: 'automatic',
        status: 'idle',
        currentPrescriptionId: null,
        currentScheduleId: null,
        lastUsedAt: null,
        location: '煎药区A',
        notes: '',
      },
      {
        id: `pot_${generateId()}`,
        potNo: '02',
        name: '自动煎药锅2号',
        capacity: 20,
        capacityUnit: 'L',
        type: 'automatic',
        status: 'idle',
        currentPrescriptionId: null,
        currentScheduleId: null,
        lastUsedAt: null,
        location: '煎药区A',
        notes: '',
      },
      {
        id: `pot_${generateId()}`,
        potNo: '03',
        name: '自动煎药锅3号',
        capacity: 30,
        capacityUnit: 'L',
        type: 'automatic',
        status: 'idle',
        currentPrescriptionId: null,
        currentScheduleId: null,
        lastUsedAt: null,
        location: '煎药区B',
        notes: '大容量锅',
      },
      {
        id: `pot_${generateId()}`,
        potNo: '04',
        name: '半自动煎药锅1号',
        capacity: 15,
        capacityUnit: 'L',
        type: 'semi_automatic',
        status: 'idle',
        currentPrescriptionId: null,
        currentScheduleId: null,
        lastUsedAt: null,
        location: '煎药区B',
        notes: '特殊处方专用',
      },
    ];
    saveDecoctionPots(defaultPots);
  }

  const existingSlots = loadPickupTimeSlots();
  const today = new Date().toISOString().split('T')[0];
  const todaySlots = existingSlots.filter(s => s.date === today);
  
  if (todaySlots.length === 0) {
    const defaultSlots: PickupTimeSlot[] = [
      {
        id: `slot_${generateId()}`,
        date: today,
        startTime: '08:00',
        endTime: '10:00',
        maxCapacity: 20,
        currentBookings: 0,
        status: 'active',
        notes: '早间取药',
      },
      {
        id: `slot_${generateId()}`,
        date: today,
        startTime: '10:00',
        endTime: '12:00',
        maxCapacity: 25,
        currentBookings: 0,
        status: 'active',
        notes: '午间取药',
      },
      {
        id: `slot_${generateId()}`,
        date: today,
        startTime: '14:00',
        endTime: '16:00',
        maxCapacity: 20,
        currentBookings: 0,
        status: 'active',
        notes: '下午取药',
      },
      {
        id: `slot_${generateId()}`,
        date: today,
        startTime: '16:00',
        endTime: '18:00',
        maxCapacity: 25,
        currentBookings: 0,
        status: 'active',
        notes: '晚间取药',
      },
    ];
    const allSlots = [...existingSlots, ...defaultSlots];
    savePickupTimeSlots(allSlots);
  }
};
