import {
  ViolationRecord,
  Shift,
  Driver,
  Vehicle,
  Penalty,
  Appeal,
  ImportBatch,
  ProcessingHistory,
  ViolationFilterParams,
} from '../types';
import {
  getViolations,
  getShifts,
  saveShifts,
  getDrivers,
  saveDrivers,
  getVehicles,
  saveVehicles,
  getBatches,
  addHistory,
  generateId,
  initMockData,
  getHistory,
} from '../store/storage';
import {
  importViolations,
  matchShift,
  confirmViolation,
  submitAppeal,
  reviewAppeal,
  applyPenalty,
  rollbackPenalty,
  filterViolations,
} from './violationService';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const violationApi = {
  async getAll(): Promise<ApiResponse<ViolationRecord[]>> {
    await delay(100);
    return { success: true, data: getViolations() };
  },

  async filter(params: ViolationFilterParams): Promise<ApiResponse<ViolationRecord[]>> {
    await delay(150);
    return { success: true, data: filterViolations(params) };
  },

  async getById(id: string): Promise<ApiResponse<ViolationRecord | undefined>> {
    await delay(50);
    const violation = getViolations().find((v) => v.id === id);
    return { success: true, data: violation };
  },

  async import(data: any[], fileName: string, importedBy: string): Promise<ApiResponse<any>> {
    await delay(500);
    const result = importViolations(data, fileName, importedBy);
    return {
      success: true,
      data: result,
      message: `成功导入 ${result.batch.successfulRecords} 条记录`,
    };
  },

  async matchShift(violationId: string, shiftId: string, operator: string, operatorId: string): Promise<ApiResponse<ViolationRecord | null>> {
    await delay(200);
    const result = matchShift(violationId, shiftId, operator, operatorId);
    return {
      success: true,
      data: result,
      message: result ? '班次匹配成功' : '匹配失败',
    };
  },

  async confirm(violationId: string, driverId: string, operator: string, operatorId: string): Promise<ApiResponse<ViolationRecord | null>> {
    await delay(200);
    const result = confirmViolation(violationId, driverId, operator, operatorId);
    return {
      success: true,
      data: result,
      message: '违章确认成功',
    };
  },

  async submitAppeal(violationId: string, driverId: string, reason: string, materials: any[] = []
  ): Promise<ApiResponse<Appeal | null>> {
    await delay(300);
    const result = submitAppeal(violationId, driverId, reason, materials);
    return {
      success: true,
      data: result,
      message: '申诉提交成功',
    };
  },

  async reviewAppeal(appealId: string, approved: boolean, reviewNotes: string, reviewer: string, reviewerId: string): Promise<ApiResponse<Appeal | null>> {
    await delay(300);
    const result = reviewAppeal(appealId, approved, reviewNotes, reviewer, reviewerId);
    return {
      success: true,
      data: result,
      message: approved ? '申诉已通过，处罚已自动回滚' : '申诉已驳回',
    };
  },

  async applyPenalty(violationId: string, operator: string, operatorId: string): Promise<ApiResponse<Penalty | null>> {
    await delay(200);
    try {
      const result = applyPenalty(violationId, operator, operatorId);
      return {
        success: true,
        data: result,
        message: '处罚执行成功',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  async rollbackPenalty(penaltyId: string, reason: string, operator: string, operatorId: string): Promise<ApiResponse<Penalty | null>> {
    await delay(200);
    const result = rollbackPenalty(penaltyId, reason, operator, operatorId);
    return {
      success: true,
      data: result,
      message: '处罚已回滚',
    };
  },
};

export const historyApi = {
  async getByViolationId(violationId: string): Promise<ApiResponse<ProcessingHistory[]>> {
    await delay(100);
    const histories = getHistory();
    return {
      success: true,
      data: histories.filter((h: ProcessingHistory) => h.violationId === violationId),
    };
  },

  async add(violationId: string, action: string, operator: string, operatorId: string, remarks?: string, oldStatus?: string, newStatus?: string): Promise<ApiResponse<ProcessingHistory>> {
    await delay(50);
    const history = addHistory(violationId, action, operator, operatorId, remarks, oldStatus, newStatus);
    return { success: true, data: history };
  },
};

export const driverApi = {
  async getAll(): Promise<ApiResponse<Driver[]>> {
    await delay(100);
    return { success: true, data: getDrivers() };
  },

  async create(driver: Omit<Driver, 'id' | 'totalPoints' | 'remainingPoints'>): Promise<ApiResponse<Driver>> {
    await delay(200);
    const drivers = getDrivers();
    const newDriver: Driver = {
      id: generateId(),
      ...driver,
      totalPoints: 12,
      remainingPoints: 12,
    };
    drivers.unshift(newDriver);
    saveDrivers(drivers);
    return { success: true, data: newDriver, message: '司机创建成功' };
  },

  async update(id: string, data: Partial<Driver>): Promise<ApiResponse<Driver | null>> {
    await delay(200);
    const drivers = getDrivers();
    const index = drivers.findIndex((d) => d.id === id);
    if (index === -1) {
      return { success: false, error: '司机不存在' };
    }
    drivers[index] = { ...drivers[index], ...data };
    saveDrivers(drivers);
    return { success: true, data: drivers[index], message: '司机信息更新成功' };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    await delay(200);
    const drivers = getDrivers().filter((d) => d.id !== id);
    saveDrivers(drivers);
    return { success: true, message: '司机已删除' };
  },
};

export const vehicleApi = {
  async getAll(): Promise<ApiResponse<Vehicle[]>> {
    await delay(100);
    return { success: true, data: getVehicles() };
  },

  async create(vehicle: Omit<Vehicle, 'id'>): Promise<ApiResponse<Vehicle>> {
    await delay(200);
    const vehicles = getVehicles();
    const newVehicle: Vehicle = {
      id: generateId(),
      ...vehicle,
    };
    vehicles.unshift(newVehicle);
    saveVehicles(vehicles);
    return { success: true, data: newVehicle, message: '车辆创建成功' };
  },

  async update(id: string, data: Partial<Vehicle>): Promise<ApiResponse<Vehicle | null>> {
    await delay(200);
    const vehicles = getVehicles();
    const index = vehicles.findIndex((v) => v.id === id);
    if (index === -1) {
      return { success: false, error: '车辆不存在' };
    }
    vehicles[index] = { ...vehicles[index], ...data };
    saveVehicles(vehicles);
    return { success: true, data: vehicles[index], message: '车辆信息更新成功' };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    await delay(200);
    const vehicles = getVehicles().filter((v) => v.id !== id);
    saveVehicles(vehicles);
    return { success: true, message: '车辆已删除' };
  },
};

export const shiftApi = {
  async getAll(): Promise<ApiResponse<Shift[]>> {
    await delay(100);
    return { success: true, data: getShifts() };
  },

  async create(shift: Omit<Shift, 'id'>): Promise<ApiResponse<Shift>> {
    await delay(200);
    const shifts = getShifts();
    const newShift: Shift = {
      id: generateId(),
      ...shift,
    };
    shifts.unshift(newShift);
    saveShifts(shifts);
    return { success: true, data: newShift, message: '班次创建成功' };
  },

  async update(id: string, data: Partial<Shift>): Promise<ApiResponse<Shift | null>> {
    await delay(200);
    const shifts = getShifts();
    const index = shifts.findIndex((s) => s.id === id);
    if (index === -1) {
      return { success: false, error: '班次不存在' };
    }
    shifts[index] = { ...shifts[index], ...data };
    saveShifts(shifts);
    return { success: true, data: shifts[index], message: '班次信息更新成功' };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    await delay(200);
    const shifts = getShifts().filter((s) => s.id !== id);
    saveShifts(shifts);
    return { success: true, message: '班次已删除' };
  },
};

export const batchApi = {
  async getAll(): Promise<ApiResponse<ImportBatch[]>> {
    await delay(100);
    return { success: true, data: getBatches() };
  },
};

export const initData = async (): Promise<void> => {
  await delay(500);
  initMockData();
};

export { getHistory } from '../store/storage';
