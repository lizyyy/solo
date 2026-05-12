import { Driver, Vehicle, Shift, ViolationRecord, ProcessingHistory, Appeal, Penalty, ImportBatch } from '../types';

const STORAGE_KEYS = {
  DRIVERS: 'violation_drivers',
  VEHICLES: 'violation_vehicles',
  SHIFTS: 'violation_shifts',
  VIOLATIONS: 'violation_records',
  HISTORY: 'violation_history',
  APPEALS: 'violation_appeals',
  PENALTIES: 'violation_penalties',
  BATCHES: 'violation_batches',
};

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  },
};

export const getDrivers = (): Driver[] => 
  storage.get<Driver[]>(STORAGE_KEYS.DRIVERS, []);

export const saveDrivers = (drivers: Driver[]) => 
  storage.set(STORAGE_KEYS.DRIVERS, drivers);

export const getVehicles = (): Vehicle[] => 
  storage.get<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);

export const saveVehicles = (vehicles: Vehicle[]) => 
  storage.set(STORAGE_KEYS.VEHICLES, vehicles);

export const getShifts = (): Shift[] => 
  storage.get<Shift[]>(STORAGE_KEYS.SHIFTS, []);

export const saveShifts = (shifts: Shift[]) => 
  storage.set(STORAGE_KEYS.SHIFTS, shifts);

export const getViolations = (): ViolationRecord[] => 
  storage.get<ViolationRecord[]>(STORAGE_KEYS.VIOLATIONS, []);

export const saveViolations = (violations: ViolationRecord[]) => 
  storage.set(STORAGE_KEYS.VIOLATIONS, violations);

export const getHistory = (): ProcessingHistory[] => 
  storage.get<ProcessingHistory[]>(STORAGE_KEYS.HISTORY, []);

export const saveHistory = (history: ProcessingHistory[]) => 
  storage.set(STORAGE_KEYS.HISTORY, history);

export const getAppeals = (): Appeal[] => 
  storage.get<Appeal[]>(STORAGE_KEYS.APPEALS, []);

export const saveAppeals = (appeals: Appeal[]) => 
  storage.set(STORAGE_KEYS.APPEALS, appeals);

export const getPenalties = (): Penalty[] => 
  storage.get<Penalty[]>(STORAGE_KEYS.PENALTIES, []);

export const savePenalties = (penalties: Penalty[]) => 
  storage.set(STORAGE_KEYS.PENALTIES, penalties);

export const getBatches = (): ImportBatch[] => 
  storage.get<ImportBatch[]>(STORAGE_KEYS.BATCHES, []);

export const saveBatches = (batches: ImportBatch[]) => 
  storage.set(STORAGE_KEYS.BATCHES, batches);

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const addHistory = (
  violationId: string,
  action: string,
  operator: string,
  operatorId: string,
  remarks?: string,
  oldStatus?: string,
  newStatus?: string
): ProcessingHistory => {
  const history: ProcessingHistory = {
    id: generateId(),
    violationId,
    action,
    operator,
    operatorId,
    timestamp: new Date().toISOString(),
    remarks,
    oldStatus: oldStatus as any,
    newStatus: newStatus as any,
  };
  const histories = getHistory();
  histories.unshift(history);
  saveHistory(histories);
  return history;
};

export const initMockData = () => {
  if (getDrivers().length === 0) {
    const drivers: Driver[] = [
      { id: 'd1', name: '张明', licenseNumber: 'A12345678', phone: '13800138001', totalPoints: 12, remainingPoints: 9 },
      { id: 'd2', name: '李强', licenseNumber: 'A23456789', phone: '13800138002', totalPoints: 12, remainingPoints: 10 },
      { id: 'd3', name: '王芳', licenseNumber: 'A34567890', phone: '13800138003', totalPoints: 12, remainingPoints: 12 },
      { id: 'd4', name: '刘伟', licenseNumber: 'A45678901', phone: '13800138004', totalPoints: 12, remainingPoints: 8 },
      { id: 'd5', name: '陈静', licenseNumber: 'A56789012', phone: '13800138005', totalPoints: 12, remainingPoints: 11 },
    ];
    saveDrivers(drivers);
  }

  if (getVehicles().length === 0) {
    const vehicles: Vehicle[] = [
      { id: 'v1', plateNumber: '京A12345', vehicleType: '货车', brand: '解放' },
      { id: 'v2', plateNumber: '京B23456', vehicleType: '货车', brand: '东风' },
      { id: 'v3', plateNumber: '京C34567', vehicleType: '客车', brand: '宇通' },
      { id: 'v4', plateNumber: '京D45678', vehicleType: '货车', brand: '重汽' },
      { id: 'v5', plateNumber: '京E56789', vehicleType: '客车', brand: '金龙' },
    ];
    saveVehicles(vehicles);
  }

  if (getShifts().length === 0) {
    const shifts: Shift[] = [
      { id: 's1', vehicleId: 'v1', driverId: 'd1', startTime: '2026-05-10T08:00:00', endTime: '2026-05-10T18:00:00', notes: '白班' },
      { id: 's2', vehicleId: 'v1', driverId: 'd2', startTime: '2026-05-10T18:00:00', endTime: '2026-05-11T06:00:00', notes: '夜班' },
      { id: 's3', vehicleId: 'v2', driverId: 'd3', startTime: '2026-05-10T08:00:00', endTime: '2026-05-10T20:00:00', notes: '长途' },
      { id: 's4', vehicleId: 'v3', driverId: 'd4', startTime: '2026-05-11T06:00:00', endTime: '2026-05-11T18:00:00', notes: '白班' },
      { id: 's5', vehicleId: 'v4', driverId: 'd5', startTime: '2026-05-11T00:00:00', endTime: '2026-05-11T12:00:00', notes: '早班' },
      { id: 's6', vehicleId: 'v1', driverId: 'd1', startTime: '2026-05-12T08:00:00', endTime: '2026-05-12T18:00:00', notes: '白班' },
    ];
    saveShifts(shifts);
  }
};
