import sqlite3 from 'sqlite3';
import { 
  ShiftSwap, 
  ShiftSwapStatus, 
  SwapReason, 
  Shift, 
  Driver,
  ValidationResult,
  ShiftSwapHistory
} from '../types';
import { 
  ShiftSwapRepository, 
  ShiftRepository, 
  DriverRepository 
} from '../repositories';

export class ShiftSwapService {
  private swapRepo: ShiftSwapRepository;
  private shiftRepo: ShiftRepository;
  private driverRepo: DriverRepository;

  constructor(db: sqlite3.Database) {
    this.swapRepo = new ShiftSwapRepository(db);
    this.shiftRepo = new ShiftRepository(db);
    this.driverRepo = new DriverRepository(db);
  }

  async createSwap(request: {
    originalShiftId: string;
    originalDriverId: string;
    newDriverId: string;
    swapReason: SwapReason;
    reasonDetail?: string;
    requestedBy: string;
  }): Promise<{ swap: ShiftSwap; validation: ValidationResult }> {
    const validation = await this.validateSwapRequest(request);
    
    if (!validation.isValid) {
      return { swap: {} as ShiftSwap, validation };
    }

    const shift = await this.shiftRepo.findById(request.originalShiftId);
    if (!shift) {
      validation.isValid = false;
      validation.errors.push('班次不存在');
      return { swap: {} as ShiftSwap, validation };
    }

    const conflicts = await this.swapRepo.findConflicts(
      request.newDriverId,
      shift.shiftDate,
      shift.startTime,
      shift.endTime
    );

    const initialStatus = conflicts.length > 0 
      ? ShiftSwapStatus.CONFLICT_PENDING 
      : ShiftSwapStatus.PENDING_CONFIRM;

    const swap = await this.swapRepo.create({
      originalShiftId: request.originalShiftId,
      originalDriverId: request.originalDriverId,
      newDriverId: request.newDriverId,
      swapReason: request.swapReason,
      reasonDetail: request.reasonDetail,
      status: initialStatus,
      conflictReason: conflicts.length > 0 
        ? `新司机在同一时间段已有${conflicts.length}个换班申请待处理` 
        : undefined
    });

    await this.swapRepo.addHistory({
      swapId: swap.id,
      previousStatus: '' as ShiftSwapStatus,
      newStatus: initialStatus,
      changedBy: request.requestedBy,
      changeReason: conflicts.length > 0 ? '检测到时间冲突' : '创建申请'
    });

    return { swap, validation };
  }

  async confirmSwap(
    swapId: string,
    confirmedBy: string,
    changeReason?: string
  ): Promise<{ swap: ShiftSwap | undefined; validation: ValidationResult }> {
    const swap = await this.swapRepo.findById(swapId);
    const validation: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!swap) {
      validation.isValid = false;
      validation.errors.push('换班记录不存在');
      return { swap: undefined, validation };
    }

    if (swap.status === ShiftSwapStatus.COMPLETED) {
      validation.isValid = false;
      validation.errors.push('该换班已完成，无法重复确认');
      return { swap, validation };
    }

    const previousStatus = swap.status;
    let newStatus: ShiftSwapStatus;

    if (previousStatus === ShiftSwapStatus.CONFLICT_PENDING) {
      newStatus = ShiftSwapStatus.SWAPPED;
    } else {
      newStatus = ShiftSwapStatus.SWAPPED;
    }

    const updatedSwap = await this.swapRepo.updateStatus(
      swapId,
      newStatus,
      undefined,
      confirmedBy
    );

    await this.shiftRepo.updateDriver(swap.originalShiftId, swap.newDriverId);

    await this.swapRepo.addHistory({
      swapId,
      previousStatus,
      newStatus,
      changedBy: confirmedBy,
      changeReason: changeReason || '审核通过'
    });

    return { swap: updatedSwap, validation };
  }

  async completeSwap(
    swapId: string,
    completedBy: string
  ): Promise<{ swap: ShiftSwap | undefined; validation: ValidationResult }> {
    const swap = await this.swapRepo.findById(swapId);
    const validation: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!swap) {
      validation.isValid = false;
      validation.errors.push('换班记录不存在');
      return { swap: undefined, validation };
    }

    if (swap.status !== ShiftSwapStatus.SWAPPED) {
      validation.isValid = false;
      validation.errors.push('只有已换班状态的记录才能标记为完成');
      return { swap, validation };
    }

    const updatedSwap = await this.swapRepo.updateStatus(
      swapId,
      ShiftSwapStatus.COMPLETED,
      undefined,
      completedBy
    );

    await this.swapRepo.addHistory({
      swapId,
      previousStatus: ShiftSwapStatus.SWAPPED,
      newStatus: ShiftSwapStatus.COMPLETED,
      changedBy: completedBy,
      changeReason: '班次完成'
    });

    return { swap: updatedSwap, validation };
  }

  async getSwapById(id: string): Promise<ShiftSwap | undefined> {
    return this.swapRepo.findById(id);
  }

  async getSwapList(filters?: {
    status?: ShiftSwapStatus;
    originalDriverId?: string;
    newDriverId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ShiftSwap[]> {
    return this.swapRepo.findAll(filters);
  }

  async getSwapHistory(swapId: string): Promise<ShiftSwapHistory[]> {
    return this.swapRepo.getHistory(swapId);
  }

  async getSwapWithDetails(id: string): Promise<{
    swap: ShiftSwap | undefined;
    originalShift: Shift | undefined;
    originalDriver: Driver | undefined;
    newDriver: Driver | undefined;
    history: ShiftSwapHistory[];
  }> {
    const swap = await this.swapRepo.findById(id);
    
    if (!swap) {
      return { swap: undefined, originalShift: undefined, originalDriver: undefined, newDriver: undefined, history: [] };
    }

    const [originalShift, originalDriver, newDriver, history] = await Promise.all([
      this.shiftRepo.findById(swap.originalShiftId),
      this.driverRepo.findById(swap.originalDriverId),
      this.driverRepo.findById(swap.newDriverId),
      this.swapRepo.getHistory(id)
    ]);

    return { swap, originalShift, originalDriver, newDriver, history };
  }

  private async validateSwapRequest(request: {
    originalShiftId: string;
    originalDriverId: string;
    newDriverId: string;
    swapReason: SwapReason;
  }): Promise<ValidationResult> {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!request.originalShiftId) {
      result.isValid = false;
      result.errors.push('原班次ID不能为空');
    }
    if (!request.originalDriverId) {
      result.isValid = false;
      result.errors.push('原司机ID不能为空');
    }
    if (!request.newDriverId) {
      result.isValid = false;
      result.errors.push('新司机ID不能为空');
    }
    if (!request.swapReason) {
      result.isValid = false;
      result.errors.push('换班原因不能为空');
    }

    if (request.originalDriverId === request.newDriverId) {
      result.isValid = false;
      result.errors.push('原司机和新司机不能相同');
    }

    if (result.errors.length > 0) {
      return result;
    }

    const [originalDriver, newDriver, shift] = await Promise.all([
      this.driverRepo.findById(request.originalDriverId),
      this.driverRepo.findById(request.newDriverId),
      this.shiftRepo.findById(request.originalShiftId)
    ]);

    if (!originalDriver) {
      result.isValid = false;
      result.errors.push('原司机不存在');
    } else if (originalDriver.status !== 'active') {
      result.isValid = false;
      result.errors.push(`原司机状态为${originalDriver.status}，无法发起换班`);
    }

    if (!newDriver) {
      result.isValid = false;
      result.errors.push('新司机不存在');
    } else if (newDriver.status !== 'active') {
      result.isValid = false;
      result.errors.push(`新司机状态为${newDriver.status}，无法接班`);
    }

    if (!shift) {
      result.isValid = false;
      result.errors.push('班次不存在');
    } else if (shift.driverId !== request.originalDriverId) {
      result.isValid = false;
      result.errors.push('该班次不属于原司机');
    } else if (shift.status === 'completed' || shift.status === 'cancelled') {
      result.isValid = false;
      result.errors.push(`班次状态为${shift.status}，无法换班`);
    }

    return result;
  }

  async validateRowData(row: Record<string, unknown>, rowNumber: number): Promise<ValidationResult> {
    const result: ValidationResult = { rowNumber, isValid: true, errors: [], warnings: [], data: row };

    if (!row.originalShiftId) {
      result.isValid = false;
      result.errors.push('缺少原班次ID');
    }
    if (!row.originalDriverId) {
      result.isValid = false;
      result.errors.push('缺少原司机ID');
    }
    if (!row.newDriverId) {
      result.isValid = false;
      result.errors.push('缺少新司机ID');
    }
    if (!row.swapReason) {
      result.isValid = false;
      result.errors.push('缺少换班原因');
    }

    if (row.swapReason && !Object.values(SwapReason).includes(row.swapReason as SwapReason)) {
      result.isValid = false;
      result.errors.push(`无效的换班原因: ${row.swapReason}`);
    }

    if (result.errors.length === 0) {
      const [originalDriver, newDriver, shift] = await Promise.all([
        this.driverRepo.findById(row.originalDriverId as string),
        this.driverRepo.findById(row.newDriverId as string),
        this.shiftRepo.findById(row.originalShiftId as string)
      ]);

      if (!originalDriver) {
        result.warnings.push('原司机ID在系统中不存在');
      }
      if (!newDriver) {
        result.warnings.push('新司机ID在系统中不存在');
      }
      if (!shift) {
        result.warnings.push('班次ID在系统中不存在');
      }
    }

    return result;
  }

  async exportSwaps(filters?: {
    status?: ShiftSwapStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<Array<Record<string, unknown>>> {
    const swaps = await this.swapRepo.findAll(filters);
    const results: Array<Record<string, unknown>> = [];

    for (const swap of swaps) {
      const details = await this.getSwapWithDetails(swap.id);
      results.push({
        swapId: swap.id,
        status: swap.status,
        swapReason: swap.swapReason,
        reasonDetail: swap.reasonDetail || '',
        conflictReason: swap.conflictReason || '',
        shiftDate: details.originalShift?.shiftDate || '',
        startTime: details.originalShift?.startTime || '',
        endTime: details.originalShift?.endTime || '',
        route: details.originalShift?.route || '',
        originalDriverName: details.originalDriver?.name || '',
        originalDriverPhone: details.originalDriver?.phone || '',
        newDriverName: details.newDriver?.name || '',
        newDriverPhone: details.newDriver?.phone || '',
        confirmedAt: swap.confirmedAt || '',
        createdAt: swap.createdAt
      });
    }

    return results;
  }
}
